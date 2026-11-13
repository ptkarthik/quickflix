import { Module } from '@nestjs/common';
import { ResearchModule } from '../research/research.module';
import { MediaModule } from '../media/media.module';
import { OttController } from './ott.controller';
import { OttService } from './ott.service';
import { NewsCollectorService } from './news-collector.service';
import { OfficialYoutubeCollector } from './official-youtube.collector';
import { TmdbOttCollector } from './tmdb-ott.collector';
import { OttMediaService } from './ott-media.service';
import { InstagramService } from './instagram.service';
import { OttAiService } from './ott-ai.service';

@Module({
  imports: [ResearchModule, MediaModule], // for TmdbProvider (title search)
  controllers: [OttController],
  providers: [OttService, NewsCollectorService, OfficialYoutubeCollector, TmdbOttCollector, OttMediaService, InstagramService, OttAiService],
  exports: [OttService, OttMediaService, OttAiService, InstagramService],
})
export class OttModule {}
