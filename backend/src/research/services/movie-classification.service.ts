import { Injectable, Logger } from '@nestjs/common';

export type MovieCategory =
  | 'UPCOMING_THEATRICAL'
  | 'NOW_IN_THEATERS'
  | 'UPCOMING_OTT'
  | 'NOW_STREAMING'
  | 'PENDING_VALIDATION'
  | 'UNCLASSIFIED';

export type TheatricalStatus =
  | 'UPCOMING'
  | 'CURRENTLY_RUNNING'
  | 'ENDED'
  | 'UNKNOWN';

export type OttAvailabilityType = 'SUBSCRIPTION' | 'RENTAL' | 'PURCHASE';

export interface OttPlatformInfo {
  name: string;
  availableInIndia: boolean;
  verified: boolean;
  availableFrom?: string; // YYYY-MM-DD
  availableUntil?: string; // YYYY-MM-DD
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

  // Theatrical data
  theatricalReleaseDate?: string; // YYYY-MM-DD (India specific)
  theatricalStatus: TheatricalStatus;
  theatricalWindowDays?: number; // Default 45 days in India

  // OTT data
  ottReleaseDate?: string; // YYYY-MM-DD (India specific)
  ottPlatforms: OttPlatformInfo[];
  ottDateConfirmed: boolean;
  isDirectToOtt?: boolean;

  // Multi-source verification & conflict signals
  imdbId?: string;
  hasExhibitionEvidence?: boolean;
  exhibitionConfirmedPast?: boolean;
  dateConflictDetected?: boolean;
  dateConflictDetails?: string;
  uncorroboratedDate?: boolean;
}

@Injectable()
export class MovieClassificationService {
  private readonly logger = new Logger(MovieClassificationService.name);

  // Standard Indian theatrical run window in days
  public static readonly DEFAULT_THEATRICAL_WINDOW_DAYS = 45;

  /**
   * Validates if a date string is in strict YYYY-MM-DD format and is a valid calendar date
   */
  public isValidDateStr(dateStr?: string | null): boolean {
    if (!dateStr || typeof dateStr !== 'string') return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && dateStr.startsWith(d.toISOString().substring(0, 10));
  }

  /**
   * Helper to compute day difference: (date1 - date2) in days
   */
  public daysDifference(targetDate: string, baseDate: string): number {
    const t = new Date(targetDate).getTime();
    const b = new Date(baseDate).getTime();
    return Math.round((t - b) / (1000 * 60 * 60 * 24));
  }

  /**
   * Computes theatrical status if set to UNKNOWN or missing based on release date & today's date
   */
  public resolveTheatricalStatus(
    theatricalDate?: string | null,
    todayStr?: string,
    explicitStatus?: TheatricalStatus,
    windowDays: number = MovieClassificationService.DEFAULT_THEATRICAL_WINDOW_DAYS
  ): TheatricalStatus {
    const today = todayStr || new Date().toISOString().split('T')[0];

    // Calendar check is paramount: If a movie has a valid theatrical release date,
    // the calendar date is authoritative over any upstream provider status.
    if (theatricalDate && this.isValidDateStr(theatricalDate)) {
      if (theatricalDate <= today) {
        const daysSinceRelease = this.daysDifference(today, theatricalDate);
        if (daysSinceRelease >= 0 && daysSinceRelease <= windowDays) {
          return 'CURRENTLY_RUNNING';
        }
        return 'ENDED';
      } else {
        return 'UPCOMING';
      }
    }

    if (explicitStatus && explicitStatus !== 'UNKNOWN') {
      return explicitStatus;
    }

    return 'UNKNOWN';
  }

