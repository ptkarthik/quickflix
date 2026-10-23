export interface ImageReference {
    url: string;
    sourceType: 'actor' | 'artwork';
}
export interface AiGenerationRequest {
    prompt: string;
    identityReferences: ImageReference[];
    visualReferences: ImageReference[];
    aspectRatio: '2:3' | '16:9' | '1:1';
    outputQuality: 'high' | 'standard';
}
export interface GenerationProvenance {
    provider: string;
    model: string;
    promptVersion: string;
    referenceImages: {
        identity: {
            requested: number;
            fetched: number;
            suppliedToModel: number;
        };
        visual: {
            requested: number;
            fetched: number;
            suppliedToModel: number;
        };
    };
    generationRequestId: string;
    generatedAt: string;
}
export interface AiGenerationResult {
    imageUrl: string;
    status: 'AI_GENERATED' | 'MOCK_AI' | 'AI_GENERATION_FAILED';
    sourceType: 'AI_GENERATED' | 'MOCK_AI';
    provenance?: GenerationProvenance;
    errorMessage?: string;
}
export declare abstract class AiGenerationProvider {
    abstract generateImage(request: AiGenerationRequest): Promise<AiGenerationResult>;
}
