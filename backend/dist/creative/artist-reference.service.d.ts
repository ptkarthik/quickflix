import { TmdbProvider } from '../research/providers/tmdb.provider';
export interface ArtistReferenceImage {
    url: string;
    sourceUrl: string;
    sourceType: 'official' | 'tmdb' | 'archive' | 'web' | 'unknown';
    retrievalStatus: 'SUCCESS' | 'FAILED' | 'PENDING';
    validationStatus: 'SOURCE_VERIFIED' | 'UNVERIFIED' | 'REJECTED';
    suppliedToModel: boolean;
    confidence: number;
}
export interface ArtistReference {
    role: string;
    name: string;
    references: ArtistReferenceImage[];
    referenceCount: number;
    retrievalStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'NO_DATA';
}
export interface ArtistReferencePack {
    artists: ArtistReference[];
    totalReferences: number;
    packStatus: 'SOURCE_VERIFIED' | 'PARTIAL' | 'FAILED' | 'NO_DATA';
}
export declare class ArtistReferenceService {
    private tmdbProvider;
    private readonly logger;
    constructor(tmdbProvider: TmdbProvider);
    buildReferencePack(movieData: any, tmdbId?: string | number): Promise<ArtistReferencePack>;
}
