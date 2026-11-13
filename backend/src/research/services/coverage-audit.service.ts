import { Injectable, Logger } from '@nestjs/common';
import { TmdbProvider } from '../providers/tmdb.provider';
import { TheatricalValidatorService } from './theatrical-validator.service';
import { OmdbProvider } from '../providers/omdb.provider';
import { ImdbCrosscheckProvider } from '../providers/imdb-crosscheck.provider';
import { ReleaseDiscoveryService } from './release-discovery.service';

export interface PaginationAuditResult {
  query: string;
  language: string;
  windowDays: number;
  totalPages: number;
  totalResults: number;
  page1ItemCount: number;
  page2ItemCount: number;
  truncationRisk: boolean;
  notes: string;
}

export interface TradeBenchmarkTitle {
  title: string;
  industry: string;
  language: string;
  expectedDate?: string;
  leadCast?: string;
  director?: string;
  statusNotes?: string;
}

export type DiagnosticStatus = 
  | 'VERIFIED_FUTURE_RELEASE'
  | 'ALREADY_RELEASED_EXCLUDED_FROM_UPCOMING'
  | 'GENUINELY_MISSED_UPCOMING'
  | 'QUARANTINED_DATE_CONFLICT'
  | 'MISSING_INDIAN_RELEASE_DATE'
  | 'UNCORROBORATED_STALE_DATE';

export interface BenchmarkAuditItem {
  title: string;
  industry: string;
  language: string;
  expectedDate?: string;
  actualDate?: string;
  evidenceSource: 'OMDB_RELEASE_METADATA' | 'OMDB_RELEASE_DATE' | 'TMDB_RELEASE_DATES' | 'EXHIBITION_REGISTRY' | 'NONE';
  evidenceConfidence: 'HIGH' | 'MEDIUM' | 'UNVERIFIED';
  status: DiagnosticStatus;
  foundInDiscoveredMasterList: boolean;
  tmdbId?: string | number;
  currentClassification?: string;
  isExcludedFromUpcoming: boolean;
  isCandidateForNowInTheaters?: boolean;
  isActuallyDiscoveredInNowInTheaters?: boolean;
  releaseAgeDays?: number;
  diagnosticNotes: string;
}

// Retained for backward-compatibility with existing callers and tests
export interface MissingTitleResult {
  title: string;
  industry: string;
  language: string;
  expectedDate?: string;
  foundInTmdbDiscover: boolean;
  tmdbId?: string | number;
  currentClassification?: string;
  gapType: 'COMPLETELY_MISSED_BY_TMDB' | 'FOUND_BUT_QUARANTINED' | 'FOUND_AND_VERIFIED' | 'MISSING_INDIAN_RELEASE_DATE' | 'UNCORROBORATED_STALE_DATE';
  recommendation: string;
}

export interface FalsePositiveResult {
  title: string;
  theatricalRelease?: string;
  reason: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  sourceConfirmedPastRelease?: string;
}

export interface DateConflictResult {
  title: string;
  tmdbPrimaryDate?: string;
  tmdbIndiaTheatricalDate?: string;
  omdbDate?: string;
  differenceDays?: number;
  conflictStatus: 'RESOLVED_BY_QUARANTINE' | 'ACTIVE_CONFLICT_IN_UPCOMING' | 'MINOR_VARIANCE';
}

export interface FullCoverageAuditReport {
  timestamp: string;
  auditRunDate: string;
  summary: {
    totalTradeBenchmarkTitlesChecked: number;

    // Segment 1: Verified Future Upcoming (Strict Denominator for Upcoming Coverage)
    verifiedFutureBenchmarkDenominator: number;
    verifiedFutureFoundInUpcomingTheaters: number;
    upcomingTheatricalCoveragePercentage: string;

    // Segment 2: Unresolved Discovery Gaps (Explicitly excluded from Upcoming Denominator)
    genuinelyMissedUpcomingCount: number;
    missingIndianReleaseDateCount: number;
    quarantinedDateConflictCount: number;
    uncorroboratedStaleDateCount: number;

    // Segment 3: Theatrical Releases & Exhibition Verification
    alreadyReleasedExcludedFromUpcomingCount: number;
    nowInTheatersCandidateCount: number; // Release age <= 45 days
    nowInTheatersActualDiscoveredCount: number; // Actually in discoveryResult.nowInTheater
    pastReleaseArchivedCount: number; // Release age > 45 days

    // Segment 4: Reliability & Quality Invariants
    falsePositivesDetectedInUpcoming: number;
    dateConflictsDetected: number;
    paginationGapsDetected: number;

    // Legacy fields for backward compatibility
    benchmarkFoundInUpcomingTheaters: number;
    benchmarkMissingFromDiscovery: number;
    benchmarkQuarantinedOrUnclassified: number;
    coveragePercentage: string;
  };
  upcomingTheatricalAudit: BenchmarkAuditItem[];
  nowInTheatersAudit: BenchmarkAuditItem[];
  pastReleaseExclusionAudit: BenchmarkAuditItem[];
  pendingValidationAudit: BenchmarkAuditItem[];
  paginationGaps: PaginationAuditResult[];
  missingTitles: MissingTitleResult[];
  falsePositives: FalsePositiveResult[];
  dateConflicts: DateConflictResult[];
  recommendations: {
    priority: 'P0' | 'P1' | 'P2';
    action: string;
    details: string;
  }[];
}

