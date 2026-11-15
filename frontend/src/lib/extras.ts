import { apiFetch } from './api';
import type { AiCaptionCopy } from './ott';
import type { PostItem } from './postDomain';

/** One-liner + ratings for a title, on any desk. Web facts are cached here after a lookup. */
export interface TitleExtra {
  domain: 'ott' | 'cinema' | 'world';
  refId: string;
  oneLiner: string | null;
  oneLinerSource: string | null;
  ratingsShown: string | null;
  customRatingLabel?: string | null;
  customRatingValue?: string | null;
  /** critics' ratings you ticked ("TOI 3.5/5", "Critics 3.4/5 (6)") */
  criticChips?: string[];
  imdbId?: string | null;
  tagline?: string | null;
  omdbPlot?: string | null;
  awards?: string | null;
  wikiTitle?: string | null;
  wikiUrl?: string | null;
  wikiSentence?: string | null;
  imdbRating?: number | null;
  imdbVotes?: number | null;
  rtCritics?: number | null;
  metascore?: number | null;
  tmdbRating?: number | null;
  tmdbVotes?: number | null;
  /** JSON: other free sources {tvmaze, anilist, mal, letterboxd, trakt, rtAudience, rt/metacritic via Wikidata …} */
  extRatings?: string | null;
  /** JSON: pages to check a rating yourself {imdb, rt, metacritic, letterboxd, mal, anilist, tvmaze, mydramalist, wikipedia} */
  links?: string | null;
  wikidataId?: string | null;
  webCheckedAt?: string | null;
  webNote?: string | null;
}
export interface ExtRating { label: string; value: string; votes?: number | null; url?: string | null; via: string }
const parseJson = <T,>(s?: string | null): T | null => {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};
export const extRatingsOf = (extra?: TitleExtra | null, worldJson?: string | null) =>
  ({ ...(parseJson<Record<string, ExtRating>>(worldJson) || {}), ...(parseJson<Record<string, ExtRating>>(extra?.extRatings) || {}) });
export const linksOf = (extra?: TitleExtra | null) => parseJson<Record<string, string>>(extra?.links) || {};
export const LINK_LABELS: Record<string, string> = {
  imdb: 'IMDb', rt: 'Rotten Tomatoes', metacritic: 'Metacritic', letterboxd: 'Letterboxd', mal: 'MyAnimeList', anilist: 'AniList', tvmaze: 'TVmaze', mydramalist: 'MyDramaList', wikipedia: 'Wikipedia',
};
export type ExtrasMap = Record<string, TitleExtra>;

export type RatingKey = 'imdb' | 'rt' | 'metacritic' | 'tmdb' | 'my' | 'custom' | 'letterboxd' | 'rtAudience' | 'trakt' | 'mal' | 'anilist' | 'tvmaze' | 'rogerebert' | 'critics';
export const RATING_OPTIONS: Array<{ key: RatingKey; label: string }> = [
  { key: 'imdb', label: 'IMDb' },
  { key: 'rt', label: 'Rotten Tomatoes' },
  { key: 'metacritic', label: 'Metacritic' },
  { key: 'tmdb', label: 'TMDB' },
  { key: 'letterboxd', label: 'Letterboxd' },
  { key: 'rtAudience', label: 'RT Audience' },
  { key: 'trakt', label: 'Trakt' },
  { key: 'mal', label: 'MyAnimeList' },
  { key: 'anilist', label: 'AniList' },
  { key: 'tvmaze', label: 'TVmaze' },
  { key: 'rogerebert', label: 'Roger Ebert' },
  { key: 'critics', label: 'Critics (you picked)' },
  { key: 'my', label: 'My rating' },
  { key: 'custom', label: 'Other (you looked it up)' },
];

