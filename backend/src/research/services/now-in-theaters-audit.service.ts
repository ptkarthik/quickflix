import { Injectable, Logger } from '@nestjs/common';
import { TmdbProvider, CandidateDiscoveryTelemetry, DiscoveredTheatricalCandidate } from '../providers/tmdb.provider';
import { 
  NowInTheatersValidatorService, 
  TheatricalClassificationStatus, 
  DiagnosticReasonCode, 
  TheatricalCandidateInput 
} from './now-in-theaters-validator.service';

export interface NowInTheatersAuditSummary {
  totalCandidatesEvaluated: number;
  confirmedNowInTheaters: number;
  recentReleaseUnconfirmedExhibition: number;
  excludedTheatricalRunEnded: number;
  nowStreaming: number;
  upcomingTheatrical: number;
  quarantinedMissingIndianEvent: number;
  quarantinedOverseasOnly: number;
  quarantinedDateConflict: number;
  quarantinedInvalidDate: number;
  uncorroboratedStaleDate: number;
}

export interface EvaluatedAuditCandidate {
  id: number | string;
  tmdbId: number | string;
  title: string;
  originalLanguage?: string;
  industry?: string;
  theatricalReleaseDate?: string;
  originalReleaseDate?: string;
  originalReleaseYear?: number;
  hasExplicitIndianTheatricalEvent: boolean;
  status: TheatricalClassificationStatus;
  reasonCode: DiagnosticReasonCode;
  isEligibleForPublicFeed: boolean;
  isSimultaneouslyStreaming: boolean;
  activeExhibitionConfirmed: boolean;
  diagnosticNotes: string;
  reReleaseEvent?: {
    isReRelease: true;
    reReleaseDate: string;
    originalReleaseDate: string;
    originalReleaseYear: number;
  };
}

export interface NowInTheatersAuditReport {
  timestamp: string;
  referenceDateStr: string;
  notice: string;
  exhibitionEvidenceProvider: 'NONE_INTEGRATED';
  activeExhibitionConfirmedCount: number;
  telemetry: CandidateDiscoveryTelemetry;
  breakdownByLanguage: Record<string, { industry: string; count: number }>;
  summary: NowInTheatersAuditSummary;
  quarantineAndExclusionBreakdown: Record<string, number>;
  candidates: EvaluatedAuditCandidate[];
}

@Injectable()
export class NowInTheatersAuditService {
  private readonly logger = new Logger(NowInTheatersAuditService.name);

  // Guard against duplicate simultaneous discovery scans from concurrent requests
  private activeAuditPromise: Promise<NowInTheatersAuditReport> | null = null;

  public static readonly SUPPORTED_LANGUAGES = [
    'hi', // Bollywood
    'ta', // Kollywood
    'te', // Tollywood
    'ml', // Mollywood
    'kn', // Sandalwood
    'bn', // Bengali
    'mr', // Marathi
    'pa', // Punjabi
    'gu', // Gujarati
    'or', // Odia
  ];

  public static readonly INDUSTRY_MAP: Record<string, string> = {
    hi: 'Bollywood',
    ta: 'Kollywood',
    te: 'Tollywood',
    ml: 'Mollywood',
    kn: 'Sandalwood',
    bn: 'Bengali',
    mr: 'Marathi',
    pa: 'Punjabi',
    gu: 'Gujarati',
    or: 'Odia',
  };

  constructor(
    private readonly tmdbProvider: TmdbProvider,
    private readonly validator: NowInTheatersValidatorService
  ) {}

  /**
   * Run the Stage 2 Diagnostic Audit:
   * 1. Multi-language recent-past Indian theatrical discovery (hi, ta, te, ml, kn, bn, mr, pa, gu, or)
   * 2. Strict Stage 1 calendar and event validation
   * 3. Zero fabrication of showtimes; explicitly reports exhibitionEvidenceProvider: "NONE_INTEGRATED"
   * 4. Completely isolated from the public feed and cache
   */
  public async runAudit(options?: { referenceDateStr?: string; windowDays?: number }): Promise<NowInTheatersAuditReport> {
    if (this.activeAuditPromise) {
      this.logger.log('[NowInTheatersAudit] Concurrent audit request detected; reusing active in-progress scan.');
      return this.activeAuditPromise;
    }

    this.activeAuditPromise = this.executeAudit(options).finally(() => {
      this.activeAuditPromise = null;
    });

    return this.activeAuditPromise;
  }

