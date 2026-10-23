import { MovieArtworkService, ArtworkCandidate } from './artwork.service';
import { RatingAggregationService } from './rating.service';
import { ArtistReferenceService } from './artist-reference.service';
import { MovieTitleIntelligenceService } from './title-intelligence.service';
import { AiGenerationService } from './ai-generation/ai-generation.service';
export declare class CreativeStudioService {
    private artworkService;
    private ratingService;
    private artistService;
    private titleService;
    private aiGenerationService;
    constructor(artworkService: MovieArtworkService, ratingService: RatingAggregationService, artistService: ArtistReferenceService, titleService: MovieTitleIntelligenceService, aiGenerationService: AiGenerationService);
    buildCreativeStudioPayload(canonicalMovieId: string, tmdbId: string | number, title: string, movieData?: any, manualRating?: number | null, usedCandidateIds?: string[], requestedConceptId?: string, forceDeepSearch?: boolean): Promise<{
        status: string;
        movieTitle: string;
        artwork: {
            status: "FOUND" | "NO_VERIFIED_ARTWORK";
            candidates: ArtworkCandidate[];
            totalCandidates: number;
            verifiedCandidates: number;
            debugInfo: any;
        };
        artistReferences: import("./artist-reference.service").ArtistReferencePack;
        titleProfile: import("./title-intelligence.service").MovieTitleProfile;
        rating?: undefined;
        releaseText?: undefined;
        exportModes?: undefined;
    } | {
        status: string;
        movieTitle: string;
        artwork: {
            status: "FOUND" | "NO_VERIFIED_ARTWORK";
            candidates: ArtworkCandidate[];
            totalCandidates: number;
            verifiedCandidates: number;
            debugInfo: any;
        };
        rating: {
            mode: "MANUAL" | "AGGREGATED" | "NOT_AVAILABLE";
            displayString: string;
            value: number | null;
        };
        releaseText: string;
        artistReferences: import("./artist-reference.service").ArtistReferencePack;
        titleProfile: import("./title-intelligence.service").MovieTitleProfile;
        exportModes: string[];
    }>;
    private generateConcepts;
}
