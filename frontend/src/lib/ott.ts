import { apiFetch } from '@/lib/api';

export type OttStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type Trust = 'CONFIRMED' | 'CORROBORATED' | 'REPORTED' | 'CONFLICT';
export type LiveStatus = 'LIVE' | 'NOT_LIVE' | 'UNKNOWN';

export interface OttEvidence {
  id: string;
  sourceType: 'OFFICIAL_YOUTUBE' | 'TMDB_RELEASE' | 'TMDB_LIVE' | 'NEWS' | 'MANUAL';
  sourceKey: string;
  sourceName: string | null;
  sourceUrl: string | null;
  claimedPlatform: string | null;
  claimedDate: string | null;
  text: string | null;
  observedAt: string;
}

export interface OttRelease {
  id: string;
  title: string;
  contentType: 'movie' | 'tv';
  seasonNumber: number | null;
  language: string | null;
  platform: string | null;
  releaseDate: string | null;
  status: OttStatus;
  origin: 'MANUAL' | 'NEWS' | 'TMDB';
  sourceUrl: string | null;
  sourceName: string | null;
  headline: string | null;
  tmdbId: number | null;
  posterPath: string | null;
  overview: string | null;
  genres: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  dubLanguage: string | null;
  originalYear: number | null;
  trust: Trust;
  trustReason: string | null;
  userLocked: boolean;
  liveStatus: LiveStatus;
  livePlatforms: string | null;
  liveFirstSeenAt: string | null;
  liveCheckedAt: string | null;
  evidence?: OttEvidence[];
  myRating: number | null;
  myReview: string | null;
}

export const PUBLISHABLE: Trust[] = ['CONFIRMED', 'CORROBORATED'];

