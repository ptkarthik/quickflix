import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { OttService } from './ott.service';
import { OttMediaService } from './ott-media.service';
import { InstagramService } from './instagram.service';
import { OttAiService } from './ott-ai.service';
import type { CaptionCopyInput } from './ott-ai.service';
import type { OttReleaseInput, OttStatus } from './ott.service';

@Controller('ott')
export class OttController {
  constructor(
    private readonly ott: OttService,
    private readonly media: OttMediaService,
    private readonly instagram: InstagramService,
    private readonly ai: OttAiService,
  ) {}

  /** GET /ott/releases?status=APPROVED&from=2026-11-10&to=2026-11-16&language=ta,te */
  @Get('releases')
  list(
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('language') language?: string,
    @Query('trust') trust?: string,
  ) {
    return this.ott.list({ status, from, to, language, trust });
  }

  /** One click: approve every pending item whose facts are CONFIRMED. */
  @Post('releases/approve-confirmed')
  approveConfirmed() {
    return this.ott.approveConfirmed();
  }

  @Get('counts')
  counts() {
    return this.ott.counts();
  }

  /** Manual entry: trusted, saved as APPROVED. */
  @Post('releases')
  create(@Body() body: OttReleaseInput) {
    return this.ott.createManual(body);
  }

  @Patch('releases/:id')
  update(@Param('id') id: string, @Body() body: OttReleaseInput) {
    return this.ott.update(id, body);
  }

  @Delete('releases/:id')
  remove(@Param('id') id: string) {
    return this.ott.remove(id);
  }

  @Post('releases/bulk-status')
  bulkStatus(@Body() body: { ids: string[]; status: OttStatus }) {
    return this.ott.bulkStatus(body.ids || [], body.status);
  }

  @Post('releases/:id/enrich')
  enrich(@Param('id') id: string, @Query('force') force?: string) {
    return this.ott.enrich(id, force === 'true');
  }

  /** Pull fresh candidates from free sources (Google News RSS + TMDB snapshot) into the review queue. */
  @Post('collect')
  collect() {
    return this.ott.collect();
  }

  @Get('collect/status')
  collectStatus() {
    return this.ott.getCollectStatus();
  }

  @Get('tmdb-search')
  tmdbSearch(@Query('q') q: string) {
    return this.ott.searchTmdb(q || '');
  }

  /** Image choices for a post: exact TMDB art, official trailer thumbnails, web (Bing) results. ?q= overrides the web search. */
  @Get('releases/:id/images')
  images(@Param('id') id: string, @Query('q') q?: string) {
    return this.media.imageOptions(id, q);
  }

  /** Optional AI draft of review text (never the rating). Fails clearly when no working Gemini key is configured. */
  @Post('releases/:id/draft-review')
  draftReview(@Param('id') id: string, @Body() body: { rating?: number | null; notes?: string; tone?: string }) {
    return this.ai.draftReview(id, body || {});
  }

  /** Optional AI caption copy (hook, blurb, teasers, closing). Facts are added by the app, never by the AI. */
  @Post('ai/caption')
  aiCaption(@Body() body: CaptionCopyInput) {
    return this.ai.captionCopy(body || ({} as CaptionCopyInput));
  }

  /** Is direct Instagram posting set up? Which account? */
  @Get('instagram/status')
  instagramStatus() {
    return this.instagram.status();
  }

  /** Publish JPEG(s) to Instagram now. multipart: images[] (1 = single post, 2-10 = carousel), caption, kind, releaseId, requestId. */
  @Post('instagram/publish')
  @UseInterceptors(FilesInterceptor('images', 10, { limits: { fileSize: 8 * 1024 * 1024 } }))
  instagramPublish(
    @UploadedFiles() files: Array<{ buffer: Buffer }>,
    @Body() body: { caption?: string; kind?: string; releaseId?: string; requestId?: string },
  ) {
    if (!files?.length) throw new BadRequestException('No image to post');
    return this.instagram.publish({
      images: files.map(f => f.buffer),
      caption: body.caption || '',
      kind: body.kind || 'single',
      releaseId: body.releaseId || null,
      requestId: body.requestId || '',
    });
  }

  /** Publish a Reel (MP4) to Instagram now. multipart: video, caption, kind, releaseId, requestId, shareToFeed. */
  @Post('instagram/reel')
  @UseInterceptors(FileInterceptor('video', { limits: { fileSize: 300 * 1024 * 1024 } }))
  instagramReel(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body() body: { caption?: string; kind?: string; releaseId?: string; requestId?: string; shareToFeed?: string },
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('No video to post');
    return this.instagram.publishReel({
      video: file.buffer,
      caption: body.caption || '',
      kind: body.kind || 'reel',
      releaseId: body.releaseId || null,
      requestId: body.requestId || '',
      shareToFeed: body.shareToFeed !== 'false',
    });
  }

  @Get('instagram/posts')
  instagramPosts(@Query('releaseId') releaseId?: string) {
    return this.instagram.posts(releaseId);
  }
}
