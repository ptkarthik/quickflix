import { apiFetch } from './api';

export interface Story {
  id: string;
  title: string;
  headlines: Array<{ text: string; outlet: string; url: string; date: string | null; lang: 'en' | 'ta' }>;
  outlets: number;
  latest: string | null;
  tamilNadu: boolean;
  trend: { term: string; traffic: number } | null;
  category: string;
  sensitive: string | null;
  score: number;
}
export interface TrendsData { fetchedAt: string; errors: string[]; stories: Story[]; hiddenSensitive: number; categories: string[] }

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string })?.message || `Request failed (${res.status})`);
  return body as T;
}

export const trendsApi = {
  list: (q: { scope: string; category?: string; sensitive?: boolean }) =>
    apiFetch(`/trends?${new URLSearchParams({ scope: q.scope, ...(q.category ? { category: q.category } : {}), ...(q.sensitive ? { sensitive: 'true' } : {}) })}`).then(r => json<TrendsData>(r)),
  refresh: () => apiFetch('/trends/refresh', { method: 'POST' }, 0).then(r => json<TrendsData>(r)),
};

export const ago = (iso: string | null) => {
  if (!iso) return '';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 60 ? `${Math.max(1, m)} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
