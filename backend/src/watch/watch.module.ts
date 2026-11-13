import { Module } from '@nestjs/common';
import { WorldModule } from '../world/world.module';
import { WatchController } from './watch.controller';
import { WatchService } from './watch.service';

@Module({
  imports: [WorldModule], // language names
  controllers: [WatchController],
  providers: [WatchService],
})
export class WatchModule {}
