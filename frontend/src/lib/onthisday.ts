import { apiFetch } from './api';

export interface Credit { tmdbId: number; kind: 'movie' | 'tv'; title: string; year: number | null; poster: string | null; backdrop: string | null; votes: number; rating: number | null; language: string | null; role: string | null }

export interface DayPerson {
  wikidataId: string;
  name: string;
  birth: string | null;
  death: string | null;
  occupations: string[];
  tmdbId: number | null;
  imdbId: string | null;
  sitelinks: number;
  wikipedia: string | null;
  scope: 'india' | 'world';
  event: 'birth' | 'death';
  profile: string | null;
  images: string[];
  knownFor: Credit[];
  industry: string | null;
  department: string | null;
  tmdbBirth: string | null;
  tmdbDeath: string | null;
  years: number | null;
  age: number | null;
  ageAtDeath: number | null;
  /** null = TMDB has no date to compare; false = TMDB and Wikidata disagree */
  sourcesAgree: boolean | null;
}

export interface DayFilm {
  id: string;
  kind: 'movie' | 'tv';
  tmdbId: number;
  imdbId: string | null;
  title: string;
  year: number | null;
  releaseDate: string | null;
  language: string | null;
  genres: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  score: number | null;
  scoreSource: string | null;
  scoreVotes: number | null;
  status: string;
  people: string | null;
  overview: string | null;
  years: number | null;
  milestone: boolean;
  indiaDate: string | null;
  indiaDiffers: boolean;
  dateConfirmed: boolean | null;
  otherDates: string[];
}

export interface DayData {
  date: string;
  ready: boolean;
  preparing: boolean;
  fetchedAt: string | null;
  errors: string[];
  birthdays: DayPerson[];
  remembering: DayPerson[];
  films: DayFilm[];
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string })?.message || `Request failed (${res.status})`);
  return body as T;
}

export const onThisDayApi = {
  get: (date: string) => apiFetch(`/onthisday?date=${date}`).then(r => json<DayData>(r)),
  refresh: (date: string) => apiFetch(`/onthisday/refresh?date=${date}`, { method: 'POST' }, 0).then(r => json<{ queued: string }>(r)),
};

export const tmdbImg = (p: string | null | undefined, size: 'w185' | 'w342' | 'w500' | 'w780' | 'h632' | 'original' = 'w500') => (p ? `https://image.tmdb.org/t/p/${size}${p}` : null);

const ord = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};
export const ordinal = ord;

export const fmtDay = (iso: string | null | undefined, withYear = true) =>
  !iso ? '' : new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) });

/** Facts you ticked as checked (this browser), so posts only go out after you've looked. */
const CHECK_KEY = 'onthisday.checked';
export function loadChecked(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CHECK_KEY) || '{}');
  } catch {
    return {};
  }
}
export function saveChecked(v: Record<string, string>) {
  try {
    localStorage.setItem(CHECK_KEY, JSON.stringify(v));
  } catch {}
}
