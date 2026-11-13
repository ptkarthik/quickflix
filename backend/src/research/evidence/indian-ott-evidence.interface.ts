import { TheatricalStatus } from '../services/movie-classification.service';

export type OttSourceType =
  | 'OFFICIAL_PLATFORM_ANNOUNCEMENT' // e.g. Netflix India PR, Prime Video India Press, JioHotstar PR
  | 'OFFICIAL_STUDIO_ANNOUNCEMENT'   // e.g. Lyca, Sun Pictures, DVV, Mythri, Hombale verified announcements
  | 'LICENSED_AGGREGATOR'           // e.g. verified licensed partner data feed
  | 'TRADE_DESK_CORROBORATED'       // e.g. multi-outlet confirmed trade report (OTTplay, Binged, Cinema Express)
  | 'COMMUNITY_SUBMISSION'          // unverified user edit or social rumor
  | 'UNKNOWN';

export type OttAvailabilityModel =
  | 'SUBSCRIPTION' // Flatrate SVOD access with active platform subscription
  | 'RENTAL'       // Transactional TVOD rental (pay-per-view)
  | 'PURCHASE'     // Transactional EST electronic sell-through
  | 'FREE'         // Free streaming without subscription or ads
  | 'ADS'          // Ad-supported AVOD streaming
  | 'UNKNOWN';     // Undetermined / unstated availability model

export type OttDatePrecision =
  | 'EXACT_DATE'    // Confirmed YYYY-MM-DD
  | 'MONTH_YEAR'    // e.g. November 2026 (exact day unannounced)
  | 'QUARTER_YEAR'  // e.g. Q4 2026
  | 'YEAR_ONLY'     // e.g. 2026 / 2027
  | 'UNSPECIFIED';  // Date TBA / coming soon without calendar timeframe

export type HistoricalVerificationStatus =
  | 'VERIFIED_NO_PRIOR_PREMIERE' // Authoritatively checked: zero past Indian streaming releases
  | 'CONFIRMED_PRIOR_PREMIERE'   // Identified prior Indian streaming premiere in the past
  | 'HISTORICAL_STATUS_UNKNOWN'; // Unchecked / unverified historical streaming catalog

export type ClaimVerificationStatus =
  | 'SOURCE_AUTHORIZED'          // Source domain matches authorized platform / studio whitelist
  | 'CLAIM_CONTENT_VERIFIED'     // Verified page content / headline confirms specific title & date
  | 'SOURCE_UNREACHABLE'         // Source URL inaccessible or returns HTTP 4xx/5xx
  | 'CLAIM_CONTENT_MISMATCH'     // Page content exists but does not corroborate claimed event
  | 'SOURCE_VERIFICATION_UNKNOWN';// Unchecked or unverified page content

export type EvidenceLifecycleStatus =
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'RETRACTED'
  | 'INVALIDATED'
  | 'CONFLICTED';

export type VerificationActorRole =
  | 'INTERNAL_AUDITOR'
  | 'REGISTRY_SUPERVISOR'
  | 'EXHIBITION_AUDITOR'
  | 'SYSTEM_VERIFIER';

export interface VerificationTicket {
  ticketId: string;
  actorId: string;
  actorRole: VerificationActorRole;
  issuedAt: string;
  expiresAt: string;
  signature: string;
}

export interface ValidatorProof {
  proofId: string;
  candidateId: string;
  issuedAt: string;
  signature: string;
  verifiedProperties: {
    isClaimContentVerified: boolean;
    theatricalRunExplicitlyEnded: boolean;
    directToOttVerified: boolean;
    historicalVerificationStatus?: HistoricalVerificationStatus;
  };
}

export interface VerifiedClaimDetails {
  candidateId?: string;
  title: string;
  contentType?: 'movie' | 'tv';
  seasonNumber?: number;
  platform: string;
  territoryCodes: string[];
  premiereDate: string;
  datePrecision: OttDatePrecision;
  availabilityType: OttAvailabilityModel;
  evidenceId: string;
  verifiedAt?: string;
  verifiedBy: string;
  ticketId?: string;
  ticket?: VerificationTicket;
}

export interface VerifiedTheatricalClosure {
  candidateId?: string;
  theatricalTitle?: string;
  territory: string;
  closureDate: string;
  evidenceId: string;
  verifiedAt?: string;
  verifiedBy: string;
  ticketId?: string;
  ticket?: VerificationTicket;
  sourceType?: string;
  sourceUrl?: string;
  notes?: string;
}

