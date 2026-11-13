import { API_BASE, apiFetch } from './api';

export interface FacebookStatus { configured: boolean; missing: string[]; name?: string | null; link?: string | null; postedLast24h?: number; error?: string }
export interface YoutubeStatus { configured: boolean; connected: boolean; missing: string[]; channel?: string; postedLast24h?: number; dailyLimit?: number; error?: string }
export interface PublishStatus { facebook: FacebookStatus; youtube: YoutubeStatus }
export interface SocialPost { id: string; channel: 'facebook' | 'youtube'; format: string; releaseId: string | null; permalink: string | null; createdAt: string }
export interface Posted { externalId: string; permalink: string | null; postId: string }

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string })?.message || `Request failed (${res.status})`);
  return body as T;
}
const form = (fields: Record<string, string | undefined>, files: Array<[string, Blob, string]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) f.append(k, v);
  for (const [k, b, name] of files) f.append(k, b, name);
  return f;
};

export const publishApi = {
  status: () => apiFetch('/publish/status', undefined, 0).then(r => json<PublishStatus>(r)),
  posts: (releaseId?: string, channel?: string) => apiFetch(`/publish/posts?${new URLSearchParams({ ...(releaseId ? { releaseId } : {}), ...(channel ? { channel } : {}) })}`).then(r => json<SocialPost[]>(r)),
  facebookPhotos: (images: Blob[], f: { caption: string; kind: string; releaseId?: string; requestId: string }) =>
    apiFetch('/publish/facebook/photos', { method: 'POST', body: form(f, images.map((b, i) => ['images', b, `slide-${i + 1}.jpg`])) }, 0).then(r => json<Posted>(r)),
  facebookReel: (video: Blob, f: { caption: string; kind: string; releaseId?: string; requestId: string }) =>
    apiFetch('/publish/facebook/reel', { method: 'POST', body: form(f, [['video', video, 'reel.mp4']]) }, 0).then(r => json<Posted>(r)),
  youtubeShort: (video: Blob, f: { title: string; description: string; privacy: string; kind: string; releaseId?: string; requestId: string }) =>
    apiFetch('/publish/youtube/short', { method: 'POST', body: form(f, [['video', video, 'short.mp4']]) }, 0).then(r => json<Posted>(r)),
  connectYoutubeUrl: () => `${API_BASE}/publish/youtube/connect`,
  disconnectYoutube: () => apiFetch('/publish/youtube/disconnect', { method: 'POST' }, 0).then(r => json<{ disconnected: boolean }>(r)),
};

export const FACEBOOK_SETUP = [
  'You need a Facebook Page (not a personal profile) that you are an admin of — e.g. a Page for your movie account. Linking it to your Instagram is recommended.',
  'Open developers.facebook.com → your app (the one used for Instagram is fine, or create one: type “Business”) → Add product “Facebook Login for Business”.',
  'Open Tools → Graph API Explorer: choose your app, “Get User Access Token” and tick pages_show_list, pages_read_engagement, pages_manage_posts → Generate.',
  'Click the ⓘ next to the token → “Open in Access Token Tool” → “Extend Access Token” and copy the long-lived token.',
  'Back in Graph API Explorer, paste that token and request: me/accounts — copy your Page’s “id” and “access_token” (this Page token does not expire).',
  'Add to backend/.env:\nFB_PAGE_ID=…\nFB_PAGE_TOKEN=…\nthen restart the app.',
];

export const YOUTUBE_SETUP = [
  'Go to console.cloud.google.com → create a project (free) → “APIs & Services” → Library → enable “YouTube Data API v3”.',
  'OAuth consent screen: User type “External”, fill the app name + your email, add yourself as a test user, then click “Publish app” (In production) — otherwise Google signs you out every 7 days.',
  'Credentials → Create credentials → OAuth client ID → “Web application”. Authorised redirect URI: http://localhost:3000/publish/youtube/callback',
  'Add to backend/.env:\nYT_CLIENT_ID=…\nYT_CLIENT_SECRET=…\nrestart the app, then click “Connect YouTube” and sign in with the Google account that owns your channel (accept the “unverified app” warning — it’s your own app).',
  'Important: YouTube keeps uploads from new API projects Private until the project passes YouTube’s free API audit (search “YouTube API Services audit and quota extension form”). Until then, Shorts upload as Private — you can still check them in YouTube Studio.',
];