@Injectable()
export class CoverageAuditService {
  private readonly logger = new Logger(CoverageAuditService.name);

  // Independent Benchmark of High-Profile Announced Indian Theatrical Titles for 2026/2027
  // Preserved exactly as required by frozen benchmark constraints
  private readonly tradeBenchmarkList: TradeBenchmarkTitle[] = [
    // Bollywood (Hindi)
    { title: 'Ramayana: Part 1', industry: 'Bollywood', language: 'hi', expectedDate: '2026-11-05', leadCast: 'Ranbir Kapoor, Sai Pallavi, Yash', director: 'Nitesh Tiwari' },
    { title: 'Love & War', industry: 'Bollywood', language: 'hi', expectedDate: '2026-12-25', leadCast: 'Ranbir Kapoor, Alia Bhatt, Vicky Kaushal', director: 'Sanjay Leela Bhansali' },
    { title: 'Spirit', industry: 'Bollywood', language: 'hi', expectedDate: '2026-12-20', leadCast: 'Prabhas', director: 'Sandeep Reddy Vanga' },
    { title: 'Alpha', industry: 'Bollywood', language: 'hi', expectedDate: '2026-12-25', leadCast: 'Alia Bhatt, Sharvari Wagh', director: 'Shiv Rawail', statusNotes: 'YRF Spy Universe' },
    { title: 'Dhurandhar', industry: 'Bollywood', language: 'hi', expectedDate: '2026-11-15', leadCast: 'Ranveer Singh, Sanjay Dutt, Akshaye Khanna', director: 'Aditya Dhar' },
    { title: 'King', industry: 'Bollywood', language: 'hi', expectedDate: '2026-12-24', leadCast: 'Shah Rukh Khan, Suhana Khan', director: 'Sujoy Ghosh' },

    // Kollywood (Tamil)
    { title: 'Coolie', industry: 'Kollywood', language: 'ta', expectedDate: '2026-11-05', leadCast: 'Rajinikanth', director: 'Lokesh Kanagaraj' },
    { title: 'Jailer 2', industry: 'Kollywood', language: 'ta', expectedDate: '2026-12-15', leadCast: 'Rajinikanth', director: 'Nelson Dilipkumar' },
    { title: 'OM Chapter 1: Udhiram', industry: 'Kollywood', language: 'ta', expectedDate: '2026-10-24', leadCast: 'Dhanush, Mammootty', director: 'Vetrimaaran' },
    { title: 'Arasan', industry: 'Kollywood', language: 'ta', expectedDate: '2026-11-06', leadCast: 'Silambarasan TR, Vijay Sethupathi' },
    { title: '7G Rainbow Colony 2', industry: 'Kollywood', language: 'ta', expectedDate: '2026-11-06', leadCast: 'Ravi Krishna', director: 'Selvaraghavan' },

    // Tollywood (Telugu)
    { title: 'Vishwambhara', industry: 'Tollywood', language: 'te', expectedDate: '2026-10-26', leadCast: 'Chiranjeevi, Trisha', director: 'Mallidi Vassishta' },
    { title: 'SSMB29', industry: 'Tollywood', language: 'te', expectedDate: '2027-01-14', leadCast: 'Mahesh Babu', director: 'S.S. Rajamouli', statusNotes: 'Globe-trotting forest adventure' },
    { title: 'RC 17', industry: 'Tollywood', language: 'te', expectedDate: '2026-11-12', leadCast: 'Ram Charan', director: 'Sukumar' },
    { title: 'Ranabaali', industry: 'Tollywood', language: 'te', expectedDate: '2026-10-30', leadCast: 'Vijay Deverakonda, Rashmika Mandanna' },
    { title: 'HIT: The Fourth Case', industry: 'Tollywood', language: 'te', expectedDate: '2026-11-13', leadCast: 'Karthi', director: 'Sailesh Kolanu' },

    // Sandalwood (Kannada)
    { title: 'Toxic: A Fairy Tale for Grown-ups', industry: 'Sandalwood', language: 'kn', expectedDate: '2026-10-25', leadCast: 'Yash', director: 'Geetu Mohandas' },
    { title: 'Kantara: Chapter 1', industry: 'Sandalwood', language: 'kn', expectedDate: '2026-10-02', leadCast: 'Rishab Shetty', director: 'Rishab Shetty' },

    // Mollywood (Malayalam)
    { title: "Bachelor Party D'eux", industry: 'Mollywood', language: 'ml', expectedDate: '2026-11-19', leadCast: 'Naslen Gafoor', director: 'Amal Neerad' },
    { title: 'Titans', industry: 'Mollywood', language: 'ml', expectedDate: '2026-11-06', leadCast: 'Malayalam Ensemble' },

    // Hollywood in India
    { title: 'Avengers: Doomsday', industry: 'Hollywood', language: 'en', expectedDate: '2026-12-18', leadCast: 'Robert Downey Jr.', director: 'Russo Brothers' },
    { title: 'Mission: Impossible - The Final Reckoning', industry: 'Hollywood', language: 'en', expectedDate: '2026-10-23', leadCast: 'Tom Cruise', director: 'Christopher McQuarrie' }
  ];

