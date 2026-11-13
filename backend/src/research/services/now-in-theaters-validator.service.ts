import { Injectable, Logger } from '@nestjs/common';

export type TheatricalClassificationStatus =
  // 1. Confirmed Active Theatrical Run (Eligible for Public nowInTheater Feed)
  | 'CONFIRMED_NOW_IN_THEATERS'

  // 2. Unconfirmed Exhibition (Diagnostic Only; Strictly EXCLUDED from Public Feed)
  | 'RECENT_RELEASE_UNCONFIRMED_EXHIBITION'

  // 3. Theatrical Run Terminated (No Active Showtimes Found)
  | 'EXCLUDED_THEATRICAL_RUN_ENDED'

  // 4. Exclusively Available on Streaming
  | 'NOW_STREAMING'

  // 5. Genuinely Future Release
  | 'UPCOMING_THEATRICAL'

  // 6. Quarantined Due to Missing or Conflicting Evidence
  | 'QUARANTINED_MISSING_INDIAN_EVENT'
  | 'QUARANTINED_OVERSEAS_ONLY'
  | 'QUARANTINED_DATE_CONFLICT'
  | 'QUARANTINED_INVALID_DATE'
  | 'UNCORROBORATED_STALE_DATE';

export type DiagnosticReasonCode =
  | 'EXHIBITION_CONFIRMED_FRESH_SHOWTIMES'
  | 'EXHIBITION_CONFIRMED_EXTENDED_RUN'
  | 'EXHIBITION_CONFIRMED_COEXISTING_OTT'
  | 'EXHIBITION_CONFIRMED_RE_RELEASE'
  | 'RECENT_RELEASE_AWAITING_SHOWTIME_EVIDENCE'
  | 'THEATRICAL_RUN_ENDED_NO_SHOWTIMES'
  | 'NOW_STREAMING_EXCLUSIVITY'
  | 'NO_INDIAN_THEATRICAL_RELEASE_EVENT'
  | 'OVERSEAS_DATE_NOT_APPLICABLE_TO_INDIA'
  | 'DATE_CONFLICT_TMDB_VS_OMDB'
  | 'INVALID_CALENDAR_DATE_FORMAT'
  | 'UNCORROBORATED_PAST_DATE'
  | 'FUTURE_THEATRICAL_DATE';

export interface IndianTheatricalReReleaseEvent {
  isReRelease: true;
  originalReleaseDate: string;
  originalReleaseYear: number;
  reReleaseDate: string;
  reReleaseCountry: 'IN';
  reReleaseType: 'THEATRICAL_RE_RELEASE';
  evidenceSource: 'TMDB_IN_RE_RELEASE_EVENT' | 'AUDITED_SHOWTIME_EXHIBITION' | 'TRADE_REGISTRY';
  evidenceConfidence: 'HIGH' | 'MEDIUM' | 'UNVERIFIED';
  activeShowtimeEvidence?: boolean;
  notes?: string;
}

export interface ActiveExhibitionEvidence {
  hasConfirmedActiveShowtimes: boolean;
  source: 'LIVE_TICKETING_API' | 'AUDITED_SHOWTIME_FIXTURE' | 'NONE';
  verifiedAt?: string;
  circuitsChecked?: string[];
  notes?: string;
}

export interface TheatricalCandidateInput {
  title: string;
  originalLanguage?: string;
  originalReleaseDate?: string;
  originalReleaseYear?: number;
  theatricalReleaseDate?: string;
  hasExplicitIndianTheatricalEvent: boolean;
  indianReleaseEvents?: Array<{ type: number; date: string }>;
  foreignReleaseEvents?: Array<{ country: string; type: number; date: string }>;
  reReleaseEvent?: IndianTheatricalReReleaseEvent;
  isStreamingInIndia?: boolean;
  streamingPlatforms?: string[];
  omdbReleasedDate?: string;
  activeExhibition?: ActiveExhibitionEvidence;
  tmdbId?: string | number;
  uncorroboratedDate?: boolean;
}

