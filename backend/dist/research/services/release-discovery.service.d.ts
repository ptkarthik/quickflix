import { TmdbProvider } from '../providers/tmdb.provider';
import { MovieArtworkService } from '../../creative/artwork.service';
import { MovieClassificationService, MovieCategory, TheatricalStatus, OttPlatformInfo } from './movie-classification.service';
import { TheatricalValidatorService } from './theatrical-validator.service';
export interface CanonicalMovie {
    canonicalId: string;
    title: string;
    year: number;
    originalLanguage: string;
    industries: string[];
    theatricalRelease?: string;
    ottRelease?: string;
    theatricalStatus?: TheatricalStatus;
    ottPlatforms?: OttPlatformInfo[];
    ottDateConfirmed?: boolean;
    primaryPlatform?: string;
    streamingStatus?: string;
    watchUrl?: string;
    isDirectToOtt?: boolean;
    sources: string[];
    artworkStatus: 'READY' | 'ARTWORK_REQUIRED' | 'DISCOVERY_RUNNING';
    classification: MovieCategory;
    tmdbId?: string | number;
    overview?: string;
    popularity?: number;
    posterPath?: string;
    backdropPath?: string;
}
export interface ReleaseProvider {
    name: string;
    discover(): Promise<Partial<CanonicalMovie>[]>;
}
export declare class ReleaseDiscoveryService {
    private readonly tmdbProvider;
    private readonly artworkService;
    private readonly movieClassificationService;
    private readonly theatricalValidator;
    private readonly logger;
    private cachedMasterList;
    private cacheTimestamp;
    constructor(tmdbProvider: TmdbProvider, artworkService: MovieArtworkService, movieClassificationService: MovieClassificationService, theatricalValidator: TheatricalValidatorService);
    discoverAll(): Promise<{
        upcomingTheater: CanonicalMovie[];
        nowInTheater: CanonicalMovie[];
        upcomingOTT: CanonicalMovie[];
        nowStreaming: CanonicalMovie[];
        pendingValidation: CanonicalMovie[];
        unclassified: CanonicalMovie[];
        audit: any;
    }>;
    private formatResponse;
    private getPlatformSearchUrl;
    private formatDateDisplay;
    private getMockJustWatchData;
}
