import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Idempotent, PostedResult, isJpeg, isMp4 } from './publish.util';

/**
 * Facebook Page posting through Meta's official Graph API (free). Files are uploaded directly — no image host needed.
 *
 * backend/.env:
 *   FB_PAGE_ID     your Facebook Page's id
 *   FB_PAGE_TOKEN  a Page access token with pages_manage_posts + pages_read_engagement
 *                  (a Page token made from a long-lived user token never expires)
 * Optional: FB_GRAPH_VERSION (default v23.0)
 */
@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);
  private readonly once = new Idempotent();
  fetchImpl: typeof fetch = (...a) => fetch(...a);
  sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  constructor(private readonly prisma: PrismaService) {}

  private get v() {
    return process.env.FB_GRAPH_VERSION || 'v23.0';
  }
  private get page() {
    return process.env.FB_PAGE_ID?.trim() || '';
  }
  private get token() {
    return process.env.FB_PAGE_TOKEN?.trim() || '';
  }
  missing() {
    return [!this.page && 'FB_PAGE_ID', !this.token && 'FB_PAGE_TOKEN'].filter(Boolean) as string[];
  }

  private async call<T = any>(url: string, init: RequestInit = {}, host = 'graph.facebook.com'): Promise<T> {
    const full = url.startsWith('http') ? url : `https://${host}/${this.v}/${url}`;
    let res: Response;
    try {
      res = await this.fetchImpl(full, { ...init, signal: AbortSignal.timeout(180000) });
    } catch (e: any) {
      throw new ServiceUnavailableException(`Couldn't reach Facebook: ${e.message}`);
    }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || body?.error) {
      const e = body?.error || {};
      const hint =
        e.code === 190 ? ' — the Page token is invalid or expired; make a new one (see setup).' :
        e.code === 200 || e.code === 10 ? ' — the token is missing pages_manage_posts (or you are not an admin of the Page).' :
        e.code === 368 ? ' — Facebook temporarily blocked posting from this Page; try later.' :
        e.code === 4 || e.code === 32 ? ' — Facebook rate limit; try later.' : '';
      throw new BadRequestException(`Facebook: ${e.error_user_msg || e.message || `HTTP ${res.status}`}${hint}`);
    }
    return body as T;
  }
  private form(fields: Record<string, string>, file?: { name: string; buf: Buffer; type: string }) {
    const f = new FormData();
    f.append('access_token', this.token);
    for (const [k, v] of Object.entries(fields)) f.append(k, v);
    if (file) f.append('source', new Blob([new Uint8Array(file.buf)], { type: file.type }), file.name);
    return f;
  }

  async status() {
    const missing = this.missing();
    if (missing.length) return { configured: false, missing };
    try {
      const p = await this.call<{ name?: string; link?: string }>(`${this.page}?fields=name,link&access_token=${encodeURIComponent(this.token)}`);
      const posted24h = await this.prisma.socialPost.count({ where: { channel: 'facebook', createdAt: { gte: new Date(Date.now() - 86400000) } } });
      return { configured: true, missing: [], name: p.name || null, link: p.link || null, postedLast24h: posted24h };
    } catch (e: any) {
      return { configured: false, missing: [], error: e.message };
    }
  }

  private async permalink(id: string) {
    try {
      return (await this.call<{ permalink_url?: string }>(`${id}?fields=permalink_url&access_token=${encodeURIComponent(this.token)}`)).permalink_url || null;
    } catch {
      return null;
    }
  }

  private ready() {
    const m = this.missing();
    if (m.length) throw new ServiceUnavailableException(`Facebook posting isn't set up: add ${m.join(', ')} to backend/.env`);
  }

  /** One photo, or several photos in one post (up to 10). */
  photos(input: { images: Buffer[]; caption: string; kind: string; releaseId?: string | null; requestId: string }): Promise<PostedResult> {
    return this.once.run(input.requestId, async () => {
      this.ready();
      if (!input.images.length) throw new BadRequestException('No image to post');
      if (input.images.length > 10) throw new BadRequestException('Facebook: at most 10 photos per post here.');
      if (input.images.some(b => !isJpeg(b))) throw new BadRequestException('Images must be JPEG');
      const done = await this.prisma.socialPost.findUnique({ where: { requestId: input.requestId } });
      if (done) return { externalId: done.externalId, permalink: done.permalink, postId: done.id };

      let postId: string;
      if (input.images.length === 1) {
        const r = await this.call<{ id: string; post_id?: string }>(`${this.page}/photos`, { method: 'POST', body: this.form({ message: input.caption, published: 'true' }, { name: 'post.jpg', buf: input.images[0], type: 'image/jpeg' }) });
        postId = r.post_id || r.id;
      } else {
        const ids: string[] = [];
        for (let i = 0; i < input.images.length; i++) {
          const r = await this.call<{ id: string }>(`${this.page}/photos`, { method: 'POST', body: this.form({ published: 'false' }, { name: `slide-${i + 1}.jpg`, buf: input.images[i], type: 'image/jpeg' }) });
          ids.push(r.id);
        }
        const fields: Record<string, string> = { message: input.caption };
        ids.forEach((id, i) => (fields[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
        postId = (await this.call<{ id: string }>(`${this.page}/feed`, { method: 'POST', body: this.form(fields) })).id;
      }
      const permalink = await this.permalink(postId);
      const row = await this.prisma.socialPost.create({
        data: { requestId: input.requestId, channel: 'facebook', format: input.images.length > 1 ? 'carousel' : 'photo', releaseId: input.releaseId || null, kind: input.kind, externalId: postId, permalink, caption: input.caption, mediaCount: input.images.length },
      });
      this.logger.log(`[Facebook] Posted ${input.images.length} photo(s) → ${permalink || postId}`);
      return { externalId: postId, permalink, postId: row.id };
    });
  }

  /** A Reel on the Page (Reels API: start → upload → finish). 9:16, 3–90 s. */
  reel(input: { video: Buffer; caption: string; kind: string; releaseId?: string | null; requestId: string }): Promise<PostedResult> {
    return this.once.run(input.requestId, async () => {
      this.ready();
      if (!isMp4(input.video)) throw new BadRequestException('The Reel must be an MP4 video.');
      const done = await this.prisma.socialPost.findUnique({ where: { requestId: input.requestId } });
      if (done) return { externalId: done.externalId, permalink: done.permalink, postId: done.id };

      const start = await this.call<{ video_id: string; upload_url?: string }>(`${this.page}/video_reels`, { method: 'POST', body: this.form({ upload_phase: 'start' }) });
      const uploadUrl = start.upload_url || `https://rupload.facebook.com/video-upload/${this.v}/${start.video_id}`;
      await this.call(uploadUrl, {
        method: 'POST',
        headers: { Authorization: `OAuth ${this.token}`, offset: '0', file_size: String(input.video.length), 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(input.video),
      });
      await this.call(`${this.page}/video_reels`, { method: 'POST', body: this.form({ upload_phase: 'finish', video_id: start.video_id, video_state: 'PUBLISHED', description: input.caption }) });
      // Facebook processes the video for a while; the link works once it's done.
      let permalink: string | null = null;
      for (let i = 0; i < 6 && !permalink; i++) {
        await this.sleep(5000);
        permalink = await this.permalink(start.video_id);
      }
      const row = await this.prisma.socialPost.create({
        data: { requestId: input.requestId, channel: 'facebook', format: 'reel', releaseId: input.releaseId || null, kind: input.kind, externalId: start.video_id, permalink, caption: input.caption, mediaCount: 1 },
      });
      this.logger.log(`[Facebook] Reel uploaded → ${permalink || start.video_id}`);
      return { externalId: start.video_id, permalink, postId: row.id };
    });
  }
}
