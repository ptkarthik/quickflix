import { Controller, Get, Post, Query } from '@nestjs/common';
import { TrendsService } from './trends.service';

@Controller('trends')
export class TrendsController {
  constructor(private readonly trends: TrendsService) {}

  /** GET /trends?scope=tn|india|all&category=…&sensitive=true */
  @Get()
  list(@Query() q: { scope?: string; category?: string; sensitive?: string }) {
    return this.trends.list(q);
  }

  /** Fetch the feeds again now. */
  @Post('refresh')
  async refresh() {
    await this.trends.refresh();
    return this.trends.list({});
  }
}
