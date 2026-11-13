/**
 * Growth analytics from your own Instagram posts: per-post numbers + plain-language findings ("Reels reach 3× more than
 * carousels", "Thursday evening posts do best"). Rules only — no AI, no guessing; a finding needs enough posts behind it.
 */

export type Format = 'Reel' | 'Carousel' | 'Photo';

export interface PostStats {
  id: string;
  format: Format;
  caption: string;
  permalink: string | null;
  thumbnail: string | null;
  timestamp: string; // ISO
  likes: number;
  comments: number;
  /** full insights (null when the token can't read insights) */
  reach: number | null;
  views: number | null;
  shares: number | null;
  saves: number | null;
  interactions: number | null;
  follows: number | null;
  profileVisits: number | null;
  avgWatchSec: number | null;
  /** from our own post log: what kind of post the app made (world-picks, single, onthisday-birth, …) */
  kind: string | null;
  releaseId: string | null;
}

export const formatOf = (productType?: string, mediaType?: string): Format =>
  productType === 'REELS' ? 'Reel' : mediaType === 'CAROUSEL_ALBUM' ? 'Carousel' : mediaType === 'VIDEO' ? 'Reel' : 'Photo';

/** Graph insights `data` → flat numbers. */
export function parseInsights(data: any[]): Partial<PostStats> {
  const v = (name: string) => {
    const d = (data || []).find(x => x.name === name);
    const val = d?.values?.[0]?.value ?? d?.total_value?.value;
    return typeof val === 'number' ? val : null;
  };
  const avgMs = v('ig_reels_avg_watch_time');
  return {
    reach: v('reach'),
    views: v('views') ?? v('plays'),
    shares: v('shares'),
    saves: v('saved'),
    interactions: v('total_interactions'),
    follows: v('follows'),
    profileVisits: v('profile_visits'),
    avgWatchSec: avgMs == null ? null : Math.round(avgMs / 100) / 10,
  };
}

