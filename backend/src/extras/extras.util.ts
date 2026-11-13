/** Pure helpers for title extras (one-liners & ratings from real sources). */

export const RATING_KEYS = ['my', 'imdb', 'rt', 'metacritic', 'tmdb', 'custom', 'letterboxd', 'rtAudience', 'trakt', 'mal', 'anilist', 'tvmaze', 'rogerebert', 'critics'] as const;
export type RatingKey = (typeof RATING_KEYS)[number];

export interface OmdbFull {
  imdbRating: number | null;
  imdbVotes: number | null;
  rtCritics: number | null;
  metascore: number | null;
  plot: string | null;
  awards: string | null;
}

const na = (v: unknown) => (typeof v === 'string' && v.trim() && v.trim() !== 'N/A' ? v.trim() : null);

/** OMDb (plot=short) → ratings + one-line plot + awards. "N/A" is unknown, never zero. */
export function parseOmdbFull(body: any): OmdbFull | null {
  if (!body || body.Response !== 'True') return null;
  const rating = Number.parseFloat(body.imdbRating);
  const votes = Number.parseInt(String(body.imdbVotes || '').replace(/,/g, ''), 10);
  const rt = (body.Ratings || []).find((r: any) => r.Source === 'Rotten Tomatoes')?.Value;
  const rtNum = rt ? Number.parseInt(String(rt), 10) : NaN;
  const meta = Number.parseInt(String(body.Metascore), 10);
  return {
    imdbRating: Number.isFinite(rating) ? rating : null,
    imdbVotes: Number.isFinite(votes) ? votes : null,
    rtCritics: Number.isFinite(rtNum) ? rtNum : null,
    metascore: Number.isFinite(meta) ? meta : null,
    plot: na(body.Plot),
    awards: na(body.Awards),
  };
}

/**
 * First sentence of a Wikipedia summary, without the pronunciation/brackets clutter.
 * "Parasite (Korean: 기생충) is a 2019 South Korean black comedy thriller film…" → "Parasite is a 2019 South Korean black comedy thriller film…"
 */
export function firstSentence(extract: string | null | undefined, max = 220): string | null {
  if (!extract) return null;
  let t = extract.replace(/\s*\([^()]*\)/g, '').replace(/\s+/g, ' ').trim();
  const m = t.match(/^(.+?[.!?])(\s+[A-Z“"]|$)/);
  t = (m ? m[1] : t).trim();
  if (t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return t || null;
}

export function cleanOneLiner(s: unknown, max = 140): string | null {
  if (typeof s !== 'string') return null;
  const t = s.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
}

export function parseRatingsShown(v: unknown): RatingKey[] | null {
  if (v === null) return null;
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch { return []; } })() : [];
  return [...new Set((arr as unknown[]).filter((k): k is RatingKey => RATING_KEYS.includes(k as RatingKey)))];
}