export const TRUST_STYLE: Record<Trust, { label: string; icon: string; cls: string; hint: string }> = {
  CONFIRMED: { label: 'Confirmed', icon: '✅', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', hint: 'Official platform channel, or verified streaming in India' },
  CORROBORATED: { label: 'Corroborated', icon: '🟢', cls: 'bg-green-500/10 text-green-300 border-green-500/30', hint: '2+ independent sources agree on platform and date' },
  REPORTED: { label: 'Reported', icon: '🟡', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30', hint: 'Single source or missing facts — not publishable yet' },
  CONFLICT: { label: 'Conflict', icon: '🔴', cls: 'bg-red-500/15 text-red-300 border-red-500/40', hint: 'Sources disagree — check before using' },
};

export const EVIDENCE_LABEL: Record<OttEvidence['sourceType'], string> = {
  OFFICIAL_YOUTUBE: 'Official channel',
  TMDB_RELEASE: 'TMDB India release',
  TMDB_LIVE: 'Live in India',
  NEWS: 'News',
  MANUAL: 'You',
};

/** An older title newly added to a platform ("New to Netflix") rather than a new release. */
export const isCatalogueTitle = (r: Pick<OttRelease, 'originalYear' | 'releaseDate' | 'contentType' | 'seasonNumber'>) =>
  !!r.originalYear && !!r.releaseDate && r.contentType === 'movie' && parseInt(r.releaseDate.slice(0, 4), 10) - r.originalYear >= 2;

export interface TmdbSearchResult {
  tmdbId: number;
  contentType: 'movie' | 'tv';
  title: string;
  originalLanguage?: string;
  releaseDate?: string;
  posterPath?: string;
  overview?: string;
}

export const PLATFORMS = [
  'Netflix', 'Prime Video', 'JioHotstar', 'SonyLIV', 'ZEE5', 'Aha', 'Sun NXT', 'ManoramaMAX',
  'ETV Win', 'Apple TV+', 'Lionsgate Play', 'Hoichoi', 'Amazon MX Player', 'Chaupal', 'Simply South',
];

export const LANGUAGES: Array<{ code: string; label: string; tag: string }> = [
  { code: 'ta', label: 'Tamil', tag: 'TamilOTT' },
  { code: 'te', label: 'Telugu', tag: 'TeluguOTT' },
  { code: 'ml', label: 'Malayalam', tag: 'MalayalamOTT' },
  { code: 'kn', label: 'Kannada', tag: 'KannadaOTT' },
  { code: 'hi', label: 'Hindi', tag: 'HindiOTT' },
  { code: 'mr', label: 'Marathi', tag: 'MarathiOTT' },
  { code: 'bn', label: 'Bengali', tag: 'BengaliOTT' },
  { code: 'pa', label: 'Punjabi', tag: 'PunjabiOTT' },
  { code: 'en', label: 'English', tag: 'HollywoodOTT' },
  { code: 'ko', label: 'Korean', tag: 'KDrama' },
  { code: 'ja', label: 'Japanese', tag: 'Anime' },
];

export const languageLabel = (code?: string | null) =>
  LANGUAGES.find(l => l.code === code)?.label || (code ? code.toUpperCase() : '');

/** Brand colours used on slides and badges. */
export const PLATFORM_STYLE: Record<string, { bg: string; fg: string }> = {
  Netflix: { bg: '#E50914', fg: '#ffffff' },
  'Prime Video': { bg: '#1A98FF', fg: '#ffffff' },
  JioHotstar: { bg: '#0F1D5C', fg: '#ffffff' },
  SonyLIV: { bg: '#000000', fg: '#F5C518' },
  ZEE5: { bg: '#8230C6', fg: '#ffffff' },
  Aha: { bg: '#FF6A13', fg: '#ffffff' },
  'Sun NXT': { bg: '#F7A100', fg: '#111111' },
  ManoramaMAX: { bg: '#D7182A', fg: '#ffffff' },
  'ETV Win': { bg: '#E4002B', fg: '#ffffff' },
  'Apple TV+': { bg: '#111111', fg: '#ffffff' },
};
export const platformStyle = (p?: string | null) => (p && PLATFORM_STYLE[p]) || { bg: '#334155', fg: '#ffffff' };

/** posterPath is a TMDB path (/abc.jpg) or, when you picked another image for the title, a full URL. */
export const posterUrl = (path?: string | null, size: 'w342' | 'w500' | 'w780' = 'w500') =>
  !path ? null : /^(https?:\/\/|data:|blob:)/.test(path) ? path : `https://image.tmdb.org/t/p/${size}${path}`;

/** Same-origin proxied URL for any remote image (html-to-image needs untainted pixels). data: URLs pass through. */
export const proxied = (url?: string | null) =>
  !url ? null : /^(data:|blob:|\/)/.test(url) ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`;

/** Same-origin proxied URL so html-to-image can read pixels without CORS taint. */
export const proxiedPoster = (path?: string | null, size: 'w342' | 'w500' | 'w780' = 'w780') => {
  return proxied(posterUrl(path, size));
};

// ───────────────────────── dates (India) ─────────────────────────

export function todayIst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `date` (Indian OTT weeks are usually discussed Mon–Sun). */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  return addDays(date, -dow);
}

export const RECENT_DAYS = 30;

/** "Recently on OTT": date passed within the last 30 days, or (undated) first seen streaming in India within 30 days. */
export function isRecentlyOnOtt(r: Pick<OttRelease, 'releaseDate' | 'liveStatus' | 'liveFirstSeenAt'>, today: string) {
  const from = addDays(today, -RECENT_DAYS);
  if (r.releaseDate) return r.releaseDate <= today && r.releaseDate >= from;
  return r.liveStatus === 'LIVE' && !!r.liveFirstSeenAt && r.liveFirstSeenAt.slice(0, 10) >= from;
}

export function fmtDate(date?: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  if (!date) return 'Date TBA';
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', ...opts });
}

export function fmtRange(from: string, to: string) {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth();
  const left = a.toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', ...(sameMonth ? {} : { month: 'short' }) });
  const right = b.toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
  return `${left} – ${right}`;
}

export const displayTitle = (r: Pick<OttRelease, 'title' | 'contentType' | 'seasonNumber'> & { dubLanguage?: string | null }) => {
  const base = r.contentType === 'tv' && r.seasonNumber && r.seasonNumber > 1 ? `${r.title} Season ${r.seasonNumber}` : r.title;
  return r.dubLanguage ? `${base} (${languageLabel(r.dubLanguage)})` : base;
};

// ───────────────────────── caption templates (no AI) ─────────────────────────

const hashtagify = (s: string) => '#' + s.replace(/[^A-Za-z0-9]/g, '');

function baseTags(items: OttRelease[], extra: string[]) {
  const tags = new Set<string>(extra);
  for (const r of items) {
    const lang = LANGUAGES.find(l => l.code === r.language);
    if (lang) tags.add(`#${lang.tag}`);
    if (r.platform) tags.add(hashtagify(r.platform));
  }
  return Array.from(tags).slice(0, 25).join(' ');
}

