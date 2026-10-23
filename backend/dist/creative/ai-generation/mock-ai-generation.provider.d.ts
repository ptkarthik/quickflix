import { AiGenerationProvider, AiGenerationRequest, AiGenerationResult } from './ai-generation.provider';
export declare class MockAiGenerationProvider implements AiGenerationProvider {
    private readonly logger;
    generateImage(request: AiGenerationRequest): Promise<AiGenerationResult>;
}
