import { Test, TestingModule } from '@nestjs/testing';
import { CoverageAuditService } from './coverage-audit.service';
import { ReleaseDiscoveryService } from './release-discovery.service';
import { TheatricalValidatorService } from './theatrical-validator.service';
import { TmdbProvider } from '../providers/tmdb.provider';
import { OmdbProvider } from '../providers/omdb.provider';
import { ImdbCrosscheckProvider } from '../providers/imdb-crosscheck.provider';

describe('CoverageAuditService', () => {
  let service: CoverageAuditService;

  const mockReleaseDiscovery = {
    discoverAll: jest.fn().mockResolvedValue({
      upcomingTheater: [
        {
          canonicalId: 'tmdb:101',
          title: 'Ramayana: Part 1',
          year: 2026,
          originalLanguage: 'hi',
          theatricalRelease: '2026-11-05',
          classification: 'UPCOMING_THEATRICAL',
          sources: ['TMDB']
        },
        {
          canonicalId: 'tmdb:102',
          title: 'Coolie',
          year: 2026,
          originalLanguage: 'ta',
          theatricalRelease: '2026-11-05',
          classification: 'UPCOMING_THEATRICAL',
          sources: ['TMDB']
        }
      ],
      nowInTheater: [
        {
          canonicalId: 'tmdb:201',
          title: 'War 2',
          year: 2026,
          theatricalRelease: '2026-09-12',
          classification: 'NOW_IN_THEATERS',
          sources: ['TMDB']
        }
      ],
      upcomingOTT: [],
      nowStreaming: [],
      pendingValidation: [
        {
          canonicalId: 'tmdb:301',
          title: 'Alpha',
          year: 2026,
          theatricalRelease: '2026-12-25',
          classification: 'PENDING_VALIDATION',
          sources: ['TMDB']
        }
      ],
      unclassified: [],
      audit: {}
    })
  };

  const mockTheatricalValidator = {
    verifyTheatricalStatus: jest.fn()
  };

  const mockTmdb = {
    discoverAllRaw: jest.fn()
  };

  const mockOmdb = {
    getByTitle: jest.fn().mockResolvedValue({ isValid: false }),
    getByImdbId: jest.fn().mockResolvedValue({ isValid: false })
  };

  const mockImdb = {
    findMatch: jest.fn().mockResolvedValue({ matched: false })
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoverageAuditService,
        { provide: ReleaseDiscoveryService, useValue: mockReleaseDiscovery },
        { provide: TheatricalValidatorService, useValue: mockTheatricalValidator },
        { provide: TmdbProvider, useValue: mockTmdb },
        { provide: OmdbProvider, useValue: mockOmdb },
        { provide: ImdbCrosscheckProvider, useValue: mockImdb }
      ]
    }).compile();

    service = module.get<CoverageAuditService>(CoverageAuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should run a complete coverage audit identifying missing trade benchmark titles', async () => {
    const report = await service.runAudit('2026-10-24');

    expect(report).toBeDefined();
    expect(report.summary.totalTradeBenchmarkTitlesChecked).toBeGreaterThan(15);
    expect(report.missingTitles.length).toBeGreaterThan(0);

    // Alpha was returned in pendingValidation -> should be identified as FOUND_BUT_QUARANTINED
    const alphaResult = report.missingTitles.find(m => m.title === 'Alpha');
    expect(alphaResult).toBeDefined();
    expect(alphaResult?.gapType).toBe('FOUND_BUT_QUARANTINED');

    // SSMB29 was not in the mock list at all -> should be identified as COMPLETELY_MISSED_BY_TMDB
    const ssmb29Result = report.missingTitles.find(m => m.title === 'SSMB29');
    expect(ssmb29Result).toBeDefined();
    expect(ssmb29Result?.gapType).toBe('COMPLETELY_MISSED_BY_TMDB');

    // Zero false positives because mock upcoming titles are in future
    expect(report.falsePositives.length).toBe(0);

    // Should include prioritized P0, P1, P2 recommendations
    expect(report.recommendations.some(r => r.priority === 'P0')).toBe(true);
    expect(report.recommendations.some(r => r.priority === 'P1')).toBe(true);
  });

  // REGRESSION TEST 1: Past TMDB date without independent exhibition evidence is quarantined
  it('Regression 1: should quarantine a past TMDB date without independent exhibition evidence as UNCORROBORATED_STALE_DATE', async () => {
    mockReleaseDiscovery.discoverAll.mockResolvedValueOnce({
      upcomingTheater: [],
      nowInTheater: [],
      upcomingOTT: [],
      nowStreaming: [],
      pendingValidation: [],
      unclassified: [
        {
          canonicalId: 'tmdb:999',
          title: 'Ramayana: Part 1',
          theatricalRelease: '2026-10-10', // Past date relative to 2026-10-24
          classification: 'UNCLASSIFIED',
          sources: ['TMDB']
        }
      ],
      audit: {}
    });

    // Mock independent provider returns no corroboration
    mockImdb.findMatch.mockResolvedValueOnce({ matched: false });
    mockOmdb.getByTitle.mockResolvedValueOnce({ isValid: false });

    const report = await service.runAudit('2026-10-24');

    const item = report.pendingValidationAudit.find(i => i.title === 'Ramayana: Part 1');
    expect(item).toBeDefined();
    expect(item?.status).toBe('UNCORROBORATED_STALE_DATE');
    expect(item?.evidenceSource).toBe('NONE');
    expect(item?.evidenceConfidence).toBe('UNVERIFIED');
    expect(report.summary.uncorroboratedStaleDateCount).toBeGreaterThanOrEqual(1);

    // Must NOT be classified as ALREADY_RELEASED_EXCLUDED_FROM_UPCOMING
    const falseReleased = report.nowInTheatersAudit.find(i => i.title === 'Ramayana: Part 1');
    expect(falseReleased).toBeUndefined();
  });

  // REGRESSION TEST 2: Corroborated released title excluded from Upcoming without auto-discovery in Now in Theaters
  it('Regression 2: should classify a corroborated released title as excluded from Upcoming without automatically counting as discovered in Now in Theaters', async () => {
    mockReleaseDiscovery.discoverAll.mockResolvedValueOnce({
      upcomingTheater: [],
      nowInTheater: [], // NOT present in nowInTheater
      upcomingOTT: [],
      nowStreaming: [],
      pendingValidation: [],
      unclassified: [
        {
          canonicalId: 'tmdb:555',
          title: 'Jailer 2',
          theatricalRelease: '2026-10-15', // Past date
          classification: 'UNCLASSIFIED',
          sources: ['TMDB']
        }
      ],
      audit: {}
    });

    // Mock independent provider corroborates release metadata
    mockImdb.findMatch.mockResolvedValueOnce({ matched: true, imdbId: 'tt1234567' });
    mockOmdb.getByImdbId.mockResolvedValueOnce({
      isValid: true,
      releasedDate: '2026-10-15',
      title: 'Jailer 2'
    });

    const report = await service.runAudit('2026-10-24');

    const item = report.nowInTheatersAudit.find(i => i.title === 'Jailer 2');
    expect(item).toBeDefined();
    expect(item?.status).toBe('ALREADY_RELEASED_EXCLUDED_FROM_UPCOMING');
    // POINT 2: Re-labeled as OMDB_RELEASE_METADATA with MEDIUM confidence
    expect(item?.evidenceSource).toBe('OMDB_RELEASE_METADATA');
    expect(item?.evidenceConfidence).toBe('MEDIUM');
    expect(item?.isExcludedFromUpcoming).toBe(true);
    expect(item?.isCandidateForNowInTheaters).toBe(true);
    expect(item?.isActuallyDiscoveredInNowInTheaters).toBe(false);

    // Summary counts must clearly distinguish candidate from actual discovery
    expect(report.summary.nowInTheatersCandidateCount).toBe(1);
    expect(report.summary.nowInTheatersActualDiscoveredCount).toBe(0);
    expect(report.summary.alreadyReleasedExcludedFromUpcomingCount).toBe(1);
  });

  // REGRESSION TEST 3: Calendar date arithmetic and 45-day / 46-day boundary
  it('Regression 3: should handle the 45-day and 46-day boundary accurately with normalized calendar date arithmetic', async () => {
    // Audit reference date: 2026-10-24
    // 45 days ago: 2026-09-09
    // 46 days ago: 2026-09-08
    expect(service.calculateCalendarDaysDiff('2026-09-09', '2026-10-24')).toBe(45);
    expect(service.calculateCalendarDaysDiff('2026-09-08', '2026-10-24')).toBe(46);

    // Test title 1: Exactly 45 days ago -> Candidate for Now in Theaters
    // Test title 2: Exactly 46 days ago -> Past release archived
    mockReleaseDiscovery.discoverAll.mockResolvedValueOnce({
      upcomingTheater: [],
      nowInTheater: [],
      upcomingOTT: [],
      nowStreaming: [],
      pendingValidation: [],
      unclassified: [
        {
          canonicalId: 'tmdb:45d',
          title: 'Ramayana: Part 1',
          theatricalRelease: '2026-09-09',
          classification: 'UNCLASSIFIED',
          sources: ['TMDB']
        },
        {
          canonicalId: 'tmdb:46d',
          title: 'Love & War',
          theatricalRelease: '2026-09-08',
          classification: 'UNCLASSIFIED',
          sources: ['TMDB']
        }
      ],
      audit: {}
    });

    // Independent provider corroborates both releases
    mockImdb.findMatch.mockResolvedValue({ matched: true, imdbId: 'tt_mock' });
    mockOmdb.getByImdbId
      .mockResolvedValueOnce({ isValid: true, releasedDate: '2026-09-09' })
      .mockResolvedValueOnce({ isValid: true, releasedDate: '2026-09-08' });

    const report = await service.runAudit('2026-10-24');

    // 45 days: Candidate in nowInTheatersAudit
    const candidate45 = report.nowInTheatersAudit.find(i => i.title === 'Ramayana: Part 1');
    expect(candidate45).toBeDefined();
    expect(candidate45?.releaseAgeDays).toBe(45);
    expect(candidate45?.isCandidateForNowInTheaters).toBe(true);

    // 46 days: Archived in pastReleaseExclusionAudit
    const archived46 = report.pastReleaseExclusionAudit.find(i => i.title === 'Love & War');
    expect(archived46).toBeDefined();
    expect(archived46?.releaseAgeDays).toBe(46);
    expect(archived46?.isCandidateForNowInTheaters).toBe(false);
  });

  // REGRESSION TEST 4: Missing Indian release date excluded from verified-future denominator
  it('Regression 4: should exclude MISSING_INDIAN_RELEASE_DATE from the verified-future denominator and assert exact metrics', async () => {
    // Controlled fixture:
    // 1 verified future release in upcomingTheater: Ramayana: Part 1 (2026-11-05)
    // 1 missing Indian date in unclassified: Vishwambhara (theatricalRelease: undefined)
    // All 20 other benchmark titles in unclassified without theatricalRelease
    const mockUnclassified = [
      { canonicalId: 'tmdb:vishwambhara', title: 'Vishwambhara', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm2', title: 'Love & War', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm3', title: 'Spirit', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm4', title: 'Alpha', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm5', title: 'Dhurandhar', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm6', title: 'King', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm7', title: 'Coolie', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm8', title: 'Jailer 2', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm9', title: 'OM Chapter 1: Udhiram', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm10', title: 'Arasan', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm11', title: '7G Rainbow Colony 2', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm13', title: 'SSMB29', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm14', title: 'RC 17', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm15', title: 'Ranabaali', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm16', title: 'HIT: The Fourth Case', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm17', title: 'Toxic: A Fairy Tale for Grown-ups', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm18', title: 'Kantara: Chapter 1', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm19', title: "Bachelor Party D'eux", classification: 'UNCLASSIFIED' },
      { canonicalId: 'm20', title: 'Titans', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm21', title: 'Avengers: Doomsday', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm22', title: 'Mission: Impossible - The Final Reckoning', classification: 'UNCLASSIFIED' }
    ];

    mockReleaseDiscovery.discoverAll.mockResolvedValueOnce({
      upcomingTheater: [
        {
          canonicalId: 'tmdb:101',
          title: 'Ramayana: Part 1',
          theatricalRelease: '2026-11-05', // Valid future release
          classification: 'UPCOMING_THEATRICAL',
          sources: ['TMDB']
        }
      ],
      nowInTheater: [],
      upcomingOTT: [],
      nowStreaming: [],
      pendingValidation: [],
      unclassified: mockUnclassified,
      audit: {}
    });

    const report = await service.runAudit('2026-10-24');

    const vishwambhara = report.upcomingTheatricalAudit.find(i => i.title === 'Vishwambhara');
    expect(vishwambhara).toBeDefined();
    expect(vishwambhara?.status).toBe('MISSING_INDIAN_RELEASE_DATE');
    expect(report.summary.missingIndianReleaseDateCount).toBe(21);

    // POINT 4: Explicit assertions on the verified-future denominator and coverage percentage
    // Ramayana: Part 1 is the ONLY verified future release in the denominator
    // Vishwambhara and the other 20 missing-date titles are strictly excluded
    expect(report.summary.verifiedFutureBenchmarkDenominator).toBe(1);
    expect(report.summary.verifiedFutureFoundInUpcomingTheaters).toBe(1);
    expect(report.summary.upcomingTheatricalCoveragePercentage).toBe('100.0%');
  });

  // REGRESSION TEST 5: Zero-denominator edge case returns N/A
  it('Regression 5: should return N/A for coverage percentage when verified-future denominator is zero', async () => {
    const mockMovies = [
      { canonicalId: 'm1', title: 'Ramayana: Part 1', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm2', title: 'Love & War', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm3', title: 'Spirit', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm4', title: 'Alpha', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm5', title: 'Dhurandhar', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm6', title: 'King', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm7', title: 'Coolie', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm8', title: 'Jailer 2', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm9', title: 'OM Chapter 1: Udhiram', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm10', title: 'Arasan', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm11', title: '7G Rainbow Colony 2', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm12', title: 'Vishwambhara', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm13', title: 'SSMB29', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm14', title: 'RC 17', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm15', title: 'Ranabaali', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm16', title: 'HIT: The Fourth Case', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm17', title: 'Toxic: A Fairy Tale for Grown-ups', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm18', title: 'Kantara: Chapter 1', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm19', title: "Bachelor Party D'eux", classification: 'UNCLASSIFIED' },
      { canonicalId: 'm20', title: 'Titans', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm21', title: 'Avengers: Doomsday', classification: 'UNCLASSIFIED' },
      { canonicalId: 'm22', title: 'Mission: Impossible - The Final Reckoning', classification: 'UNCLASSIFIED' }
    ];

    mockReleaseDiscovery.discoverAll.mockResolvedValueOnce({
      upcomingTheater: [],
      nowInTheater: [],
      upcomingOTT: [],
      nowStreaming: [],
      pendingValidation: [],
      unclassified: mockMovies,
      audit: {}
    });

    const report = await service.runAudit('2026-10-24');

    expect(report.summary.verifiedFutureBenchmarkDenominator).toBe(0);
    expect(report.summary.upcomingTheatricalCoveragePercentage).toBe('N/A');
    expect(report.summary.coveragePercentage).toBe('N/A');
  });

  // REGRESSION TEST 6: Date conflict across 45-day window is quarantined
  it('Regression 6: should quarantine boundary-straddling date conflicts between TMDB and OMDb instead of silently picking one', async () => {
    // Reference date: 2026-10-24
    // TMDB reports: 2026-10-15 (9 days ago, <= 45 days)
    // OMDb reports: 2026-08-15 (70 days ago, > 45 days)
    mockReleaseDiscovery.discoverAll.mockResolvedValueOnce({
      upcomingTheater: [],
      nowInTheater: [],
      upcomingOTT: [],
      nowStreaming: [],
      pendingValidation: [],
      unclassified: [
        {
          canonicalId: 'tmdb:boundary-conflict',
          title: 'Jailer 2',
          theatricalRelease: '2026-10-15',
          classification: 'UNCLASSIFIED',
          sources: ['TMDB']
        }
      ],
      audit: {}
    });

    mockImdb.findMatch.mockResolvedValueOnce({ matched: true, imdbId: 'tt_jailer2' });
    mockOmdb.getByImdbId.mockResolvedValueOnce({
      isValid: true,
      releasedDate: '2026-08-15', // 70 days ago
      title: 'Jailer 2'
    });

    const report = await service.runAudit('2026-10-24');

    // Should be quarantined rather than silently pushed to pastReleaseExclusionAudit
    const item = report.pendingValidationAudit.find(i => i.title === 'Jailer 2');
    expect(item).toBeDefined();
    expect(item?.status).toBe('QUARANTINED_DATE_CONFLICT');
    expect(item?.evidenceConfidence).toBe('UNVERIFIED');
    expect(report.dateConflicts.some(c => c.title === 'Jailer 2')).toBe(true);
  });

  // REGRESSION TEST 7: India-local calendar date timezone normalization
  it('Regression 7: should normalize reference dates to Asia/Kolkata timezone avoiding early-morning UTC date drift', () => {
    // When it is 02:00 AM on 2026-10-25 in India (Asia/Kolkata, UTC+05:30),
    // the UTC instant is 2026-10-24T20:30:00.000Z.
    const earlyMorningInstant = new Date('2026-10-24T20:30:00.000Z');

    // UTC string would give '2026-10-24' (yesterday in India)
    expect(earlyMorningInstant.toISOString().split('T')[0]).toBe('2026-10-24');

    // getIndiaTodayDateStr must return '2026-10-25' (today in India)
    const indiaDate = service.getIndiaTodayDateStr(earlyMorningInstant);
    expect(indiaDate).toBe('2026-10-25');
  });
});
