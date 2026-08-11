import { Module } from '@nestjs/common';
import { ResearchService } from './research.service';
import { ResearchController } from './research.controller';
import { TmdbProvider } from './providers/tmdb.provider';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ResearchController],
  providers: [ResearchService, TmdbProvider],
  exports: [ResearchService]
})
export class ResearchModule {}
