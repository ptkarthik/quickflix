import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Direct publishing through Instagram's official Content Publishing API (free).
 *
 * Needs (backend/.env):
 *   IG_ACCESS_TOKEN  long-lived token for an Instagram Business/Creator account
 *   IG_USER_ID       that account's Instagram user id
 *   IMGBB_API_KEY    free key from api.imgbb.com — Instagram must download the image from a public URL,
 *                    and localhost isn't public, so each JPEG is hosted there for 10 minutes only.
 * Optional: IG_GRAPH_HOST (default graph.instagram.com = "Instagram API with Instagram Login";
 *           use graph.facebook.com for the Facebook-Page flow), IG_GRAPH_VERSION (default v23.0).
 */

export interface PublishInput {
  images: Buffer[];
  caption: string;
  releaseId?: string | null;
  kind: string;
  /** Client-generated id so a repeated request can never publish twice. */
  requestId: string;
}

export interface ReelInput {
  video: Buffer;
  caption: string;
  releaseId?: string | null;
  kind: string;
  requestId: string;
  /** Also show the Reel in the main feed grid (Instagram default: yes). */
  shareToFeed?: boolean;
}

export interface PublishResult {
  mediaId: string;
  permalink: string | null;
  postId: string;
}

const MAX_CAROUSEL = 10; // Content Publishing API limit
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REEL_BYTES = 300 * 1024 * 1024;
const TOKEN_FILE = path.join(process.cwd(), '.instagram-token.json');
const REFRESH_AFTER_DAYS = 20; // long-lived tokens last 60 days; refreshing resets that

