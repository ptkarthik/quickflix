import { ReleaseDiscoveryService } from './release-discovery.service';
import { MovieClassificationService } from './movie-classification.service';
import { TmdbProvider } from '../providers/tmdb.provider';
import { MovieArtworkService } from '../../creative/artwork.service';
import { OttValidatorService } from './ott-validator.service';
import { IndianOttRegistryService } from './indian-ott-registry.service';
import { EvidenceVerificationAuthorityService } from './evidence-verification-authority.service';

describe('ReleaseDiscoveryService - Content Classification Pipeline', () => {
  let service: ReleaseDiscoveryService;
  let classificationService: MovieClassificationService;
  let tmdbProvider: TmdbProvider;
  let mockArtworkService: any;
  let mockTheatricalValidator: any;
  let ottValidator: OttValidatorService;
  let authority: EvidenceVerificationAuthorityService;
  let registry: IndianOttRegistryService;

  beforeEach(() => {
    authority = new EvidenceVerificationAuthorityService();
    classificationService = new MovieClassificationService();
    tmdbProvider = new TmdbProvider();
    ottValidator = new OttValidatorService(authority);
    registry = new IndianOttRegistryService(ottValidator, classificationService, authority);
    mockArtworkService = {
      discoverSourceArtwork: jest.fn().mockResolvedValue({ candidates: [] }),
    };
    mockTheatricalValidator = {
      verifyTheatricalStatus: jest.fn().mockResolvedValue({
        isVerifiedUpcoming: true,
        isConfirmedReleased: false,
        isDateConflict: false,
        sourcesChecked: ['TMDB']
      })
    };

    service = new ReleaseDiscoveryService(
      tmdbProvider,
      mockArtworkService,
      classificationService,
      mockTheatricalValidator,
      ottValidator,
      registry
    );
  });

  it('should discover and classify movies into mutually exclusive tabs with zero leakage', async () => {
    const response = await service.discoverAll();

    expect(response).toBeDefined();
    expect(response.upcomingTheater).toBeInstanceOf(Array);
    expect(response.nowInTheater).toBeInstanceOf(Array);
    expect(response.upcomingOTT).toBeInstanceOf(Array);
    expect(response.nowStreaming).toBeInstanceOf(Array);
    expect(response.pendingValidation).toBeInstanceOf(Array);

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. INVARIANT CHECK: Zero cross-tab overlap (Mutual Exclusivity)
    const upcomingTheaterIds = new Set(response.upcomingTheater.map(m => m.canonicalId));
    const nowInTheaterIds = new Set(response.nowInTheater.map(m => m.canonicalId));
    const upcomingOttIds = new Set(response.upcomingOTT.map(m => m.canonicalId));
    const nowStreamingIds = new Set(response.nowStreaming.map(m => m.canonicalId));

    // Overlap checks
    const theaterAndOttStreamingOverlap = [...nowInTheaterIds].filter(id => nowStreamingIds.has(id));
    expect(theaterAndOttStreamingOverlap).toEqual([]);

    const upcomingTheaterAndRunningOverlap = [...upcomingTheaterIds].filter(id => nowInTheaterIds.has(id));
    expect(upcomingTheaterAndRunningOverlap).toEqual([]);

    const upcomingOttAndStreamingOverlap = [...upcomingOttIds].filter(id => nowStreamingIds.has(id));
    expect(upcomingOttAndStreamingOverlap).toEqual([]);

    const upcomingTheaterAndOttOverlap = [...upcomingTheaterIds].filter(id => upcomingOttIds.has(id));
    expect(upcomingTheaterAndOttOverlap).toEqual([]);

    // 2. TAB 1: Upcoming in Theaters
    for (const movie of response.upcomingTheater) {
      expect(movie.classification).toBe('UPCOMING_THEATRICAL');
      if (movie.theatricalRelease) {
        expect(movie.theatricalRelease > todayStr).toBe(true);
      }
    }

    // 3. TAB 2: Now in Theaters
    for (const movie of response.nowInTheater) {
      expect(movie.classification).toBe('NOW_IN_THEATERS');
      if (movie.theatricalRelease) {
        expect(movie.theatricalRelease <= todayStr).toBe(true);
      }
    }

    // 4. TAB 3: Upcoming OTT
    for (const movie of response.upcomingOTT) {
      expect(movie.classification).toBe('UPCOMING_OTT');
      if (movie.ottRelease) {
        expect(movie.ottRelease > todayStr).toBe(true);
      }
    }

    // 5. TAB 4: Now Streaming
    for (const movie of response.nowStreaming) {
      expect(movie.classification).toBe('NOW_STREAMING');
      // Must have platform info or watch link
      expect(movie.primaryPlatform || movie.ottPlatforms?.length || movie.watchUrl).toBeDefined();
    }

    // 6. AUDIT CHECK: Invariant flag verified
    expect(response.audit.classificationEngine.active).toBe(true);
    expect(response.audit.classificationEngine.leakageDetections).toBe(0);
    expect(response.audit.classificationEngine.mutualExclusivityGuaranteed).toBe(true);
  });

  it('should support TV series discovery with type-aware canonical identities and zero movie-TV collisions', async () => {
    // Mock discoverAllRaw to return a movie with ID 500
    jest.spyOn(tmdbProvider, 'discoverAllRaw').mockResolvedValue({
      results: [
        {
          canonicalId: 'tmdb:500',
          tmdbId: 500,
          title: 'Movie 500',
          year: 2026,
          originalLanguage: 'ta',
          industries: ['Kollywood'],
          theatricalRelease: '2026-11-20',
          theatricalStatus: 'UPCOMING',
          ottPlatforms: [],
          ottDateConfirmed: false,
          isDirectToOtt: false,
          sources: ['TMDB']
        } as any
      ],
      rawMap: new Map([['500', { poster_path: '/movie500.jpg' }]])
    } as any);

    // Mock discoverUpcomingTvSeries to return a TV series with the SAME numeric ID 500
    jest.spyOn(tmdbProvider, 'discoverUpcomingTvSeries').mockResolvedValue([
      {
        canonicalId: 'tmdb:tv:500',
        tmdbId: 500,
        title: 'TV Series 500',
        seasonNumber: 1,
        year: 2026,
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        contentType: 'tv',
        seasonNumber: 1,
        theatricalRelease: undefined,
        theatricalStatus: 'UNKNOWN',
        ottRelease: '2026-11-25',
        ottDateConfirmed: true,
        isDirectToOtt: true,
        ottPlatforms: [{
          name: 'Netflix',
          availableInIndia: true,
          verified: true,
          availabilityType: 'SUBSCRIPTION',
          availableFrom: '2026-11-25'
        }],
        primaryPlatform: 'Netflix',
        classification: 'UPCOMING_OTT',
        historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
        directToOttVerified: true,
        claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
        isClaimContentVerified: true,
        verifiedClaimTitle: 'TV Series 500',
        verifiedClaimSeasonNumber: 1,
        verifiedClaimTerritories: ['IN'],
        verifiedClaimAvailability: 'SUBSCRIPTION',
        verifiedClaimDatePrecision: 'EXACT_DATE',
        verifiedClaimDate: '2026-11-25',
        verifiedClaimPlatform: 'Netflix',
        verifiedEvidenceId: 'ev-tv-500',
        sources: ['TMDB:TV']
      } as any
    ]);

    const res = await service.discoverAll();

    // 1. Both movie and TV series must be preserved without collision
    const movieItem = res.upcomingTheater.find(m => m.canonicalId === 'tmdb:500');
    const tvItem = res.upcomingOTT.find(m => m.canonicalId === 'tmdb:tv:500');

    expect(movieItem).toBeDefined();
    expect(movieItem?.title).toBe('Movie 500');
    expect(movieItem?.classification).toBe('UPCOMING_THEATRICAL');

    expect(tvItem).toBeDefined();
    expect(tvItem?.title).toBe('TV Series 500');
    expect(tvItem?.contentType).toBe('tv');
    expect(tvItem?.classification).toBe('UPCOMING_OTT');

    // 2. Canonical IDs are distinct
    expect(movieItem?.canonicalId).not.toBe(tvItem?.canonicalId);

    // 3. Mutual exclusivity holds
    expect(res.audit.classificationEngine.mutualExclusivityGuaranteed).toBe(true);
    expect(res.audit.classificationEngine.leakageDetections).toBe(0);
  });

  describe('Phase 2.6: Shared OTT Validation Safety Gate Integration', () => {
    it('should reject foreign linear TV broadcasts (e.g. BBC One, tvN, Tokyo MX) from entering Upcoming OTT', async () => {
      jest.spyOn(tmdbProvider, 'discoverAllRaw').mockResolvedValue({ results: [], rawMap: new Map() } as any);
      jest.spyOn(tmdbProvider, 'discoverUpcomingTvSeries').mockResolvedValue([
        {
          canonicalId: 'tmdb:tv:336997',
          tmdbId: 336997,
          title: 'Trauma: My Broken Brain',
          contentType: 'tv',
          seasonNumber: 1,
          year: 2026,
          originalLanguage: 'en',
          industries: ['Hollywood'],
          theatricalRelease: undefined,
          theatricalStatus: 'UNKNOWN',
          ottRelease: '2026-10-26',
          ottDateConfirmed: false,
          isDirectToOtt: false,
          ottPlatforms: [],
          classification: 'UNCLASSIFIED',
          releaseEventType: 'LINEAR_TV_BROADCAST',
          originalNetworks: ['BBC One'],
          broadcastAirDate: '2026-10-26',
          hasIndianTerritoryEvidence: false,
          sources: ['TMDB:TV']
        } as any,
        {
          canonicalId: 'tmdb:tv:335951',
          tmdbId: 335951,
          title: 'Summer Vacation',
          contentType: 'tv',
          seasonNumber: 1,
          year: 2026,
          originalLanguage: 'ko',
          industries: ['Other'],
          theatricalRelease: undefined,
          theatricalStatus: 'UNKNOWN',
          ottRelease: '2026-10-26',
          ottDateConfirmed: false,
          isDirectToOtt: false,
          ottPlatforms: [],
          classification: 'UNCLASSIFIED',
          releaseEventType: 'LINEAR_TV_BROADCAST',
          originalNetworks: ['tvN'],
          broadcastAirDate: '2026-10-26',
          hasIndianTerritoryEvidence: false,
          sources: ['TMDB:TV']
        } as any
      ]);

      const res = await service.discoverAll('2026-10-24');

      // Neither BBC One nor tvN show should be in Upcoming OTT!
      const upcomingOttTitles = res.upcomingOTT.map(m => m.title);
      expect(upcomingOttTitles).not.toContain('Trauma: My Broken Brain');
      expect(upcomingOttTitles).not.toContain('Summer Vacation');

      // Both should be in unclassified
      const unclassifiedTitles = res.unclassified.map(m => m.title);
      expect(unclassifiedTitles).toContain('Trauma: My Broken Brain');
      expect(unclassifiedTitles).toContain('Summer Vacation');

      // Mutual exclusivity guaranteed
      expect(res.audit.classificationEngine.mutualExclusivityGuaranteed).toBe(true);
    });

    it('should accept confirmed future Indian digital release with unknown platform as Platform TBA', async () => {
      jest.spyOn(tmdbProvider, 'discoverAllRaw').mockResolvedValue({
        results: [
          {
            canonicalId: 'tmdb:1500645',
            tmdbId: 1500645,
            title: 'Possible Love',
            year: 2026,
            originalLanguage: 'ta',
            industries: ['Kollywood'],
            theatricalRelease: undefined,
            theatricalStatus: 'NOT_APPLICABLE',
            ottRelease: '2026-11-06',
            ottDateConfirmed: true,
            isDirectToOtt: true,
            directToOttVerified: true,
            ottPlatforms: [], // Platform unknown/TBA
            classification: 'UPCOMING_OTT',
            releaseEventType: 'INDIA_OTT_DIGITAL',
            hasIndianTerritoryEvidence: true,
            evidenceSource: 'TMDB_IN_DIGITAL_RELEASE',
            historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
            claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
            isClaimContentVerified: true,
            verifiedClaimTitle: 'Possible Love',
            verifiedClaimTerritories: ['IN'],
            verifiedClaimAvailability: 'SUBSCRIPTION',
            sources: ['TMDB']
          } as any
        ],
        rawMap: new Map()
      } as any);
      jest.spyOn(tmdbProvider, 'discoverUpcomingTvSeries').mockResolvedValue([]);

      const res = await service.discoverAll('2026-10-24');

      const item = res.upcomingOTT.find(m => m.canonicalId === 'tmdb:1500645');
      expect(item).toBeDefined();
      expect(item?.classification).toBe('UPCOMING_OTT');
      expect(item?.primaryPlatform).toBe('Platform TBA');
      expect(item?.streamingStatus).toContain('Coming to OTT 6 Nov 2026');
    });

    it('should quarantine all curated TV series with unconfirmed dates into pendingValidation and none into upcomingOTT', async () => {
      // Use real curated TV offline fallback
      const res = await service.discoverAll('2026-10-24');

      const curatedTitles = [
        'The Family Man',
        'Panchayat',
        'Asur',
        'Scam 2010: The Subrata Roy Saga',
        'Made in Heaven',
        'Rana Naidu',
        'Kohhra',
        'Stranger Things',
        'Squid Game'
      ];

      const upcomingOttTitles = res.upcomingOTT.map(m => m.title);
      const pendingValidationTitles = res.pendingValidation.map(m => m.title);

      for (const title of curatedTitles) {
        expect(upcomingOttTitles).not.toContain(title);
        expect(pendingValidationTitles).toContain(title);
      }

      // Check quarantine reason for curated items
      const familyMan = res.pendingValidation.find(m => m.title === 'The Family Man');
      expect(familyMan).toBeDefined();
      expect(familyMan?.classification).toBe('PENDING_VALIDATION');
      expect(familyMan?.streamingStatus).toContain('Pending Verification: Date Held');

      // Mutual exclusivity remains guaranteed
      expect(res.audit.classificationEngine.mutualExclusivityGuaranteed).toBe(true);
      expect(res.audit.classificationEngine.leakageDetections).toBe(0);
    });

    it('should strictly preserve public GET /discover/all response contract shape', async () => {
      const res = await service.discoverAll('2026-10-24');

      // All 6 required category arrays must be present
      expect(Array.isArray(res.upcomingTheater)).toBe(true);
      expect(Array.isArray(res.nowInTheater)).toBe(true);
      expect(Array.isArray(res.upcomingOTT)).toBe(true);
      expect(Array.isArray(res.nowStreaming)).toBe(true);
      expect(Array.isArray(res.pendingValidation)).toBe(true);
      expect(Array.isArray(res.unclassified)).toBe(true);

      // Audit structure must be preserved
      expect(res.audit).toBeDefined();
      expect(res.audit.classificationEngine).toBeDefined();
      expect(typeof res.audit.classificationEngine.upcomingTheaterCount).toBe('number');
      expect(typeof res.audit.classificationEngine.upcomingOTTCount).toBe('number');
      expect(typeof res.audit.classificationEngine.nowStreamingCount).toBe('number');
      expect(res.audit.classificationEngine.mutualExclusivityGuaranteed).toBe(true);
    });

    it('should quarantine synthetic test fixtures and prevent them from entering production discovery (Phase 2.7.3.2)', async () => {
      const ottReg = new IndianOttRegistryService(ottValidator);
      ottReg.ingestTestFixtures(undefined, '2026-10-31');
      const serviceWithRegistry = new ReleaseDiscoveryService(
        tmdbProvider,
        mockArtworkService,
        classificationService,
        mockTheatricalValidator,
        ottValidator,
        ottReg
      );

      const res = await serviceWithRegistry.discoverAll('2026-10-31');

      // Zero leakage across all 6 buckets
      expect(res.audit.classificationEngine.mutualExclusivityGuaranteed).toBe(true);
      expect(res.audit.classificationEngine.leakageDetections).toBe(0);

      // Upcoming in Theaters remains frozen and untouched
      expect(Array.isArray(res.upcomingTheater)).toBe(true);

      // Strict quarantine: synthetic test fixtures MUST NOT enter production upcomingOTT
      const upcomingOttTitles = res.upcomingOTT.map(m => m.title);
      expect(upcomingOttTitles).not.toContain('Madam Police');
      expect(upcomingOttTitles).not.toContain("Notebook 90's");
      expect(upcomingOttTitles).not.toContain('Mr & Mrs Office');
      expect(upcomingOttTitles).not.toContain('Octopus');
      expect(upcomingOttTitles).not.toContain('Lubber Pandhu');
      expect(upcomingOttTitles).not.toContain('Vijay 69');
      expect(upcomingOttTitles).not.toContain('Dabba Cartel');
      expect(upcomingOttTitles).not.toContain('Gladiator II');
    });
  });
});
