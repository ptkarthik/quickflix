import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ExtrasService } from './extras.service';

/** One-liners & ratings for posts on every desk: /extras/{ott|cinema|world}/{id} */
@Controller('extras')
export class ExtrasController {
  constructor(private readonly extras: ExtrasService) {}

  /** Is this link a licensed source? (known platforms / your approved official YouTube channels) */
  @Post('where/check-link')
  checkLink(@Body() body: { url?: string }) {
    return this.extras.checkSourceLink(body?.url || '');
  }

  /** Where to watch in India, re-checked live (cached 12h): stream / free / rent / buy / official free uploads. */
  @Get(':domain/:id/where')
  where(@Param('domain') domain: string, @Param('id') id: string, @Query('force') force?: string) {
    return this.extras.whereToWatch(domain, id, force === 'true');
  }

  @Post(':domain/batch')
  batch(@Param('domain') domain: string, @Body() body: { ids: string[] }) {
    return this.extras.batch(domain, body?.ids || []);
  }

  @Get(':domain/:id')
  get(@Param('domain') domain: string, @Param('id') id: string) {
    return this.extras.get(domain, id);
  }

  @Patch(':domain/:id')
  update(@Param('domain') domain: string, @Param('id') id: string, @Body() body: Record<string, any>) {
    return this.extras.update(domain, id, body || {});
  }

  /** Critics' ratings & one-liners from the web (Bing News → each critic's page, Wikipedia "Critical response"). */
  @Post(':domain/:id/critics')
  critics(@Param('domain') domain: string, @Param('id') id: string, @Query('force') force?: string) {
    return this.extras.criticReviews(domain, id, force === 'true');
  }

  /** Look up tagline / plot / awards / Wikipedia line and IMDb, Rotten Tomatoes, Metacritic, TMDB ratings. */
  @Post(':domain/:id/lookup')
  lookup(@Param('domain') domain: string, @Param('id') id: string, @Query('force') force?: string) {
    return this.extras.lookup(domain, id, force === 'true');
  }

  @Post(':domain/:id/ai-oneliners')
  ai(@Param('domain') domain: string, @Param('id') id: string, @Body() body: { language?: string; tone?: string }) {
    return this.extras.aiOneLiners(domain, id, body || {});
  }
}