type Fetch = typeof fetch;

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);
  private readonly inFlight = new Map<string, Promise<PublishResult>>();
  /** Overridable in tests. */
  fetchImpl: Fetch = (...a) => fetch(...a);
  sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  constructor(private readonly prisma: PrismaService) {}

  private get host() {
    return (process.env.IG_GRAPH_HOST || 'graph.instagram.com').replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
  private get version() {
    return process.env.IG_GRAPH_VERSION || 'v23.0';
  }
  private get userId() {
    return process.env.IG_USER_ID?.trim();
  }

  /** Token from env, unless we've refreshed it since (saved locally, git-ignored). */
  private token(): string | undefined {
    const env = process.env.IG_ACCESS_TOKEN?.trim();
    try {
      const saved = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) as { token: string; seed: string };
      if (saved.seed === env?.slice(-12)) return saved.token;
    } catch {}
    return env;
  }

  missing(): string[] {
    const m: string[] = [];
    if (!process.env.IG_ACCESS_TOKEN?.trim()) m.push('IG_ACCESS_TOKEN');
    if (!this.userId) m.push('IG_USER_ID');
    if (!process.env.IMGBB_API_KEY?.trim()) m.push('IMGBB_API_KEY');
    return m;
  }

  private url(p: string, params: Record<string, string> = {}) {
    const qs = new URLSearchParams({ ...params, access_token: this.token() || '' });
    return `https://${this.host}/${this.version}/${p}?${qs}`;
  }

  private async graph<T = any>(method: 'GET' | 'POST', p: string, params: Record<string, string> = {}): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(method === 'GET' ? this.url(p, params) : this.url(p), {
        method,
        ...(method === 'POST' ? { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() } : {}),
        signal: AbortSignal.timeout(30000),
      });
    } catch (err: any) {
      throw new ServiceUnavailableException(`Couldn't reach Instagram: ${err.message}`);
    }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || body?.error) {
      const e = body?.error || {};
      const hint =
        e.code === 190 ? ' — your access token is invalid or expired; generate a new one in the Meta app dashboard.' :
        e.code === 10 || e.code === 200 ? ' — the token is missing the instagram_business_content_publish permission.' :
        e.code === 9 || e.code === 4 ? ' — Instagram rate limit reached; try later.' :
        e.code === 9004 || e.error_subcode === 2207052 ? ' — Instagram could not download the image.' : '';
      throw new BadRequestException(`Instagram: ${e.error_user_msg || e.message || `HTTP ${res.status}`}${hint}`);
    }
    return body as T;
  }

  /** Read-only Graph API call (used by analytics). */
  read<T = any>(p: string, params: Record<string, string> = {}): Promise<T> {
    return this.graph<T>('GET', p, params);
  }
  get accountId() {
    return this.userId;
  }
  /** Facebook-Login tokens (graph.facebook.com) aren't auto-refreshed here — they need the app secret. */
  get usesFacebookLogin() {
    return this.host === 'graph.facebook.com';
  }

  async status() {
    const missing = this.missing();
    // Photos need the image host too; Reels only need the token + account id.
    if (this.reelMissing().length) return { configured: false, reelReady: false, missing };
    try {
      await this.refreshTokenIfDue();
      const me = await this.graph<{ username?: string; id?: string }>('GET', this.userId!, { fields: 'username' });
      const posted24h = await this.prisma.instagramPost.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) } } });
      return { configured: !missing.length, reelReady: true, missing, username: me.username || null, postedLast24h: posted24h, dailyLimit: 100 };
    } catch (err: any) {
      return { configured: false, reelReady: false, missing, error: err.message };
    }
  }

  /** Long-lived Instagram-Login tokens expire after 60 days unless refreshed; refresh every ~20 days. */
  private async refreshTokenIfDue() {
    if (this.host !== 'graph.instagram.com') return;
    const env = process.env.IG_ACCESS_TOKEN?.trim();
    if (!env) return;
    let refreshedAt = 0;
    try {
      const saved = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      if (saved.seed === env.slice(-12)) refreshedAt = saved.refreshedAt || 0;
    } catch {}
    if (Date.now() - refreshedAt < REFRESH_AFTER_DAYS * 86400000) return;
    try {
      const res = await this.fetchImpl(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(this.token()!)}`,
        { signal: AbortSignal.timeout(15000) },
      );
      const body: any = await res.json().catch(() => ({}));
      if (res.ok && body.access_token) {
        fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token: body.access_token, seed: env.slice(-12), refreshedAt: Date.now() }));
        this.logger.log('[Instagram] Access token refreshed.');
      }
    } catch (err: any) {
      this.logger.warn(`[Instagram] Token refresh failed: ${err.message}`);
    }
  }

  /** Temporary public URL for Instagram to fetch (auto-deleted by imgbb after 10 minutes). */
  private async hostImage(buf: Buffer, name: string): Promise<string> {
    const form = new FormData();
    form.append('image', buf.toString('base64'));
    form.append('name', name);
    let res: Response;
    try {
      res = await this.fetchImpl(`https://api.imgbb.com/1/upload?expiration=600&key=${encodeURIComponent(process.env.IMGBB_API_KEY!.trim())}`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(60000),
      });
    } catch (err: any) {
      throw new ServiceUnavailableException(`Couldn't upload the image for Instagram: ${err.message}`);
    }
    const body: any = await res.json().catch(() => ({}));
    const url = body?.data?.url;
    if (!res.ok || !url) throw new ServiceUnavailableException(`Image host error: ${body?.error?.message || `HTTP ${res.status}`}`);
    return url;
  }

  /** Instagram processes containers asynchronously; publish only once FINISHED. (Videos can take minutes.) */
  private async waitForContainer(id: string, tries = 30, everyMs = 2000) {
    for (let i = 0; i < tries; i++) {
      const s = await this.graph<{ status_code?: string; status?: string }>('GET', id, { fields: 'status_code,status' });
      if (s.status_code === 'FINISHED') return;
      if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new BadRequestException(`Instagram rejected the media: ${s.status || s.status_code}`);
      await this.sleep(everyMs);
    }
    throw new ServiceUnavailableException('Instagram is still processing the media — check your account before retrying, so it isn’t posted twice.');
  }

  validate(input: PublishInput) {
    if (!input.requestId || input.requestId.length > 100) throw new BadRequestException('requestId is required');
    if (!input.images.length) throw new BadRequestException('No image to post');
    if (input.images.length > MAX_CAROUSEL) throw new BadRequestException(`Instagram's API allows at most ${MAX_CAROUSEL} images per carousel (got ${input.images.length}).`);
    for (const img of input.images) {
      if (img.length > MAX_BYTES) throw new BadRequestException('Each image must be under 8 MB');
      if (!(img[0] === 0xff && img[1] === 0xd8)) throw new BadRequestException('Images must be JPEG');
    }
    this.validateCaption(input.caption);
  }

  private validateCaption(caption: string) {
    if (caption.length > 2200) throw new BadRequestException(`Caption is ${caption.length} characters; Instagram allows 2200.`);
    const tags = (caption.match(/#[\p{L}\p{N}_]+/gu) || []).length;
    if (tags > 30) throw new BadRequestException(`Caption has ${tags} hashtags; Instagram allows 30.`);
  }

  /** Reels don't need the image host — only the token + account id. */
  reelMissing(): string[] {
    return this.missing().filter(m => m !== 'IMGBB_API_KEY');
  }

  publishReel(input: ReelInput): Promise<PublishResult> {
    const key = `reel:${input.requestId}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const p = this.doPublishReel(input);
    this.inFlight.set(key, p);
    p.catch(() => this.inFlight.delete(key));
    return p;
  }

  /**
   * Reel: official resumable upload (the MP4 goes straight to Meta — no third-party host). If that route is refused,
   * fall back to a temporary public link (litterbox.catbox.moe, auto-deleted after 1 hour) that Instagram downloads.
   */
  private async doPublishReel(input: ReelInput): Promise<PublishResult> {
    const missing = this.reelMissing();
    if (missing.length) throw new ServiceUnavailableException(`Instagram posting isn't set up: add ${missing.join(', ')} to backend/.env`);
    if (!input.requestId || input.requestId.length > 100) throw new BadRequestException('requestId is required');
    if (!input.video?.length) throw new BadRequestException('No video to post');
    if (input.video.length > MAX_REEL_BYTES) throw new BadRequestException('Reels must be under 300 MB');
    if (input.video.subarray(4, 8).toString('latin1') !== 'ftyp') throw new BadRequestException('The Reel must be an MP4 video');
    this.validateCaption(input.caption);
    const done = await this.prisma.instagramPost.findUnique({ where: { requestId: input.requestId } });
    if (done) return { mediaId: done.mediaId, permalink: done.permalink, postId: done.id };
    await this.refreshTokenIfDue();

    const base = { media_type: 'REELS', caption: input.caption, share_to_feed: input.shareToFeed === false ? 'false' : 'true' };
    let creationId: string | null = null;
    let via = 'direct upload';
    try {
      const c = await this.graph<{ id: string; uri?: string }>('POST', `${this.userId}/media`, { ...base, upload_type: 'resumable' });
      const uploadUrl = c.uri || `https://rupload.facebook.com/ig-api-upload/${this.version}/${c.id}`;
      const res = await this.fetchImpl(uploadUrl, {
        method: 'POST',
        headers: { Authorization: `OAuth ${this.token()}`, offset: '0', file_size: String(input.video.length) },
        body: new Uint8Array(input.video),
        signal: AbortSignal.timeout(10 * 60000),
      });
      const body: any = await res.json().catch(() => ({}));
      if (!res.ok || body?.success === false || body?.error) throw new Error(body?.error?.message || body?.debug_info?.message || `upload HTTP ${res.status}`);
      creationId = c.id;
    } catch (err: any) {
      if (/token|permission|rate limit/i.test(err?.message || '')) throw err; // the fallback can't fix these
      this.logger.warn(`[Instagram] Resumable Reel upload refused (${err?.message}); using a temporary link instead.`);
    }
    if (!creationId) {
      via = 'temporary link';
      const url = await this.hostVideo(input.video);
      creationId = (await this.graph<{ id: string }>('POST', `${this.userId}/media`, { ...base, video_url: url })).id;
    }
    await this.waitForContainer(creationId, 90, 4000); // up to 6 minutes of processing
    const { id: mediaId } = await this.graph<{ id: string }>('POST', `${this.userId}/media_publish`, { creation_id: creationId });
    let permalink: string | null = null;
    try {
      permalink = (await this.graph<{ permalink?: string }>('GET', mediaId, { fields: 'permalink' })).permalink || null;
    } catch {}
    const row = await this.prisma.instagramPost.create({
      data: { requestId: input.requestId, releaseId: input.releaseId || null, kind: input.kind.includes('reel') ? input.kind : `${input.kind}-reel`, mediaId, permalink, caption: input.caption, imageCount: 1 },
    });
    this.logger.log(`[Instagram] Published Reel (${(input.video.length / 1e6).toFixed(1)} MB via ${via}) → ${permalink || mediaId}`);
    return { mediaId, permalink, postId: row.id };
  }

  /** Fallback only: 1-hour public link for Instagram to download the MP4 from (litterbox.catbox.moe, free, no key). */
  private async hostVideo(buf: Buffer): Promise<string> {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('time', '1h');
    form.append('fileToUpload', new Blob([new Uint8Array(buf)], { type: 'video/mp4' }), `reel-${Date.now()}.mp4`);
    let res: Response;
    try {
      res = await this.fetchImpl('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: form, signal: AbortSignal.timeout(10 * 60000) });
    } catch (err: any) {
      throw new ServiceUnavailableException(`Couldn't upload the video for Instagram: ${err.message}`);
    }
    const text = (await res.text().catch(() => '')).trim();
    if (!res.ok || !/^https:\/\/\S+\.mp4$/.test(text)) throw new ServiceUnavailableException(`Video host error: ${text.slice(0, 120) || `HTTP ${res.status}`}`);
    return text;
  }

  publish(input: PublishInput): Promise<PublishResult> {
    // Same requestId → same outcome, never a second post.
    const existing = this.inFlight.get(input.requestId);
    if (existing) return existing;
    const p = this.doPublish(input);
    this.inFlight.set(input.requestId, p);
    p.catch(() => this.inFlight.delete(input.requestId)); // a failed attempt may be retried
    return p;
  }

  private async doPublish(input: PublishInput): Promise<PublishResult> {
    const missing = this.missing();
    if (missing.length) throw new ServiceUnavailableException(`Instagram posting isn't set up: add ${missing.join(', ')} to backend/.env`);
    this.validate(input);
    const done = await this.prisma.instagramPost.findUnique({ where: { requestId: input.requestId } });
    if (done) return { mediaId: done.mediaId, permalink: done.permalink, postId: done.id };
    await this.refreshTokenIfDue();

    const urls: string[] = [];
    for (let i = 0; i < input.images.length; i++) urls.push(await this.hostImage(input.images[i], `${input.kind}-${Date.now()}-${i + 1}`));

    let creationId: string;
    if (urls.length === 1) {
      creationId = (await this.graph<{ id: string }>('POST', `${this.userId}/media`, { image_url: urls[0], caption: input.caption })).id;
    } else {
      const children: string[] = [];
      for (const u of urls) children.push((await this.graph<{ id: string }>('POST', `${this.userId}/media`, { image_url: u, is_carousel_item: 'true' })).id);
      for (const c of children) await this.waitForContainer(c);
      creationId = (await this.graph<{ id: string }>('POST', `${this.userId}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption: input.caption })).id;
    }
    await this.waitForContainer(creationId);
    const { id: mediaId } = await this.graph<{ id: string }>('POST', `${this.userId}/media_publish`, { creation_id: creationId });

    let permalink: string | null = null;
    try {
      permalink = (await this.graph<{ permalink?: string }>('GET', mediaId, { fields: 'permalink' })).permalink || null;
    } catch {}
    const row = await this.prisma.instagramPost.create({
      data: { requestId: input.requestId, releaseId: input.releaseId || null, kind: input.kind, mediaId, permalink, caption: input.caption, imageCount: urls.length },
    });
    this.logger.log(`[Instagram] Published ${input.kind} (${urls.length} image(s)) → ${permalink || mediaId}`);
    return { mediaId, permalink, postId: row.id };
  }

  posts(releaseId?: string) {
    return this.prisma.instagramPost.findMany({ where: releaseId ? { releaseId } : {}, orderBy: { createdAt: 'desc' }, take: 50 });
  }
}
