import { Module, forwardRef } from '@nestjs/common';
import { ResearchService } from './research.service';
import { ResearchController } from './research.controller';
import { DiscoverController } from './discover.controller';
import { TmdbProvider } from './providers/tmdb.provider';
import { ReleaseDiscoveryService } from './services/release-discovery.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { CreativeModule } from '../creative/creative.module';

import { MovieClassificationService } from './services/movie-classification.service';
import { OmdbProvider } from './providers/omdb.provider';
import { ImdbCrosscheckProvider } from './providers/imdb-crosscheck.provider';
import { TheatricalValidatorService } from './services/theatrical-validator.service';

@Module({
  imports: [PrismaModule, AiModule, forwardRef(() => CreativeModule)],
  controllers: [ResearchController, DiscoverController],
  providers: [
    ResearchService, 
    TmdbProvider, 
    OmdbProvider, 
    ImdbCrosscheckProvider, 
    TheatricalValidatorService, 
    ReleaseDiscoveryService, 
    MovieClassificationService
  ],
  exports: [
    ResearchService, 
    TmdbProvider, 
    OmdbProvider, 
    ImdbCrosscheckProvider, 
    TheatricalValidatorService, 
    ReleaseDiscoveryService, 
    MovieClassificationService
  ]
})
export class ResearchModule {}
