import { apiFetch } from './api';
import { AiCaptionCopy, LANGUAGES, starString, splitTags } from './ott';

export type WorldKind = 'movie' | 'tv';
export type WorldStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface WorldTitle {
  id: string;
  kind: WorldKind;
  tmdbId: number;
  imdbId: string | null;
  title: string;
  originalTitle: string | null;
  year: number | null;
  releaseDate: string | null;
  language: string | null;
  countries: string | null;
  genres: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  runtime: number | null;
  seasons: number | null;
  episodes: number | null;
  seriesType: string | null;
  people: string | null;
  tmdbRating: number | null;
  tmdbVotes: number | null;
  popularity: number | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  rtCritics: number | null;
  metascore?: number | null;
  /** JSON: other free sources {tvmaze, anilist, mal, letterboxd, …: {label, value, votes, url, via}} */
  extRatings?: string | null;
  rank?: number | null;
  tvStatus?: string | null;
  score: number | null;
  scoreSource: 'IMDb' | 'TMDB' | null;
  scoreVotes: number | null;
  providersIn: string | null;
  tmdbCheckedAt: string | null;
  omdbCheckedAt: string | null;
  status: WorldStatus;
  origin: string;
  myRating: number | null;
  myReview: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorldFilter {
  kind?: WorldKind;
  status?: string;
  q?: string;
  language?: string;
  country?: string;
  genre?: string;
  excludeGenre?: string;
  yearFrom?: string;
  yearTo?: string;
  minRating?: string;
  minVotes?: string;
  maxVotes?: string;
  minRuntime?: string;
  maxRuntime?: string;
  maxSeasons?: string;
  provider?: string;
  scriptedOnly?: string;
  /** movies: feature films only (default on) */
  featureOnly?: string;
  /** movies: hide documentaries (default on) */
  noDocs?: string;
  /** only titles free (with ads) to stream in India */
  freeIn?: string;
  sort?: string;
}

export interface Facet { value: string; n: number }
export interface WorldFacets { total: number; approved: number; languages: Facet[]; countries: Facet[]; genres: Facet[]; providers: Facet[]; enrich?: { at?: string; tmdb: number; omdb: number } }
export interface ScanStatus { active: boolean; kind?: string; page: number; pages: number; seen: number; added: number; error?: string; finishedAt?: string; mode?: string; lang?: string; langDone?: number; langTotal?: number }
export interface WorldLanguage { code: string; name: string; native: string | null; movie: number; tv: number }
export interface WorldHealth {
  total: number; movies: number; series: number; approved: number;
  languagesWithTitles: number; languagesKnown: number;
  neverChecked: number; checkedNoImdbId: number; noImdbRating: number; noOverview: number; noPoster: number; noLanguage: number; noGenres: number; garbled: number;
  rtKnown: number; providersKnown: number; notFeature: number; typed: number;
  duplicateImdbIds: Array<{ imdbId: string; n: number }>;
  imdbFile: { rows: number; date: string | null; sync: { running: boolean; rows?: number; updatedTitles?: number; typedTitles?: number; typesDate?: string; error?: string; finishedAt?: string } };
  omdbBudgetLeft: number;
  enrich: { at?: string; tmdb: number; omdb: number; note?: string; running: boolean };
  scan: ScanStatus;
  sources: { tmdb: boolean; omdb: boolean; imdbDatasets: boolean; mdblist: boolean };
}
export interface Provider { name: string; type: 'stream' | 'free' | 'rent' | 'buy' }
export type TmdbHit = Partial<WorldTitle> & { kind: WorldKind; tmdbId: number; title: string; inLibrary: string | null };

// ───────────────────────── display helpers ─────────────────────────

export const providersOf = (t: Pick<WorldTitle, 'providersIn'>): Provider[] => {
  try {
    return t.providersIn ? JSON.parse(t.providersIn) : [];
  } catch {
    return [];
  }
};
/** Major Indian streaming apps come before bundles / telco apps (e.g. "VI movies and tv"). */
const MAJOR = ['Netflix', 'Prime Video', 'JioHotstar', 'SonyLIV', 'ZEE5', 'Aha', 'Sun NXT', 'ManoramaMAX', 'ETV Win', 'Apple TV+', 'Lionsgate Play', 'Amazon MX Player', 'Hoichoi', 'Chaupal', 'Simply South', 'YouTube'];
const rank = (n: string) => (MAJOR.includes(n) ? MAJOR.indexOf(n) : 100);
/** Subscription / free streaming in India (what "where to watch" means on posts), major apps first. */
export const streamingIn = (t: Pick<WorldTitle, 'providersIn'>) =>
  providersOf(t).filter(p => p.type === 'stream' || p.type === 'free').map(p => p.name).sort((a, b) => rank(a) - rank(b));

const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
const languageNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'language' }) : null;
export const countryName = (code?: string | null) => {
  if (!code) return '';
  try {
    return regionNames?.of(code) || code;
  } catch {
    return code;
  }
};
/** TMDB's own language names (set from /world/languages) — TMDB uses "cn" for Cantonese, which no ISO table knows. */
const tmdbLangNames: Record<string, string> = { cn: 'Cantonese', xx: 'No language' };
export const registerLanguageNames = (list: Array<{ code: string; name: string }>) => {
  for (const l of list) if (l.name && l.name !== l.code) tmdbLangNames[l.code] = l.name;
};
export const langName = (code?: string | null) => {
  if (!code) return '';
  const own = LANGUAGES.find(l => l.code === code)?.label || tmdbLangNames[code];
  if (own) return own;
  try {
    return languageNames?.of(code) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
};

export const fmtVotes = (n?: number | null) => (!n ? '' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
/** "IMDb 8.4" / "TMDB 7.9" — always with the source. */
export const scoreLabel = (t: Pick<WorldTitle, 'score' | 'scoreSource'>) => (t.score != null && t.scoreSource ? `${t.scoreSource} ${t.score.toFixed(1)}` : '');
export const lengthLabel = (t: Pick<WorldTitle, 'kind' | 'runtime' | 'seasons'>) =>
  t.kind === 'tv'
    ? t.seasons ? `${t.seasons} season${t.seasons > 1 ? 's' : ''}` : 'Series'
    : t.runtime ? `${Math.floor(t.runtime / 60)}h ${String(t.runtime % 60).padStart(2, '0')}m` : '';
export const genreList = (t: Pick<WorldTitle, 'genres'>, n = 2) => (t.genres || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, n);
/** "Korean • Thriller, Drama • 2h 13m" */
export const metaLine = (t: WorldTitle) => [langName(t.language), genreList(t).join(', '), lengthLabel(t)].filter(Boolean).join(' • ');

// ───────────────────────── captions (facts from data; AI optional) ─────────────────────────

export const WORLD_CTAS = [
  { id: 'watched', label: '👀 Watched any?', single: 'Have you watched it? Tell us below 👇', list: 'How many have you watched? Comment below 👇', outro: 'How many have you watched?' },
  { id: 'save', label: '📌 Save for later', single: 'Save this for your watchlist 📌', list: 'Save this post for your watchlist 📌', outro: 'Save it for your watchlist!' },
  { id: 'tag', label: '🏷 Tag a friend', single: 'Tag a friend who needs to watch this 🏷', list: 'Tag a friend who needs these 🏷', outro: 'Tag your movie buddy!' },
  { id: 'add', label: '➕ What would you add?', single: 'Seen something like it? Recommend below 👇', list: 'What would you add to this list? 👇', outro: 'What would you add?' },
  { id: 'none', label: 'No call to action', single: '', list: '', outro: 'Thanks for watching!' },
] as const;
export const worldCtaOf = (id: string) => WORLD_CTAS.find(c => c.id === id) || WORLD_CTAS[0];

/** Language hashtags: [movies, series]. */
const LANG_TAG: Record<string, [string, string]> = {
  ko: ['KoreanMovies', 'KDrama'], ja: ['JapaneseMovies', 'JDrama'], zh: ['ChineseMovies', 'CDrama'], es: ['SpanishMovies', 'SpanishSeries'],
  fr: ['FrenchCinema', 'FrenchSeries'], ta: ['TamilMovies', 'TamilWebSeries'], te: ['TeluguMovies', 'TeluguWebSeries'], ml: ['MalayalamMovies', 'MalayalamWebSeries'],
  hi: ['Bollywood', 'HindiWebSeries'], kn: ['KannadaMovies', 'KannadaWebSeries'], en: ['Hollywood', 'TVSeries'], tr: ['TurkishMovies', 'TurkishDrama'],
  th: ['ThaiMovies', 'ThaiDrama'], it: ['ItalianCinema', 'ItalianSeries'], de: ['GermanMovies', 'GermanSeries'],
};
const tag = (s: string) => '#' + s.replace(/[^A-Za-z0-9]/g, '');

function worldTags(items: WorldTitle[], extra: string[]) {
  const tags = new Set<string>(extra);
  for (const t of items) {
    if (t.language && LANG_TAG[t.language]) tags.add(`#${LANG_TAG[t.language][t.kind === 'tv' ? 1 : 0]}`);
    for (const g of genreList(t, 1)) tags.add(tag(`${g}${t.kind === 'tv' ? 'Series' : 'Movies'}`));
  }
  return Array.from(tags).slice(0, 25).join(' ');
}

const tidy = (lines: Array<string | null>) =>
  lines
    .filter((l): l is string => l !== null)
    .filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n')
    .trim();

/** "⭐ IMDb 8.5/10 (1.0M votes) • Rotten Tomatoes 99%" */
export function ratingsLine(t: WorldTitle) {
  const bits: string[] = [];
  if (t.scoreSource === 'IMDb' && t.imdbRating != null) bits.push(`IMDb ${t.imdbRating.toFixed(1)}/10${t.imdbVotes ? ` (${fmtVotes(t.imdbVotes)} votes)` : ''}`);
  else if (t.tmdbRating != null) bits.push(`TMDB ${t.tmdbRating.toFixed(1)}/10${t.tmdbVotes ? ` (${fmtVotes(t.tmdbVotes)} votes)` : ''}`);
  if (t.rtCritics != null) bits.push(`Rotten Tomatoes ${t.rtCritics}%`);
  return bits.length ? `⭐ ${bits.join(' • ')}` : null;
}

export function worldSingleCaption(t: WorldTitle, o: { rating: number | null; review: string; handle: string; extraTags: string; cta: string; ai?: AiCaptionCopy | null }) {
  const where = streamingIn(t);
  const cta = worldCtaOf(o.cta);
  return tidy([
    ...(o.ai?.hook ? [o.ai.hook, ''] : []),
    `🎬 ${t.title}${t.year ? ` (${t.year})` : ''}`,
    ratingsLine(t),
    where.length ? `📺 Watch in India: ${where.join(', ')}` : null,
    `🗣 ${metaLine(t)}`,
    t.people ? `🎥 ${t.kind === 'tv' ? 'Created by' : 'Director'}: ${t.people}` : null,
    '',
    o.rating != null ? `My rating: ${starString(o.rating)} (${o.rating}/5)` : null,
    o.review.trim() || null,
    o.ai?.blurb ? '' : null,
    o.ai?.blurb || null,
    '',
    o.ai?.closing || null,
    cta.single || null,
    o.handle ? `Follow ${o.handle} for more movie & series suggestions` : null,
    '',
    worldTags([t], [t.kind === 'tv' ? '#SeriesRecommendation' : '#MovieRecommendation', '#WhatToWatch', ...splitTags(o.extraTags)]),
  ]);
}

export function worldListCaption(items: WorldTitle[], o: { heading: string; notes: Record<string, string>; numbered: boolean; handle: string; extraTags: string; cta: string; ai?: AiCaptionCopy | null }) {
  const cta = worldCtaOf(o.cta);
  const lines = items.map((t, i) => {
    const where = streamingIn(t)[0];
    const facts = [scoreLabel(t) ? `⭐ ${scoreLabel(t)}` : '', where].filter(Boolean).join(' • ');
    const note = o.notes[t.id]?.trim() || o.ai?.teasers[t.id];
    return `${o.numbered ? `${i + 1}.` : '🎬'} ${t.title}${t.year ? ` (${t.year})` : ''}${facts ? ` — ${facts}` : ''}${note ? `\n   ${note}` : ''}`;
  });
  const kinds = new Set(items.map(t => t.kind));
  return tidy([
    ...(o.ai?.hook ? [o.ai.hook, ''] : []),
    `⭐ ${o.heading}`,
    '',
    ...lines,
    '',
    o.ai?.closing || null,
    cta.list || null,
    o.handle ? `\nFollow ${o.handle} for more movie & series suggestions` : null,
    '',
    worldTags(items, [kinds.has('tv') && !kinds.has('movie') ? '#SeriesRecommendation' : '#MovieRecommendation', '#WhatToWatch', '#MustWatch', ...splitTags(o.extraTags)]),
  ]);
}

/** A suggested heading from the filters, e.g. "Top 10 Korean Thriller Movies". */
export function suggestHeading(f: WorldFilter, n: number) {
  const lang = f.language && !f.language.includes(',') ? langName(f.language) : f.country ? countryName(f.country) : '';
  const what = f.kind === 'tv' ? 'Series' : f.kind === 'movie' ? 'Movies' : 'Movies & Series';
  const years = f.yearFrom && f.yearTo ? (f.yearFrom === f.yearTo ? ` of ${f.yearFrom}` : ` (${f.yearFrom}–${f.yearTo})`) : f.yearFrom ? ` since ${f.yearFrom}` : '';
  const where = f.provider ? ` on ${f.provider}` : '';
  return `Top ${n} ${[lang, f.genre].filter(Boolean).join(' ')} ${what}${where}${years}`.replace(/\s+/g, ' ').trim();
}

// ───────────────────────── API ─────────────────────────

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string })?.message || `Request failed (${res.status})`);
  return body as T;
}
const qs = (o: object) => {
  const q = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => [k, String(v)])).toString();
  return q ? `?${q}` : '';
};
const post = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const worldApi = {
  list: (f: WorldFilter & { skip?: number; take?: number }) => apiFetch(`/world/titles${qs(f)}`).then(r => json<{ total: number; items: WorldTitle[] }>(r)),
  facets: (kind?: WorldKind) => apiFetch(`/world/facets${qs({ kind })}`).then(r => json<WorldFacets>(r)),
  get: (id: string) => apiFetch(`/world/titles/${id}`).then(r => json<WorldTitle>(r)),
  refresh: (id: string, force = false) => apiFetch(`/world/titles/${id}/refresh${force ? '?force=true' : ''}`, { method: 'POST' }, 0).then(r => json<WorldTitle>(r)),
  update: (id: string, body: Partial<WorldTitle>) =>
    apiFetch(`/world/titles/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => json<WorldTitle>(r)),
  bulkStatus: (body: { ids?: string[]; filter?: WorldFilter; status: WorldStatus }) => apiFetch('/world/titles/bulk-status', post(body), 0).then(r => json<{ updated: number }>(r)),
  search: (q: string, kind?: WorldKind) => apiFetch(`/world/tmdb-search${qs({ q, kind })}`).then(r => json<TmdbHit[]>(r)),
  add: (kind: WorldKind, tmdbId: number) => apiFetch('/world/titles', post({ kind, tmdbId }), 0).then(r => json<WorldTitle>(r)),
  counts: (filters: WorldFilter[]) => apiFetch('/world/counts', post({ filters })).then(r => json<number[]>(r)),
  genres: (kind: WorldKind) => apiFetch(`/world/genres${qs({ kind })}`).then(r => json<Record<string, string>>(r)),
  scan: (body: { kind: WorldKind; language?: string; country?: string; genreId?: number; yearFrom?: number; yearTo?: number; minVotes?: number; sort?: string; pages?: number }) =>
    apiFetch('/world/scan', post(body), 0).then(r => json<{ started: boolean; scan: ScanStatus }>(r)),
  scanStatus: () => apiFetch('/world/scan/status').then(r => json<ScanStatus>(r)),
  scanLanguages: (body: { kinds?: WorldKind[]; perLanguage?: number; minVotes?: number; languages?: string[] } = {}) =>
    apiFetch('/world/scan/languages', post(body), 0).then(r => json<{ started: boolean; scan: ScanStatus }>(r)),
  languages: () => apiFetch('/world/languages').then(r => json<WorldLanguage[]>(r)),
  health: () => apiFetch('/world/health', undefined, 0).then(r => json<WorldHealth>(r)),
  imdbSync: () => apiFetch('/world/imdb-sync', { method: 'POST' }, 0).then(r => json<{ started: boolean }>(r)),
};
