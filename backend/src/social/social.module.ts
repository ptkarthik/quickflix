import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { PublishingService } from './publishing.service';

@Module({
  controllers: [SocialController],
  providers: [SocialService, PublishingService],
  exports: [SocialService, PublishingService]
})
export class SocialModule {}
