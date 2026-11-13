import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryCacheService, DiscoverySnapshot } from './discovery-cache.service';
import { ReleaseDiscoveryService, CanonicalMovie } from './release-discovery.service';
import * as fs from 'fs';
import * as path from 'path';

describe('DiscoveryCacheService', () => {
  let service: DiscoveryCacheService;
  let mockReleaseDiscovery: { discoverAll: jest.Mock };

  const sampleMovie: CanonicalMovie = {
    canonicalId: 'tmdb:101',
    title: 'Ramayana: Part 1',
    year: 2026,
    originalLanguage: 'hi',
    industries: ['Bollywood'],
    theatricalRelease: '2026-11-05',
    theatricalStatus: 'UPCOMING',
    sources: ['TMDB'],
    artworkStatus: 'READY',
    classification: 'UPCOMING_THEATRICAL'
  };

  const validSnapshot: DiscoverySnapshot = {
    upcomingTheater: [sampleMovie],
    nowInTheater: [],
    upcomingOTT: [],
    nowStreaming: [],
    pendingValidation: [],
    unclassified: [],
    audit: {
      classificationEngine: {
        active: true,
        leakageDetections: 0,
        mutualExclusivityGuaranteed: true,
        today: '2026-10-24'
      }
    }
  };

  const testCacheDir = path.join(process.cwd(), '.cache-test-' + Date.now());

  beforeAll(() => {
    process.env.DISCOVERY_CACHE_DIR = testCacheDir;
  });

  afterAll(() => {
    try {
      if (fs.existsSync(testCacheDir)) {
        fs.rmSync(testCacheDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
    delete process.env.DISCOVERY_CACHE_DIR;
  });

  let mutationListener: ((event: any) => void) | null = null;
  let currentGeneration = 0;

  beforeEach(async () => {
    jest.clearAllMocks();
    currentGeneration = 0;

    mockReleaseDiscovery = {
      discoverAll: jest.fn().mockResolvedValue(validSnapshot),
      onRegistryMutation: jest.fn().mockImplementation((listener) => {
        mutationListener = listener;
        return () => { mutationListener = null; };
      }),
      getRegistryGeneration: jest.fn().mockImplementation(() => currentGeneration)
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryCacheService,
        { provide: ReleaseDiscoveryService, useValue: mockReleaseDiscovery }
      ]
    }).compile();

    service = module.get<DiscoveryCacheService>(DiscoveryCacheService);
  });

  afterEach(() => {
    service.stopBackgroundSchedule();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // TEST 1: Cache hits - serves cached snapshot without triggering full discovery crawl
  it('Scenario 1: should serve the cached snapshot immediately without invoking discoverAll() synchronously', async () => {
    service.setSnapshotForTesting(validSnapshot, new Date());

    const response = service.getSnapshotResponse();

    expect(response).toBeDefined();
    expect('upcomingTheater' in response).toBe(true);
    if ('upcomingTheater' in response) {
      expect(response.upcomingTheater.length).toBe(1);
      expect(response.upcomingTheater[0].title).toBe('Ramayana: Part 1');
      expect(response.audit.cache.servedFromCache).toBe(true);
    }

    // Crucial: discoverAll was NEVER invoked during the request
    expect(mockReleaseDiscovery.discoverAll).not.toHaveBeenCalled();
  });

  // TEST 2: Successful snapshot replacement - replaces snapshot atomically
  it('Scenario 2: should atomically swap the snapshot upon successful background refresh', async () => {
    const updatedMovie: CanonicalMovie = {
      ...sampleMovie,
      canonicalId: 'tmdb:102',
      title: 'Coolie'
    };
    const newSnapshot: DiscoverySnapshot = {
      ...validSnapshot,
      upcomingTheater: [updatedMovie]
    };

    mockReleaseDiscovery.discoverAll.mockResolvedValueOnce(newSnapshot);

    const refreshed = await service.triggerRefresh();

    expect(refreshed).toBe(true);
    const response = service.getSnapshotResponse();
    if ('upcomingTheater' in response) {
      expect(response.upcomingTheater[0].title).toBe('Coolie');
    }
    expect(service.getStatus().status).toBe('READY');
    expect(service.getStatus().lastError).toBeNull();
  });

  // TEST 3: Refresh failure preservation - retains last known-good snapshot and reports STALE
  it('Scenario 3: should retain and serve the last valid snapshot when refresh fails', async () => {
    service.setSnapshotForTesting(validSnapshot, new Date('2026-10-24T10:00:00Z'));

    // Simulate network error / TMDB 429 in discoverAll
    mockReleaseDiscovery.discoverAll.mockRejectedValueOnce(new Error('TMDB rate limit 429'));

    const refreshed = await service.triggerRefresh();

    expect(refreshed).toBe(false);

    // The snapshot is still available and untouched
    const response = service.getSnapshotResponse();
    expect('upcomingTheater' in response).toBe(true);
    if ('upcomingTheater' in response) {
      expect(response.upcomingTheater[0].title).toBe('Ramayana: Part 1');
    }

    // Diagnostics report STALE status and error
    const status = service.getStatus();
    expect(status.status).toBe('STALE');
    expect(status.lastError).toContain('TMDB rate limit 429');
    expect(status.snapshotAvailable).toBe(true);
  });

  // TEST 4: Overlapping refresh prevention
  it('Scenario 4: should reject overlapping concurrent refresh triggers via mutex lock', async () => {
    let resolveSlowCrawl: (val: any) => void = () => { };
    const slowCrawlPromise = new Promise(resolve => {
      resolveSlowCrawl = resolve;
    });

    mockReleaseDiscovery.discoverAll.mockReturnValueOnce(slowCrawlPromise);

    // Start first refresh
    const firstRefresh = service.triggerRefresh();

    // Trigger second refresh while first is in flight
    const secondRefresh = await service.triggerRefresh();

    expect(secondRefresh).toBe(false); // Rejected by lock

    // Complete first
    resolveSlowCrawl(validSnapshot);
    const firstResult = await firstRefresh;
    expect(firstResult).toBe(true);

    // After completion, lock is released
    expect(service.getStatus().isRefreshing).toBe(false);
  });

  // TEST 5: Initial no-snapshot behavior - returns documented structured initialization response
  it('Scenario 5: should return a predictable INITIALIZING response when no snapshot exists and not masquerade as valid catalog', () => {
    service.setSnapshotForTesting(null);

    const response = service.getSnapshotResponse();

    expect('status' in response).toBe(true);
    if ('status' in response) {
      expect(response.status).toBe('INITIALIZING');
      expect(response.snapshotAvailable).toBe(false);
      expect(response.message).toContain('compiling its initial snapshot');
    }

    const status = service.getStatus();
    expect(status.status).toBe('INITIALIZING');
    expect(status.snapshotAvailable).toBe(false);
  });

  // TEST 6: Corrupt persisted snapshot handling
  it('Scenario 6: should safely handle a corrupt or unreadable persisted snapshot without crashing', () => {
    const corruptFile = path.join(testCacheDir, 'discovery-snapshot.json');
    fs.mkdirSync(testCacheDir, { recursive: true });
    fs.writeFileSync(corruptFile, '{ corrupt-json-content: invalid', 'utf-8');

    // Should return false and not throw
    const loaded = service.loadPersistedSnapshotFromDisk();
    expect(loaded).toBe(false);
    expect(service.getSnapshotDirect()).toBeNull();
  });

  // TEST 7: Atomic disk persistence & failure resilience
  it('Scenario 7: should write snapshot atomically to disk and keep in-memory snapshot safe if disk write fails', () => {
    // 1. Successful atomic persist
    const persisted = service.persistSnapshotToDisk(validSnapshot);
    expect(persisted).toBe(true);
    const snapshotFile = path.join(testCacheDir, 'discovery-snapshot.json');
    expect(fs.existsSync(snapshotFile)).toBe(true);

    // 2. Can reload from disk
    service.setSnapshotForTesting(null);
    const reloaded = service.loadPersistedSnapshotFromDisk();
    expect(reloaded).toBe(true);
    expect(service.getSnapshotDirect()).toBeDefined();

    // 3. If disk write throws, in-memory state is unaffected
    const badService = new DiscoveryCacheService(mockReleaseDiscovery as any);
    // Force write failure by pointing cacheDir to an illegal path on Windows
    (badService as any).cacheDir = 'Z:\\non_existent_drive_directory_test_fail';
    const failedPersist = badService.persistSnapshotToDisk(validSnapshot);
    expect(failedPersist).toBe(false); // Returns false, does not throw
  });

  // TEST 8: Candidate structural validation
  it('Scenario 8: should reject invalid or empty candidate snapshots to protect the catalog', () => {
    expect(service.validateCandidateSnapshot(null)).toBe(false);
    expect(service.validateCandidateSnapshot({})).toBe(false);

    // Missing bucket
    const missingBucket = { ...validSnapshot };
    delete (missingBucket as any).nowStreaming;
    expect(service.validateCandidateSnapshot(missingBucket)).toBe(false);

    // 0 total movies (empty failure)
    const emptySnapshot: DiscoverySnapshot = {
      upcomingTheater: [],
      nowInTheater: [],
      upcomingOTT: [],
      nowStreaming: [],
      pendingValidation: [],
      unclassified: [],
      audit: {}
    };
    expect(service.validateCandidateSnapshot(emptySnapshot)).toBe(false);

    // Mutual exclusivity failure
    const leakingSnapshot: DiscoverySnapshot = {
      ...validSnapshot,
      audit: {
        classificationEngine: {
          leakageDetections: 2,
          mutualExclusivityGuaranteed: false
        }
      }
    };
    expect(service.validateCandidateSnapshot(leakingSnapshot)).toBe(false);
  });

  // TEST 9: Application shutdown cleans up timer
  it('Scenario 9: should stop background refresh timer upon application shutdown', () => {
    service.startBackgroundSchedule(60000);
    expect((service as any).refreshTimer).not.toBeNull();

    service.onApplicationShutdown('SIGTERM');
    expect((service as any).refreshTimer).toBeNull();
  });

  // TEST 10: Registry mutation invalidates in-memory and on-disk snapshot immediately
  it('Scenario 10: should immediately invalidate in-memory snapshot and delete on-disk snapshot on registry mutation', () => {
    service.setSnapshotForTesting(validSnapshot, new Date());
    service.persistSnapshotToDisk(validSnapshot);
    const snapshotFile = path.join(testCacheDir, 'discovery-snapshot.json');
    expect(fs.existsSync(snapshotFile)).toBe(true);
    expect(service.getSnapshotDirect()).not.toBeNull();

    // Trigger invalidation directly or via registry mutation listener
    service.invalidateCache('EVIDENCE_RETRACTED');

    expect(service.getSnapshotDirect()).toBeNull();
    expect(fs.existsSync(snapshotFile)).toBe(false);
    expect(service.getStatus().snapshotAvailable).toBe(false);
  });

  // TEST 11: In-flight refresh with generation mismatch discards stale candidate snapshot
  it('Scenario 11: should discard candidate snapshot if registry mutation occurred during in-flight background refresh (generation mismatch)', async () => {
    service.setSnapshotForTesting(null);
    mockReleaseDiscovery.discoverAll.mockImplementation(async () => {
      // Simulate mutation occurring while discoverAll was running
      currentGeneration = 5;
      return validSnapshot;
    });

    currentGeneration = 1;
    const refreshed = await service.triggerRefresh();

    // Must be rejected because startGeneration (1) !== endGeneration (5)
    expect(refreshed).toBe(false);
    expect(service.getSnapshotDirect()).toBeNull();
  });
});
