import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEngineService } from './analytics-engine.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsEngineService],
  exports: [AnalyticsService, AnalyticsEngineService]
})
export class AnalyticsModule {}
