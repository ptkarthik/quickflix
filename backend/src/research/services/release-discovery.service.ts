import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
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

@Injectable()
export class ReleaseDiscoveryService {
  private readonly logger = new Logger(ReleaseDiscoveryService.name);
  
  private cachedMasterList: CanonicalMovie[] | null = null;
  private cacheTimestamp = 0;

  constructor(
    private readonly tmdbProvider: TmdbProvider,
    @Inject(forwardRef(() => MovieArtworkService))
    private readonly artworkService: MovieArtworkService,
    private readonly movieClassificationService: MovieClassificationService,
    private readonly theatricalValidator: TheatricalValidatorService
  ) {}

  async discoverAll(): Promise<{
    upcomingTheater: CanonicalMovie[];
    nowInTheater: CanonicalMovie[];
    upcomingOTT: CanonicalMovie[];
    nowStreaming: CanonicalMovie[];
    pendingValidation: CanonicalMovie[];
    unclassified: CanonicalMovie[];
    audit: any;
  }> {
    if (this.cachedMasterList && (Date.now() - this.cacheTimestamp < 1000 * 60 * 5)) {
       return this.formatResponse(this.cachedMasterList, { cached: true });
    }

    this.logger.log('Starting Multi-Source Release Discovery...');

    // Live TMDB discovery (exhaustive authentic catalog)
    const tmdbResults = await this.tmdbProvider.discoverAllRaw();
    const mockJustWatchResults: Partial<CanonicalMovie>[] = [];

    // NORMALIZE & DEDUPLICATE (Source Union Architecture)
    const masterMap = new Map<string, CanonicalMovie>();

    const mergeMovie = (movie: Partial<CanonicalMovie>, sourceName: string) => {
       // Primary key is tmdbId if available, otherwise fallback to normalized title+year
       const key = movie.tmdbId ? `tmdb:${movie.tmdbId}` : `title:${movie.title?.toLowerCase().replace(/\s+/g, '')}:${movie.year}`;
       
       if (masterMap.has(key)) {
         const existing = masterMap.get(key)!;
         if (!existing.sources.includes(sourceName)) existing.sources.push(sourceName);
         if (!existing.theatricalRelease && movie.theatricalRelease) existing.theatricalRelease = movie.theatricalRelease;
         if (!existing.ottRelease && movie.ottRelease) existing.ottRelease = movie.ottRelease;
         if (movie.theatricalStatus && (!existing.theatricalStatus || existing.theatricalStatus === 'UNKNOWN')) {
           existing.theatricalStatus = movie.theatricalStatus;
         }
         if (movie.ottDateConfirmed) existing.ottDateConfirmed = true;
         if (movie.isDirectToOtt) existing.isDirectToOtt = true;
         if (movie.primaryPlatform && !existing.primaryPlatform) existing.primaryPlatform = movie.primaryPlatform;
         if (movie.watchUrl && !existing.watchUrl) existing.watchUrl = movie.watchUrl;
         if (movie.streamingStatus && !existing.streamingStatus) existing.streamingStatus = movie.streamingStatus;
         if (movie.ottPlatforms && movie.ottPlatforms.length > 0) {
           existing.ottPlatforms = Array.from(new Set([...(existing.ottPlatforms || []), ...movie.ottPlatforms]));
         }
         if (movie.industries) {
           existing.industries = Array.from(new Set([...existing.industries, ...movie.industries]));
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
           isDirectToOtt: movie.isDirectToOtt || false,
           sources: [sourceName],
           artworkStatus: 'DISCOVERY_RUNNING',
           classification: movie.classification || 'UNCLASSIFIED',
           tmdbId: movie.tmdbId,
           overview: movie.overview,
           popularity: movie.popularity,
           posterPath: movie.posterPath,
           backdropPath: (movie as any).backdropPath
         });
       }
    };

    tmdbResults.results.forEach((m: any) => mergeMovie(m, 'TMDB'));
    mockJustWatchResults.forEach((m: any) => mergeMovie(m, 'JustWatch'));

    const masterList = Array.from(masterMap.values());

    // Evaluate Artwork Status
    for (const movie of masterList) {
       const rawTmdb = tmdbResults.rawMap.get(String(movie.tmdbId));
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

    const audit = {
      tmdbCount: tmdbResults.results.length,
      justWatchCount: mockJustWatchResults.length,
      uniqueCanonicalCount: masterList.length,
      artworkReady: masterList.filter(m => m.artworkStatus === 'READY').length,
      artworkRequired: masterList.filter(m => m.artworkStatus === 'ARTWORK_REQUIRED').length,
      discoveryRunning: masterList.filter(m => m.artworkStatus === 'DISCOVERY_RUNNING').length,
    };

    this.logger.log(`Discovery Complete: ${audit.uniqueCanonicalCount} Canonical Movies`);

    return await this.formatResponse(masterList, audit);
  }

  private async formatResponse(masterList: CanonicalMovie[], audit: any) {
    const todayStr = new Date().toISOString().split('T')[0];

    // Single Central Classification Engine executes for every movie
    for (const movie of masterList) {
      const releaseData: MovieReleaseData = {
        movieId: movie.tmdbId || movie.canonicalId,
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
        isDirectToOtt: movie.isDirectToOtt || false
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
        movie.streamingStatus = movie.primaryPlatform 
          ? `Arriving ${dateStr} on ${movie.primaryPlatform}` 
          : `Coming to OTT ${dateStr}`;
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

    const upcomingOTT = masterList
      .filter(m => m.classification === 'UPCOMING_OTT')
      .sort((a, b) => (a.ottRelease || '').localeCompare(b.ottRelease || ''));

    const nowStreaming = masterList
      .filter(m => m.classification === 'NOW_STREAMING')
      .sort((a, b) => (b.ottRelease || '').localeCompare(a.ottRelease || ''));

    const unclassified = masterList
      .filter(m => m.classification === 'UNCLASSIFIED');

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
