import { Controller, Get, Post, Query } from '@nestjs/common';
import { OnThisDayService } from './onthisday.service';

@Controller('onthisday')
export class OnThisDayController {
  constructor(private readonly svc: OnThisDayService) {}

  /** GET /onthisday?date=YYYY-MM-DD → birthdays, remembering, film anniversaries (ready=false while it's being prepared). */
  @Get()
  get(@Query('date') date?: string) {
    return this.svc.get(date);
  }

  /** POST /onthisday/refresh?date=YYYY-MM-DD → fetch that day again from Wikidata + TMDB. */
  @Post('refresh')
  refresh(@Query('date') date?: string) {
    return this.svc.refresh(date);
  }
}
