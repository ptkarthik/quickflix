import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ResearchService } from './research.service';

@Controller('projects/:id/research')
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  @Get('search')
  async search(@Param('id') id: string) {
    return this.researchService.search(id);
  }

  @Post()
  async linkAndFetch(@Param('id') id: string, @Body() body: { tmdbId: string | number }) {
    return this.researchService.linkAndFetch(id, body.tmdbId);
  }
}
