import { Injectable, Logger } from '@nestjs/common';
import { AiGenerationProvider, AiGenerationRequest, AiGenerationResult } from './ai-generation.provider';
import { ArtistReferencePack } from '../artist-reference.service';
import { TitleDNA } from '../title-intelligence.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AiGenerationService {
  private readonly logger = new Logger(AiGenerationService.name);

  constructor(private readonly provider: AiGenerationProvider) {}

  async generatePosterImage(
    movieTitle: string,
    artistReferences: ArtistReferencePack,
    visualReferenceUrl: string | null,
    titleProfile: any | null
  ): Promise<AiGenerationResult> {
    const requestId = uuidv4();
    this.logger.log(`[${requestId}] Starting AI generation for: ${movieTitle}`);

    // Build the Prompt
    const visualMotif = titleProfile?.dna?.visualMotif || 'cinematic lighting, dramatic composition';
    const prompt = `A highly detailed, professional cinematic still for a movie. Atmosphere: ${visualMotif}. NO TEXT, NO TYPOGRAPHY, NO LOGOS, NO WATERMARKS. Pure textless cinematic composition.`;

    // Map identity references from the ArtistReferencePack
    const identityReferences = [];
    if (artistReferences && artistReferences.artists) {
      for (const artist of artistReferences.artists) {
        if (artist.references && artist.references.length > 0) {
           // Provide the first successful image as a reference for this actor
           const validRef = artist.references.find(r => r.validationStatus === 'SOURCE_VERIFIED');
           if (validRef) {
             identityReferences.push({
                url: validRef.url,
                sourceType: 'actor' as const
             });
           }
        }
      }
    }

    const visualReferences = [];
    if (visualReferenceUrl) {
       visualReferences.push({
          url: visualReferenceUrl,
          sourceType: 'artwork' as const
       });
    }

    const request: AiGenerationRequest = {
      prompt,
      identityReferences,
      visualReferences,
      aspectRatio: '2:3',
      outputQuality: 'high'
    };

    try {
      this.logger.log(`[${requestId}] Dispatching to AI provider with ${identityReferences.length} identity refs and ${visualReferences.length} visual refs`);
      const result = await this.provider.generateImage(request);
      
      if (result.status === 'AI_GENERATED' || result.status === 'MOCK_AI') {
         this.logger.log(`[${requestId}] Successfully generated AI image (${result.status})`);
      } else {
         this.logger.warn(`[${requestId}] AI Generation failed: ${result.errorMessage}`);
      }

      // Attach the exact generationRequestId for provenance
      if (result.provenance) {
         result.provenance.generationRequestId = requestId;
      }

      return result;
    } catch (error) {
      this.logger.error(`[${requestId}] Unhandled error during AI generation: ${error.message}`, error.stack);
      return {
        imageUrl: '',
        status: 'AI_GENERATION_FAILED',
        sourceType: 'AI_GENERATED',
        errorMessage: error.message
      };
    }
  }
}