/** How an OTT post ends (caption closing line + the end slide). 'auto' = the wording that fits the post type. */
export const OTT_CTAS = [
  { id: 'auto', label: '✨ Auto (fits the post)', single: '', list: '', outro: '' },
  { id: 'first', label: '🍿 Which one first?', single: 'Are you watching this one? Tell me below 👇', list: 'Which one are you watching first? Tell us in the comments 👇', outro: 'Which one are you watching first?' },
  { id: 'review', label: '⭐ Watched it? Review', single: 'Watched it? Drop your rating below 👇', list: 'Watched any of these? Drop your rating below 👇', outro: 'Watched it? Drop your review!' },
  { id: 'save', label: '📌 Save for the weekend', single: 'Save this for your weekend watchlist 📌', list: 'Save this post for your weekend watchlist 📌', outro: 'Save it for the weekend!' },
  { id: 'tag', label: '🏷 Tag a friend', single: 'Tag the friend you’re watching this with 🏷', list: 'Tag your binge buddy 🏷', outro: 'Tag your binge buddy!' },
  { id: 'add', label: '➕ What would you add?', single: 'Seen something like it? Recommend below 👇', list: 'What would you add to this list? 👇', outro: 'What would you add?' },
  { id: 'none', label: 'No call to action', single: '', list: '', outro: 'Thanks for watching!' },
] as const;
export const ottCtaOf = (id?: string) => OTT_CTAS.find(c => c.id === id) || OTT_CTAS[0];
/** closing lines for a list caption: your ending, or the post type's default pair */
const listEnding = (cta: string | undefined, ai: AiCaptionCopy | null | undefined, dflt: [string, string]) => {
  if (ai?.closing) return [ai.closing, cta && cta !== 'auto' ? '' : dflt[1]];
  if (!cta || cta === 'auto') return dflt;
  return [ottCtaOf(cta).list, ''];
};

