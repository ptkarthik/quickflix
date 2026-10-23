import { MovieClassificationService, MovieReleaseData } from './movie-classification.service';
import { TheatricalValidatorService } from './theatrical-validator.service';

describe('Theatrical Discovery Pipeline - Regression & Anti-Leakage Suite', () => {
  let classificationService: MovieClassificationService;
  let theatricalValidator: TheatricalValidatorService;
  let mockOmdbProvider: any;
  let mockImdbCrosscheck: any;

  const TODAY = '2026-10-18';

  beforeEach(() => {
    classificationService = new MovieClassificationService();

    mockOmdbProvider = {
      getByTitle: jest.fn().mockResolvedValue({ isValid: false }),
      getByImdbId: jest.fn().mockResolvedValue({ isValid: false })
    };

    mockImdbCrosscheck = {
      findMatch: jest.fn().mockResolvedValue({ matched: false })
    };

    theatricalValidator = new TheatricalValidatorService(
      mockOmdbProvider,
      mockImdbCrosscheck
    );
  });

  describe('1. The Paradise Regression Test (Past Theatrical Date Prevention)', () => {
    it('must EXCLUDE "The Paradise" (released 2026-09-23) from Upcoming in Theaters, even if upstream marked it UPCOMING', async () => {
      const paradiseCandidate: MovieReleaseData = {
        movieId: 1376856,
        title: 'The Paradise',
        originalLanguage: 'te',
        industries: ['Tollywood'],
        theatricalReleaseDate: '2026-09-23', // Released ~3 weeks ago
        theatricalStatus: 'UPCOMING', // Upstream API incorrectly claimed upcoming!
        theatricalWindowDays: 45,
        ottPlatforms: [],
        ottDateConfirmed: false,
        isDirectToOtt: false
      };

      // 1. Check Theatrical Validator directly
      const verification = await theatricalValidator.verifyTheatricalStatus(paradiseCandidate, TODAY);
      expect(verification.isVerifiedUpcoming).toBe(false);
      expect(verification.isConfirmedReleased).toBe(true);

      // 2. Check Classification Service
      const category = classificationService.classifyMovie(paradiseCandidate, TODAY);
      expect(category).not.toBe('UPCOMING_THEATRICAL');
      expect(category).toBe('NOW_IN_THEATERS'); // Within 45-day window, correctly in theaters now!

      // 3. Strict validator check
      const strictResult = classificationService.validateUpcomingTheatrical(paradiseCandidate, TODAY);
      expect(strictResult.isValid).toBe(false);
      expect(strictResult.rejectionReason).toBe('THEATRICAL_DATE_ALREADY_PASSED_OR_RUNNING_TODAY');
    });

    it('must reject any candidate whose theatrical release date is on or before today', () => {
      const pastMovie: MovieReleaseData = {
        movieId: 999,
        title: 'Released Last Week',
        originalLanguage: 'hi',
        theatricalReleaseDate: '2026-10-11',
        theatricalStatus: 'UPCOMING', // Upstream claims upcoming
        ottPlatforms: [],
        ottDateConfirmed: false
      };

      const result = classificationService.validateUpcomingTheatrical(pastMovie, TODAY);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('THEATRICAL_DATE_ALREADY_PASSED_OR_RUNNING_TODAY');

      const category = classificationService.classifyMovie(pastMovie, TODAY);
      expect(category).not.toBe('UPCOMING_THEATRICAL');
    });
  });

  describe('2. Genuinely Future Releases Preservation Test', () => {
    it('must PRESERVE genuine future theatrical releases with verified future dates', async () => {
      const futureMovie: MovieReleaseData = {
        movieId: 55555,
        title: 'Coolie',
        originalLanguage: 'ta',
        industries: ['Kollywood'],
        theatricalReleaseDate: '2026-11-20', // Future date
        theatricalStatus: 'UPCOMING',
        theatricalWindowDays: 45,
        ottPlatforms: [],
        ottDateConfirmed: false,
        isDirectToOtt: false
      };

      const verification = await theatricalValidator.verifyTheatricalStatus(futureMovie, TODAY);
      expect(verification.isVerifiedUpcoming).toBe(true);
      expect(verification.isConfirmedReleased).toBe(false);

      const category = classificationService.classifyMovie(futureMovie, TODAY);
      expect(category).toBe('UPCOMING_THEATRICAL');

      const strictResult = classificationService.validateUpcomingTheatrical(futureMovie, TODAY);
      expect(strictResult.isValid).toBe(true);
    });
  });

  describe('3. Multi-Source Conflict & Quarantine Test', () => {
    it('must QUARANTINE into PENDING_VALIDATION when independent source reports past release', async () => {
      // TMDB claims release is 2026-11-15, but OMDb/IMDb reports it already released on 2026-09-20
      mockImdbCrosscheck.findMatch.mockResolvedValueOnce({
        matched: true,
        imdbId: 'tt9876543',
        title: 'Conflicting Movie',
        year: 2026
      });

      mockOmdbProvider.getByImdbId.mockResolvedValueOnce({
        isValid: true,
        imdbId: 'tt9876543',
        title: 'Conflicting Movie',
        releasedDate: '2026-09-20' // Past date!
      });

      const conflictingMovie: MovieReleaseData = {
        movieId: 8888,
        title: 'Conflicting Movie',
        originalLanguage: 'hi',
        theatricalReleaseDate: '2026-11-15', // TMDB says future
        theatricalStatus: 'UPCOMING',
        ottPlatforms: [],
        ottDateConfirmed: false
      };

      const verification = await theatricalValidator.verifyTheatricalStatus(conflictingMovie, TODAY);
      expect(verification.isVerifiedUpcoming).toBe(false);
      expect(verification.isDateConflict).toBe(true);
      expect(verification.quarantineReason).toContain('DATE_CONFLICT_OMDB_REPORTS_PAST_RELEASE');

      conflictingMovie.dateConflictDetected = true;
      conflictingMovie.dateConflictDetails = verification.quarantineReason;

      const category = classificationService.classifyMovie(conflictingMovie, TODAY);
      expect(category).toBe('PENDING_VALIDATION');
      expect(category).not.toBe('UPCOMING_THEATRICAL');
    });

    it('must quarantine uncorroborated or ambiguous theatrical dates', () => {
      const ambiguousMovie: MovieReleaseData = {
        movieId: 7777,
        title: 'Unannounced Indie Film',
        originalLanguage: 'ml',
        theatricalStatus: 'UNKNOWN',
        theatricalReleaseDate: undefined,
        uncorroboratedDate: true,
        ottPlatforms: [],
        ottDateConfirmed: false
      };

      const category = classificationService.classifyMovie(ambiguousMovie, TODAY);
      expect(category).toBe('PENDING_VALIDATION');
    });
  });

  describe('4. Direct-to-OTT and Cross-Category Leakage Prevention', () => {
    it('must exclude direct-to-OTT titles from Upcoming in Theaters', () => {
      const ottFilm: MovieReleaseData = {
        movieId: 4444,
        title: 'Direct OTT Premiere',
        originalLanguage: 'hi',
        theatricalReleaseDate: '2026-11-10', // Has a date, but is direct to OTT
        theatricalStatus: 'UPCOMING',
        isDirectToOtt: true,
        ottReleaseDate: '2026-11-10',
        ottDateConfirmed: true,
        ottPlatforms: [
          {
            name: 'Netflix',
            availableInIndia: true,
            verified: true,
            availabilityType: 'SUBSCRIPTION'
          }
        ]
      };

      const category = classificationService.classifyMovie(ottFilm, TODAY);
      expect(category).not.toBe('UPCOMING_THEATRICAL');
      expect(category).toBe('UPCOMING_OTT');

      const validation = classificationService.validateUpcomingTheatrical(ottFilm, TODAY);
      expect(validation.isValid).toBe(false);
      expect(validation.rejectionReason).toBe('DIRECT_TO_OTT_EXCLUDED_FROM_THEATRICAL');
    });

    it('must guarantee mutual exclusivity with zero leakage', () => {
      const candidates: MovieReleaseData[] = [
        {
          movieId: 1,
          title: 'Future Theater',
          theatricalReleaseDate: '2026-11-20',
          theatricalStatus: 'UPCOMING',
          ottPlatforms: [],
          ottDateConfirmed: false
        },
        {
          movieId: 2,
          title: 'Currently in Theater',
          theatricalReleaseDate: '2026-10-10',
          theatricalStatus: 'CURRENTLY_RUNNING',
          ottPlatforms: [],
          ottDateConfirmed: false
        },
        {
          movieId: 3,
          title: 'Streaming On Hotstar',
          theatricalReleaseDate: '2026-08-01',
          theatricalStatus: 'ENDED',
          ottReleaseDate: '2026-10-01',
          ottDateConfirmed: true,
          ottPlatforms: [{ name: 'Disney+ Hotstar', availableInIndia: true, verified: true, availabilityType: 'SUBSCRIPTION' }]
        },
        {
          movieId: 4,
          title: 'Ambiguous Date',
          theatricalStatus: 'UNKNOWN',
          uncorroboratedDate: true,
          ottPlatforms: [],
          ottDateConfirmed: false
        }
      ];

      const assignedCategories = candidates.map(c => classificationService.classifyMovie(c, TODAY));
      expect(assignedCategories).toEqual([
        'UPCOMING_THEATRICAL',
        'NOW_IN_THEATERS',
        'NOW_STREAMING',
        'PENDING_VALIDATION'
      ]);
    });
  });
});
