import { Module, forwardRef } from '@nestjs/common';
import { MovieArtworkService, WebArtworkDiscoveryService, WikipediaImageSearchProvider, ImdbImageSearchProvider } from './artwork.service';
import { RatingAggregationService } from './rating.service';
import { CreativeStudioService } from './creative.service';
import { ResearchModule } from '../research/research.module';
import { ArtistReferenceService } from './artist-reference.service';
import { MovieTitleIntelligenceService } from './title-intelligence.service';
import { AiGenerationService } from './ai-generation/ai-generation.service';
import { AiGenerationProvider } from './ai-generation/ai-generation.provider';
import { GeminiImageProvider } from './ai-generation/gemini-image.provider';
import { MockAiGenerationProvider } from './ai-generation/mock-ai-generation.provider';

import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [forwardRef(() => ResearchModule), HttpModule],
  providers: [
    MovieArtworkService, 
    RatingAggregationService, 
    CreativeStudioService, 
    WebArtworkDiscoveryService, 
    WikipediaImageSearchProvider,
    ImdbImageSearchProvider,
    ArtistReferenceService,
    MovieTitleIntelligenceService,
    AiGenerationService,
    GeminiImageProvider,
    MockAiGenerationProvider,
    {
       provide: AiGenerationProvider,
       useFactory: (gemini: GeminiImageProvider, mock: MockAiGenerationProvider) => {
          return process.env.USE_MOCK_AI === 'true' ? mock : gemini;
       },
       inject: [GeminiImageProvider, MockAiGenerationProvider]
    }
  ],
  exports: [CreativeStudioService, MovieArtworkService]
})
export class CreativeModule {}
