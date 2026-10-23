import { ReleaseDiscoveryService } from './release-discovery.service';
import { MovieClassificationService } from './movie-classification.service';
import { TmdbProvider } from '../providers/tmdb.provider';
import { MovieArtworkService } from '../../creative/artwork.service';

describe('ReleaseDiscoveryService - Content Classification Pipeline', () => {
  let service: ReleaseDiscoveryService;
  let classificationService: MovieClassificationService;
  let tmdbProvider: TmdbProvider;
  let mockArtworkService: any;
  let mockTheatricalValidator: any;

  beforeEach(() => {
    classificationService = new MovieClassificationService();
    tmdbProvider = new TmdbProvider();
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
      mockTheatricalValidator
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
});
