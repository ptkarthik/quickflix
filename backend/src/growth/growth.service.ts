import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { InstagramService } from '../ott/instagram.service';
import { PostStats, analyse, formatOf, growthOf, parseInsights } from './growth.util';

const DIR = path.join(process.cwd(), 'data', 'growth');
const CACHE = path.join(DIR, 'instagram.json');
const FOLLOWERS = path.join(DIR, 'followers.json');
const MAX_POSTS = 60;

const REEL_METRICS = ['reach', 'views', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'ig_reels_avg_watch_time'];
const FEED_METRICS = ['reach', 'views', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'follows', 'profile_visits'];
const BASIC_METRICS = ['reach', 'likes', 'comments', 'shares', 'saved'];

interface Cache {
  syncedAt: string;
  account: { username: string | null; followers: number | null; mediaCount: number | null };
  full: boolean;
  insightsError: string | null;
  posts: PostStats[];
}

/** Your Instagram numbers, synced every 6 h (and on demand), analysed into plain findings. Read-only. */
@Injectable()
export class GrowthService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(GrowthService.name);
  private timers: NodeJS.Timeout[] = [];
  private running: Promise<unknown> | null = null;

  constructor(private readonly prisma: PrismaService, private readonly ig: InstagramService) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    const tick = () => { if (!this.ig.reelMissing().length) this.sync().catch(e => this.logger.warn(`[Growth] sync failed: ${e.message}`)); };
    this.timers.push(setTimeout(tick, 120000), setInterval(tick, 6 * 3600000));
  }
  onModuleDestroy() {
    this.timers.forEach(t => clearTimeout(t));
  }

  private read<T>(file: string, d: T): T {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
    } catch {
      return d;
    }
  }

  sync() {
    if (!this.running) this.running = this.doSync().finally(() => { this.running = null; });
    return this.running;
  }

  private async doSync() {
    const missing = this.ig.reelMissing();
    if (missing.length) throw new ServiceUnavailableException(`Instagram isn't connected: add ${missing.join(', ')} to backend/.env`);
    const uid = this.ig.accountId!;
    const t0 = Date.now();
    const me = await this.ig.read<{ username?: string; followers_count?: number; media_count?: number }>(uid, { fields: 'username,followers_count,media_count' });

    // one follower count per day (IST) → growth over time
    if (typeof me.followers_count === 'number') {
      const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
      const snaps = this.read<Array<{ date: string; followers: number }>>(FOLLOWERS, []).filter(s => s.date !== today);
      snaps.push({ date: today, followers: me.followers_count });
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(FOLLOWERS, JSON.stringify(snaps.slice(-400)));
    }

    const media: any[] = [];
    let after: string | undefined;
    while (media.length < MAX_POSTS) {
      const page = await this.ig.read<{ data: any[]; paging?: { cursors?: { after?: string }; next?: string } }>(`${uid}/media`, {
        fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count',
        limit: '25',
        ...(after ? { after } : {}),
      });
      media.push(...(page.data || []));
      after = page.paging?.next ? page.paging?.cursors?.after : undefined;
      if (!after) break;
    }

    const ours = await this.prisma.instagramPost.findMany({ where: { mediaId: { in: media.map(m => m.id) } }, select: { mediaId: true, kind: true, releaseId: true } });
    const ourBy = new Map(ours.map(o => [o.mediaId, o]));
    let insightsError: string | null = null;
    const posts: PostStats[] = [];
    for (const m of media.slice(0, MAX_POSTS)) {
      const format = formatOf(m.media_product_type, m.media_type);
      let ins: Partial<PostStats> = {};
      if (!insightsError) {
        for (const set of [format === 'Reel' ? REEL_METRICS : FEED_METRICS, BASIC_METRICS]) {
          try {
            ins = parseInsights((await this.ig.read<{ data: any[] }>(`${m.id}/insights`, { metric: set.join(',') })).data);
            break;
          } catch (e) {
            const msg = (e as Error).message || '';
            if (/\(#10\)|permission/i.test(msg)) {
              insightsError = 'Your Instagram token can’t read insights yet — it needs the instagram_manage_insights permission.';
              break;
            }
            // (#100) unsupported metric for this post → try the basic set; other errors → skip this post's insights
            if (!/\(#100\)|metric/i.test(msg)) break;
          }
        }
      }
      const o = ourBy.get(m.id);
      posts.push({
        id: m.id, format, caption: m.caption || '', permalink: m.permalink || null, thumbnail: m.thumbnail_url || (m.media_type === 'VIDEO' ? null : m.media_url) || null,
        timestamp: m.timestamp, likes: m.like_count ?? 0, comments: m.comments_count ?? 0,
        reach: ins.reach ?? null, views: ins.views ?? null, shares: ins.shares ?? null, saves: ins.saves ?? null, interactions: ins.interactions ?? null,
        follows: ins.follows ?? null, profileVisits: ins.profileVisits ?? null, avgWatchSec: ins.avgWatchSec ?? null,
        kind: o?.kind || null, releaseId: o?.releaseId || null,
      });
    }
    const cache: Cache = {
      syncedAt: new Date().toISOString(),
      account: { username: me.username || null, followers: me.followers_count ?? null, mediaCount: me.media_count ?? null },
      full: !insightsError && posts.some(p => p.reach != null),
      insightsError,
      posts,
    };
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify(cache));
    this.logger.log(`[Growth] synced ${posts.length} posts (${cache.full ? 'full insights' : 'basic'}) in ${Math.round((Date.now() - t0) / 1000)} s`);
    return this.get();
  }

  get() {
    const c = this.read<Cache | null>(CACHE, null);
    const growth = growthOf(this.read(FOLLOWERS, []));
    if (!c) return { synced: false, configured: !this.ig.reelMissing().length, missing: this.ig.reelMissing(), growth };
    const full = c.full;
    const recent = c.posts.filter(p => Date.now() - new Date(p.timestamp).getTime() < 90 * 86400000);
    return {
      synced: true,
      configured: true,
      syncedAt: c.syncedAt,
      account: c.account,
      full,
      insightsError: c.insightsError,
      facebookLogin: this.ig.usesFacebookLogin,
      growth,
      totals: {
        posts: c.posts.length,
        last30: c.posts.filter(p => Date.now() - new Date(p.timestamp).getTime() < 30 * 86400000).length,
        reach: full ? c.posts.reduce((a, p) => a + (p.reach || 0), 0) : null,
        views: full ? c.posts.reduce((a, p) => a + (p.views || 0), 0) : null,
        likes: c.posts.reduce((a, p) => a + p.likes, 0),
        comments: c.posts.reduce((a, p) => a + p.comments, 0),
        shares: full ? c.posts.reduce((a, p) => a + (p.shares || 0), 0) : null,
        saves: full ? c.posts.reduce((a, p) => a + (p.saves || 0), 0) : null,
        follows: full ? c.posts.reduce((a, p) => a + (p.follows || 0), 0) : null,
      },
      analysis: analyse(recent.length >= 3 ? recent : c.posts, full),
      posts: c.posts,
    };
  }
}