export interface VerifiedDirectToOtt {
  candidateId?: string;
  title: string;
  contentType?: 'movie' | 'tv';
  seasonNumber?: number;
  territory: string;
  platform?: string;
  availabilityModel: 'SUBSCRIPTION';
  premiereDate?: string;
  evidenceId: string;
  verifiedAt?: string;
  verifiedBy: string;
  ticketId?: string;
  ticket?: VerificationTicket;
  sourceType?: string;
  sourceUrl?: string;
  notes?: string;
}

export interface IndianTerritoryEvidence {
  /**
   * Explicit evidence that the rights announcement applies specifically to India.
   * Generic global announcements without verified India territorial distribution must not be assumed.
   */
  isIndiaExplicit: boolean;
  /** ISO 3166-1 alpha-2 territory codes covered (must include 'IN' for India) */
  territoryCodes: string[];
  /** Notes explaining geo-rights distribution or caveats (e.g. 'India & Worldwide' or 'Overseas Only') */
  geoRestrictionNotes?: string;
  /** Evaluated determination: true ONLY if territoryCodes includes 'IN' and isIndiaExplicit is true */
  supportsIndianRegion: boolean;
}

export interface StructuredOttEvidenceRecord {
  /** Unique evidence record identifier for audit tracing */
  evidenceId: string;
  /** Identifying slug of the providing source (e.g. 'NETFLIX_IN_PRESS', 'PRIME_VIDEO_IN_OFFICIAL', 'AHA_VERIFIED_PR') */
  providerId: string;
  /** Source classification category */
  sourceType: OttSourceType;
  /** URL or verifiable citation of the primary announcement */
  sourceUrl?: string;
  /** Human-readable publication or source name (e.g. 'Netflix India Newsroom', 'Mythri Movie Makers Official') */
  sourceName: string;
  /** ISO timestamp when the primary announcement was published */
  announcementTimestamp: string;
  /** ISO timestamp when our evidence ingestion captured this record */
  evidenceCaptureTimestamp: string;

  // Corroborated Title Identity
  title: string;
  contentType: 'movie' | 'tv';
  /** Mandatory for TV series to prevent cross-season date pollution */
  seasonNumber?: number;
  tmdbId?: number | string;
  imdbId?: string;

  // Language & Industry
  originalLanguage: string; // e.g. 'ta', 'te', 'hi', 'ml', 'kn', 'bn', 'mr', 'pa'
  industries: string[];     // e.g. ['Kollywood'], ['Tollywood'], ['Bollywood'], ['Mollywood'], ['Sandalwood']

  // Release Date & Precision
  claimedOttReleaseDate?: string; // Strict YYYY-MM-DD format if exact
  datePrecision: OttDatePrecision;

  // Platform & Availability Model
  announcedPlatform?: string; // e.g. 'Netflix', 'Prime Video', 'Disney+ Hotstar', 'Zee5', 'SonyLIV', 'Aha', 'Sun NXT'
  availabilityType: OttAvailabilityModel;
  territoryEvidence: IndianTerritoryEvidence;

  // Provenance & Corroboration Details
  provenanceNotes?: string;
  corroboratingSourceUrls?: string[];
  conflictDetected?: boolean;
  conflictDetails?: string;
  quarantineReason?: string;
  claimVerificationStatus?: ClaimVerificationStatus;
  isClaimContentVerified?: boolean;
  verifiedClaimDetails?: VerifiedClaimDetails;
  isDirectToOtt?: boolean;
  directToOttVerified?: boolean;
  verifiedTheatricalClosure?: VerifiedTheatricalClosure;
  verifiedDirectToOtt?: VerifiedDirectToOtt;

  // Phase 2.7.3.2 & 2.7.3.4 Remediation: Historical and Theatrical Provenance
  isTestFixture?: boolean;
  theatricalStatus?: TheatricalStatus;
  theatricalRunExplicitlyEnded?: boolean;
  historicalVerificationStatus?: HistoricalVerificationStatus;
  historicalTheatricalReleaseDate?: string;
  historicalOttPremiereDate?: string;
  historicalOttTerritory?: string;
  historicalOttPlatform?: string;
  historicalOttAvailabilityModel?: OttAvailabilityModel;
  historicalSeasonAirDates?: Record<number, string>;
  theatricalReleaseDate?: string;
  verificationTicket?: VerificationTicket;

  // Evidence Lifecycle (Phase 2.7.3.10)
  lifecycleStatus?: EvidenceLifecycleStatus;
  supersedesEvidenceId?: string;
  lifecycleReason?: string;
  retractedAt?: string;
  retractedBy?: string;
}

export interface IndianOttCandidate {
  /** Stable candidate identifier (e.g. 'cand:movie:coolie-2026' or 'cand:tv:the-family-man:s3') */
  candidateId: string;
  canonicalId?: string;
  title: string;
  contentType: 'movie' | 'tv';
  /** Preserved strictly for TV series; undefined for movies */
  seasonNumber?: number;
  tmdbId?: number | string;
  imdbId?: string;
  originalLanguage: string;
  industries: string[];

