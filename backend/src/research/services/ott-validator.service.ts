import { Injectable, Logger, Optional } from '@nestjs/common';
import { MovieCategory, TheatricalStatus, OttPlatformInfo } from './movie-classification.service';
import {
  HistoricalVerificationStatus,
  ClaimVerificationStatus,
  OttAvailabilityModel,
  OttDatePrecision,
  ValidatorProof
} from '../evidence/indian-ott-evidence.interface';
import { EvidenceVerificationAuthorityService } from './evidence-verification-authority.service';

export interface OttCandidateValidationInput {
  canonicalId: string;
  tmdbId?: string | number;
  title: string;
  contentType: 'movie' | 'tv';
  seasonNumber?: number;
  originalLanguage?: string;
  industries?: string[];
  sources?: string[];

  // Release event type and dates
  releaseEventType?: 'INDIA_OTT_DIGITAL' | 'LINEAR_TV_BROADCAST' | 'THEATRICAL' | 'UNKNOWN';
  theatricalReleaseDate?: string;
  theatricalStatus?: TheatricalStatus;
  theatricalRunExplicitlyEnded?: boolean;
  claimedOttReleaseDate?: string; // YYYY-MM-DD
  ottDateConfirmed?: boolean;
  isDirectToOtt?: boolean;
  directToOttVerified?: boolean;

  // Platform and territory evidence
  ottPlatforms?: OttPlatformInfo[];
  primaryPlatform?: string;
  hasIndianTerritoryEvidence?: boolean;
  evidenceSource?: string;

  // Linear broadcast / network metadata
  originalNetworks?: string[];
  broadcastAirDate?: string;

  // Conflict and corroboration signals
  dateConflictDetected?: boolean;
  dateConflictDetails?: string;
  uncorroboratedDate?: boolean;

  // Phase 2.7.3.2 & 2.7.3.4 Remediation: Independent Historical Premiere Gatekeeper Signals
  historicalVerificationStatus?: HistoricalVerificationStatus;
  historicalTheatricalReleaseDate?: string;
  historicalOttPremiereDate?: string;
  historicalOttTerritory?: string;
  historicalOttPlatform?: string;
  historicalOttAvailabilityModel?: 'SUBSCRIPTION' | 'RENTAL' | 'PURCHASE' | 'FREE' | 'ADS' | 'UNKNOWN';
  historicalSeasonAirDates?: Record<number, string>;

  // Phase 2.7.3.6 & 2.7.3.8 Remediation: Claim Content Verification Signals
  claimVerificationStatus?: ClaimVerificationStatus;
  isClaimContentVerified?: boolean;
  verifiedClaimTitle?: string;
  verifiedClaimSeasonNumber?: number;
  verifiedClaimPlatform?: string;
  verifiedClaimTerritories?: string[];
  verifiedClaimAvailability?: OttAvailabilityModel;
  verifiedClaimDate?: string;
  verifiedClaimDatePrecision?: OttDatePrecision;
  verifiedEvidenceId?: string;
  theatricalClosureEvidenceId?: string;
  theatricalClosureTerritory?: string;

  // Phase 2.7.3.10 Remediation: Direct-to-OTT Binding and Validation Proof
  directToOttTerritory?: string;
  directToOttPlatform?: string;
  directToOttAvailability?: OttAvailabilityModel;
  directToOttEvidenceId?: string;
  validationProof?: ValidatorProof;
}

export type OttValidationDecision =
  | 'ACCEPT_UPCOMING_OTT'
  | 'ACCEPT_NOW_STREAMING'
  | 'QUARANTINE_PENDING_VALIDATION'
  | 'REJECT_UNCLASSIFIED';

export interface OttValidationResult {
  isValid: boolean;
  decision: OttValidationDecision;
  assignedCategory: MovieCategory;
  rejectionReason?: string;
  quarantineReason?: string;
  evidenceDetails: {
    canonicalId: string;
    contentType: 'movie' | 'tv';
    seasonNumber?: number;
    eventType: string;
    date: string | null;
    territoryVerified: boolean;
    platformVerified: boolean;
    assignedPlatform?: string;
    stagesPassed: string[];
    failedStage?: string;
  };
}

@Injectable()
export class OttValidatorService {
  private readonly logger = new Logger(OttValidatorService.name);

  constructor(
    @Optional() private verificationAuthority?: EvidenceVerificationAuthorityService
  ) { }

  public setVerificationAuthority(authority: EvidenceVerificationAuthorityService): void {
    this.verificationAuthority = authority;
  }

  public hasVerificationAuthority(): boolean {
    return !!this.verificationAuthority;
  }

  // Recognized Indian OTT Streaming Platforms
  private static readonly RECOGNIZED_INDIAN_STREAMING_PLATFORMS = new Set([
    'netflix',
    'prime video',
    'amazon prime video',
    'amazon prime',
    'disney+ hotstar',
    'disney plus hotstar',
    'hotstar',
    'jiocinema',
    'jio cinema',
    'sonyliv',
    'sony liv',
    'zee5',
    'aha',
    'sun nxt',
    'sunnxt',
    'manoramamax',
    'manorama max',
    'hoichoi',
    'apple tv+',
    'apple tv',
    'lionsgate play',
    'chaupal',
    'stage'
  ]);

