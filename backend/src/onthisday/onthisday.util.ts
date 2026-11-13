/**
 * "On this day": film people born / who died on a date (Wikidata, day-precise dates only), enriched from TMDB, and
 * film / series anniversaries from our World table. Pure helpers here; network + cache in the service.
 */

export type Scope = 'india' | 'world';
export type Event = 'birth' | 'death';

/** Occupations we look for (Wikidata ids → label). */
export const OCCUPATIONS: Record<string, string> = {
  Q33999: 'Actor',
  Q10800557: 'Actor',
  Q2526255: 'Director',
  Q177220: 'Singer',
  Q2259451: 'Actor', // stage actor
  Q36834: 'Composer',
  Q28389: 'Writer',
  Q3282637: 'Producer',
  Q1414443: 'Cinematographer',
  Q2405480: 'Voice actor',
};
const INDIA_OCC = ['Q33999', 'Q10800557', 'Q2526255', 'Q177220', 'Q36834', 'Q28389', 'Q3282637', 'Q1414443'];
const WORLD_OCC = ['Q33999', 'Q10800557', 'Q2526255', 'Q36834'];

/** Minimum Wikipedia/Wikimedia sitelinks — a cheap "how well known" filter. */
export const MIN_SITELINKS: Record<Scope, Record<Event, number>> = {
  india: { birth: 5, death: 5 },
  world: { birth: 70, death: 50 },
};

export function peopleQuery(month: number, day: number, scope: Scope, event: Event): string {
  const occ = (scope === 'india' ? INDIA_OCC : WORLD_OCC).map(q => `wd:${q}`).join(' ');
  const exact = event === 'birth' ? 'P569' : 'P570';
  const other = event === 'birth' ? 'P570' : 'P569';
  const exactVar = event === 'birth' ? '?birth' : '?death';
  const otherVar = event === 'birth' ? '?death' : '?birth';
  return `SELECT ?p ?pLabel ?birth ?death ?occ ?tmdb ?imdb ?sl ?article WHERE {
  VALUES ?occ { ${occ} }
  ?p wdt:P106 ?occ.${scope === 'india' ? '\n  ?p wdt:P27 wd:Q668.' : ''}
  ?p p:${exact}/psv:${exact} [ wikibase:timeValue ${exactVar}; wikibase:timePrecision 11 ].
  FILTER(MONTH(${exactVar}) = ${month} && DAY(${exactVar}) = ${day})
  ?p wikibase:sitelinks ?sl. FILTER(?sl >= ${MIN_SITELINKS[scope][event]})
  OPTIONAL { ?p p:${other}/psv:${other} [ wikibase:timeValue ${otherVar}; wikibase:timePrecision ?op ]. FILTER(?op >= 9) }
  OPTIONAL { ?p wdt:P4985 ?tmdb }
  OPTIONAL { ?p wdt:P345 ?imdb }
  OPTIONAL { ?article schema:about ?p; schema:isPartOf <https://en.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 400`;
}

export interface WdPerson {
  wikidataId: string;
  name: string;
  birth: string | null; // YYYY-MM-DD
  death: string | null;
  occupations: string[];
  tmdbId: number | null;
  imdbId: string | null;
  sitelinks: number;
  wikipedia: string | null;
  scope: Scope;
}