export interface CriticReview {
  id: string;
  outlet: string;
  critic: string | null;
  rating: { value: number; best: number } | null;
  of5: number | null;
  oneLiner: string | null;
  headline: string | null;
  url: string | null;
  date: string | null;
  via: 'article' | 'headline' | 'wikipedia';
}
export interface CriticsResult {
  fetchedAt: string;
  reviews: CriticReview[];
  buzz: Array<{ headline: string; outlet: string; url: string | null; date: string | null }>;
  picks: string[];
  showAverage: boolean;
  average: number | null;
  ratedCount: number;
  phrases: Array<{ text: string; count: number }>;
  /** what reviewers commonly say (no names) — "Gripping thriller", "Stellar performances" */
  highlights?: Array<{ text: string; count: number }>;
}
const SHORT_OUTLET: Record<string, string> = {
  'the times of india': 'TOI', 'times of india': 'TOI', 'the indian express': 'Indian Express', 'indian express': 'Indian Express', 'the hindu': 'The Hindu', thehindu: 'The Hindu',
  'hindustan times': 'HT', 'india today': 'India Today', 'the new indian express': 'TNIE', 'cinema express': 'Cinema Express', cinemaexpress: 'Cinema Express',
  'film companion': 'Film Companion', 'deccan chronicle': 'Deccan Chronicle', 'india tv news': 'India TV', 'the hollywood reporter': 'THR', 'the guardian': 'The Guardian',
};
export const shortOutlet = (o: string) => SHORT_OUTLET[o.toLowerCase().trim()] || o.replace(/^the\s+/i, '').slice(0, 24);

export const ONE_LINER_SOURCE_LABEL: Record<string, string> = {
  manual: 'Your words', tagline: 'Official tagline (TMDB)', plot: 'IMDb plot (OMDb)', awards: 'Awards (OMDb)', wikipedia: 'Wikipedia', ai: 'AI', critic: 'A critic’s verdict',
};

