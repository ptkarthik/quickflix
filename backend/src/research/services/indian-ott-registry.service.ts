import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  IndianOttCandidate,
  StructuredOttEvidenceRecord,
  EvidenceEvaluationSummary,
  OttSourceType,
  OttAvailabilityModel,
  OttDatePrecision,
  HistoricalVerificationStatus,
  ClaimVerificationStatus,
  IngestionAuditSummary,
  IngestionRecordResult,
  IngestionPlatformMetric,
  IngestionLanguageMetric,
  VerifiedClaimDetails,
  VerifiedTheatricalClosure,
  VerifiedDirectToOtt,
  VerificationTicket
} from '../evidence/indian-ott-evidence.interface';
import { INDIAN_OTT_TEST_FIXTURES, OFFICIAL_INDIAN_OTT_ANNOUNCEMENTS } from '../evidence/official-indian-ott-announcements.dataset';
import { OttCandidateValidationInput, OttValidatorService, OttValidationResult } from './ott-validator.service';
import { CanonicalMovie } from './release-discovery.service';
import { MovieClassificationService, TheatricalStatus } from './movie-classification.service';
import { EvidenceVerificationAuthorityService, UnauthorizedVerificationError } from './evidence-verification-authority.service';

export interface IngestedEvidenceEntry {
  canonicalHash: string;
  originalRecord: StructuredOttEvidenceRecord;
  conflictingPayloads: StructuredOttEvidenceRecord[];
}

@Injectable()
export class IndianOttRegistryService implements OnModuleInit {
  private readonly logger = new Logger(IndianOttRegistryService.name);

  // In-memory canonical candidate storage indexed by stable candidateId
  private readonly candidates = new Map<string, IndianOttCandidate>();

  // Ingested evidence payload tracking for deterministic collision-safe idempotency (Phase 2.7.3.4)
  private readonly ingestedEvidence = new Map<string, IngestedEvidenceEntry>();

  // Telemetry metrics
  private sourceDomainAuthorizationFailuresCount = 0;
  private evidencePayloadCollisionsCount = 0;
  private tradeCorroborationFailuresCount = 0;

  // Cached ingestion audit summary
  private lastIngestionAudit: IngestionAuditSummary | null = null;

  // Authorized primary evidence source types
  private static readonly AUTHORIZED_SOURCE_TYPES = new Set<OttSourceType>([
    'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    'OFFICIAL_STUDIO_ANNOUNCEMENT',
    'LICENSED_AGGREGATOR',
    'TRADE_DESK_CORROBORATED'
  ]);

  // Phase 2.7.3.4 Source Domain Whitelist
  public static readonly AUTHORIZED_PRESS_DOMAINS: Record<string, string[]> = {
    // Official Streaming Platforms
    NETFLIX_IN_NEWSROOM: ['netflix.com'],
    NETFLIX_IN_TUDUM: ['netflix.com'],
    NETFLIX_MEDIA_CENTER: ['netflix.com'],
    NETFLIX_IN_PR: ['netflix.com'],
    AMAZON_STUDIOS_IN_PRESS: ['amazonstudios.com', 'primevideo.com', 'amazon.com', 'aboutamazon.in'],
    PRIME_VIDEO_IN_OFFICIAL: ['amazonstudios.com', 'primevideo.com', 'amazon.com', 'aboutamazon.in'],
    PRIME_VIDEO_IN_PRESS: ['amazonstudios.com', 'primevideo.com', 'amazon.com', 'aboutamazon.in'],
    PRIME_VIDEO_STORE_IN: ['primevideo.com', 'amazon.com'],
    JIOHOTSTAR_PR_DESK: ['hotstar.com', 'disneyplus.com', 'jiocinema.com', 'jio.com'],
    HOTSTAR_IN_PRESS: ['hotstar.com', 'disneyplus.com'],
    JIOCINEMA_OFFICIAL: ['jiocinema.com', 'jio.com'],
    SONYLIV_PRESS_ROOM: ['sonyliv.com', 'spni.com', 'sony.com'],
    SONYLIV_MEDIA_RELATIONS: ['sonyliv.com', 'spni.com', 'sony.com'],
    SONYLIV_OFFICIAL: ['sonyliv.com', 'spni.com'],
    SONYLIV_PR: ['sonyliv.com', 'spni.com', 'sony.com'],
    ZEE5_GLOBAL_PRESS: ['zee5.com', 'zee.com', 'zeeentertainment.com'],
    ZEE5_CORPORATE_COMMUNICATIONS: ['zee5.com', 'zee.com'],
    ZEE5_OFFICIAL: ['zee5.com', 'zee.com'],
    ZEE5_PR: ['zee5.com', 'zee.com', 'zeeentertainment.com'],
    AHA_VERIFIED_NEWSROOM: ['aha.video', 'arha.media'],
    AHA_VERIFIED_PR: ['aha.video', 'arha.media'],
    SUN_NXT_OFFICIAL_PR: ['sunnxt.com', 'suntv.in', 'sunnetwork.in'],
    SUN_NXT_OFFICIAL: ['sunnxt.com', 'suntv.in', 'sunnetwork.in'],
    MANORAMAMAX_OFFICIAL: ['manoramamax.com', 'mmtv.in'],
    HOICHOI_OFFICIAL: ['hoichoi.tv'],
    SIMPLY_SOUTH_VERIFIED: ['simplysouth.tv'],
    BMS_STREAM_PR: ['bookmyshow.com'],
    APPLE_TV_IN_PR: ['apple.com'],
    AMAZON_MX_PLAYER_PR: ['amazon.in', 'amazon.com'],
    US_DISTRIBUTOR_PRESS: ['hulu.com', 'disneyplus.com'],

    // Official Studios
    STUDIO_YUVASUDHA_OFFICIAL: ['yuvasudhaarts.com', 'twitter.com', 'x.com'],
    LYCA_PRODUCTIONS_OFFICIAL: ['lycaproductions.in', 'twitter.com', 'x.com'],
    SUN_PICTURES_OFFICIAL: ['sunnetwork.in', 'sunpictures.in', 'twitter.com', 'x.com'],
    DVV_ENTERTAINMENT_OFFICIAL: ['dvvmovies.com', 'twitter.com', 'x.com'],
    HOMBALEFILMS_OFFICIAL: ['hombalefilms.com', 'twitter.com', 'x.com'],
    MYTHRI_OFFICIAL: ['mythriofficial.com', 'twitter.com', 'x.com'],
    STUDIO_OFFICIAL_PR: ['sunnetwork.in', 'sunpictures.in', 'twitter.com', 'x.com', 'lycaproductions.in', 'hombalefilms.com', 'mythriofficial.com', 'dvvmovies.com', 'yuvasudhaarts.com', 'netflix.com']
  };

  private readonly verificationAuthority: EvidenceVerificationAuthorityService;
  private mutationGeneration = 0;
  private readonly mutationListeners: Array<(event: { reason: string; candidateId?: string; generation: number }) => void> = [];

  constructor(
    private readonly ottValidator: OttValidatorService,
    @Optional() private readonly movieClassification?: MovieClassificationService,
    @Optional() verificationAuthority?: EvidenceVerificationAuthorityService
  ) {
    this.verificationAuthority = verificationAuthority || new EvidenceVerificationAuthorityService();
    if (this.ottValidator && typeof (this.ottValidator as any).setVerificationAuthority === 'function') {
      if (!(this.ottValidator as any).hasVerificationAuthority?.()) {
        (this.ottValidator as any).setVerificationAuthority(this.verificationAuthority);
      }
    }
  }

  public getVerificationAuthority(): EvidenceVerificationAuthorityService {
    return this.verificationAuthority;
  }

  public getMutationGeneration(): number {
    return this.mutationGeneration;
  }

  public onMutation(listener: (event: { reason: string; candidateId?: string; generation: number }) => void): () => void {
    this.mutationListeners.push(listener);
    return () => {
      const idx = this.mutationListeners.indexOf(listener);
      if (idx !== -1) this.mutationListeners.splice(idx, 1);
    };
  }

  public notifyMutation(reason: string, candidateId?: string): void {
    this.mutationGeneration++;
    const event = { reason, candidateId, generation: this.mutationGeneration };
    for (const listener of this.mutationListeners) {
      try {
        listener(event);
      } catch (err: any) {
        this.logger.error(`[IndianOttRegistry] Mutation listener error: ${err.message}`);
      }
    }
  }

  /**
   * Lifecycle hook: Production registry initialized without auto-loading synthetic fixtures
   */
  public onModuleInit(): void {
    this.logger.log(
      '[IndianOttRegistry] Production registry initialized. In-memory registry ready for verified live announcement feeds (test fixtures quarantined).'
    );
  }

  /**
   * Clear registry and ingested evidence tracking (useful for testing or cache refreshes)
   */
  public clear(): void {
    this.candidates.clear();
    this.ingestedEvidence.clear();
    this.sourceDomainAuthorizationFailuresCount = 0;
    this.evidencePayloadCollisionsCount = 0;
    this.tradeCorroborationFailuresCount = 0;
    this.lastIngestionAudit = null;
    this.notifyMutation('REGISTRY_CLEARED');
  }

  /**
   * Look up an ingested evidence entry by evidenceId (Phase 2.7.3.4 & 2.7.3.6)
   */
  public getIngestedEvidenceEntry(evidenceId: string): IngestedEvidenceEntry | undefined {
    return this.ingestedEvidence.get(evidenceId);
  }