  /**
   * Core classification engine:
   * Enforces strict eligibility and mutual exclusivity across tabs.
   *
   * PRECEDENCE & ELIGIBILITY:
   * 1. NOW_STREAMING:
   *    - Has verified subscription streaming on an Indian OTT platform available on `today`
   *    - Overrides theatrical status (if in cinemas & already streaming, NOW_STREAMING takes precedence)
   *
   * 2. NOW_IN_THEATERS:
   *    - Currently running in Indian theaters (`theatricalStatus === 'CURRENTLY_RUNNING'`)
   *    - Not active on Indian OTT
   *    - Not direct-to-OTT
   *
   * 3. UPCOMING_OTT:
   *    - Confirmed future Indian OTT premiere (`ottReleaseDate > today` and `ottDateConfirmed`)
   *    - Not currently running in theaters (unless theatrical run has ended or direct-to-OTT)
   *    - Not active on Indian OTT
   *    - Must have verified Indian platform availability
   *
   * 4. UPCOMING_THEATRICAL:
   *    - Theatrical release date in the future (`theatricalReleaseDate > today`)
   *    - Theatrical status is UPCOMING
   *    - Not active on Indian OTT
   *    - Not direct-to-OTT
   *
   * 5. UNCLASSIFIED:
   *    - Movie has completed theatrical run and has no confirmed OTT premiere
   *    - Unconfirmed OTT announcements
   *    - Rental/purchase only without subscription streaming
   *    - Incomplete/unverified dates
   */
  public classifyMovie(movie: MovieReleaseData, todayStr?: string): MovieCategory {
    const today = todayStr || new Date().toISOString().split('T')[0];

    // 1. Check for Active Indian Subscription OTT Streaming
    const activeIndianSubscriptionOtt = movie.ottPlatforms.some((p) => {
      if (!p.availableInIndia || !p.verified) return false;
      // Must be subscription streaming (flatrate), NOT rental or purchase only
      if (p.availabilityType && p.availabilityType !== 'SUBSCRIPTION') return false;

      // Validate availability window
      if (p.availableFrom && this.isValidDateStr(p.availableFrom) && p.availableFrom > today) {
        return false; // Not yet available
      }
      // If platform availableFrom is unset, but movie has confirmed future ottReleaseDate > today, it is not yet available
      if (!p.availableFrom && this.isValidDateStr(movie.ottReleaseDate) && movie.ottReleaseDate! > today) {
        return false;
      }
      if (p.availableUntil && this.isValidDateStr(p.availableUntil) && p.availableUntil < today) {
        return false; // License expired
      }

      return true;
    });

    // Check if ottReleaseDate has arrived and is confirmed with an Indian platform
    const hasPremieredOtt =
      movie.ottDateConfirmed &&
      this.isValidDateStr(movie.ottReleaseDate) &&
      movie.ottReleaseDate! <= today &&
      movie.ottPlatforms.some((p) => p.availableInIndia && p.verified);

    // Rule 1: NOW_STREAMING takes precedence over everything
    if (activeIndianSubscriptionOtt || hasPremieredOtt) {
      return 'NOW_STREAMING';
    }

    // Resolve theatrical status
    const effectiveTheatricalStatus = this.resolveTheatricalStatus(
      movie.theatricalReleaseDate,
      today,
      movie.theatricalStatus,
      movie.theatricalWindowDays || MovieClassificationService.DEFAULT_THEATRICAL_WINDOW_DAYS
    );

    const isTheatricalUpcoming =
      effectiveTheatricalStatus === 'UPCOMING' &&
      this.isValidDateStr(movie.theatricalReleaseDate) &&
      movie.theatricalReleaseDate! > today;

    const isTheatricalCurrentlyRunning =
      effectiveTheatricalStatus === 'CURRENTLY_RUNNING' &&
      !movie.isDirectToOtt &&
      this.isValidDateStr(movie.theatricalReleaseDate) &&
      movie.theatricalReleaseDate! <= today;

    const hasConfirmedFutureOtt =
      movie.ottDateConfirmed &&
      this.isValidDateStr(movie.ottReleaseDate) &&
      movie.ottReleaseDate! > today &&
      movie.ottPlatforms.some((p) => p.availableInIndia && p.verified);

    // Quarantine Rule: Conflicting, uncertain, or uncorroborated records enter PENDING_VALIDATION
    if (movie.dateConflictDetected || movie.uncorroboratedDate) {
      return 'PENDING_VALIDATION';
    }

    // Rule 2: NOW_IN_THEATERS
    // If a movie is currently running in theaters (or confirmed running by exhibition), it belongs in Now in Theaters.
    // While currently running in theaters, it does NOT leak to Upcoming OTT or Upcoming Theaters.
    if (isTheatricalCurrentlyRunning || (movie.exhibitionConfirmedPast && (!movie.theatricalReleaseDate || this.daysDifference(today, movie.theatricalReleaseDate) <= 45))) {
      return 'NOW_IN_THEATERS';
    }

    // Rule 3: UPCOMING_OTT
    // Show movies with confirmed future Indian OTT date whose theatrical run has ended or direct-to-OTT
    if (hasConfirmedFutureOtt && !isTheatricalCurrentlyRunning) {
      return 'UPCOMING_OTT';
    }

    // Rule 4: UPCOMING_THEATRICAL
    // Future Indian theatrical date, theatricalStatus is UPCOMING, zero exhibition conflict, passes all strict Indian theatrical validation rules
    if (isTheatricalUpcoming && !movie.isDirectToOtt && !movie.exhibitionConfirmedPast) {
      const validation = this.validateUpcomingTheatrical(movie, today);
      if (validation.isValid) {
        return 'UPCOMING_THEATRICAL';
      }
      // If rejected due to conflict or missing corroboration, hold in PENDING_VALIDATION
      if (validation.rejectionReason?.includes('CONFLICT') || validation.rejectionReason?.includes('HELD_FOR_VALIDATION')) {
        return 'PENDING_VALIDATION';
      }
    }

    return 'UNCLASSIFIED';
  }

