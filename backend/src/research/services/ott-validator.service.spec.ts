import { OttValidatorService, OttCandidateValidationInput } from './ott-validator.service';
import { IndianOttRegistryService } from './indian-ott-registry.service';
import { MovieClassificationService, CanonicalMovieMetadata } from './movie-classification.service';
import { StructuredOttEvidenceRecord } from '../evidence/indian-ott-evidence.interface';
import { EvidenceVerificationAuthorityService } from './evidence-verification-authority.service';

describe('OttValidatorService', () => {
  let authority: EvidenceVerificationAuthorityService;
  let service: OttValidatorService;
  const todayStr = '2026-10-25';

  beforeEach(() => {
    authority = new EvidenceVerificationAuthorityService();
    service = new OttValidatorService(authority);
  });

  function attachProof(input: OttCandidateValidationInput): OttCandidateValidationInput {
    input.validationProof = authority.generateValidatorProof(input.canonicalId, {
      isClaimContentVerified: input.isClaimContentVerified === true,
      theatricalRunExplicitlyEnded: input.theatricalRunExplicitlyEnded === true,
      directToOttVerified: input.directToOttVerified === true,
      historicalVerificationStatus: input.historicalVerificationStatus
    });
    return input;
  }

  describe('Rule 1: Candidate Identity and Content Type', () => {
    it('should reject candidates with empty or synthetic titles', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:9999',
        title: ' ',
        contentType: 'movie',
        claimedOttReleaseDate: '2026-11-15'
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('INVALID_TITLE_OR_SYNTHETIC_ENTITY');
    });

    it('should preserve distinction between movie and TV series sharing the same numeric ID', () => {
      const movieInput: OttCandidateValidationInput = {
        canonicalId: 'tmdb:500',
        tmdbId: 500,
        title: 'Movie 500',
        contentType: 'movie',
        claimedOttReleaseDate: '2026-11-15',
        hasIndianTerritoryEvidence: true,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        verifiedClaimTitle: 'Movie 500',
        verifiedClaimTerritories: ['IN'],
        verifiedClaimAvailability: 'SUBSCRIPTION',
        verifiedClaimDatePrecision: 'EXACT_DATE',
        verifiedClaimDate: '2026-11-15',
        verifiedClaimPlatform: 'Netflix',
        verifiedEvidenceId: 'ev-movie-500',
        theatricalStatus: 'NONE',
        ottDateConfirmed: true,
        primaryPlatform: 'Netflix',
        ottPlatforms: [{ name: 'Netflix', availableInIndia: true, verified: true, availabilityType: 'SUBSCRIPTION' }]
      };

      const tvInput: OttCandidateValidationInput = {
        canonicalId: 'tmdb:tv:500',
        tmdbId: 500,
        title: 'TV Series 500',
        contentType: 'tv',
        seasonNumber: 2,
        claimedOttReleaseDate: '2026-11-15',
        hasIndianTerritoryEvidence: true,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        verifiedClaimTitle: 'TV Series 500',
        verifiedClaimSeasonNumber: 2,
        verifiedClaimTerritories: ['IN'],
        verifiedClaimAvailability: 'SUBSCRIPTION',
        verifiedClaimDatePrecision: 'EXACT_DATE',
        verifiedClaimDate: '2026-11-15',
        verifiedClaimPlatform: 'Netflix',
        verifiedEvidenceId: 'ev-tv-500',
        ottDateConfirmed: true,
        primaryPlatform: 'Netflix',
        ottPlatforms: [{ name: 'Netflix', availableInIndia: true, verified: true, availabilityType: 'SUBSCRIPTION' }]
      };

      const movieResult = service.validateOttCandidate(attachProof(movieInput), todayStr);
      const tvResult = service.validateOttCandidate(attachProof(tvInput), todayStr);

      expect(movieResult.isValid).toBe(true);
      expect(movieResult.evidenceDetails.canonicalId).toBe('tmdb:500');
      expect(movieResult.evidenceDetails.contentType).toBe('movie');
      expect(movieResult.evidenceDetails.seasonNumber).toBeUndefined();

      expect(tvResult.isValid).toBe(true);
      expect(tvResult.evidenceDetails.canonicalId).toBe('tmdb:tv:500');
      expect(tvResult.evidenceDetails.contentType).toBe('tv');
      expect(tvResult.evidenceDetails.seasonNumber).toBe(2);
    });
  });

  describe('Rule 2 & 3: Linear TV Broadcasts vs Genuine OTT Events', () => {
    it('should reject future BBC One broadcast date from Upcoming OTT', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:tv:336997',
        title: 'Trauma: My Broken Brain',
        contentType: 'tv',
        seasonNumber: 1,
        claimedOttReleaseDate: '2026-10-26',
        originalNetworks: ['BBC One'],
        releaseEventType: 'LINEAR_TV_BROADCAST',
        ottPlatforms: []
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('FOREIGN_LINEAR_TV_BROADCAST_NOT_OTT');
    });

    it('should reject future tvN broadcast date from Upcoming OTT', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:tv:335951',
        title: 'Summer Vacation',
        contentType: 'tv',
        seasonNumber: 1,
        claimedOttReleaseDate: '2026-10-26',
        originalNetworks: ['tvN'],
        releaseEventType: 'LINEAR_TV_BROADCAST',
        ottPlatforms: []
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('FOREIGN_LINEAR_TV_BROADCAST_NOT_OTT');
    });

    it('should reject future Tokyo MX broadcast date from Upcoming OTT', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:tv:334810',
        title: 'Blue Flower, Forest of Vessels',
        contentType: 'tv',
        seasonNumber: 1,
        claimedOttReleaseDate: '2026-10-26',
        originalNetworks: ['Tokyo MX'],
        releaseEventType: 'LINEAR_TV_BROADCAST',
        ottPlatforms: []
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('FOREIGN_LINEAR_TV_BROADCAST_NOT_OTT');
    });

    it('should reject future CBC and Adult Swim broadcast dates from Upcoming OTT', () => {
      const cbcInput: OttCandidateValidationInput = {
        canonicalId: 'tmdb:tv:339777',
        title: "Canada's Choice",
        contentType: 'tv',
        seasonNumber: 1,
        claimedOttReleaseDate: '2026-10-27',
        originalNetworks: ['CBC'],
        ottPlatforms: []
      };

      const adultSwimInput: OttCandidateValidationInput = {
        canonicalId: 'tmdb:tv:326007',
        title: 'Learning with Pibby: Armageddon',
        contentType: 'tv',
        seasonNumber: 1,
        claimedOttReleaseDate: '2026-10-30',
        originalNetworks: ['Adult Swim'],
        ottPlatforms: []
      };

      expect(service.validateOttCandidate(cbcInput, todayStr).isValid).toBe(false);
      expect(service.validateOttCandidate(cbcInput, todayStr).rejectionReason).toBe('FOREIGN_LINEAR_TV_BROADCAST_NOT_OTT');

      expect(service.validateOttCandidate(adultSwimInput, todayStr).isValid).toBe(false);
      expect(service.validateOttCandidate(adultSwimInput, todayStr).rejectionReason).toBe('FOREIGN_LINEAR_TV_BROADCAST_NOT_OTT');
    });
  });

  describe('Rule 4 & 5: Territory Verification & Overseas-Only Rejection', () => {
    it('should reject overseas-only streaming release (e.g. Hulu in US only) from Indian OTT', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:112233',
        title: 'US Exclusive Mini-Series',
        contentType: 'tv',
        seasonNumber: 1,
        claimedOttReleaseDate: '2026-11-10',
        ottPlatforms: [
          {
            name: 'Hulu',
            availableInIndia: false,
            verified: true,
            availabilityType: 'SUBSCRIPTION'
          }
        ]
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('OVERSEAS_ONLY_PLATFORM_NOT_AVAILABLE_IN_INDIA');
    });

    it('should NOT allow empty platform metadata to bypass territory validation', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:998877',
        title: 'Random Overseas Show',
        contentType: 'tv',
        seasonNumber: 1,
        claimedOttReleaseDate: '2026-11-20',
        hasIndianTerritoryEvidence: false,
        ottPlatforms: [] // Empty
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('EMPTY_PLATFORMS_WITHOUT_INDIAN_TERRITORY_EVIDENCE');
    });

    it('should accept confirmed future Indian digital release with unknown platform as Platform TBA', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:1500645',
        title: 'Possible Love',
        contentType: 'movie',
        claimedOttReleaseDate: '2026-11-06',
        ottDateConfirmed: true,
        hasIndianTerritoryEvidence: true, // e.g. TMDB release event type=4 for IN
        evidenceSource: 'TMDB_IN_DIGITAL_RELEASE',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        verifiedClaimTitle: 'Possible Love',
        verifiedClaimTerritories: ['IN'],
        verifiedClaimAvailability: 'SUBSCRIPTION',
        verifiedClaimDatePrecision: 'EXACT_DATE',
        verifiedClaimDate: '2026-11-06',
        theatricalStatus: 'NONE',
        ottPlatforms: [] // Platform unknown yet
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(true);
      expect(result.decision).toBe('ACCEPT_UPCOMING_OTT');
      expect(result.assignedCategory).toBe('UPCOMING_OTT');
      expect(result.evidenceDetails.assignedPlatform).toBe('Platform TBA');
      expect(result.evidenceDetails.territoryVerified).toBe(true);
      expect(result.evidenceDetails.platformVerified).toBe(true);
    });

    it('should REJECT Platform TBA if only generic boolean flags are provided without structured evidence', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:999999',
        title: 'Speculative Digital Release',
        contentType: 'movie',
        claimedOttReleaseDate: '2026-11-15',
        ottDateConfirmed: true, // generic flag
        hasIndianTerritoryEvidence: true, // generic flag without structured source
        evidenceSource: undefined, // missing structured evidence source
        ottPlatforms: []
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('EMPTY_PLATFORMS_WITHOUT_INDIAN_TERRITORY_EVIDENCE');
    });

    it('should REJECT Platform TBA if date is uncorroborated even with structured evidence source', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:888888',
        title: 'Uncorroborated Digital Title',
        contentType: 'movie',
        claimedOttReleaseDate: '2026-11-20',
        ottDateConfirmed: true,
        hasIndianTerritoryEvidence: true,
        evidenceSource: 'TMDB_IN_DIGITAL_RELEASE',
        uncorroboratedDate: true, // uncorroborated date
        ottPlatforms: []
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.assignedCategory).toBe('PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('UNCORROBORATED_STREAMING_DATE_HELD');
    });
  });

  describe('Rule 6: Now Streaming Invariants', () => {
    it('should reject a past release date alone if not currently streaming on an Indian platform', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:778899',
        title: 'Old Movie From Last Month',
        contentType: 'movie',
        claimedOttReleaseDate: '2026-09-15', // Past date
        ottDateConfirmed: true,
        ottPlatforms: [] // No active flatrate streaming
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('HISTORICAL_DATE_WITHOUT_ACTIVE_STREAMING');
    });

    it('should accept current Indian streaming availability with valid evidence as Now Streaming', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:445566',
        title: 'Active Blockbuster',
        contentType: 'movie',
        theatricalStatus: 'NONE',
        claimedOttReleaseDate: '2026-10-15',
        ottDateConfirmed: true,
        hasIndianTerritoryEvidence: true,
        primaryPlatform: 'Netflix',
        ottPlatforms: [
          {
            name: 'Netflix',
            availableInIndia: true,
            verified: true,
            availabilityType: 'SUBSCRIPTION',
            availableFrom: '2026-10-15'
          }
        ]
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(true);
      expect(result.decision).toBe('ACCEPT_NOW_STREAMING');
      expect(result.assignedCategory).toBe('NOW_STREAMING');
      expect(result.evidenceDetails.assignedPlatform).toBe('Netflix');
    });

    it('should NEVER allow a future release date to be classified as Now Streaming', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:123456',
        title: 'Future Streaming Release',
        contentType: 'movie',
        claimedOttReleaseDate: '2026-11-20', // Strictly in future
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        verifiedClaimTitle: 'Future Streaming Release',
        verifiedClaimTerritories: ['IN'],
        verifiedClaimAvailability: 'SUBSCRIPTION',
        verifiedClaimDatePrecision: 'EXACT_DATE',
        verifiedClaimDate: '2026-11-20',
        verifiedClaimPlatform: 'Prime Video',
        verifiedEvidenceId: 'ev-rule-6',
        theatricalStatus: 'NONE',
        ottDateConfirmed: true,
        hasIndianTerritoryEvidence: true,
        primaryPlatform: 'Prime Video',
        ottPlatforms: [
          {
            name: 'Prime Video',
            availableInIndia: true,
            verified: true,
            availabilityType: 'SUBSCRIPTION',
            availableFrom: '2026-11-20' // Not yet available
          }
        ]
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      // Must NOT be NOW_STREAMING! Must be UPCOMING_OTT
      expect(result.decision).not.toBe('ACCEPT_NOW_STREAMING');
      expect(result.decision).toBe('ACCEPT_UPCOMING_OTT');
      expect(result.assignedCategory).toBe('UPCOMING_OTT');
    });
  });

  describe('Rule 7: Conflicts & Theatrical Precedence', () => {
    it('should quarantine candidates with detected date conflicts into PENDING_VALIDATION', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:333222',
        title: 'Conflicting Release',
        contentType: 'movie',
        claimedOttReleaseDate: '2026-11-10',
        hasIndianTerritoryEvidence: true,
        dateConflictDetected: true,
        dateConflictDetails: 'DATE_CONFLICT: TMDB reports 2026-11-10, Partner reports 2026-11-28',
        ottPlatforms: [{ name: 'SonyLIV', availableInIndia: true, verified: true }]
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.assignedCategory).toBe('PENDING_VALIDATION');
      expect(result.quarantineReason).toContain('DATE_CONFLICT');
    });

    it('should quarantine candidates with uncorroborated dates into PENDING_VALIDATION', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:111222',
        title: 'Rumored Web Series',
        contentType: 'tv',
        seasonNumber: 1,
        claimedOttReleaseDate: '2026-11-12',
        hasIndianTerritoryEvidence: true,
        uncorroboratedDate: true,
        ottPlatforms: [{ name: 'Zee5', availableInIndia: true, verified: true }]
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.assignedCategory).toBe('PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('UNCORROBORATED_STREAMING_DATE_HELD');
    });

    it('should reject from Upcoming OTT if movie is currently running in Indian theaters', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:555666',
        title: 'Theatrical Hit In Cinemas',
        contentType: 'movie',
        theatricalStatus: 'CURRENTLY_RUNNING',
        theatricalReleaseDate: '2026-10-10',
        claimedOttReleaseDate: '2026-11-20',
        isDirectToOtt: false,
        hasIndianTerritoryEvidence: true,
        ottPlatforms: [{ name: 'Netflix', availableInIndia: true, verified: true }]
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('THEATRICAL_EXHIBITION_TAKES_PRECEDENCE');
    });
  });

  describe('Rule 8 & 9: Audit Tracing and Invariants', () => {
    it('should retain structured audit details showing all stages passed', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:tv:243555',
        title: 'Akka',
        contentType: 'tv',
        seasonNumber: 1,
        claimedOttReleaseDate: '2026-10-30',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        verifiedClaimTitle: 'Akka',
        verifiedClaimSeasonNumber: 1,
        verifiedClaimTerritories: ['IN'],
        verifiedClaimAvailability: 'SUBSCRIPTION',
        verifiedClaimDatePrecision: 'EXACT_DATE',
        verifiedClaimDate: '2026-10-30',
        verifiedClaimPlatform: 'Netflix',
        verifiedEvidenceId: 'ev-rule-8',
        theatricalStatus: 'NONE',
        ottDateConfirmed: true,
        hasIndianTerritoryEvidence: true,
        primaryPlatform: 'Netflix',
        ottPlatforms: [
          {
            name: 'Netflix',
            availableInIndia: true,
            verified: true,
            availabilityType: 'SUBSCRIPTION',
            availableFrom: '2026-10-30'
          }
        ]
      };

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(true);
      expect(result.evidenceDetails.stagesPassed).toEqual([
        'STAGE_1_IDENTITY',
        'STAGE_2_CONTENT_TYPE',
        'STAGE_3_RELEASE_EVENT',
        'STAGE_4_DATE_EVALUATION',
        'STAGE_4B_HISTORICAL_PREMIERE_GATE',
        'STAGE_5_TERRITORY',
        'STAGE_6_PLATFORM',
        'STAGE_7_CONFLICT_CHECK',
        'STAGE_8_CATEGORY_ASSIGNED',
        'STAGE_9_AUDIT_RETAINED'
      ]);
    });
  });

  describe('Phase 2.7.3.6 — Production Eligibility Gate Remediation Mandatory Tests', () => {
    let registry: IndianOttRegistryService;
    let movieClassification: MovieClassificationService;

    beforeEach(() => {
      movieClassification = new MovieClassificationService();
      registry = new IndianOttRegistryService(service, movieClassification);
    });

    const createBaseValidInput = (): OttCandidateValidationInput => ({
      canonicalId: 'tmdb:movie:777001',
      title: 'Valid Gate Movie',
      contentType: 'movie',
      claimedOttReleaseDate: '2026-11-20',
      ottDateConfirmed: true,
      hasIndianTerritoryEvidence: true,
      primaryPlatform: 'Netflix',
      historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
      claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
      isClaimContentVerified: true,
      verifiedClaimTitle: 'Valid Gate Movie',
      verifiedClaimTerritories: ['IN'],
      verifiedClaimAvailability: 'SUBSCRIPTION',
      verifiedClaimDatePrecision: 'EXACT_DATE',
      verifiedClaimDate: '2026-11-20',
      verifiedClaimPlatform: 'Netflix',
      verifiedEvidenceId: 'ev-test-valid-1',
      theatricalStatus: 'NONE',
      theatricalRunExplicitlyEnded: true,
      theatricalClosureTerritory: 'IN',
      theatricalClosureEvidenceId: 'ev-theatrical-closure-1',
      ottPlatforms: [
        {
          name: 'Netflix',
          availableInIndia: true,
          verified: true,
          availabilityType: 'SUBSCRIPTION',
          availableFrom: '2026-11-20'
        }
      ]
    });

    // 1. Theatrical release 46 days ago without explicit closure is quarantined.
    it('1. Theatrical release 46 days ago without explicit closure is quarantined', () => {
      // todayStr: 2026-10-25. 46 days ago is 2026-09-09.
      const input = createBaseValidInput();
      input.theatricalReleaseDate = '2026-09-09';
      input.theatricalStatus = 'ENDED'; // calendar-derived from 45 days
      input.theatricalRunExplicitlyEnded = false;

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    // 2. Theatrical release 90 days ago without explicit closure is quarantined.
    it('2. Theatrical release 90 days ago without explicit closure is quarantined', () => {
      // todayStr: 2026-10-25. 90 days ago is 2026-07-27.
      const input = createBaseValidInput();
      input.theatricalReleaseDate = '2026-07-27';
      input.theatricalStatus = 'ENDED';
      input.theatricalRunExplicitlyEnded = false;

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    // 3. Calendar-derived ENDED does not satisfy Stage 7.
    it('3. Calendar-derived ENDED does not satisfy Stage 7', () => {
      const input = createBaseValidInput();
      input.theatricalReleaseDate = '2026-09-01'; // 54 days ago
      input.theatricalStatus = 'ENDED'; // derived solely from calendar expiration
      input.theatricalRunExplicitlyEnded = false;

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED');
    });

    // 4. Explicitly verified exhibition closure allows the candidate to proceed to other gates.
    it('4. Explicitly verified exhibition closure allows the candidate to proceed to other gates', () => {
      const input = createBaseValidInput();
      input.theatricalReleaseDate = '2026-09-01';
      input.theatricalStatus = 'ENDED';
      input.theatricalRunExplicitlyEnded = true; // explicitly verified

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(true);
      expect(result.decision).toBe('ACCEPT_UPCOMING_OTT');
      expect(result.evidenceDetails.stagesPassed).toContain('STAGE_7_CONFLICT_CHECK');
    });

    // 5. Unverified direct-to-OTT boolean cannot bypass theatrical precedence.
    it('5. Unverified direct-to-OTT boolean cannot bypass theatrical precedence', () => {
      const input = createBaseValidInput();
      input.theatricalStatus = 'UNKNOWN';
      input.isDirectToOtt = true;
      input.directToOttVerified = false; // Unverified upstream boolean!

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED');
    });

    // 6. Verified direct-to-OTT evidence follows the permitted exception.
    it('6. Verified direct-to-OTT evidence follows the permitted exception', () => {
      const input = createBaseValidInput();
      input.theatricalStatus = 'UNKNOWN';
      input.isDirectToOtt = true;
      input.directToOttVerified = true; // Verified direct-to-OTT!
      input.directToOttTerritory = 'IN';
      input.directToOttAvailability = 'SUBSCRIPTION';
      input.directToOttEvidenceId = 'ev-direct-to-ott-1';

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(true);
      expect(result.decision).toBe('ACCEPT_UPCOMING_OTT');
      expect(result.evidenceDetails.stagesPassed).toContain('STAGE_7_CONFLICT_CHECK');
    });

    // 7. CURRENTLY_RUNNING is rejected.
    it('7. CURRENTLY_RUNNING is rejected', () => {
      const input = createBaseValidInput();
      input.theatricalStatus = 'CURRENTLY_RUNNING';

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('THEATRICAL_EXHIBITION_TAKES_PRECEDENCE');
    });

    // 8. UNKNOWN theatrical status is quarantined.
    it('8. UNKNOWN theatrical status is quarantined', () => {
      const input = createBaseValidInput();
      input.theatricalStatus = 'UNKNOWN';
      input.isDirectToOtt = false;
      input.directToOttVerified = false;

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED');
    });

    // 9. Missing historical status is quarantined.
    it('9. Missing historical status is quarantined', () => {
      const input = createBaseValidInput();
      delete input.historicalVerificationStatus;

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('HISTORICAL_STATUS_UNVERIFIED_HELD');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_4B_HISTORICAL_PREMIERE_GATE');
    });

    // 10. Null historical status is quarantined.
    it('10. Null historical status is quarantined', () => {
      const input = createBaseValidInput();
      input.historicalVerificationStatus = null as any;

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('HISTORICAL_STATUS_UNVERIFIED_HELD');
    });

    // 11. Invalid historical enum string is quarantined.
    it('11. Invalid historical enum string is quarantined', () => {
      const input = createBaseValidInput();
      input.historicalVerificationStatus = 'UNRECOGNIZED_STATUS' as any;

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('HISTORICAL_STATUS_UNVERIFIED_HELD');
    });

    // 12. VERIFIED_NO_PRIOR_PREMIERE passes the historical gate.
    it('12. VERIFIED_NO_PRIOR_PREMIERE passes the historical gate', () => {
      const input = createBaseValidInput();
      input.historicalVerificationStatus = 'VERIFIED_NO_PRIOR_PREMIERE';

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.evidenceDetails.stagesPassed).toContain('STAGE_4B_HISTORICAL_PREMIERE_GATE');
    });

    // 13. CONFIRMED_PRIOR_PREMIERE is rejected.
    it('13. CONFIRMED_PRIOR_PREMIERE is rejected', () => {
      const input = createBaseValidInput();
      input.historicalVerificationStatus = 'CONFIRMED_PRIOR_PREMIERE';

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('ALREADY_RELEASED_HISTORICAL_OTT');
    });

    // 14. Authorized domain without verified content is quarantined.
    it('14. Authorized domain without verified content is quarantined', () => {
      const input = createBaseValidInput();
      input.claimVerificationStatus = 'SOURCE_AUTHORIZED'; // Valid domain, but unverified page content!
      input.isClaimContentVerified = false;

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('CLAIM_CONTENT_UNVERIFIED_HELD');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    // 15. Valid URL with unrelated or mismatched content cannot qualify.
    it('15. Valid URL with unrelated or mismatched content cannot qualify', () => {
      const input = createBaseValidInput();
      input.claimVerificationStatus = 'CLAIM_CONTENT_MISMATCH';
      input.isClaimContentVerified = false;

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('CLAIM_CONTENT_MISMATCH_REJECTED');
    });

    // 16. Provider-supplied claimVerificationStatus cannot bypass trusted verification requirements.
    it('16. Provider-supplied claimVerificationStatus cannot bypass trusted verification requirements', () => {
      const input = createBaseValidInput();
      // Caller asserts CLAIM_CONTENT_VERIFIED, but isClaimContentVerified is false (untrusted source)
      input.claimVerificationStatus = 'CLAIM_CONTENT_VERIFIED';
      input.isClaimContentVerified = false;

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('CLAIM_CONTENT_UNVERIFIED_HELD');
    });

    // 17. CLAIM_CONTENT_VERIFIED with mismatched title is rejected.
    it('17. CLAIM_CONTENT_VERIFIED with mismatched title is rejected', () => {
      const input = createBaseValidInput();
      input.title = 'Kantara A Legend Chapter 1';
      input.verifiedClaimTitle = 'Squid Game Season 2'; // Mismatch!

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('CLAIM_TITLE_MISMATCH_REJECTED');
    });

    // 18. CLAIM_CONTENT_VERIFIED with incorrect territory is rejected.
    it('18. CLAIM_CONTENT_VERIFIED with incorrect territory is rejected', () => {
      const input = createBaseValidInput();
      input.verifiedClaimTerritories = ['US', 'GB']; // Missing 'IN'

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('CLAIM_TERRITORY_NOT_SUPPORTED_REJECTED');
    });

    // 19. CLAIM_CONTENT_VERIFIED with rental/purchase availability cannot qualify for subscription Upcoming OTT.
    it('19. CLAIM_CONTENT_VERIFIED with rental/purchase availability cannot qualify for subscription Upcoming OTT', () => {
      const input = createBaseValidInput();
      input.verifiedClaimAvailability = 'RENTAL';

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('RENTAL_OR_PURCHASE_ONLY_NOT_SUBSCRIPTION_OTT');
    });

    // 20. Missing claim verification is quarantined.
    it('20. Missing claim verification is quarantined', () => {
      const input = createBaseValidInput();
      delete input.claimVerificationStatus;
      delete input.isClaimContentVerified;

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('CLAIM_CONTENT_UNVERIFIED_HELD');
    });

    // 21. Existing collision handling remains intact.
    it('21. Existing collision handling remains intact', () => {
      const record1: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-test-col-21',
        providerId: 'NETFLIX_IN_NEWSROOM',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://about.netflix.com/en/newsroom/col-movie-1',
        sourceName: 'Netflix India Newsroom',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Collision Movie A',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      const record2: StructuredOttEvidenceRecord = {
        ...record1,
        claimedOttReleaseDate: '2026-12-15' // conflicting payload on same evidenceId
      };

      const cand1 = registry.registerEvidenceRecord(record1);
      const cand2 = registry.registerEvidenceRecord(record2);

      const entry = registry.getIngestedEvidenceEntry('ev-test-col-21');
      expect(entry).toBeDefined();
      expect(entry?.originalRecord.claimedOttReleaseDate).toBe('2026-11-20');
      expect(entry?.conflictingPayloads.length).toBe(1);
      expect(entry?.conflictingPayloads[0].claimedOttReleaseDate).toBe('2026-12-15');

      const summary = registry.evaluateCandidateEvidence(cand1, todayStr);
      expect(summary.hasDateConflict).toBe(true);
      expect(summary.quarantineReason).toBe('EVIDENCE_PAYLOAD_COLLISION_DETECTED');
      expect(summary.passesToUpcomingOtt).toBe(false);
    });

    // 22. Fixtures remain excluded from production discovery.
    it('22. Fixtures remain excluded from production discovery', () => {
      registry.clear();
      registry.ingestTestFixtures(undefined, todayStr);
      // toCanonicalMovies with includeFixtures = false (production default)
      const prodMovies = registry.toCanonicalMovies(todayStr, false);
      expect(prodMovies.length).toBe(0);

      // toCanonicalMovies with includeFixtures = true (test mode)
      const testMovies = registry.toCanonicalMovies(todayStr, true);
      expect(testMovies.length).toBeGreaterThan(0);
    });

    // 23. All six discovery categories remain mutually exclusive.
    it('23. All six discovery categories remain mutually exclusive', () => {
      const candidates: CanonicalMovieMetadata[] = [
        {
          canonicalId: 'm1',
          title: 'Movie 1',
          originalLanguage: 'hi',
          theatricalStatus: 'CURRENTLY_RUNNING',
          theatricalRelease: '2026-10-15',
          ottPlatforms: []
        },
        {
          canonicalId: 'm2',
          title: 'Movie 2',
          originalLanguage: 'ta',
          theatricalStatus: 'UPCOMING',
          theatricalRelease: '2026-11-15',
          ottPlatforms: []
        },
        {
          canonicalId: 'm3',
          title: 'Movie 3',
          originalLanguage: 'te',
          theatricalStatus: 'ENDED',
          theatricalRunExplicitlyEnded: true,
          ottPlatforms: [
            {
              name: 'Netflix',
              availableInIndia: true,
              verified: true,
              availabilityType: 'SUBSCRIPTION',
              availableFrom: '2026-10-10'
            }
          ]
        },
        {
          canonicalId: 'm4',
          title: 'Movie 4',
          originalLanguage: 'ml',
          theatricalStatus: 'NONE',
          theatricalRunExplicitlyEnded: true,
          ottRelease: '2026-11-20',
          ottDateConfirmed: true,
          ottPlatforms: [
            {
              name: 'Prime Video',
              availableInIndia: true,
              verified: true,
              availabilityType: 'SUBSCRIPTION',
              availableFrom: '2026-11-20'
            }
          ]
        },
        {
          canonicalId: 'tv1',
          title: 'TV 1',
          originalLanguage: 'hi',
          contentType: 'tv',
          ottPlatforms: [
            {
              name: 'SonyLIV',
              availableInIndia: true,
              verified: true,
              availabilityType: 'SUBSCRIPTION',
              availableFrom: '2026-10-01'
            }
          ]
        }
      ];

      const buckets: Record<string, string[]> = {
        NOW_STREAMING: [],
        UPCOMING_OTT: [],
        NOW_IN_THEATERS: [],
        UPCOMING_THEATERS: [],
        TV_SHOWS_STREAMING: [],
        UNCLASSIFIED: []
      };

      for (const m of candidates) {
        const cat = movieClassification.classifyMovie(m, todayStr);
        expect(buckets[cat]).toBeDefined();
        buckets[cat].push(m.canonicalId);
      }

      // Check mutual exclusivity: No movie ID appears in more than one bucket
      const allIds = Object.values(buckets).flat();
      const uniqueIds = new Set(allIds);
      expect(allIds.length).toBe(uniqueIds.size);
    });
  });

  // =========================================================================
  // Phase 2.7.3.8 — Adversarial Trust Boundary Test Suite (Workstream 5)
  // =========================================================================
  describe('Phase 2.7.3.8 — Adversarial Trust Boundary Test Suite', () => {
    const createBaseValidInput = (): OttCandidateValidationInput => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:movie:888001',
        title: 'Adversarial Valid Movie',
        contentType: 'movie',
        claimedOttReleaseDate: '2026-11-20',
        ottDateConfirmed: true,
        hasIndianTerritoryEvidence: true,
        primaryPlatform: 'Netflix',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        verifiedClaimTitle: 'Adversarial Valid Movie',
        verifiedClaimTerritories: ['IN'],
        verifiedClaimAvailability: 'SUBSCRIPTION',
        verifiedClaimDatePrecision: 'EXACT_DATE',
        verifiedClaimDate: '2026-11-20',
        verifiedClaimPlatform: 'Netflix',
        verifiedEvidenceId: 'ev-test-valid-1',
        theatricalStatus: 'NONE',
        theatricalRunExplicitlyEnded: true,
        theatricalClosureTerritory: 'IN',
        theatricalClosureEvidenceId: 'ev-theatrical-closure-1',
        ottPlatforms: [
          {
            name: 'Netflix',
            availableInIndia: true,
            verified: true,
            availabilityType: 'SUBSCRIPTION',
            availableFrom: '2026-11-20'
          }
        ]
      };
      input.validationProof = authority.generateValidatorProof(input.canonicalId, {
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        directToOttVerified: false,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE'
      });
      return input;
    };

    // 1. Future OTT subscription + activeIndianSubscriptionOtt + CURRENTLY_RUNNING -> THEATRICAL_EXHIBITION_TAKES_PRECEDENCE
    it('Scenario 1: active subscription does not bypass CURRENTLY_RUNNING theatrical check', () => {
      const input = createBaseValidInput();
      input.theatricalStatus = 'CURRENTLY_RUNNING';
      input.theatricalReleaseDate = '2026-10-01'; // Running in cinemas
      input.ottPlatforms = [
        {
          name: 'Netflix',
          availableInIndia: true,
          verified: true,
          availabilityType: 'SUBSCRIPTION',
          availableFrom: '2026-10-10' // Currently active subscription streaming window
        }
      ];

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('THEATRICAL_EXHIBITION_TAKES_PRECEDENCE');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    // 2. Future OTT subscription + activeIndianSubscriptionOtt + UNKNOWN theatrical status -> THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED
    it('Scenario 2: active subscription does not bypass UNKNOWN theatrical status quarantine', () => {
      const input = createBaseValidInput();
      input.theatricalStatus = 'UNKNOWN';
      input.ottPlatforms = [
        {
          name: 'Netflix',
          availableInIndia: true,
          verified: true,
          availabilityType: 'SUBSCRIPTION',
          availableFrom: '2026-10-10'
        }
      ];

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    // 3. Future OTT subscription + activeIndianSubscriptionOtt + past theatrical release without closure -> THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED
    it('Scenario 3: active subscription does not bypass past theatrical release exhibition-closure requirement', () => {
      const input = createBaseValidInput();
      input.theatricalReleaseDate = '2026-09-01'; // Past theatrical release
      input.theatricalStatus = 'ENDED'; // Calendar derived
      input.theatricalRunExplicitlyEnded = false; // No authoritative exhibition closure
      input.ottPlatforms = [
        {
          name: 'Netflix',
          availableInIndia: true,
          verified: true,
          availabilityType: 'SUBSCRIPTION',
          availableFrom: '2026-10-10'
        }
      ];

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    // 4. CLAIM_CONTENT_VERIFIED with missing verifiedClaimTitle -> fails closed into CLAIM_CONTENT_UNVERIFIED_HELD
    it('Scenario 4: CLAIM_CONTENT_VERIFIED with missing verifiedClaimTitle fails closed into quarantine', () => {
      const input = createBaseValidInput();
      delete input.verifiedClaimTitle;

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('CLAIM_CONTENT_UNVERIFIED_HELD');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    // 5. CLAIM_CONTENT_VERIFIED with missing verifiedClaimTerritories -> fails closed into CLAIM_CONTENT_UNVERIFIED_HELD
    it('Scenario 5: CLAIM_CONTENT_VERIFIED with missing verifiedClaimTerritories fails closed into quarantine', () => {
      const input = createBaseValidInput();
      delete input.verifiedClaimTerritories;

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('CLAIM_CONTENT_UNVERIFIED_HELD');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    // 6. CLAIM_CONTENT_VERIFIED with missing verifiedClaimAvailability -> fails closed into CLAIM_CONTENT_UNVERIFIED_HELD
    it('Scenario 6: CLAIM_CONTENT_VERIFIED with missing verifiedClaimAvailability fails closed into quarantine', () => {
      const input = createBaseValidInput();
      delete input.verifiedClaimAvailability;

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('CLAIM_CONTENT_UNVERIFIED_HELD');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    // 7. CLAIM_CONTENT_VERIFIED with imprecise date precision -> fails closed into CLAIM_CONTENT_UNVERIFIED_HELD
    it('Scenario 7: CLAIM_CONTENT_VERIFIED with imprecise date precision (QUARTER_YEAR) fails closed into quarantine', () => {
      const input = createBaseValidInput();
      input.verifiedClaimDatePrecision = 'QUARTER_YEAR';

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('CLAIM_CONTENT_UNVERIFIED_HELD');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    // 8. Matching title but wrong season number for TV series -> CLAIM_SEASON_MISMATCH_REJECTED
    it('Scenario 8: Matching canonical title but wrong season number for TV series is rejected', () => {
      const input = createBaseValidInput();
      input.contentType = 'tv';
      input.seasonNumber = 2; // Target candidate is Season 2
      input.verifiedClaimSeasonNumber = 1; // Claim is for Season 1

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('CLAIM_SEASON_MISMATCH_REJECTED');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    // 9. Theatrical closure evidence for foreign territory only ('US') -> THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED
    it('Scenario 9: Theatrical closure evidence for non-Indian territory (US) is quarantined', () => {
      const input = createBaseValidInput();
      input.theatricalReleaseDate = '2026-08-01'; // Past theatrical run
      input.theatricalStatus = 'ENDED';
      input.theatricalRunExplicitlyEnded = true;
      input.theatricalClosureTerritory = 'US'; // Foreign closure, not Indian!

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    // 10. Reusing verified evidence for a different movie title -> CLAIM_TITLE_MISMATCH_REJECTED
    it('Scenario 10: Adversarial attempt to reuse verified claim evidence for a different title is rejected', () => {
      const input = createBaseValidInput();
      input.title = 'Phishing Fake Movie';
      input.verifiedClaimTitle = 'Adversarial Valid Movie'; // Evidence belonging to another movie

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('CLAIM_TITLE_MISMATCH_REJECTED');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    // 11. Reusing verified evidence for a different season -> CLAIM_SEASON_MISMATCH_REJECTED
    it('Scenario 11: Adversarial attempt to reuse verified claim evidence for a different TV season is rejected', () => {
      const input = createBaseValidInput();
      input.contentType = 'tv';
      input.seasonNumber = 3;
      input.verifiedClaimTitle = 'Adversarial Valid Movie';
      input.verifiedClaimSeasonNumber = 2; // Verified for Season 2, applied to Season 3

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('CLAIM_SEASON_MISMATCH_REJECTED');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });
  });

  // =========================================================================
  // Phase 2.7.3.12 — Critical Publication Safety Must-Fix Scenarios
  // =========================================================================
  describe('Phase 2.7.3.12 — Critical Publication Safety Must-Fix Scenarios', () => {
    const createBaseValidInput = (): OttCandidateValidationInput => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'tmdb:movie:999001',
        title: 'Safety Verified Movie',
        contentType: 'movie',
        claimedOttReleaseDate: '2026-11-20',
        ottDateConfirmed: true,
        hasIndianTerritoryEvidence: true,
        primaryPlatform: 'Netflix',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        verifiedClaimTitle: 'Safety Verified Movie',
        verifiedClaimTerritories: ['IN'],
        verifiedClaimAvailability: 'SUBSCRIPTION',
        verifiedClaimDatePrecision: 'EXACT_DATE',
        verifiedClaimDate: '2026-11-20',
        verifiedClaimPlatform: 'Netflix',
        verifiedEvidenceId: 'ev-test-safety-1',
        theatricalStatus: 'NONE',
        theatricalRunExplicitlyEnded: true,
        theatricalClosureTerritory: 'IN',
        theatricalClosureEvidenceId: 'ev-theatrical-closure-safety',
        ottPlatforms: [
          {
            name: 'Netflix',
            availableInIndia: true,
            verified: true,
            availabilityType: 'SUBSCRIPTION',
            availableFrom: '2026-11-20'
          }
        ]
      };
      input.validationProof = authority.generateValidatorProof(input.canonicalId, {
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        directToOttVerified: false,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE'
      });
      return input;
    };

    it('Must-Fix 1: TV series with float seasonNumber (e.g. 1.5) is rejected at Stage 2', () => {
      const input = createBaseValidInput();
      input.contentType = 'tv';
      input.seasonNumber = 1.5 as any;

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('MISSING_TV_SEASON_IDENTITY');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_2_CONTENT_TYPE');
    });

    it('Must-Fix 2: direct-to-OTT candidate with undefined/missing territory fails closed in Stage 7', () => {
      const input = createBaseValidInput();
      input.theatricalStatus = 'UNKNOWN';
      input.isDirectToOtt = true;
      input.directToOttVerified = true;
      input.directToOttTerritory = undefined; // Undefined territory loophole closed
      input.directToOttAvailability = 'SUBSCRIPTION';
      input.directToOttEvidenceId = 'ev-dto-valid';

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    it('Must-Fix 3: direct-to-OTT candidate with non-SUBSCRIPTION availability fails closed in Stage 7', () => {
      const input = createBaseValidInput();
      input.theatricalStatus = 'UNKNOWN';
      input.isDirectToOtt = true;
      input.directToOttVerified = true;
      input.directToOttTerritory = 'IN';
      input.directToOttAvailability = 'RENTAL'; // TVOD rental cannot bypass theatrical precedence
      input.directToOttEvidenceId = 'ev-dto-valid';

      const result = service.validateOttCandidate(attachProof(input), todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED');
    });

    it('Must-Fix 4: ValidatorProof with mismatched properties is rejected with UNAUTHORIZED_VALIDATOR_INVOCATION_PROOF_MISSING', () => {
      const input = createBaseValidInput();
      // Tamper: authority signed that isClaimContentVerified is FALSE
      input.validationProof = authority.generateValidatorProof(input.canonicalId, {
        isClaimContentVerified: false,
        theatricalRunExplicitlyEnded: true,
        directToOttVerified: false,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE'
      });
      // Caller presents input claiming isClaimContentVerified is TRUE
      input.isClaimContentVerified = true;

      const result = service.validateOttCandidate(input, todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('UNAUTHORIZED_VALIDATOR_INVOCATION_PROOF_MISSING');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    it('Must-Fix 5: OttValidatorService without verificationAuthority fails closed when claimVerificationStatus is CLAIM_CONTENT_VERIFIED', () => {
      const standaloneValidator = new OttValidatorService(); // No authority
      const input = createBaseValidInput();

      const result = standaloneValidator.validateOttCandidate(input, todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('UNAUTHORIZED_VALIDATOR_INVOCATION_PROOF_MISSING');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });
  });
});
