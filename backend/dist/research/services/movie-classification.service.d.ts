export type MovieCategory = 'UPCOMING_THEATRICAL' | 'NOW_IN_THEATERS' | 'UPCOMING_OTT' | 'NOW_STREAMING' | 'PENDING_VALIDATION' | 'UNCLASSIFIED';
export type TheatricalStatus = 'UPCOMING' | 'CURRENTLY_RUNNING' | 'ENDED' | 'UNKNOWN';
export type OttAvailabilityType = 'SUBSCRIPTION' | 'RENTAL' | 'PURCHASE';
export interface OttPlatformInfo {
    name: string;
    availableInIndia: boolean;
    verified: boolean;
    availableFrom?: string;
    availableUntil?: string;
    availabilityType?: OttAvailabilityType;
    watchUrl?: string;
    logoPath?: string;
}
export interface TheatricalValidationResult {
    isValid: boolean;
    rejectionReason?: string;
    auditDetails?: {
        movieId: string | number;
        title: string;
        theatricalDate?: string;
        today: string;
        language?: string;
        isIndianProduction: boolean;
        hasActiveIndianOtt: boolean;
        isDirectToOtt: boolean;
        daysUntilRelease?: number;
    };
}
export interface MovieReleaseData {
    movieId: number | string;
    title: string;
    originalLanguage?: string;
    industries?: string[];
    overview?: string;
    posterPath?: string;
    backdropPath?: string;
    popularity?: number;
    sources?: string[];
    theatricalReleaseDate?: string;
    theatricalStatus: TheatricalStatus;
    theatricalWindowDays?: number;
    ottReleaseDate?: string;
    ottPlatforms: OttPlatformInfo[];
    ottDateConfirmed: boolean;
    isDirectToOtt?: boolean;
    imdbId?: string;
    hasExhibitionEvidence?: boolean;
    exhibitionConfirmedPast?: boolean;
    dateConflictDetected?: boolean;
    dateConflictDetails?: string;
    uncorroboratedDate?: boolean;
}
export declare class MovieClassificationService {
    private readonly logger;
    static readonly DEFAULT_THEATRICAL_WINDOW_DAYS = 45;
    isValidDateStr(dateStr?: string | null): boolean;
    daysDifference(targetDate: string, baseDate: string): number;
    resolveTheatricalStatus(theatricalDate?: string | null, todayStr?: string, explicitStatus?: TheatricalStatus, windowDays?: number): TheatricalStatus;
    classifyMovie(movie: MovieReleaseData, todayStr?: string): MovieCategory;
    validateUpcomingTheatrical(movie: MovieReleaseData, todayStr?: string): TheatricalValidationResult;
}
