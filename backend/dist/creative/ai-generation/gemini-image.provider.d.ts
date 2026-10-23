import { AiGenerationProvider, AiGenerationRequest, AiGenerationResult } from './ai-generation.provider';
export declare class GeminiImageProvider implements AiGenerationProvider {
    private readonly logger;
    private readonly apiKey;
    private readonly modelName;
    private readonly baseUrl;
    generateImage(request: AiGenerationRequest): Promise<AiGenerationResult>;
    private fetchAndEncodeImage;
}
