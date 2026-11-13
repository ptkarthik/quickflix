import { Module } from '@nestjs/common';
import { OnThisDayController } from './onthisday.controller';
import { OnThisDayService } from './onthisday.service';

@Module({
  controllers: [OnThisDayController],
  providers: [OnThisDayService],
})
export class OnThisDayModule {}
