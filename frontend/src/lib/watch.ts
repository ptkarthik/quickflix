import { API_BASE, apiFetch } from './api';

export interface WatchSummary {
  free: { approved: number; available: number };
  trailers: { approved: number; withTrailer: number; unchecked: number };
  youtube: { approved: number; pending: number; keySet: boolean };
  classics: { approved: number; pending: number };
  channels: number;
}
export interface WatchChannel { id: string; channelId: string; title: string; handle: string | null; subscribers: number | null; thumbnail: string | null; lastScanAt: string | null; lastScanNote: string | null }
export interface ChannelHit { channelId: string; title: string; handle: string | null; subscribers: number | null; thumbnail: string | null; added: boolean }
export interface FreeVideo { id: string; source: 'youtube' | 'archive'; externalId: string; title: string; channel: string | null; year: number | null; minutes: number | null; thumbnail: string | null; description: string | null; language: string | null; license: string | null; embeddable: boolean; views: number | null; status: 'PENDING' | 'APPROVED' | 'REJECTED' }
export interface SiteBrand { name: string; tagline: string; handle: string; accent: string; instagram: string; youtube: string; facebook: string }

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string })?.message || `Request failed (${res.status})`);
  return body as T;
}
const post = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const brandQs = (b: SiteBrand) => new URLSearchParams(Object.entries(b).filter(([, v]) => v) as Array<[string, string]>).toString();

export const watchApi = {
  summary: () => apiFetch('/watch/summary', undefined, 0).then(r => json<WatchSummary>(r)),
  channels: () => apiFetch('/watch/channels').then(r => json<WatchChannel[]>(r)),
  searchChannels: (q: string) => apiFetch(`/watch/channels/search?q=${encodeURIComponent(q)}`, undefined, 0).then(r => json<ChannelHit[]>(r)),
  addChannel: (ref: string) => apiFetch('/watch/channels', post({ ref }), 0).then(r => json<WatchChannel>(r)),
  removeChannel: (id: string) => apiFetch(`/watch/channels/${id}`, { method: 'DELETE' }, 0).then(r => json<{ removed: boolean }>(r)),
  scanChannel: (id: string) => apiFetch(`/watch/channels/${id}/scan`, { method: 'POST' }, 0).then(r => json<{ active: boolean; note?: string }>(r)),
  scans: () => apiFetch('/watch/scans', undefined, 0).then(r => json<Record<string, { active: boolean; note?: string }>>(r)),
  scanArchive: (body: { q?: string; rows?: number; page?: number }) => apiFetch('/watch/archive/scan', post(body), 0).then(r => json<{ total: number; found: number; added: number }>(r)),
  videos: (f: { source: string; status?: string; q?: string; skip?: number; take?: number }) =>
    apiFetch(`/watch/videos?${new URLSearchParams(Object.entries(f).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))}`, undefined, 0).then(r => json<{ total: number; items: FreeVideo[] }>(r)),
  setStatus: (ids: string[], status: FreeVideo['status']) => apiFetch('/watch/videos/status', post({ ids, status }), 0).then(r => json<{ updated: number }>(r)),
  refreshTrailers: () => apiFetch('/watch/trailers/refresh', { method: 'POST' }, 0).then(r => json<{ checked: number; found: number }>(r)),
  siteUrl: (b: SiteBrand) => `${API_BASE}/watch/site?${brandQs(b)}`,
  exportUrl: (b: SiteBrand) => `${API_BASE}/watch/export?${brandQs(b)}`,
};