export function weeklyCaption(items: OttRelease[], from: string, to: string, handle: string, extraTags: string, ai?: AiCaptionCopy | null, cta?: string) {
  const lines = items.map(r => {
    const bits = [r.platform || 'Platform TBA', fmtDate(r.releaseDate, { day: 'numeric', month: 'short' })];
    const lang = languageLabel(r.language);
    const teaser = ai?.teasers[r.id];
    return `🎬 ${displayTitle(r)}${lang ? ` (${lang})` : ''} — ${bits.join(' • ')}${teaser ? `\n   ${teaser}` : ''}`;
  });
  return [
    ...(ai?.hook ? [ai.hook, ''] : []),
    `🍿 OTT Releases This Week (${fmtRange(from, to)})`,
    '',
    ...lines,
    '',
    ...listEnding(cta, ai, ['Which one are you watching first? Tell us in the comments 👇', 'Save this post for your weekend watchlist 📌']),
    handle ? `\nFollow ${handle} for weekly OTT updates` : '',
    '',
    baseTags(items, ['#OTTReleases', '#OTTUpdates', '#ThisWeekOnOTT', '#NewOnOTT', '#WhatToWatch', ...splitTags(extraTags)]),
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
}

export function picksCaption(items: OttRelease[], heading: string, notes: Record<string, string>, handle: string, extraTags: string, ai?: AiCaptionCopy | null, cta?: string) {
  const lines = items.map((r, i) => {
    // Your own note always wins over the AI teaser.
    const note = notes[r.id]?.trim() || ai?.teasers[r.id];
    return `${i + 1}. ${displayTitle(r)} — ${r.platform || 'OTT'}${note ? `\n   ${note}` : ''}`;
  });
  return [
    ...(ai?.hook ? [ai.hook, ''] : []),
    `⭐ ${heading}`,
    '',
    ...lines,
    '',
    ...listEnding(cta, ai, ['Have you watched any of these? Drop your pick below 👇', 'Save & share with your movie buddy 📌']),
    handle ? `\nFollow ${handle} for more OTT suggestions` : '',
    '',
    baseTags(items, ['#OTTSuggestions', '#WhatToWatch', '#MustWatch', '#OTTPicks', ...splitTags(extraTags)]),
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
}

export function splitTags(s: string) {
  return s.split(/[\s,]+/).map(t => t.trim()).filter(Boolean).map(t => (t.startsWith('#') ? t : `#${t}`));
}

/** ★★★★½ style; rating is 0–5 in 0.5 steps. */
export function starString(rating: number) {
  const full = Math.floor(rating);
  return '★'.repeat(full) + (rating - full >= 0.5 ? '½' : '') + '☆'.repeat(5 - full - (rating - full >= 0.5 ? 1 : 0));
}

/** Caption for a single-title post. Your rating and review are used verbatim. */
export function singleCaption(r: OttRelease, opts: { rating: number | null; review: string; handle: string; extraTags: string; today: string; ai?: AiCaptionCopy | null; cta?: string }) {
  const ai = opts.ai;
  const upcoming = !!r.releaseDate && r.releaseDate > opts.today;
  const when = r.releaseDate ? fmtDate(r.releaseDate, { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  const where = r.platform
    ? upcoming
      ? `🗓 Streaming from ${when} on ${r.platform}`
      : `📺 Now streaming on ${r.platform}${when ? ` (since ${when})` : ''}`
    : null;
  return [
    ...(ai?.hook ? [ai.hook, ''] : []),
    `🎬 ${displayTitle(r)}`,
    where,
    [languageLabel(r.language), r.contentType === 'tv' ? 'Series' : 'Movie'].filter(Boolean).join(' • '),
    '',
    opts.rating != null ? `My rating: ${starString(opts.rating)} (${opts.rating}/5)` : null,
    opts.review.trim() || null,
    ai?.blurb ? '' : null,
    ai?.blurb || null,
    '',
    ai?.closing || (opts.cta && opts.cta !== 'auto' ? ottCtaOf(opts.cta).single : upcoming ? 'Are you watching this one? Tell me below 👇' : 'Watched it? Drop your rating below 👇'),
    opts.handle ? `Follow ${opts.handle} for more OTT updates & reviews` : null,
    '',
    baseTags([r], [opts.rating != null ? '#MovieReview' : '#OTTRelease', '#WhatToWatch', ...splitTags(opts.extraTags)]),
  ]
    .filter((l): l is string => l !== null)
    .filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n')
    .trim();
}

/** AI-written creative lines only. Facts (title, platform, date, rating, review) are always added by the templates. */
export interface AiCaptionCopy {
  hook: string;
  blurb: string;
  teasers: Record<string, string>;
  closing: string;
  model: string;
  dropped: number;
}

export const AI_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tanglish', label: 'Tanglish' },
  { code: 'ta', label: 'தமிழ் Tamil' },
  { code: 'hi', label: 'हिन्दी Hindi' },
  { code: 'te', label: 'తెలుగు Telugu' },
  { code: 'ml', label: 'മലയാളം Malayalam' },
  { code: 'kn', label: 'ಕನ್ನಡ Kannada' },
];
export const AI_TONES = [
  { code: 'hype', label: 'Hype' },
  { code: 'friendly', label: 'Friendly' },
  { code: 'informative', label: 'Informative' },
  { code: 'witty', label: 'Witty' },
];

export interface ImageOption {
  url: string;
  thumb: string;
  source: 'TMDB' | 'OFFICIAL' | 'WEB';
  kind: 'poster' | 'backdrop' | 'thumbnail' | 'web';
  width?: number;
  height?: number;
  label?: string;
  pageUrl?: string;
}

export interface CollectSummary {
  official: { videos: number };
  tmdb: { claims: number };
  news: { headlinesSeen: number };
  live: { live: number; checked: number };
  created: number;
  evidenceAdded: number;
  movedBackToReview?: number;
  trust?: Partial<Record<Trust, number>>;
}

export interface InstagramStatus {
  configured: boolean;
  /** Reels need only the token + account id (no image host). */
  reelReady?: boolean;
  missing: string[];
  username?: string | null;
  error?: string;
  postedLast24h?: number;
  dailyLimit?: number;
}

export interface InstagramPost {
  id: string;
  releaseId: string | null;
  kind: string;
  mediaId: string;
  permalink: string | null;
  createdAt: string;
}

// ───────────────────────── API ─────────────────────────

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string })?.message || `Request failed (${res.status})`);
  return body as T;
}