  /**
   * Dedicated Strict Validator for Upcoming Indian Theatrical Releases
   * Enforces 100% accuracy for the Indian market before movies reach the UI:
   * 1. Rejects empty, test, or synthetic placeholder entities
   * 2. Requires a strictly future calendar release date (theatricalReleaseDate > today)
   * 3. Requires date within 365 days (rejects speculative far-future unconfirmed releases)
   * 4. Rejects movies currently running or ended in theaters
   * 5. Rejects movies with active Indian subscription OTT streaming (Netflix, Prime, Hotstar, Zee5, etc.)
   * 6. Rejects direct-to-OTT titles
   * 7. Validates Indian audience relevance (Indian language production or confirmed theatrical release in India)
   */
  public validateUpcomingTheatrical(
    movie: MovieReleaseData,
    todayStr?: string
  ): TheatricalValidationResult {
    const today = todayStr || new Date().toISOString().split('T')[0];
    const title = (movie.title || '').trim();

    // 1. Synthetic / Test / Empty entity check
    if (!title || title.length < 2) {
      return { isValid: false, rejectionReason: 'INVALID_TITLE_EMPTY' };
    }
    if (/^(test[:\s]|mock[:\s]|placeholder[:\s]|dummy[:\s])/i.test(title)) {
      return { isValid: false, rejectionReason: 'SYNTHETIC_TEST_ENTITY_REJECTED' };
    }

    // 2. Direct to OTT check
    if (movie.isDirectToOtt) {
      return { isValid: false, rejectionReason: 'DIRECT_TO_OTT_EXCLUDED_FROM_THEATRICAL' };
    }

    // 3. Indian Theatrical Date validity & format
    if (!movie.theatricalReleaseDate || !this.isValidDateStr(movie.theatricalReleaseDate)) {
      return { isValid: false, rejectionReason: 'MISSING_OR_INVALID_THEATRICAL_DATE' };
    }

    // 4. Strict Future Date check (Cannot be today or past)
    if (movie.theatricalReleaseDate <= today) {
      return {
        isValid: false,
        rejectionReason: 'THEATRICAL_DATE_ALREADY_PASSED_OR_RUNNING_TODAY'
      };
    }

    // 4b. Exhibition Evidence Check (Already ran or running in theaters)
    if (movie.exhibitionConfirmedPast) {
      return {
        isValid: false,
        rejectionReason: 'EXHIBITION_CONFIRMED_ALREADY_IN_OR_PAST_THEATERS'
      };
    }

    // 4c. Date Conflict Check (Independent sources disagree)
    if (movie.dateConflictDetected) {
      return {
        isValid: false,
        rejectionReason: `THEATRICAL_DATE_CONFLICT_DETECTED (${movie.dateConflictDetails || 'Discrepancy across sources'})`
      };
    }

    // 4d. Uncorroborated holding rule
    if (movie.uncorroboratedDate) {
      return {
        isValid: false,
        rejectionReason: 'UNCORROBORATED_DATE_HELD_FOR_VALIDATION'
      };
    }

    // 5. Realistic Release Horizon (within 365 days)
    const daysUntilRelease = this.daysDifference(movie.theatricalReleaseDate, today);
    if (daysUntilRelease > 365) {
      return {
        isValid: false,
        rejectionReason: 'THEATRICAL_DATE_TOO_DISTANT_OR_UNCONFIRMED'
      };
    }

    // 6. Theatrical Status check
    const effectiveStatus = this.resolveTheatricalStatus(
      movie.theatricalReleaseDate,
      today,
      movie.theatricalStatus,
      movie.theatricalWindowDays
    );
    if (effectiveStatus !== 'UPCOMING') {
      return {
        isValid: false,
        rejectionReason: `THEATRICAL_STATUS_NOT_UPCOMING (${effectiveStatus})`
      };
    }

    // 7. Active Indian OTT Streaming Check
    const activeIndianSubscriptionOtt = (movie.ottPlatforms || []).some((p) => {
      if (!p.availableInIndia || !p.verified) return false;
      if (p.availabilityType && p.availabilityType !== 'SUBSCRIPTION') return false;
      if (p.availableFrom && this.isValidDateStr(p.availableFrom) && p.availableFrom > today) {
        return false;
      }
      if (p.availableUntil && this.isValidDateStr(p.availableUntil) && p.availableUntil < today) {
        return false;
      }
      return true;
    });

    if (activeIndianSubscriptionOtt) {
      return {
        isValid: false,
        rejectionReason: 'ALREADY_STREAMING_ON_INDIAN_OTT'
      };
    }

    // Check if ottReleaseDate has already arrived with an Indian platform
    if (
      movie.ottDateConfirmed &&
      this.isValidDateStr(movie.ottReleaseDate) &&
      movie.ottReleaseDate! <= today &&
      (movie.ottPlatforms || []).some((p) => p.availableInIndia && p.verified)
    ) {
      return {
        isValid: false,
        rejectionReason: 'OTT_PREMIERE_ALREADY_PASSED_IN_INDIA'
      };
    }

    // 8. Indian Region Relevance
    const indianLangs = new Set(['hi', 'te', 'ta', 'ml', 'kn', 'bn', 'mr', 'pa', 'gu', 'or', 'as', 'ur']);
    const lang = (movie.originalLanguage || '').toLowerCase();
    const isIndianLang = indianLangs.has(lang);
    const indianIndustries = new Set(['bollywood', 'tollywood', 'kollywood', 'mollywood', 'sandalwood', 'bengali', 'marathi', 'punjabi']);
    const isIndianIndustry = (movie.industries || []).some((ind) => indianIndustries.has(ind.toLowerCase()));
    const hasIndiaSource = (movie.sources || []).some((s) => s.includes('IN') || s.includes('India'));

    // A movie qualifies if it's an Indian language/industry film, English/international release, or has Indian theatrical release date
    if (lang && !isIndianLang && !isIndianIndustry && !hasIndiaSource && lang !== 'en') {
      return {
        isValid: false,
        rejectionReason: 'NOT_RELEVANT_TO_INDIAN_THEATRICAL_MARKET'
      };
    }

    return {
      isValid: true,
      auditDetails: {
        movieId: movie.movieId,
        title: movie.title,
        theatricalDate: movie.theatricalReleaseDate,
        today,
        language: movie.originalLanguage,
        isIndianProduction: isIndianLang || isIndianIndustry,
        hasActiveIndianOtt: false,
        isDirectToOtt: false,
        daysUntilRelease
      }
    };
  }
}

