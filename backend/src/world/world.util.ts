/**
 * Pure helpers for the World Movies & Series database (TMDB + OMDb mapping, rating choice).
 * Rewritten from global-movie-intelligence with its accuracy bugs removed:
 *  - TMDB's rating is never stored or shown as "IMDb";
 *  - no invented "regional" scores;
 *  - no AI-written verdicts / praise / criticism.
 */

export type WorldKind = 'movie' | 'tv';

export interface WorldFacts {
  imdbId?: string | null;
  title: string;
  originalTitle?: string | null;
  year?: number | null;
  releaseDate?: string | null;
  language?: string | null;
  countries?: string | null;
  genres?: string | null;
  overview?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  runtime?: number | null;
  seasons?: number | null;
  episodes?: number | null;
  seriesType?: string | null;
  tvStatus?: string | null;
  people?: string | null;
  tmdbRating?: number | null;
  tmdbVotes?: number | null;
  popularity?: number | null;
  providersIn?: string | null;
}

/** TMDB / JustWatch provider names → the names used across this app. */
const PROVIDER_ALIASES: Array<[RegExp, string]> = [
  [/^netflix/i, 'Netflix'],
  [/^amazon prime video|^prime video/i, 'Prime Video'],
  [/hotstar|^jio ?cinema|^jiohotstar/i, 'JioHotstar'],
  [/^sony ?liv/i, 'SonyLIV'],
  [/^zee ?5/i, 'ZEE5'],
  [/^aha\b/i, 'Aha'],
  [/^sun ?nxt/i, 'Sun NXT'],
  [/^manorama ?max/i, 'ManoramaMAX'],
  [/^etv ?win/i, 'ETV Win'],
  [/^apple tv/i, 'Apple TV+'],
  [/^lionsgate ?play/i, 'Lionsgate Play'],
  [/^(amazon )?mx ?player/i, 'Amazon MX Player'],
  [/^hoichoi/i, 'Hoichoi'],
  [/^chaupal/i, 'Chaupal'],
  [/^simply south/i, 'Simply South'],
  [/^youtube/i, 'YouTube'],
];
export const normalizeProvider = (name: string) => PROVIDER_ALIASES.find(([re]) => re.test(name.trim()))?.[1] || name.trim();

export interface Provider {
  name: string;
  /** stream = subscription, free = free/with ads, rent, buy */
  type: 'stream' | 'free' | 'rent' | 'buy';
}

/** "Where to watch in India" from TMDB's watch/providers (JustWatch data). Streaming first, de-duplicated. */
export function indiaProviders(wp: any): Provider[] {
  const inr = wp?.results?.IN;
  if (!inr) return [];
  const out: Provider[] = [];
  const add = (list: any[] | undefined, type: Provider['type']) => {
    for (const p of list || []) {
      const name = normalizeProvider(String(p?.provider_name || ''));
      if (name && !out.some(o => o.name === name)) out.push({ name, type });
    }
  };
  add(inr.flatrate, 'stream');
  add(inr.free, 'free');
  add(inr.ads, 'free');
  add(inr.rent, 'rent');
  add(inr.buy, 'buy');
  return out;
}

const yearOf = (d?: string | null) => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null);
const nz = <T>(v: T | undefined | null | '' | 0): T | null => (v === undefined || v === null || v === '' || v === 0 ? null : (v as T));

/** Maps a TMDB /movie/{id} or /tv/{id} response (with external_ids, watch/providers, credits) to our facts. */
export function mapTmdbDetails(kind: WorldKind, d: any): WorldFacts {
  const date = kind === 'movie' ? d.release_date : d.first_air_date;
  const countries: string[] = (d.origin_country?.length ? d.origin_country : (d.production_countries || []).map((c: any) => c.iso_3166_1)).filter(Boolean);
  const people =
    kind === 'movie'
      ? (d.credits?.crew || []).filter((c: any) => c.job === 'Director').map((c: any) => c.name).slice(0, 2)
      : (d.created_by || []).map((c: any) => c.name).slice(0, 3);
  const providers = indiaProviders(d['watch/providers']);
  return {
    imdbId: nz(kind === 'movie' ? d.imdb_id : d.external_ids?.imdb_id),
    title: (kind === 'movie' ? d.title : d.name) || d.original_title || d.original_name,
    originalTitle: nz(kind === 'movie' ? d.original_title : d.original_name),
    year: yearOf(date),
    releaseDate: nz(date),
    language: nz(d.original_language),
    countries: countries.length ? [...new Set(countries)].join(',') : null,
    genres: (d.genres || []).map((g: any) => g.name).join(',') || null,
    overview: nz(d.overview?.trim()),
    posterPath: nz(d.poster_path),
    backdropPath: nz(d.backdrop_path),
    runtime: kind === 'movie' ? nz(d.runtime) : nz(d.episode_run_time?.[0]),
    seasons: kind === 'tv' ? nz(d.number_of_seasons) : null,
    episodes: kind === 'tv' ? nz(d.number_of_episodes) : null,
    seriesType: kind === 'tv' ? nz(d.type) : null,
    tvStatus: kind === 'tv' ? nz(d.status) : null,
    people: people.length ? people.join(', ') : null,
    tmdbRating: typeof d.vote_average === 'number' && d.vote_count > 0 ? Math.round(d.vote_average * 10) / 10 : null,
    tmdbVotes: typeof d.vote_count === 'number' ? d.vote_count : null,
    popularity: typeof d.popularity === 'number' ? d.popularity : null,
    providersIn: JSON.stringify(providers),
  };
}

