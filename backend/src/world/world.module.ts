import { Module } from '@nestjs/common';
import { OttModule } from '../ott/ott.module';
import { WorldController } from './world.controller';
import { WorldService } from './world.service';
import { ImdbDatasetService } from './imdb-dataset.service';

@Module({
  imports: [OttModule], // shared image search + AI text for posts
  controllers: [WorldController],
  providers: [WorldService, ImdbDatasetService],
  exports: [ImdbDatasetService, WorldService],
})
export class WorldModule {}
