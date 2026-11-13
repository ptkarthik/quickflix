import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ResearchService } from './research.service';
import { CreativeStudioService } from '../creative/creative.service';
import { CoverageAuditService } from './services/coverage-audit.service';
import { DiscoveryCacheService } from './services/discovery-cache.service';
import { NowInTheatersAuditService } from './services/now-in-theaters-audit.service';
import { IndianOttRegistryService } from './services/indian-ott-registry.service';

@Controller('discover')
export class DiscoverController {
  constructor(
    private readonly researchService: ResearchService,
    private readonly creativeStudioService: CreativeStudioService,
    private readonly coverageAuditService: CoverageAuditService,
    private readonly discoveryCacheService: DiscoveryCacheService,
    private readonly nowInTheatersAuditService: NowInTheatersAuditService,
    private readonly indianOttRegistry: IndianOttRegistryService
  ) {}

  @Get('upcoming-ott')
  async getUpcomingOtt() {
    return this.researchService.getUpcomingOttIndia();
  }

  @Get('indian-ott/audit')
  async getIndianOttAudit() {
    return this.indianOttRegistry.getIngestionAudit();
  }

  @Get('all')
  async getAll() {
    return this.researchService.discoverAll();
  }

  @Get('cache-status')
  async getCacheStatus() {
    return this.discoveryCacheService.getStatus();
  }

  @Get('coverage-audit')
  async getCoverageAudit() {
    return this.coverageAuditService.runAudit();
  }

  @Get('now-in-theaters/audit')
  async getNowInTheatersAudit() {
    return this.nowInTheatersAuditService.runAudit();
  }

  @Get('movie/:id')
  async getMovieDetails(@Param('id') id: string) {
    return this.researchService.getMovieDetails(id);
  }

  @Post('generate-poster')
  async generatePosterConcepts(@Body() body: { canonicalMovieId: string, tmdbId: string, title: string, movieData: any, manualRating?: number, usedCandidateIds?: string[], forceDeepSearch?: boolean }) {
    return this.creativeStudioService.buildCreativeStudioPayload(
        body.canonicalMovieId || body.movieData?.canonicalId || body.movieData?.id, 
        body.tmdbId || body.movieData?.tmdbId || body.movieData?.id, 
        body.title || body.movieData?.title, 
        body.movieData, 
        body.manualRating, 
        body.usedCandidateIds || [],
        '',
        body.forceDeepSearch
    );
  }
}
