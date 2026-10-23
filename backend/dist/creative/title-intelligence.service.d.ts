import { TmdbProvider } from '../research/providers/tmdb.provider';
export interface TitleDNA {
    script: string;
    case: string;
    weight: string;
    letterSpacing: string;
    width: string;
    style: string;
    texture: string;
    fill: string;
    outline: string;
    shadow: string;
    distortion: string;
    layout: string;
    alignment: string;
    visualMotif: string;
    referenceSources: string[];
}
export interface MovieTitleProfile {
    officialLogoUrl: string | null;
    dna: TitleDNA | null;
    referencePostersAnalyzed: number;
    extractionStatus: 'SUCCESS' | 'FAILED' | 'FALLBACK_GENERATED';
    logoValidationStatus: 'TMDB_LOGO_SOURCE_VERIFIED' | 'UNVERIFIED' | 'NONE';
    suppliedToCompositor: boolean;
    composited: boolean;
}
export declare class MovieTitleIntelligenceService {
    private tmdbProvider;
    private readonly logger;
    constructor(tmdbProvider: TmdbProvider);
    buildTitleProfile(canonicalMovieId: string, tmdbId: string | number, movieTitle: string): Promise<MovieTitleProfile>;
    private generateFallbackDNA;
}
