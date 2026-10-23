import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ResearchService } from './research.service';
import { CreativeStudioService } from '../creative/creative.service';

@Controller('discover')
export class DiscoverController {
  constructor(
    private readonly researchService: ResearchService,
    private readonly creativeStudioService: CreativeStudioService
  ) {}

  @Get('upcoming-ott')
  async getUpcomingOtt() {
    return this.researchService.getUpcomingOttIndia();
  }

  @Get('all')
  async getAll() {
    return this.researchService.discoverAll();
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
