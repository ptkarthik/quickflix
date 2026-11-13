import { apiFetch } from './api';
import { Trust, addDays, fmtDate, languageLabel } from './ott';

export type CinemaStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CinemaEvidence {
  id: string;
  sourceType: 'TMDB_THEATRICAL' | 'WIKIPEDIA' | 'OFFICIAL_YOUTUBE' | 'NEWS' | 'MANUAL';
  sourceKey: string;
  sourceName: string | null;
  sourceUrl: string | null;
  claimedDate: string | null;
  postponed: boolean;
  text: string | null;
  observedAt: string;
}

export interface CinemaRelease {
  id: string;
  title: string;
  language: string | null;
  alsoIn: string | null;
  releaseDate: string | null;
  status: CinemaStatus;
  trust: Trust;
  trustReason: string | null;
  userLocked: boolean;
  previousDate: string | null;
  dateChangedAt: string | null;
  dateHistory: string | null;
  tmdbId: number | null;
  posterPath: string | null;
  overview: string | null;
  genres: string | null;
  certificate: string | null;
  runtime: number | null;
  production: string | null;
  ottDate: string | null;
  origin: string;
  notes: string | null;
  myRating: number | null;
  myReview: string | null;
  createdAt: string;
  updatedAt: string;
  evidence?: CinemaEvidence[];
}

export const CINEMA_EVIDENCE_LABEL: Record<CinemaEvidence['sourceType'], string> = {
  OFFICIAL_YOUTUBE: 'Official channel',
  TMDB_THEATRICAL: 'TMDB (India theatrical)',
  WIKIPEDIA: 'Wikipedia film list',
  NEWS: 'News',
  MANUAL: 'You',
};

/** "Now in cinemas" = released in the last 5 weeks and not yet streaming. */
export const NOW_IN_CINEMAS_DAYS = 35;

export type CinemaBucket = 'upcoming' | 'now' | 'older' | 'tba' | 'ott';
export function cinemaBucket(r: Pick<CinemaRelease, 'releaseDate' | 'ottDate'>, today: string): CinemaBucket {
  if (!r.releaseDate) return 'tba';
  if (r.releaseDate > today) return 'upcoming';
  if (r.ottDate && r.ottDate <= today) return 'ott';
  return r.releaseDate >= addDays(today, -NOW_IN_CINEMAS_DAYS) ? 'now' : 'older';
}

/** Calendar days between two YYYY-MM-DD dates (no timezone drift). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

/** "Today", "Tomorrow", "in 8 days", "3 days ago". */
export function relativeDay(date: string, today: string): string {
  const d = daysBetween(today, date);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}

export const cinemaLanguages = (r: Pick<CinemaRelease, 'language' | 'alsoIn'>) =>
  [r.language, ...(r.alsoIn || '').split(',')].filter(Boolean).map(l => languageLabel(l as string)).filter((v, i, a) => v && a.indexOf(v) === i);

export function dateHistory(r: Pick<CinemaRelease, 'dateHistory'>): Array<{ date: string; at: string; by: string }> {
  try {
    return r.dateHistory ? JSON.parse(r.dateHistory) : [];
  } catch {
    return [];
  }
}

export const fmtCinemaDate = (d?: string | null) => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string })?.message || `Request failed (${res.status})`);
  return body as T;
}

export interface CinemaCollectSummary {
  created: number;
  merged: number;
  evidenceAdded: number;
  tmdb: number;
  wikipedia: number;
  youtube: number;
  youtubeMatched: number;
  news: number;
  newsMatched: number;
  dateChanges: number;
  movedBackToReview: number;
  trust: Partial<Record<Trust, number>>;
  errors: string[];
}

export const cinemaApi = {
  list: (params: Record<string, string | undefined> = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return apiFetch(`/cinema/releases${q ? `?${q}` : ''}`).then(r => json<CinemaRelease[]>(r));
  },
  create: (body: Partial<CinemaRelease> & { sourceUrl?: string }) =>
    apiFetch('/cinema/releases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => json<CinemaRelease>(r)),
  update: (id: string, body: Partial<CinemaRelease>) =>
    apiFetch(`/cinema/releases/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => json<CinemaRelease>(r)),
  remove: (id: string) => apiFetch(`/cinema/releases/${id}`, { method: 'DELETE' }).then(r => json<{ deleted: boolean }>(r)),
  bulkStatus: (ids: string[], status: CinemaStatus) =>
    apiFetch('/cinema/releases/bulk-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, status }) }).then(r => json<{ updated: number }>(r)),
  approveConfirmed: () => apiFetch('/cinema/releases/approve-confirmed', { method: 'POST' }).then(r => json<{ approved: number }>(r)),
  collect: () => apiFetch('/cinema/collect', { method: 'POST' }, 0).then(r => json<CinemaCollectSummary>(r)),
};