  /**
   * Complete immutable history of structured evidence records.
   * Decisions are derived from this collection, never from unevidenced booleans.
   */
  evidenceRecords: StructuredOttEvidenceRecord[];

  // Optional theatrical context (if movie previously screened theatrically)
  theatricalReleaseDate?: string;
  theatricalStatus?: 'UPCOMING' | 'CURRENTLY_RUNNING' | 'ENDED' | 'NONE' | 'UNKNOWN';
  /** Explicit verification that the theatrical exhibition run has closed in Indian cinemas */
  theatricalRunExplicitlyEnded?: boolean;
  isDirectToOtt?: boolean;
  directToOttVerified?: boolean;
  verifiedTheatricalClosure?: VerifiedTheatricalClosure;
  verifiedDirectToOtt?: VerifiedDirectToOtt;

  // Phase 2.7.3.2 & 2.7.3.4 Remediation: Test Fixture and Historical Provenance
  isTestFixture?: boolean;
  historicalVerificationStatus?: HistoricalVerificationStatus;
  claimVerificationStatus?: ClaimVerificationStatus;
  isClaimContentVerified?: boolean;
  verifiedClaimDetails?: VerifiedClaimDetails;
  historicalTheatricalReleaseDate?: string;
  historicalOttPremiereDate?: string;
  historicalOttTerritory?: string;
  historicalOttPlatform?: string;
  historicalOttAvailabilityModel?: OttAvailabilityModel;
  historicalSeasonAirDates?: Record<number, string>;
}

export interface EvidenceEvaluationSummary {
  candidateId: string;
  title: string;
  contentType: 'movie' | 'tv';
  seasonNumber?: number;
  hasAuthorizedSource: boolean;
  territoryVerified: boolean;
  isSubscriptionConfirmed: boolean;
  isPlatformIdentified: boolean;
  platformName?: string;
  isPlatformTbaEligible: boolean;
  hasExactFutureDate: boolean;
  confirmedDate?: string;
  hasDateConflict: boolean;
  hasUncorroboratedDate: boolean;
  quarantineReason?: string;
  rejectionReason?: string;
  passesToUpcomingOtt: boolean;
  historicalVerificationStatus?: HistoricalVerificationStatus;
  claimVerificationStatus?: ClaimVerificationStatus;
  isClaimContentVerified?: boolean;
}

export interface IngestionRecordResult {
  candidateId: string;
  title: string;
  contentType: 'movie' | 'tv';
  seasonNumber?: number;
  originalLanguage: string;
  industries: string[];
  platform?: string;
  claimedReleaseDate?: string;
  datePrecision: OttDatePrecision;
  availabilityType: OttAvailabilityModel;
  sourceType: OttSourceType;
  sourceUrl?: string;
  sourceName: string;
  announcementTimestamp: string;
  evidenceCaptureTimestamp: string;
  decision: 'ACCEPT_UPCOMING_OTT' | 'QUARANTINE_PENDING_VALIDATION' | 'REJECT_UNCLASSIFIED';
  quarantineReason?: string;
  rejectionReason?: string;
  conflictDetected?: boolean;
}

export interface IngestionPlatformMetric {
  totalAnnouncements: number;
  acceptedUpcomingOtt: number;
  quarantinedPendingValidation: number;
  rejected: number;
}

export interface IngestionLanguageMetric {
  totalAnnouncements: number;
  acceptedUpcomingOtt: number;
  quarantinedPendingValidation: number;
  rejected: number;
}

export interface IngestionAuditSummary {
  timestamp: string;
  totalAnnouncementsProcessed: number;
  uniqueCandidatesDiscovered: number;
  acceptedUpcomingOttCount: number;
  quarantinedPendingValidationCount: number;
  rejectedCount: number;
  fixtureCount: number;
  productionAnnouncementCount: number;
  telemetryMode: 'TEST_FIXTURES' | 'LIVE_DISCOVERY';

  // Phase 2.7.3.4 Extended Audit Metrics
  historicalStatusVerifiedCount: number;
  priorPremiereConfirmedCount: number;
  historicalStatusUnknownCount: number;
  sourceDomainAuthorizationFailures: number;
  claimContentVerificationFailuresOrUnknowns: number;
  tradeCorroborationFailures: number;
  theatricalStatusUnknownCount: number;
  evidencePayloadCollisions: number;

  byPlatform: Record<string, IngestionPlatformMetric>;
  byLanguage: Record<string, IngestionLanguageMetric>;
  sampleAnnouncements: IngestionRecordResult[];
}


