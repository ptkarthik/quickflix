import { TmdbProvider } from '../research/providers/tmdb.provider';
export interface ArtworkCandidate {
    id: string;
    movieId: string;
    imageUrl: string;
    sourceUrl: string;
    sourceDomain: string;
    sourceType: string;
    width: number;
    height: number;
    aspectRatio: number;
    imageType: string;
    confidenceScore: number;
    qualityScore: number;
    isOfficial: boolean;
    isDuplicate: boolean;
    verificationStatus: 'VERIFIED' | 'NEEDS_VERIFICATION' | 'REJECTED';
    candidateTitle?: string;
    candidateYear?: number;
    entityType?: string;
}
export interface ImageSearchProvider {
    search(query: string, limit?: number): Promise<Partial<ArtworkCandidate>[]>;
}
export declare class MovieIdentityVerifier {
    static normalizeTitle(title: string): string;
    static extractNumbers(normalized: string): string[];
    static extractCoreWords(normalized: string): string[];
    static checkDirectMatch(normExpected: string, normCandidate: string): boolean;
    static isTitleMatch(expectedTitle: string, candidateTitle: string): boolean;
    static verifyCandidate(candidate: ArtworkCandidate, expectedTitle: string, movieData?: any): {
        verified: boolean;
        reason: string;
    };
}
export declare class WikipediaImageSearchProvider implements ImageSearchProvider {
    static normalizeWikiTitle(pageTitle: string): string;
    search(query: string, limit?: number): Promise<Partial<ArtworkCandidate>[]>;
}
export declare class ImdbImageSearchProvider implements ImageSearchProvider {
    search(query: string, limit?: number): Promise<Partial<ArtworkCandidate>[]>;
}
export declare class WebArtworkDiscoveryService {
    private wikiSearchProvider;
    private imdbSearchProvider;
    private readonly logger;
    constructor(wikiSearchProvider: WikipediaImageSearchProvider, imdbSearchProvider: ImdbImageSearchProvider);
    findMovieArtwork(movie: any, canonicalMovieId: string): Promise<ArtworkCandidate[]>;
}
export declare class MovieArtworkService {
    private tmdbProvider;
    private webDiscoveryService;
    private readonly logger;
    private cache;
    constructor(tmdbProvider: TmdbProvider, webDiscoveryService: WebArtworkDiscoveryService);
    discoverArtwork(canonicalMovieId: string, tmdbId: string | number, title: string, fullMovieObj?: any, forceDeepSearch?: boolean): Promise<{
        status: 'FOUND' | 'NO_VERIFIED_ARTWORK';
        candidates: ArtworkCandidate[];
        totalCandidates: number;
        verifiedCandidates: number;
        debugInfo: any;
    }>;
    private buildResponse;
    private createCandidate;
    private verifyAndScore;
}
