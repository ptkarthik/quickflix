import { OmdbProvider } from '../providers/omdb.provider';
import { ImdbCrosscheckProvider } from '../providers/imdb-crosscheck.provider';
import { MovieReleaseData } from './movie-classification.service';
export interface ExhibitionVerificationResult {
    isVerifiedUpcoming: boolean;
    isConfirmedReleased: boolean;
    isDateConflict: boolean;
    quarantineReason?: string;
    corroboratedDate?: string;
    sourcesChecked: string[];
}
export declare class TheatricalValidatorService {
    private readonly omdbProvider;
    private readonly imdbCrosscheck;
    private readonly logger;
    private readonly verifiedReleasedTitles;
    constructor(omdbProvider: OmdbProvider, imdbCrosscheck: ImdbCrosscheckProvider);
    verifyTheatricalStatus(movie: MovieReleaseData, todayStr: string): Promise<ExhibitionVerificationResult>;
}
