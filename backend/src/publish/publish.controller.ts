import { BadRequestException, Body, Controller, Get, Header, Post, Query, Res, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from './facebook.service';
import { YoutubeService } from './youtube.service';
import { hashtagsOf } from './publish.util';

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3001';
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const page = (title: string, text: string, ok: boolean) =>
  `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><body style="font-family:system-ui;background:#0a0a0c;color:#e2e8f0;display:grid;place-items:center;height:100vh;margin:0">` +
  `<div style="max-width:440px;text-align:center"><h2 style="color:${ok ? '#34d399' : '#f87171'}">${esc(title)}</h2><p>${esc(text)}</p><p><a style="color:#818cf8" href="${FRONTEND}">Back to CineAI Studio</a> — or just close this tab.</p></div>` +
  `<script>try{window.opener&&window.opener.postMessage('youtube-connected','*')}catch(e){}</script></body>`;

/** Facebook Page + YouTube publishing (Instagram lives in /ott/instagram/*). Every post is your click, behind a confirm dialog. */
@Controller('publish')
export class PublishController {
  constructor(
    private readonly facebook: FacebookService,
    private readonly youtube: YoutubeService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  async status() {
    const [facebook, youtube] = await Promise.all([this.facebook.status(), this.youtube.status()]);
    return { facebook, youtube };
  }

  /** multipart: images[] (1 = photo, 2–10 = multi-photo post), caption, kind, releaseId, requestId */
  @Post('facebook/photos')
  @UseInterceptors(FilesInterceptor('images', 10, { limits: { fileSize: 10 * 1024 * 1024 } }))
  fbPhotos(@UploadedFiles() files: Array<{ buffer: Buffer }>, @Body() b: { caption?: string; kind?: string; releaseId?: string; requestId?: string }) {
    if (!files?.length) throw new BadRequestException('No image to post');
    return this.facebook.photos({ images: files.map(f => f.buffer), caption: b.caption || '', kind: b.kind || 'single', releaseId: b.releaseId || null, requestId: b.requestId || '' });
  }

  /** multipart: video (the Reel MP4), caption, kind, releaseId, requestId */
  @Post('facebook/reel')
  @UseInterceptors(FileInterceptor('video', { limits: { fileSize: 200 * 1024 * 1024 } }))
  fbReel(@UploadedFile() file: { buffer: Buffer } | undefined, @Body() b: { caption?: string; kind?: string; releaseId?: string; requestId?: string }) {
    if (!file) throw new BadRequestException('No video');
    return this.facebook.reel({ video: file.buffer, caption: b.caption || '', kind: b.kind || 'reel', releaseId: b.releaseId || null, requestId: b.requestId || '' });
  }

  /** multipart: video, title, description, privacy (public|unlisted|private), kind, releaseId, requestId */
  @Post('youtube/short')
  @UseInterceptors(FileInterceptor('video', { limits: { fileSize: 200 * 1024 * 1024 } }))
  ytShort(@UploadedFile() file: { buffer: Buffer } | undefined, @Body() b: { title?: string; description?: string; privacy?: string; kind?: string; releaseId?: string; requestId?: string }) {
    if (!file) throw new BadRequestException('No video');
    const description = b.description || '';
    return this.youtube.short({ video: file.buffer, title: b.title || '', description, tags: hashtagsOf(description), privacy: b.privacy || 'public', kind: b.kind || 'short', releaseId: b.releaseId || null, requestId: b.requestId || '' });
  }

  /** Opens Google's consent page (one time). */
  @Get('youtube/connect')
  connect(@Res() res: Response) {
    try {
      res.redirect(this.youtube.connectUrl());
    } catch (e: any) {
      res.status(400).type('html').send(page('YouTube isn’t set up yet', e.message, false));
    }
  }

  @Get('youtube/callback')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async callback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string) {
    try {
      const channel = await this.youtube.callback(code, state, error);
      return page('YouTube connected', `Shorts will be uploaded to “${channel}”.`, true);
    } catch (e: any) {
      return page('YouTube not connected', e.message, false);
    }
  }

  @Post('youtube/disconnect')
  disconnect() {
    return this.youtube.disconnect();
  }

  /** Earlier Facebook / YouTube posts (for the “already posted” warning). */
  @Get('posts')
  posts(@Query('releaseId') releaseId?: string, @Query('channel') channel?: string) {
    return this.prisma.socialPost.findMany({ where: { ...(releaseId ? { releaseId } : {}), ...(channel ? { channel } : {}) }, orderBy: { createdAt: 'desc' }, take: 50 });
  }
}
