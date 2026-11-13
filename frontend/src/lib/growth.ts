import { apiFetch } from './api';

export interface PostStats {
  id: string;
  format: 'Reel' | 'Carousel' | 'Photo';
  caption: string;
  permalink: string | null;
  thumbnail: string | null;
  timestamp: string;
  likes: number;
  comments: number;
  reach: number | null;
  views: number | null;
  shares: number | null;
  saves: number | null;
  interactions: number | null;
  follows: number | null;
  profileVisits: number | null;
  avgWatchSec: number | null;
  kind: string | null;
  releaseId: string | null;
}
export interface Group { label: string; posts: number; median: number; perReach?: { shares: number; saves: number; engagement: number } }
export interface Finding { text: string; strength: 'strong' | 'early' }

export interface GrowthData {
  synced: boolean;
  configured: boolean;
  missing?: string[];
  syncedAt?: string;
  account?: { username: string | null; followers: number | null; mediaCount: number | null };
  full?: boolean;
  insightsError?: string | null;
  facebookLogin?: boolean;
  growth: { current: number | null; last7: number | null; last30: number | null; series: Array<{ date: string; followers: number }> };
  totals?: { posts: number; last30: number; reach: number | null; views: number | null; likes: number; comments: number; shares: number | null; saves: number | null; follows: number | null };
  analysis?: {
    unit: string;
    within: string | null;
    byFormat: Group[]; byKind: Group[]; byWeekday: Group[]; byDaypart: Group[]; byHashtags: Group[]; byLength: Group[];
    findings: Finding[];
    top: PostStats[];
  };
  posts?: PostStats[];
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string })?.message || `Request failed (${res.status})`);
  return body as T;
}

export const growthApi = {
  get: () => apiFetch('/growth').then(r => json<GrowthData>(r)),
  sync: () => apiFetch('/growth/sync', { method: 'POST' }, 0).then(r => json<GrowthData>(r)),
};

/** Steps to give the existing token the insights permission (Facebook-login flow, graph.facebook.com). */
export const INSIGHTS_SETUP = [
  'Open developers.facebook.com/tools/explorer and pick your app (the one you use for posting).',
  'Under "Permissions" add: instagram_manage_insights — keep the ones you already have (instagram_basic, instagram_content_publish, pages_show_list, pages_read_engagement, business_management).',
  'Click "Generate Access Token" and approve. Then open the Access Token Debugger (ⓘ next to the token) → "Extend Access Token" to get a long-lived (60-day) token.',
  'Paste it as IG_ACCESS_TOKEN in backend/.env (replace the old one) and restart the backend. Press "Sync now" here.',
];
