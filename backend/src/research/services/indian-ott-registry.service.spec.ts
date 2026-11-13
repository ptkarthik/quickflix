import { IndianOttRegistryService } from './indian-ott-registry.service';
import { OttValidatorService, OttCandidateValidationInput } from './ott-validator.service';
import { StructuredOttEvidenceRecord } from '../evidence/indian-ott-evidence.interface';
import { MovieClassificationService } from './movie-classification.service';

describe('IndianOttRegistryService — Phase 2.7.2 Evidence Foundation', () => {
  let registry: IndianOttRegistryService;
  let validator: OttValidatorService;
  const todayStr = '2026-10-31';

  beforeEach(() => {
    validator = new OttValidatorService();
    registry = new IndianOttRegistryService(validator);
    registry.clear();
  });

  describe('1. Incomplete or Invalid Source Provenance', () => {
    it('should reject evidence records with missing or empty sourceName', () => {
      const invalidRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-01',
        providerId: 'TEST_PROVIDER',
        sourceType: 'OFFICIAL_STUDIO_ANNOUNCEMENT',
        sourceName: '   ',
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-25T11:00:00Z',
        title: 'Thug Life',
        contentType: 'movie',
        originalLanguage: 'ta',
        industries: ['Kollywood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      expect(() => registry.registerEvidenceRecord(invalidRecord)).toThrow(
        /missing sourceName/
      );
    });

    it('should reject evidence records with sourceType UNKNOWN', () => {
      const unknownSourceRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-02',
        providerId: 'TEST_PROVIDER',
        sourceType: 'UNKNOWN',
        sourceName: 'Some Random Forum',
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-25T11:00:00Z',
        title: 'Coolie',
        contentType: 'movie',
        originalLanguage: 'ta',
        industries: ['Kollywood'],
        claimedOttReleaseDate: '2026-12-15',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Prime Video',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      expect(() => registry.registerEvidenceRecord(unknownSourceRecord)).toThrow(
        /sourceType cannot be UNKNOWN/
      );
    });
  });

  describe('2. Missing Evidence & Generic Booleans Without Supporting Records', () => {
    it('should quarantine a candidate that has no evidence records', () => {
      const summary = registry.evaluateCandidateEvidence({
        candidateId: 'cand:movie:empty',
        title: 'Phantom Film',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        evidenceRecords: []
      }, todayStr);

      expect(summary.hasAuthorizedSource).toBe(false);
      expect(summary.territoryVerified).toBe(false);
      expect(summary.passesToUpcomingOtt).toBe(false);
      expect(summary.quarantineReason).toBe('NO_EVIDENCE_RECORDS_FOUND');
    });

    it('should reject candidates supported ONLY by unverified community submissions even if claiming verified: true', () => {
      const communityRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-comm-01',
        providerId: 'REDDIT_RUMOR',
        sourceType: 'COMMUNITY_SUBMISSION',
        sourceName: 'Social Media Rumors Desk',
        announcementTimestamp: '2026-10-28T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-28T10:00:00Z',
        title: 'Speculative Biggie',
        contentType: 'movie',
        originalLanguage: 'te',
        industries: ['Tollywood'],
        claimedOttReleaseDate: '2026-11-25',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      const candidate = registry.registerEvidenceRecord(communityRecord);
      const summary = registry.evaluateCandidateEvidence(candidate, todayStr);
      expect(summary.hasAuthorizedSource).toBe(false);
      expect(summary.rejectionReason).toBe('UNAUTHORIZED_OR_COMMUNITY_ONLY_EVIDENCE');
      expect(summary.passesToUpcomingOtt).toBe(false);

      const validation = registry.validateCandidate(candidate, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('REJECT_UNCLASSIFIED');
    });
  });

  describe('3. Indian versus Non-Indian Territory Evidence', () => {
    it('should reject an announcement covering only overseas territories without explicit India rights', () => {
      const overseasRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-us-01',
        providerId: 'US_DISTRIBUTOR_PRESS',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://press.hulu.com/news/regional-film',
        sourceName: 'Hulu US Newsroom',
        announcementTimestamp: '2026-10-29T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-29T10:00:00Z',
        title: 'Regional Film in America',
        contentType: 'movie',
        originalLanguage: 'ml',
        industries: ['Mollywood'],
        claimedOttReleaseDate: '2026-11-15',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Hulu',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: {
          isIndiaExplicit: false,
          territoryCodes: ['US', 'CA'],
          geoRestrictionNotes: 'Streaming in US and Canada only',
          supportsIndianRegion: false
        }
      };

      const candidate = registry.registerEvidenceRecord(overseasRecord);
      const summary = registry.evaluateCandidateEvidence(candidate, todayStr);
      expect(summary.territoryVerified).toBe(false);
      expect(summary.rejectionReason).toBe('INDIAN_TERRITORY_NOT_VERIFIED_IN_ANNOUNCEMENT');

      const validation = registry.validateCandidate(candidate, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('REJECT_UNCLASSIFIED');
    });

    it('should accept an announcement explicitly confirming India distribution rights', () => {
      const ticket = registry.getVerificationAuthority().issueTicket('internal-auditor', 'INTERNAL_AUDITOR');
      const indiaRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-in-01',
        providerId: 'PRIME_VIDEO_IN_PRESS',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://press.amazonstudios.com/in/kanguva',
        sourceName: 'Prime Video India Newsroom',
        verificationTicket: ticket,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:kanguva:2026',
          evidenceId: 'ev-theat-kanguva',
          closureDate: '2026-10-01',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Cinema run closed'
        },
        verifiedClaimDetails: {
          title: 'Kanguva',
          platform: 'Prime Video',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-20',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-in-01',
          verifiedAt: '2026-10-29T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-29T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-29T10:00:00Z',
        title: 'Kanguva',
        contentType: 'movie',
        originalLanguage: 'ta',
        industries: ['Kollywood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Prime Video',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      const candidate = registry.registerEvidenceRecord(indiaRecord);
      const summary = registry.evaluateCandidateEvidence(candidate, todayStr);
      expect(summary.territoryVerified).toBe(true);
      expect(summary.passesToUpcomingOtt).toBe(true);

      const validation = registry.validateCandidate(candidate, todayStr);
      expect(validation.isValid).toBe(true);
      expect(validation.decision).toBe('ACCEPT_UPCOMING_OTT');
      expect(validation.assignedCategory).toBe('UPCOMING_OTT');
    });
  });

  describe('4. Subscription versus Rental / Purchase / Free / Ads Availability', () => {
    it('should strictly reject RENTAL-only offerings from Upcoming Subscription OTT', () => {
      const rentalRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-rent-01',
        providerId: 'BMS_STREAM_PR',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://in.bookmyshow.com/stream/festival-film',
        sourceName: 'BookMyShow Stream Official',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:majoractionspectacle:2026',
          evidenceId: 'ev-theat-lyca',
          closureDate: '2026-10-15',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Theatrical run closed'
        },
        verifiedClaimDetails: {
          title: 'Major Action Spectacle',
          territoryCodes: ['IN'],
          premiereDate: '2026-12-05',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-tba-01',
          verifiedAt: '2026-10-28T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-28T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-28T10:00:00Z',
        title: 'Festival Film Rental',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-10',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Prime Video',
        availabilityType: 'RENTAL',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      const candidate = registry.registerEvidenceRecord(rentalRecord);
      const summary = registry.evaluateCandidateEvidence(candidate, todayStr);
      expect(summary.isSubscriptionConfirmed).toBe(false);
      expect(summary.rejectionReason).toBe('RENTAL_OR_PURCHASE_ONLY_NOT_SUBSCRIPTION_OTT');

      const validation = registry.validateCandidate(candidate, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('REJECT_UNCLASSIFIED');
      expect(validation.rejectionReason).toBe('RENTAL_OR_PURCHASE_ONLY_NOT_SUBSCRIPTION_OTT');
    });

    it('should strictly reject PURCHASE-only (EST) offerings from Upcoming Subscription OTT', () => {
      const purchaseRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-buy-01',
        providerId: 'APPLE_TV_IN_PR',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://tv.apple.com/in/indie-direct',
        sourceName: 'Apple TV India Store',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:majoractionspectacle:2026',
          evidenceId: 'ev-theat-lyca',
          closureDate: '2026-10-15',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Theatrical run closed'
        },
        verifiedClaimDetails: {
          title: 'Major Action Spectacle',
          territoryCodes: ['IN'],
          premiereDate: '2026-12-05',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-tba-01',
          verifiedAt: '2026-10-28T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-28T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-28T10:00:00Z',
        title: 'Indie Direct Purchase',
        contentType: 'movie',
        originalLanguage: 'ta',
        industries: ['Kollywood'],
        claimedOttReleaseDate: '2026-11-12',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Apple TV+',
        availabilityType: 'PURCHASE',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      const candidate = registry.registerEvidenceRecord(purchaseRecord);
      const summary = registry.evaluateCandidateEvidence(candidate, todayStr);
      expect(summary.isSubscriptionConfirmed).toBe(false);
      expect(summary.rejectionReason).toBe('RENTAL_OR_PURCHASE_ONLY_NOT_SUBSCRIPTION_OTT');

      const validation = registry.validateCandidate(candidate, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('REJECT_UNCLASSIFIED');
      expect(validation.rejectionReason).toBe('RENTAL_OR_PURCHASE_ONLY_NOT_SUBSCRIPTION_OTT');
    });

    it('should reject ad-supported (AVOD) or free streaming from Subscription Upcoming OTT', () => {
      const adsRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-ads-01',
        providerId: 'AMAZON_MX_PLAYER_PR',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://amazon.com/mxplayer/free-mini-series',
        sourceName: 'Amazon MX Player Press',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:kanguva:2026',
          evidenceId: 'ev-theat-kanguva',
          closureDate: '2026-10-01',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Cinema run closed'
        },
        verifiedClaimDetails: {
          title: 'Kanguva',
          platform: 'Prime Video',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-20',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-in-01',
          verifiedAt: '2026-10-29T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-29T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-29T10:00:00Z',
        title: 'Free Mini Series',
        contentType: 'tv',
        seasonNumber: 1,
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-14',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Prime Video',
        availabilityType: 'ADS',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      const candidate = registry.registerEvidenceRecord(adsRecord);
      const summary = registry.evaluateCandidateEvidence(candidate, todayStr);
      expect(summary.isSubscriptionConfirmed).toBe(false);
      expect(summary.rejectionReason).toBe('AD_SUPPORTED_OR_FREE_NOT_SUBSCRIPTION_OTT');

      const validation = registry.validateCandidate(candidate, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('REJECT_UNCLASSIFIED');
      expect(validation.rejectionReason).toBe('AD_SUPPORTED_OR_FREE_NOT_SUBSCRIPTION_OTT');
    });

    it('should quarantine candidates whose availability model is UNKNOWN into PENDING_VALIDATION', () => {
      const unknownModelRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-unk-01',
        providerId: 'TRADE_TRACKER_PR',
        sourceType: 'TRADE_DESK_CORROBORATED',
        sourceName: 'Trade Report',
        announcementTimestamp: '2026-10-29T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-29T10:00:00Z',
        title: 'Unclarified Rights Movie',
        contentType: 'movie',
        originalLanguage: 'kn',
        industries: ['Sandalwood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Zee5',
        availabilityType: 'UNKNOWN',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      const candidate = registry.registerEvidenceRecord(unknownModelRecord);
      const summary = registry.evaluateCandidateEvidence(candidate, todayStr);
      expect(summary.isSubscriptionConfirmed).toBe(false);
      expect(summary.quarantineReason).toBe('UNKNOWN_AVAILABILITY_MODEL_QUARANTINED');

      const validation = registry.validateCandidate(candidate, todayStr);
      expect(validation.decision).toBe('QUARANTINE_PENDING_VALIDATION');
    });
  });

  describe('5. Platform TBA with and without Confirmed Subscription Rights', () => {
    it('should accept Platform TBA when Indian subscription rights and exact future date are confirmed', () => {
      const ticket = registry.getVerificationAuthority().issueTicket('internal-auditor', 'INTERNAL_AUDITOR');
      const tbaRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-tba-01',
        providerId: 'STUDIO_OFFICIAL_PR',
        sourceType: 'OFFICIAL_STUDIO_ANNOUNCEMENT',
        sourceUrl: 'https://lycaproductions.in/news/major-action',
        sourceName: 'Lyca Productions Official',
        verificationTicket: ticket,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:majoractionspectacle:2026',
          evidenceId: 'ev-theat-lyca',
          closureDate: '2026-10-15',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Theatrical run closed'
        },
        verifiedClaimDetails: {
          title: 'Major Action Spectacle',
          territoryCodes: ['IN'],
          premiereDate: '2026-12-05',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-tba-01',
          verifiedAt: '2026-10-28T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-28T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-28T10:00:00Z',
        title: 'Major Action Spectacle',
        contentType: 'movie',
        originalLanguage: 'ta',
        industries: ['Kollywood'],
        claimedOttReleaseDate: '2026-12-05',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: undefined, // Platform undisclosed by studio
        availabilityType: 'SUBSCRIPTION', // Studio confirmed digital subscription premiere
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      const candidate = registry.registerEvidenceRecord(tbaRecord);
      const summary = registry.evaluateCandidateEvidence(candidate, todayStr);
      expect(summary.isPlatformTbaEligible).toBe(true);
      expect(summary.platformName).toBe('Platform TBA');
      expect(summary.passesToUpcomingOtt).toBe(true);

      const validation = registry.validateCandidate(candidate, todayStr);
      expect(validation.isValid).toBe(true);
      expect(validation.decision).toBe('ACCEPT_UPCOMING_OTT');
      expect(validation.evidenceDetails.assignedPlatform).toBe('Platform TBA');
    });

    it('should reject Platform TBA if subscription rights are NOT established', () => {
      const unevidencedTbaRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-tba-02',
        providerId: 'STUDIO_OFFICIAL_PR',
        sourceType: 'OFFICIAL_STUDIO_ANNOUNCEMENT',
        sourceUrl: 'https://lycaproductions.in/news/vague-deal',
        sourceName: 'Independent Studio Desk',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:majoractionspectacle:2026',
          evidenceId: 'ev-theat-lyca',
          closureDate: '2026-10-15',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Theatrical run closed'
        },
        verifiedClaimDetails: {
          title: 'Major Action Spectacle',
          territoryCodes: ['IN'],
          premiereDate: '2026-12-05',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-tba-01',
          verifiedAt: '2026-10-28T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-28T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-28T10:00:00Z',
        title: 'Vague Digital Deal',
        contentType: 'movie',
        originalLanguage: 'te',
        industries: ['Tollywood'],
        claimedOttReleaseDate: '2026-12-05',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: undefined,
        availabilityType: 'RENTAL', // Non-subscription!
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      const candidate = registry.registerEvidenceRecord(unevidencedTbaRecord);
      const summary = registry.evaluateCandidateEvidence(candidate, todayStr);
      expect(summary.isPlatformTbaEligible).toBe(false);
      expect(summary.passesToUpcomingOtt).toBe(false);

      const validation = registry.validateCandidate(candidate, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('REJECT_UNCLASSIFIED');
    });
  });

  describe('6. Season-Specific Identity for Television Series', () => {
    it('should reject TV series records missing seasonNumber', () => {
      const invalidTvRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-tv-no-season',
        providerId: 'PRIME_VIDEO_IN_PRESS',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://press.amazonstudios.com/in/panchayat',
        sourceName: 'Prime Video India',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:chithha:2026',
          evidenceId: 'ev-theat-chithha',
          closureDate: '2026-10-10',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Cinema closure complete'
        },
        verifiedClaimDetails: {
          title: 'Chithha',
          platform: 'SonyLIV',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-dedup-01',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-25T10:00:00Z',
        title: 'Panchayat',
        contentType: 'tv',
        seasonNumber: undefined, // Missing season!
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Prime Video',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      expect(() => registry.registerEvidenceRecord(invalidTvRecord)).toThrow(
        /Season-level identity violation/
      );
    });

    it('should keep Season 1 and Season 2 as isolated candidates with distinct IDs and dates', () => {
      const season1Record: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-mirzapur-s1',
        providerId: 'PRIME_VIDEO_IN_PRESS',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://press.amazonstudios.com/in/mirzapur-s1',
        sourceName: 'Prime Video India',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        announcementTimestamp: '2026-10-20T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-20T10:00:00Z',
        title: 'Mirzapur',
        contentType: 'tv',
        seasonNumber: 1,
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-05',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Prime Video',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      const season2Record: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-mirzapur-s2',
        providerId: 'PRIME_VIDEO_IN_PRESS',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://press.amazonstudios.com/in/mirzapur-s2',
        sourceName: 'Prime Video India',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        announcementTimestamp: '2026-10-22T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-22T10:00:00Z',
        title: 'Mirzapur',
        contentType: 'tv',
        seasonNumber: 2,
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2027-03-15',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Prime Video',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      const cand1 = registry.registerEvidenceRecord(season1Record);
      const cand2 = registry.registerEvidenceRecord(season2Record);

      expect(cand1.candidateId).not.toBe(cand2.candidateId);
      expect(cand1.seasonNumber).toBe(1);
      expect(cand2.seasonNumber).toBe(2);

      const summary1 = registry.evaluateCandidateEvidence(cand1, todayStr);
      const summary2 = registry.evaluateCandidateEvidence(cand2, todayStr);

      expect(summary1.confirmedDate).toBe('2026-11-05');
      expect(summary2.confirmedDate).toBe('2027-03-15');
    });
  });

  describe('7. Conflicting Release Dates Across Providers', () => {
    it('should detect date conflicts across authorized sources and quarantine into PENDING_VALIDATION', () => {
      const source1: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-date-conf-01',
        providerId: 'NETFLIX_IN_PR',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://about.netflix.com/en/newsroom/devara-part-1',
        sourceName: 'Netflix India Press',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        announcementTimestamp: '2026-10-24T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-24T10:00:00Z',
        title: 'Devara Part 1',
        contentType: 'movie',
        originalLanguage: 'te',
        industries: ['Tollywood'],
        claimedOttReleaseDate: '2026-11-08',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      const source2: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-date-conf-02',
        providerId: 'STUDIO_OFFICIAL_PR',
        sourceType: 'OFFICIAL_STUDIO_ANNOUNCEMENT',
        sourceUrl: 'https://about.netflix.com/en/newsroom/devara-part-1-update',
        sourceName: 'Yuvasudha Arts Official',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:chithha:2026',
          evidenceId: 'ev-theat-chithha',
          closureDate: '2026-10-10',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Cinema closure complete'
        },
        verifiedClaimDetails: {
          title: 'Chithha',
          platform: 'SonyLIV',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-dedup-01',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-26T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-26T10:00:00Z',
        title: 'Devara Part 1',
        contentType: 'movie',
        originalLanguage: 'te',
        industries: ['Tollywood'],
        claimedOttReleaseDate: '2026-11-15', // Conflicting date!
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      const candidate = registry.registerEvidenceRecord(source1);
      registry.registerEvidenceRecord(source2);

      const summary = registry.evaluateCandidateEvidence(candidate, todayStr);
      expect(summary.hasDateConflict).toBe(true);
      expect(summary.quarantineReason).toContain('DATE_CONFLICT');
      expect(summary.passesToUpcomingOtt).toBe(false);

      const validation = registry.validateCandidate(candidate, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(validation.assignedCategory).toBe('PENDING_VALIDATION');
    });
  });

  describe('8. Deduplication of Multiple Corroborating Records', () => {
    it('should merge duplicate reports for the same title and date into a single corroborated candidate', () => {
      const ticket = registry.getVerificationAuthority().issueTicket('internal-auditor', 'INTERNAL_AUDITOR');
      const platformRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-dedup-01',
        providerId: 'SONYLIV_PR',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://www.sonyliv.com/press/chithha-ott',
        sourceName: 'SonyLIV Press',
        verificationTicket: ticket,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:chithha:2026',
          evidenceId: 'ev-theat-chithha',
          closureDate: '2026-10-10',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Cinema closure complete'
        },
        verifiedClaimDetails: {
          title: 'Chithha',
          platform: 'SonyLIV',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-dedup-01',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-25T10:00:00Z',
        title: 'Chithha',
        contentType: 'movie',
        originalLanguage: 'ta',
        industries: ['Kollywood'],
        claimedOttReleaseDate: '2026-11-28',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'SonyLIV',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      const tradeRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-dedup-02',
        providerId: 'TRADE_DESK',
        sourceType: 'TRADE_DESK_CORROBORATED',
        sourceUrl: 'https://www.cinemaexpress.com/tamil/news/chithha-ott-date',
        sourceName: 'Cinema Express Verified Desk',
        verificationTicket: ticket,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:chithha:2026',
          evidenceId: 'ev-theat-chithha',
          closureDate: '2026-10-10',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Cinema closure complete'
        },
        verifiedClaimDetails: {
          title: 'Chithha',
          platform: 'SonyLIV',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-dedup-01',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-26T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-26T10:00:00Z',
        title: 'Chithha',
        contentType: 'movie',
        originalLanguage: 'ta',
        industries: ['Kollywood'],
        claimedOttReleaseDate: '2026-11-28', // Same date!
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'SonyLIV',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      const cand1 = registry.registerEvidenceRecord(platformRecord);
      const cand2 = registry.registerEvidenceRecord(tradeRecord);

      expect(cand1).toBe(cand2); // Single shared candidate instance
      expect(cand1.evidenceRecords.length).toBe(2);
      expect(registry.getAllCandidates().length).toBe(1);

      const summary = registry.evaluateCandidateEvidence(cand1, todayStr);
      expect(summary.hasDateConflict).toBe(false);
      expect(summary.passesToUpcomingOtt).toBe(true);

      const validation = registry.validateCandidate(cand1, todayStr);
      expect(validation.isValid).toBe(true);
      expect(validation.decision).toBe('ACCEPT_UPCOMING_OTT');
    });
  });

  describe('9. Date Precision & Imprecise Window Quarantine', () => {
    it('should quarantine MONTH_YEAR date precision (exact day unannounced) into PENDING_VALIDATION', () => {
      const monthYearRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-prec-01',
        providerId: 'ZEE5_PR',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://www.zee5.com/global/press-releases/vikrant-rona-2',
        sourceName: 'Zee5 Newsroom',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:chithha:2026',
          evidenceId: 'ev-theat-chithha',
          closureDate: '2026-10-10',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Cinema closure complete'
        },
        verifiedClaimDetails: {
          title: 'Chithha',
          platform: 'SonyLIV',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-dedup-01',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-25T10:00:00Z',
        title: 'Vikrant Rona 2',
        contentType: 'movie',
        originalLanguage: 'kn',
        industries: ['Sandalwood'],
        claimedOttReleaseDate: '2026-12', // Month precision only
        datePrecision: 'MONTH_YEAR',
        announcedPlatform: 'Zee5',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: {
          isIndiaExplicit: true,
          territoryCodes: ['IN'],
          supportsIndianRegion: true
        }
      };

      const candidate = registry.registerEvidenceRecord(monthYearRecord);
      const summary = registry.evaluateCandidateEvidence(candidate, todayStr);
      expect(summary.hasUncorroboratedDate).toBe(true);
      expect(summary.quarantineReason).toBe('IMPRECISE_OR_UNCORROBORATED_CALENDAR_DATE');
      expect(summary.passesToUpcomingOtt).toBe(false);

      const validation = registry.validateCandidate(candidate, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(validation.assignedCategory).toBe('PENDING_VALIDATION');
    });
  });

  describe('10. Phase 2.7.3 — Official Indian OTT Announcement Ingestion', () => {
    it('should successfully ingest official announcements across all 7 platforms and 5 languages', () => {
      const audit = registry.ingestOfficialAnnouncements(undefined, todayStr);

      expect(audit.totalAnnouncementsProcessed).toBeGreaterThanOrEqual(18);
      expect(audit.uniqueCandidatesDiscovered).toBeGreaterThanOrEqual(15);
      expect(audit.acceptedUpcomingOttCount).toBeGreaterThanOrEqual(3);
      expect(audit.quarantinedPendingValidationCount).toBeGreaterThanOrEqual(10);
      expect(audit.rejectedCount).toBeGreaterThanOrEqual(2);

      // Verify all 7 priority platforms are present in metrics
      const platforms = Object.keys(audit.byPlatform);
      expect(platforms).toContain('Netflix');
      expect(platforms).toContain('Prime Video');
      expect(platforms).toContain('Disney+ Hotstar');
      expect(platforms).toContain('SonyLIV');
      expect(platforms).toContain('Zee5');
      expect(platforms).toContain('Aha');
      expect(platforms).toContain('Sun NXT');

      // Verify all 5 regional + national languages are present in metrics
      const languages = Object.keys(audit.byLanguage);
      expect(languages).toContain('ta'); // Tamil
      expect(languages).toContain('te'); // Telugu
      expect(languages).toContain('ml'); // Malayalam
      expect(languages).toContain('kn'); // Kannada
      expect(languages).toContain('hi'); // Hindi
    });

    it('should preserve original announcement URL, timestamps, and exact identity', () => {
      registry.ingestOfficialAnnouncements(undefined, todayStr);
      const candidates = registry.getAllCandidates();

      // Find Madam Police (SonyLIV Tamil series)
      const madamPolice = candidates.find(c => c.title === 'Madam Police');
      expect(madamPolice).toBeDefined();
      expect(madamPolice?.contentType).toBe('tv');
      expect(madamPolice?.seasonNumber).toBe(1);
      expect(madamPolice?.originalLanguage).toBe('ta');
      expect(madamPolice?.industries).toContain('Kollywood');

      const record = madamPolice?.evidenceRecords[0];
      expect(record?.sourceUrl).toBe('https://www.sonyliv.com/press/madam-police-season-1-official-date');
      expect(record?.sourceName).toBe('SonyLIV Press Room');
      expect(record?.announcementTimestamp).toBeDefined();
      expect(record?.evidenceCaptureTimestamp).toBeDefined();
      expect(record?.territoryEvidence.supportsIndianRegion).toBe(true);
      expect(record?.territoryEvidence.territoryCodes).toContain('IN');

      const validation = registry.validateCandidate(madamPolice!, todayStr);
      expect(validation.isValid).toBe(true);
      expect(validation.decision).toBe('ACCEPT_UPCOMING_OTT');
      expect(validation.evidenceDetails.assignedPlatform).toBe('SonyLIV');
    });

    it('should quarantine date conflicts between studio and platform into PENDING_VALIDATION', () => {
      registry.ingestOfficialAnnouncements(undefined, todayStr);
      const devara = registry.getAllCandidates().find(c => c.title === 'Devara: OTT Edition');

      expect(devara).toBeDefined();
      expect(devara?.evidenceRecords.length).toBe(2);

      const summary = registry.evaluateCandidateEvidence(devara!, todayStr);
      expect(summary.hasDateConflict).toBe(true);
      expect(summary.quarantineReason).toBe('DATE_CONFLICT_DETECTED_BETWEEN_SOURCES');
      expect(summary.passesToUpcomingOtt).toBe(false);

      const validation = registry.validateCandidate(devara!, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(validation.assignedCategory).toBe('PENDING_VALIDATION');
    });

    it('should quarantine imprecise dates (Panchayat S4) into PENDING_VALIDATION', () => {
      registry.ingestOfficialAnnouncements(undefined, todayStr);
      const panchayat = registry.getAllCandidates().find(c => c.title === 'Panchayat' && c.seasonNumber === 4);

      expect(panchayat).toBeDefined();
      const summary = registry.evaluateCandidateEvidence(panchayat!, todayStr);
      expect(summary.hasUncorroboratedDate).toBe(true);
      expect(summary.quarantineReason).toBe('IMPRECISE_OR_UNCORROBORATED_CALENDAR_DATE');

      const validation = registry.validateCandidate(panchayat!, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(validation.assignedCategory).toBe('PENDING_VALIDATION');
    });

    it('should reject rental / purchase TVOD releases from subscription Upcoming OTT', () => {
      registry.ingestOfficialAnnouncements(undefined, todayStr);
      const gladiator = registry.getAllCandidates().find(c => c.title === 'Gladiator II');

      expect(gladiator).toBeDefined();
      const summary = registry.evaluateCandidateEvidence(gladiator!, todayStr);
      expect(summary.isSubscriptionConfirmed).toBe(false);
      expect(summary.rejectionReason).toBe('RENTAL_OR_PURCHASE_ONLY_NOT_SUBSCRIPTION_OTT');

      const validation = registry.validateCandidate(gladiator!, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('REJECT_UNCLASSIFIED');
      expect(validation.rejectionReason).toBe('RENTAL_OR_PURCHASE_ONLY_NOT_SUBSCRIPTION_OTT');
    });

    it('should reject overseas-only rights without Indian territory from Upcoming OTT', () => {
      registry.ingestOfficialAnnouncements(undefined, todayStr);
      const aavesham = registry.getAllCandidates().find(c => c.title.includes('Aavesham'));

      expect(aavesham).toBeDefined();
      const summary = registry.evaluateCandidateEvidence(aavesham!, todayStr);
      expect(summary.territoryVerified).toBe(false);
      expect(summary.rejectionReason).toBe('INDIAN_TERRITORY_NOT_VERIFIED_IN_ANNOUNCEMENT');

      const validation = registry.validateCandidate(aavesham!, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('REJECT_UNCLASSIFIED');
      expect(validation.rejectionReason).toBe('INDIAN_TERRITORY_NOT_VERIFIED');
    });

    it('should not treat syndicated trade press copies as independent primary corroboration', () => {
      registry.ingestOfficialAnnouncements(undefined, todayStr);
      const kantara = registry.getAllCandidates().find(c => c.title.includes('Kantara'));

      expect(kantara).toBeDefined();
      expect(kantara?.evidenceRecords.length).toBe(1);
      // Syndicated copy preserves its provenance
      expect(kantara?.evidenceRecords[0].sourceType).toBe('TRADE_DESK_CORROBORATED');
    });

    it('should convert ingested candidates to CanonicalMovie models without bucket leakage when fixtures are explicitly allowed', () => {
      registry.ingestOfficialAnnouncements(undefined, todayStr);
      // In production mode, test fixtures are quarantined by default (0 returned)
      expect(registry.toCanonicalMovies(todayStr).length).toBe(0);

      // When test fixture inclusion is explicitly requested for testing:
      const canonicalMovies = registry.toCanonicalMovies(todayStr, true);
      expect(canonicalMovies.length).toBeGreaterThanOrEqual(15);

      const upcomingOttList = canonicalMovies.filter(m => m.classification === 'UPCOMING_OTT');
      const pendingList = canonicalMovies.filter(m => m.classification === 'PENDING_VALIDATION');
      const unclassifiedList = canonicalMovies.filter(m => m.classification === 'UNCLASSIFIED');

      expect(upcomingOttList.length).toBeGreaterThanOrEqual(3);
      expect(pendingList.length).toBeGreaterThanOrEqual(8);
      expect(unclassifiedList.length).toBeGreaterThanOrEqual(2);

      // Verify mutual exclusivity across all classifications
      const ids = new Set<string>();
      let leakageCount = 0;
      for (const m of canonicalMovies) {
        if (ids.has(m.canonicalId!)) {
          leakageCount++;
        }
        ids.add(m.canonicalId!);
      }
      expect(leakageCount).toBe(0);
    });
  });

  // =========================================================================
  // Phase 2.7.3.2 — Evidence Integrity Remediation & Historical Premiere Gate
  // The 12 Mandatory Integration Test Cases
  // =========================================================================
  describe('Phase 2.7.3.2 — Evidence Integrity Remediation & Historical Premiere Gate', () => {
    // 1. Historical movie with a synthetic future date is rejected or quarantined
    it('1. should reject a historical movie with a synthetic future date via ALREADY_RELEASED_HISTORICAL_OTT', () => {
      registry.ingestTestFixtures(undefined, todayStr);
      const vijay69 = registry.getAllCandidates().find(c => c.title === 'Vijay 69');
      expect(vijay69).toBeDefined();

      const validation = registry.validateCandidate(vijay69!, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('REJECT_UNCLASSIFIED');
      expect(validation.rejectionReason).toBe('ALREADY_RELEASED_HISTORICAL_OTT');
      expect(validation.evidenceDetails.stagesPassed).toContain('STAGE_4_DATE_EVALUATION');
      expect(validation.evidenceDetails.failedStage).toBe('STAGE_4B_HISTORICAL_PREMIERE_GATE');
    });

    // 2. Historical theatrical release followed by a genuinely new Indian OTT premiere can qualify when independently evidenced
    it('2. should accept a movie with historical theatrical release followed by genuinely new Indian OTT premiere', () => {
      registry.ingestTestFixtures(undefined, todayStr);
      const subham = registry.getAllCandidates().find(c => c.title === 'Subham');
      expect(subham).toBeDefined();

      const validation = registry.validateCandidate(subham!, todayStr);
      expect(validation.isValid).toBe(true);
      expect(validation.decision).toBe('ACCEPT_UPCOMING_OTT');
      expect(validation.assignedCategory).toBe('UPCOMING_OTT');
      expect(validation.evidenceDetails.stagesPassed).toContain('STAGE_4B_HISTORICAL_PREMIERE_GATE');
    });

    // 3. Historical Season 1 does not block a genuinely new Season 2
    it('3. should accept Season 2 as Upcoming OTT when Season 1 was historically released in the past', () => {
      registry.ingestTestFixtures(undefined, todayStr);
      const ranaNaidu = registry.getAllCandidates().find(c => c.title === 'Rana Naidu' && c.seasonNumber === 2);
      expect(ranaNaidu).toBeDefined();

      const validation = registry.validateCandidate(ranaNaidu!, todayStr);
      expect(validation.isValid).toBe(true);
      expect(validation.decision).toBe('ACCEPT_UPCOMING_OTT');
      expect(validation.assignedCategory).toBe('UPCOMING_OTT');
      expect(validation.evidenceDetails.stagesPassed).toContain('STAGE_4B_HISTORICAL_PREMIERE_GATE');
    });

    // 4. Historical Season 2 cannot be presented as a new upcoming release
    it('4. should reject a historical Season 2 presented with a synthetic future date via ALREADY_RELEASED_HISTORICAL_SEASON', () => {
      registry.ingestTestFixtures(undefined, todayStr);
      const keralaCrimeFiles = registry.getAllCandidates().find(c => c.title === 'Kerala Crime Files' && c.seasonNumber === 2);
      expect(keralaCrimeFiles).toBeDefined();

      const validation = registry.validateCandidate(keralaCrimeFiles!, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('REJECT_UNCLASSIFIED');
      expect(validation.rejectionReason).toBe('ALREADY_RELEASED_HISTORICAL_SEASON');
      expect(validation.evidenceDetails.failedStage).toBe('STAGE_4B_HISTORICAL_PREMIERE_GATE');
    });

    // 5. Overseas-only release evidence cannot establish Indian OTT rights
    it('5. should reject overseas-only release evidence from establishing Indian OTT rights', () => {
      registry.ingestTestFixtures(undefined, todayStr);
      const aavesham = registry.getAllCandidates().find(c => c.title.includes('Aavesham'));
      expect(aavesham).toBeDefined();

      const validation = registry.validateCandidate(aavesham!, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('REJECT_UNCLASSIFIED');
      expect(validation.rejectionReason).toBe('INDIAN_TERRITORY_NOT_VERIFIED');
    });

    // 6. Rental/purchase cannot qualify as subscription Upcoming OTT
    it('6. should reject rental / purchase offerings from subscription Upcoming OTT', () => {
      registry.ingestTestFixtures(undefined, todayStr);
      const gladiator = registry.getAllCandidates().find(c => c.title === 'Gladiator II');
      expect(gladiator).toBeDefined();

      const validation = registry.validateCandidate(gladiator!, todayStr);
      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('REJECT_UNCLASSIFIED');
      expect(validation.rejectionReason).toBe('RENTAL_OR_PURCHASE_ONLY_NOT_SUBSCRIPTION_OTT');
    });

    // 7. Missing or fabricated source provenance cannot qualify
    it('7. should reject records with missing or fabricated source provenance', () => {
      // 7a: Missing sourceName
      expect(() => registry.registerEvidenceRecord({
        evidenceId: 'ev-invalid-src-name',
        providerId: 'INVALID_PR',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceName: '',
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Ghost Movie',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        datePrecision: 'EXACT_DATE',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      })).toThrow(/missing sourceName/);

      // 7b: Missing title
      expect(() => registry.registerEvidenceRecord({
        evidenceId: 'ev-invalid-title',
        providerId: 'INVALID_PR',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceName: 'Valid PR Desk',
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: '   ',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        datePrecision: 'EXACT_DATE',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      })).toThrow(/missing title/);

      // 7c: Unknown sourceType
      expect(() => registry.registerEvidenceRecord({
        evidenceId: 'ev-invalid-type',
        providerId: 'INVALID_PR',
        sourceType: 'UNKNOWN',
        sourceName: 'Random Rumor',
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Rumored Sequel',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        datePrecision: 'EXACT_DATE',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      })).toThrow(/sourceType cannot be UNKNOWN/);
    });

    // 8. Syndicated copies do not count as independent corroboration
    it('8. should mark syndicated trade desk copies as non-independent and hold uncorroborated dates', () => {
      registry.ingestTestFixtures(undefined, todayStr);
      const kantara = registry.getAllCandidates().find(c => c.title.includes('Kantara'));
      expect(kantara).toBeDefined();

      // Ingestion preserves single trade desk record without treating it as independent multi-source corroboration
      expect(kantara?.evidenceRecords[0].sourceType).toBe('TRADE_DESK_CORROBORATED');
      const summary = registry.evaluateCandidateEvidence(kantara!, todayStr);
      // Single trade desk without official primary or second publisher remains uncorroborated
      expect(summary.hasUncorroboratedDate).toBe(true);
    });

    // 9. Repeated ingestion does not create duplicate records (idempotency check)
    it('9. should ensure repeated ingestion of identical evidenceId is strictly idempotent', () => {
      registry.clear();
      expect(registry.getAllCandidates().length).toBe(0);

      const record: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-idempotent-01',
        providerId: 'PRIME_VIDEO_IN_OFFICIAL',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://press.amazonstudios.com/in/sample-title',
        sourceName: 'Amazon Prime Video India News',
        announcementTimestamp: '2026-10-15T08:00:00.000Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
        title: 'Idempotency Test Movie',
        contentType: 'movie',
        originalLanguage: 'ta',
        industries: ['Kollywood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Prime Video',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      // Ingest once
      const cand1 = registry.registerEvidenceRecord(record);
      expect(cand1.evidenceRecords.length).toBe(1);
      expect(registry.getAllCandidates().length).toBe(1);

      // Ingest second time with exact same evidenceId
      const cand2 = registry.registerEvidenceRecord(record);
      expect(cand2.evidenceRecords.length).toBe(1); // Evidence count MUST remain 1
      expect(registry.getAllCandidates().length).toBe(1); // Candidate count MUST remain 1

      // Re-ingest third time
      const cand3 = registry.registerEvidenceRecord(record);
      expect(cand3.evidenceRecords.length).toBe(1);
    });

    // 10. Test fixtures cannot enter production discovery
    it('10. should guarantee that quarantined test fixtures return 0 movies in production toCanonicalMovies()', () => {
      registry.clear();
      registry.ingestTestFixtures(undefined, todayStr);

      // Default production export: includeFixtures = false
      const productionMovies = registry.toCanonicalMovies(todayStr);
      expect(productionMovies.length).toBe(0); // Zero test fixtures leak into production discovery

      // Audit telemetry reflects quarantined fixtures
      const audit = registry.getIngestionAudit(todayStr);
      expect(audit.fixtureCount).toBe(25);
      expect(audit.productionAnnouncementCount).toBe(0);
      expect(audit.telemetryMode).toBe('TEST_FIXTURES');
    });

    // 11. Conflicting historical and announced dates are quarantined
    it('11. should quarantine candidates with conflicting historical and announced release dates', () => {
      const conflictingInput: OttCandidateValidationInput = {
        canonicalId: 'movie:conflict:test',
        title: 'Conflict Historical Film',
        contentType: 'movie',
        originalLanguage: 'ta',
        industries: ['Kollywood'],
        releaseEventType: 'INDIA_OTT_DIGITAL',
        claimedOttReleaseDate: '2026-11-15',
        historicalOttPremiereDate: '2026-12-01', // Conflicts with claimed date!
        ottDateConfirmed: true,
        hasIndianTerritoryEvidence: true,
        primaryPlatform: 'Netflix',
        ottPlatforms: [{
          name: 'Netflix',
          availableInIndia: true,
          verified: true,
          availabilityType: 'SUBSCRIPTION',
          availableFrom: '2026-11-15'
        }]
      };

      const result = validator.validateOttCandidate(conflictingInput, todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('HISTORICAL_PREMIERE_DATE_CONFLICT_HELD');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_4B_HISTORICAL_PREMIERE_GATE');
    });

    // 12. All six public discovery buckets remain free of invalid upcoming candidates (zero leakage)
    it('12. should verify all six public discovery categories guarantee mutual exclusivity with zero leakage', () => {
      registry.ingestTestFixtures(undefined, todayStr);
      const canonicalMovies = registry.toCanonicalMovies(todayStr, true);

      const seenIds = new Set<string>();
      let leakageCount = 0;

      for (const m of canonicalMovies) {
        if (seenIds.has(m.canonicalId!)) {
          leakageCount++;
        }
        seenIds.add(m.canonicalId!);

        // Classification must be a recognized, mutually exclusive category
        expect(['UPCOMING_THEATRICAL', 'NOW_IN_THEATERS', 'UPCOMING_OTT', 'NOW_STREAMING', 'PENDING_VALIDATION', 'UNCLASSIFIED'])
          .toContain(m.classification);
      }

      expect(leakageCount).toBe(0);
    });
  });

  // =========================================================================
  // Phase 2.7.3.4 — Evidence Ingestion & Gate Hardening Mandatory Test Scenarios
  // The 18 Mandatory Acceptance Criteria Scenarios
  // =========================================================================
  describe('Phase 2.7.3.4 — Evidence Ingestion & Gate Hardening Mandatory Test Scenarios', () => {
    let classifier: MovieClassificationService;
    let hardenedRegistry: IndianOttRegistryService;

    beforeEach(() => {
      classifier = new MovieClassificationService();
      hardenedRegistry = new IndianOttRegistryService(validator, classifier);
      hardenedRegistry.clear();
    });

    // 1. Missing historical status is quarantined (HISTORICAL_STATUS_UNVERIFIED_HELD)
    it('1. should quarantine candidate when historical verification status is missing or UNKNOWN', () => {
      const record: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-h1-missing',
        providerId: 'NETFLIX_IN_NEWSROOM',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://about.netflix.com/en/newsroom/unknown-history-title',
        sourceName: 'Netflix India Newsroom',
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Unknown History Title',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
        // Intentionally missing historicalVerificationStatus
      };

      const candidate = hardenedRegistry.registerEvidenceRecord(record);
      const validation = hardenedRegistry.validateCandidate(candidate, todayStr);

      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(validation.assignedCategory).toBe('PENDING_VALIDATION');
      expect(validation.quarantineReason).toBe('HISTORICAL_STATUS_UNVERIFIED_HELD');
      expect(validation.evidenceDetails.failedStage).toBe('STAGE_4B_HISTORICAL_PREMIERE_GATE');
    });

    // 2. Verified absence of prior Indian OTT premiere passes the historical gate (VERIFIED_NO_PRIOR_PREMIERE)
    it('2. should pass historical premiere gate when verified absence of prior Indian OTT release is established', () => {
      const ticket = hardenedRegistry.getVerificationAuthority().issueTicket('internal-auditor', 'INTERNAL_AUDITOR');
      const record: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-h2-verified-none',
        providerId: 'NETFLIX_IN_NEWSROOM',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://about.netflix.com/en/newsroom/genuinely-new-movie',
        sourceName: 'Netflix India Newsroom',
        verificationTicket: ticket,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:genuinelynewmovie:2026',
          evidenceId: 'ev-theat-h2',
          closureDate: '2026-10-01',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Closure verified'
        },
        verifiedClaimDetails: {
          title: 'Genuinely New Movie',
          platform: 'Netflix',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-20',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-h2-verified-none',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Genuinely New Movie',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      const candidate = hardenedRegistry.registerEvidenceRecord(record);
      const validation = hardenedRegistry.validateCandidate(candidate, todayStr);

      expect(validation.isValid).toBe(true);
      expect(validation.decision).toBe('ACCEPT_UPCOMING_OTT');
      expect(validation.assignedCategory).toBe('UPCOMING_OTT');
      expect(validation.evidenceDetails.stagesPassed).toContain('STAGE_4B_HISTORICAL_PREMIERE_GATE');
    });

    // 3. Confirmed previous Indian OTT premiere is rejected (ALREADY_RELEASED_HISTORICAL_OTT)
    it('3. should reject movie with CONFIRMED_PRIOR_PREMIERE via ALREADY_RELEASED_HISTORICAL_OTT', () => {
      const record: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-h3-confirmed-prior',
        providerId: 'NETFLIX_IN_NEWSROOM',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://about.netflix.com/en/newsroom/past-movie',
        sourceName: 'Netflix India Newsroom',
        historicalVerificationStatus: 'CONFIRMED_PRIOR_PREMIERE',
        historicalOttPremiereDate: '2024-05-15',
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Past Movie',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      const candidate = hardenedRegistry.registerEvidenceRecord(record);
      const validation = hardenedRegistry.validateCandidate(candidate, todayStr);

      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('REJECT_UNCLASSIFIED');
      expect(validation.rejectionReason).toBe('ALREADY_RELEASED_HISTORICAL_OTT');
      expect(validation.evidenceDetails.failedStage).toBe('STAGE_4B_HISTORICAL_PREMIERE_GATE');
    });

    // 4. Historical Season 1 does not block a new Season 2
    it('4. should accept Season 2 when Season 1 has confirmed historical premiere date', () => {
      const ticket = hardenedRegistry.getVerificationAuthority().issueTicket('internal-auditor', 'INTERNAL_AUDITOR');
      const record: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-h4-tv-s2',
        providerId: 'AMAZON_STUDIOS_IN_PRESS',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://press.amazonstudios.com/in/thriller-series-s2',
        sourceName: 'Amazon Prime Video India News',
        verificationTicket: ticket,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        verifiedClaimDetails: {
          title: 'Thriller Series',
          seasonNumber: 2,
          platform: 'Prime Video',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-25',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-h4-tv-s2',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        historicalSeasonAirDates: { 1: '2023-04-10' },
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Thriller Series',
        contentType: 'tv',
        seasonNumber: 2,
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-25',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Prime Video',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      const candidate = hardenedRegistry.registerEvidenceRecord(record);
      const validation = hardenedRegistry.validateCandidate(candidate, todayStr);

      expect(validation.isValid).toBe(true);
      expect(validation.decision).toBe('ACCEPT_UPCOMING_OTT');
      expect(validation.assignedCategory).toBe('UPCOMING_OTT');
      expect(validation.evidenceDetails.stagesPassed).toContain('STAGE_4B_HISTORICAL_PREMIERE_GATE');
    });

    // 5. Historical target season is rejected (ALREADY_RELEASED_HISTORICAL_SEASON)
    it('5. should reject Season 2 when Season 2 itself has confirmed historical premiere date', () => {
      const record: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-h5-tv-s2-past',
        providerId: 'AMAZON_STUDIOS_IN_PRESS',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://press.amazonstudios.com/in/thriller-series-s2-old',
        sourceName: 'Amazon Prime Video India News',
        historicalVerificationStatus: 'CONFIRMED_PRIOR_PREMIERE',
        historicalSeasonAirDates: { 1: '2023-04-10', 2: '2024-06-20' },
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Thriller Series',
        contentType: 'tv',
        seasonNumber: 2,
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-25',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Prime Video',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      const candidate = hardenedRegistry.registerEvidenceRecord(record);
      const validation = hardenedRegistry.validateCandidate(candidate, todayStr);

      expect(validation.isValid).toBe(false);
      expect(validation.decision).toBe('REJECT_UNCLASSIFIED');
      expect(validation.rejectionReason).toBe('ALREADY_RELEASED_HISTORICAL_SEASON');
      expect(validation.evidenceDetails.failedStage).toBe('STAGE_4B_HISTORICAL_PREMIERE_GATE');
    });

    // 6. Overseas historical availability does not block a first Indian OTT premiere
    it('6. should allow a first Indian OTT premiere even if released historically in foreign territories', () => {
      const ticket = hardenedRegistry.getVerificationAuthority().issueTicket('internal-auditor', 'INTERNAL_AUDITOR');
      const record: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-h6-overseas-past',
        providerId: 'NETFLIX_IN_NEWSROOM',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://about.netflix.com/en/newsroom/foreign-indie-film',
        sourceName: 'Netflix India Newsroom',
        verificationTicket: ticket,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:foreignindiefilmindia premiere:2026',
          evidenceId: 'ev-theat-h6',
          closureDate: '2026-10-01',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Foreign theatrical closure verified'
        },
        verifiedClaimDetails: {
          title: 'Foreign Indie Film India Premiere',
          platform: 'Netflix',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-h6-overseas-past',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        priorOverseasOttRelease: true,
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Foreign Indie Film India Premiere',
        contentType: 'movie',
        originalLanguage: 'en',
        industries: ['Hollywood'],
        claimedOttReleaseDate: '2026-11-28',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      const candidate = hardenedRegistry.registerEvidenceRecord(record);
      const validation = hardenedRegistry.validateCandidate(candidate, todayStr);

      expect(validation.isValid).toBe(true);
      expect(validation.decision).toBe('ACCEPT_UPCOMING_OTT');
      expect(validation.assignedCategory).toBe('UPCOMING_OTT');
      expect(validation.evidenceDetails.stagesPassed).toContain('STAGE_4B_HISTORICAL_PREMIERE_GATE');
    });

    // 7. Unauthorized official-source domain is rejected (Source domain authorization failure)
    it('7. should reject official source announcement from an unauthorized domain', () => {
      const record: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-h7-unauth-domain',
        providerId: 'NETFLIX_IN_NEWSROOM',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://attacker-fake-press.com/newsroom/fake-premiere',
        sourceName: 'Netflix India Newsroom',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:chithha:2026',
          evidenceId: 'ev-theat-chithha',
          closureDate: '2026-10-10',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Cinema closure complete'
        },
        verifiedClaimDetails: {
          title: 'Chithha',
          platform: 'SonyLIV',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-dedup-01',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Fake Domain Film',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      expect(() => hardenedRegistry.registerEvidenceRecord(record)).toThrow(
        /Source domain authorization failure/
      );
    });

    // 8. Lookalike domain/subdomain spoofing is rejected (evil.com suffix / fake domain)
    it('8. should reject lookalike or suffix domain spoofing attempts', () => {
      const record: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-h8-spoof-domain',
        providerId: 'NETFLIX_IN_NEWSROOM',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://netflix.com.attacker.com/newsroom/spoofed',
        sourceName: 'Netflix India Newsroom',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:chithha:2026',
          evidenceId: 'ev-theat-chithha',
          closureDate: '2026-10-10',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Cinema closure complete'
        },
        verifiedClaimDetails: {
          title: 'Chithha',
          platform: 'SonyLIV',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-dedup-01',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Spoofed Domain Film',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      expect(() => hardenedRegistry.registerEvidenceRecord(record)).toThrow(
        /Source domain authorization failure/
      );
    });

    // 9. Authorized domain with unverified page content is not treated as authenticated (isClaimContentVerified: false)
    it('9. should track unverified claim content and reflect in claim verification telemetry', () => {
      const record: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-h9-unverified-content',
        providerId: 'NETFLIX_IN_NEWSROOM',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://about.netflix.com/en/newsroom/unverified-content-page',
        sourceName: 'Netflix India Newsroom',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'SOURCE_VERIFICATION_UNKNOWN',
        isClaimContentVerified: false,
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Unverified Content Film',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      const candidate = hardenedRegistry.registerEvidenceRecord(record);
      expect(candidate.claimVerificationStatus).toBe('SOURCE_VERIFICATION_UNKNOWN');
      expect(candidate.isClaimContentVerified).toBe(false);

      const audit = hardenedRegistry.getIngestionAudit(todayStr);
      expect(audit.claimContentVerificationFailuresOrUnknowns).toBeGreaterThanOrEqual(1);
    });

    // 10. Trade syndication does not count as independent corroboration
    it('10. should not treat syndicated trade wire copies as independent corroboration', () => {
      const tradeWire1: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-h10-trade-1',
        providerId: 'TRADE_DESK',
        sourceType: 'TRADE_DESK_CORROBORATED',
        sourceUrl: 'https://www.cinemaexpress.com/trade-syndicate-item',
        sourceName: 'Cinema Express Wire',
        syndicatedWireSource: 'IANS_WIRE',
        isSyndicatedCopy: true,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:chithha:2026',
          evidenceId: 'ev-theat-chithha',
          closureDate: '2026-10-10',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Cinema closure complete'
        },
        verifiedClaimDetails: {
          title: 'Chithha',
          platform: 'SonyLIV',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-dedup-01',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Syndicated Trade Title',
        contentType: 'movie',
        originalLanguage: 'ta',
        industries: ['Kollywood'],
        claimedOttReleaseDate: '2026-11-25',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Prime Video',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      const tradeWire2: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-h10-trade-2',
        providerId: 'TRADE_DESK',
        sourceType: 'TRADE_DESK_CORROBORATED',
        sourceUrl: 'https://www.filmcompanion.in/trade-syndicate-item',
        sourceName: 'Film Companion Wire',
        syndicatedWireSource: 'IANS_WIRE',
        isSyndicatedCopy: true,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        announcementTimestamp: '2026-10-25T10:30:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Syndicated Trade Title',
        contentType: 'movie',
        originalLanguage: 'ta',
        industries: ['Kollywood'],
        claimedOttReleaseDate: '2026-11-25',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Prime Video',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      hardenedRegistry.registerEvidenceRecord(tradeWire1);
      const cand = hardenedRegistry.registerEvidenceRecord(tradeWire2);

      const summary = hardenedRegistry.evaluateCandidateEvidence(cand, todayStr);
      // Because both share IANS_WIRE, they don't form independent 2+ trade domains
      expect(summary.hasUncorroboratedDate).toBe(true);
      expect(summary.passesToUpcomingOtt).toBe(false);
    });

    // 11. Theatrical release date alone does not establish theatrical run completion (THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED)
    it('11. should quarantine candidate when past theatrical date lacks explicit run completion evidence', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'movie:theatrical:unestablished',
        title: 'Past Theatrical Film',
        contentType: 'movie',
        originalLanguage: 'ta',
        industries: ['Kollywood'],
        releaseEventType: 'INDIA_OTT_DIGITAL',
        theatricalReleaseDate: '2026-09-01', // Released in theaters in past
        theatricalStatus: 'UNKNOWN',
        theatricalRunExplicitlyEnded: false, // NOT explicitly ended
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimedOttReleaseDate: '2026-11-15',
        ottDateConfirmed: true,
        hasIndianTerritoryEvidence: true,
        primaryPlatform: 'Netflix',
        ottPlatforms: [{
          name: 'Netflix',
          availableInIndia: true,
          verified: true,
          availabilityType: 'SUBSCRIPTION',
          availableFrom: '2026-11-15'
        }]
      };

      const result = validator.validateOttCandidate(input, todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('QUARANTINE_PENDING_VALIDATION');
      expect(result.quarantineReason).toBe('THEATRICAL_STATUS_UNKNOWN_PRECEDENCE_UNESTABLISHED');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    // 12. Currently running theatrical status cannot silently bypass OTT precedence (THEATRICAL_EXHIBITION_TAKES_PRECEDENCE)
    it('12. should reject OTT candidate when movie is CURRENTLY_RUNNING in theaters', () => {
      const input: OttCandidateValidationInput = {
        canonicalId: 'movie:running:theater',
        title: 'Running In Cinema',
        contentType: 'movie',
        originalLanguage: 'ta',
        industries: ['Kollywood'],
        releaseEventType: 'INDIA_OTT_DIGITAL',
        theatricalReleaseDate: '2026-10-15',
        theatricalStatus: 'CURRENTLY_RUNNING',
        theatricalRunExplicitlyEnded: false,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimedOttReleaseDate: '2026-11-15',
        ottDateConfirmed: true,
        hasIndianTerritoryEvidence: true,
        primaryPlatform: 'Netflix',
        ottPlatforms: [{
          name: 'Netflix',
          availableInIndia: true,
          verified: true,
          availabilityType: 'SUBSCRIPTION',
          availableFrom: '2026-11-15'
        }]
      };

      const result = validator.validateOttCandidate(input, todayStr);
      expect(result.isValid).toBe(false);
      expect(result.decision).toBe('REJECT_UNCLASSIFIED');
      expect(result.rejectionReason).toBe('THEATRICAL_EXHIBITION_TAKES_PRECEDENCE');
      expect(result.evidenceDetails.failedStage).toBe('STAGE_7_CONFLICT_CHECK');
    });

    // 13. Same evidence ID and identical payload is idempotent
    it('13. should ensure repeated ingestion of identical evidence ID and identical payload is strictly idempotent', () => {
      const record: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-h13-idempotent',
        providerId: 'NETFLIX_IN_NEWSROOM',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://about.netflix.com/en/newsroom/idempotent-title',
        sourceName: 'Netflix India Newsroom',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:chithha:2026',
          evidenceId: 'ev-theat-chithha',
          closureDate: '2026-10-10',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Cinema closure complete'
        },
        verifiedClaimDetails: {
          title: 'Chithha',
          platform: 'SonyLIV',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-dedup-01',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Idempotent Title',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      const cand1 = hardenedRegistry.registerEvidenceRecord(record);
      expect(cand1.evidenceRecords.length).toBe(1);

      // Re-ingest exact same record
      const cand2 = hardenedRegistry.registerEvidenceRecord(record);
      expect(cand2).toBe(cand1);
      expect(cand2.evidenceRecords.length).toBe(1);
      expect(hardenedRegistry.getIngestionAudit(todayStr).evidencePayloadCollisions).toBe(0);
    });

    // 14. Same evidence ID and conflicting payload is quarantined (EVIDENCE_PAYLOAD_COLLISION_DETECTED)
    it('14. should detect payload collision on same evidence ID with conflicting fields and quarantine candidate', () => {
      const originalRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-h14-collision',
        providerId: 'NETFLIX_IN_NEWSROOM',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://about.netflix.com/en/newsroom/collision-title',
        sourceName: 'Netflix India Newsroom',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:chithha:2026',
          evidenceId: 'ev-theat-chithha',
          closureDate: '2026-10-10',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Cinema closure complete'
        },
        verifiedClaimDetails: {
          title: 'Chithha',
          platform: 'SonyLIV',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-dedup-01',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Collision Title',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      const conflictingRecord: StructuredOttEvidenceRecord = {
        ...originalRecord,
        claimedOttReleaseDate: '2026-12-25' // Conflicting date using same evidence ID!
      };

      const cand1 = hardenedRegistry.registerEvidenceRecord(originalRecord);
      const cand2 = hardenedRegistry.registerEvidenceRecord(conflictingRecord);

      expect(cand2).toBeDefined();
      expect(cand1.evidenceRecords.some(r => r.conflictDetails?.includes('EVIDENCE_PAYLOAD_COLLISION_DETECTED'))).toBe(true);

      const summary = hardenedRegistry.evaluateCandidateEvidence(cand1, todayStr);
      expect(summary.hasDateConflict).toBe(true);
      expect(summary.quarantineReason).toBe('EVIDENCE_PAYLOAD_COLLISION_DETECTED');
      expect(summary.passesToUpcomingOtt).toBe(false);

      const audit = hardenedRegistry.getIngestionAudit(todayStr);
      expect(audit.evidencePayloadCollisions).toBeGreaterThanOrEqual(1);
    });

    // 15. Original evidence is preserved after collision
    it('15. should preserve original evidence entry unaltered when a collision occurs', () => {
      const originalRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-h15-preserve',
        providerId: 'NETFLIX_IN_NEWSROOM',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://about.netflix.com/en/newsroom/preserve-title',
        sourceName: 'Netflix India Newsroom',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:chithha:2026',
          evidenceId: 'ev-theat-chithha',
          closureDate: '2026-10-10',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Cinema closure complete'
        },
        verifiedClaimDetails: {
          title: 'Chithha',
          platform: 'SonyLIV',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-dedup-01',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Preserve Title',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      const conflictingRecord: StructuredOttEvidenceRecord = {
        ...originalRecord,
        announcedPlatform: 'Prime Video' // Conflicting platform
      };

      hardenedRegistry.registerEvidenceRecord(originalRecord);
      hardenedRegistry.registerEvidenceRecord(conflictingRecord);

      const entry = hardenedRegistry.getIngestedEvidenceEntry('ev-h15-preserve');
      expect(entry).toBeDefined();
      expect(entry?.originalRecord.claimedOttReleaseDate).toBe('2026-11-20');
      expect(entry?.originalRecord.announcedPlatform).toBe('Netflix');
      expect(entry?.conflictingPayloads.length).toBe(1);
      expect(entry?.conflictingPayloads[0].announcedPlatform).toBe('Prime Video');
    });

    // 16. No collision path returns an undefined candidate
    it('16. should guarantee registerEvidenceRecord never returns undefined even upon payload collision', () => {
      const originalRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-h16-not-undefined',
        providerId: 'NETFLIX_IN_NEWSROOM',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://about.netflix.com/en/newsroom/not-undef-title',
        sourceName: 'Netflix India Newsroom',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:chithha:2026',
          evidenceId: 'ev-theat-chithha',
          closureDate: '2026-10-10',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR',
          notes: 'Cinema closure complete'
        },
        verifiedClaimDetails: {
          title: 'Chithha',
          platform: 'SonyLIV',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-dedup-01',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        },
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-31T05:00:00Z',
        title: 'Not Undefined Title',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-20',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      const conflictingRecord: StructuredOttEvidenceRecord = {
        ...originalRecord,
        title: 'Different Title'
      };

      const candFirst = hardenedRegistry.registerEvidenceRecord(originalRecord);
      expect(candFirst).toBeDefined();

      const candSecond = hardenedRegistry.registerEvidenceRecord(conflictingRecord);
      expect(candSecond).toBeDefined();
      expect(typeof candSecond).toBe('object');
      expect(candSecond.candidateId).toBeDefined();
    });

    // 17. No test fixture enters production discovery (toCanonicalMovies() returns 0 without fixtures)
    it('17. should guarantee 0 test fixtures enter production discovery', () => {
      hardenedRegistry.ingestTestFixtures(undefined, todayStr);

      const productionMovies = hardenedRegistry.toCanonicalMovies(todayStr);
      expect(productionMovies.length).toBe(0);

      const audit = hardenedRegistry.getIngestionAudit(todayStr);
      expect(audit.fixtureCount).toBe(25);
      expect(audit.productionAnnouncementCount).toBe(0);
    });

    // 18. All six discovery buckets remain mutually exclusive (leakageCount === 0)
    it('18. should guarantee mutual exclusivity with zero leakage across all six categories', () => {
      hardenedRegistry.ingestTestFixtures(undefined, todayStr);
      const canonicalMovies = hardenedRegistry.toCanonicalMovies(todayStr, true);

      const seen = new Set<string>();
      let leakageCount = 0;

      for (const m of canonicalMovies) {
        if (seen.has(m.canonicalId!)) {
          leakageCount++;
        }
        seen.add(m.canonicalId!);
      }

      expect(leakageCount).toBe(0);
    });
  });

  // =========================================================================
  // Phase 2.7.3.8 — Adversarial Trust Boundary & Revocation Suite (Workstream 5)
  // =========================================================================
  describe('Phase 2.7.3.8 — Adversarial Trust Boundary & Revocation Suite', () => {
    let registry: IndianOttRegistryService;
    let movieClassification: MovieClassificationService;
    const testToday = '2026-10-25';

    beforeEach(() => {
      movieClassification = new MovieClassificationService();
      registry = new IndianOttRegistryService(new OttValidatorService(), movieClassification);
    });

    const createValidBaseRecord = (id: string, title: string): StructuredOttEvidenceRecord => ({
      evidenceId: id,
      providerId: 'NETFLIX_IN_NEWSROOM',
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceUrl: `https://about.netflix.com/en/newsroom/${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-official`,
      sourceName: 'Netflix India Newsroom',
      historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
      claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
      isClaimContentVerified: true,
      theatricalRunExplicitlyEnded: true,
      verificationTicket: registry.getVerificationAuthority().issueTicket('internal-auditor', 'INTERNAL_AUDITOR'),
      verifiedTheatricalClosure: {
        candidateId: `cand:movie:${title.toLowerCase().replace(/[^a-z0-9]/g, '')}:2026`,
        evidenceId: id,
        theatricalTitle: title,
        closureDate: '2026-09-01',
        territory: 'IN',
        verifiedBy: 'INTERNAL_AUDITOR',
        notes: 'Exhibition closure verified'
      },
      verifiedClaimDetails: {
        title,
        platform: 'Netflix',
        territoryCodes: ['IN'],
        premiereDate: '2026-11-28',
        availabilityType: 'SUBSCRIPTION',
        datePrecision: 'EXACT_DATE',
        evidenceId: id,
        verifiedAt: '2026-10-25T10:00:00Z',
        verifiedBy: 'INTERNAL_VERIFIER'
      },
      announcementTimestamp: '2026-10-25T10:00:00Z',
      evidenceCaptureTimestamp: '2026-10-25T10:00:00Z',
      title,
      contentType: 'movie',
      originalLanguage: 'hi',
      industries: ['Bollywood'],
      claimedOttReleaseDate: '2026-11-28',
      datePrecision: 'EXACT_DATE',
      announcedPlatform: 'Netflix',
      availabilityType: 'SUBSCRIPTION',
      territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
    });

    // Scenario 12: Demote self-certified booleans without verified objects
    it('Scenario 12: should strip/demote raw provider self-certified trusted booleans without authoritative evidence objects', () => {
      const rawRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-adv-12',
        providerId: 'NETFLIX_IN_NEWSROOM',
        sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
        sourceUrl: 'https://about.netflix.com/en/newsroom/self-cert-movie',
        sourceName: 'Netflix India Newsroom',
        theatricalRunExplicitlyEnded: true, // Self-certified boolean without verifiedTheatricalClosure object!
        directToOttVerified: true, // Self-certified without verifiedDirectToOtt object!
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED', // Self-certified without complete verifiedClaimDetails!
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-25T10:00:00Z',
        title: 'Self Cert Movie',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-28',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      const candidate = registry.registerEvidenceRecord(rawRecord);
      expect(candidate.theatricalRunExplicitlyEnded).toBe(false);
      expect(candidate.directToOttVerified).toBe(false);
      expect(candidate.claimVerificationStatus).toBe('SOURCE_VERIFICATION_UNKNOWN');
      expect(candidate.isClaimContentVerified).toBe(false);
    });

    // Scenario 13: Demote claims from unauthorized providers even with whitelisted domain
    it('Scenario 13: should demote claim verification when provider is community submission or rumor provider', () => {
      const rumorRecord: StructuredOttEvidenceRecord = {
        evidenceId: 'ev-adv-13',
        providerId: 'REDDIT_RUMOR' as any,
        sourceType: 'COMMUNITY_SUBMISSION',
        sourceUrl: 'https://about.netflix.com/en/newsroom/rumor-post',
        sourceName: 'Social Rumor Desk',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        verifiedClaimDetails: {
          title: 'Rumor Title',
          evidenceId: 'ev-adv-13',
          platform: 'Netflix',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE'
        },
        announcementTimestamp: '2026-10-25T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-25T10:00:00Z',
        title: 'Rumor Title',
        contentType: 'movie',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        claimedOttReleaseDate: '2026-11-28',
        datePrecision: 'EXACT_DATE',
        announcedPlatform: 'Netflix',
        availabilityType: 'SUBSCRIPTION',
        territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
      };

      const candidate = registry.registerEvidenceRecord(rumorRecord);
      expect(candidate.claimVerificationStatus).toBe('SOURCE_VERIFICATION_UNKNOWN');
      expect(candidate.isClaimContentVerified).toBe(false);
    });

    // Scenario 14: Revocability of previously accepted candidate via subsequent CLAIM_CONTENT_MISMATCH
    it('Scenario 14: should revoke previously accepted Upcoming OTT candidate when subsequent CLAIM_CONTENT_MISMATCH arrives', () => {
      // 1. Ingest initial authentic record -> candidate passes
      const validRecord = createValidBaseRecord('ev-adv-14-a', 'Revocable Movie One');
      const candidate1 = registry.registerEvidenceRecord(validRecord);
      const val1 = registry.validateCandidate(candidate1, testToday);
      expect(val1.isValid).toBe(true);
      expect(val1.decision).toBe('ACCEPT_UPCOMING_OTT');

      // 2. Ingest conflicting evidence record with CLAIM_CONTENT_MISMATCH
      const mismatchRecord: StructuredOttEvidenceRecord = {
        ...validRecord,
        evidenceId: 'ev-adv-14-b',
        claimVerificationStatus: 'CLAIM_CONTENT_MISMATCH',
        announcementTimestamp: '2026-10-26T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-26T10:00:00Z'
      };
      delete mismatchRecord.verifiedClaimDetails;

      const candidate2 = registry.registerEvidenceRecord(mismatchRecord);
      expect(candidate2).toBe(candidate1);
      expect(candidate2.claimVerificationStatus).toBe('CLAIM_CONTENT_MISMATCH');

      // 3. Re-evaluation must strictly revoke previous acceptance
      const summary = registry.evaluateCandidateEvidence(candidate2, testToday);
      expect(summary.passesToUpcomingOtt).toBe(false);
      expect(summary.rejectionReason).toBe('CLAIM_CONTENT_MISMATCH_REJECTED');

      const val2 = registry.validateCandidate(candidate2, testToday);
      expect(val2.isValid).toBe(false);
      expect(val2.decision).toBe('REJECT_UNCLASSIFIED');
      expect(val2.rejectionReason).toBe('CLAIM_CONTENT_MISMATCH_REJECTED');
    });

    // Scenario 15: Revocability of previously accepted candidate via subsequent CONFIRMED_PRIOR_PREMIERE
    it('Scenario 15: should revoke previously accepted Upcoming OTT candidate when subsequent CONFIRMED_PRIOR_PREMIERE arrives', () => {
      // 1. Ingest initial authentic record -> candidate passes
      const validRecord = createValidBaseRecord('ev-adv-15-a', 'Revocable Movie Two');
      const candidate1 = registry.registerEvidenceRecord(validRecord);
      const val1 = registry.validateCandidate(candidate1, testToday);
      expect(val1.isValid).toBe(true);
      expect(val1.decision).toBe('ACCEPT_UPCOMING_OTT');

      // 2. Ingest subsequent audit record discovering prior premiere
      const priorPremiereRecord: StructuredOttEvidenceRecord = {
        ...validRecord,
        evidenceId: 'ev-adv-15-b',
        historicalVerificationStatus: 'CONFIRMED_PRIOR_PREMIERE',
        historicalOttPremiereDate: '2024-06-15',
        announcementTimestamp: '2026-10-26T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-26T10:00:00Z'
      };

      const candidate2 = registry.registerEvidenceRecord(priorPremiereRecord);
      expect(candidate2.historicalVerificationStatus).toBe('CONFIRMED_PRIOR_PREMIERE');

      // 3. Re-evaluation must strictly reject as ALREADY_RELEASED_HISTORICAL_OTT
      const val2 = registry.validateCandidate(candidate2, testToday);
      expect(val2.isValid).toBe(false);
      expect(val2.decision).toBe('REJECT_UNCLASSIFIED');
      expect(val2.rejectionReason).toBe('ALREADY_RELEASED_HISTORICAL_OTT');
    });

    // Scenario 16: Theatrical re-release revoking exhibition closure
    it('Scenario 16: should revoke theatrical closure when candidate receives a subsequent CURRENTLY_RUNNING status', () => {
      // 1. Movie had ended its theatrical run and was accepted for OTT
      const validRecord = createValidBaseRecord('ev-adv-16-a', 'ReRelease Movie');
      const candidate1 = registry.registerEvidenceRecord(validRecord);
      expect(candidate1.theatricalRunExplicitlyEnded).toBe(true);
      const val1 = registry.validateCandidate(candidate1, testToday);
      expect(val1.isValid).toBe(true);

      // 2. Movie is re-released in Indian cinemas!
      const reReleaseRecord: StructuredOttEvidenceRecord = {
        ...validRecord,
        evidenceId: 'ev-adv-16-b',
        theatricalStatus: 'CURRENTLY_RUNNING',
        theatricalReleaseDate: '2026-10-20',
        announcementTimestamp: '2026-10-26T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-26T10:00:00Z'
      };

      const candidate2 = registry.registerEvidenceRecord(reReleaseRecord);
      expect(candidate2.theatricalStatus).toBe('CURRENTLY_RUNNING');
      expect(candidate2.theatricalRunExplicitlyEnded).toBe(false);
      expect(candidate2.verifiedTheatricalClosure).toBeUndefined();

      // 3. Validation must now reject because theatrical exhibition takes precedence!
      const val2 = registry.validateCandidate(candidate2, testToday);
      expect(val2.isValid).toBe(false);
      expect(val2.decision).toBe('REJECT_UNCLASSIFIED');
      expect(val2.rejectionReason).toBe('THEATRICAL_EXHIBITION_TAKES_PRECEDENCE');
    });

    // Scenario 17: Post-acceptance revocation propagates through discovery union toCanonicalMovies()
    it('Scenario 17: should remove candidate from UPCOMING_OTT in toCanonicalMovies() upon revocation', () => {
      // Ingest valid record (production mode, isTestFixture = false)
      const validRecord = createValidBaseRecord('ev-adv-17-a', 'Production Revocable Movie');
      validRecord.isTestFixture = false;
      registry.registerEvidenceRecord(validRecord);

      let movies = registry.toCanonicalMovies(testToday);
      expect(movies.some(m => m.title === 'Production Revocable Movie' && m.classification === 'UPCOMING_OTT')).toBe(true);

      // Revoke via subsequent conflicting record
      const revokeRecord: StructuredOttEvidenceRecord = {
        ...validRecord,
        evidenceId: 'ev-adv-17-b',
        claimVerificationStatus: 'CLAIM_CONTENT_MISMATCH',
        announcementTimestamp: '2026-10-26T10:00:00Z',
        evidenceCaptureTimestamp: '2026-10-26T10:00:00Z'
      };
      delete revokeRecord.verifiedClaimDetails;
      registry.registerEvidenceRecord(revokeRecord);

      // Re-query toCanonicalMovies()
      movies = registry.toCanonicalMovies(testToday);
      expect(movies.some(m => m.title === 'Production Revocable Movie' && m.classification === 'UPCOMING_OTT')).toBe(false);
    });
  });

  // =========================================================================
  // Phase 2.7.3.12 — Critical Publication Safety Must-Fix Scenarios
  // =========================================================================
  describe('Phase 2.7.3.12 — Critical Publication Safety Must-Fix Scenarios', () => {
    let registry: IndianOttRegistryService;
    let movieClassification: MovieClassificationService;
    const testToday = '2026-10-25';

    beforeEach(() => {
      movieClassification = new MovieClassificationService();
      registry = new IndianOttRegistryService(new OttValidatorService(), movieClassification);
    });

    const createBaseRecord = (id: string, title: string): StructuredOttEvidenceRecord => ({
      evidenceId: id,
      providerId: 'NETFLIX_IN_NEWSROOM',
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceUrl: `https://about.netflix.com/en/newsroom/${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-official`,
      sourceName: 'Netflix India Newsroom',
      announcementTimestamp: '2026-10-25T10:00:00Z',
      evidenceCaptureTimestamp: '2026-10-25T10:00:00Z',
      title,
      contentType: 'movie',
      originalLanguage: 'hi',
      industries: ['Bollywood'],
      claimedOttReleaseDate: '2026-11-28',
      datePrecision: 'EXACT_DATE',
      announcedPlatform: 'Netflix',
      availabilityType: 'SUBSCRIPTION',
      territoryEvidence: { isIndiaExplicit: true, territoryCodes: ['IN'], supportsIndianRegion: true }
    });

    it('Must-Fix 1: Raw provider record with verifiedBy=INTERNAL_VERIFIER without ticket is stripped and does NOT auto-mint ticket', () => {
      const rawRecord: StructuredOttEvidenceRecord = {
        ...createBaseRecord('ev-raw-spoof-1', 'Spoofed Internal Movie'),
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedClaimDetails: {
          title: 'Spoofed Internal Movie',
          platform: 'Netflix',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-raw-spoof-1',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        }
      };

      const candidate = registry.registerEvidenceRecord(rawRecord);

      // Must be stripped to unverified defaults:
      expect(candidate.claimVerificationStatus).toBe('SOURCE_VERIFICATION_UNKNOWN');
      expect(candidate.isClaimContentVerified).toBe(false);
      expect(candidate.verifiedClaimDetails).toBeUndefined();
      expect(candidate.theatricalRunExplicitlyEnded).toBe(false);
      expect(candidate.historicalVerificationStatus).toBe('HISTORICAL_STATUS_UNKNOWN');
    });

    it('Must-Fix 2: Cross-candidate supersession across different titles is strictly rejected', () => {
      const recordA = createBaseRecord('ev-orig-a', 'Original Movie A');
      registry.registerEvidenceRecord(recordA);

      const maliciousSupersedingRecord: StructuredOttEvidenceRecord = {
        ...createBaseRecord('ev-super-b', 'Unrelated Movie B'),
        supersedesEvidenceId: 'ev-orig-a'
      };

      expect(() => {
        registry.registerEvidenceRecord(maliciousSupersedingRecord);
      }).toThrow(/Cross-candidate supersession prohibited/);
    });

    it('Must-Fix 3: Cross-provider supersession across different providers is strictly rejected', () => {
      const recordA = createBaseRecord('ev-netflix-a', 'Same Movie Title');
      registry.registerEvidenceRecord(recordA);

      const crossProviderRecord: StructuredOttEvidenceRecord = {
        ...createBaseRecord('ev-prime-b', 'Same Movie Title'),
        providerId: 'PRIME_VIDEO_IN_PRESS',
        sourceName: 'Prime Video India Newsroom',
        sourceUrl: 'https://press.amazonstudios.com/in/same-movie-title',
        supersedesEvidenceId: 'ev-netflix-a'
      };

      expect(() => {
        registry.registerEvidenceRecord(crossProviderRecord);
      }).toThrow(/Cross-provider supersession prohibited/);
    });

    it('Must-Fix 4: Official date amendment with valid supersedesEvidenceId does NOT trigger a false date conflict', () => {
      const ticket = registry.getVerificationAuthority().issueTicket('internal-auditor', 'INTERNAL_AUDITOR');
      const initialRecord: StructuredOttEvidenceRecord = {
        ...createBaseRecord('ev-initial-date', 'Amended Release Film'),
        claimedOttReleaseDate: '2026-11-15',
        verificationTicket: ticket
      };
      registry.registerEvidenceRecord(initialRecord);

      const amendmentTicket = registry.getVerificationAuthority().issueTicket('internal-auditor', 'INTERNAL_AUDITOR');
      const amendedRecord: StructuredOttEvidenceRecord = {
        ...createBaseRecord('ev-amended-date', 'Amended Release Film'),
        claimedOttReleaseDate: '2026-11-25', // Later amended date
        supersedesEvidenceId: 'ev-initial-date',
        verificationTicket: amendmentTicket
      };
      const candidate = registry.registerEvidenceRecord(amendedRecord);

      const summary = registry.evaluateCandidateEvidence(candidate, testToday);
      expect(summary.hasDateConflict).toBe(false);
      expect(summary.confirmedDate).toBe('2026-11-25');
    });

    it('Must-Fix 5: Retraction of evidence record clears candidate verified claim details and excludes from UPCOMING_OTT', () => {
      const ticket = registry.getVerificationAuthority().issueTicket('internal-auditor', 'INTERNAL_AUDITOR');
      const record: StructuredOttEvidenceRecord = {
        ...createBaseRecord('ev-to-retract', 'Retractable Film'),
        verificationTicket: ticket,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedTheatricalClosure: {
          candidateId: 'cand:movie:retractablefilm:2026',
          evidenceId: 'ev-to-retract',
          theatricalTitle: 'Retractable Film',
          closureDate: '2026-09-01',
          territory: 'IN',
          verifiedBy: 'INTERNAL_AUDITOR'
        },
        verifiedClaimDetails: {
          title: 'Retractable Film',
          platform: 'Netflix',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-to-retract',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        }
      };
      record.isTestFixture = false;
      registry.registerEvidenceRecord(record);

      let movies = registry.toCanonicalMovies(testToday);
      expect(movies.some(m => m.title === 'Retractable Film' && m.classification === 'UPCOMING_OTT')).toBe(true);

      // Now retract the evidence record with valid ticket
      const retractTicket = registry.getVerificationAuthority().issueTicket('sec-lead', 'REGISTRY_SUPERVISOR');
      const updatedCandidate = registry.retractEvidenceRecord(retractTicket, 'ev-to-retract', 'Official retraction by distributor');

      expect(updatedCandidate.verifiedClaimDetails).toBeUndefined();
      expect(updatedCandidate.isClaimContentVerified).toBe(false);

      movies = registry.toCanonicalMovies(testToday);
      expect(movies.some(m => m.title === 'Retractable Film' && m.classification === 'UPCOMING_OTT')).toBe(false);
    });

    it('Must-Fix 6: TV series with float season (e.g. 1.5) is rejected at registry ingestion', () => {
      const invalidTvRecord: StructuredOttEvidenceRecord = {
        ...createBaseRecord('ev-float-season', 'Broken TV Series'),
        contentType: 'tv',
        seasonNumber: 1.5 as any
      };

      expect(() => {
        registry.registerEvidenceRecord(invalidTvRecord);
      }).toThrow(/must specify a valid integer seasonNumber/);
    });

    it('Must-Fix 7: Subscription withdrawal by model replacement (RENTAL) supersedes prior subscription and clears verified claims', () => {
      const ticket = registry.getVerificationAuthority().issueTicket('internal-auditor', 'INTERNAL_AUDITOR');
      const initialRecord: StructuredOttEvidenceRecord = {
        ...createBaseRecord('ev-sub-offer', 'Rental Replaced Film'),
        verificationTicket: ticket,
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        theatricalRunExplicitlyEnded: true,
        verifiedClaimDetails: {
          title: 'Rental Replaced Film',
          platform: 'Netflix',
          territoryCodes: ['IN'],
          premiereDate: '2026-11-28',
          availabilityType: 'SUBSCRIPTION',
          datePrecision: 'EXACT_DATE',
          evidenceId: 'ev-sub-offer',
          verifiedAt: '2026-10-25T10:00:00Z',
          verifiedBy: 'INTERNAL_VERIFIER'
        }
      };
      registry.registerEvidenceRecord(initialRecord);

      // Provider updates offering to TVOD RENTAL
      const rentalRecord: StructuredOttEvidenceRecord = {
        ...createBaseRecord('ev-rental-offer', 'Rental Replaced Film'),
        availabilityType: 'RENTAL'
      };
      const candidate = registry.registerEvidenceRecord(rentalRecord);

      expect(candidate.verifiedClaimDetails).toBeUndefined();
      expect(candidate.isClaimContentVerified).toBe(false);
      const summary = registry.evaluateCandidateEvidence(candidate, testToday);
      expect(summary.isSubscriptionConfirmed).toBe(false);
      expect(summary.passesToUpcomingOtt).toBe(false);
    });
  });
});