  // Foreign Linear Broadcast Networks (Not Indian OTT Platforms)
  private static readonly FOREIGN_LINEAR_BROADCAST_NETWORKS = new Set([
    'bbc',
    'bbc one',
    'bbc two',
    'bbc three',
    'bbc four',
    'cbbc',
    'tvn',
    'jtbc',
    'ocn',
    'ena',
    'tv chosun',
    'channel a',
    'kbs',
    'kbs1',
    'kbs2',
    'sbs',
    'mbc',
    'tokyo mx',
    'tv tokyo',
    'fuji tv',
    'nippon tv',
    'tv asahi',
    'tbs',
    'mbs',
    'wowow',
    'cbc',
    'ctv',
    'global',
    'adult swim',
    'cartoon network',
    'nickelodeon',
    'cbs',
    'nbc',
    'abc',
    'fox',
    'the cw',
    'pbs',
    'amc',
    'fx',
    'usa network',
    'tnt',
    'bravo',
    'lifetime',
    'hallmark',
    'itv',
    'channel 4',
    'channel 5',
    'sky one',
    'sky atlantic',
    'tf1',
    'france 2',
    'canal+',
    'zdf',
    'ard'
  ]);

  // Overseas-Only Platforms (Not available as standalone subscription in India)
  private static readonly OVERSEAS_ONLY_PLATFORMS = new Set([
    'hulu',
    'peacock',
    'bbc iplayer',
    'itvx',
    'all 4',
    'stan',
    'crave',
    'tving',
    'wavve',
    'u-next',
    'abema'
  ]);

  // Structured Verifiable Evidence Sources for India Digital/OTT Release Events
  public static readonly VERIFIABLE_INDIA_DIGITAL_SOURCES = new Set([
    'TMDB_IN_DIGITAL_RELEASE',
    'OFFICIAL_IN_OTT_ANNOUNCEMENT',
    'PARTNER_CONFIRMED_IN_DIGITAL'
  ]);

  /**
   * Helper to verify if structured evidence supports an Indian digital/OTT release event
   */
  public hasStructuredIndiaDigitalEvidence(input: OttCandidateValidationInput): boolean {
    if (!input.evidenceSource) return false;
    if (!input.hasIndianTerritoryEvidence) return false;
    if (input.releaseEventType && input.releaseEventType !== 'INDIA_OTT_DIGITAL') return false;
    return OttValidatorService.VERIFIABLE_INDIA_DIGITAL_SOURCES.has(input.evidenceSource);
  }

  /**
   * Helper to validate strict calendar format YYYY-MM-DD
   */
  public isValidDateStr(dateStr?: string | null): boolean {
    if (!dateStr || typeof dateStr !== 'string') return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && dateStr.startsWith(d.toISOString().substring(0, 10));
  }

  /**
   * Helper to compute day difference: (targetDate - baseDate) in days
   */
  public daysDifference(targetDate: string, baseDate: string): number {
    const t = new Date(targetDate).getTime();
    const b = new Date(baseDate).getTime();
    return Math.round((t - b) / (1000 * 60 * 60 * 24));
  }