export const ottApi = {
  list: (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return apiFetch(`/ott/releases${q ? `?${q}` : ''}`).then(r => json<OttRelease[]>(r));
  },
  counts: () => apiFetch('/ott/counts').then(r => json<Record<OttStatus, number>>(r)),
  create: (body: Partial<OttRelease>) =>
    apiFetch('/ott/releases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => json<OttRelease>(r)),
  update: (id: string, body: Partial<OttRelease>) =>
    apiFetch(`/ott/releases/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => json<OttRelease>(r)),
  remove: (id: string) => apiFetch(`/ott/releases/${id}`, { method: 'DELETE' }).then(r => json<{ deleted: boolean }>(r)),
  bulkStatus: (ids: string[], status: OttStatus) =>
    apiFetch('/ott/releases/bulk-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, status }) }).then(r => json<{ updated: number }>(r)),
  collect: () => apiFetch('/ott/collect', { method: 'POST' }).then(r => json<CollectSummary>(r)),
  approveConfirmed: () => apiFetch('/ott/releases/approve-confirmed', { method: 'POST' }).then(r => json<{ approved: number }>(r)),
  images: (id: string, q?: string) =>
    apiFetch(`/ott/releases/${id}/images${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(r =>
      json<{ query: string; tmdb: ImageOption[]; official: ImageOption[]; web: ImageOption[]; webError?: string }>(r),
    ),
  draftReview: (id: string, body: { rating?: number | null; notes?: string; tone?: string }) =>
    apiFetch(`/ott/releases/${id}/draft-review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => json<{ text: string; model: string }>(r)),
  /** No automatic retries: an AI call can take a while and a retry would just queue another. */
  aiCaption: (body: { kind: 'single' | 'weekly' | 'picks'; releaseIds: string[]; tone: string; language: string; rating?: number | null; review?: string; heading?: string }) =>
    apiFetch('/ott/ai/caption', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 0).then(r => json<AiCaptionCopy>(r)),
  instagramStatus: () =>
    apiFetch('/ott/instagram/status').then(r => json<InstagramStatus>(r)),
  /** Exactly one request (no automatic retries) — a retried publish could post twice. */
  instagramPublish: (images: Blob[], meta: { caption: string; kind: string; releaseId?: string; requestId: string }) => {
    const form = new FormData();
    images.forEach((b, i) => form.append('images', b, `slide-${i + 1}.jpg`));
    form.append('caption', meta.caption);
    form.append('kind', meta.kind);
    form.append('requestId', meta.requestId);
    if (meta.releaseId) form.append('releaseId', meta.releaseId);
    return apiFetch('/ott/instagram/publish', { method: 'POST', body: form }, 0).then(r => json<{ mediaId: string; permalink: string | null }>(r));
  },
  /** One request only — a retried publish could post twice. */
  instagramReel: (video: Blob, meta: { caption: string; kind: string; releaseId?: string; requestId: string; shareToFeed: boolean }) => {
    const form = new FormData();
    form.append('video', video, 'reel.mp4');
    form.append('caption', meta.caption);
    form.append('kind', meta.kind);
    form.append('requestId', meta.requestId);
    form.append('shareToFeed', String(meta.shareToFeed));
    if (meta.releaseId) form.append('releaseId', meta.releaseId);
    return apiFetch('/ott/instagram/reel', { method: 'POST', body: form }, 0).then(r => json<{ mediaId: string; permalink: string | null }>(r));
  },
  instagramPosts: (releaseId?: string) =>
    apiFetch(`/ott/instagram/posts${releaseId ? `?releaseId=${releaseId}` : ''}`).then(r => json<InstagramPost[]>(r)),
  tmdbSearch: (q: string) => apiFetch(`/ott/tmdb-search?q=${encodeURIComponent(q)}`).then(r => json<TmdbSearchResult[]>(r)),
};