  private async executeAudit(options?: { referenceDateStr?: string; windowDays?: number }): Promise<NowInTheatersAuditReport> {
    const referenceDateStr = options?.referenceDateStr || this.validator.getIndiaTodayDateStr();
    const windowDays = options?.windowDays ?? 45;

    this.logger.log(`[NowInTheatersAudit] Starting Stage 2 Diagnostic Audit for referenceDate=${referenceDateStr}, windowDays=${windowDays}...`);

    // 1. Ingest recent-past candidates across all 10 Indian regional languages
    const { candidates: discovered, telemetry } = await this.tmdbProvider.discoverRecentPastTheatricalCandidates({
      referenceDateStr,
      windowDays,
      languages: NowInTheatersAuditService.SUPPORTED_LANGUAGES,
    });

    // 2. Initialize breakdown structures
    const breakdownByLanguage: Record<string, { industry: string; count: number }> = {};
    for (const lang of NowInTheatersAuditService.SUPPORTED_LANGUAGES) {
      breakdownByLanguage[lang] = {
        industry: NowInTheatersAuditService.INDUSTRY_MAP[lang] || 'Other',
        count: 0,
      };
    }

    const summary: NowInTheatersAuditSummary = {
      totalCandidatesEvaluated: discovered.length,
      confirmedNowInTheaters: 0,
      recentReleaseUnconfirmedExhibition: 0,
      excludedTheatricalRunEnded: 0,
      nowStreaming: 0,
      upcomingTheatrical: 0,
      quarantinedMissingIndianEvent: 0,
      quarantinedOverseasOnly: 0,
      quarantinedDateConflict: 0,
      quarantinedInvalidDate: 0,
      uncorroboratedStaleDate: 0,
    };

    const quarantineAndExclusionBreakdown: Record<string, number> = {};

    // 3. Evaluate each discovered candidate through NowInTheatersValidatorService
    const evaluatedCandidates: EvaluatedAuditCandidate[] = [];

    for (const raw of discovered) {
      const lang = raw.originalLanguage || 'unknown';
      if (breakdownByLanguage[lang]) {
        breakdownByLanguage[lang].count++;
      } else {
        breakdownByLanguage[lang] = {
          industry: NowInTheatersAuditService.INDUSTRY_MAP[lang] || 'Other',
          count: 1,
        };
      }

      const input: TheatricalCandidateInput = {
        title: raw.title,
        originalLanguage: raw.originalLanguage,
        originalReleaseDate: raw.originalReleaseDate,
        originalReleaseYear: raw.originalReleaseYear,
        theatricalReleaseDate: raw.theatricalReleaseDate,
        hasExplicitIndianTheatricalEvent: raw.hasExplicitIndianTheatricalEvent,
        indianReleaseEvents: raw.indianReleaseEvents,
        foreignReleaseEvents: raw.foreignReleaseEvents,
        reReleaseEvent: raw.reReleaseEvent
          ? {
              isReRelease: true,
              reReleaseDate: raw.reReleaseEvent.reReleaseDate,
              originalReleaseDate: raw.reReleaseEvent.originalReleaseDate,
              originalReleaseYear: raw.reReleaseEvent.originalReleaseYear,
              reReleaseCountry: 'IN',
              reReleaseType: 'THEATRICAL_RE_RELEASE',
              evidenceSource: 'TMDB_IN_RE_RELEASE_EVENT',
              evidenceConfidence: 'HIGH',
            }
          : undefined,
        isStreamingInIndia: raw.isStreamingInIndia,
        streamingPlatforms: raw.ottPlatforms?.map((p: any) => p.name),
        // HARD INVARIANT: No live cinema showtime provider is currently integrated.
        // We strictly pass activeExhibition: undefined to prevent fabricated screenings.
        activeExhibition: undefined,
        tmdbId: raw.tmdbId,
      };

      const result = this.validator.validateTheatricalCandidate(input, referenceDateStr);

      // Record status metrics
      switch (result.status) {
        case 'CONFIRMED_NOW_IN_THEATERS':
          summary.confirmedNowInTheaters++;
          break;
        case 'RECENT_RELEASE_UNCONFIRMED_EXHIBITION':
          summary.recentReleaseUnconfirmedExhibition++;
          break;
        case 'EXCLUDED_THEATRICAL_RUN_ENDED':
          summary.excludedTheatricalRunEnded++;
          break;
        case 'NOW_STREAMING':
          summary.nowStreaming++;
          break;
        case 'UPCOMING_THEATRICAL':
          summary.upcomingTheatrical++;
          break;
        case 'QUARANTINED_MISSING_INDIAN_EVENT':
          summary.quarantinedMissingIndianEvent++;
          break;
        case 'QUARANTINED_OVERSEAS_ONLY':
          summary.quarantinedOverseasOnly++;
          break;
        case 'QUARANTINED_DATE_CONFLICT':
          summary.quarantinedDateConflict++;
          break;
        case 'QUARANTINED_INVALID_DATE':
          summary.quarantinedInvalidDate++;
          break;
        case 'UNCORROBORATED_STALE_DATE':
          summary.uncorroboratedStaleDate++;
          break;
      }

      // Record reason code distribution
      quarantineAndExclusionBreakdown[result.reasonCode] = (quarantineAndExclusionBreakdown[result.reasonCode] || 0) + 1;

      evaluatedCandidates.push({
        id: raw.id,
        tmdbId: raw.tmdbId,
        title: raw.title,
        originalLanguage: raw.originalLanguage,
        industry: NowInTheatersAuditService.INDUSTRY_MAP[lang] || 'Other',
        theatricalReleaseDate: result.theatricalDateUsed || raw.theatricalReleaseDate,
        originalReleaseDate: raw.originalReleaseDate,
        originalReleaseYear: raw.originalReleaseYear,
        hasExplicitIndianTheatricalEvent: raw.hasExplicitIndianTheatricalEvent,
        status: result.status,
        reasonCode: result.reasonCode,
        isEligibleForPublicFeed: result.isEligibleForPublicFeed,
        isSimultaneouslyStreaming: result.isSimultaneouslyStreaming,
        activeExhibitionConfirmed: result.activeExhibitionConfirmed,
        diagnosticNotes: result.diagnosticNotes,
        reReleaseEvent: raw.reReleaseEvent
          ? {
              isReRelease: true,
              reReleaseDate: raw.reReleaseEvent.reReleaseDate,
              originalReleaseDate: raw.reReleaseEvent.originalReleaseDate,
              originalReleaseYear: raw.reReleaseEvent.originalReleaseYear,
            }
          : undefined,
      });
    }

    const report: NowInTheatersAuditReport = {
      timestamp: new Date().toISOString(),
      referenceDateStr,
      notice: 'STAGE 2 DIAGNOSTIC ONLY: Discovery coverage is distinct from verified cinema exhibition. Zero live cinema showtime providers are currently integrated, so activeExhibitionConfirmedCount is 0 and no unconfirmed candidates are promoted to the public feed.',
      exhibitionEvidenceProvider: 'NONE_INTEGRATED',
      activeExhibitionConfirmedCount: 0,
      telemetry,
      breakdownByLanguage,
      summary,
      quarantineAndExclusionBreakdown,
      candidates: evaluatedCandidates,
    };

    this.logger.log(
      `[NowInTheatersAudit] Audit complete: ${evaluatedCandidates.length} candidates evaluated across ${NowInTheatersAuditService.SUPPORTED_LANGUAGES.length} languages. Unconfirmed: ${summary.recentReleaseUnconfirmedExhibition}, Quarantined/Excluded: ${summary.totalCandidatesEvaluated - summary.recentReleaseUnconfirmedExhibition}. Confirmed screenings: 0 (No live provider).`
    );

    return report;
  }
}