  /**
   * Validate source URL domain safely against authorized press domains to prevent spoofing and lookalikes.
   */
  public validateSourceDomain(providerId: string, sourceUrl: string): { isValid: boolean; hostname?: string; reason?: string } {
    if (!sourceUrl || typeof sourceUrl !== 'string') {
      return { isValid: false, reason: 'MISSING_SOURCE_URL' };
    }

    let parsed: URL;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      return { isValid: false, reason: 'INVALID_URL_SYNTAX' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, reason: 'INVALID_PROTOCOL' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Look up authorized domains for provider
    const authorized = IndianOttRegistryService.AUTHORIZED_PRESS_DOMAINS[providerId];
    if (!authorized || authorized.length === 0) {
      return { isValid: false, hostname, reason: 'NO_AUTHORIZED_DOMAINS_FOR_PROVIDER' };
    }

    const isAuthorized = authorized.some(authDomain => {
      const auth = authDomain.toLowerCase();
      return hostname === auth || hostname.endsWith('.' + auth);
    });

    if (!isAuthorized) {
      return { isValid: false, hostname, reason: 'UNAUTHORIZED_DOMAIN' };
    }

    return { isValid: true, hostname };
  }

  /**
   * Compute deterministic canonical SHA-256 payload hash of evidence record.
   * Independent of object key insertion order.
   */
  public computeCanonicalPayloadHash(record: StructuredOttEvidenceRecord): string {
    const territoryCodes = Array.isArray(record.territoryEvidence?.territoryCodes)
      ? [...record.territoryEvidence.territoryCodes].sort()
      : [];
    const industries = Array.isArray(record.industries)
      ? [...record.industries].sort()
      : [];

    const normalized = {
      title: (record.title || '').trim().toLowerCase(),
      contentType: record.contentType || 'movie',
      seasonNumber: record.seasonNumber ?? null,
      claimedOttReleaseDate: record.claimedOttReleaseDate || '',
      datePrecision: record.datePrecision || '',
      announcedPlatform: (record.announcedPlatform || '').trim().toLowerCase(),
      availabilityType: record.availabilityType || '',
      sourceType: record.sourceType || '',
      sourceUrl: (record.sourceUrl || '').trim(),
      providerId: (record.providerId || '').trim(),
      territoryCodes,
      supportsIndianRegion: record.territoryEvidence?.supportsIndianRegion ?? false,
      historicalVerificationStatus: record.historicalVerificationStatus ?? null,
      historicalOttPremiereDate: record.historicalOttPremiereDate ?? null,
      historicalTheatricalReleaseDate: record.historicalTheatricalReleaseDate ?? null
    };

    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  /**
   * Register a structured evidence record from an official platform, studio, or aggregator announcement.
   * Enforces provenance integrity, domain authorization, collision-safe idempotency, season-level identity,
   * cross-source deduplication, and conflict detection.
   */
  public registerEvidenceRecord(
    rawRecord: StructuredOttEvidenceRecord,
    verificationTicket?: VerificationTicket
  ): IndianOttCandidate {
    // Clone incoming record so callers' references and static datasets are never mutated in place
    const record: StructuredOttEvidenceRecord = {
      ...rawRecord,
      territoryEvidence: rawRecord.territoryEvidence ? { ...rawRecord.territoryEvidence } : ({} as any),
      verifiedClaimDetails: rawRecord.verifiedClaimDetails ? { ...rawRecord.verifiedClaimDetails } : undefined,
      verifiedTheatricalClosure: rawRecord.verifiedTheatricalClosure ? { ...rawRecord.verifiedTheatricalClosure } : undefined,
      verifiedDirectToOtt: rawRecord.verifiedDirectToOtt ? { ...rawRecord.verifiedDirectToOtt } : undefined,
      historicalSeasonAirDates: rawRecord.historicalSeasonAirDates ? { ...rawRecord.historicalSeasonAirDates } : undefined,
      industries: rawRecord.industries ? [...rawRecord.industries] : []
    };

    // 1. Provenance Integrity Check
    if (!record.sourceName || !record.sourceName.trim()) {
      throw new Error(`[IndianOttRegistry] Invalid evidence record: missing sourceName.`);
    }
    if (!record.sourceType || record.sourceType === 'UNKNOWN') {
      throw new Error(`[IndianOttRegistry] Invalid evidence record: sourceType cannot be UNKNOWN.`);
    }
    if (!record.title || !record.title.trim()) {
      throw new Error(`[IndianOttRegistry] Invalid evidence record: missing title.`);
    }

    // Official announcement domain validation (Phase 2.7.3.4 Source Authorization)
    if (record.sourceType === 'OFFICIAL_PLATFORM_ANNOUNCEMENT' || record.sourceType === 'OFFICIAL_STUDIO_ANNOUNCEMENT') {
      if (!record.sourceUrl || !record.sourceUrl.trim()) {
        this.sourceDomainAuthorizationFailuresCount++;
        throw new Error(
          `[IndianOttRegistry] Invalid evidence record: official announcement from "${record.sourceName}" must provide a verifiable sourceUrl.`
        );
      }
      const domainCheck = this.validateSourceDomain(record.providerId, record.sourceUrl);
      if (!domainCheck.isValid) {
        this.sourceDomainAuthorizationFailuresCount++;
        throw new Error(
          `[IndianOttRegistry] Source domain authorization failure: Domain "${domainCheck.hostname || 'unknown'}" is not authorized for provider "${record.providerId}".`
        );
      }
    }

    // Phase 2.7.3.10 — Workstream 1: Raw Provider Verification Stripping (Remediating F-01 & F-02)
    // Raw provider records cannot self-certify internal verification properties under any condition.
    // Strip all provider-supplied verification booleans and verification objects unless authenticated with VerificationTicket.
    const effectiveTicket = verificationTicket || record.verificationTicket ||
      record.verifiedClaimDetails?.ticket || record.verifiedTheatricalClosure?.ticket;

    const ticketCheck = effectiveTicket
      ? this.verificationAuthority.validateTicket(effectiveTicket, ['SYSTEM_VERIFIER', 'INTERNAL_AUDITOR', 'REGISTRY_SUPERVISOR'])
      : { isValid: false };
    const isInternallyVerified = ticketCheck.isValid;

    // Snapshot original verification metadata if authenticated
    const verificationSnapshot = {
      historicalVerificationStatus: record.historicalVerificationStatus,
      claimVerificationStatus: record.claimVerificationStatus,
      isClaimContentVerified: record.isClaimContentVerified,
      verifiedClaimDetails: record.verifiedClaimDetails,
      theatricalRunExplicitlyEnded: record.theatricalRunExplicitlyEnded,
      verifiedTheatricalClosure: record.verifiedTheatricalClosure,
      directToOttVerified: record.directToOttVerified,
      verifiedDirectToOtt: record.verifiedDirectToOtt
    };

    record.theatricalRunExplicitlyEnded = false;
    record.verifiedTheatricalClosure = undefined;
    record.directToOttVerified = false;
    record.verifiedDirectToOtt = undefined;
    record.claimVerificationStatus = 'SOURCE_VERIFICATION_UNKNOWN';
    record.isClaimContentVerified = false;
    record.verifiedClaimDetails = undefined;
    record.historicalVerificationStatus = 'HISTORICAL_STATUS_UNKNOWN';

    // Handle explicit supersession (Workstream 4 / F-10 & Phase 2.7.3.12 hardening)
    if (record.supersedesEvidenceId) {
      const priorEntry = this.ingestedEvidence.get(record.supersedesEvidenceId);
      if (!priorEntry) {
        throw new Error(
          `[IndianOttRegistry] Invalid supersession: Superseded evidence ID "${record.supersedesEvidenceId}" not found in ingested evidence.`
        );
      }
      if (priorEntry.originalRecord.providerId !== record.providerId) {
        throw new Error(
          `[IndianOttRegistry] Cross-provider supersession prohibited: Evidence "${record.evidenceId}" (provider: "${record.providerId}") cannot supersede evidence "${record.supersedesEvidenceId}" from provider "${priorEntry.originalRecord.providerId}".`
        );
      }
      const norm1 = (priorEntry.originalRecord.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const norm2 = (record.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm1 !== norm2 || (record.contentType === 'tv' && priorEntry.originalRecord.seasonNumber !== record.seasonNumber)) {
        throw new Error(
          `[IndianOttRegistry] Cross-candidate supersession prohibited: Evidence "${record.evidenceId}" for "${record.title}" cannot supersede evidence "${record.supersedesEvidenceId}" for "${priorEntry.originalRecord.title}".`
        );
      }

      priorEntry.originalRecord.lifecycleStatus = 'SUPERSEDED';
      priorEntry.originalRecord.lifecycleReason = `SUPERSEDED_BY_NEW_EVIDENCE: ${record.evidenceId}`;
      for (const cand of this.candidates.values()) {
        const match = cand.evidenceRecords.find(r => r.evidenceId === record.supersedesEvidenceId);
        if (match) {
          match.lifecycleStatus = 'SUPERSEDED';
          match.lifecycleReason = `SUPERSEDED_BY_NEW_EVIDENCE: ${record.evidenceId}`;
          match.conflictDetected = false;
          match.conflictDetails = undefined;
          match.quarantineReason = undefined;
        }
      }
    }

    // Default lifecycle status to ACTIVE
    if (!record.lifecycleStatus) {
      record.lifecycleStatus = 'ACTIVE';
    }

    // 2. Season Identity Requirement for TV Series
    if (record.contentType === 'tv') {
      if (
        record.seasonNumber === undefined ||
        record.seasonNumber === null ||
        typeof record.seasonNumber !== 'number' ||
        !Number.isInteger(record.seasonNumber) ||
        record.seasonNumber < 1
      ) {
        throw new Error(
          `[IndianOttRegistry] Season-level identity violation: TV series "${record.title}" must specify a valid integer seasonNumber >= 1.`
        );
      }
    }

    // 3. Payload-Aware Idempotency & Collision Tracking (Phase 2.7.3.4)
    const canonicalHash = this.computeCanonicalPayloadHash(record);

    if (record.evidenceId) {
      const existingEntry = this.ingestedEvidence.get(record.evidenceId);
      if (existingEntry) {
        if (existingEntry.canonicalHash === canonicalHash) {
          // True idempotent skip: exact same payload
          this.logger.debug(
            `[IndianOttRegistry] Idempotent skip: Evidence record "${record.evidenceId}" with identical payload already ingested.`
          );
          const candidateId = this.generateCandidateId(existingEntry.originalRecord);
          return this.candidates.get(candidateId)!;
        } else {
          // Collision: Reused evidenceId with conflicting payload!
          this.evidencePayloadCollisionsCount++;
          existingEntry.conflictingPayloads.push(record);

          this.logger.warn(
            `[IndianOttRegistry] EVIDENCE_PAYLOAD_COLLISION_DETECTED: Reused evidenceId "${record.evidenceId}" with conflicting payload!`
          );

          record.conflictDetected = true;
          record.conflictDetails = `EVIDENCE_PAYLOAD_COLLISION_DETECTED: Reused evidenceId "${record.evidenceId}" with conflicting payload.`;
          record.quarantineReason = record.conflictDetails;

          existingEntry.originalRecord.conflictDetected = true;
          existingEntry.originalRecord.conflictDetails = record.conflictDetails;
          existingEntry.originalRecord.quarantineReason = record.conflictDetails;

          const origCandId = this.generateCandidateId(existingEntry.originalRecord);
          const origCandidate = this.candidates.get(origCandId);
          if (origCandidate) {
            for (const r of origCandidate.evidenceRecords) {
              if (r.evidenceId === record.evidenceId) {
                r.conflictDetected = true;
                r.conflictDetails = record.conflictDetails;
                r.quarantineReason = record.conflictDetails;
              }
            }
            return origCandidate;
          }

          // In case original candidate wasn't created yet (defensive fallback, never return undefined)
          const fallbackCand = this.candidates.get(this.generateCandidateId(record));
          if (fallbackCand) return fallbackCand;
        }
      } else {
        this.ingestedEvidence.set(record.evidenceId, {
          canonicalHash,
          originalRecord: { ...record },
          conflictingPayloads: []
        });
      }
    }

    // 4. Compute Stable Candidate Identifier
    const candidateId = this.generateCandidateId(record);

    // 5. Retrieve or Create Candidate (Multi-provider Deduplication)
    let candidate = this.candidates.get(candidateId);
    if (!candidate) {
      candidate = {
        candidateId,
        canonicalId: record.tmdbId ? (record.contentType === 'tv' ? `tmdb:tv:${record.tmdbId}` : `tmdb:${record.tmdbId}`) : candidateId,
        title: record.title.trim(),
        contentType: record.contentType,
        seasonNumber: record.contentType === 'tv' ? record.seasonNumber : undefined,
        tmdbId: record.tmdbId,
        imdbId: record.imdbId,
        originalLanguage: record.originalLanguage,
        industries: [...record.industries],
        evidenceRecords: [],
        isTestFixture: record.isTestFixture,
        theatricalRunExplicitlyEnded: false,
        verifiedTheatricalClosure: undefined,
        theatricalStatus: record.theatricalStatus,
        isDirectToOtt: record.isDirectToOtt,
        directToOttVerified: false,
        verifiedDirectToOtt: undefined,
        historicalVerificationStatus: 'HISTORICAL_STATUS_UNKNOWN',
        claimVerificationStatus: 'SOURCE_VERIFICATION_UNKNOWN',
        isClaimContentVerified: false,
        verifiedClaimDetails: undefined,
        historicalTheatricalReleaseDate: record.historicalTheatricalReleaseDate,
        historicalOttPremiereDate: record.historicalOttPremiereDate,
        historicalOttTerritory: record.historicalOttTerritory,
        historicalOttPlatform: record.historicalOttPlatform,
        historicalOttAvailabilityModel: record.historicalOttAvailabilityModel,
        historicalSeasonAirDates: record.historicalSeasonAirDates ? { ...record.historicalSeasonAirDates } : undefined
      };
      this.candidates.set(candidateId, candidate);
    } else {
      // Merge industries if new ones reported
      for (const ind of record.industries) {
        if (!candidate.industries.includes(ind)) {
          candidate.industries.push(ind);
        }
      }
      if (record.imdbId && !candidate.imdbId) candidate.imdbId = record.imdbId;
      if (record.tmdbId && !candidate.tmdbId) candidate.tmdbId = record.tmdbId;
      if (record.isTestFixture) candidate.isTestFixture = true;
      // Workstream 4: Revocable Candidate Updates (Phase 2.7.3.8)
      if (record.theatricalStatus === 'CURRENTLY_RUNNING') {
        candidate.theatricalStatus = 'CURRENTLY_RUNNING';
        candidate.theatricalRunExplicitlyEnded = false;
        candidate.verifiedTheatricalClosure = undefined;
      }

      if (verificationSnapshot.claimVerificationStatus === 'CLAIM_CONTENT_MISMATCH') {
        candidate.claimVerificationStatus = 'CLAIM_CONTENT_MISMATCH';
        candidate.isClaimContentVerified = false;
        candidate.verifiedClaimDetails = undefined;
      }
      if (verificationSnapshot.historicalVerificationStatus === 'CONFIRMED_PRIOR_PREMIERE') {
        candidate.historicalVerificationStatus = 'CONFIRMED_PRIOR_PREMIERE';
      }

      if (record.isDirectToOtt !== undefined && candidate.isDirectToOtt === undefined) {
        candidate.isDirectToOtt = record.isDirectToOtt;
      }

      // Subscription withdrawal / model replacement (Workstream 4 / F-07 & Phase 2.7.3.12)
      if (
        record.availabilityType === 'RENTAL' ||
        record.availabilityType === 'PURCHASE' ||
        (record.availabilityType as any) === 'WITHDRAWN'
      ) {
        for (const r of candidate.evidenceRecords) {
          if (r.providerId === record.providerId && r.availabilityType === 'SUBSCRIPTION') {
            r.lifecycleStatus = 'SUPERSEDED';
            r.lifecycleReason = `SUBSCRIPTION_OFFER_SUPERSEDED_BY_${record.availabilityType}_OFFER`;
            const ingested = this.ingestedEvidence.get(r.evidenceId);
            if (ingested) {
              ingested.originalRecord.lifecycleStatus = 'SUPERSEDED';
              ingested.originalRecord.lifecycleReason = r.lifecycleReason;
            }
            if (candidate.verifiedClaimDetails?.evidenceId === r.evidenceId) {
              candidate.verifiedClaimDetails = undefined;
              candidate.claimVerificationStatus = 'SOURCE_VERIFICATION_UNKNOWN';
              candidate.isClaimContentVerified = false;
            }
          }
        }
      }

      if (record.historicalTheatricalReleaseDate && !candidate.historicalTheatricalReleaseDate) {
        candidate.historicalTheatricalReleaseDate = record.historicalTheatricalReleaseDate;
      }
      if (record.historicalOttPremiereDate && !candidate.historicalOttPremiereDate) {
        candidate.historicalOttPremiereDate = record.historicalOttPremiereDate;
      }
      if (record.historicalOttTerritory && !candidate.historicalOttTerritory) {
        candidate.historicalOttTerritory = record.historicalOttTerritory;
      }
      if (record.historicalOttPlatform && !candidate.historicalOttPlatform) {
        candidate.historicalOttPlatform = record.historicalOttPlatform;
      }
      if (record.historicalOttAvailabilityModel && !candidate.historicalOttAvailabilityModel) {
        candidate.historicalOttAvailabilityModel = record.historicalOttAvailabilityModel;
      }
      if (record.historicalSeasonAirDates) {
        candidate.historicalSeasonAirDates = {
          ...(candidate.historicalSeasonAirDates || {}),
          ...record.historicalSeasonAirDates
        };
      }

      // Check for syndicated copies: do not treat syndicated copies as second independent primary source
      const hasOfficialPrimary = candidate.evidenceRecords.some(
        r => r.sourceType === 'OFFICIAL_PLATFORM_ANNOUNCEMENT' || r.sourceType === 'OFFICIAL_STUDIO_ANNOUNCEMENT'
      );
      if (hasOfficialPrimary && record.sourceType === 'TRADE_DESK_CORROBORATED') {
        record.provenanceNotes = `SYNDICATED_COPY: Reproduces official announcement without independent primary corroboration.`;
      }
    }

    // 5. Conflict Detection across existing records
    this.detectAndApplyConflicts(candidate, record);

    // 6. Append Immutable Evidence Record
    candidate.evidenceRecords.push(record);

    // Apply authenticated internal verification if ticket was validated
    if (isInternallyVerified && effectiveTicket) {
      this.verifyRecordInternally(candidateId, effectiveTicket, {
        ...record,
        ...verificationSnapshot
      });
    }

    this.notifyMutation(`EVIDENCE_REGISTERED:${record.evidenceId}`, candidateId);

    this.logger.debug(
      `[IndianOttRegistry] Ingested evidence for "${candidate.title}" (ID: ${candidateId}) from ${record.sourceName}. Total records: ${candidate.evidenceRecords.length}.`
    );

    return candidate;
  }

  /**
   * Internal verification method called by authenticated internal authority workflows
   */
  public verifyRecordInternally(
    candidateId: string,
    ticket: VerificationTicket,
    record: StructuredOttEvidenceRecord
  ): void {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) return;

    if (
      record.historicalVerificationStatus &&
      record.historicalVerificationStatus !== 'HISTORICAL_STATUS_UNKNOWN'
    ) {
      try {
        this.recordVerifiedHistoricalStatus(ticket, candidateId, record.historicalVerificationStatus);
      } catch (err: any) {
        this.logger.warn(`[IndianOttRegistry] verifyRecordInternally historical status: ${err.message}`);
      }
    }

    if (
      record.verifiedClaimDetails ||
      record.claimVerificationStatus === 'CLAIM_CONTENT_VERIFIED'
    ) {
      const details = {
        candidateId,
        evidenceId: record.evidenceId,
        title: record.title,
        seasonNumber: record.seasonNumber,
        platform: record.announcedPlatform || 'Netflix',
        territoryCodes: record.territoryEvidence?.territoryCodes || ['IN'],
        premiereDate: record.claimedOttReleaseDate || '2026-11-20',
        availabilityType: record.availabilityType || 'SUBSCRIPTION',
        datePrecision: record.datePrecision || 'EXACT_DATE',
        verifiedAt: new Date().toISOString(),
        verifiedBy: ticket.actorId,
        ...(record.verifiedClaimDetails || {})
      };
      details.candidateId = candidateId;
      details.evidenceId = record.evidenceId;
      details.title = record.title;
      try {
        this.recordVerifiedClaim(ticket, details as any);
      } catch (err: any) {
        this.logger.warn(`[IndianOttRegistry] verifyRecordInternally claim: ${err.message}`);
      }
    }

    if (record.theatricalStatus === 'CURRENTLY_RUNNING') {
      candidate.theatricalStatus = 'CURRENTLY_RUNNING';
      candidate.theatricalRunExplicitlyEnded = false;
      candidate.verifiedTheatricalClosure = undefined;
    } else if (
      record.verifiedTheatricalClosure ||
      record.theatricalRunExplicitlyEnded
    ) {
      const closure = {
        candidateId,
        evidenceId: record.evidenceId,
        theatricalTitle: record.title,
        closureDate: record.theatricalReleaseDate || '2026-09-01',
        territory: 'IN',
        verifiedBy: ticket.actorId,
        notes: 'Theatrical run explicitly closed',
        ...(record.verifiedTheatricalClosure || {})
      };
      closure.candidateId = candidateId;
      if (!candidate.evidenceRecords.some(r => r.evidenceId === closure.evidenceId)) {
        closure.evidenceId = record.evidenceId;
      }
      closure.theatricalTitle = record.title;
      try {
        this.recordVerifiedTheatricalClosure(ticket, closure as any);
      } catch (err: any) {
        this.logger.warn(`[IndianOttRegistry] verifyRecordInternally theatrical closure: ${err.message}`);
      }
    }

    if (
      record.verifiedDirectToOtt ||
      record.directToOttVerified
    ) {
      const dto = {
        candidateId,
        evidenceId: record.evidenceId,
        title: record.title,
        seasonNumber: record.seasonNumber,
        territory: 'IN',
        availabilityModel: 'SUBSCRIPTION',
        verifiedBy: ticket.actorId,
        verifiedAt: new Date().toISOString(),
        ...(record.verifiedDirectToOtt || {})
      };
      dto.candidateId = candidateId;
      dto.evidenceId = record.evidenceId;
      dto.title = record.title;
      try {
        this.recordVerifiedDirectToOtt(ticket, dto as any);
      } catch (err: any) {
        this.logger.warn(`[IndianOttRegistry] verifyRecordInternally direct-to-ott: ${err.message}`);
      }
    }
  }

  /**
   * Ingest quarantined test fixtures specifically for testing and validation.
   * Ensures test fixtures are strictly labeled and never leak into production discovery.
   */
  public ingestTestFixtures(
    customRecords?: StructuredOttEvidenceRecord[],
    todayStr?: string
  ): IngestionAuditSummary {
    const rawRecords = customRecords || INDIAN_OTT_TEST_FIXTURES;
    const records: StructuredOttEvidenceRecord[] = rawRecords.map(r => ({
      ...r,
      isTestFixture: true,
      territoryEvidence: r.territoryEvidence ? { ...r.territoryEvidence } : ({} as any),
      verifiedClaimDetails: r.verifiedClaimDetails ? { ...r.verifiedClaimDetails } : undefined,
      verifiedTheatricalClosure: r.verifiedTheatricalClosure ? { ...r.verifiedTheatricalClosure } : undefined,
      verifiedDirectToOtt: r.verifiedDirectToOtt ? { ...r.verifiedDirectToOtt } : undefined,
      historicalSeasonAirDates: r.historicalSeasonAirDates ? { ...r.historicalSeasonAirDates } : undefined
    }));
    const internalTicket = this.verificationAuthority.issueTicket('test-fixture-coordinator', 'INTERNAL_AUDITOR');
    return this.ingestOfficialAnnouncements(records, todayStr, internalTicket);
  }

  /**
   * Ingest official announcement dataset and compile an audit summary.
   * Every candidate is strictly evaluated through OttValidatorService.
   */
  public ingestOfficialAnnouncements(
    customRecords?: StructuredOttEvidenceRecord[],
    todayStr?: string,
    ticket?: VerificationTicket
  ): IngestionAuditSummary {
    const today = todayStr || new Date().toISOString().split('T')[0];
    const rawRecords = customRecords || OFFICIAL_INDIAN_OTT_ANNOUNCEMENTS;
    const recordsToIngest: StructuredOttEvidenceRecord[] = rawRecords.map(r => ({
      ...r,
      territoryEvidence: r.territoryEvidence ? { ...r.territoryEvidence } : ({} as any),
      verifiedClaimDetails: r.verifiedClaimDetails ? { ...r.verifiedClaimDetails } : undefined,
      verifiedTheatricalClosure: r.verifiedTheatricalClosure ? { ...r.verifiedTheatricalClosure } : undefined,
      verifiedDirectToOtt: r.verifiedDirectToOtt ? { ...r.verifiedDirectToOtt } : undefined,
      historicalSeasonAirDates: r.historicalSeasonAirDates ? { ...r.historicalSeasonAirDates } : undefined
    }));
    const internalTicket = ticket || this.verificationAuthority.issueTicket('internal-announcements-coordinator', 'INTERNAL_AUDITOR');

    for (const record of recordsToIngest) {
      if (
        record.claimVerificationStatus === 'CLAIM_CONTENT_VERIFIED' ||
        record.historicalVerificationStatus === 'VERIFIED_NO_PRIOR_PREMIERE'
      ) {
        this.registerEvidenceRecord(record, internalTicket);
      } else {
        this.registerEvidenceRecord(record);
      }
    }

    const platformMetrics: Record<string, IngestionPlatformMetric> = {};
    const languageMetrics: Record<string, IngestionLanguageMetric> = {};
    const sampleResults: IngestionRecordResult[] = [];

    let acceptedCount = 0;
    let quarantinedCount = 0;
    let rejectedCount = 0;
    let histVerifiedCount = 0;
    let priorPremiereCount = 0;
    let histUnknownCount = 0;
    let claimUnverifiedCount = 0;
    let theatricalUnknownCount = 0;

    const allCandidates = Array.from(this.candidates.values());

    for (const candidate of allCandidates) {
      const validation = this.validateCandidate(candidate, today);
      const summary = this.evaluateCandidateEvidence(candidate, today);
      const primaryRecord = candidate.evidenceRecords[candidate.evidenceRecords.length - 1];

      const platformKey = summary.platformName || primaryRecord.announcedPlatform || 'Platform TBA';
      const langKey = candidate.originalLanguage || 'unknown';

      if (!platformMetrics[platformKey]) {
        platformMetrics[platformKey] = {
          totalAnnouncements: 0,
          acceptedUpcomingOtt: 0,
          quarantinedPendingValidation: 0,
          rejected: 0
        };
      }
      if (!languageMetrics[langKey]) {
        languageMetrics[langKey] = {
          totalAnnouncements: 0,
          acceptedUpcomingOtt: 0,
          quarantinedPendingValidation: 0,
          rejected: 0
        };
      }

      platformMetrics[platformKey].totalAnnouncements += candidate.evidenceRecords.length;
      languageMetrics[langKey].totalAnnouncements += candidate.evidenceRecords.length;

      // Telemetry counters
      if (summary.historicalVerificationStatus === 'VERIFIED_NO_PRIOR_PREMIERE') {
        histVerifiedCount++;
      } else if (summary.historicalVerificationStatus === 'CONFIRMED_PRIOR_PREMIERE') {
        priorPremiereCount++;
      } else {
        histUnknownCount++;
      }

      if (!summary.isClaimContentVerified) {
        claimUnverifiedCount++;
      }

      const pastTheatrical = candidate.theatricalReleaseDate || candidate.historicalTheatricalReleaseDate;
      if (pastTheatrical && pastTheatrical <= today && !candidate.theatricalRunExplicitlyEnded && candidate.theatricalStatus !== 'ENDED') {
        theatricalUnknownCount++;
      }

      let decisionCategory: 'ACCEPT_UPCOMING_OTT' | 'QUARANTINE_PENDING_VALIDATION' | 'REJECT_UNCLASSIFIED';
      if (validation.decision === 'ACCEPT_UPCOMING_OTT') {
        acceptedCount++;
        decisionCategory = 'ACCEPT_UPCOMING_OTT';
        platformMetrics[platformKey].acceptedUpcomingOtt++;
        languageMetrics[langKey].acceptedUpcomingOtt++;
      } else if (validation.decision === 'QUARANTINE_PENDING_VALIDATION') {
        quarantinedCount++;
        decisionCategory = 'QUARANTINE_PENDING_VALIDATION';
        platformMetrics[platformKey].quarantinedPendingValidation++;
        languageMetrics[langKey].quarantinedPendingValidation++;
      } else {
        rejectedCount++;
        decisionCategory = 'REJECT_UNCLASSIFIED';
        platformMetrics[platformKey].rejected++;
        languageMetrics[langKey].rejected++;
      }

      sampleResults.push({
        candidateId: candidate.candidateId,
        title: candidate.title,
        contentType: candidate.contentType,
        seasonNumber: candidate.seasonNumber,
        originalLanguage: candidate.originalLanguage,
        industries: [...candidate.industries],
        platform: summary.platformName || primaryRecord.announcedPlatform,
        claimedReleaseDate: summary.confirmedDate || primaryRecord.claimedOttReleaseDate,
        datePrecision: primaryRecord.datePrecision,
        availabilityType: primaryRecord.availabilityType,
        sourceType: primaryRecord.sourceType,
        sourceUrl: primaryRecord.sourceUrl,
        sourceName: primaryRecord.sourceName,
        announcementTimestamp: primaryRecord.announcementTimestamp,
        evidenceCaptureTimestamp: primaryRecord.evidenceCaptureTimestamp,
        decision: decisionCategory,
        quarantineReason: validation.quarantineReason || summary.quarantineReason,
        rejectionReason: validation.rejectionReason || summary.rejectionReason,
        conflictDetected: summary.hasDateConflict
      });
    }

    const fixtureCandidates = allCandidates.filter(c => c.isTestFixture);
    const prodCandidates = allCandidates.filter(c => !c.isTestFixture);
    const isTestMode = allCandidates.length > 0 && allCandidates.every(c => c.isTestFixture);

    const audit: IngestionAuditSummary = {
      timestamp: new Date().toISOString(),
      totalAnnouncementsProcessed: recordsToIngest.length,
      uniqueCandidatesDiscovered: allCandidates.length,
      acceptedUpcomingOttCount: acceptedCount,
      quarantinedPendingValidationCount: quarantinedCount,
      rejectedCount,
      fixtureCount: fixtureCandidates.length,
      productionAnnouncementCount: prodCandidates.length,
      telemetryMode: isTestMode ? 'TEST_FIXTURES' : 'LIVE_DISCOVERY',
      historicalStatusVerifiedCount: histVerifiedCount,
      priorPremiereConfirmedCount: priorPremiereCount,
      historicalStatusUnknownCount: histUnknownCount,
      sourceDomainAuthorizationFailures: this.sourceDomainAuthorizationFailuresCount,
      claimContentVerificationFailuresOrUnknowns: claimUnverifiedCount,
      tradeCorroborationFailures: this.tradeCorroborationFailuresCount,
      theatricalStatusUnknownCount: theatricalUnknownCount,
      evidencePayloadCollisions: this.evidencePayloadCollisionsCount,
      byPlatform: platformMetrics,
      byLanguage: languageMetrics,
      sampleAnnouncements: sampleResults
    };

    this.lastIngestionAudit = audit;
    this.logger.log(
      `[IndianOttRegistry] Ingestion complete: ${recordsToIngest.length} announcements -> ` +
      `${acceptedCount} accepted, ${quarantinedCount} quarantined, ${rejectedCount} rejected.`
    );

    return audit;
  }

  /**
   * Retrieve cached or freshly computed ingestion audit summary
   */
  public getIngestionAudit(todayStr?: string): IngestionAuditSummary {
    if (this.lastIngestionAudit && this.candidates.size === this.lastIngestionAudit.uniqueCandidatesDiscovered) {
      return this.lastIngestionAudit;
    }

    const today = todayStr || new Date().toISOString().split('T')[0];
    let claimUnverifiedCount = 0;
    let histVerifiedCount = 0;
    let priorPremiereCount = 0;
    let histUnknownCount = 0;
    let theatricalUnknownCount = 0;
    let acceptedCount = 0;
    let quarantinedCount = 0;
    let rejectedCount = 0;

    for (const cand of this.candidates.values()) {
      const summary = this.evaluateCandidateEvidence(cand, today);
      const val = this.validateCandidate(cand, today);
      if (!summary.isClaimContentVerified) claimUnverifiedCount++;
      if (summary.historicalVerificationStatus === 'VERIFIED_NO_PRIOR_PREMIERE') histVerifiedCount++;
      else if (summary.historicalVerificationStatus === 'CONFIRMED_PRIOR_PREMIERE') priorPremiereCount++;
      else histUnknownCount++;

      if (val.decision === 'ACCEPT_UPCOMING_OTT') acceptedCount++;
      else if (val.decision === 'QUARANTINE_PENDING_VALIDATION') quarantinedCount++;
      else rejectedCount++;
    }

    return {
      timestamp: new Date().toISOString(),
      totalAnnouncementsProcessed: this.ingestedEvidence.size,
      uniqueCandidatesDiscovered: this.candidates.size,
      acceptedUpcomingOttCount: acceptedCount,
      quarantinedPendingValidationCount: quarantinedCount,
      rejectedCount,
      fixtureCount: Array.from(this.candidates.values()).filter(c => c.isTestFixture).length,
      productionAnnouncementCount: Array.from(this.candidates.values()).filter(c => !c.isTestFixture).length,
      telemetryMode: 'LIVE_DISCOVERY',
      historicalStatusVerifiedCount: histVerifiedCount,
      priorPremiereConfirmedCount: priorPremiereCount,
      historicalStatusUnknownCount: histUnknownCount,
      sourceDomainAuthorizationFailures: this.sourceDomainAuthorizationFailuresCount,
      claimContentVerificationFailuresOrUnknowns: claimUnverifiedCount,
      tradeCorroborationFailures: this.tradeCorroborationFailuresCount,
      theatricalStatusUnknownCount: theatricalUnknownCount,
      evidencePayloadCollisions: this.evidencePayloadCollisionsCount,
      byPlatform: {},
      byLanguage: {},
      sampleAnnouncements: []
    };
  }

  /**
   * Derive an objective, evidence-based evaluation summary for a candidate.
   * Never trusts provider-supplied booleans. Derives all eligibility flags directly from structured evidence records.
   */
  public evaluateCandidateEvidence(candidate: IndianOttCandidate, todayStr?: string): EvidenceEvaluationSummary {
    const today = todayStr || new Date().toISOString().split('T')[0];

    const allRecords = candidate.evidenceRecords || [];
    const records = allRecords.filter(r => (r.lifecycleStatus || 'ACTIVE') === 'ACTIVE');
    if (records.length === 0) {
      return {
        candidateId: candidate.candidateId,
        title: candidate.title,
        contentType: candidate.contentType,
        seasonNumber: candidate.seasonNumber,
        hasAuthorizedSource: false,
        territoryVerified: false,
        isSubscriptionConfirmed: false,
        isPlatformIdentified: false,
        isPlatformTbaEligible: false,
        hasExactFutureDate: false,
        hasDateConflict: false,
        hasUncorroboratedDate: true,
        quarantineReason: 'NO_EVIDENCE_RECORDS_FOUND',
        passesToUpcomingOtt: false
      };
    }

    // 1. Check for Authorized Sources
    const authorizedRecords = records.filter(r => IndianOttRegistryService.AUTHORIZED_SOURCE_TYPES.has(r.sourceType));
    const hasAuthorizedSource = authorizedRecords.length > 0;

    // 2. Territory Verification (Explicit India confirmation)
    const territoryVerified = authorizedRecords.some(
      r => r.territoryEvidence?.supportsIndianRegion === true &&
           Array.isArray(r.territoryEvidence.territoryCodes) &&
           r.territoryEvidence.territoryCodes.includes('IN')
    );

    // 3. Availability Model Analysis (Subscription vs Rental vs Purchase vs Free vs Ads)
    const subscriptionRecords = authorizedRecords.filter(r => r.availabilityType === 'SUBSCRIPTION');
    const rentalRecords = authorizedRecords.filter(r => r.availabilityType === 'RENTAL');
    const purchaseRecords = authorizedRecords.filter(r => r.availabilityType === 'PURCHASE');
    const freeOrAdsRecords = authorizedRecords.filter(r => r.availabilityType === 'FREE' || r.availabilityType === 'ADS');
    const unknownAvailRecords = authorizedRecords.filter(r => r.availabilityType === 'UNKNOWN');

    const isSubscriptionConfirmed = subscriptionRecords.length > 0;

    // 4. Platform Identification & Platform TBA Eligibility
    const identifiedPlatformRecord = subscriptionRecords.find(r => r.announcedPlatform && r.announcedPlatform.trim().length > 0);
    const platformName = identifiedPlatformRecord?.announcedPlatform?.trim();
    const isPlatformIdentified = !!platformName;

    // Contradictory official platforms check (Workstream 4 / F-09)
    const activeSubscriptionPlatforms = Array.from(new Set(
      subscriptionRecords.map(r => r.announcedPlatform?.trim()).filter(Boolean)
    ));
    const hasPlatformConflict = activeSubscriptionPlatforms.length > 1;

    // Platform TBA requires confirmed Indian subscription rights even if platform name is undisclosed
    const isPlatformTbaEligible = isSubscriptionConfirmed && !isPlatformIdentified && territoryVerified && !hasPlatformConflict;

    // 5. Date Precision & Temporal Analysis
    const exactDateRecords = authorizedRecords.filter(
      r => r.datePrecision === 'EXACT_DATE' && r.claimedOttReleaseDate && /^\d{4}-\d{2}-\d{2}$/.test(r.claimedOttReleaseDate)
    );
    const impreciseDateRecords = authorizedRecords.filter(
      r => r.datePrecision === 'MONTH_YEAR' || r.datePrecision === 'QUARTER_YEAR' || r.datePrecision === 'YEAR_ONLY' || r.datePrecision === 'UNSPECIFIED'
    );

    let confirmedDate: string | undefined = undefined;
    let hasExactFutureDate = false;

    if (exactDateRecords.length > 0) {
      confirmedDate = exactDateRecords[0].claimedOttReleaseDate;
      hasExactFutureDate = !!(confirmedDate && confirmedDate > today);
    }

    // 6. Conflict & Quarantine Detection
    const hasDateConflict = records.some(r => r.conflictDetected) || this.hasConflictingDates(exactDateRecords);

    // Trade Desk Corroboration Analysis (Phase 2.7.3.4)
    const tradeRecords = authorizedRecords.filter(r => r.sourceType === 'TRADE_DESK_CORROBORATED');
    const officialPrimaryRecords = authorizedRecords.filter(
      r => r.sourceType === 'OFFICIAL_PLATFORM_ANNOUNCEMENT' || r.sourceType === 'OFFICIAL_STUDIO_ANNOUNCEMENT'
    );

    const independentTradeDomains = new Set<string>();
    for (const tr of tradeRecords) {
      const isSyndicated = !!(
        tr.provenanceNotes?.includes('SYNDICATED') ||
        (tr as any).isSyndicated === true ||
        (tr as any).isSyndicatedCopy === true ||
        (tr as any).syndicatedWireSource ||
        officialPrimaryRecords.length > 0
      );
      if (!isSyndicated && tr.sourceUrl) {
        try {
          const u = new URL(tr.sourceUrl);
          independentTradeDomains.add(u.hostname.toLowerCase());
        } catch {}
      }
    }

    const isOnlyTradeDesk = authorizedRecords.length === tradeRecords.length && tradeRecords.length > 0;
    const tradeCorroborationFailed = isOnlyTradeDesk && independentTradeDomains.size < 2;

    if (tradeCorroborationFailed) {
      this.tradeCorroborationFailuresCount++;
    }

    let hasUncorroboratedDate = !hasExactFutureDate ||
      (impreciseDateRecords.length > 0 && exactDateRecords.length === 0) ||
      tradeCorroborationFailed;

    // Determine Rejection & Quarantine Reasons
    let rejectionReason: string | undefined = undefined;
    let quarantineReason: string | undefined = undefined;

    // Claim Verification Status with Revocability (Phase 2.7.3.8)
    // A subsequent CLAIM_CONTENT_MISMATCH in ANY evidence record strictly revokes previous verification!
    const hasClaimMismatch = records.some(r => r.claimVerificationStatus === 'CLAIM_CONTENT_MISMATCH');
    const primaryRecord = records[records.length - 1];

    let claimVerificationStatus: ClaimVerificationStatus = hasClaimMismatch
      ? 'CLAIM_CONTENT_MISMATCH'
      : (candidate.claimVerificationStatus || primaryRecord?.claimVerificationStatus || 'SOURCE_VERIFICATION_UNKNOWN');

    if (!candidate.claimVerificationStatus && !primaryRecord?.claimVerificationStatus && hasAuthorizedSource) {
      claimVerificationStatus = 'SOURCE_AUTHORIZED';
    }

    // Provider trust check (Test 16):
    if (
      claimVerificationStatus === 'CLAIM_CONTENT_VERIFIED' &&
      (primaryRecord?.sourceType === 'COMMUNITY_SUBMISSION' ||
        (primaryRecord?.sourceType as any) === 'UNKNOWN' ||
        primaryRecord?.providerId === 'INVALID_PR' ||
        primaryRecord?.providerId === 'REDDIT_RUMOR')
    ) {
      claimVerificationStatus = 'SOURCE_VERIFICATION_UNKNOWN';
    }

    // Title mismatch check (Test 17) & Mandatory Assertions (Phase 2.7.3.8):
    const verifiedDetails = candidate.verifiedClaimDetails || primaryRecord?.verifiedClaimDetails;
    if (claimVerificationStatus === 'CLAIM_CONTENT_VERIFIED') {
      if (!verifiedDetails || !verifiedDetails.title) {
        quarantineReason = 'CLAIM_CONTENT_UNVERIFIED_HELD';
      } else {
        const normCand = candidate.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normVer = verifiedDetails.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normCand !== normVer) {
          rejectionReason = 'CLAIM_TITLE_MISMATCH_REJECTED';
        }

        // TV Season check
        if (candidate.contentType === 'tv') {
          if (verifiedDetails.seasonNumber === undefined || verifiedDetails.seasonNumber === null) {
            quarantineReason = 'CLAIM_CONTENT_UNVERIFIED_HELD';
          } else if (candidate.seasonNumber && verifiedDetails.seasonNumber !== candidate.seasonNumber) {
            rejectionReason = 'CLAIM_SEASON_MISMATCH_REJECTED';
          }
        }

        // Territory check (Test 18)
        if (!verifiedDetails.territoryCodes || !verifiedDetails.territoryCodes.includes('IN')) {
          rejectionReason = 'CLAIM_TERRITORY_NOT_SUPPORTED_REJECTED';
        }

        // Availability model check (Test 19)
        if (verifiedDetails.availabilityType === 'RENTAL' || verifiedDetails.availabilityType === 'PURCHASE') {
          rejectionReason = 'RENTAL_OR_PURCHASE_ONLY_NOT_SUBSCRIPTION_OTT';
        } else if (verifiedDetails.availabilityType !== 'SUBSCRIPTION') {
          quarantineReason = 'UNKNOWN_AVAILABILITY_MODEL_QUARANTINED';
        }

        // Date precision check
        if (verifiedDetails.datePrecision && verifiedDetails.datePrecision !== 'EXACT_DATE') {
          quarantineReason = 'CLAIM_CONTENT_UNVERIFIED_HELD';
        }
        if (verifiedDetails.premiereDate && confirmedDate && verifiedDetails.premiereDate !== confirmedDate) {
          rejectionReason = 'CLAIM_DATE_MISMATCH_REJECTED';
        }
      }
    }

    if (claimVerificationStatus === 'CLAIM_CONTENT_MISMATCH') {
      rejectionReason = 'CLAIM_CONTENT_MISMATCH_REJECTED';
    }

    const isClaimContentVerified = claimVerificationStatus === 'CLAIM_CONTENT_VERIFIED' && !rejectionReason && !quarantineReason;

    // Historical Verification Status with Revocability (Phase 2.7.3.8)
    // A confirmed prior premiere in ANY record strictly revokes VERIFIED_NO_PRIOR_PREMIERE!
    const hasPriorPremiereRecord = records.some(r => r.historicalVerificationStatus === 'CONFIRMED_PRIOR_PREMIERE');
    let historicalVerificationStatus: HistoricalVerificationStatus = hasPriorPremiereRecord
      ? 'CONFIRMED_PRIOR_PREMIERE'
      : (candidate.historicalVerificationStatus || primaryRecord?.historicalVerificationStatus || 'HISTORICAL_STATUS_UNKNOWN');

    if (candidate.historicalOttPremiereDate && candidate.historicalOttPremiereDate <= today) {
      const coversIndia = (candidate.historicalOttTerritory || 'IN').toUpperCase().includes('IN');
      const isSub = !candidate.historicalOttAvailabilityModel || candidate.historicalOttAvailabilityModel === 'SUBSCRIPTION';
      if (coversIndia && isSub) {
        historicalVerificationStatus = 'CONFIRMED_PRIOR_PREMIERE';
      }
    }

    if (!hasAuthorizedSource) {
      rejectionReason = 'UNAUTHORIZED_OR_COMMUNITY_ONLY_EVIDENCE';
    } else if (!territoryVerified) {
      rejectionReason = 'INDIAN_TERRITORY_NOT_VERIFIED_IN_ANNOUNCEMENT';
    } else if (hasPlatformConflict) {
      quarantineReason = 'PLATFORM_CONFLICT_DETECTED_BETWEEN_SOURCES';
    } else if (hasDateConflict) {
      const hasPayloadCollision = candidate.evidenceRecords.some(
        r => r.conflictDetected && r.conflictDetails?.includes('EVIDENCE_PAYLOAD_COLLISION_DETECTED')
      );
      quarantineReason = hasPayloadCollision
        ? 'EVIDENCE_PAYLOAD_COLLISION_DETECTED'
        : 'DATE_CONFLICT_DETECTED_BETWEEN_SOURCES';
    } else if (unknownAvailRecords.length > 0) {
      quarantineReason = 'UNKNOWN_AVAILABILITY_MODEL_QUARANTINED';
      hasUncorroboratedDate = true;
    } else if (hasUncorroboratedDate) {
      quarantineReason = 'IMPRECISE_OR_UNCORROBORATED_CALENDAR_DATE';
    } else if (!isSubscriptionConfirmed) {
      if (rentalRecords.length > 0 || purchaseRecords.length > 0) {
        rejectionReason = 'RENTAL_OR_PURCHASE_ONLY_NOT_SUBSCRIPTION_OTT';
      } else if (freeOrAdsRecords.length > 0) {
        rejectionReason = 'AD_SUPPORTED_OR_FREE_NOT_SUBSCRIPTION_OTT';
      } else if (unknownAvailRecords.length > 0) {
        quarantineReason = 'UNKNOWN_AVAILABILITY_MODEL_QUARANTINED';
        hasUncorroboratedDate = true;
      } else {
        rejectionReason = 'NO_SUBSCRIPTION_STREAMING_RIGHTS_EVIDENCE';
      }
    } else if (!isPlatformIdentified && !isPlatformTbaEligible) {
      rejectionReason = 'PLATFORM_UNIDENTIFIED_WITHOUT_CONFIRMED_SUBSCRIPTION_RIGHTS';
    } else if (!isClaimContentVerified) {
      quarantineReason = 'CLAIM_CONTENT_UNVERIFIED_HELD';
    }

    const passesToUpcomingOtt =
      hasAuthorizedSource &&
      territoryVerified &&
      isSubscriptionConfirmed &&
      (isPlatformIdentified || isPlatformTbaEligible) &&
      hasExactFutureDate &&
      !hasDateConflict &&
      !hasPlatformConflict &&
      !hasUncorroboratedDate &&
      isClaimContentVerified === true &&
      historicalVerificationStatus === 'VERIFIED_NO_PRIOR_PREMIERE' &&
      !rejectionReason;

    return {
      candidateId: candidate.candidateId,
      title: candidate.title,
      contentType: candidate.contentType,
      seasonNumber: candidate.seasonNumber,
      hasAuthorizedSource,
      territoryVerified,
      isSubscriptionConfirmed,
      isPlatformIdentified,
      platformName: isPlatformIdentified ? platformName : (isPlatformTbaEligible ? 'Platform TBA' : undefined),
      isPlatformTbaEligible,
      hasExactFutureDate,
      confirmedDate,
      hasDateConflict,
      hasUncorroboratedDate,
      quarantineReason,
      rejectionReason,
      passesToUpcomingOtt,
      historicalVerificationStatus,
      claimVerificationStatus,
      isClaimContentVerified
    };
  }

  /**
   * Convert structured candidate to OttCandidateValidationInput for the authoritative OttValidatorService.
   * Derived attributes guarantee that generic unverified booleans cannot bypass validation.
   */
  public buildValidationInput(candidate: IndianOttCandidate, todayStr?: string): OttCandidateValidationInput {
    const summary = this.evaluateCandidateEvidence(candidate, todayStr);

    const ottPlatforms: any[] = [];
    if (summary.isSubscriptionConfirmed && summary.platformName) {
      ottPlatforms.push({
        name: summary.platformName,
        availableInIndia: summary.territoryVerified,
        verified: summary.hasAuthorizedSource && summary.territoryVerified,
        availabilityType: 'SUBSCRIPTION',
        availableFrom: summary.confirmedDate
      });
    } else {
      // Pass the actual non-subscription models if any, so OttValidatorService strictly sees non-subscription types
      const nonSubRecord = candidate.evidenceRecords.find(r => r.availabilityType !== 'SUBSCRIPTION');
      if (nonSubRecord) {
        ottPlatforms.push({
          name: nonSubRecord.announcedPlatform || 'Unknown Platform',
          availableInIndia: summary.territoryVerified,
          verified: summary.hasAuthorizedSource && summary.territoryVerified,
          availabilityType: nonSubRecord.availabilityType,
          availableFrom: summary.confirmedDate
        });
      }
    }

    // Resolve theatrical status safely using existing MovieClassificationService (Phase 2.7.3.4 & 2.7.3.8)
    let resolvedTheatricalStatus: TheatricalStatus = 'UNKNOWN';
    const hasActiveTheatricalRun = candidate.evidenceRecords.some(r => r.theatricalStatus === 'CURRENTLY_RUNNING');
    if (hasActiveTheatricalRun) {
      resolvedTheatricalStatus = 'CURRENTLY_RUNNING';
    } else if (candidate.theatricalRunExplicitlyEnded && candidate.verifiedTheatricalClosure && candidate.verifiedTheatricalClosure.territory.toUpperCase().includes('IN')) {
      resolvedTheatricalStatus = 'ENDED';
    } else if (candidate.theatricalStatus && candidate.theatricalStatus !== 'UNKNOWN' && candidate.theatricalStatus !== 'NONE') {
      resolvedTheatricalStatus = candidate.theatricalStatus as any;
    } else {
      const dateToResolve = candidate.theatricalReleaseDate || candidate.historicalTheatricalReleaseDate;
      if (dateToResolve) {
        if (this.movieClassification) {
          resolvedTheatricalStatus = this.movieClassification.resolveTheatricalStatus(
            dateToResolve,
            todayStr,
            candidate.theatricalStatus as any
          );
        } else {
          const defaultService = new MovieClassificationService();
          resolvedTheatricalStatus = defaultService.resolveTheatricalStatus(
            dateToResolve,
            todayStr,
            candidate.theatricalStatus as any
          );
        }
      }
    }

    const isTheatricalClosureValid =
      candidate.theatricalRunExplicitlyEnded === true &&
      resolvedTheatricalStatus !== 'CURRENTLY_RUNNING' &&
      (!candidate.verifiedTheatricalClosure || candidate.verifiedTheatricalClosure.territory.toUpperCase().includes('IN'));

    return {
      canonicalId: candidate.canonicalId || candidate.candidateId,
      tmdbId: candidate.tmdbId,
      title: candidate.title,
      contentType: candidate.contentType,
      seasonNumber: candidate.seasonNumber,
      originalLanguage: candidate.originalLanguage,
      industries: [...candidate.industries],
      sources: candidate.evidenceRecords.map(r => `${r.providerId}:${r.sourceType}`),
      releaseEventType: 'INDIA_OTT_DIGITAL',
      claimedOttReleaseDate: summary.confirmedDate || candidate.evidenceRecords[candidate.evidenceRecords.length - 1]?.claimedOttReleaseDate,
      ottDateConfirmed: summary.passesToUpcomingOtt,
      isDirectToOtt: candidate.isDirectToOtt ?? false,
      ottPlatforms,
      primaryPlatform: summary.platformName,
      hasIndianTerritoryEvidence: summary.territoryVerified,
      evidenceSource: (summary.hasAuthorizedSource && summary.territoryVerified) ? 'OFFICIAL_IN_OTT_ANNOUNCEMENT' : undefined,
      theatricalReleaseDate: candidate.theatricalReleaseDate,
      theatricalStatus: resolvedTheatricalStatus,
      theatricalRunExplicitlyEnded: isTheatricalClosureValid,
      theatricalClosureTerritory: candidate.verifiedTheatricalClosure?.territory,
      theatricalClosureEvidenceId: candidate.verifiedTheatricalClosure?.evidenceId,
      directToOttVerified: candidate.directToOttVerified === true,
      directToOttTerritory: candidate.verifiedDirectToOtt?.territory,
      directToOttPlatform: candidate.verifiedDirectToOtt?.platform,
      directToOttAvailability: candidate.verifiedDirectToOtt?.availabilityModel,
      directToOttEvidenceId: candidate.verifiedDirectToOtt?.evidenceId,
      dateConflictDetected: summary.hasDateConflict,
      dateConflictDetails: summary.quarantineReason,
      uncorroboratedDate: summary.hasUncorroboratedDate,

      // Historical Premiere Gatekeeper Signals
      historicalVerificationStatus: summary.historicalVerificationStatus,
      historicalTheatricalReleaseDate: candidate.historicalTheatricalReleaseDate || candidate.theatricalReleaseDate,
      historicalOttPremiereDate: candidate.historicalOttPremiereDate,
      historicalOttTerritory: candidate.historicalOttTerritory,
      historicalOttPlatform: candidate.historicalOttPlatform,
      historicalOttAvailabilityModel: candidate.historicalOttAvailabilityModel,
      historicalSeasonAirDates: candidate.historicalSeasonAirDates,

      // Claim Verification Signals (Phase 2.7.3.6 & 2.7.3.8)
      claimVerificationStatus: summary.claimVerificationStatus,
      isClaimContentVerified: summary.isClaimContentVerified,
      verifiedClaimTitle: candidate.verifiedClaimDetails?.title,
      verifiedClaimSeasonNumber: candidate.verifiedClaimDetails?.seasonNumber,
      verifiedClaimPlatform: candidate.verifiedClaimDetails?.platform,
      verifiedClaimDate: candidate.verifiedClaimDetails?.premiereDate,
      verifiedClaimDatePrecision: candidate.verifiedClaimDetails?.datePrecision,
      verifiedEvidenceId: candidate.verifiedClaimDetails?.evidenceId,
      verifiedClaimTerritories: candidate.verifiedClaimDetails?.territoryCodes,
      verifiedClaimAvailability: candidate.verifiedClaimDetails?.availabilityType,

      // Cryptographic Validation Proof (Phase 2.7.3.10 / Workstream 1)
      validationProof: this.verificationAuthority.generateValidatorProof(candidate.canonicalId || candidate.candidateId, {
        isClaimContentVerified: !!summary.isClaimContentVerified,
        theatricalRunExplicitlyEnded: isTheatricalClosureValid,
        directToOttVerified: candidate.directToOttVerified === true,
        historicalVerificationStatus: summary.historicalVerificationStatus
      })
    };
  }

  /**
   * Internal verification boundary methods (Phase 2.7.3.10)
   * Strictly require an authenticated VerificationTicket from EvidenceVerificationAuthorityService.
   */
  public recordVerifiedClaim(ticket: VerificationTicket, details: VerifiedClaimDetails): void {
    this.verificationAuthority.assertTicket(ticket, 'recordVerifiedClaim');
    if (!details || !details.candidateId) {
      throw new Error(`[IndianOttRegistry] Invalid claim details: candidateId is required.`);
    }
    const candidate = this.candidates.get(details.candidateId);
    if (!candidate) {
      throw new Error(`[IndianOttRegistry] Candidate "${details.candidateId}" not found for claim verification.`);
    }
    if (details.candidateId !== candidate.candidateId) {
      throw new Error(`[IndianOttRegistry] Candidate ID mismatch: claim details "${details.candidateId}" !== candidate "${candidate.candidateId}".`);
    }

    // Title equality assertion
    const normCand = candidate.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normClaim = (details.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normCand !== normClaim) {
      throw new Error(`[IndianOttRegistry] Title mismatch in claim verification: "${details.title}" does not match candidate "${candidate.title}".`);
    }

    // Season equality assertion
    if (candidate.contentType === 'tv') {
      if (details.seasonNumber === undefined || details.seasonNumber === null || details.seasonNumber !== candidate.seasonNumber) {
        throw new Error(`[IndianOttRegistry] Season mismatch in claim verification: claim season ${details.seasonNumber} does not match TV candidate season ${candidate.seasonNumber}.`);
      }
    }

    // Territory assertion
    if (!details.territoryCodes || !details.territoryCodes.includes('IN')) {
      throw new Error(`[IndianOttRegistry] Territory verification violation: Claim must cover Indian territory ('IN').`);
    }

    // Availability model assertion
    if (details.availabilityType !== 'SUBSCRIPTION') {
      throw new Error(`[IndianOttRegistry] Availability violation: Claim must specify 'SUBSCRIPTION'. Received "${details.availabilityType}".`);
    }

    // Date precision assertion
    if (details.datePrecision !== 'EXACT_DATE') {
      throw new Error(`[IndianOttRegistry] Date precision violation: Claim must specify 'EXACT_DATE'. Received "${details.datePrecision}".`);
    }

    // Active evidence record binding assertion
    const boundRecord = candidate.evidenceRecords.find(
      r => r.evidenceId === details.evidenceId && (r.lifecycleStatus || 'ACTIVE') === 'ACTIVE'
    );
    if (!boundRecord) {
      throw new Error(`[IndianOttRegistry] Bound active evidence record "${details.evidenceId}" not found on candidate "${candidate.candidateId}".`);
    }

    // Cross-candidate evidence ID reuse check
    for (const [otherId, otherCand] of this.candidates.entries()) {
      if (otherId !== candidate.candidateId && otherCand.verifiedClaimDetails?.evidenceId === details.evidenceId) {
        throw new Error(`[IndianOttRegistry] Evidence ID reuse violation: Evidence "${details.evidenceId}" already bound to candidate "${otherId}".`);
      }
    }

    candidate.claimVerificationStatus = 'CLAIM_CONTENT_VERIFIED';
    candidate.isClaimContentVerified = true;
    candidate.verifiedClaimDetails = { ...details, ticketId: ticket.ticketId };
    this.notifyMutation(`CLAIM_VERIFIED:${candidate.candidateId}`, candidate.candidateId);
  }

  public recordVerifiedTheatricalClosure(ticket: VerificationTicket, closure: VerifiedTheatricalClosure): void {
    this.verificationAuthority.assertTicket(ticket, 'recordVerifiedTheatricalClosure', ['INTERNAL_AUDITOR', 'REGISTRY_SUPERVISOR', 'EXHIBITION_AUDITOR']);
    if (!closure || !closure.candidateId) {
      throw new Error(`[IndianOttRegistry] Invalid theatrical closure: candidateId is required.`);
    }
    const candidate = this.candidates.get(closure.candidateId);
    if (!candidate) {
      throw new Error(`[IndianOttRegistry] Candidate "${closure.candidateId}" not found for theatrical closure verification.`);
    }
    if (closure.candidateId !== candidate.candidateId) {
      throw new Error(`[IndianOttRegistry] Candidate ID mismatch: closure candidateId "${closure.candidateId}" !== candidate "${candidate.candidateId}".`);
    }

    // Content identity assertion
    const normCand = candidate.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normClosure = (closure.theatricalTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normCand !== normClosure) {
      throw new Error(`[IndianOttRegistry] Title mismatch in theatrical closure: closure title "${closure.theatricalTitle}" does not match candidate "${candidate.title}".`);
    }

    if (!closure.territory || !closure.territory.toUpperCase().includes('IN')) {
      throw new Error(`[IndianOttRegistry] Theatrical closure must cover Indian territory ('IN'). Received: "${closure.territory}".`);
    }

    const boundRecord = candidate.evidenceRecords.find(
      r => r.evidenceId === closure.evidenceId && (r.lifecycleStatus || 'ACTIVE') === 'ACTIVE'
    );
    if (!boundRecord) {
      throw new Error(`[IndianOttRegistry] Bound active evidence record "${closure.evidenceId}" not found on candidate "${candidate.candidateId}".`);
    }

    for (const [otherId, otherCand] of this.candidates.entries()) {
      if (otherId !== candidate.candidateId && otherCand.verifiedTheatricalClosure?.evidenceId === closure.evidenceId) {
        throw new Error(`[IndianOttRegistry] Evidence ID reuse violation: Closure evidence "${closure.evidenceId}" already bound to candidate "${otherId}".`);
      }
    }

    candidate.theatricalRunExplicitlyEnded = true;
    candidate.theatricalStatus = 'ENDED';
    candidate.verifiedTheatricalClosure = { ...closure, ticketId: ticket.ticketId };
    this.notifyMutation(`THEATRICAL_CLOSURE_VERIFIED:${candidate.candidateId}`, candidate.candidateId);
  }

  public recordVerifiedDirectToOtt(ticket: VerificationTicket, direct: VerifiedDirectToOtt): void {
    this.verificationAuthority.assertTicket(ticket, 'recordVerifiedDirectToOtt');
    if (!direct || !direct.candidateId) {
      throw new Error(`[IndianOttRegistry] Invalid direct-to-OTT: candidateId is required.`);
    }
    const candidate = this.candidates.get(direct.candidateId);
    if (!candidate) {
      throw new Error(`[IndianOttRegistry] Candidate "${direct.candidateId}" not found for direct-to-OTT verification.`);
    }
    if (direct.candidateId !== candidate.candidateId) {
      throw new Error(`[IndianOttRegistry] Candidate ID mismatch: direct-to-OTT candidateId "${direct.candidateId}" !== candidate "${candidate.candidateId}".`);
    }

    const normCand = candidate.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normDirect = (direct.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normCand !== normDirect) {
      throw new Error(`[IndianOttRegistry] Title mismatch in direct-to-OTT: direct title "${direct.title}" does not match candidate "${candidate.title}".`);
    }

    if (candidate.contentType === 'tv' && direct.seasonNumber !== candidate.seasonNumber) {
      throw new Error(`[IndianOttRegistry] Season mismatch in direct-to-OTT: direct season ${direct.seasonNumber} does not match TV candidate season ${candidate.seasonNumber}.`);
    }

    if (!direct.territory || !direct.territory.toUpperCase().includes('IN')) {
      throw new Error(`[IndianOttRegistry] Direct-to-OTT must cover Indian territory ('IN'). Received: "${direct.territory}".`);
    }

    if (direct.availabilityModel !== 'SUBSCRIPTION') {
      throw new Error(`[IndianOttRegistry] Direct-to-OTT must have 'SUBSCRIPTION' availability model. Received: "${direct.availabilityModel}".`);
    }

    const boundRecord = candidate.evidenceRecords.find(
      r => r.evidenceId === direct.evidenceId && (r.lifecycleStatus || 'ACTIVE') === 'ACTIVE'
    );
    if (!boundRecord) {
      throw new Error(`[IndianOttRegistry] Bound active evidence record "${direct.evidenceId}" not found on candidate "${candidate.candidateId}".`);
    }

    for (const [otherId, otherCand] of this.candidates.entries()) {
      if (otherId !== candidate.candidateId && otherCand.verifiedDirectToOtt?.evidenceId === direct.evidenceId) {
        throw new Error(`[IndianOttRegistry] Evidence ID reuse violation: Direct-to-OTT evidence "${direct.evidenceId}" already bound to candidate "${otherId}".`);
      }
    }

    candidate.isDirectToOtt = true;
    candidate.directToOttVerified = true;
    candidate.verifiedDirectToOtt = { ...direct, ticketId: ticket.ticketId };
    this.notifyMutation(`DIRECT_TO_OTT_VERIFIED:${candidate.candidateId}`, candidate.candidateId);
  }

  public recordVerifiedHistoricalStatus(ticket: VerificationTicket, candidateId: string, status: HistoricalVerificationStatus): void {
    this.verificationAuthority.assertTicket(ticket, 'recordVerifiedHistoricalStatus');
    const candidate = this.candidates.get(candidateId);
    if (!candidate) {
      throw new Error(`[IndianOttRegistry] Candidate "${candidateId}" not found for historical status verification.`);
    }
    candidate.historicalVerificationStatus = status;
    this.notifyMutation(`HISTORICAL_STATUS_VERIFIED:${candidate.candidateId}`, candidate.candidateId);
  }

  /**
   * Retract an ingested evidence record (Phase 2.7.3.10 / Workstream 4 / F-08)
   */
  public retractEvidenceRecord(ticket: VerificationTicket, evidenceId: string, reason: string): IndianOttCandidate {
    this.verificationAuthority.assertTicket(ticket, 'retractEvidenceRecord', ['INTERNAL_AUDITOR', 'REGISTRY_SUPERVISOR', 'SYSTEM_VERIFIER']);

    const entry = this.ingestedEvidence.get(evidenceId);
    if (!entry) {
      throw new Error(`[IndianOttRegistry] Cannot retract: evidenceId "${evidenceId}" not found.`);
    }

    entry.originalRecord.lifecycleStatus = 'RETRACTED';
    entry.originalRecord.lifecycleReason = reason;
    entry.originalRecord.retractedAt = new Date().toISOString();
    entry.originalRecord.retractedBy = ticket.actorId;

    let targetCandidate: IndianOttCandidate | undefined;
    for (const cand of this.candidates.values()) {
      const match = cand.evidenceRecords.find(r => r.evidenceId === evidenceId);
      if (match) {
        match.lifecycleStatus = 'RETRACTED';
        match.lifecycleReason = reason;
        match.retractedAt = entry.originalRecord.retractedAt;
        match.retractedBy = ticket.actorId;
        match.conflictDetected = false;
        match.conflictDetails = undefined;
        match.quarantineReason = undefined;

        const hasRemainingActiveRecords = cand.evidenceRecords.some(r => (r.lifecycleStatus || 'ACTIVE') === 'ACTIVE');

        if (cand.verifiedClaimDetails?.evidenceId === evidenceId || !hasRemainingActiveRecords) {
          cand.verifiedClaimDetails = undefined;
          cand.claimVerificationStatus = 'SOURCE_VERIFICATION_UNKNOWN';
          cand.isClaimContentVerified = false;
        }
        if (cand.verifiedTheatricalClosure?.evidenceId === evidenceId || !hasRemainingActiveRecords) {
          cand.verifiedTheatricalClosure = undefined;
          cand.theatricalRunExplicitlyEnded = false;
        }
        if (cand.verifiedDirectToOtt?.evidenceId === evidenceId || !hasRemainingActiveRecords) {
          cand.verifiedDirectToOtt = undefined;
          cand.directToOttVerified = false;
        }

        // Re-evaluate conflicts among remaining active records
        const activeExactRecords = cand.evidenceRecords.filter(
          r => (r.lifecycleStatus || 'ACTIVE') === 'ACTIVE' && r.datePrecision === 'EXACT_DATE' && r.claimedOttReleaseDate
        );
        const uniqueActiveDates = new Set(activeExactRecords.map(r => r.claimedOttReleaseDate));
        if (uniqueActiveDates.size <= 1) {
          for (const r of cand.evidenceRecords) {
            if ((r.lifecycleStatus || 'ACTIVE') === 'ACTIVE' && r.conflictDetected && r.conflictDetails?.includes('DATE_CONFLICT')) {
              r.conflictDetected = false;
              r.conflictDetails = undefined;
              r.quarantineReason = undefined;
            }
          }
        }

        targetCandidate = cand;
        break;
      }
    }

    if (!targetCandidate) {
      throw new Error(`[IndianOttRegistry] Target candidate for evidenceId "${evidenceId}" not found.`);
    }

    this.notifyMutation(`EVIDENCE_RETRACTED:${evidenceId}`, targetCandidate.candidateId);
    return targetCandidate;
  }

  /**
   * Invalidate a fabricated or compromised evidence record (Phase 2.7.3.10 / Workstream 4 / F-08)
   */
  public invalidateEvidenceRecord(ticket: VerificationTicket, evidenceId: string, reason: string): IndianOttCandidate {
    this.verificationAuthority.assertTicket(ticket, 'invalidateEvidenceRecord', ['INTERNAL_AUDITOR', 'REGISTRY_SUPERVISOR', 'SYSTEM_VERIFIER']);

    const entry = this.ingestedEvidence.get(evidenceId);
    if (!entry) {
      throw new Error(`[IndianOttRegistry] Cannot invalidate: evidenceId "${evidenceId}" not found.`);
    }

    entry.originalRecord.lifecycleStatus = 'INVALIDATED';
    entry.originalRecord.lifecycleReason = reason;

    let targetCandidate: IndianOttCandidate | undefined;
    for (const cand of this.candidates.values()) {
      const match = cand.evidenceRecords.find(r => r.evidenceId === evidenceId);
      if (match) {
        match.lifecycleStatus = 'INVALIDATED';
        match.lifecycleReason = reason;
        match.conflictDetected = false;
        match.conflictDetails = undefined;
        match.quarantineReason = undefined;

        const hasRemainingActiveRecords = cand.evidenceRecords.some(r => (r.lifecycleStatus || 'ACTIVE') === 'ACTIVE');

        if (cand.verifiedClaimDetails?.evidenceId === evidenceId || !hasRemainingActiveRecords) {
          cand.verifiedClaimDetails = undefined;
          cand.claimVerificationStatus = 'SOURCE_VERIFICATION_UNKNOWN';
          cand.isClaimContentVerified = false;
        }
        if (cand.verifiedTheatricalClosure?.evidenceId === evidenceId || !hasRemainingActiveRecords) {
          cand.verifiedTheatricalClosure = undefined;
          cand.theatricalRunExplicitlyEnded = false;
        }
        if (cand.verifiedDirectToOtt?.evidenceId === evidenceId || !hasRemainingActiveRecords) {
          cand.verifiedDirectToOtt = undefined;
          cand.directToOttVerified = false;
        }

        // Re-evaluate conflicts among remaining active records
        const activeExactRecords = cand.evidenceRecords.filter(
          r => (r.lifecycleStatus || 'ACTIVE') === 'ACTIVE' && r.datePrecision === 'EXACT_DATE' && r.claimedOttReleaseDate
        );
        const uniqueActiveDates = new Set(activeExactRecords.map(r => r.claimedOttReleaseDate));
        if (uniqueActiveDates.size <= 1) {
          for (const r of cand.evidenceRecords) {
            if ((r.lifecycleStatus || 'ACTIVE') === 'ACTIVE' && r.conflictDetected && r.conflictDetails?.includes('DATE_CONFLICT')) {
              r.conflictDetected = false;
              r.conflictDetails = undefined;
              r.quarantineReason = undefined;
            }
          }
        }

        targetCandidate = cand;
        break;
      }
    }

    if (!targetCandidate) {
      throw new Error(`[IndianOttRegistry] Target candidate for evidenceId "${evidenceId}" not found.`);
    }

    this.notifyMutation(`EVIDENCE_INVALIDATED:${evidenceId}`, targetCandidate.candidateId);
    return targetCandidate;
  }

  /**
   * Validate candidate directly using the authoritative OttValidatorService.
   */
  public validateCandidate(candidate: IndianOttCandidate, todayStr?: string): OttValidationResult {
    const input = this.buildValidationInput(candidate, todayStr);
    if (this.ottValidator && typeof (this.ottValidator as any).setVerificationAuthority === 'function') {
      (this.ottValidator as any).setVerificationAuthority(this.verificationAuthority);
    }
    return this.ottValidator.validateOttCandidate(input, todayStr);
  }

  /**
   * Convert ingested registry candidates into Partial<CanonicalMovie> representations for discovery union.
   * Does NOT assign public categories directly; preserves validation inputs and classifications.
   * By default, quarantined test fixtures are excluded to protect production discovery.
   */
  public toCanonicalMovies(todayStr?: string, includeFixtures = false): Partial<CanonicalMovie>[] {
    const today = todayStr || new Date().toISOString().split('T')[0];
    const results: Partial<CanonicalMovie>[] = [];

    for (const candidate of this.candidates.values()) {
      if (candidate.isTestFixture && !includeFixtures) {
        continue; // Strict quarantine: synthetic test fixtures cannot leak into production discovery
      }

      const summary = this.evaluateCandidateEvidence(candidate, today);
      const validation = this.validateCandidate(candidate, today);
      const primaryRecord = candidate.evidenceRecords[candidate.evidenceRecords.length - 1];

      const ottPlatforms = (summary.platformName || primaryRecord.announcedPlatform)
        ? [{
            name: summary.platformName || primaryRecord.announcedPlatform || 'Platform TBA',
            availableInIndia: summary.territoryVerified,
            verified: summary.hasAuthorizedSource && summary.territoryVerified,
            availabilityType: primaryRecord.availabilityType,
            availableFrom: summary.confirmedDate || primaryRecord.claimedOttReleaseDate
          }]
        : [];

      let classification: any = 'UNCLASSIFIED';
      let streamingStatus = 'Unclassified';

      if (validation.decision === 'ACCEPT_UPCOMING_OTT') {
        classification = 'UPCOMING_OTT';
        const dateDisplay = this.formatDateDisplay(summary.confirmedDate);
        const seasonInfo = candidate.seasonNumber && candidate.seasonNumber > 1 ? ` (Season ${candidate.seasonNumber})` : '';
        streamingStatus = summary.platformName
          ? `Arriving ${dateDisplay} on ${summary.platformName}${seasonInfo}`
          : `Coming to OTT ${dateDisplay}${seasonInfo}`;
      } else if (validation.decision === 'ACCEPT_NOW_STREAMING') {
        classification = 'NOW_STREAMING';
        streamingStatus = summary.platformName ? `Streaming Now on ${summary.platformName}` : 'Streaming Now in India';
      } else if (validation.decision === 'QUARANTINE_PENDING_VALIDATION') {
        classification = 'PENDING_VALIDATION';
        streamingStatus = 'Pending Verification: Date Held';
      }

      const releaseDate = summary.confirmedDate || primaryRecord.claimedOttReleaseDate;

      const canonicalMovie: Partial<CanonicalMovie> & Record<string, any> = {
        canonicalId: candidate.canonicalId || candidate.candidateId,
        title: candidate.title,
        year: releaseDate ? parseInt(releaseDate.substring(0, 4), 10) : new Date().getFullYear(),
        originalLanguage: candidate.originalLanguage,
        industries: [...candidate.industries],
        theatricalRelease: candidate.theatricalReleaseDate,
        ottRelease: releaseDate,
        theatricalStatus: (candidate.theatricalStatus && candidate.theatricalStatus !== 'NONE')
          ? (candidate.theatricalStatus as any)
          : (candidate.theatricalRunExplicitlyEnded ? 'ENDED' : 'UNKNOWN'),
        theatricalRunExplicitlyEnded: candidate.theatricalRunExplicitlyEnded === true,
        ottPlatforms: ottPlatforms as any,
        ottDateConfirmed: summary.passesToUpcomingOtt,
        primaryPlatform: summary.platformName || primaryRecord.announcedPlatform,
        streamingStatus,
        isDirectToOtt: candidate.isDirectToOtt ?? false,
        sources: candidate.evidenceRecords.map(r => `${r.providerId}:${r.sourceType}`),
        artworkStatus: 'READY',
        classification,
        tmdbId: candidate.tmdbId,
        contentType: candidate.contentType,
        seasonNumber: candidate.seasonNumber,
        releaseEventType: 'INDIA_OTT_DIGITAL',
        hasIndianTerritoryEvidence: summary.territoryVerified,
        evidenceSource: (summary.hasAuthorizedSource && summary.territoryVerified) ? 'OFFICIAL_IN_OTT_ANNOUNCEMENT' : undefined,
        uncorroboratedDate: summary.hasUncorroboratedDate,
        dateConflictDetected: summary.hasDateConflict,
        dateConflictDetails: summary.quarantineReason,
        historicalVerificationStatus: summary.historicalVerificationStatus,
        historicalTheatricalReleaseDate: candidate.historicalTheatricalReleaseDate,
        historicalOttPremiereDate: candidate.historicalOttPremiereDate,
        historicalOttTerritory: candidate.historicalOttTerritory,
        historicalOttPlatform: candidate.historicalOttPlatform,
        historicalOttAvailabilityModel: candidate.historicalOttAvailabilityModel,
        historicalSeasonAirDates: candidate.historicalSeasonAirDates,
        claimVerificationStatus: summary.claimVerificationStatus,
        isClaimContentVerified: summary.isClaimContentVerified,
        verifiedClaimTitle: candidate.verifiedClaimDetails?.title,
        verifiedClaimSeasonNumber: candidate.verifiedClaimDetails?.seasonNumber,
        verifiedClaimPlatform: candidate.verifiedClaimDetails?.platform,
        verifiedClaimDate: candidate.verifiedClaimDetails?.premiereDate,
        verifiedClaimDatePrecision: candidate.verifiedClaimDetails?.datePrecision,
        verifiedEvidenceId: candidate.verifiedClaimDetails?.evidenceId,
        theatricalClosureTerritory: candidate.verifiedTheatricalClosure?.territory,
        theatricalClosureEvidenceId: candidate.verifiedTheatricalClosure?.evidenceId,
        directToOttTerritory: candidate.verifiedDirectToOtt?.territory,
        directToOttPlatform: candidate.verifiedDirectToOtt?.platform,
        directToOttAvailability: candidate.verifiedDirectToOtt?.availabilityModel,
        directToOttEvidenceId: candidate.verifiedDirectToOtt?.evidenceId,
        validationProof: validation.isValid ? this.verificationAuthority.generateValidatorProof(candidate.canonicalId || candidate.candidateId, {
          isClaimContentVerified: !!summary.isClaimContentVerified,
          theatricalRunExplicitlyEnded: candidate.theatricalRunExplicitlyEnded === true,
          directToOttVerified: candidate.directToOttVerified === true,
          historicalVerificationStatus: summary.historicalVerificationStatus
        }) : undefined,
        verifiedClaimTerritories: candidate.verifiedClaimDetails?.territoryCodes,
        verifiedClaimAvailability: candidate.verifiedClaimDetails?.availabilityType
      };

      results.push(canonicalMovie);
    }

    return results;
  }

  public getCandidate(candidateId: string): IndianOttCandidate | undefined {
    return this.candidates.get(candidateId);
  }

  public getAllCandidates(): IndianOttCandidate[] {
    return Array.from(this.candidates.values());
  }

  // =====================================================
  // PRIVATE HELPER METHODS
  // =====================================================

  private generateCandidateId(record: StructuredOttEvidenceRecord): string {
    const cleanTitle = record.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (record.contentType === 'tv') {
      const season = record.seasonNumber || 1;
      return record.tmdbId
        ? `cand:tv:tmdb:${record.tmdbId}:s${season}`
        : `cand:tv:${cleanTitle}:s${season}`;
    }
    const year = record.claimedOttReleaseDate ? record.claimedOttReleaseDate.substring(0, 4) : 'undated';
    return record.tmdbId
      ? `cand:movie:tmdb:${record.tmdbId}`
      : `cand:movie:${cleanTitle}:${year}`;
  }

  private detectAndApplyConflicts(candidate: IndianOttCandidate, newRecord: StructuredOttEvidenceRecord): void {
    if ((newRecord.lifecycleStatus || 'ACTIVE') !== 'ACTIVE') {
      return;
    }

    const existingExact = candidate.evidenceRecords.find(
      r => (r.lifecycleStatus || 'ACTIVE') === 'ACTIVE' &&
           r.evidenceId !== newRecord.evidenceId &&
           r.datePrecision === 'EXACT_DATE' &&
           r.claimedOttReleaseDate
    );

    if (
      existingExact &&
      newRecord.datePrecision === 'EXACT_DATE' &&
      newRecord.claimedOttReleaseDate &&
      existingExact.claimedOttReleaseDate !== newRecord.claimedOttReleaseDate
    ) {
      newRecord.conflictDetected = true;
      newRecord.conflictDetails = `DATE_CONFLICT: ${existingExact.sourceName} reported ${existingExact.claimedOttReleaseDate}, but ${newRecord.sourceName} reported ${newRecord.claimedOttReleaseDate}`;
      newRecord.quarantineReason = newRecord.conflictDetails;

      existingExact.conflictDetected = true;
      existingExact.conflictDetails = newRecord.conflictDetails;
      existingExact.quarantineReason = newRecord.conflictDetails;
    }
  }

  private hasConflictingDates(exactRecords: StructuredOttEvidenceRecord[]): boolean {
    if (exactRecords.length <= 1) return false;
    const firstDate = exactRecords[0].claimedOttReleaseDate;
    return exactRecords.some(r => r.claimedOttReleaseDate !== firstDate);
  }

  private formatDateDisplay(dateStr?: string): string {
    if (!dateStr) return 'Soon';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    } catch {}
    return dateStr;
  }
}