const fmtVotes = (n?: number | null) => (!n ? '' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

/** Every rating we know for a title (extras first, then the World database's own columns, then your rating). */
export function knownRatings(item: PostItem, extra?: TitleExtra | null, myRating?: number | null) {
  const w = item.world;
  const imdb = extra?.imdbRating ?? w?.imdbRating ?? null;
  const imdbVotes = extra?.imdbVotes ?? w?.imdbVotes ?? null;
  const rt = extra?.rtCritics ?? w?.rtCritics ?? null;
  const ext = extRatingsOf(extra, w?.extRatings);
  const tmdb = extra?.tmdbRating ?? w?.tmdbRating ?? null;
  const my = myRating !== undefined ? myRating : item.myRating;
  const out: Partial<Record<RatingKey, { chip: string; detail: string }>> = {};
  if (imdb != null) out.imdb = { chip: `IMDb ${imdb.toFixed(1)}`, detail: `${imdb.toFixed(1)}/10${imdbVotes ? ` · ${fmtVotes(imdbVotes)} votes` : ''}` };
  if (rt != null) out.rt = { chip: `RT ${rt}%`, detail: `${rt}% critics` };
  else if (ext.rt) out.rt = { chip: `RT ${ext.rt.value}`, detail: `${ext.rt.value} critics · via ${ext.rt.via}` };
  const meta = extra?.metascore ?? w?.metascore ?? null;
  if (meta != null) out.metacritic = { chip: `Metacritic ${meta}`, detail: `${meta}/100` };
  else if (ext.metacritic) out.metacritic = { chip: `Metacritic ${ext.metacritic.value.replace('/100', '')}`, detail: `${ext.metacritic.value} · via ${ext.metacritic.via}` };
  const SHORT: Partial<Record<RatingKey, string>> = { letterboxd: 'Letterboxd', rtAudience: 'RT Audience', trakt: 'Trakt', mal: 'MAL', anilist: 'AniList', tvmaze: 'TVmaze', rogerebert: 'Ebert' };
  for (const [k, short] of Object.entries(SHORT) as Array<[RatingKey, string]>) {
    const e = ext[k];
    if (e) out[k] = { chip: `${short} ${e.value}`, detail: `${e.value}${e.votes ? ` · ${fmtVotes(e.votes)} ${k === 'anilist' ? 'members' : 'votes'}` : ''} · via ${e.via}` };
  }
  if (tmdb != null) out.tmdb = { chip: `TMDB ${tmdb.toFixed(1)}`, detail: `${tmdb.toFixed(1)}/10${(extra?.tmdbVotes ?? w?.tmdbVotes) ? ` · ${fmtVotes(extra?.tmdbVotes ?? w?.tmdbVotes)} votes` : ''}` };
  if (my != null) out.my = { chip: `My ★ ${my}/5`, detail: `${my}/5` };
  if (extra?.criticChips?.length) out.critics = { chip: extra.criticChips.join(' • '), detail: extra.criticChips.join(' • ') };
  if (extra?.customRatingLabel && extra?.customRatingValue) out.custom = { chip: `${extra.customRatingLabel} ${extra.customRatingValue}`, detail: `${extra.customRatingLabel} ${extra.customRatingValue}` };
  return out;
}

/** Which ratings to show: your choice, else IMDb (or TMDB) for World titles, none for OTT/Cinema until you pick. */
export function shownKeys(item: PostItem, extra?: TitleExtra | null): RatingKey[] {
  if (extra?.ratingsShown) {
    try {
      return JSON.parse(extra.ratingsShown);
    } catch {}
  }
  if (!item.world) return [];
  const k = knownRatings(item, extra);
  return k.imdb && item.world.scoreSource === 'IMDb' ? ['imdb'] : k.tmdb ? ['tmdb'] : [];
}

/** The rating chips to draw on the post, in your chosen order. */
export function ratingChips(item: PostItem, extra?: TitleExtra | null, myRating?: number | null): string[] {
  const k = knownRatings(item, extra, myRating);
  // each critic you ticked is its own chip ("TOI 3.5/5", "The Hindu 4/5")
  return shownKeys(item, extra).flatMap(key => (key === 'critics' ? extra?.criticChips || [] : [k[key]?.chip])).filter(Boolean) as string[];
}

/** Your chosen one-liners become the per-title lines in list captions (your own note on a post still wins). */
export function withOneLiners(ai: AiCaptionCopy | null, extras: ExtrasMap): AiCaptionCopy | null {
  const lines = Object.fromEntries(Object.entries(extras).filter(([, e]) => e?.oneLiner).map(([id, e]) => [id, e.oneLiner as string]));
  if (!Object.keys(lines).length) return ai;
  return { hook: '', blurb: '', closing: '', model: '', dropped: 0, ...ai, teasers: { ...(ai?.teasers || {}), ...lines } };
}

/** Single-post caption: add the one-liner (as a quote) and the chosen ratings under the title line. */
export function captionWithExtras(caption: string, oneLiner: string | null | undefined, chips: string[]) {
  const lines = caption.split('\n');
  const at = lines.findIndex(l => l.startsWith('🎬'));
  if (at < 0) return caption;
  const extra: string[] = [];
  if (chips.length) {
    // replace a template rating line right under the title (World posts) with your chosen ratings
    if (lines[at + 1]?.startsWith('⭐ ')) lines.splice(at + 1, 1);
    extra.push(`⭐ ${chips.join(' • ')}`);
  }
  if (oneLiner) extra.push(`💬 “${oneLiner}”`);
  lines.splice(at + 1, 0, ...extra);
  return lines.join('\n');
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string })?.message || `Request failed (${res.status})`);
  return body as T;
}
const post = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const extrasApi = {
  get: (domain: string, id: string) => apiFetch(`/extras/${domain}/${id}`).then(r => json<TitleExtra>(r)),
  batch: (domain: string, ids: string[]) => apiFetch(`/extras/${domain}/batch`, post({ ids })).then(r => json<ExtrasMap>(r)),
  /** Critics' ratings & one-liners from the web (on your click; cached a few days). */
  critics: (domain: string, id: string, force = false) => apiFetch(`/extras/${domain}/${id}/critics${force ? '?force=true' : ''}`, { method: 'POST' }, 0).then(r => json<CriticsResult>(r)),
  update: (domain: string, id: string, body: Partial<Omit<TitleExtra, 'ratingsShown'>> & { ratingsShown?: RatingKey[] | null; criticPicks?: string[]; criticAverage?: boolean }) =>
    apiFetch(`/extras/${domain}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => json<TitleExtra>(r)),
  lookup: (domain: string, id: string, force = false) => apiFetch(`/extras/${domain}/${id}/lookup${force ? '?force=true' : ''}`, { method: 'POST' }, 0).then(r => json<TitleExtra>(r)),
  ai: (domain: string, id: string, body: { language: string; tone: string }) => apiFetch(`/extras/${domain}/${id}/ai-oneliners`, post(body), 0).then(r => json<{ options: string[]; model: string }>(r)),
};
