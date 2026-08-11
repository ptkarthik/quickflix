import { Controller, Get, Post } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('seed')
  seed() {
    return this.analyticsService.seedSimulatedData();
  }

  @Get('dashboard')
  getDashboard() {
    return this.analyticsService.getDashboardData();
  }
}