/** Maps one TMDB /discover or /search result (lighter: genre ids, no providers). */
export function mapTmdbListItem(kind: WorldKind, d: any, genreNames: Record<number, string>): WorldFacts {
  const date = kind === 'movie' ? d.release_date : d.first_air_date;
  return {
    title: (kind === 'movie' ? d.title : d.name) || d.original_title || d.original_name,
    originalTitle: nz(kind === 'movie' ? d.original_title : d.original_name),
    year: yearOf(date),
    releaseDate: nz(date),
    language: nz(d.original_language),
    countries: d.origin_country?.length ? d.origin_country.join(',') : null,
    genres: (d.genre_ids || []).map((id: number) => genreNames[id]).filter(Boolean).join(',') || null,
    overview: nz(d.overview?.trim()),
    posterPath: nz(d.poster_path),
    backdropPath: nz(d.backdrop_path),
    tmdbRating: typeof d.vote_average === 'number' && d.vote_count > 0 ? Math.round(d.vote_average * 10) / 10 : null,
    tmdbVotes: typeof d.vote_count === 'number' ? d.vote_count : null,
    popularity: typeof d.popularity === 'number' ? d.popularity : null,
  };
}

export interface OmdbRatings {
  imdbRating: number | null;
  imdbVotes: number | null;
  rtCritics: number | null;
}

/** OMDb response → ratings. "N/A" means unknown, never zero. */
export function parseOmdb(body: any): OmdbRatings | null {
  if (!body || body.Response !== 'True') return null;
  const rating = Number.parseFloat(body.imdbRating);
  const votes = Number.parseInt(String(body.imdbVotes || '').replace(/,/g, ''), 10);
  const rt = (body.Ratings || []).find((r: any) => r.Source === 'Rotten Tomatoes')?.Value;
  const rtNum = rt ? Number.parseInt(String(rt), 10) : NaN;
  return {
    imdbRating: Number.isFinite(rating) ? rating : null,
    imdbVotes: Number.isFinite(votes) ? votes : null,
    rtCritics: Number.isFinite(rtNum) ? rtNum : null,
  };
}

/** Minimum IMDb votes before the IMDb number is trusted for ranking (fewer → use TMDB if it has more votes). */
export const MIN_IMDB_VOTES = 50;

/** Which rating a title is shown and ranked by — always labelled with its source. */
export function chooseScore(t: { imdbRating?: number | null; imdbVotes?: number | null; tmdbRating?: number | null; tmdbVotes?: number | null }) {
  if (t.imdbRating != null && (t.imdbVotes ?? 0) >= MIN_IMDB_VOTES) return { score: t.imdbRating, scoreSource: 'IMDb', scoreVotes: t.imdbVotes ?? null };
  if (t.tmdbRating != null) return { score: t.tmdbRating, scoreSource: 'TMDB', scoreVotes: t.tmdbVotes ?? null };
  if (t.imdbRating != null) return { score: t.imdbRating, scoreSource: 'IMDb', scoreVotes: t.imdbVotes ?? null };
  return { score: null, scoreSource: null, scoreVotes: null };
}

/** TV entries that are not series in the "watch a show" sense. */
export const NON_SCRIPTED_TV = ['Reality', 'News', 'Talk Show', 'Documentary'];

/**
 * "Best rated" order. A plain average lets a 9.9 from 5 votes beat Mirzapur, so the score is pulled toward an
 * average (6.5) until it has enough votes: IMDb needs ~500, TMDB ~50 (TMDB has far fewer voters).
 */
export function rankOf(score?: number | null, votes?: number | null, source?: string | null): number | null {
  if (score == null) return null;
  const v = Math.max(0, votes ?? 0);
  const m = source === 'IMDb' ? 500 : 50;
  const C = 6.5;
  return Math.round(((v / (v + m)) * score + (m / (v + m)) * C) * 1000) / 1000;
}

/** chooseScore + its ranking value, for writing to the database. */
export function scoreFields(t: Parameters<typeof chooseScore>[0]) {
  const s = chooseScore(t);
  return { ...s, rank: rankOf(s.score, s.scoreVotes, s.scoreSource) };
}
