import { Module } from '@nestjs/common';
import { FacebookService } from './facebook.service';
import { PublishController } from './publish.controller';
import { YoutubeService } from './youtube.service';

@Module({
  controllers: [PublishController],
  providers: [FacebookService, YoutubeService],
})
export class PublishModule {}
