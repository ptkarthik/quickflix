import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CinemaService } from './cinema.service';
import type { CinemaInput, CinemaStatus } from './cinema.service';
import { OttMediaService } from '../ott/ott-media.service';
import { OttAiService } from '../ott/ott-ai.service';
import type { CaptionCopyInput } from '../ott/ott-ai.service';

@Controller('cinema')
export class CinemaController {
  constructor(
    private readonly cinema: CinemaService,
    private readonly media: OttMediaService,
    private readonly ai: OttAiService,
  ) {}

  /** Picture choices for a film post: exact TMDB art, official trailer thumbnails, web results. ?q= overrides the web search. */
  @Get('releases/:id/images')
  images(@Param('id') id: string, @Query('q') q?: string) {
    return this.media.imageOptions(id, q, 'cinema');
  }

  /** Optional AI draft of your review text (never the rating). */
  @Post('releases/:id/draft-review')
  draftReview(@Param('id') id: string, @Body() body: { rating?: number | null; notes?: string; tone?: string }) {
    return this.ai.draftReview(id, body || {}, 'cinema');
  }

  /** Optional AI caption lines for cinema posts. Facts (title, date, languages) are added by the app. */
  @Post('ai/caption')
  aiCaption(@Body() body: CaptionCopyInput) {
    return this.ai.captionCopy({ ...(body || ({} as CaptionCopyInput)), domain: 'cinema' });
  }

  /** GET /cinema/releases?status=APPROVED&from=…&to=…&language=ta,te&trust=CONFIRMED */
  @Get('releases')
  list(@Query('status') status?: string, @Query('trust') trust?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('language') language?: string) {
    return this.cinema.list({ status, trust, from, to, language });
  }

  @Get('counts')
  counts() {
    return this.cinema.counts();
  }

  @Post('releases')
  create(@Body() body: CinemaInput) {
    return this.cinema.createManual(body);
  }

  @Post('releases/approve-confirmed')
  approveConfirmed() {
    return this.cinema.approveConfirmed();
  }

  @Post('releases/bulk-status')
  bulkStatus(@Body() body: { ids: string[]; status: CinemaStatus }) {
    return this.cinema.bulkStatus(body.ids || [], body.status);
  }

  @Patch('releases/:id')
  update(@Param('id') id: string, @Body() body: CinemaInput) {
    return this.cinema.update(id, body);
  }

  @Delete('releases/:id')
  remove(@Param('id') id: string) {
    return this.cinema.remove(id);
  }

  /** Re-check TMDB, Wikipedia, official channels and news now. */
  @Post('collect')
  collect() {
    return this.cinema.collect();
  }

  @Get('collect/status')
  status() {
    return this.cinema.getStatus();
  }
}