  /**
   * Core 9-Stage Shared OTT Validation Gatekeeper
   */
  public validateOttCandidate(
    input: OttCandidateValidationInput,
    todayStr?: string
  ): OttValidationResult {
    const today = todayStr || new Date().toISOString().split('T')[0];
    const stagesPassed: string[] = [];

    // ──────────────────────────────────────────────────────────────────────────
    // STAGE 1: Candidate Identity & Content Type Resolved
    // ──────────────────────────────────────────────────────────────────────────
    const title = (input.title || '').trim();
    if (!title || title.length < 2) {
      return this.failResult('STAGE_1_IDENTITY', 'REJECT_UNCLASSIFIED', 'INVALID_TITLE_OR_SYNTHETIC_ENTITY', input, today, stagesPassed);
    }
    const contentType = input.contentType === 'tv' ? 'tv' : 'movie';
    const canonicalId = input.canonicalId || (contentType === 'tv' ? `tv:${input.tmdbId}` : `movie:${input.tmdbId}`);
    stagesPassed.push('STAGE_1_IDENTITY');

    // ──────────────────────────────────────────────────────────────────────────
    // STAGE 2: Content Type & Season Identity Verified (Workstream 6 / F-13)
    // ──────────────────────────────────────────────────────────────────────────
    if (contentType === 'tv') {
      if (
        input.seasonNumber === undefined ||
        input.seasonNumber === null ||
        typeof input.seasonNumber !== 'number' ||
        !Number.isInteger(input.seasonNumber) ||
        input.seasonNumber < 1
      ) {
        return this.failResult(
          'STAGE_2_CONTENT_TYPE',
          'REJECT_UNCLASSIFIED',
          'MISSING_TV_SEASON_IDENTITY',
          input,
          today,
          stagesPassed
        );
      }
    }
    const seasonNumber = contentType === 'tv' ? input.seasonNumber : undefined;
    stagesPassed.push('STAGE_2_CONTENT_TYPE');

    // ──────────────────────────────────────────────────────────────────────────
    // STAGE 3: Release Event Type Identified (OTT vs Linear TV vs Theatrical)
    // ──────────────────────────────────────────────────────────────────────────
    const networks = (input.originalNetworks || []).map(n => n.toLowerCase().trim());
    const isForeignLinearBroadcast = networks.some(n => OttValidatorService.FOREIGN_LINEAR_BROADCAST_NETWORKS.has(n));
    const hasRecognizedIndianPlatform = (input.ottPlatforms || []).some(p => {
      const pName = p.name.toLowerCase().trim();
      return OttValidatorService.RECOGNIZED_INDIAN_STREAMING_PLATFORMS.has(pName) && p.availableInIndia && p.verified;
    });

    // Check if event is marked explicitly or inferred as linear broadcast only
    if (input.releaseEventType === 'LINEAR_TV_BROADCAST' || (isForeignLinearBroadcast && !hasRecognizedIndianPlatform && !input.hasIndianTerritoryEvidence)) {
      return this.failResult(
        'STAGE_3_RELEASE_EVENT',
        'REJECT_UNCLASSIFIED',
        'FOREIGN_LINEAR_TV_BROADCAST_NOT_OTT',
        input,
        today,
        stagesPassed
      );
    }

    if (input.releaseEventType === 'THEATRICAL' && !input.isDirectToOtt && !input.claimedOttReleaseDate) {
      return this.failResult(
        'STAGE_3_RELEASE_EVENT',
        'REJECT_UNCLASSIFIED',
        'THEATRICAL_EVENT_NOT_OTT',
        input,
        today,
        stagesPassed
      );
    }
    stagesPassed.push('STAGE_3_RELEASE_EVENT');

    // ──────────────────────────────────────────────────────────────────────────
    // STAGE 4: Date Format & Temporal Eligibility Evaluated
    // ──────────────────────────────────────────────────────────────────────────
    const claimedDate = input.claimedOttReleaseDate;
    const hasValidDate = this.isValidDateStr(claimedDate);

    // Active Indian Subscription OTT Streaming Check (for NOW_STREAMING)
    const activeIndianSubscriptionOtt = (input.ottPlatforms || []).some((p) => {
      if (!p.availableInIndia || !p.verified) return false;
      if (p.availabilityType && p.availabilityType !== 'SUBSCRIPTION') return false;

      // Check window
      if (p.availableFrom && this.isValidDateStr(p.availableFrom) && p.availableFrom > today) {
        return false; // Not yet available
      }
      if (!p.availableFrom && hasValidDate && claimedDate! > today) {
        return false; // Future claimed OTT date
      }
      if (p.availableUntil && this.isValidDateStr(p.availableUntil) && p.availableUntil < today) {
        return false; // Expired
      }

      const pName = p.name.toLowerCase().trim();
      return OttValidatorService.RECOGNIZED_INDIAN_STREAMING_PLATFORMS.has(pName);
    });

    // Temporal Eligibility Checks:
    // A future release date can NEVER be classified as NOW_STREAMING
    if (hasValidDate && claimedDate! > today) {
      const daysUntil = this.daysDifference(claimedDate!, today);
      if (daysUntil > 365) {
        return this.failResult(
          'STAGE_4_DATE_EVALUATION',
          'QUARANTINE_PENDING_VALIDATION',
          'SPECULATIVE_FAR_FUTURE_DATE',
          input,
          today,
          stagesPassed
        );
      }
    } else if (hasValidDate && claimedDate! <= today && !activeIndianSubscriptionOtt) {
      // Historical release date without active verified streaming cannot be Now Streaming
      return this.failResult(
        'STAGE_4_DATE_EVALUATION',
        'REJECT_UNCLASSIFIED',
        'HISTORICAL_DATE_WITHOUT_ACTIVE_STREAMING',
        input,
        today,
        stagesPassed
      );
    }
    stagesPassed.push('STAGE_4_DATE_EVALUATION');

    // ──────────────────────────────────────────────────────────────────────────
    // STAGE 4B: Historical Premiere Gate (Strict Fail-Closed State Machine)
    // Verifies whether a claimed upcoming premiere represents a genuinely future event
    // independent of the candidate's own announcement claim.
    // ──────────────────────────────────────────────────────────────────────────
    if (hasValidDate && claimedDate! > today) {
      // 1. Candidate's own claimed date CANNOT be used as its own independent historical verification.
      const rawHistStatus = input.historicalVerificationStatus;
      const isExplicitlyVerifiedNoPrior = rawHistStatus === 'VERIFIED_NO_PRIOR_PREMIERE';
      const isExplicitlyConfirmedPrior = rawHistStatus === 'CONFIRMED_PRIOR_PREMIERE';

      // Explicit CONFIRMED_PRIOR_PREMIERE check
      if (isExplicitlyConfirmedPrior) {
        const rejectionReason = contentType === 'tv'
          ? 'ALREADY_RELEASED_HISTORICAL_SEASON'
          : 'ALREADY_RELEASED_HISTORICAL_OTT';
        return this.failResult(
          'STAGE_4B_HISTORICAL_PREMIERE_GATE',
          'REJECT_UNCLASSIFIED',
          rejectionReason,
          input,
          today,
          stagesPassed
        );
      }

      // 2. Movie Evaluation:
      if (contentType === 'movie') {
        const histOttDate = input.historicalOttPremiereDate;
        if (histOttDate && this.isValidDateStr(histOttDate)) {
          if (histOttDate <= today) {
            const histTerritory = (input.historicalOttTerritory || 'IN').toUpperCase();
            const coversIndia = histTerritory.includes('IN');
            const isSubscription = !input.historicalOttAvailabilityModel || input.historicalOttAvailabilityModel === 'SUBSCRIPTION';

            if (coversIndia && isSubscription) {
              // The movie already had its Indian subscription OTT premiere in the past!
              return this.failResult(
                'STAGE_4B_HISTORICAL_PREMIERE_GATE',
                'REJECT_UNCLASSIFIED',
                'ALREADY_RELEASED_HISTORICAL_OTT',
                input,
                today,
                stagesPassed
              );
            }
            // Note: If historical premiere was overseas-only, it does not disqualify the first Indian OTT premiere.
          } else if (histOttDate > today) {
            // Independent historical record gives a future date that conflicts with claimed date
            if (histOttDate !== claimedDate) {
              return this.failResult(
                'STAGE_4B_HISTORICAL_PREMIERE_GATE',
                'QUARANTINE_PENDING_VALIDATION',
                'HISTORICAL_PREMIERE_DATE_CONFLICT_HELD',
                input,
                today,
                stagesPassed
              );
            }
          }
        }
      }

      // 3. TV Series Evaluation (Season-Aware):
      if (contentType === 'tv') {
        const targetSeason = input.seasonNumber || 1;
        const seasonAirDates = input.historicalSeasonAirDates;

        if (seasonAirDates) {
          const histSeasonDate = seasonAirDates[targetSeason];
          if (histSeasonDate && this.isValidDateStr(histSeasonDate) && histSeasonDate <= today) {
            return this.failResult(
              'STAGE_4B_HISTORICAL_PREMIERE_GATE',
              'REJECT_UNCLASSIFIED',
              'ALREADY_RELEASED_HISTORICAL_SEASON',
              input,
              today,
              stagesPassed
            );
          }
        } else if (input.historicalOttPremiereDate && this.isValidDateStr(input.historicalOttPremiereDate) && input.historicalOttPremiereDate <= today) {
          if (targetSeason === 1) {
            return this.failResult(
              'STAGE_4B_HISTORICAL_PREMIERE_GATE',
              'REJECT_UNCLASSIFIED',
              'ALREADY_RELEASED_HISTORICAL_SEASON',
              input,
              today,
              stagesPassed
            );
          }
        }
      }

      // 4. Strict Fail-Closed Historical Gate:
      // ONLY 'VERIFIED_NO_PRIOR_PREMIERE' may pass!
      // All other values (HISTORICAL_STATUS_UNKNOWN, undefined, null, '', UNKNOWN, UNVERIFIED, invalid enum strings) MUST quarantine!
      if (!isExplicitlyVerifiedNoPrior) {
        // Guard against masking explicit rejections and higher-priority conflicts:
        // 1. Higher-priority theatrical exhibition rejection
        const isVerifiedDirectToOtt =
          input.isDirectToOtt === true &&
          input.directToOttVerified === true &&
          Boolean(input.directToOttTerritory && input.directToOttTerritory.toUpperCase().includes('IN')) &&
          input.directToOttAvailability === 'SUBSCRIPTION' &&
          Boolean(input.directToOttEvidenceId && input.directToOttEvidenceId.trim().length > 0);
        const isCurrentlyRunningTheatrical = input.theatricalStatus === 'CURRENTLY_RUNNING' && !isVerifiedDirectToOtt;
        // 2. Higher-priority overseas-only rejection
        const isOverseasOnlyPlatform = (input.ottPlatforms || []).some(p => OttValidatorService.OVERSEAS_ONLY_PLATFORMS.has(p.name.toLowerCase().trim())) && !hasRecognizedIndianPlatform && !input.hasIndianTerritoryEvidence;
        // 3. Higher-priority empty platforms without Indian territory evidence
        const isEmptyPlatformNoTerritory = (!input.ottPlatforms || input.ottPlatforms.length === 0) && !hasRecognizedIndianPlatform && !this.hasStructuredIndiaDigitalEvidence(input);
        // 4. Higher-priority territory not verified rejection
        const isTerritoryNotVerified = !input.hasIndianTerritoryEvidence && !hasRecognizedIndianPlatform;
        // 5. Higher-priority non-subscription only rejection
        const nonSubOffers = (input.ottPlatforms || []).filter(p => p.availabilityType && p.availabilityType !== 'SUBSCRIPTION');
        const subOffers = (input.ottPlatforms || []).filter(p => !p.availabilityType || p.availabilityType === 'SUBSCRIPTION');
        const isNonSubscriptionOnly = subOffers.length === 0 && nonSubOffers.length > 0;
        // 6. Higher-priority date conflict
        const isExplicitDateConflict = !!input.dateConflictDetected;
        // 7. Higher-priority uncorroborated date
        const isExplicitUncorroborated = !!input.uncorroboratedDate;

        if (
          !isCurrentlyRunningTheatrical &&
          !isOverseasOnlyPlatform &&
          !isEmptyPlatformNoTerritory &&
          !isTerritoryNotVerified &&
          !isNonSubscriptionOnly &&
          !isExplicitDateConflict &&
          !isExplicitUncorroborated
        ) {
          return this.failResult(
            'STAGE_4B_HISTORICAL_PREMIERE_GATE',
            'QUARANTINE_PENDING_VALIDATION',
            'HISTORICAL_STATUS_UNVERIFIED_HELD',
            input,
            today,
            stagesPassed
          );
        }
      }
    }
    stagesPassed.push('STAGE_4B_HISTORICAL_PREMIERE_GATE');

    // ──────────────────────────────────────────────────────────────────────────
    // STAGE 5: India Territory Verified
    // ──────────────────────────────────────────────────────────────────────────
    const hasOverseasOnlyPlatform = (input.ottPlatforms || []).some(p => {
      const pName = p.name.toLowerCase().trim();
      return OttValidatorService.OVERSEAS_ONLY_PLATFORMS.has(pName);
    });

    if (hasOverseasOnlyPlatform && !hasRecognizedIndianPlatform && !input.hasIndianTerritoryEvidence) {
      return this.failResult(
        'STAGE_5_TERRITORY',
        'REJECT_UNCLASSIFIED',
        'OVERSEAS_ONLY_PLATFORM_NOT_AVAILABLE_IN_INDIA',
        input,
        today,
        stagesPassed
      );
    }

    const hasStructuredEvidence = this.hasStructuredIndiaDigitalEvidence(input);

    const territoryVerified = !!(
      hasRecognizedIndianPlatform ||
      hasStructuredEvidence
    );

    // Rule: Empty platform metadata without explicit structured Indian digital evidence cannot pass
    if (!territoryVerified && (!input.ottPlatforms || input.ottPlatforms.length === 0)) {
      return this.failResult(
        'STAGE_5_TERRITORY',
        'REJECT_UNCLASSIFIED',
        'EMPTY_PLATFORMS_WITHOUT_INDIAN_TERRITORY_EVIDENCE',
        input,
        today,
        stagesPassed
      );
    }

    if (!input.hasIndianTerritoryEvidence && !hasRecognizedIndianPlatform) {
      return this.failResult(
        'STAGE_5_TERRITORY',
        'REJECT_UNCLASSIFIED',
        'INDIAN_TERRITORY_NOT_VERIFIED',
        input,
        today,
        stagesPassed
      );
    }
    stagesPassed.push('STAGE_5_TERRITORY');

    // ──────────────────────────────────────────────────────────────────────────
    // STAGE 6: Platform Evidence & TBA Rule Evaluated
    // ──────────────────────────────────────────────────────────────────────────
    let assignedPlatform: string | undefined = undefined;
    let platformVerified = false;

    // Non-subscription availability guard:
    // Rental/purchase only, free/ads only, or unknown availability model
    const nonSubscriptionOffers = (input.ottPlatforms || []).filter(
      p => p.availabilityType && p.availabilityType !== 'SUBSCRIPTION'
    );
    const subscriptionOffers = (input.ottPlatforms || []).filter(
      p => !p.availabilityType || p.availabilityType === 'SUBSCRIPTION'
    );

    if (subscriptionOffers.length === 0 && nonSubscriptionOffers.length > 0) {
      const isRentalOrPurchase = nonSubscriptionOffers.every(
        p => p.availabilityType === 'RENTAL' || p.availabilityType === 'PURCHASE'
      );
      if (isRentalOrPurchase) {
        return this.failResult(
          'STAGE_6_PLATFORM',
          'REJECT_UNCLASSIFIED',
          'RENTAL_OR_PURCHASE_ONLY_NOT_SUBSCRIPTION_OTT',
          input,
          today,
          stagesPassed
        );
      }

      const isFreeOrAds = nonSubscriptionOffers.every(
        p => (p.availabilityType as any) === 'FREE' || (p.availabilityType as any) === 'ADS'
      );
      if (isFreeOrAds) {
        return this.failResult(
          'STAGE_6_PLATFORM',
          'REJECT_UNCLASSIFIED',
          'AD_SUPPORTED_OR_FREE_NOT_SUBSCRIPTION_OTT',
          input,
          today,
          stagesPassed
        );
      }

      const isUnknown = nonSubscriptionOffers.some(p => (p.availabilityType as any) === 'UNKNOWN');
      if (isUnknown) {
        return this.failResult(
          'STAGE_6_PLATFORM',
          'QUARANTINE_PENDING_VALIDATION',
          'UNKNOWN_AVAILABILITY_MODEL_QUARANTINED',
          input,
          today,
          stagesPassed
        );
      }
    }

    if (hasRecognizedIndianPlatform) {
      const matchedP = subscriptionOffers.find(p => {
        const pName = p.name.toLowerCase().trim();
        return OttValidatorService.RECOGNIZED_INDIAN_STREAMING_PLATFORMS.has(pName) && p.availableInIndia && p.verified;
      });
      if (matchedP) {
        assignedPlatform = matchedP.name;
        platformVerified = true;
      }
    }

    // Platform TBA Eligibility:
    // Permitted ONLY if supported by structured, verifiable Indian digital release evidence.
    // Generic boolean flags (e.g. ottDateConfirmed or hasIndianTerritoryEvidence) are NOT sufficient.
    if (!platformVerified) {
      if (hasStructuredEvidence && hasValidDate && claimedDate! > today && input.ottDateConfirmed && !input.uncorroboratedDate && !input.dateConflictDetected) {
        // Platform TBA Eligibility: Permitted ONLY when Indian subscription rights are established
        if (nonSubscriptionOffers.length > 0 && subscriptionOffers.length === 0) {
          return this.failResult(
            'STAGE_6_PLATFORM',
            'REJECT_UNCLASSIFIED',
            'PLATFORM_TBA_NOT_ELIGIBLE_FOR_NON_SUBSCRIPTION_RIGHTS',
            input,
            today,
            stagesPassed
          );
        }
        assignedPlatform = input.primaryPlatform || 'Platform TBA';
        platformVerified = true; // Accepted as confirmed future digital release with unannounced/TBA platform
      } else if (hasStructuredEvidence && (input.uncorroboratedDate || input.dateConflictDetected)) {
        // Has valid structured digital event in India, but date is uncorroborated or conflicting:
        // Allow progression to Stage 7 quarantine
        assignedPlatform = input.primaryPlatform || 'Platform TBA';
      } else {
        return this.failResult(
          'STAGE_6_PLATFORM',
          'REJECT_UNCLASSIFIED',
          'UNSUPPORTED_PLATFORM_AND_MISSING_DATE_EVIDENCE',
          input,
          today,
          stagesPassed
        );
      }
    }
    stagesPassed.push('STAGE_6_PLATFORM');

    // ──────────────────────────────────────────────────────────────────────────
    // STAGE 7: Conflicting Dates & Claims Checked
    // ──────────────────────────────────────────────────────────────────────────
    if (input.dateConflictDetected) {
      return this.failResult(
        'STAGE_7_CONFLICT_CHECK',
        'QUARANTINE_PENDING_VALIDATION',
        input.dateConflictDetails || 'MATERIAL_DATE_CONFLICT_DETECTED',
        input,
        today,
        stagesPassed
      );
    }

    if (input.uncorroboratedDate) {
      return this.failResult(
        'STAGE_7_CONFLICT_CHECK',
        'QUARANTINE_PENDING_VALIDATION',
        'UNCORROBORATED_STREAMING_DATE_HELD',
        input,
        today,
        stagesPassed
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Theatrical Precedence & Run Resolution Check (Phase 2.7.3.6 Hardening)
    // ──────────────────────────────────────────────────────────────────────────
    // 1. Film is currently running in Indian cinemas -> Theatrical exhibition takes absolute precedence
    // CURRENTLY_RUNNING must never qualify for Upcoming OTT.
    if (input.theatricalStatus === 'CURRENTLY_RUNNING') {
      return this.failResult(
        'STAGE_7_CONFLICT_CHECK',
        'REJECT_UNCLASSIFIED',
        'THEATRICAL_EXHIBITION_TAKES_PRECEDENCE',
        input,
        today,
        stagesPassed
      );
    }

    const isVerifiedDirectToOtt =
      input.isDirectToOtt === true &&
      input.directToOttVerified === true &&
      Boolean(input.directToOttTerritory && input.directToOttTerritory.toUpperCase().includes('IN')) &&
      input.directToOttAvailability === 'SUBSCRIPTION' &&
      Boolean(input.directToOttEvidenceId && input.directToOttEvidenceId.trim().length > 0);

    if (!isVerifiedDirectToOtt && contentType === 'movie') {
      // 2. UNKNOWN theatrical status is quarantined (precedence unestablished)
      if (!input.theatricalStatus || input.theatricalStatus === 'UNKNOWN') {
        return this.failResult(
          'STAGE_7_CONFLICT_CHECK',
          'QUARANTINE_PENDING_VALIDATION',
          'THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED',
          input,
          today,
          stagesPassed
        );
      }

      // 3. Past theatrical release date check:
      // A calendar-derived ENDED status must NEVER satisfy the exhibition-closure requirement.
      // Authoritative exhibition closure (theatricalRunExplicitlyEnded: true) is mandatory.
      const pastTheatricalDate = input.theatricalReleaseDate || input.historicalTheatricalReleaseDate;
      if (
        pastTheatricalDate &&
        this.isValidDateStr(pastTheatricalDate) &&
        pastTheatricalDate <= today
      ) {
        if (!input.theatricalRunExplicitlyEnded) {
          return this.failResult(
            'STAGE_7_CONFLICT_CHECK',
            'QUARANTINE_PENDING_VALIDATION',
            'THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED',
            input,
            today,
            stagesPassed
          );
        }

        // Mandatory Theatrical Closure Evidence ID check (Workstream 2)
        if (!input.theatricalClosureEvidenceId || !input.theatricalClosureEvidenceId.trim()) {
          return this.failResult(
            'STAGE_7_CONFLICT_CHECK',
            'QUARANTINE_PENDING_VALIDATION',
            'THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED',
            input,
            today,
            stagesPassed
          );
        }

        // Territory check for theatrical closure evidence (Phase 2.7.3.8)
        if (!input.theatricalClosureTerritory || !input.theatricalClosureTerritory.toUpperCase().includes('IN')) {
          return this.failResult(
            'STAGE_7_CONFLICT_CHECK',
            'QUARANTINE_PENDING_VALIDATION',
            'THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED',
            input,
            today,
            stagesPassed
          );
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Claim Content Verification Check for Upcoming OTT (Phase 2.7.3.6 Hardening)
    // ──────────────────────────────────────────────────────────────────────────
    if (hasValidDate && claimedDate! > today) {
      if (input.claimVerificationStatus === 'CLAIM_CONTENT_MISMATCH') {
        return this.failResult(
          'STAGE_7_CONFLICT_CHECK',
          'REJECT_UNCLASSIFIED',
          'CLAIM_CONTENT_MISMATCH_REJECTED',
          input,
          today,
          stagesPassed
        );
      }

      if (input.claimVerificationStatus === 'CLAIM_CONTENT_VERIFIED') {
        // Phase 2.7.3.10 & 2.7.3.12: Verification authority proof validation
        if (!this.verificationAuthority) {
          return this.failResult(
            'STAGE_7_CONFLICT_CHECK',
            'QUARANTINE_PENDING_VALIDATION',
            'UNAUTHORIZED_VALIDATOR_INVOCATION_PROOF_MISSING',
            input,
            today,
            stagesPassed
          );
        }

        const proofCheck = this.verificationAuthority.validateValidatorProof(canonicalId, input.validationProof, {
          isClaimContentVerified: input.isClaimContentVerified === true,
          theatricalRunExplicitlyEnded: input.theatricalRunExplicitlyEnded === true,
          directToOttVerified: input.directToOttVerified === true,
          historicalVerificationStatus: input.historicalVerificationStatus
        });
        if (!proofCheck.isValid) {
          return this.failResult(
            'STAGE_7_CONFLICT_CHECK',
            'QUARANTINE_PENDING_VALIDATION',
            'UNAUTHORIZED_VALIDATOR_INVOCATION_PROOF_MISSING',
            input,
            today,
            stagesPassed
          );
        }

        // Provider-supplied claimVerificationStatus cannot bypass trusted verification requirements (Test 16)
        if (input.isClaimContentVerified !== true) {
          return this.failResult(
            'STAGE_7_CONFLICT_CHECK',
            'QUARANTINE_PENDING_VALIDATION',
            'CLAIM_CONTENT_UNVERIFIED_HELD',
            input,
            today,
            stagesPassed
          );
        }

        // 1. Mandatory Verified Canonical Title Assertion (Phase 2.7.3.8)
        if (!input.verifiedClaimTitle || !input.verifiedClaimTitle.trim()) {
          return this.failResult(
            'STAGE_7_CONFLICT_CHECK',
            'QUARANTINE_PENDING_VALIDATION',
            'CLAIM_CONTENT_UNVERIFIED_HELD',
            input,
            today,
            stagesPassed
          );
        }
        const t1 = (input.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const t2 = input.verifiedClaimTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (t1 !== t2) {
          return this.failResult(
            'STAGE_7_CONFLICT_CHECK',
            'REJECT_UNCLASSIFIED',
            'CLAIM_TITLE_MISMATCH_REJECTED',
            input,
            today,
            stagesPassed
          );
        }

        // 2. Mandatory TV Season Identity Assertion (Phase 2.7.3.8)
        if (contentType === 'tv') {
          if (input.verifiedClaimSeasonNumber === undefined || input.verifiedClaimSeasonNumber === null) {
            return this.failResult(
              'STAGE_7_CONFLICT_CHECK',
              'QUARANTINE_PENDING_VALIDATION',
              'CLAIM_CONTENT_UNVERIFIED_HELD',
              input,
              today,
              stagesPassed
            );
          }
          const targetSeason = input.seasonNumber || 1;
          if (input.verifiedClaimSeasonNumber !== targetSeason) {
            return this.failResult(
              'STAGE_7_CONFLICT_CHECK',
              'REJECT_UNCLASSIFIED',
              'CLAIM_SEASON_MISMATCH_REJECTED',
              input,
              today,
              stagesPassed
            );
          }
        }

        // 3. Mandatory Indian Territory Assertion (Phase 2.7.3.8)
        if (
          !input.verifiedClaimTerritories ||
          !Array.isArray(input.verifiedClaimTerritories) ||
          input.verifiedClaimTerritories.length === 0
        ) {
          return this.failResult(
            'STAGE_7_CONFLICT_CHECK',
            'QUARANTINE_PENDING_VALIDATION',
            'CLAIM_CONTENT_UNVERIFIED_HELD',
            input,
            today,
            stagesPassed
          );
        }
        if (!input.verifiedClaimTerritories.includes('IN')) {
          return this.failResult(
            'STAGE_7_CONFLICT_CHECK',
            'REJECT_UNCLASSIFIED',
            'CLAIM_TERRITORY_NOT_SUPPORTED_REJECTED',
            input,
            today,
            stagesPassed
          );
        }

        // 4. Mandatory Subscription Availability Assertion (Phase 2.7.3.8)
        if (!input.verifiedClaimAvailability) {
          return this.failResult(
            'STAGE_7_CONFLICT_CHECK',
            'QUARANTINE_PENDING_VALIDATION',
            'CLAIM_CONTENT_UNVERIFIED_HELD',
            input,
            today,
            stagesPassed
          );
        }
        if (
          input.verifiedClaimAvailability === 'RENTAL' ||
          input.verifiedClaimAvailability === 'PURCHASE'
        ) {
          return this.failResult(
            'STAGE_7_CONFLICT_CHECK',
            'REJECT_UNCLASSIFIED',
            'RENTAL_OR_PURCHASE_ONLY_NOT_SUBSCRIPTION_OTT',
            input,
            today,
            stagesPassed
          );
        }
        if (input.verifiedClaimAvailability !== 'SUBSCRIPTION') {
          return this.failResult(
            'STAGE_7_CONFLICT_CHECK',
            'QUARANTINE_PENDING_VALIDATION',
            'UNKNOWN_AVAILABILITY_MODEL_QUARANTINED',
            input,
            today,
            stagesPassed
          );
        }

        // 5. Mandatory Date Precision Assertion (Phase 2.7.3.8)
        if (input.verifiedClaimDatePrecision && input.verifiedClaimDatePrecision !== 'EXACT_DATE') {
          return this.failResult(
            'STAGE_7_CONFLICT_CHECK',
            'QUARANTINE_PENDING_VALIDATION',
            'CLAIM_CONTENT_UNVERIFIED_HELD',
            input,
            today,
            stagesPassed
          );
        }
        if (
          input.verifiedClaimDate &&
          input.claimedOttReleaseDate &&
          input.verifiedClaimDate !== input.claimedOttReleaseDate
        ) {
          return this.failResult(
            'STAGE_7_CONFLICT_CHECK',
            'REJECT_UNCLASSIFIED',
            'CLAIM_DATE_MISMATCH_REJECTED',
            input,
            today,
            stagesPassed
          );
        }

        // 6. Mandatory Platform Identity Assertion (Phase 2.7.3.10 / F-06)
        if (assignedPlatform !== 'Platform TBA') {
          if (!input.verifiedClaimPlatform || !input.verifiedClaimPlatform.trim()) {
            return this.failResult(
              'STAGE_7_CONFLICT_CHECK',
              'QUARANTINE_PENDING_VALIDATION',
              'CLAIM_CONTENT_UNVERIFIED_HELD',
              input,
              today,
              stagesPassed
            );
          }
          const normClaimPlat = input.verifiedClaimPlatform.toLowerCase().trim();
          const normAssignedPlat = (assignedPlatform || '').toLowerCase().trim();
          if (
            normAssignedPlat &&
            normAssignedPlat !== 'platform tba' &&
            !normClaimPlat.includes(normAssignedPlat) &&
            !normAssignedPlat.includes(normClaimPlat)
          ) {
            return this.failResult(
              'STAGE_7_CONFLICT_CHECK',
              'REJECT_UNCLASSIFIED',
              'CLAIM_PLATFORM_MISMATCH_REJECTED',
              input,
              today,
              stagesPassed
            );
          }
        }

        // 7. Mandatory Verified Evidence ID Assertion (Phase 2.7.3.10 / F-06)
        if (!input.verifiedEvidenceId || !input.verifiedEvidenceId.trim()) {
          if (input.evidenceSource === 'TMDB_IN_DIGITAL_RELEASE') {
            input.verifiedEvidenceId = `tmdb:digital:${input.canonicalId}`;
          } else {
            return this.failResult(
              'STAGE_7_CONFLICT_CHECK',
              'QUARANTINE_PENDING_VALIDATION',
              'CLAIM_CONTENT_UNVERIFIED_HELD',
              input,
              today,
              stagesPassed
            );
          }
        }
      } else {
        // Missing, undefined, null, SOURCE_AUTHORIZED, SOURCE_VERIFICATION_UNKNOWN (Tests 14, 20)
        return this.failResult(
          'STAGE_7_CONFLICT_CHECK',
          'QUARANTINE_PENDING_VALIDATION',
          'CLAIM_CONTENT_UNVERIFIED_HELD',
          input,
          today,
          stagesPassed
        );
      }
    }
    stagesPassed.push('STAGE_7_CONFLICT_CHECK');

    // ──────────────────────────────────────────────────────────────────────────
    // STAGE 8 & 9: Final Decision & Category Assignment + Audit Record Retained
    // ──────────────────────────────────────────────────────────────────────────
    stagesPassed.push('STAGE_8_CATEGORY_ASSIGNED');
    stagesPassed.push('STAGE_9_AUDIT_RETAINED');

    // Check if it qualifies for NOW_STREAMING:
    // Must have active verified Indian subscription OTT streaming on today
    if (activeIndianSubscriptionOtt && (!claimedDate || claimedDate <= today)) {
      return {
        isValid: true,
        decision: 'ACCEPT_NOW_STREAMING',
        assignedCategory: 'NOW_STREAMING',
        evidenceDetails: {
          canonicalId,
          contentType,
          seasonNumber,
          eventType: 'INDIA_OTT_DIGITAL',
          date: claimedDate || today,
          territoryVerified: true,
          platformVerified: true,
          assignedPlatform,
          stagesPassed
        }
      };
    }

    // Check if it qualifies for UPCOMING_OTT:
    // Strictly future date, verified Indian territory, platform assigned or TBA
    if (hasValidDate && claimedDate! > today && (input.ottDateConfirmed || territoryVerified)) {
      return {
        isValid: true,
        decision: 'ACCEPT_UPCOMING_OTT',
        assignedCategory: 'UPCOMING_OTT',
        evidenceDetails: {
          canonicalId,
          contentType,
          seasonNumber,
          eventType: 'INDIA_OTT_DIGITAL',
          date: claimedDate!,
          territoryVerified: true,
          platformVerified: true,
          assignedPlatform,
          stagesPassed
        }
      };
    }

    // If neither condition is conclusively met, hold in quarantine rather than publishing
    return this.failResult(
      'STAGE_8_CATEGORY_ASSIGNED',
      'QUARANTINE_PENDING_VALIDATION',
      'INSUFFICIENT_EVIDENCE_FOR_PUBLIC_OTT_CATEGORY',
      input,
      today,
      stagesPassed
    );
  }

  private failResult(
    failedStage: string,
    decision: 'QUARANTINE_PENDING_VALIDATION' | 'REJECT_UNCLASSIFIED',
    reason: string,
    input: OttCandidateValidationInput,
    today: string,
    stagesPassed: string[]
  ): OttValidationResult {
    const isQuarantine = decision === 'QUARANTINE_PENDING_VALIDATION';
    const assignedCategory: MovieCategory = isQuarantine ? 'PENDING_VALIDATION' : 'UNCLASSIFIED';

    return {
      isValid: false,
      decision,
      assignedCategory,
      rejectionReason: !isQuarantine ? reason : undefined,
      quarantineReason: isQuarantine ? reason : undefined,
      evidenceDetails: {
        canonicalId: input.canonicalId || `id:${input.tmdbId}`,
        contentType: input.contentType,
        seasonNumber: input.seasonNumber,
        eventType: input.releaseEventType || 'UNKNOWN',
        date: input.claimedOttReleaseDate || null,
        territoryVerified: !!input.hasIndianTerritoryEvidence,
        platformVerified: false,
        assignedPlatform: input.primaryPlatform,
        stagesPassed,
        failedStage
      }
    };
  }
}
