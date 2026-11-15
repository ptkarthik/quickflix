import { Module } from '@nestjs/common';
import { ReadyController } from './ready.controller';
import { ReadyService } from './ready.service';

/** Ready-made posts for every desk (built daily by the app, edited / accepted / posted by you). */
@Module({
  controllers: [ReadyController],
  providers: [ReadyService],
})
export class ReadyModule {}
