import { ResearchService } from './research.service';
import { CreativeStudioService } from '../creative/creative.service';
export declare class DiscoverController {
    private readonly researchService;
    private readonly creativeStudioService;
    constructor(researchService: ResearchService, creativeStudioService: CreativeStudioService);
    getUpcomingOtt(): Promise<import("./services/release-discovery.service").CanonicalMovie[]>;
    getAll(): Promise<{
        upcomingTheater: import("./services/release-discovery.service").CanonicalMovie[];
        nowInTheater: import("./services/release-discovery.service").CanonicalMovie[];
        upcomingOTT: import("./services/release-discovery.service").CanonicalMovie[];
        nowStreaming: import("./services/release-discovery.service").CanonicalMovie[];
        pendingValidation: import("./services/release-discovery.service").CanonicalMovie[];
        unclassified: import("./services/release-discovery.service").CanonicalMovie[];
        audit: any;
    }>;
    getMovieDetails(id: string): Promise<import("./providers/research-provider.interface").ResearchData>;
    generatePosterConcepts(body: {
        canonicalMovieId: string;
        tmdbId: string;
        title: string;
        movieData: any;
        manualRating?: number;
        usedCandidateIds?: string[];
        forceDeepSearch?: boolean;
    }): Promise<{
        status: string;
        movieTitle: string;
        artwork: {
            status: "FOUND" | "NO_VERIFIED_ARTWORK";
            candidates: import("../creative/artwork.service").ArtworkCandidate[];
            totalCandidates: number;
            verifiedCandidates: number;
            debugInfo: any;
        };
        artistReferences: import("../creative/artist-reference.service").ArtistReferencePack;
        titleProfile: import("../creative/title-intelligence.service").MovieTitleProfile;
        rating?: undefined;
        releaseText?: undefined;
        exportModes?: undefined;
    } | {
        status: string;
        movieTitle: string;
        artwork: {
            status: "FOUND" | "NO_VERIFIED_ARTWORK";
            candidates: import("../creative/artwork.service").ArtworkCandidate[];
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
        artistReferences: import("../creative/artist-reference.service").ArtistReferencePack;
        titleProfile: import("../creative/title-intelligence.service").MovieTitleProfile;
        exportModes: string[];
    }>;
}
