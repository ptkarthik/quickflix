import { MovieClassificationService, MovieReleaseData } from './movie-classification.service';

describe('MovieClassificationService - Leakage & Boundary Tests', () => {
  let service: MovieClassificationService;
  const TODAY = '2026-10-16';

  beforeEach(() => {
    service = new MovieClassificationService();
  });

  describe('Boundary Condition 1: Past Release in Theaters', () => {
    it('a movie released yesterday must NOT appear in Upcoming in Theaters', () => {
      const movie: MovieReleaseData = {
        movieId: 101,
        title: 'Released Yesterday',
        theatricalReleaseDate: '2026-10-15',
        theatricalStatus: 'CURRENTLY_RUNNING',
        ottPlatforms: [],
        ottDateConfirmed: false,
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).not.toBe('UPCOMING_THEATRICAL');
      expect(result).toBe('NOW_IN_THEATERS');
    });
  });

  describe('Boundary Condition 2: Streaming Precedence Over Theaters', () => {
    it('a movie already streaming on Prime Video in India must NOT appear in Now in Theaters even if theatrical window is active', () => {
      const movie: MovieReleaseData = {
        movieId: 102,
        title: 'Blockbuster Hit',
        theatricalReleaseDate: '2026-10-01', // 15 days ago, still in theaters
        theatricalStatus: 'CURRENTLY_RUNNING',
        ottReleaseDate: '2026-10-14',
        ottPlatforms: [
          {
            name: 'Prime Video',
            availableInIndia: true,
            verified: true,
            availabilityType: 'SUBSCRIPTION',
            availableFrom: '2026-10-14',
          },
        ],
        ottDateConfirmed: true,
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).not.toBe('NOW_IN_THEATERS');
      expect(result).toBe('NOW_STREAMING');
    });
  });

  describe('Boundary Condition 3: Future Theatrical Only', () => {
    it('a movie with only a future theatrical date must NOT appear in Upcoming OTT', () => {
      const movie: MovieReleaseData = {
        movieId: 103,
        title: 'Epic Sequel',
        theatricalReleaseDate: '2026-11-05',
        theatricalStatus: 'UPCOMING',
        ottPlatforms: [],
        ottDateConfirmed: false,
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).not.toBe('UPCOMING_OTT');
      expect(result).toBe('UPCOMING_THEATRICAL');
    });
  });

  describe('Boundary Condition 4: Unconfirmed OTT Date', () => {
    it('a movie with an unconfirmed OTT announcement must NOT appear in Upcoming OTT', () => {
      const movie: MovieReleaseData = {
        movieId: 104,
        title: 'Rumored OTT Film',
        theatricalReleaseDate: '2026-08-01',
        theatricalStatus: 'ENDED',
        ottReleaseDate: '2026-11-20',
        ottPlatforms: [
          {
            name: 'Netflix',
            availableInIndia: true,
            verified: false, // NOT verified
            availabilityType: 'SUBSCRIPTION',
          },
        ],
        ottDateConfirmed: false, // Rumored / unconfirmed
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).not.toBe('UPCOMING_OTT');
      expect(result).toBe('UNCLASSIFIED');
    });
  });

  describe('Boundary Condition 5: Streaming in Another Country but NOT in India', () => {
    it('a movie streaming in the US/UK but not verified in India must NOT appear in Now Streaming', () => {
      const movie: MovieReleaseData = {
        movieId: 105,
        title: 'US Only Film',
        theatricalReleaseDate: '2026-05-01',
        theatricalStatus: 'ENDED',
        ottPlatforms: [
          {
            name: 'Hulu',
            availableInIndia: false, // NOT available in India
            verified: true,
            availabilityType: 'SUBSCRIPTION',
            availableFrom: '2026-06-01',
          },
        ],
        ottDateConfirmed: true,
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).not.toBe('NOW_STREAMING');
      expect(result).toBe('UNCLASSIFIED');
    });
  });

  describe('Boundary Condition 6: Rental/Purchase vs Subscription', () => {
    it('a movie available only to rent must NOT be mislabeled as subscription streaming', () => {
      const movie: MovieReleaseData = {
        movieId: 106,
        title: 'Rent On Apple TV',
        theatricalReleaseDate: '2026-07-01',
        theatricalStatus: 'ENDED',
        ottPlatforms: [
          {
            name: 'Apple TV',
            availableInIndia: true,
            verified: true,
            availabilityType: 'RENTAL', // Rental only!
            availableFrom: '2026-09-01',
          },
        ],
        ottDateConfirmed: true,
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).not.toBe('NOW_STREAMING');
      expect(result).toBe('UNCLASSIFIED');
    });
  });

  describe('Boundary Condition 7: Expired OTT License', () => {
    it('a movie with an expired OTT license must NOT remain in Now Streaming', () => {
      const movie: MovieReleaseData = {
        movieId: 107,
        title: 'Expired License Film',
        theatricalReleaseDate: '2025-01-01',
        theatricalStatus: 'ENDED',
        ottPlatforms: [
          {
            name: 'Zee5',
            availableInIndia: true,
            verified: true,
            availabilityType: 'SUBSCRIPTION',
            availableFrom: '2025-03-01',
            availableUntil: '2026-10-01', // Expired 15 days ago!
          },
        ],
        ottDateConfirmed: true,
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).not.toBe('NOW_STREAMING');
      expect(result).toBe('UNCLASSIFIED');
    });
  });

  describe('Boundary Condition 8: Deduplication & Canonical Consistency', () => {
    it('a movie appearing across multiple sources returns exactly one canonical category', () => {
      // TMDB says theatrical was 2026-10-01, JustWatch says it is running
      const movieFromFeedA: MovieReleaseData = {
        movieId: 'tmdb:505',
        title: 'Multi Feed Hit',
        theatricalReleaseDate: '2026-10-01',
        theatricalStatus: 'CURRENTLY_RUNNING',
        ottPlatforms: [],
        ottDateConfirmed: false,
      };

      const result = service.classifyMovie(movieFromFeedA, TODAY);
      expect(result).toBe('NOW_IN_THEATERS');
    });
  });

  describe('Theatrical Run Completed Exclusion', () => {
    it('a movie released months ago whose run ended and has no OTT must be UNCLASSIFIED, not in Now In Theaters', () => {
      const movie: MovieReleaseData = {
        movieId: 109,
        title: 'Old Theater Film',
        theatricalReleaseDate: '2026-04-10', // 6 months ago
        theatricalStatus: 'UNKNOWN', // resolveTheatricalStatus should calculate ENDED (> 45 days)
        ottPlatforms: [],
        ottDateConfirmed: false,
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).not.toBe('NOW_IN_THEATERS');
      expect(result).toBe('UNCLASSIFIED');
    });
  });

  describe('Upcoming OTT for film whose theatrical run ended or direct-to-OTT', () => {
    it('shows in Upcoming OTT when confirmed in India and theatrical run has ended', () => {
      const movie: MovieReleaseData = {
        movieId: 110,
        title: 'Theatrical Ended Coming to OTT',
        theatricalReleaseDate: '2026-08-01', // Run ended
        theatricalStatus: 'ENDED',
        ottReleaseDate: '2026-11-15',
        ottDateConfirmed: true,
        ottPlatforms: [
          {
            name: 'Netflix',
            availableInIndia: true,
            verified: true,
            availabilityType: 'SUBSCRIPTION',
            availableFrom: '2026-11-15',
          },
        ],
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).toBe('UPCOMING_OTT');
    });

    it('shows in Upcoming OTT for direct-to-OTT films', () => {
      const movie: MovieReleaseData = {
        movieId: 111,
        title: 'Direct To OTT Special',
        isDirectToOtt: true,
        theatricalStatus: 'UNKNOWN',
        ottReleaseDate: '2026-11-01',
        ottDateConfirmed: true,
        ottPlatforms: [
          {
            name: 'Prime Video',
            availableInIndia: true,
            verified: true,
            availabilityType: 'SUBSCRIPTION',
            availableFrom: '2026-11-01',
          },
        ],
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).toBe('UPCOMING_OTT');
    });

    it('shows in Upcoming OTT when confirmed in India with unknown platform (Platform TBA deadlock fix)', () => {
      const movie: MovieReleaseData = {
        movieId: 112,
        title: 'Confirmed Digital Premiere Platform TBA',
        theatricalReleaseDate: '2026-08-01', // Run ended
        theatricalStatus: 'ENDED',
        ottReleaseDate: '2026-11-06',
        ottDateConfirmed: true,
        ottPlatforms: [], // No platform known yet
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).toBe('UPCOMING_OTT');
      // Assert that no platform was fabricated
      expect(movie.ottPlatforms).toHaveLength(0);
    });

    it('rejects confirmed future OTT date if all declared platforms are overseas-only (not available in India)', () => {
      const movie: MovieReleaseData = {
        movieId: 113,
        title: 'Overseas Digital Only',
        theatricalReleaseDate: '2026-07-01',
        theatricalStatus: 'ENDED',
        ottReleaseDate: '2026-11-20',
        ottDateConfirmed: true,
        ottPlatforms: [
          {
            name: 'Hulu',
            availableInIndia: false,
            verified: true,
            availabilityType: 'SUBSCRIPTION',
          },
        ],
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).toBe('UNCLASSIFIED');
    });

    it('rejects unverified / rumored OTT date even if date is strictly in future', () => {
      const movie: MovieReleaseData = {
        movieId: 114,
        title: 'Rumored Digital Date',
        theatricalReleaseDate: '2026-08-01',
        theatricalStatus: 'ENDED',
        ottReleaseDate: '2026-11-20',
        ottDateConfirmed: false, // Unverified
        ottPlatforms: [],
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).toBe('UNCLASSIFIED');
    });

    it('preserves theatrical precedence: currently running theater film does NOT leak into Upcoming OTT', () => {
      const movie: MovieReleaseData = {
        movieId: 115,
        title: 'Blockbuster in Cinemas Now',
        theatricalReleaseDate: '2026-10-10', // 6 days ago (active in theaters)
        theatricalStatus: 'CURRENTLY_RUNNING',
        ottReleaseDate: '2026-11-20',
        ottDateConfirmed: true,
        ottPlatforms: [
          {
            name: 'Netflix',
            availableInIndia: true,
            verified: true,
            availabilityType: 'SUBSCRIPTION',
          },
        ],
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).toBe('NOW_IN_THEATERS');
      expect(result).not.toBe('UPCOMING_OTT');
    });

    it('preserves theatrical precedence: upcoming theatrical release takes precedence over future OTT', () => {
      const movie: MovieReleaseData = {
        movieId: 116,
        title: 'Upcoming Big Screen First',
        theatricalReleaseDate: '2026-10-25', // In theaters next week
        theatricalStatus: 'UPCOMING',
        ottReleaseDate: '2026-12-15', // OTT 2 months later
        ottDateConfirmed: true,
        ottPlatforms: [],
        originalLanguage: 'ta',
        industries: ['Kollywood'],
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).toBe('UPCOMING_THEATRICAL');
      expect(result).not.toBe('UPCOMING_OTT');
    });

    it('does NOT classify a movie as Now Streaming merely because a future OTT date and platform exist', () => {
      const movie: MovieReleaseData = {
        movieId: 117,
        title: 'Future Streaming Release',
        theatricalStatus: 'ENDED',
        theatricalReleaseDate: '2026-06-01',
        ottReleaseDate: '2026-11-15', // Strictly future
        ottDateConfirmed: true,
        ottPlatforms: [
          {
            name: 'Prime Video',
            availableInIndia: true,
            verified: true,
            availabilityType: 'SUBSCRIPTION',
          },
        ],
      };

      const result = service.classifyMovie(movie, TODAY);
      expect(result).toBe('UPCOMING_OTT');
      expect(result).not.toBe('NOW_STREAMING');
    });
  });

  describe('Strict Indian Theatrical Validator (validateUpcomingTheatrical)', () => {
    it('rejects synthetic / test fixtures (e.g. "Test: Low Pop Tomorrow")', () => {
      const res = service.validateUpcomingTheatrical({
        movieId: 999,
        title: 'Test: Low Pop Tomorrow',
        theatricalReleaseDate: '2026-10-25',
        theatricalStatus: 'UPCOMING',
        ottPlatforms: [],
        ottDateConfirmed: false,
      }, TODAY);

      expect(res.isValid).toBe(false);
      expect(res.rejectionReason).toBe('SYNTHETIC_TEST_ENTITY_REJECTED');
    });

    it('rejects movies with theatrical date in the past or today', () => {
      const res = service.validateUpcomingTheatrical({
        movieId: 998,
        title: 'Already In Theaters',
        theatricalReleaseDate: '2026-10-15',
        theatricalStatus: 'CURRENTLY_RUNNING',
        ottPlatforms: [],
        ottDateConfirmed: false,
      }, TODAY);

      expect(res.isValid).toBe(false);
      expect(res.rejectionReason).toBe('THEATRICAL_DATE_ALREADY_PASSED_OR_RUNNING_TODAY');
    });

    it('rejects movies with active Indian OTT subscription streaming', () => {
      const res = service.validateUpcomingTheatrical({
        movieId: 997,
        title: 'Streaming Overlap',
        theatricalReleaseDate: '2026-10-25',
        theatricalStatus: 'UPCOMING',
        ottPlatforms: [{
          name: 'Hotstar',
          availableInIndia: true,
          verified: true,
          availabilityType: 'SUBSCRIPTION',
          availableFrom: '2026-10-01',
        }],
        ottDateConfirmed: true,
      }, TODAY);

      expect(res.isValid).toBe(false);
      expect(res.rejectionReason).toBe('ALREADY_STREAMING_ON_INDIAN_OTT');
    });

    it('rejects direct-to-OTT releases', () => {
      const res = service.validateUpcomingTheatrical({
        movieId: 996,
        title: 'Direct To OTT Only',
        theatricalReleaseDate: '2026-10-25',
        theatricalStatus: 'UPCOMING',
        isDirectToOtt: true,
        ottPlatforms: [],
        ottDateConfirmed: false,
      }, TODAY);

      expect(res.isValid).toBe(false);
      expect(res.rejectionReason).toBe('DIRECT_TO_OTT_EXCLUDED_FROM_THEATRICAL');
    });

    it('validates authentic upcoming Indian theatrical movie', () => {
      const res = service.validateUpcomingTheatrical({
        movieId: 1327835,
        title: 'Mookuthi Amman 2',
        originalLanguage: 'ta',
        theatricalReleaseDate: '2026-11-06',
        theatricalStatus: 'UPCOMING',
        industries: ['Kollywood'],
        ottPlatforms: [],
        ottDateConfirmed: false,
      }, TODAY);

      expect(res.isValid).toBe(true);
      expect(res.auditDetails?.daysUntilRelease).toBe(21);
      expect(res.auditDetails?.isIndianProduction).toBe(true);
    });
  });

  describe('Phase 2 — Upcoming OTT TV-Series Discovery & Canonical Identity', () => {
    it('classifies upcoming Indian new TV series premiere as UPCOMING_OTT', () => {
      const category = service.classifyMovie({
        movieId: 'tmdb:tv:1001',
        title: 'Student of the Year: After Dark',
        originalLanguage: 'hi',
        industries: ['Bollywood'],
        isDirectToOtt: true,
        ottReleaseDate: '2026-11-13',
        ottDateConfirmed: true,
        ottPlatforms: [{
          name: 'Disney+ Hotstar',
          availableInIndia: true,
          verified: true,
          availabilityType: 'SUBSCRIPTION',
          availableFrom: '2026-11-13'
        }]
      }, TODAY);

      expect(category).toBe('UPCOMING_OTT');
    });

    it('classifies upcoming international TV series premiere with Platform TBA as UPCOMING_OTT', () => {
      const category = service.classifyMovie({
        movieId: 'tmdb:tv:2002',
        title: 'The Remarried Empress',
        originalLanguage: 'ko',
        industries: ['Other'],
        isDirectToOtt: true,
        ottReleaseDate: '2026-11-04',
        ottDateConfirmed: true,
        ottPlatforms: [] // Platform TBA
      }, TODAY);

      expect(category).toBe('UPCOMING_OTT');
    });

    it('classifies upcoming new season of existing series as UPCOMING_OTT', () => {
      const category = service.classifyMovie({
        movieId: 'tmdb:tv:93405',
        title: 'Squid Game (Season 3)',
        originalLanguage: 'ko',
        industries: ['Other'],
        isDirectToOtt: true,
        ottReleaseDate: '2026-12-15',
        ottDateConfirmed: true,
        ottPlatforms: [{
          name: 'Netflix',
          availableInIndia: true,
          verified: true,
          availabilityType: 'SUBSCRIPTION',
          availableFrom: '2026-12-15'
        }]
      }, TODAY);

      expect(category).toBe('UPCOMING_OTT');
    });

    it('rejects past first-air date from being treated as upcoming OTT', () => {
      // Series first aired in 2021 with no future season date
      const category = service.classifyMovie({
        movieId: 'tmdb:tv:93405',
        title: 'Past Air Date Series',
        originalLanguage: 'en',
        isDirectToOtt: true,
        ottReleaseDate: '2021-09-17', // in the past!
        ottDateConfirmed: true,
        ottPlatforms: [{
          name: 'Netflix',
          availableInIndia: true,
          verified: true,
          availabilityType: 'SUBSCRIPTION'
        }]
      }, TODAY);

      // Must be classified as NOW_STREAMING (if active in India) or UNCLASSIFIED, NEVER UPCOMING_OTT
      expect(category).not.toBe('UPCOMING_OTT');
    });

    it('excludes series with unknown or unverified release dates from UPCOMING_OTT', () => {
      const category = service.classifyMovie({
        movieId: 'tmdb:tv:5555',
        title: 'Rumored Speculative Series',
        originalLanguage: 'hi',
        isDirectToOtt: true,
        ottReleaseDate: undefined,
        ottDateConfirmed: false,
        ottPlatforms: [{
          name: 'Prime Video',
          availableInIndia: true,
          verified: false // unverified rumor
        }]
      }, TODAY);

      expect(category).toBe('UNCLASSIFIED');
    });

    it('ensures movie and TV series sharing the same numeric TMDB ID have distinct canonical identities and do not collide', () => {
      const movieData: MovieReleaseData = {
        movieId: 'tmdb:12345',
        title: 'Action Movie 12345',
        originalLanguage: 'ta',
        theatricalReleaseDate: '2026-11-06',
        theatricalStatus: 'UPCOMING',
        ottPlatforms: [],
        ottDateConfirmed: false,
      };

      const tvData: MovieReleaseData = {
        movieId: 'tmdb:tv:12345',
        title: 'Action Series 12345',
        originalLanguage: 'ta',
        isDirectToOtt: true,
        ottReleaseDate: '2026-11-20',
        ottDateConfirmed: true,
        ottPlatforms: [{
          name: 'Netflix',
          availableInIndia: true,
          verified: true,
          availabilityType: 'SUBSCRIPTION',
          availableFrom: '2026-11-20'
        }],
      };

      const movieCategory = service.classifyMovie(movieData, TODAY);
      const tvCategory = service.classifyMovie(tvData, TODAY);

      expect(movieCategory).toBe('UPCOMING_THEATRICAL');
      expect(tvCategory).toBe('UPCOMING_OTT');
      expect(movieData.movieId).not.toBe(tvData.movieId);
      expect(movieData.movieId).toBe('tmdb:12345');
      expect(tvData.movieId).toBe('tmdb:tv:12345');
    });

    it('preserves tab mutual exclusivity when both movies and series are present', () => {
      const items: Array<{ data: MovieReleaseData; expected: MovieCategory }> = [
        {
          data: {
            movieId: 'tmdb:101',
            title: 'Theatrical Big Hit',
            theatricalReleaseDate: '2026-11-06',
            theatricalStatus: 'UPCOMING',
            ottPlatforms: [],
            ottDateConfirmed: false
          },
          expected: 'UPCOMING_THEATRICAL'
        },
        {
          data: {
            movieId: 'tmdb:tv:101',
            title: 'Streaming Hit Series',
            isDirectToOtt: true,
            ottReleaseDate: '2026-11-13',
            ottDateConfirmed: true,
            ottPlatforms: [{ name: 'Prime Video', availableInIndia: true, verified: true }]
          },
          expected: 'UPCOMING_OTT'
        },
        {
          data: {
            movieId: 'tmdb:201',
            title: 'Active Cinema Release',
            theatricalReleaseDate: '2026-10-10',
            theatricalStatus: 'CURRENTLY_RUNNING',
            ottPlatforms: [],
            ottDateConfirmed: false
          },
          expected: 'NOW_IN_THEATERS'
        },
        {
          data: {
            movieId: 'tmdb:tv:301',
            title: 'Currently Streaming Series',
            isDirectToOtt: true,
            ottReleaseDate: '2026-09-01',
            ottDateConfirmed: true,
            ottPlatforms: [{ name: 'Netflix', availableInIndia: true, verified: true, availabilityType: 'SUBSCRIPTION', availableFrom: '2026-09-01' }]
          },
          expected: 'NOW_STREAMING'
        }
      ];

      const classified = items.map(i => ({
        id: i.data.movieId,
        category: service.classifyMovie(i.data, TODAY),
        expected: i.expected
      }));

      for (const item of classified) {
        expect(item.category).toBe(item.expected);
      }

      // Check zero collision in ID set
      const idSet = new Set(classified.map(c => c.id));
      expect(idSet.size).toBe(items.length);
    });
  });
});

