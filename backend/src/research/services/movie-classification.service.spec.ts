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
});