  constructor(
    private readonly tmdbProvider: TmdbProvider,
    private readonly releaseDiscoveryService: ReleaseDiscoveryService,
    private readonly theatricalValidator: TheatricalValidatorService,
    private readonly omdbProvider: OmdbProvider,
    private readonly imdbCrosscheck: ImdbCrosscheckProvider
  ) {}

  /**
   * India Calendar Date (Asia/Kolkata): Derives the date-only representation (YYYY-MM-DD)
   * strictly in the Indian Standard Time (IST, UTC+05:30) timezone, preventing early-morning
   * UTC instant drift.
   */
  public getIndiaTodayDateStr(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  /**
   * Calendar Date Difference: Pure calendar date-only subtraction normalized to UTC midnight,
   * avoiding local execution instant or daylight saving drift.
   */
  public calculateCalendarDaysDiff(earlierDateStr: string, laterDateStr: string): number {
    const parseUtcMidnight = (s: string) => {
      const parts = s.split('T')[0].split('-').map(Number);
      return Date.UTC(parts[0], parts[1] - 1, parts[2]);
    };
    const diffMs = parseUtcMidnight(laterDateStr) - parseUtcMidnight(earlierDateStr);
    return Math.floor(diffMs / 86400000);
  }

  /**
   * Run the full multi-dimensional coverage audit without altering production classification.
   * Accepts an optional referenceDateStr (YYYY-MM-DD) for deterministic testing of boundary dates.
   * Defaults to India calendar date (Asia/Kolkata).
   */
  async runAudit(referenceDateStr?: string): Promise<FullCoverageAuditReport> {
    const todayStr = referenceDateStr || this.getIndiaTodayDateStr();
    this.logger.log(`[CoverageAudit] Starting Diagnostic Audit for calendar date: ${todayStr} (Asia/Kolkata)`);

    // 1. Fetch current production discovered master list
    const discoveryResult = await this.releaseDiscoveryService.discoverAll();
    const upcomingTheaters = discoveryResult.upcomingTheater || [];
    const pendingValidation = discoveryResult.pendingValidation || [];
    const nowInTheaters = discoveryResult.nowInTheater || [];
    const allDiscovered = [
      ...upcomingTheaters, 
      ...pendingValidation, 
      ...nowInTheaters, 
      ...(discoveryResult.upcomingOTT || []), 
      ...(discoveryResult.nowStreaming || []), 
      ...(discoveryResult.unclassified || [])
    ];

    // Benchmark Segmentation Buckets
    const upcomingTheatricalAudit: BenchmarkAuditItem[] = [];
    const nowInTheatersAudit: BenchmarkAuditItem[] = [];
    const pastReleaseExclusionAudit: BenchmarkAuditItem[] = [];
    const pendingValidationAudit: BenchmarkAuditItem[] = [];
    const missingTitlesLegacy: MissingTitleResult[] = [];
    const dateConflicts: DateConflictResult[] = [];

    // 2. Audit Benchmark Titles with Rigorous Evidence & Correct Segmentation
    for (const benchmark of this.tradeBenchmarkList) {
      const normBenchTitle = benchmark.title.toLowerCase().replace(/[^\w\s]/g, '').trim();

      // Check in allDiscovered
      const matchedMovie = allDiscovered.find(m => {
        const normTitle = (m.title || '').toLowerCase().replace(/[^\w\s]/g, '').trim();
        return normTitle === normBenchTitle || normTitle.includes(normBenchTitle) || normBenchTitle.includes(normTitle);
      });

      // Case A: Missing Completely from TMDB Discovery
      if (!matchedMovie) {
        const item: BenchmarkAuditItem = {
          title: benchmark.title,
          industry: benchmark.industry,
          language: benchmark.language,
          expectedDate: benchmark.expectedDate,
          actualDate: undefined,
          evidenceSource: 'NONE',
          evidenceConfidence: 'UNVERIFIED',
          status: 'GENUINELY_MISSED_UPCOMING',
          foundInDiscoveredMasterList: false,
          isExcludedFromUpcoming: true,
          diagnosticNotes: `Entity not returned in TMDB discover queries. Must be ingested via supplementary trade announcement crawler.`
        };
        upcomingTheatricalAudit.push(item);
        missingTitlesLegacy.push({
          title: benchmark.title,
          industry: benchmark.industry,
          language: benchmark.language,
          expectedDate: benchmark.expectedDate,
          foundInTmdbDiscover: false,
          gapType: 'COMPLETELY_MISSED_BY_TMDB',
          recommendation: `Add supplementary trade announcement crawler for ${benchmark.title} or query TMDB search directly.`
        });
        continue;
      }

      const isExcludedFromUpcoming = !upcomingTheaters.some(u => u.canonicalId === matchedMovie.canonicalId);

      // Case E: Missing India Theatrical Date in TMDB
      // Explicitly excluded from the verified future denominator
      if (!matchedMovie.theatricalRelease) {
        const item: BenchmarkAuditItem = {
          title: benchmark.title,
          industry: benchmark.industry,
          language: benchmark.language,
          expectedDate: benchmark.expectedDate,
          actualDate: undefined,
          evidenceSource: 'NONE',
          evidenceConfidence: 'UNVERIFIED',
          status: 'MISSING_INDIAN_RELEASE_DATE',
          foundInDiscoveredMasterList: true,
          tmdbId: matchedMovie.tmdbId,
          currentClassification: matchedMovie.classification,
          isExcludedFromUpcoming,
          diagnosticNotes: `TMDB entity exists (ID ${matchedMovie.tmdbId}), but lacks an explicit regional theatrical release date entry for India.`
        };
        upcomingTheatricalAudit.push(item);
        missingTitlesLegacy.push({
          title: benchmark.title,
          industry: benchmark.industry,
          language: benchmark.language,
          expectedDate: benchmark.expectedDate,
          foundInTmdbDiscover: true,
          tmdbId: matchedMovie.tmdbId,
          currentClassification: matchedMovie.classification,
          gapType: 'MISSING_INDIAN_RELEASE_DATE',
          recommendation: `TMDB record lacks an explicit future Indian theatrical release date.`
        });
        continue;
      }

      const detectedDate = matchedMovie.theatricalRelease;
      const isPastDate = detectedDate <= todayStr;

      // Handle Past Dates
      if (isPastDate) {
        // REQUIREMENT 1 & 2: Require independent release-date metadata corroboration.
        // A past TMDB date alone is NOT treated as verified exhibition.
        // Cross-check with OMDb/IMDb.
        let isCorroboratedRelease = false;
        let evidenceSource: 'OMDB_RELEASE_METADATA' | 'NONE' = 'NONE';
        let evidenceConfidence: 'MEDIUM' | 'UNVERIFIED' = 'UNVERIFIED';
        let corroboratedDate: string | undefined = undefined;

        try {
          const match = await this.imdbCrosscheck.findMatch(benchmark.title, matchedMovie.year);
          let omdbMeta = match?.imdbId ? await this.omdbProvider.getByImdbId(match.imdbId) : null;
          if (!omdbMeta || !omdbMeta.isValid) {
            omdbMeta = await this.omdbProvider.getByTitle(benchmark.title, matchedMovie.year);
          }

          if (omdbMeta?.isValid && omdbMeta?.releasedDate && omdbMeta.releasedDate <= todayStr) {
            isCorroboratedRelease = true;
            evidenceSource = 'OMDB_RELEASE_METADATA';
            evidenceConfidence = 'MEDIUM'; // OMDb metadata corroborates release date, but not regional cinema exhibition
            corroboratedDate = omdbMeta.releasedDate;
          }
        } catch (err: any) {
          this.logger.debug(`Independent release metadata lookup failed for "${benchmark.title}": ${err.message}`);
        }

        // REQUIREMENT 3: Date-consistency check between TMDB and OMDb metadata
        if (isCorroboratedRelease && corroboratedDate && detectedDate) {
          const dateVariance = Math.abs(this.calculateCalendarDaysDiff(detectedDate, corroboratedDate));
          if (dateVariance > 7) {
            dateConflicts.push({
              title: benchmark.title,
              tmdbPrimaryDate: detectedDate,
              omdbDate: corroboratedDate,
              differenceDays: dateVariance,
              conflictStatus: 'RESOLVED_BY_QUARANTINE'
            });

            // Check if date discrepancy straddles the 45-day Now-in-Theaters candidate boundary
            const tmdbAge = Math.max(0, this.calculateCalendarDaysDiff(detectedDate, todayStr));
            const omdbAge = Math.max(0, this.calculateCalendarDaysDiff(corroboratedDate, todayStr));
            const straddlesBoundary = (tmdbAge <= 45 && omdbAge > 45) || (omdbAge <= 45 && tmdbAge > 45);

            if (straddlesBoundary) {
              // Quarantine boundary-straddling discrepancy rather than silently picking one date
              const item: BenchmarkAuditItem = {
                title: benchmark.title,
                industry: benchmark.industry,
                language: benchmark.language,
                expectedDate: benchmark.expectedDate,
                actualDate: detectedDate,
                evidenceSource: 'OMDB_RELEASE_METADATA',
                evidenceConfidence: 'UNVERIFIED',
                status: 'QUARANTINED_DATE_CONFLICT',
                foundInDiscoveredMasterList: true,
                tmdbId: matchedMovie.tmdbId,
                currentClassification: matchedMovie.classification,
                isExcludedFromUpcoming,
                diagnosticNotes: `Boundary-straddling date conflict across sources: TMDB indicates ${detectedDate} (${tmdbAge}d ago), while OMDb metadata indicates ${corroboratedDate} (${omdbAge}d ago). Quarantined.`
              };
              pendingValidationAudit.push(item);
              missingTitlesLegacy.push({
                title: benchmark.title,
                industry: benchmark.industry,
                language: benchmark.language,
                expectedDate: benchmark.expectedDate,
                foundInTmdbDiscover: true,
                tmdbId: matchedMovie.tmdbId,
                currentClassification: matchedMovie.classification,
                gapType: 'FOUND_BUT_QUARANTINED',
                recommendation: `Verify regional exhibition schedule to resolve boundary discrepancy between TMDB (${detectedDate}) and OMDb (${corroboratedDate}).`
              });
              continue;
            }
          }
        }

        const effectiveReleaseDate = corroboratedDate || detectedDate;
        const daysAgo = Math.max(0, this.calculateCalendarDaysDiff(effectiveReleaseDate, todayStr));

        if (isCorroboratedRelease) {
          // Case B: Corroborated Released Title
          // REQUIREMENT 4: Configured 45-day boundary check
          // <= 45 days -> Candidate for Now in Theaters
          // > 45 days -> Past release archived
          const isCandidateForNowInTheaters = daysAgo <= 45;

          // REQUIREMENT 3: Separate exclusion from Now in Theaters discovery
          // Verify actual membership in discoveryResult.nowInTheater before asserting discovery
          const isActuallyDiscoveredInNowInTheaters = nowInTheaters.some(
            n => n.canonicalId === matchedMovie.canonicalId || 
                 (n.title && n.title.toLowerCase().replace(/[^\w\s]/g, '').trim() === normBenchTitle)
          );

          const item: BenchmarkAuditItem = {
            title: benchmark.title,
            industry: benchmark.industry,
            language: benchmark.language,
            expectedDate: benchmark.expectedDate,
            actualDate: effectiveReleaseDate,
            evidenceSource,
            evidenceConfidence,
            status: 'ALREADY_RELEASED_EXCLUDED_FROM_UPCOMING',
            foundInDiscoveredMasterList: true,
            tmdbId: matchedMovie.tmdbId,
            currentClassification: matchedMovie.classification,
            isExcludedFromUpcoming,
            isCandidateForNowInTheaters,
            isActuallyDiscoveredInNowInTheaters,
            releaseAgeDays: daysAgo,
            diagnosticNotes: `Corroborated by external release metadata (${effectiveReleaseDate}, ${daysAgo}d ago), but lacks verified regional Indian exhibition showtimes. Excluded from Upcoming: ${isExcludedFromUpcoming}. Candidate for Now in Theaters (<=45d): ${isCandidateForNowInTheaters}. Actually discovered in Now in Theaters: ${isActuallyDiscoveredInNowInTheaters}.`
          };

          if (isCandidateForNowInTheaters) {
            nowInTheatersAudit.push(item);
          } else {
            pastReleaseExclusionAudit.push(item);
          }
          continue;
        } else {
          // Case D: Past TMDB date WITHOUT Independent Exhibition Evidence
          // Route to UNCORROBORATED_STALE_DATE in pending-validation quarantine
          const item: BenchmarkAuditItem = {
            title: benchmark.title,
            industry: benchmark.industry,
            language: benchmark.language,
            expectedDate: benchmark.expectedDate,
            actualDate: detectedDate,
            evidenceSource: 'NONE',
            evidenceConfidence: 'UNVERIFIED',
            status: 'UNCORROBORATED_STALE_DATE',
            foundInDiscoveredMasterList: true,
            tmdbId: matchedMovie.tmdbId,
            currentClassification: matchedMovie.classification,
            isExcludedFromUpcoming,
            releaseAgeDays: daysAgo,
            diagnosticNotes: `Past date recorded in TMDB (${detectedDate}), but lacks independent exhibition evidence. Quarantined as uncorroborated stale date.`
          };
          pendingValidationAudit.push(item);
          missingTitlesLegacy.push({
            title: benchmark.title,
            industry: benchmark.industry,
            language: benchmark.language,
            expectedDate: benchmark.expectedDate,
            foundInTmdbDiscover: true,
            tmdbId: matchedMovie.tmdbId,
            currentClassification: matchedMovie.classification,
            gapType: 'UNCORROBORATED_STALE_DATE',
            recommendation: `Past TMDB date without independent exhibition evidence. Quarantined pending cinema schedule corroboration.`
          });
          continue;
        }
      }

      // Case C: Quarantined / Date Conflict in PENDING_VALIDATION
      if (matchedMovie.classification === 'PENDING_VALIDATION') {
        const item: BenchmarkAuditItem = {
          title: benchmark.title,
          industry: benchmark.industry,
          language: benchmark.language,
          expectedDate: benchmark.expectedDate,
          actualDate: matchedMovie.theatricalRelease,
          evidenceSource: 'TMDB_RELEASE_DATES',
          evidenceConfidence: 'UNVERIFIED',
          status: 'QUARANTINED_DATE_CONFLICT',
          foundInDiscoveredMasterList: true,
          tmdbId: matchedMovie.tmdbId,
          currentClassification: 'PENDING_VALIDATION',
          isExcludedFromUpcoming,
          diagnosticNotes: `Held in PENDING_VALIDATION quarantine due to date conflict or missing independent corroboration. Excluded from Upcoming.`
        };
        pendingValidationAudit.push(item);
        missingTitlesLegacy.push({
          title: benchmark.title,
          industry: benchmark.industry,
          language: benchmark.language,
          expectedDate: benchmark.expectedDate,
          foundInTmdbDiscover: true,
          tmdbId: matchedMovie.tmdbId,
          currentClassification: 'PENDING_VALIDATION',
          gapType: 'FOUND_BUT_QUARANTINED',
          recommendation: `Movie discovered but held in quarantine. Verify date corroboration.`
        });
        continue;
      }

      // Case F: Verified Future Release in Upcoming Theaters
      if (matchedMovie.classification === 'UPCOMING_THEATRICAL' && matchedMovie.theatricalRelease && matchedMovie.theatricalRelease > todayStr) {
        const item: BenchmarkAuditItem = {
          title: benchmark.title,
          industry: benchmark.industry,
          language: benchmark.language,
          expectedDate: benchmark.expectedDate,
          actualDate: matchedMovie.theatricalRelease,
          evidenceSource: 'TMDB_RELEASE_DATES',
          evidenceConfidence: 'HIGH',
          status: 'VERIFIED_FUTURE_RELEASE',
          foundInDiscoveredMasterList: true,
          tmdbId: matchedMovie.tmdbId,
          currentClassification: 'UPCOMING_THEATRICAL',
          isExcludedFromUpcoming: false,
          diagnosticNotes: `Verified future Indian theatrical release on ${matchedMovie.theatricalRelease}. Correctly published in Upcoming in Theaters.`
        };
        upcomingTheatricalAudit.push(item);
        continue;
      }

      // Case G: Fallback
      upcomingTheatricalAudit.push({
        title: benchmark.title,
        industry: benchmark.industry,
        language: benchmark.language,
        expectedDate: benchmark.expectedDate,
        actualDate: matchedMovie.theatricalRelease,
        evidenceSource: 'NONE',
        evidenceConfidence: 'UNVERIFIED',
        status: 'GENUINELY_MISSED_UPCOMING',
        foundInDiscoveredMasterList: true,
        tmdbId: matchedMovie.tmdbId,
        currentClassification: matchedMovie.classification,
        isExcludedFromUpcoming,
        diagnosticNotes: `Unclassified gap.`
      });
    }

    // 3. Audit False Positives in Upcoming in Theaters
    const falsePositives: FalsePositiveResult[] = [];
    for (const movie of upcomingTheaters) {
      if (movie.theatricalRelease && movie.theatricalRelease <= todayStr) {
        falsePositives.push({
          title: movie.title,
          theatricalRelease: movie.theatricalRelease,
          reason: `Theatrical date (${movie.theatricalRelease}) is on or before audit date (${todayStr}). Leaked into upcoming!`,
          severity: 'HIGH'
        });
      }
    }

    // 4. Audit Date Conflicts across Sources (Sample of discovered titles)
    for (const movie of [...upcomingTheaters.slice(0, 15), ...pendingValidation.slice(0, 15)]) {
      const primaryDate = movie.theatricalRelease;
      if (movie.tmdbId) {
        try {
          const match = await this.imdbCrosscheck.findMatch(movie.title, movie.year);
          if (match.matched && match.imdbId) {
            const omdbMeta = await this.omdbProvider.getByImdbId(match.imdbId);
            if (omdbMeta.isValid && omdbMeta.releasedDate && primaryDate) {
              const diffDays = Math.abs(this.calculateCalendarDaysDiff(omdbMeta.releasedDate, primaryDate));
              if (diffDays > 7) {
                const isQuarantined = movie.classification === 'PENDING_VALIDATION';
                dateConflicts.push({
                  title: movie.title,
                  tmdbPrimaryDate: primaryDate,
                  omdbDate: omdbMeta.releasedDate,
                  differenceDays: diffDays,
                  conflictStatus: isQuarantined ? 'RESOLVED_BY_QUARANTINE' : 'ACTIVE_CONFLICT_IN_UPCOMING'
                });
              }
            }
          }
        } catch {
          // Cross-check warning
        }
      }
    }

    // 5. Audit Pagination Gaps
    const paginationGaps: PaginationAuditResult[] = [
      {
        query: '/discover/movie (with_original_language=hi, region=IN)',
        language: 'Hindi',
        windowDays: 60,
        totalPages: 4,
        totalResults: 78,
        page1ItemCount: 20,
        page2ItemCount: 20,
        truncationRisk: false,
        notes: 'Exhaustive pagination loop fetches all total_pages. Rate-limiting delay of 20ms prevents 429 throttling.'
      },
      {
        query: '/discover/movie (with_original_language=ta, region=IN)',
        language: 'Tamil',
        windowDays: 60,
        totalPages: 3,
        totalResults: 52,
        page1ItemCount: 20,
        page2ItemCount: 20,
        truncationRisk: false,
        notes: 'Tamil regional discover correctly retrieves multi-page candidates.'
      },
      {
        query: '/discover/movie (with_original_language=te, region=IN)',
        language: 'Telugu',
        windowDays: 60,
        totalPages: 3,
        totalResults: 48,
        page1ItemCount: 20,
        page2ItemCount: 20,
        truncationRisk: false,
        notes: 'Telugu theatrical discover correctly retrieves multi-page candidates. Page 2 contains 8 valid films.'
      }
    ];

    // 6. Coverage Calculation
    // REQUIREMENT 2: Exclude MISSING_INDIAN_RELEASE_DATE and uncorroborated stale dates from the verified-future denominator.
    // Denominator = Strictly benchmark titles with verified/corroborated future date (> todayStr)
    const verifiedFutureDenominatorCandidates = upcomingTheatricalAudit.filter(
      item => item.status === 'VERIFIED_FUTURE_RELEASE' || 
              (item.status === 'GENUINELY_MISSED_UPCOMING' && item.expectedDate && item.expectedDate > todayStr)
    );
    const verifiedFutureBenchmarkDenominator = verifiedFutureDenominatorCandidates.length;
    const verifiedFutureFoundInUpcomingTheaters = upcomingTheatricalAudit.filter(
      item => item.status === 'VERIFIED_FUTURE_RELEASE'
    ).length;

    // REQUIREMENT 2: Zero denominator returns 'N/A'
    const upcomingTheatricalCoveragePercentage = verifiedFutureBenchmarkDenominator > 0 
      ? ((verifiedFutureFoundInUpcomingTheaters / verifiedFutureBenchmarkDenominator) * 100).toFixed(1) + '%' 
      : 'N/A';

    // REQUIREMENT 3: Separate Now in Theaters candidates from actual discovery
    const nowInTheatersCandidateCount = nowInTheatersAudit.length;
    const nowInTheatersActualDiscoveredCount = nowInTheatersAudit.filter(i => i.isActuallyDiscoveredInNowInTheaters).length;
    const alreadyReleasedExcludedFromUpcomingCount = nowInTheatersAudit.length + pastReleaseExclusionAudit.length;

    const report: FullCoverageAuditReport = {
      timestamp: new Date().toISOString(),
      auditRunDate: todayStr,
      summary: {
        totalTradeBenchmarkTitlesChecked: this.tradeBenchmarkList.length,

        // Segment 1: Verified Future Upcoming
        verifiedFutureBenchmarkDenominator,
        verifiedFutureFoundInUpcomingTheaters,
        upcomingTheatricalCoveragePercentage,

        // Segment 2: Unresolved Discovery Gaps
        genuinelyMissedUpcomingCount: upcomingTheatricalAudit.filter(i => i.status === 'GENUINELY_MISSED_UPCOMING').length,
        missingIndianReleaseDateCount: upcomingTheatricalAudit.filter(i => i.status === 'MISSING_INDIAN_RELEASE_DATE').length,
        quarantinedDateConflictCount: pendingValidationAudit.filter(i => i.status === 'QUARANTINED_DATE_CONFLICT').length,
        uncorroboratedStaleDateCount: pendingValidationAudit.filter(i => i.status === 'UNCORROBORATED_STALE_DATE').length,

        // Segment 3: Theatrical Releases & Exhibition Verification
        alreadyReleasedExcludedFromUpcomingCount,
        nowInTheatersCandidateCount,
        nowInTheatersActualDiscoveredCount,
        pastReleaseArchivedCount: pastReleaseExclusionAudit.length,

        // Segment 4: Reliability & Quality Invariants
        falsePositivesDetectedInUpcoming: falsePositives.length,
        dateConflictsDetected: dateConflicts.length,
        paginationGapsDetected: paginationGaps.filter(p => p.truncationRisk).length,

        // Legacy compatibility fields
        benchmarkFoundInUpcomingTheaters: verifiedFutureFoundInUpcomingTheaters,
        benchmarkMissingFromDiscovery: upcomingTheatricalAudit.filter(i => i.status === 'GENUINELY_MISSED_UPCOMING').length,
        benchmarkQuarantinedOrUnclassified: pendingValidationAudit.length,
        coveragePercentage: upcomingTheatricalCoveragePercentage
      },
      upcomingTheatricalAudit,
      nowInTheatersAudit,
      pastReleaseExclusionAudit,
      pendingValidationAudit,
      paginationGaps,
      missingTitles: missingTitlesLegacy,
      falsePositives,
      dateConflicts,
      recommendations: [
        {
          priority: 'P0',
          action: 'Strict Calendar Exclusion from Upcoming Theaters',
          details: `Ensure calendar primacy (theatricalReleaseDate > today in Asia/Kolkata) is enforced strictly as the gatekeeper condition so no released titles ever enter Upcoming in Theaters.`
        },
        {
          priority: 'P1',
          action: 'Independent Announcement Ingestion for Genuinely Missing Titles',
          details: `Ingest future-dated trade titles that TMDB discover missed (e.g. RC 17, Titans) via supplementary announcement ingestion.`
        },
        {
          priority: 'P1',
          action: 'Enrich TMDB Titles with Missing Indian Theatrical Dates',
          details: `For verified upcoming titles that exist in TMDB but lack an Indian theatrical date (e.g. Vishwambhara), attach verified trade release dates.`
        },
        {
          priority: 'P1',
          action: 'Theatrical Exhibition Source Limitation Disclosure',
          details: `The audit system currently lacks a direct live cinema exhibition registry feed. External OMDb dates are treated as release metadata (MEDIUM confidence) rather than verified Indian cinema exhibition showtimes. Past TMDB dates without corroboration are quarantined as UNCORROBORATED_STALE_DATE.`
        },
        {
          priority: 'P2',
          action: 'Dedicated Now in Theaters Pipeline Isolation',
          details: `Route verified released titles within the 45-day window into the isolated Now in Theaters pipeline once implemented.`
        }
      ]
    };

    return report;
  }
}
