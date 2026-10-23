import { Injectable, Logger } from '@nestjs/common';
import { AiGenerationProvider, AiGenerationRequest, AiGenerationResult } from './ai-generation.provider';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MockAiGenerationProvider implements AiGenerationProvider {
  private readonly logger = new Logger(MockAiGenerationProvider.name);

  async generateImage(request: AiGenerationRequest): Promise<AiGenerationResult> {
    const requestId = uuidv4();
    
    // Exact same provenance counters as the real provider
    const identityStats = { requested: request.identityReferences.length, fetched: 0, suppliedToModel: 0 };
    const visualStats = { requested: request.visualReferences.length, fetched: 0, suppliedToModel: 0 };

    this.logger.log(`[MockAI:${requestId}] REFERENCE_DISCOVERY: Identity References: ${identityStats.requested}, Visual References: ${visualStats.requested}`);
    
    this.logger.log(`[MockAI:${requestId}] REFERENCE_FETCH & MODEL_INPUT_PREPARATION started`);
    
    // Simulate fetching (without actual network calls) to validate the references
    for (const ref of request.identityReferences) {
        identityStats.fetched++;
        identityStats.suppliedToModel++;
    }
    
    for (const ref of request.visualReferences) {
        visualStats.fetched++;
        visualStats.suppliedToModel++;
    }

    this.logger.log(`[MockAI:${requestId}] IDENTITY_REFERENCES: fetched: ${identityStats.fetched}, valid: ${identityStats.fetched}, supplied_to_model: ${identityStats.suppliedToModel}`);
    this.logger.log(`[MockAI:${requestId}] VISUAL_REFERENCES: fetched: ${visualStats.fetched}, valid: ${visualStats.fetched}, supplied_to_model: ${visualStats.suppliedToModel}`);
    this.logger.log(`[MockAI:${requestId}] MODEL_INPUT_PREPARATION completed (Mock Mode)`);
    
    this.logger.log(`[MockAI:${requestId}] GEMINI_REQUEST started to mock model (Simulating latency...)`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    this.logger.log(`[MockAI:${requestId}] GENERATION_ACCEPTED. Latency: 1500ms`);
    this.logger.log(`[MockAI:${requestId}] GENERATED_ASSET_SAVED successfully (Mock)`);

    return {
      imageUrl: '/mock_posters/poster_3.jpg', // Use our deterministic mock asset
      status: 'MOCK_AI',
      sourceType: 'MOCK_AI',
      provenance: {
        provider: 'mock',
        model: 'mock-generation-engine',
        promptVersion: 'v1_strict_textless',
        referenceImages: { identity: identityStats, visual: visualStats },
        generationRequestId: requestId,
        generatedAt: new Date().toISOString()
      }
    };
  }
}