const isoDate = (v?: string) => {
  const m = v?.match(/^([+-]?\d{4,})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  return y < 1 ? null : `${String(y).padStart(4, '0')}-${m[2]}-${m[3]}`;
};

/** SPARQL JSON → one row per person (occupations merged), best known first. */
export function parsePeople(json: any, scope: Scope): WdPerson[] {
  const by = new Map<string, WdPerson>();
  for (const b of json?.results?.bindings || []) {
    const id = String(b.p?.value || '').split('/').pop() || '';
    if (!/^Q\d+$/.test(id)) continue;
    const name = b.pLabel?.value || '';
    if (!name || /^Q\d+$/.test(name)) continue; // no English label → skip
    const occ = OCCUPATIONS[String(b.occ?.value || '').split('/').pop() || ''];
    const cur = by.get(id);
    if (cur) {
      if (occ && !cur.occupations.includes(occ)) cur.occupations.push(occ);
      cur.birth ||= isoDate(b.birth?.value);
      cur.death ||= isoDate(b.death?.value);
      cur.tmdbId ||= Number(b.tmdb?.value) || null;
      cur.imdbId ||= b.imdb?.value || null;
      continue;
    }
    by.set(id, {
      wikidataId: id,
      name,
      birth: isoDate(b.birth?.value),
      death: isoDate(b.death?.value),
      occupations: occ ? [occ] : [],
      tmdbId: Number(b.tmdb?.value) || null,
      imdbId: /^nm\d+$/.test(b.imdb?.value || '') ? b.imdb.value : null,
      sitelinks: Number(b.sl?.value) || 0,
      wikipedia: b.article?.value || null,
      scope,
    });
  }
  return [...by.values()].sort((a, b) => b.sitelinks - a.sitelinks);
}

/** India release dates of films (by IMDb id) from Wikidata publication dates with place = India. */
export function indiaDatesQuery(imdbIds: string[]): string {
  const vals = imdbIds.filter(i => /^tt\d+$/.test(i)).map(i => `"${i}"`).join(' ');
  return `SELECT ?imdb ?date ?place WHERE {
  VALUES ?imdb { ${vals} }
  ?f wdt:P345 ?imdb; p:P577 ?st.
  ?st psv:P577 [ wikibase:timeValue ?date; wikibase:timePrecision 11 ].
  OPTIONAL { ?st pq:P291 ?place }
}`;
}

/** imdbId → release dates Wikidata knows (day-precise) + the India one when it names India as the place. */
export function parseIndiaDates(json: any): Map<string, { india: string | null; dates: string[] }> {
  const out = new Map<string, { india: string | null; dates: string[] }>();
  for (const b of json?.results?.bindings || []) {
    const d = isoDate(b.date?.value);
    const k = b.imdb?.value;
    if (!d || !k) continue;
    const cur = out.get(k) || { india: null, dates: [] };
    if (!cur.dates.includes(d)) cur.dates.push(d);
    if (String(b.place?.value || '').endsWith('/Q668') && (!cur.india || d < cur.india)) cur.india = d;
    out.set(k, cur);
  }
  for (const v of out.values()) v.dates.sort();
  return out;
}

export interface Credit { tmdbId: number; kind: 'movie' | 'tv'; title: string; year: number | null; poster: string | null; backdrop: string | null; votes: number; rating: number | null; language: string | null; role: string | null }

// Talk shows, news, reality, award shows aren't what someone is "known for".
const SKIP_TV_GENRES = new Set([10767, 10763, 10764]);

/** TMDB combined_credits → best known works (by votes), deduped. */
export function knownFor(credits: any, limit = 6): Credit[] {
  const all = [...(credits?.cast || []).map((c: any) => ({ ...c, role: c.character || null })), ...(credits?.crew || []).filter((c: any) => ['Director', 'Original Music Composer', 'Music', 'Screenplay', 'Writer', 'Producer'].includes(c.job)).map((c: any) => ({ ...c, role: c.job }))];
  const seen = new Map<string, Credit>();
  for (const c of all) {
    const kind = c.media_type === 'tv' ? 'tv' : c.media_type === 'movie' ? 'movie' : null;
    if (!kind || !c.id) continue;
    if (kind === 'tv' && (c.genre_ids || []).some((g: number) => SKIP_TV_GENRES.has(g))) continue;
    if (kind === 'tv' && (c.episode_count ?? 99) < 3) continue; // guest spots
    const key = `${kind}:${c.id}`;
    if (seen.has(key)) continue;
    const date = c.release_date || c.first_air_date || '';
    seen.set(key, {
      tmdbId: c.id, kind, title: c.title || c.name || '', year: /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null,
      poster: c.poster_path || null, backdrop: c.backdrop_path || null, votes: c.vote_count || 0, rating: c.vote_count >= 20 ? c.vote_average : null,
      language: c.original_language || null, role: c.role,
    });
  }
  return [...seen.values()].filter(c => c.title && c.year).sort((a, b) => b.votes - a.votes).slice(0, limit);
}

/** Main film industry from someone's best-known work: ta / te / hi / ml / kn / en … */
export function industryOf(credits: any): string | null {
  const counts = new Map<string, number>();
  const list = [...(credits?.cast || []), ...(credits?.crew || [])].filter((c: any) => c.original_language && (c.vote_count || 0) >= 5);
  for (const c of list) counts.set(c.original_language, (counts.get(c.original_language) || 0) + 1 + Math.min(5, (c.vote_count || 0) / 200));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

/** Years between a YYYY-MM-DD and the target year. */
export const yearsSince = (date: string | null, targetYear: number) => (date ? targetYear - Number(date.slice(0, 4)) : null);
/** 1st, 5th, 10th, 25th … anniversaries are worth a post. */
export const isMilestone = (years: number | null) => years != null && years > 0 && (years === 1 || years % 5 === 0);

export function parseDateParam(s?: string): { iso: string; month: number; day: number; year: number; mmdd: string } {
  const now = new Date();
  const m = (s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const year = m ? Number(m[1]) : now.getFullYear();
  const month = m ? Number(m[2]) : now.getMonth() + 1;
  const day = m ? Number(m[3]) : now.getDate();
  if (month < 1 || month > 12 || day < 1 || day > 31) throw new Error('Bad date');
  const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { iso: `${year}-${mmdd}`, month, day, year, mmdd };
}
