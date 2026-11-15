import { Module } from '@nestjs/common';
import { OttModule } from '../ott/ott.module';
import { WorldModule } from '../world/world.module';
import { ExtrasController } from './extras.controller';
import { ExtrasService } from './extras.service';
import { CriticsService } from './critics.service';
import { WhereService } from './where.service';

@Module({
  imports: [OttModule, WorldModule], // OttAiService (Gemini text), IMDb daily ratings file
  controllers: [ExtrasController],
  providers: [ExtrasService, CriticsService, WhereService],
})
export class ExtrasModule {}
