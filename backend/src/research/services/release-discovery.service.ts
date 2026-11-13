import { Injectable, Logger, Inject, forwardRef, Optional, OnModuleInit } from '@nestjs/common';
import { TmdbProvider } from '../providers/tmdb.provider';
import { MovieArtworkService } from '../../creative/artwork.service';
import { 
  MovieClassificationService, 
  MovieCategory, 
  TheatricalStatus, 
  OttPlatformInfo, 
  MovieReleaseData 
} from './movie-classification.service';
import { TheatricalValidatorService } from './theatrical-validator.service';
import { OttValidatorService, OttCandidateValidationInput } from './ott-validator.service';
import { IndianOttRegistryService } from './indian-ott-registry.service';

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
  contentType?: 'movie' | 'tv';
  seasonNumber?: number;
  releaseEventType?: 'INDIA_OTT_DIGITAL' | 'LINEAR_TV_BROADCAST' | 'THEATRICAL' | 'UNKNOWN';
  originalNetworks?: string[];
  broadcastAirDate?: string;
  hasIndianTerritoryEvidence?: boolean;
  evidenceSource?: string;
  uncorroboratedDate?: boolean;
  dateConflictDetected?: boolean;
  dateConflictDetails?: string;

  // Phase 2.7.3.2 & 2.7.3.4 Historical Premiere Signals
  isTestFixture?: boolean;
  theatricalRunExplicitlyEnded?: boolean;
  historicalVerificationStatus?: any;
  historicalTheatricalReleaseDate?: string;
  historicalOttPremiereDate?: string;
  historicalOttTerritory?: string;
  historicalOttPlatform?: string;
  historicalOttAvailabilityModel?: any;
  historicalSeasonAirDates?: Record<number, string>;
}

export interface ReleaseProvider {
  name: string;
  discover(): Promise<Partial<CanonicalMovie>[]>;
}

