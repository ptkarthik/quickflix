import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { WorldService } from './world.service';
import { ImdbDatasetService } from './imdb-dataset.service';
import type { ScanInput, WorldFilter, WorldStatus } from './world.service';
import type { WorldKind } from './world.util';
import { OttMediaService } from '../ott/ott-media.service';
import { OttAiService } from '../ott/ott-ai.service';
import type { CaptionCopyInput } from '../ott/ott-ai.service';

@Controller('world')
export class WorldController {
  constructor(
    private readonly world: WorldService,
    private readonly media: OttMediaService,
    private readonly ai: OttAiService,
    private readonly imdb: ImdbDatasetService,
  ) {}

  /** GET /world/titles?kind=movie&language=ko&genre=Thriller&minRating=7&minVotes=1000&sort=score&skip=0&take=48 */
  @Get('titles')
  list(@Query() q: WorldFilter & { skip?: string; take?: string }) {
    return this.world.list(q);
  }

  /** POST /world/counts { filters: [...] } → [n, n, …] */
  @Post('counts')
  counts(@Body() body: { filters: WorldFilter[] }) {
    return this.world.counts(body?.filters || []);
  }

  @Get('facets')
  facets(@Query('kind') kind?: string) {
    return this.world.facets(kind);
  }

  @Get('genres')
  genres(@Query('kind') kind: WorldKind) {
    return this.world.genres(kind === 'tv' ? 'tv' : 'movie');
  }

  @Get('titles/:id')
  get(@Param('id') id: string) {
    return this.world.get(id);
  }

  /** Fresh facts from TMDB + IMDb rating from OMDb (when stale, or ?force=true). */
  @Post('titles/:id/refresh')
  refresh(@Param('id') id: string, @Query('force') force?: string) {
    return this.world.refresh(id, { force: force === 'true' });
  }

  @Patch('titles/:id')
  update(@Param('id') id: string, @Body() body: { status?: string; myRating?: number | null; myReview?: string | null; posterPath?: string | null; notes?: string | null }) {
    return this.world.update(id, body || {});
  }

  @Post('titles/bulk-status')
  bulkStatus(@Body() body: { ids?: string[]; filter?: WorldFilter; status: WorldStatus }) {
    return this.world.bulkStatus(body);
  }

  @Get('tmdb-search')
  search(@Query('q') q: string, @Query('kind') kind?: string) {
    return this.world.searchTmdb(q || '', kind);
  }

  /** Add one title you picked from TMDB search (saved as approved). */
  @Post('titles')
  add(@Body() body: { kind: WorldKind; tmdbId: number }) {
    return this.world.add(body);
  }

  @Post('scan')
  scan(@Body() body: ScanInput) {
    return this.world.startScan(body);
  }

  /** POST /world/scan/languages { kinds?, perLanguage?, minVotes?, languages? } — every language TMDB knows. */
  @Post('scan/languages')
  scanLanguages(@Body() body: { kinds?: WorldKind[]; perLanguage?: number; minVotes?: number; languages?: string[] }) {
    return this.world.startLanguageSweep(body || {});
  }

  @Get('languages')
  languages() {
    return this.world.languages();
  }

  /** Data check: what's missing / suspicious, source status, background jobs. */
  @Get('health')
  health() {
    return this.world.health();
  }

  /** Re-download IMDb's daily ratings file now (normally automatic once a day). */
  @Post('imdb-sync')
  imdbSync() {
    this.imdb.sync(true).catch(() => null);
    return { started: true };
  }

  @Get('scan/status')
  scanStatus() {
    return this.world.scan;
  }

  @Post('enrich')
  enrich() {
    return this.world.enrichBatch();
  }

  // ── post tools (shared with the OTT & Cinema desks) ──

  @Get('titles/:id/images')
  images(@Param('id') id: string, @Query('q') q?: string) {
    return this.media.imageOptions(id, q, 'world');
  }

  @Post('titles/:id/draft-review')
  draftReview(@Param('id') id: string, @Body() body: { rating?: number | null; notes?: string; tone?: string }) {
    return this.ai.draftReview(id, body || {}, 'world');
  }

  @Post('ai/caption')
  aiCaption(@Body() body: CaptionCopyInput) {
    return this.ai.captionCopy({ ...(body || ({} as CaptionCopyInput)), domain: 'world' });
  }
}