export interface TheatricalValidationResult {
  title: string;
  status: TheatricalClassificationStatus;
  reasonCode: DiagnosticReasonCode;
  isEligibleForPublicFeed: boolean;
  theatricalDateUsed?: string;
  originalReleaseDate?: string;
  originalReleaseYear?: number;
  reReleaseEvent?: IndianTheatricalReReleaseEvent;
  isSimultaneouslyStreaming: boolean;
  activeExhibitionConfirmed: boolean;
  evidenceConfidence: 'HIGH' | 'MEDIUM' | 'UNVERIFIED';
  diagnosticNotes: string;
}

@Injectable()
export class NowInTheatersValidatorService {
  private readonly logger = new Logger(NowInTheatersValidatorService.name);

  /**
   * India Calendar Date (Asia/Kolkata): Derives the date-only representation (YYYY-MM-DD)
   * strictly in Indian Standard Time (IST, UTC+05:30), avoiding UTC instant drift.
   */
  public getIndiaTodayDateStr(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  /**
   * Strict Calendar Date Validator:
   * 1. Requires exact YYYY-MM-DD format (/^\d{4}-\d{2}-\d{2}$/).
   * 2. Rejects non-string, missing, or malformed input.
   * 3. Validates calendar reality (leap years, month lengths: 28-31 days).
   * 4. Prevents JavaScript Date rollover (e.g. 2026-02-30 -> March 2).
   */
  public isValidCalendarDate(dateStr?: any): boolean {
    if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return false;
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    if (year < 1888 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }

    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const daysInMonth = [0, 31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    return day <= daysInMonth[month];
  }

  /**
   * Calendar Date Difference: Date-only subtraction normalized to UTC midnight.
   * Returns: laterDate - earlierDate in days.
   */
  public calculateCalendarDaysDiff(earlierDateStr: string, laterDateStr: string): number {
    if (!this.isValidCalendarDate(earlierDateStr) || !this.isValidCalendarDate(laterDateStr)) {
      throw new Error(
        `Invalid calendar date passed to calculateCalendarDaysDiff: earlier="${earlierDateStr}", later="${laterDateStr}"`
      );
    }
    const parseUtcMidnight = (s: string) => {
      const parts = s.split('-').map(Number);
      return Date.UTC(parts[0], parts[1] - 1, parts[2]);
    };
    const diffMs = parseUtcMidnight(laterDateStr) - parseUtcMidnight(earlierDateStr);
    return Math.floor(diffMs / 86400000);
  }

  /**
   * Core validation method for a single Now in Theaters candidate
   */
  public validateTheatricalCandidate(
    input: TheatricalCandidateInput,
    todayStr?: string
  ): TheatricalValidationResult {
    const today = (todayStr && this.isValidCalendarDate(todayStr))
      ? todayStr
      : this.getIndiaTodayDateStr();

    // 0. Strict Date Validation on candidate release dates
    const rawTheatricalDate = input.theatricalReleaseDate;
    if (rawTheatricalDate !== undefined && !this.isValidCalendarDate(rawTheatricalDate)) {
      return {
        title: input.title,
        status: 'QUARANTINED_INVALID_DATE',
        reasonCode: 'INVALID_CALENDAR_DATE_FORMAT',
        isEligibleForPublicFeed: false,
        theatricalDateUsed: typeof rawTheatricalDate === 'string' ? rawTheatricalDate : undefined,
        originalReleaseDate: input.originalReleaseDate,
        originalReleaseYear: input.originalReleaseYear,
        isSimultaneouslyStreaming: false,
        activeExhibitionConfirmed: false,
        evidenceConfidence: 'UNVERIFIED',
        diagnosticNotes: `Candidate theatrical release date "${rawTheatricalDate}" is non-string, malformed, or represents an impossible calendar date. Quarantined.`,
      };
    }

    if (input.reReleaseEvent && !this.isValidCalendarDate(input.reReleaseEvent.reReleaseDate)) {
      return {
        title: input.title,
        status: 'QUARANTINED_INVALID_DATE',
        reasonCode: 'INVALID_CALENDAR_DATE_FORMAT',
        isEligibleForPublicFeed: false,
        theatricalDateUsed: input.reReleaseEvent.reReleaseDate,
        originalReleaseDate: input.originalReleaseDate,
        originalReleaseYear: input.originalReleaseYear,
        isSimultaneouslyStreaming: false,
        activeExhibitionConfirmed: false,
        evidenceConfidence: 'UNVERIFIED',
        diagnosticNotes: `Candidate re-release date "${input.reReleaseEvent.reReleaseDate}" is malformed or represents an impossible calendar date. Quarantined.`,
      };
    }

    // Explicit Indian event must have a non-missing, non-empty date
    if (input.hasExplicitIndianTheatricalEvent && !rawTheatricalDate && !input.reReleaseEvent?.reReleaseDate) {
      return {
        title: input.title,
        status: 'QUARANTINED_INVALID_DATE',
        reasonCode: 'INVALID_CALENDAR_DATE_FORMAT',
        isEligibleForPublicFeed: false,
        theatricalDateUsed: undefined,
        originalReleaseDate: input.originalReleaseDate,
        originalReleaseYear: input.originalReleaseYear,
        isSimultaneouslyStreaming: false,
        activeExhibitionConfirmed: false,
        evidenceConfidence: 'UNVERIFIED',
        diagnosticNotes: 'Candidate claims explicit Indian theatrical event but has missing, null, or empty release date. Quarantined.',
      };
    }

    // 1. Future Date Invariant: strictly belongs to upcoming
    if (input.theatricalReleaseDate && input.theatricalReleaseDate > today) {
      return {
        title: input.title,
        status: 'UPCOMING_THEATRICAL',
        reasonCode: 'FUTURE_THEATRICAL_DATE',
        isEligibleForPublicFeed: false,
        theatricalDateUsed: input.theatricalReleaseDate,
        originalReleaseDate: input.originalReleaseDate,
        originalReleaseYear: input.originalReleaseYear,
        isSimultaneouslyStreaming: false,
        activeExhibitionConfirmed: false,
        evidenceConfidence: 'HIGH',
        diagnosticNotes: `Candidate date (${input.theatricalReleaseDate}) is in the future relative to ${today}. Belongs in Upcoming in Theaters.`,
      };
    }

    // 2. Strict Indian Theatrical Event Requirement (Zero Overseas Fallback)
    const effectiveTheatricalDate = input.theatricalReleaseDate || input.reReleaseEvent?.reReleaseDate;
    if (!input.hasExplicitIndianTheatricalEvent || !effectiveTheatricalDate) {
      if (input.foreignReleaseEvents && input.foreignReleaseEvents.length > 0) {
        return {
          title: input.title,
          status: 'QUARANTINED_OVERSEAS_ONLY',
          reasonCode: 'OVERSEAS_DATE_NOT_APPLICABLE_TO_INDIA',
          isEligibleForPublicFeed: false,
          originalReleaseDate: input.originalReleaseDate,
          originalReleaseYear: input.originalReleaseYear,
          isSimultaneouslyStreaming: false,
          activeExhibitionConfirmed: false,
          evidenceConfidence: 'UNVERIFIED',
          diagnosticNotes: `Candidate has foreign/festival release events (${input.foreignReleaseEvents.map((e) => e.country).join(',')}) but lacks an explicit Indian theatrical event. Strictly excluded.`,
        };
      }
      return {
        title: input.title,
        status: 'QUARANTINED_MISSING_INDIAN_EVENT',
        reasonCode: 'NO_INDIAN_THEATRICAL_RELEASE_EVENT',
        isEligibleForPublicFeed: false,
        originalReleaseDate: input.originalReleaseDate,
        originalReleaseYear: input.originalReleaseYear,
        isSimultaneouslyStreaming: false,
        activeExhibitionConfirmed: false,
        evidenceConfidence: 'UNVERIFIED',
        diagnosticNotes: 'Candidate entity exists in TMDB but lacks an explicit regional theatrical release event for India (country: IN, type: 2|3).',
      };
    }

    // 3. Multi-Source Date Conflict Check (TMDB Indian Theatrical vs OMDb Released)
    if (input.omdbReleasedDate && effectiveTheatricalDate) {
      if (!this.isValidCalendarDate(input.omdbReleasedDate)) {
        return {
          title: input.title,
          status: 'QUARANTINED_INVALID_DATE',
          reasonCode: 'INVALID_CALENDAR_DATE_FORMAT',
          isEligibleForPublicFeed: false,
          theatricalDateUsed: effectiveTheatricalDate,
          originalReleaseDate: input.originalReleaseDate,
          originalReleaseYear: input.originalReleaseYear,
          isSimultaneouslyStreaming: false,
          activeExhibitionConfirmed: false,
          evidenceConfidence: 'UNVERIFIED',
          diagnosticNotes: `OMDb reported release date "${input.omdbReleasedDate}" is malformed or impossible. Quarantined.`,
        };
      }
      const varianceDays = Math.abs(this.calculateCalendarDaysDiff(effectiveTheatricalDate, input.omdbReleasedDate));
      if (varianceDays > 7) {
        return {
          title: input.title,
          status: 'QUARANTINED_DATE_CONFLICT',
          reasonCode: 'DATE_CONFLICT_TMDB_VS_OMDB',
          isEligibleForPublicFeed: false,
          theatricalDateUsed: effectiveTheatricalDate,
          originalReleaseDate: input.originalReleaseDate,
          originalReleaseYear: input.originalReleaseYear,
          isSimultaneouslyStreaming: false,
          activeExhibitionConfirmed: false,
          evidenceConfidence: 'UNVERIFIED',
          diagnosticNotes: `Date conflict: TMDB reported Indian theatrical date ${effectiveTheatricalDate}, but OMDb reported ${input.omdbReleasedDate} (${varianceDays} days variance > 7d threshold).`,
        };
      }
    }

    // 4. Uncorroborated Stale Date Check
    if (input.uncorroboratedDate) {
      return {
        title: input.title,
        status: 'UNCORROBORATED_STALE_DATE',
        reasonCode: 'UNCORROBORATED_PAST_DATE',
        isEligibleForPublicFeed: false,
        theatricalDateUsed: input.theatricalReleaseDate,
        originalReleaseDate: input.originalReleaseDate,
        originalReleaseYear: input.originalReleaseYear,
        isSimultaneouslyStreaming: false,
        activeExhibitionConfirmed: false,
        evidenceConfidence: 'UNVERIFIED',
        diagnosticNotes: `Reported date ${input.theatricalReleaseDate} is in the past but lacks independent verification. Quarantined.`,
      };
    }

    // 5. Re-Release Event Model Check
    if (input.reReleaseEvent?.isReRelease) {
      const reRel = input.reReleaseEvent;
      const reRelAgeDays = this.calculateCalendarDaysDiff(reRel.reReleaseDate, today);

      if (input.activeExhibition?.hasConfirmedActiveShowtimes) {
        return {
          title: input.title,
          status: 'CONFIRMED_NOW_IN_THEATERS',
          reasonCode: 'EXHIBITION_CONFIRMED_RE_RELEASE',
          isEligibleForPublicFeed: true,
          theatricalDateUsed: reRel.reReleaseDate,
          originalReleaseDate: reRel.originalReleaseDate,
          originalReleaseYear: reRel.originalReleaseYear,
          reReleaseEvent: reRel,
          isSimultaneouslyStreaming: !!input.isStreamingInIndia,
          activeExhibitionConfirmed: true,
          evidenceConfidence: reRel.evidenceConfidence || 'HIGH',
          diagnosticNotes: `Confirmed active re-release: historical year ${reRel.originalReleaseYear} preserved; active showtimes verified for Indian re-release date ${reRel.reReleaseDate}.`,
        };
      }

      // Re-release without verified showtimes
      if (reRelAgeDays > 45) {
        return {
          title: input.title,
          status: 'EXCLUDED_THEATRICAL_RUN_ENDED',
          reasonCode: 'THEATRICAL_RUN_ENDED_NO_SHOWTIMES',
          isEligibleForPublicFeed: false,
          theatricalDateUsed: reRel.reReleaseDate,
          originalReleaseDate: reRel.originalReleaseDate,
          originalReleaseYear: reRel.originalReleaseYear,
          reReleaseEvent: reRel,
          isSimultaneouslyStreaming: !!input.isStreamingInIndia,
          activeExhibitionConfirmed: false,
          evidenceConfidence: 'MEDIUM',
          diagnosticNotes: `Re-release window elapsed (${reRelAgeDays} days since ${reRel.reReleaseDate}) with no active showtimes verified.`,
        };
      }

      return {
        title: input.title,
        status: 'RECENT_RELEASE_UNCONFIRMED_EXHIBITION',
        reasonCode: 'RECENT_RELEASE_AWAITING_SHOWTIME_EVIDENCE',
        isEligibleForPublicFeed: false,
        theatricalDateUsed: reRel.reReleaseDate,
        originalReleaseDate: reRel.originalReleaseDate,
        originalReleaseYear: reRel.originalReleaseYear,
        reReleaseEvent: reRel,
        isSimultaneouslyStreaming: !!input.isStreamingInIndia,
        activeExhibitionConfirmed: false,
        evidenceConfidence: 'UNVERIFIED',
        diagnosticNotes: `Re-release event recorded (${reRel.reReleaseDate}), but live showtime provider is unavailable. Excluded from public feed.`,
      };
    }

    // 6. Deciding Evidence Rule: Active Cinema Exhibition is Paramount
    // If active showtimes are independently verified, age alone (> 45 days) does NOT disqualify.
    const daysSinceRelease = this.calculateCalendarDaysDiff(effectiveTheatricalDate, today);

    if (input.activeExhibition?.hasConfirmedActiveShowtimes) {
      if (input.isStreamingInIndia) {
        return {
          title: input.title,
          status: 'CONFIRMED_NOW_IN_THEATERS',
          reasonCode: 'EXHIBITION_CONFIRMED_COEXISTING_OTT',
          isEligibleForPublicFeed: true,
          theatricalDateUsed: effectiveTheatricalDate,
          originalReleaseDate: input.originalReleaseDate,
          originalReleaseYear: input.originalReleaseYear,
          isSimultaneouslyStreaming: true,
          activeExhibitionConfirmed: true,
          evidenceConfidence: 'HIGH',
          diagnosticNotes: `Simultaneous exhibition & OTT: Active Indian cinema showtimes verified despite availability on streaming platforms.`,
        };
      }

      if (daysSinceRelease > 45) {
        return {
          title: input.title,
          status: 'CONFIRMED_NOW_IN_THEATERS',
          reasonCode: 'EXHIBITION_CONFIRMED_EXTENDED_RUN',
          isEligibleForPublicFeed: true,
          theatricalDateUsed: effectiveTheatricalDate,
          originalReleaseDate: input.originalReleaseDate,
          originalReleaseYear: input.originalReleaseYear,
          isSimultaneouslyStreaming: false,
          activeExhibitionConfirmed: true,
          evidenceConfidence: 'HIGH',
          diagnosticNotes: `Extended theatrical run: ${daysSinceRelease} days since release, but active cinema showtimes are independently confirmed. Age does not disqualify.`,
        };
      }

      return {
        title: input.title,
        status: 'CONFIRMED_NOW_IN_THEATERS',
        reasonCode: 'EXHIBITION_CONFIRMED_FRESH_SHOWTIMES',
        isEligibleForPublicFeed: true,
        theatricalDateUsed: effectiveTheatricalDate,
        originalReleaseDate: input.originalReleaseDate,
        originalReleaseYear: input.originalReleaseYear,
        isSimultaneouslyStreaming: false,
        activeExhibitionConfirmed: true,
        evidenceConfidence: 'HIGH',
        diagnosticNotes: `Active exhibition confirmed: fresh Indian cinema showtimes verified within the last 24h.`,
      };
    }

    // 7. Active Exhibition (Showtimes) is False or Unavailable
    // The system NEVER assumes a recent release date implies active screenings.
    if (daysSinceRelease > 45) {
      if (input.isStreamingInIndia) {
        return {
          title: input.title,
          status: 'NOW_STREAMING',
          reasonCode: 'NOW_STREAMING_EXCLUSIVITY',
          isEligibleForPublicFeed: false,
          theatricalDateUsed: effectiveTheatricalDate,
          originalReleaseDate: input.originalReleaseDate,
          originalReleaseYear: input.originalReleaseYear,
          isSimultaneouslyStreaming: true,
          activeExhibitionConfirmed: false,
          evidenceConfidence: 'HIGH',
          diagnosticNotes: `Theatrical run elapsed (${daysSinceRelease} days) and active on Indian OTT streaming. Classified as NOW_STREAMING.`,
        };
      }

      return {
        title: input.title,
        status: 'EXCLUDED_THEATRICAL_RUN_ENDED',
        reasonCode: 'THEATRICAL_RUN_ENDED_NO_SHOWTIMES',
        isEligibleForPublicFeed: false,
        theatricalDateUsed: effectiveTheatricalDate,
        originalReleaseDate: input.originalReleaseDate,
        originalReleaseYear: input.originalReleaseYear,
        isSimultaneouslyStreaming: false,
        activeExhibitionConfirmed: false,
        evidenceConfidence: 'MEDIUM',
        diagnosticNotes: `Theatrical run ended: ${daysSinceRelease} days since release with zero verified showtimes.`,
      };
    }

    // Within 0 to 45 days, but NO verified active exhibition evidence
    if (input.isStreamingInIndia) {
      return {
        title: input.title,
        status: 'NOW_STREAMING',
        reasonCode: 'NOW_STREAMING_EXCLUSIVITY',
        isEligibleForPublicFeed: false,
        theatricalDateUsed: effectiveTheatricalDate,
        originalReleaseDate: input.originalReleaseDate,
        originalReleaseYear: input.originalReleaseYear,
        isSimultaneouslyStreaming: true,
        activeExhibitionConfirmed: false,
        evidenceConfidence: 'HIGH',
        diagnosticNotes: `Streaming active on Indian OTT and no active cinema showtimes confirmed. Excluded from nowInTheater.`,
      };
    }

    return {
      title: input.title,
      status: 'RECENT_RELEASE_UNCONFIRMED_EXHIBITION',
      reasonCode: 'RECENT_RELEASE_AWAITING_SHOWTIME_EVIDENCE',
      isEligibleForPublicFeed: false,
      theatricalDateUsed: effectiveTheatricalDate,
      originalReleaseDate: input.originalReleaseDate,
      originalReleaseYear: input.originalReleaseYear,
      isSimultaneouslyStreaming: false,
      activeExhibitionConfirmed: false,
      evidenceConfidence: 'UNVERIFIED',
      diagnosticNotes: `Candidate released ${daysSinceRelease} days ago (${effectiveTheatricalDate}), but live cinema showtime provider is unavailable. Strictly excluded from public nowInTheater list.`,
    };
  }
}
