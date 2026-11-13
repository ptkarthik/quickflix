import { Body, Controller, Post } from '@nestjs/common';
import { AiPosterService } from './ai-poster.service';
import type { AiPosterInput } from './ai-poster.service';
import { GenreService } from './genre.service';

@Controller('media')
export class MediaController {
  constructor(
    private readonly ai: AiPosterService,
    private readonly genres: GenreService,
  ) {}

  /** ✨ AI poster artwork for an approved OTT/cinema title (paid Gemini image calls — only on click). */
  @Post('ai-poster')
  aiPoster(@Body() body: AiPosterInput) {
    return this.ai.generate(body || ({} as AiPosterInput));
  }

  /** Fill missing genres now (also runs automatically after each collect). */
  @Post('genres/backfill')
  backfill() {
    return this.genres.backfill(400);
  }
}
