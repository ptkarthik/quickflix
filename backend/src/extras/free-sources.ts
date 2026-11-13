/**
 * Free rating / link sources beyond TMDB + OMDb. Every one is matched by a real id (IMDb id → Wikidata → the site's id),
 * never by guessing from a title, so a rating always belongs to the right film or series.
 *
 *  - Wikidata (no key): cross-site ids (RT, Metacritic, Letterboxd, MyAnimeList, AniList, TVmaze, MyDramaList),
 *    the English Wikipedia page, and RT / Metacritic scores as a fallback when OMDb has none.
 *  - TVmaze (no key): series rating, network / streaming channel, status.
 *  - AniList (no key) and Jikan / MyAnimeList (no key): anime scores.
 *  - MDBList (free key, optional): Letterboxd, Trakt, RT audience, Roger Ebert …
 */

export interface ExtRating {
  label: string;
  /** what goes on the post, e.g. "4.3/5", "82%", "7.6/10" */
  value: string;
  votes?: number | null;
  url?: string | null;
  /** where we read it */
  via: string;
}
export type ExtRatings = Record<string, ExtRating>;

export interface WikidataInfo {
  qid: string;
  enwiki: string | null;
  ids: Record<string, string>;
  rt: number | null;
  metacritic: number | null;
}

/** Wikidata property → our key, and how to build the page link from the id. */
export const WIKIDATA_IDS: Record<string, { key: string; url: (id: string) => string }> = {
  P1258: { key: 'rt', url: id => `https://www.rottentomatoes.com/${id}` },
  P1712: { key: 'metacritic', url: id => `https://www.metacritic.com/${id}` },
  P6127: { key: 'letterboxd', url: id => `https://letterboxd.com/film/${id}/` },
  P4086: { key: 'mal', url: id => `https://myanimelist.net/anime/${id}` },
  P8729: { key: 'anilist', url: id => `https://anilist.co/anime/${id}` },
  P8600: { key: 'tvmaze', url: id => `https://www.tvmaze.com/shows/${id}` },
  P3868: { key: 'mydramalist', url: id => `https://mydramalist.com/${id}` },
};
const RT_QID = 'Q105584';
const METACRITIC_QID = 'Q150248';

export function wikidataQuery(imdbId: string) {
  if (!/^tt\d+$/.test(imdbId)) throw new Error('bad IMDb id');
  const props = Object.keys(WIKIDATA_IDS).map(p => `wdt:${p}`).join(' ');
  return `SELECT ?item ?article ?p ?v ?score ?by WHERE {
  ?item wdt:P345 "${imdbId}".
  OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. }
  OPTIONAL { VALUES ?p { ${props} } ?item ?p ?v. }
  OPTIONAL { ?item p:P444 ?st. ?st ps:P444 ?score; pq:P447 ?by. }
}`;
}

const pct = (s: string) => {
  const m = s.match(/^(\d{1,3})\s*%$/);
  return m ? Number(m[1]) : null;
};
const of100 = (s: string) => {
  const m = s.match(/^(\d{1,3})\s*\/\s*100$/);
  return m ? Number(m[1]) : null;
};

/** SPARQL JSON → ids, Wikipedia title, and RT (critics %) / Metacritic (/100) if Wikidata records them. */
export function parseWikidata(body: any): WikidataInfo | null {
  const rows: any[] = body?.results?.bindings || [];
  if (!rows.length) return null;
  const qid = String(rows[0].item?.value || '').split('/').pop() || '';
  const out: WikidataInfo = { qid, enwiki: null, ids: {}, rt: null, metacritic: null };
  for (const r of rows) {
    if (r.article?.value && !out.enwiki) out.enwiki = decodeURIComponent(String(r.article.value).split('/wiki/').pop() || '').replace(/_/g, ' ') || null;
    const p = String(r.p?.value || '').split('/').pop() || '';
    if (WIKIDATA_IDS[p] && r.v?.value) out.ids[WIKIDATA_IDS[p].key] = String(r.v.value);
    const by = String(r.by?.value || '').split('/').pop();
    const score = String(r.score?.value || '').trim();
    if (by === RT_QID && out.rt == null) out.rt = pct(score); // RT also stores an average "8.9/10" — only the % is the Tomatometer
    if (by === METACRITIC_QID && out.metacritic == null) out.metacritic = of100(score);
  }
  return out;
}

