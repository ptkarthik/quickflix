import { Module } from '@nestjs/common';
import { OttModule } from '../ott/ott.module';
import { GrowthController } from './growth.controller';
import { GrowthService } from './growth.service';

@Module({
  imports: [OttModule], // InstagramService (token, read-only Graph calls)
  controllers: [GrowthController],
  providers: [GrowthService],
})
export class GrowthModule {}
