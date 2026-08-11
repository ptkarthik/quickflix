import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { ContentGeneratorService } from './content-generator.service';
import { AiController } from './ai.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [PrismaModule, SettingsModule, AnalyticsModule],
  controllers: [AiController],
  providers: [AiService, ContentGeneratorService],
  exports: [AiService, ContentGeneratorService]
})
export class AiModule {}