export function linksFrom(imdbId: string | null, wd: WikidataInfo | null): Record<string, string> {
  const links: Record<string, string> = {};
  if (imdbId) links.imdb = `https://www.imdb.com/title/${imdbId}/`;
  for (const [p, def] of Object.entries(WIKIDATA_IDS)) {
    void p;
    const id = wd?.ids[def.key];
    if (id) links[def.key] = def.url(id);
  }
  if (wd?.enwiki) links.wikipedia = `https://en.wikipedia.org/wiki/${encodeURIComponent(wd.enwiki.replace(/ /g, '_'))}`;
  return links;
}

/** TVmaze /lookup/shows?imdb= → rating + where it airs. */
export function parseTvmaze(body: any): { rating: ExtRating | null; channel: string | null; status: string | null; url: string | null } | null {
  if (!body?.id) return null;
  const avg = typeof body.rating?.average === 'number' ? body.rating.average : null;
  const url = body.url || null;
  return {
    rating: avg != null ? { label: 'TVmaze', value: `${avg.toFixed(1)}/10`, url, via: 'TVmaze' } : null,
    channel: body.webChannel?.name || body.network?.name || null,
    status: body.status || null,
    url,
  };
}

/** AniList Media → average score (AniList shows it as a %). */
export function parseAnilist(body: any): ExtRating | null {
  const m = body?.data?.Media;
  if (!m || typeof m.averageScore !== 'number') return null;
  return { label: 'AniList', value: `${m.averageScore}%`, votes: typeof m.popularity === 'number' ? m.popularity : null, url: m.siteUrl || null, via: 'AniList' };
}

/** Jikan /anime/{id} → MyAnimeList score. */
export function parseJikan(body: any): ExtRating | null {
  const d = body?.data;
  if (!d || typeof d.score !== 'number') return null;
  return { label: 'MyAnimeList', value: `${d.score.toFixed(2)}/10`, votes: typeof d.scored_by === 'number' ? d.scored_by : null, url: d.url || null, via: 'Jikan (MyAnimeList)' };
}

/** MDBList ratings array → the sources not already covered elsewhere. */
export function parseMdblist(body: any): ExtRatings {
  const out: ExtRatings = {};
  const list: any[] = Array.isArray(body?.ratings) ? body.ratings : [];
  const fmt: Record<string, { key: string; label: string; show: (v: number) => string | null }> = {
    letterboxd: { key: 'letterboxd', label: 'Letterboxd', show: v => (v > 0 && v <= 5 ? `${v.toFixed(1)}/5` : null) },
    trakt: { key: 'trakt', label: 'Trakt', show: v => (v > 0 && v <= 100 ? `${Math.round(v)}%` : null) },
    popcorn: { key: 'rtAudience', label: 'RT Audience', show: v => (v > 0 && v <= 100 ? `${Math.round(v)}%` : null) },
    rogerebert: { key: 'rogerebert', label: 'Roger Ebert', show: v => (v > 0 && v <= 4 ? `${v}/4` : null) },
    mal: { key: 'mal', label: 'MyAnimeList', show: v => (v > 0 && v <= 10 ? `${v.toFixed(2)}/10` : null) },
  };
  for (const r of list) {
    const f = fmt[String(r?.source || '').toLowerCase()];
    const v = typeof r?.value === 'number' ? r.value : Number(r?.value);
    if (!f || !Number.isFinite(v)) continue;
    const value = f.show(v);
    if (value) out[f.key] = { label: f.label, value, votes: typeof r.votes === 'number' && r.votes > 0 ? r.votes : null, url: r.url || null, via: 'MDBList' };
  }
  return out;
}
