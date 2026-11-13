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
import { CoverageAuditService } from './services/coverage-audit.service';
import { DiscoveryCacheService } from './services/discovery-cache.service';
import { NowInTheatersValidatorService } from './services/now-in-theaters-validator.service';
import { NowInTheatersAuditService } from './services/now-in-theaters-audit.service';
import { OttValidatorService } from './services/ott-validator.service';
import { IndianOttRegistryService } from './services/indian-ott-registry.service';
import { EvidenceVerificationAuthorityService } from './services/evidence-verification-authority.service';

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
    MovieClassificationService,
    CoverageAuditService,
    DiscoveryCacheService,
    NowInTheatersValidatorService,
    NowInTheatersAuditService,
    OttValidatorService,
    IndianOttRegistryService,
    EvidenceVerificationAuthorityService
  ],
  exports: [
    ResearchService, 
    TmdbProvider, 
    OmdbProvider, 
    ImdbCrosscheckProvider, 
    TheatricalValidatorService, 
    ReleaseDiscoveryService, 
    MovieClassificationService,
    CoverageAuditService,
    DiscoveryCacheService,
    NowInTheatersValidatorService,
    NowInTheatersAuditService,
    OttValidatorService,
    IndianOttRegistryService,
    EvidenceVerificationAuthorityService
  ]
})
export class ResearchModule {}