const IST = 330; // minutes
export function istParts(iso: string) {
  const d = new Date(new Date(iso).getTime() + IST * 60000);
  return { weekday: d.getUTCDay(), hour: d.getUTCHours() };
}
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const daypart = (h: number) => (h < 6 ? 'Late night (12–6 AM)' : h < 12 ? 'Morning (6 AM–12 PM)' : h < 17 ? 'Afternoon (12–5 PM)' : h < 21 ? 'Evening (5–9 PM)' : 'Night (9 PM–12 AM)');
export const hashtagCount = (c: string) => (c.match(/#[\p{L}\p{N}_]+/gu) || []).length;

export function median(xs: number[]) {
  const s = xs.filter(x => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The number a post is judged on: reach when we have insights, otherwise likes + comments. */
export const scoreOf = (p: PostStats, full: boolean) => (full ? p.reach ?? 0 : p.likes + p.comments);

export interface Group { label: string; posts: number; median: number; perReach?: { shares: number; saves: number; engagement: number } }

function groupBy(posts: PostStats[], key: (p: PostStats) => string, full: boolean): Group[] {
  const m = new Map<string, PostStats[]>();
  for (const p of posts) {
    const k = key(p);
    m.set(k, [...(m.get(k) || []), p]);
  }
  return [...m.entries()]
    .map(([label, ps]) => {
      const g: Group = { label, posts: ps.length, median: median(ps.map(p => scoreOf(p, full))) };
      if (full) {
        const reach = ps.reduce((a, p) => a + (p.reach || 0), 0) || 1;
        g.perReach = {
          shares: ps.reduce((a, p) => a + (p.shares || 0), 0) / reach,
          saves: ps.reduce((a, p) => a + (p.saves || 0), 0) / reach,
          engagement: ps.reduce((a, p) => a + (p.interactions ?? p.likes + p.comments), 0) / reach,
        };
      }
      return g;
    })
    .sort((a, b) => b.median - a.median);
}

const KIND_LABEL: Record<string, string> = {
  single: 'Single title', 'world-single': 'World single', 'cinema-single': 'Cinema single', weekly: 'Weekly OTT', picks: 'OTT picks', 'world-picks': 'World list',
  'onthisday-birth': 'Birthday', 'onthisday-death': 'Remembering', 'onthisday-film': 'Anniversary',
};
export const kindLabel = (k: string | null) => {
  if (!k) return 'Posted outside the app';
  const base = k.replace(/-reel$/, '');
  return (KIND_LABEL[base] || base.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())) + (k.endsWith('-reel') ? ' (Reel)' : '');
};

export interface Finding { text: string; strength: 'strong' | 'early' }

/** Compare the best group with the rest; only when both sides have enough posts. */
function compare(groups: Group[], what: string, unit: string, minPosts: number): Finding | null {
  const ok = groups.filter(g => g.posts >= minPosts);
  if (ok.length < 2) return null;
  const [best, ...rest] = ok;
  const restMed = median(rest.map(g => g.median));
  if (!restMed || best.median < restMed * 1.25) return null;
  const x = best.median / restMed;
  return { text: `${what}: “${best.label}” gets ${x >= 2 ? `${x.toFixed(1)}×` : `${Math.round((x - 1) * 100)}% more`} ${unit} than the rest (median ${Math.round(best.median).toLocaleString('en-IN')} over ${best.posts} posts vs ${Math.round(restMed).toLocaleString('en-IN')}).`, strength: best.posts >= 5 && rest.reduce((a, g) => a + g.posts, 0) >= 5 ? 'strong' : 'early' };
}

export function analyse(posts: PostStats[], full: boolean) {
  const unit = full ? 'reach' : 'likes + comments';
  const byFormat = groupBy(posts, p => p.format, full);
  const byKind = groupBy(posts, p => kindLabel(p.kind), full);
  // Time, day, hashtags and caption length are compared within your main format only — otherwise "long captions win"
  // can really mean "Reels win" (if your Reels happen to have long captions).
  const main = byFormat.slice().sort((a, b) => b.posts - a.posts)[0]?.label as Format | undefined;
  const same = main ? posts.filter(p => p.format === main) : posts;
  const within = main && same.length !== posts.length ? ` (${main}s only)` : '';
  const byWeekday = groupBy(same, p => WEEKDAYS[istParts(p.timestamp).weekday], full);
  const byDaypart = groupBy(same, p => daypart(istParts(p.timestamp).hour), full);
  const byHashtags = groupBy(same, p => { const n = hashtagCount(p.caption); return n === 0 ? 'No hashtags' : n <= 5 ? '1–5 hashtags' : n <= 10 ? '6–10 hashtags' : '11+ hashtags'; }, full);
  const byLength = groupBy(same, p => (p.caption.length < 150 ? 'Short caption (<150)' : p.caption.length < 500 ? 'Medium caption' : 'Long caption (500+)'), full);

  const findings: Finding[] = [];
  const push = (f: Finding | null) => { if (f) findings.push(f); };
  push(compare(byFormat, 'Format', unit, 2));
  push(compare(byKind, 'Post type', unit, 2));
  push(compare(byDaypart, `Time of day${within}`, unit, 2));
  push(compare(byWeekday, `Day${within}`, unit, 2));
  push(compare(byHashtags, `Hashtags${within}`, unit, 2));
  push(compare(byLength, `Caption length${within}`, unit, 2));
  if (full) {
    const withReach = posts.filter(p => (p.reach || 0) > 0);
    const sendsTop = [...withReach].sort((a, b) => (b.shares || 0) / (b.reach || 1) - (a.shares || 0) / (a.reach || 1))[0];
    if (sendsTop && (sendsTop.shares || 0) > 0) findings.push({ text: `Most-sent post: ${(((sendsTop.shares || 0) / (sendsTop.reach || 1)) * 100).toFixed(1)}% of viewers sent it to someone — sends are the biggest signal for reaching non-followers. Make more like it.`, strength: 'early' });
    const reels = posts.filter(p => p.format === 'Reel' && p.avgWatchSec != null);
    if (reels.length >= 3) findings.push({ text: `Reels hold viewers for ${median(reels.map(r => r.avgWatchSec!)).toFixed(1)} s on average (median). The first 2 seconds decide this — open with your strongest line or frame.`, strength: reels.length >= 6 ? 'strong' : 'early' });
  }
  if (posts.length < 6) findings.push({ text: `Only ${posts.length} post(s) so far — patterns become reliable after about 10–15 posts. Keep posting and check back.`, strength: 'early' });

  const top = [...posts].sort((a, b) => scoreOf(b, full) - scoreOf(a, full)).slice(0, 5);
  return { unit, within: main || null, byFormat, byKind, byWeekday, byDaypart, byHashtags, byLength, findings, top };
}

/** Follower snapshots (one per day) → growth over 7 / 30 days. */
export function growthOf(snaps: Array<{ date: string; followers: number }>) {
  const s = [...snaps].sort((a, b) => a.date.localeCompare(b.date));
  const last = s[s.length - 1];
  const back = (days: number) => {
    if (!last) return null;
    const cut = new Date(new Date(`${last.date}T00:00:00Z`).getTime() - days * 86400000).toISOString().slice(0, 10);
    const prev = [...s].reverse().find(x => x.date <= cut);
    return prev ? last.followers - prev.followers : null;
  };
  return { current: last?.followers ?? null, last7: back(7), last30: back(30), series: s.slice(-90) };
}
