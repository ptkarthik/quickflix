import { Controller, Get, Post } from '@nestjs/common';
import { GrowthService } from './growth.service';

@Controller('growth')
export class GrowthController {
  constructor(private readonly growth: GrowthService) {}

  /** Last synced numbers + findings. */
  @Get()
  get() {
    return this.growth.get();
  }

  /** Fetch fresh numbers from Instagram now (read-only). */
  @Post('sync')
  sync() {
    return this.growth.sync();
  }
}
