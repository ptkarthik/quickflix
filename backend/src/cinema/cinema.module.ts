import { Module } from '@nestjs/common';
import { CinemaController } from './cinema.controller';
import { CinemaService } from './cinema.service';
import { CinemaCollectors } from './cinema-collectors';
import { MediaModule } from '../media/media.module';
import { OttModule } from '../ott/ott.module';

@Module({
  imports: [MediaModule, OttModule], // OttModule: shared image search + AI text for posts
  controllers: [CinemaController],
  providers: [CinemaService, CinemaCollectors],
  exports: [CinemaService],
})
export class CinemaModule {}