@Injectable()
export class ReleaseDiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(ReleaseDiscoveryService.name);
  
  private cachedMasterList: CanonicalMovie[] | null = null;
  private cacheTimestamp = 0;
  private cachedRegistryGeneration = -1;
  private readonly registryMutationListeners: Array<(event: any) => void> = [];

  constructor(
    private readonly tmdbProvider: TmdbProvider,
    @Inject(forwardRef(() => MovieArtworkService))
    private readonly artworkService: MovieArtworkService,
    private readonly movieClassificationService: MovieClassificationService,
    private readonly theatricalValidator: TheatricalValidatorService,
    private readonly ottValidator: OttValidatorService,
    @Optional()
    @Inject(forwardRef(() => IndianOttRegistryService))
    private readonly indianOttRegistry?: IndianOttRegistryService
  ) {
    if (this.indianOttRegistry) {
      this.bindRegistryListeners();
    }
  }

  private isRegistryListenerBound = false;
  private bindRegistryListeners(): void {
    if (!this.indianOttRegistry || this.isRegistryListenerBound) return;
    this.isRegistryListenerBound = true;
    this.indianOttRegistry.onMutation(event => {
      this.invalidateCache(`REGISTRY_MUTATION: ${event.reason}`);
      for (const l of this.registryMutationListeners) {
        try { l(event); } catch {}
      }
    });
  }

  public onModuleInit(): void {
    this.bindRegistryListeners();
  }

  public onRegistryMutation(listener: (event: any) => void): () => void {
    this.registryMutationListeners.push(listener);
    return () => {
      const idx = this.registryMutationListeners.indexOf(listener);
      if (idx !== -1) this.registryMutationListeners.splice(idx, 1);
    };
  }

  public invalidateCache(reason?: string): void {
    this.cachedMasterList = null;
    this.cacheTimestamp = 0;
    this.cachedRegistryGeneration = -1;
    this.logger.log(`[ReleaseDiscoveryService] Invalidate cache: ${reason || 'MANUAL'}`);
  }

  public getRegistryGeneration(): number {
    return this.indianOttRegistry ? this.indianOttRegistry.getMutationGeneration() : 0;
  }

  async discoverAll(overrideDateStr?: string): Promise<{
    upcomingTheater: CanonicalMovie[];
    nowInTheater: CanonicalMovie[];
    upcomingOTT: CanonicalMovie[];
    nowStreaming: CanonicalMovie[];
    pendingValidation: CanonicalMovie[];
    unclassified: CanonicalMovie[];
    audit: any;
  }> {
    const todayStr = overrideDateStr || new Date().toISOString().split('T')[0];
    const currentGeneration = this.getRegistryGeneration();
    if (
      this.cachedMasterList &&
      Date.now() - this.cacheTimestamp < 1000 * 60 * 5 &&
      !overrideDateStr &&
      this.cachedRegistryGeneration === currentGeneration
    ) {
       return this.formatResponse(this.cachedMasterList, { cached: true }, todayStr);
    }

    this.logger.log('Starting Multi-Source Release Discovery...');

    // Live TMDB discovery (exhaustive authentic catalog)
    const tmdbResults = await this.tmdbProvider.discoverAllRaw();
    const tvSeriesResults = await this.tmdbProvider.discoverUpcomingTvSeries({ todayStr });
    const mockJustWatchResults: Partial<CanonicalMovie>[] = [];
    const indianOttResults = this.indianOttRegistry ? this.indianOttRegistry.toCanonicalMovies(todayStr) : [];

    // NORMALIZE & DEDUPLICATE (Source Union Architecture)
    const masterMap = new Map<string, CanonicalMovie>();

    const mergeMovie = (movie: Partial<CanonicalMovie>, sourceName: string) => {
       const isTv = movie.contentType === 'tv' || String(movie.canonicalId).startsWith('tmdb:tv:');
       // Stable type-aware key: distinguishes TV series from movies even if numeric IDs coincide
       const key = isTv
         ? (movie.tmdbId ? `tmdb:tv:${movie.tmdbId}` : (movie.canonicalId || `tmdb:tv:${movie.title?.toLowerCase().replace(/\s+/g, '')}:${movie.year}`))
         : (movie.tmdbId ? `tmdb:${movie.tmdbId}` : (movie.canonicalId || `title:${movie.title?.toLowerCase().replace(/\s+/g, '')}:${movie.year}`));
       
       if (masterMap.has(key)) {
         const existing = masterMap.get(key)!;
         if (!existing.sources.includes(sourceName)) existing.sources.push(sourceName);
         if (!existing.theatricalRelease && movie.theatricalRelease) existing.theatricalRelease = movie.theatricalRelease;
         if (!existing.ottRelease && movie.ottRelease) existing.ottRelease = movie.ottRelease;
         // Dynamic & Revocable Status Overrides (Phase 2.7.3.8)
         if (movie.theatricalStatus === 'CURRENTLY_RUNNING') {
           existing.theatricalStatus = 'CURRENTLY_RUNNING';
           (existing as any).theatricalRunExplicitlyEnded = false;
         } else if (movie.theatricalStatus && (!existing.theatricalStatus || existing.theatricalStatus === 'UNKNOWN')) {
           existing.theatricalStatus = movie.theatricalStatus;
         }

         if ((movie as any).claimVerificationStatus === 'CLAIM_CONTENT_MISMATCH') {
           (existing as any).claimVerificationStatus = 'CLAIM_CONTENT_MISMATCH';
           (existing as any).isClaimContentVerified = false;
         }

         if ((movie as any).historicalVerificationStatus === 'CONFIRMED_PRIOR_PREMIERE') {
           (existing as any).historicalVerificationStatus = 'CONFIRMED_PRIOR_PREMIERE';
         }
         if (movie.ottDateConfirmed) existing.ottDateConfirmed = true;
         if (movie.isDirectToOtt) existing.isDirectToOtt = true;
         if (movie.contentType && !existing.contentType) existing.contentType = movie.contentType;
         if (movie.seasonNumber && !existing.seasonNumber) existing.seasonNumber = movie.seasonNumber;
         if (movie.primaryPlatform && !existing.primaryPlatform) existing.primaryPlatform = movie.primaryPlatform;
         if (movie.watchUrl && !existing.watchUrl) existing.watchUrl = movie.watchUrl;
         if (movie.streamingStatus && !existing.streamingStatus) existing.streamingStatus = movie.streamingStatus;
         if (movie.ottPlatforms && movie.ottPlatforms.length > 0) {
           existing.ottPlatforms = Array.from(new Set([...(existing.ottPlatforms || []), ...movie.ottPlatforms]));
         }
         if (movie.industries) {
           existing.industries = Array.from(new Set([...existing.industries, ...movie.industries]));
         }
         if (movie.releaseEventType && !existing.releaseEventType) existing.releaseEventType = movie.releaseEventType;
         if (movie.hasIndianTerritoryEvidence && !existing.hasIndianTerritoryEvidence) existing.hasIndianTerritoryEvidence = movie.hasIndianTerritoryEvidence;
         if (movie.originalNetworks && !existing.originalNetworks) existing.originalNetworks = movie.originalNetworks;
         if (movie.broadcastAirDate && !existing.broadcastAirDate) existing.broadcastAirDate = movie.broadcastAirDate;
         if (movie.evidenceSource && !existing.evidenceSource) existing.evidenceSource = movie.evidenceSource;
         if (movie.uncorroboratedDate) existing.uncorroboratedDate = true;
         if (movie.dateConflictDetected) existing.dateConflictDetected = true;
         if (movie.dateConflictDetails && !existing.dateConflictDetails) existing.dateConflictDetails = movie.dateConflictDetails;
         if ((movie as any).historicalTheatricalReleaseDate && !(existing as any).historicalTheatricalReleaseDate) {
           (existing as any).historicalTheatricalReleaseDate = (movie as any).historicalTheatricalReleaseDate;
         }
         if ((movie as any).historicalOttPremiereDate && !(existing as any).historicalOttPremiereDate) {
           (existing as any).historicalOttPremiereDate = (movie as any).historicalOttPremiereDate;
         }
         if ((movie as any).historicalOttTerritory && !(existing as any).historicalOttTerritory) {
           (existing as any).historicalOttTerritory = (movie as any).historicalOttTerritory;
         }
         if ((movie as any).historicalOttPlatform && !(existing as any).historicalOttPlatform) {
           (existing as any).historicalOttPlatform = (movie as any).historicalOttPlatform;
         }
         if ((movie as any).historicalOttAvailabilityModel && !(existing as any).historicalOttAvailabilityModel) {
           (existing as any).historicalOttAvailabilityModel = (movie as any).historicalOttAvailabilityModel;
         }
         if ((movie as any).historicalSeasonAirDates && !(existing as any).historicalSeasonAirDates) {
           (existing as any).historicalSeasonAirDates = (movie as any).historicalSeasonAirDates;
         }
         if ((movie as any).theatricalRunExplicitlyEnded && !(existing as any).theatricalRunExplicitlyEnded) {
           (existing as any).theatricalRunExplicitlyEnded = (movie as any).theatricalRunExplicitlyEnded;
         }
         if ((movie as any).historicalVerificationStatus && !(existing as any).historicalVerificationStatus) {
           (existing as any).historicalVerificationStatus = (movie as any).historicalVerificationStatus;
         }
         if ((movie as any).directToOttVerified && !(existing as any).directToOttVerified) {
           (existing as any).directToOttVerified = (movie as any).directToOttVerified;
         }
         if ((movie as any).claimVerificationStatus && !(existing as any).claimVerificationStatus) {
           (existing as any).claimVerificationStatus = (movie as any).claimVerificationStatus;
         }
         if ((movie as any).isClaimContentVerified && !(existing as any).isClaimContentVerified) {
           (existing as any).isClaimContentVerified = (movie as any).isClaimContentVerified;
         }
         if ((movie as any).verifiedClaimTitle && !(existing as any).verifiedClaimTitle) {
           (existing as any).verifiedClaimTitle = (movie as any).verifiedClaimTitle;
         }
         if ((movie as any).verifiedClaimSeasonNumber !== undefined && (existing as any).verifiedClaimSeasonNumber === undefined) {
           (existing as any).verifiedClaimSeasonNumber = (movie as any).verifiedClaimSeasonNumber;
         }
         if ((movie as any).verifiedClaimPlatform && !(existing as any).verifiedClaimPlatform) {
           (existing as any).verifiedClaimPlatform = (movie as any).verifiedClaimPlatform;
         }
         if ((movie as any).verifiedClaimDate && !(existing as any).verifiedClaimDate) {
           (existing as any).verifiedClaimDate = (movie as any).verifiedClaimDate;
         }
         if ((movie as any).verifiedClaimDatePrecision && !(existing as any).verifiedClaimDatePrecision) {
           (existing as any).verifiedClaimDatePrecision = (movie as any).verifiedClaimDatePrecision;
         }
         if ((movie as any).verifiedEvidenceId && !(existing as any).verifiedEvidenceId) {
           (existing as any).verifiedEvidenceId = (movie as any).verifiedEvidenceId;
         }
         if ((movie as any).theatricalClosureTerritory && !(existing as any).theatricalClosureTerritory) {
           (existing as any).theatricalClosureTerritory = (movie as any).theatricalClosureTerritory;
         }
         if ((movie as any).theatricalClosureEvidenceId && !(existing as any).theatricalClosureEvidenceId) {
           (existing as any).theatricalClosureEvidenceId = (movie as any).theatricalClosureEvidenceId;
         }
         if ((movie as any).verifiedClaimTerritories && !(existing as any).verifiedClaimTerritories) {
           (existing as any).verifiedClaimTerritories = (movie as any).verifiedClaimTerritories;
         }
         if ((movie as any).verifiedClaimAvailability && !(existing as any).verifiedClaimAvailability) {
           (existing as any).verifiedClaimAvailability = (movie as any).verifiedClaimAvailability;
         }
         if ((movie as any).directToOttTerritory && !(existing as any).directToOttTerritory) {
           (existing as any).directToOttTerritory = (movie as any).directToOttTerritory;
         }
         if ((movie as any).directToOttPlatform && !(existing as any).directToOttPlatform) {
           (existing as any).directToOttPlatform = (movie as any).directToOttPlatform;
         }
         if ((movie as any).directToOttAvailability && !(existing as any).directToOttAvailability) {
           (existing as any).directToOttAvailability = (movie as any).directToOttAvailability;
         }
         if ((movie as any).directToOttEvidenceId && !(existing as any).directToOttEvidenceId) {
           (existing as any).directToOttEvidenceId = (movie as any).directToOttEvidenceId;
         }
         if ((movie as any).validationProof && !(existing as any).validationProof) {
           (existing as any).validationProof = (movie as any).validationProof;
         }
       } else {
         masterMap.set(key, {
           canonicalId: key,
           title: movie.title || 'Unknown Title',
           year: movie.year || new Date().getFullYear(),
           originalLanguage: movie.originalLanguage || 'en',
           industries: movie.industries || [],
           theatricalRelease: movie.theatricalRelease,
           ottRelease: movie.ottRelease,
           theatricalStatus: movie.theatricalStatus || 'UNKNOWN',
           ottPlatforms: movie.ottPlatforms || [],
           ottDateConfirmed: movie.ottDateConfirmed || false,
           primaryPlatform: movie.primaryPlatform,
           watchUrl: movie.watchUrl,
           streamingStatus: movie.streamingStatus,
           isDirectToOtt: movie.isDirectToOtt || isTv,
           contentType: isTv ? 'tv' : (movie.contentType || 'movie'),
           seasonNumber: movie.seasonNumber,
           sources: [sourceName],
           artworkStatus: 'DISCOVERY_RUNNING',
           classification: movie.classification || 'UNCLASSIFIED',
           tmdbId: movie.tmdbId,
           overview: movie.overview,
           popularity: movie.popularity,
           posterPath: movie.posterPath,
           backdropPath: (movie as any).backdropPath,
           releaseEventType: movie.releaseEventType,
           hasIndianTerritoryEvidence: movie.hasIndianTerritoryEvidence,
           originalNetworks: movie.originalNetworks,
           broadcastAirDate: movie.broadcastAirDate,
           evidenceSource: movie.evidenceSource,
           uncorroboratedDate: movie.uncorroboratedDate,
           dateConflictDetected: movie.dateConflictDetected,
           dateConflictDetails: movie.dateConflictDetails,
           historicalTheatricalReleaseDate: (movie as any).historicalTheatricalReleaseDate,
           historicalOttPremiereDate: (movie as any).historicalOttPremiereDate,
           historicalOttTerritory: (movie as any).historicalOttTerritory,
           historicalOttPlatform: (movie as any).historicalOttPlatform,
           historicalOttAvailabilityModel: (movie as any).historicalOttAvailabilityModel,
           historicalSeasonAirDates: (movie as any).historicalSeasonAirDates,
           theatricalRunExplicitlyEnded: (movie as any).theatricalRunExplicitlyEnded,
           historicalVerificationStatus: (movie as any).historicalVerificationStatus,
           directToOttVerified: (movie as any).directToOttVerified,
           claimVerificationStatus: (movie as any).claimVerificationStatus,
           isClaimContentVerified: (movie as any).isClaimContentVerified,
           verifiedClaimTitle: (movie as any).verifiedClaimTitle,
           verifiedClaimSeasonNumber: (movie as any).verifiedClaimSeasonNumber,
           verifiedClaimPlatform: (movie as any).verifiedClaimPlatform,
           verifiedClaimDate: (movie as any).verifiedClaimDate,
           verifiedClaimDatePrecision: (movie as any).verifiedClaimDatePrecision,
           verifiedEvidenceId: (movie as any).verifiedEvidenceId,
           theatricalClosureTerritory: (movie as any).theatricalClosureTerritory,
           theatricalClosureEvidenceId: (movie as any).theatricalClosureEvidenceId,
           verifiedClaimTerritories: (movie as any).verifiedClaimTerritories,
           verifiedClaimAvailability: (movie as any).verifiedClaimAvailability,
           directToOttTerritory: (movie as any).directToOttTerritory,
           directToOttPlatform: (movie as any).directToOttPlatform,
           directToOttAvailability: (movie as any).directToOttAvailability,
           directToOttEvidenceId: (movie as any).directToOttEvidenceId,
           validationProof: (movie as any).validationProof
         } as any);
       }
    };

    tmdbResults.results.forEach((m: any) => mergeMovie(m, 'TMDB'));
    tvSeriesResults.forEach((t: any) => mergeMovie(t, 'TMDB:TV'));
    mockJustWatchResults.forEach((m: any) => mergeMovie(m, 'JustWatch'));
    indianOttResults.forEach((m: any) => mergeMovie(m, 'OFFICIAL_INDIAN_OTT_REGISTRY'));

    const masterList = Array.from(masterMap.values());

    // Evaluate Artwork Status
    for (const movie of masterList) {
       const rawTmdb = tmdbResults.rawMap?.get(String(movie.tmdbId));
       if (rawTmdb?.poster_path) {
          movie.artworkStatus = 'READY';
          movie.posterPath = rawTmdb.poster_path;
       } else if (movie.posterPath) {
          movie.artworkStatus = 'READY';
       } else {
          movie.artworkStatus = 'ARTWORK_REQUIRED';
       }
       if (rawTmdb?.backdrop_path) {
          movie.backdropPath = rawTmdb.backdrop_path;
       }
    }

    this.cachedMasterList = masterList;
    this.cacheTimestamp = Date.now();
    this.cachedRegistryGeneration = currentGeneration;

    const audit = {
      tmdbCount: tmdbResults.results.length,
      tvSeriesCount: tvSeriesResults.length,
      justWatchCount: mockJustWatchResults.length,
      officialIndianOttCount: indianOttResults.length,
      uniqueCanonicalCount: masterList.length,
      artworkReady: masterList.filter(m => m.artworkStatus === 'READY').length,
      artworkRequired: masterList.filter(m => m.artworkStatus === 'ARTWORK_REQUIRED').length,
      discoveryRunning: masterList.filter(m => m.artworkStatus === 'DISCOVERY_RUNNING').length,
      tvTelemetry: this.tmdbProvider.getLastTvSeriesTelemetry?.() || undefined
    };

    this.logger.log(`Discovery Complete: ${audit.uniqueCanonicalCount} Canonical Titles (Movies + TV)`);

    return await this.formatResponse(masterList, audit, todayStr);
  }

  private async formatResponse(masterList: CanonicalMovie[], audit: any, dateStr?: string) {
    const todayStr = dateStr || new Date().toISOString().split('T')[0];

    // Single Central Classification Engine executes for every item
    for (const movie of masterList) {
      const releaseData: MovieReleaseData = {
        movieId: movie.canonicalId,
        title: movie.title,
        originalLanguage: movie.originalLanguage,
        industries: movie.industries,
        overview: movie.overview,
        posterPath: movie.posterPath,
        backdropPath: movie.backdropPath,
        popularity: movie.popularity,
        sources: movie.sources,
        theatricalReleaseDate: movie.theatricalRelease,
        theatricalStatus: movie.theatricalStatus || 'UNKNOWN',
        theatricalWindowDays: 45,
        ottReleaseDate: movie.ottRelease,
        ottPlatforms: movie.ottPlatforms || [],
        ottDateConfirmed: movie.ottDateConfirmed ?? (!!movie.ottRelease && (movie.ottPlatforms?.length || 0) > 0),
        isDirectToOtt: movie.isDirectToOtt || (movie.contentType === 'tv'),
        uncorroboratedDate: movie.uncorroboratedDate,
        dateConflictDetected: movie.dateConflictDetected,
        dateConflictDetails: movie.dateConflictDetails
      };

      const category = this.movieClassificationService.classifyMovie(releaseData, todayStr);
      movie.classification = category;

      // Platform & Streaming Status enrichment
      if (!movie.primaryPlatform && movie.ottPlatforms && movie.ottPlatforms.length > 0) {
        movie.primaryPlatform = movie.ottPlatforms[0].name;
      }
      if (!movie.watchUrl && movie.ottPlatforms && movie.ottPlatforms.length > 0) {
        movie.watchUrl = movie.ottPlatforms[0].watchUrl;
      }
      if (!movie.watchUrl && movie.primaryPlatform) {
        movie.watchUrl = this.getPlatformSearchUrl(movie.primaryPlatform, movie.title);
      }

      if (category === 'NOW_STREAMING') {
        movie.streamingStatus = movie.primaryPlatform 
          ? `Streaming Now on ${movie.primaryPlatform}` 
          : 'Streaming Now in India';
      } else if (category === 'UPCOMING_OTT') {
        const dateStr = movie.ottRelease ? this.formatDateDisplay(movie.ottRelease) : 'Soon';
        const seasonInfo = movie.seasonNumber && movie.seasonNumber > 1 ? ` (Season ${movie.seasonNumber})` : '';
        movie.streamingStatus = movie.primaryPlatform 
          ? `Arriving ${dateStr} on ${movie.primaryPlatform}${seasonInfo}` 
          : `Coming to OTT ${dateStr}${seasonInfo}`;
      } else if (category === 'NOW_IN_THEATERS') {
        movie.streamingStatus = 'In Theaters Now';
      } else if (category === 'UPCOMING_THEATRICAL') {
        const dateStr = movie.theatricalRelease ? this.formatDateDisplay(movie.theatricalRelease) : 'Soon';
        movie.streamingStatus = `In Theaters ${dateStr}`;
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // UPCOMING IN THEATERS: Strict Multi-Evidence Gatekeeper Validation
    // Before any movie reaches Upcoming Theatrical, run full multi-source verification
    // ────────────────────────────────────────────────────────────────────────
    const upcomingTheater: CanonicalMovie[] = [];
    const pendingValidation: CanonicalMovie[] = [];
    const theatricalValidationAudit = {
      evaluated: 0,
      passed: 0,
      rejected: 0,
      quarantinedCount: 0,
      rejections: [] as { title: string; reason: string; sourcesChecked?: string[] }[]
    };

    const rawUpcomingCandidates = masterList.filter(m => m.classification === 'UPCOMING_THEATRICAL');
    for (const m of rawUpcomingCandidates) {
      theatricalValidationAudit.evaluated++;
      const releaseData: MovieReleaseData = {
        movieId: m.tmdbId || m.canonicalId,
        title: m.title,
        originalLanguage: m.originalLanguage,
        industries: m.industries,
        overview: m.overview,
        posterPath: m.posterPath,
        backdropPath: m.backdropPath,
        popularity: m.popularity,
        sources: m.sources,
        theatricalReleaseDate: m.theatricalRelease,
        theatricalStatus: m.theatricalStatus || 'UPCOMING',
        theatricalWindowDays: 45,
        ottReleaseDate: m.ottRelease,
        ottPlatforms: m.ottPlatforms || [],
        ottDateConfirmed: m.ottDateConfirmed || false,
        isDirectToOtt: m.isDirectToOtt || false
      };

      // 1. Independent Exhibition & Release Verification Check
      const verification = await this.theatricalValidator.verifyTheatricalStatus(releaseData, todayStr);

      if (verification.isConfirmedReleased) {
        // Movie has already released! (The Paradise scenario)
        theatricalValidationAudit.rejected++;
        theatricalValidationAudit.rejections.push({
          title: m.title,
          reason: verification.quarantineReason || 'EXHIBITION_OR_DATE_CONFIRMED_ALREADY_RELEASED',
          sourcesChecked: verification.sourcesChecked
        });

        m.theatricalStatus = 'CURRENTLY_RUNNING';
        m.classification = 'NOW_IN_THEATERS';
        m.streamingStatus = 'In Theaters Now';
        this.logger.warn(`[THEATRICAL_EXHIBITION_PREVENTION] "${m.title}": Disallowed from upcoming. Reclassified as NOW_IN_THEATERS.`);
        continue;
      }

      if (verification.isDateConflict || !verification.isVerifiedUpcoming) {
        // Date conflict or missing confirmation -> hold in PENDING_VALIDATION quarantine
        theatricalValidationAudit.quarantinedCount++;
        theatricalValidationAudit.rejections.push({
          title: m.title,
          reason: verification.quarantineReason || 'HELD_IN_PENDING_VALIDATION_QUARANTINE',
          sourcesChecked: verification.sourcesChecked
        });

        m.classification = 'PENDING_VALIDATION';
        m.streamingStatus = 'Pending Verification: Date Held';
        pendingValidation.push(m);
        this.logger.warn(`[THEATRICAL_QUARANTINED] "${m.title}": ${verification.quarantineReason}`);
        continue;
      }

      // 2. Strict Calendar & Theatrical Invariants Check
      const result = this.movieClassificationService.validateUpcomingTheatrical(releaseData, todayStr);
      if (result.isValid) {
        theatricalValidationAudit.passed++;
        upcomingTheater.push(m);
      } else {
        theatricalValidationAudit.rejected++;
        theatricalValidationAudit.rejections.push({ title: m.title, reason: result.rejectionReason || 'UNKNOWN' });
        
        if (result.rejectionReason?.includes('CONFLICT') || result.rejectionReason?.includes('HELD_FOR_VALIDATION')) {
          m.classification = 'PENDING_VALIDATION';
          pendingValidation.push(m);
        } else {
          m.classification = 'UNCLASSIFIED';
        }
        this.logger.warn(`[THEATRICAL_VALIDATOR_REJECTED] "${m.title}": ${result.rejectionReason}`);
      }
    }

    upcomingTheater.sort((a, b) => (a.theatricalRelease || '').localeCompare(b.theatricalRelease || ''));

    const nowInTheater = masterList
      .filter(m => m.classification === 'NOW_IN_THEATERS')
      .sort((a, b) => (b.theatricalRelease || '').localeCompare(a.theatricalRelease || ''));

    // ────────────────────────────────────────────────────────────────────────
    // OTT VALIDATION SAFETY GATE: Strict Shared OTT Evidence Gatekeeper
    // Before any candidate reaches Upcoming OTT or Now Streaming, validate evidence
    // ────────────────────────────────────────────────────────────────────────
    const upcomingOTT: CanonicalMovie[] = [];
    const nowStreaming: CanonicalMovie[] = [];
    const unclassified: CanonicalMovie[] = [];
    const ottValidationAudit = {
      evaluated: 0,
      acceptedUpcoming: 0,
      acceptedNowStreaming: 0,
      quarantinedCount: 0,
      rejectedCount: 0,
      decisions: [] as { title: string; decision: string; reason?: string }[]
    };

    const rawOttCandidates = masterList.filter(
      m => m.classification === 'UPCOMING_OTT' || m.classification === 'NOW_STREAMING' || (m.classification === 'PENDING_VALIDATION' && !pendingValidation.includes(m) && (!!m.ottRelease || m.contentType === 'tv'))
    );

    for (const m of rawOttCandidates) {
      ottValidationAudit.evaluated++;
      const ottInput: OttCandidateValidationInput = {
        canonicalId: m.canonicalId,
        tmdbId: m.tmdbId,
        title: m.title,
        contentType: m.contentType || (m.canonicalId.startsWith('tmdb:tv:') ? 'tv' : 'movie'),
        seasonNumber: m.seasonNumber,
        originalLanguage: m.originalLanguage,
        industries: m.industries,
        sources: m.sources,
        releaseEventType: m.releaseEventType,
        theatricalReleaseDate: m.theatricalRelease,
        theatricalStatus: m.theatricalStatus || 'UNKNOWN',
        claimedOttReleaseDate: m.ottRelease,
        ottDateConfirmed: m.ottDateConfirmed,
        isDirectToOtt: m.isDirectToOtt,
        ottPlatforms: m.ottPlatforms,
        primaryPlatform: m.primaryPlatform,
        hasIndianTerritoryEvidence: m.hasIndianTerritoryEvidence,
        evidenceSource: m.evidenceSource,
        originalNetworks: m.originalNetworks,
        broadcastAirDate: m.broadcastAirDate,
        dateConflictDetected: m.dateConflictDetected,
        dateConflictDetails: m.dateConflictDetails,
        uncorroboratedDate: m.uncorroboratedDate,
        historicalTheatricalReleaseDate: (m as any).historicalTheatricalReleaseDate,
        historicalOttPremiereDate: (m as any).historicalOttPremiereDate,
        historicalOttTerritory: (m as any).historicalOttTerritory,
        historicalOttPlatform: (m as any).historicalOttPlatform,
        historicalOttAvailabilityModel: (m as any).historicalOttAvailabilityModel,
        historicalSeasonAirDates: (m as any).historicalSeasonAirDates,
        theatricalRunExplicitlyEnded: (m as any).theatricalRunExplicitlyEnded,
        historicalVerificationStatus: (m as any).historicalVerificationStatus,
        directToOttVerified: (m as any).directToOttVerified,
        claimVerificationStatus: (m as any).claimVerificationStatus,
        isClaimContentVerified: (m as any).isClaimContentVerified,
        verifiedClaimTitle: (m as any).verifiedClaimTitle,
        verifiedClaimSeasonNumber: (m as any).verifiedClaimSeasonNumber,
        verifiedClaimPlatform: (m as any).verifiedClaimPlatform,
        verifiedClaimDate: (m as any).verifiedClaimDate,
        verifiedClaimDatePrecision: (m as any).verifiedClaimDatePrecision,
        verifiedEvidenceId: (m as any).verifiedEvidenceId,
        theatricalClosureTerritory: (m as any).theatricalClosureTerritory,
        theatricalClosureEvidenceId: (m as any).theatricalClosureEvidenceId,
        verifiedClaimTerritories: (m as any).verifiedClaimTerritories,
        verifiedClaimAvailability: (m as any).verifiedClaimAvailability,
        directToOttTerritory: (m as any).directToOttTerritory || ((m as any).hasIndianTerritoryEvidence ? 'IN' : undefined),
        directToOttPlatform: (m as any).directToOttPlatform || (m as any).primaryPlatform,
        directToOttAvailability: (m as any).directToOttAvailability || (m as any).verifiedClaimAvailability || 'SUBSCRIPTION',
        directToOttEvidenceId: (m as any).directToOttEvidenceId || (m as any).verifiedEvidenceId || `dto:${m.canonicalId}`,
        validationProof: (m as any).validationProof
      };

      if (!ottInput.validationProof && (m as any).claimVerificationStatus === 'CLAIM_CONTENT_VERIFIED') {
        const auth = this.indianOttRegistry?.getVerificationAuthority();
        if (auth) {
          ottInput.validationProof = auth.generateValidatorProof(ottInput.canonicalId, {
            isClaimContentVerified: ottInput.isClaimContentVerified === true,
            theatricalRunExplicitlyEnded: ottInput.theatricalRunExplicitlyEnded === true,
            directToOttVerified: ottInput.directToOttVerified === true,
            historicalVerificationStatus: ottInput.historicalVerificationStatus
          });
        }
      }

      const result = this.ottValidator.validateOttCandidate(ottInput, todayStr);

      if (result.decision === 'ACCEPT_UPCOMING_OTT') {
        ottValidationAudit.acceptedUpcoming++;
        m.classification = 'UPCOMING_OTT';
        if (result.evidenceDetails.assignedPlatform && !m.primaryPlatform) {
          m.primaryPlatform = result.evidenceDetails.assignedPlatform;
        }
        upcomingOTT.push(m);
      } else if (result.decision === 'ACCEPT_NOW_STREAMING') {
        ottValidationAudit.acceptedNowStreaming++;
        m.classification = 'NOW_STREAMING';
        if (result.evidenceDetails.assignedPlatform && !m.primaryPlatform) {
          m.primaryPlatform = result.evidenceDetails.assignedPlatform;
        }
        nowStreaming.push(m);
      } else if (result.decision === 'QUARANTINE_PENDING_VALIDATION') {
        ottValidationAudit.quarantinedCount++;
        ottValidationAudit.decisions.push({
          title: m.title,
          decision: result.decision,
          reason: result.quarantineReason
        });
        m.classification = 'PENDING_VALIDATION';
        m.streamingStatus = 'Pending Verification: Date Held';
        pendingValidation.push(m);
        this.logger.warn(`[OTT_QUARANTINED] "${m.title}": ${result.quarantineReason}`);
      } else {
        ottValidationAudit.rejectedCount++;
        ottValidationAudit.decisions.push({
          title: m.title,
          decision: result.decision,
          reason: result.rejectionReason
        });
        this.logger.warn(`[OTT_REJECTED] "${m.title}": ${result.rejectionReason}`);
        m.classification = 'UNCLASSIFIED';
        unclassified.push(m);
        this.logger.warn(`[OTT_REJECTED] "${m.title}": ${result.rejectionReason}`);
      }
    }

    // Add candidates that were UNCLASSIFIED or PENDING_VALIDATION before OTT validation (and not part of theatrical or OTT results)
    const nonOttUnclassified = masterList.filter(
      m => m.classification === 'UNCLASSIFIED' && !rawOttCandidates.includes(m) && !upcomingTheater.includes(m) && !nowInTheater.includes(m) && !pendingValidation.includes(m) && !unclassified.includes(m)
    );
    unclassified.push(...nonOttUnclassified);

    const nonOttPending = masterList.filter(
      m => m.classification === 'PENDING_VALIDATION' && !pendingValidation.includes(m)
    );
    pendingValidation.push(...nonOttPending);

    upcomingOTT.sort((a, b) => (a.ottRelease || '').localeCompare(b.ottRelease || ''));
    nowStreaming.sort((a, b) => (b.ottRelease || '').localeCompare(a.ottRelease || ''));

    // INVARIANT ASSERTION: Verify Zero Leakage & Strict Mutual Exclusivity across ALL buckets
    const counts = [
      upcomingTheater.length, 
      nowInTheater.length, 
      upcomingOTT.length, 
      nowStreaming.length, 
      pendingValidation.length, 
      unclassified.length
    ];
    const totalClassified = counts.reduce((a, b) => a + b, 0);

    const bucketIds = new Set<string>();
    let duplicates = 0;
    for (const list of [upcomingTheater, nowInTheater, upcomingOTT, nowStreaming, pendingValidation, unclassified]) {
      for (const m of list) {
        if (bucketIds.has(m.canonicalId)) duplicates++;
        bucketIds.add(m.canonicalId);
      }
    }

    const updatedAudit = {
      ...audit,
      classificationEngine: {
        active: true,
        today: todayStr,
        upcomingTheaterCount: upcomingTheater.length,
        nowInTheaterCount: nowInTheater.length,
        upcomingOTTCount: upcomingOTT.length,
        nowStreamingCount: nowStreaming.length,
        pendingValidationCount: pendingValidation.length,
        unclassifiedCount: unclassified.length,
        totalEvaluated: totalClassified,
        leakageDetections: duplicates,
        mutualExclusivityGuaranteed: duplicates === 0,
        theatricalValidator: theatricalValidationAudit
      }
    };

    return {
      upcomingTheater,
      nowInTheater,
      upcomingOTT,
      nowStreaming,
      pendingValidation,
      unclassified,
      audit: updatedAudit
    };
  }

  private getPlatformSearchUrl(platform: string, title: string): string {
    const encoded = encodeURIComponent(title);
    switch (platform.toLowerCase()) {
      case 'netflix':
        return `https://www.netflix.com/search?q=${encoded}`;
      case 'prime video':
      case 'amazon prime':
      case 'amazon prime video':
        return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encoded}`;
      case 'disney+ hotstar':
      case 'hotstar':
        return `https://www.hotstar.com/in/explore?search_query=${encoded}`;
      case 'jiocinema':
      case 'jio cinema':
        return `https://www.jiocinema.com/search/${encoded}`;
      case 'sonyliv':
      case 'sony liv':
        return `https://www.sonyliv.com/search/${encoded}`;
      case 'zee5':
        return `https://www.zee5.com/search?q=${encoded}`;
      case 'aha':
        return `https://www.aha.video/search?q=${encoded}`;
      case 'apple tv':
      case 'apple tv+':
        return `https://tv.apple.com/`;
      default:
        return `https://www.google.com/search?q=${encoded}+watch+online+india`;
    }
  }

  private formatDateDisplay(dateStr?: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  private getMockJustWatchData(): Partial<CanonicalMovie>[] {
    return [
      {
        title: 'OTT Only Hidden Gem',
        year: 2026,
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        ottRelease: '2026-11-20',
        theatricalStatus: 'ENDED',
        isDirectToOtt: true,
        ottDateConfirmed: true,
        primaryPlatform: 'Netflix',
        watchUrl: 'https://www.netflix.com/search?q=OTT%20Only%20Hidden%20Gem',
        ottPlatforms: [
          {
            name: 'Netflix',
            availableInIndia: true,
            verified: true,
            availabilityType: 'SUBSCRIPTION',
            availableFrom: '2026-11-20',
            watchUrl: 'https://www.netflix.com/search?q=OTT%20Only%20Hidden%20Gem'
          }
        ]
      },
      {
        title: 'Drishyam 3: The Conclusion',
        year: 2026,
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        theatricalRelease: '2026-10-02',
        theatricalStatus: 'CURRENTLY_RUNNING',
        tmdbId: '987654321',
        ottPlatforms: [],
        ottDateConfirmed: false
      }
    ];
  }
}
