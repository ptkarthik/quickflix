import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { AiPosterService } from './ai-poster.service';
import { GenreService } from './genre.service';

@Module({
  controllers: [MediaController],
  providers: [AiPosterService, GenreService],
  exports: [GenreService],
})
export class MediaModule {}
