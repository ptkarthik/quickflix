import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { Idempotent, PostedResult, isMp4, youtubeMeta } from './publish.util';

/**
 * YouTube Shorts uploads through the official YouTube Data API v3 (free: 10,000 quota units a day, an upload costs 1,600
 * → about 6 uploads a day).
 *
 * backend/.env:
 *   YT_CLIENT_ID, YT_CLIENT_SECRET   an OAuth client ("Web application") from Google Cloud Console with the redirect URI
 *                                    http://localhost:3000/publish/youtube/callback
 * Then click "Connect YouTube" once; the refresh token is kept in backend/data/youtube-token.json (git-ignored).
 */
const TOKEN_FILE = path.join(process.cwd(), 'data', 'youtube-token.json');
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private readonly once = new Idempotent();
  private access?: { token: string; until: number };
  private states = new Map<string, number>();
  fetchImpl: typeof fetch = (...a) => fetch(...a);

  constructor(private readonly prisma: PrismaService) {}

  private get clientId() {
    return process.env.YT_CLIENT_ID?.trim() || '';
  }
  private get secret() {
    return process.env.YT_CLIENT_SECRET?.trim() || '';
  }
  redirectUri() {
    return `${(process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '')}/publish/youtube/callback`;
  }
  missing() {
    return [!this.clientId && 'YT_CLIENT_ID', !this.secret && 'YT_CLIENT_SECRET'].filter(Boolean) as string[];
  }
  private saved(): { refresh_token: string; channel?: string } | null {
    try {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    } catch {
      return null;
    }
  }

  /** Google consent page URL (state protects the callback). */
  connectUrl() {
    const m = this.missing();
    if (m.length) throw new ServiceUnavailableException(`YouTube isn't set up: add ${m.join(', ')} to backend/.env`);
    const state = randomBytes(16).toString('hex');
    this.states.set(state, Date.now());
    const q = new URLSearchParams({
      client_id: this.clientId, redirect_uri: this.redirectUri(), response_type: 'code', scope: SCOPES.join(' '),
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }

  async callback(code?: string, state?: string, error?: string) {
    if (error) throw new BadRequestException(`Google: ${error}`);
    const at = state ? this.states.get(state) : undefined;
    if (!at || Date.now() - at > 15 * 60000) throw new BadRequestException('This sign-in link expired — click “Connect YouTube” again.');
    this.states.delete(state!);
    const res = await this.fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: code || '', client_id: this.clientId, client_secret: this.secret, redirect_uri: this.redirectUri(), grant_type: 'authorization_code' }).toString(),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || !body.refresh_token) throw new BadRequestException(`Google sign-in failed: ${body.error_description || body.error || `HTTP ${res.status}`}`);
    this.access = { token: body.access_token, until: Date.now() + (body.expires_in - 60) * 1000 };
    const channel = await this.channel().catch(() => null);
    fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ refresh_token: body.refresh_token, channel: channel?.title || null }));
    return channel?.title || 'your channel';
  }

  disconnect() {
    try {
      fs.unlinkSync(TOKEN_FILE);
    } catch {}
    this.access = undefined;
    return { disconnected: true };
  }

  private async accessToken() {
    if (this.access && Date.now() < this.access.until) return this.access.token;
    const s = this.saved();
    if (!s?.refresh_token) throw new ServiceUnavailableException('YouTube isn’t connected — click “Connect YouTube”.');
    const res = await this.fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.clientId, client_secret: this.secret, refresh_token: s.refresh_token, grant_type: 'refresh_token' }).toString(),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || !body.access_token) {
      throw new ServiceUnavailableException(
        body.error === 'invalid_grant'
          ? 'YouTube sign-in expired — click “Connect YouTube” again. (If this happens every 7 days, set your Google OAuth app to “In production”.)'
          : `YouTube: ${body.error_description || body.error || `HTTP ${res.status}`}`,
      );
    }
    this.access = { token: body.access_token, until: Date.now() + (body.expires_in - 60) * 1000 };
    return this.access.token;
  }

  private async channel() {
    const token = await this.accessToken();
    const res = await this.fetchImpl('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: `Bearer ${token}` } });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new BadRequestException(`YouTube: ${body.error?.message || `HTTP ${res.status}`}`);
    const c = body.items?.[0];
    if (!c) throw new BadRequestException('This Google account has no YouTube channel yet — create one on youtube.com first.');
    return { id: c.id as string, title: c.snippet?.title as string };
  }

  async status() {
    const missing = this.missing();
    if (missing.length) return { configured: false, connected: false, missing };
    if (!this.saved()) return { configured: true, connected: false, missing: [] };
    try {
      const c = await this.channel();
      const today = await this.prisma.socialPost.count({ where: { channel: 'youtube', createdAt: { gte: new Date(Date.now() - 86400000) } } });
      return { configured: true, connected: true, missing: [], channel: c.title, postedLast24h: today, dailyLimit: 6 };
    } catch (e: any) {
      return { configured: true, connected: false, missing: [], error: e.message };
    }
  }

  /** Upload a vertical video (≤ 3 min) — YouTube files it as a Short. Resumable upload, one request for the bytes. */
  short(input: { video: Buffer; title: string; description: string; tags?: string[]; privacy: string; kind: string; releaseId?: string | null; requestId: string }): Promise<PostedResult> {
    return this.once.run(input.requestId, async () => {
      if (!isMp4(input.video)) throw new BadRequestException('The Short must be an MP4 video.');
      const privacy = ['public', 'unlisted', 'private'].includes(input.privacy) ? input.privacy : 'public';
      const done = await this.prisma.socialPost.findUnique({ where: { requestId: input.requestId } });
      if (done) return { externalId: done.externalId, permalink: done.permalink, postId: done.id };
      const token = await this.accessToken();
      const meta = youtubeMeta(input);
      const init = await this.fetchImpl('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(input.video.length) },
        body: JSON.stringify({
          snippet: { title: meta.title, description: meta.description, tags: meta.tags, categoryId: '24' /* Entertainment */ },
          status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
        }),
      });
      if (!init.ok) {
        const b: any = await init.json().catch(() => ({}));
        const reason = b.error?.errors?.[0]?.reason;
        throw new BadRequestException(`YouTube: ${b.error?.message || `HTTP ${init.status}`}${reason === 'quotaExceeded' ? ' — today’s free upload quota is used up (about 6 uploads a day); try tomorrow.' : ''}`);
      }
      const location = init.headers.get('location');
      if (!location) throw new ServiceUnavailableException('YouTube didn’t return an upload address.');
      const up = await this.fetchImpl(location, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(input.video.length) }, body: new Uint8Array(input.video), signal: AbortSignal.timeout(600000) });
      const video: any = await up.json().catch(() => ({}));
      if (!up.ok || !video.id) throw new BadRequestException(`YouTube upload failed: ${video.error?.message || `HTTP ${up.status}`}`);
      const permalink = `https://youtube.com/shorts/${video.id}`;
      const row = await this.prisma.socialPost.create({
        data: { requestId: input.requestId, channel: 'youtube', format: 'short', releaseId: input.releaseId || null, kind: input.kind, externalId: video.id, permalink, caption: `${meta.title}\n\n${meta.description}`, mediaCount: 1 },
      });
      this.logger.log(`[YouTube] Short uploaded (${privacy}) → ${permalink}`);
      return { externalId: video.id, permalink, postId: row.id };
    });
  }
}
