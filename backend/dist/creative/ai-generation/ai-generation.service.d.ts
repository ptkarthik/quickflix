import { AiGenerationProvider, AiGenerationResult } from './ai-generation.provider';
import { ArtistReferencePack } from '../artist-reference.service';
export declare class AiGenerationService {
    private readonly provider;
    private readonly logger;
    constructor(provider: AiGenerationProvider);
    generatePosterImage(movieTitle: string, artistReferences: ArtistReferencePack, visualReferenceUrl: string | null, titleProfile: any | null): Promise<AiGenerationResult>;
}
