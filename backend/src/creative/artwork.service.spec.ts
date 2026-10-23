import { 
  MovieArtworkService, 
  MovieIdentityVerifier, 
  WebArtworkDiscoveryService, 
  ArtworkCandidate 
} from './artwork.service';
import { TmdbProvider } from '../research/providers/tmdb.provider';

describe('MovieArtworkService & MovieIdentityVerifier (Regression Tests)', () => {
  describe('MovieIdentityVerifier', () => {
    it('should match Jailer 2 exact title', () => {
      expect(MovieIdentityVerifier.isTitleMatch('Jailer 2', 'Jailer 2')).toBe(true);
      expect(MovieIdentityVerifier.isTitleMatch('Jailer 2', 'jailer 2')).toBe(true);
      expect(MovieIdentityVerifier.isTitleMatch('Jailer 2', 'Jailer: Chapter 2')).toBe(true);
      expect(MovieIdentityVerifier.isTitleMatch('Jailer 2', 'Jailer II')).toBe(true);
    });

    it('should reject Jailer prequel when searching for Jailer 2', () => {
      expect(MovieIdentityVerifier.isTitleMatch('Jailer 2', 'Jailer')).toBe(false);
      expect(MovieIdentityVerifier.isTitleMatch('Jailer 2', 'Jailer (2023)')).toBe(false);
    });

    it('should reject Jailer 2.0 podcast when searching for Jailer 2', () => {
      expect(MovieIdentityVerifier.isTitleMatch('Jailer 2', 'Jailer 2.0')).toBe(false);

      const candidate: ArtworkCandidate = {
        id: 'c1',
        movieId: 'm1',
        imageUrl: 'https://example.com/jailer2_podcast.jpg',
        sourceUrl: 'https://imdb.com/title/123',
        sourceDomain: 'imdb.com',
        sourceType: 'IMDb',
        width: 1000,
        height: 1500,
        aspectRatio: 0.66,
        imageType: 'poster',
        confidenceScore: 0,
        qualityScore: 90,
        isOfficial: false,
        isDuplicate: false,
        verificationStatus: 'NEEDS_VERIFICATION',
        candidateTitle: 'Jailer 2.0',
        entityType: 'podcastSeries'
      };

      const result = MovieIdentityVerifier.verifyCandidate(candidate, 'Jailer 2');
      expect(result.verified).toBe(false);
    });

    it('should reject Trailer Park Boys when searching for Jailer 2', () => {
      expect(MovieIdentityVerifier.isTitleMatch('Jailer 2', 'Trailer Park Boys')).toBe(false);

      const candidate: ArtworkCandidate = {
        id: 'c2',
        movieId: 'm1',
        imageUrl: 'https://example.com/trailer.jpg',
        sourceUrl: 'https://imdb.com/title/456',
        sourceDomain: 'imdb.com',
        sourceType: 'IMDb',
        width: 1200,
        height: 1800,
        aspectRatio: 0.66,
        imageType: 'poster',
        confidenceScore: 0,
        qualityScore: 95,
        isOfficial: false,
        isDuplicate: false,
        verificationStatus: 'NEEDS_VERIFICATION',
        candidateTitle: 'Trailer Park Boys',
        entityType: 'tvSeries'
      };

      const result = MovieIdentityVerifier.verifyCandidate(candidate, 'Jailer 2');
      expect(result.verified).toBe(false);
    });

    it('should reject actor headshots and celebrity photos', () => {
      const candidate: ArtworkCandidate = {
        id: 'c3',
        movieId: 'm1',
        imageUrl: 'https://example.com/actress.jpg',
        sourceUrl: 'https://imdb.com/name/nm123',
        sourceDomain: 'imdb.com',
        sourceType: 'IMDb',
        width: 1200,
        height: 1800,
        aspectRatio: 0.66,
        imageType: 'poster',
        confidenceScore: 0,
        qualityScore: 95,
        isOfficial: false,
        isDuplicate: false,
        verificationStatus: 'NEEDS_VERIFICATION',
        candidateTitle: 'Some Actress',
        entityType: 'person'
      };

      const result = MovieIdentityVerifier.verifyCandidate(candidate, 'Jailer 2');
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('Disallowed entity type');
    });

    it('should reject similar titles containing the number 2 but different root words', () => {
      expect(MovieIdentityVerifier.isTitleMatch('Jailer 2', 'The Wailer 2')).toBe(false);
      expect(MovieIdentityVerifier.isTitleMatch('Jailer 2', 'Hailey Dean Mystery: 2 + 2 = Murder')).toBe(false);
      expect(MovieIdentityVerifier.isTitleMatch('Jailer 2', 'Pusher II')).toBe(false);
      expect(MovieIdentityVerifier.isTitleMatch('Jailer 2', "L'Esclave du Temps 2")).toBe(false);
    });

    it('should match legitimate alternate and localized titles', () => {
      const candidate: ArtworkCandidate = {
        id: 'c4',
        movieId: 'm2',
        imageUrl: 'https://example.com/empuraan.jpg',
        sourceUrl: 'https://imdb.com/title/789',
        sourceDomain: 'imdb.com',
        sourceType: 'IMDb',
        width: 1000,
        height: 1500,
        aspectRatio: 0.66,
        imageType: 'poster',
        confidenceScore: 0,
        qualityScore: 85,
        isOfficial: false,
        isDuplicate: false,
        verificationStatus: 'NEEDS_VERIFICATION',
        candidateTitle: 'Empuraan',
        entityType: 'movie'
      };

      const movieData = {
        title: 'L2: Empuraan',
        original_title: 'Empuraan',
        alternateTitles: ['Lucifer 2: Empuraan']
      };

      const result = MovieIdentityVerifier.verifyCandidate(candidate, 'L2: Empuraan', movieData);
      expect(result.verified).toBe(true);
    });

    it('should reject candidate if release year is drastically different (> 2 years difference)', () => {
      const candidate: ArtworkCandidate = {
        id: 'c5',
        movieId: 'm1',
        imageUrl: 'https://example.com/old.jpg',
        sourceUrl: 'https://imdb.com/title/101',
        sourceDomain: 'imdb.com',
        sourceType: 'IMDb',
        width: 1000,
        height: 1500,
        aspectRatio: 0.66,
        imageType: 'poster',
        confidenceScore: 0,
        qualityScore: 80,
        isOfficial: false,
        isDuplicate: false,
        verificationStatus: 'NEEDS_VERIFICATION',
        candidateTitle: 'Jailer 2',
        candidateYear: 2015,
        entityType: 'movie'
      };

      const movieData = {
        title: 'Jailer 2',
        releaseYear: 2026
      };

      const result = MovieIdentityVerifier.verifyCandidate(candidate, 'Jailer 2', movieData);
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('Year mismatch');
    });

    it('should match titles with extended subtitles or taglines', () => {
      expect(MovieIdentityVerifier.isTitleMatch(
        'OM Chapter 1: Udhiram', 
        'OM Chapter 1: Udhiram - The Blood Wood'
      )).toBe(true);

      expect(MovieIdentityVerifier.isTitleMatch(
        'Drishyam 3: The Conclusion', 
        'Drishyam 3'
      )).toBe(true);

      expect(MovieIdentityVerifier.isTitleMatch(
        'Toxic: A Fairy Tale for Grown-ups', 
        'Toxic'
      )).toBe(true);

      expect(MovieIdentityVerifier.isTitleMatch(
        'Ramayana: Part 1', 
        'Ramayana'
      )).toBe(true);
    });

    it('should reject outdated films using year property on movieData', () => {
      const candidate: ArtworkCandidate = {
        id: 'c6',
        movieId: 'm-ramayana',
        imageUrl: 'https://example.com/ramayana_1993.jpg',
        sourceUrl: 'https://imdb.com/title/tt0259534',
        sourceDomain: 'imdb.com',
        sourceType: 'IMDb',
        width: 1000,
        height: 1500,
        aspectRatio: 0.66,
        imageType: 'poster',
        confidenceScore: 0,
        qualityScore: 80,
        isOfficial: false,
        isDuplicate: false,
        verificationStatus: 'NEEDS_VERIFICATION',
        candidateTitle: 'Ramayana: The Legend of Prince Rama',
        candidateYear: 1993,
        entityType: 'movie'
      };

      const movieData = {
        title: 'Ramayana: Part 1',
        year: 2026
      };

      const result = MovieIdentityVerifier.verifyCandidate(candidate, 'Ramayana: Part 1', movieData);
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('Year mismatch');
    });
  });

  describe('MovieArtworkService Orchestration', () => {
    let artworkService: MovieArtworkService;
    let mockTmdbProvider: jest.Mocked<Partial<TmdbProvider>>;
    let mockWebDiscovery: jest.Mocked<Partial<WebArtworkDiscoveryService>>;

    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (typeof url === 'string' && (url.includes('broken') || url.includes('404'))) {
          return Promise.resolve({ ok: false, status: 404, headers: new Headers() });
        }
        const length = Buffer.from(url).reduce((acc, byte) => acc + byte, 1000) * 100;
        return Promise.resolve({ 
          ok: true, 
          status: 200, 
          headers: new Headers({ 'content-length': String(length) }) 
        });
      });

      mockTmdbProvider = {
        getMovieImages: jest.fn().mockResolvedValue({ posters: [] }),
        searchMovie: jest.fn().mockResolvedValue([])
      };
      mockWebDiscovery = {
        findMovieArtwork: jest.fn().mockResolvedValue([])
      };

      artworkService = new MovieArtworkService(
        mockTmdbProvider as TmdbProvider,
        mockWebDiscovery as WebArtworkDiscoveryService
      );
    });

    afterAll(() => {
      global.fetch = originalFetch;
    });

    it('should NOT invoke web discovery fallback when sufficient matching TMDB artwork exists', async () => {
      mockTmdbProvider.getMovieImages!.mockResolvedValueOnce({
        posters: [
          {
            file_path: '/jailer2_poster1.jpg',
            width: 1000,
            height: 1500,
            aspect_ratio: 0.66,
            vote_average: 8.5,
            vote_count: 50,
            iso_639_1: 'ta'
          },
          {
            file_path: '/jailer2_poster2.jpg',
            width: 1000,
            height: 1500,
            aspect_ratio: 0.66,
            vote_average: 7.9,
            vote_count: 30,
            iso_639_1: 'en'
          }
        ]
      } as any);

      const response = await artworkService.discoverArtwork('jailer-2', 12345, 'Jailer 2');

      expect(response.status).toBe('FOUND');
      expect(response.candidates.length).toBe(2);
      expect(response.candidates.every(c => c.sourceDomain === 'tmdb.org')).toBe(true);
      // Web discovery MUST NOT have been invoked
      expect(mockWebDiscovery.findMovieArtwork).not.toHaveBeenCalled();
    });

    it('should invoke web discovery fallback when TMDB has ZERO usable artwork', async () => {
      // TMDB returns no posters
      mockTmdbProvider.getMovieImages!.mockResolvedValueOnce({
        posters: []
      } as any);

      // Web discovery returns a mix of valid matching poster and invalid/unrelated artwork
      mockWebDiscovery.findMovieArtwork!.mockResolvedValueOnce([
        {
          id: 'valid_web_1',
          movieId: 'jailer-2',
          imageUrl: 'https://example.com/jailer2_official_web.jpg',
          sourceUrl: 'https://imdb.com/title/12345',
          sourceDomain: 'imdb.com',
          sourceType: 'IMDb',
          width: 1200,
          height: 1800,
          aspectRatio: 0.66,
          imageType: 'poster',
          confidenceScore: 0,
          qualityScore: 0,
          isOfficial: false,
          isDuplicate: false,
          verificationStatus: 'NEEDS_VERIFICATION',
          candidateTitle: 'Jailer 2',
          candidateYear: 2026,
          entityType: 'movie'
        },
        {
          id: 'invalid_headshot',
          movieId: 'jailer-2',
          imageUrl: 'https://example.com/pink_hat.jpg',
          sourceUrl: 'https://imdb.com/name/nm999',
          sourceDomain: 'imdb.com',
          sourceType: 'IMDb',
          width: 1200,
          height: 1800,
          aspectRatio: 0.66,
          imageType: 'poster',
          confidenceScore: 0,
          qualityScore: 0,
          isOfficial: false,
          isDuplicate: false,
          verificationStatus: 'NEEDS_VERIFICATION',
          candidateTitle: 'Jane Doe',
          entityType: 'person'
        },
        {
          id: 'invalid_trailer_park',
          movieId: 'jailer-2',
          imageUrl: 'https://example.com/trailer_park.jpg',
          sourceUrl: 'https://imdb.com/title/999',
          sourceDomain: 'imdb.com',
          sourceType: 'IMDb',
          width: 1200,
          height: 1800,
          aspectRatio: 0.66,
          imageType: 'poster',
          confidenceScore: 0,
          qualityScore: 0,
          isOfficial: false,
          isDuplicate: false,
          verificationStatus: 'NEEDS_VERIFICATION',
          candidateTitle: 'Trailer Park Boys',
          entityType: 'tvSeries'
        }
      ]);

      const response = await artworkService.discoverArtwork('jailer-2', 'none', 'Jailer 2', {
        title: 'Jailer 2',
        releaseYear: 2026
      });

      expect(mockWebDiscovery.findMovieArtwork).toHaveBeenCalledTimes(1);
      expect(response.status).toBe('FOUND');
      // Only the strictly verified candidate should reach the gallery
      expect(response.candidates.length).toBe(1);
      expect(response.candidates[0].candidateTitle).toBe('Jailer 2');
      expect(response.candidates[0].verificationStatus).toBe('VERIFIED');
    });

    it('should reject high-scoring but unverified IMDb images and never include them in the gallery', async () => {
      mockTmdbProvider.getMovieImages!.mockResolvedValueOnce({ posters: [] } as any);

      // Candidate has 4K resolution and correct aspect ratio, but unrelated title
      mockWebDiscovery.findMovieArtwork!.mockResolvedValueOnce([
        {
          id: 'unrelated_4k_image',
          movieId: 'jailer-2',
          imageUrl: 'https://example.com/french_film_4k.jpg',
          sourceUrl: 'https://imdb.com/title/french123',
          sourceDomain: 'imdb.com',
          sourceType: 'IMDb',
          width: 3840,
          height: 2160,
          aspectRatio: 0.66,
          imageType: 'poster',
          confidenceScore: 0,
          qualityScore: 0,
          isOfficial: false,
          isDuplicate: false,
          verificationStatus: 'NEEDS_VERIFICATION',
          candidateTitle: "L'Esclave du Temps (Carnet filmé 2)",
          entityType: 'movie'
        }
      ]);

      const response = await artworkService.discoverArtwork('jailer-2', 'none', 'Jailer 2');

      // Since the only candidate is unrelated, it is rejected and gallery is empty
      expect(response.status).toBe('NO_VERIFIED_ARTWORK');
      expect(response.candidates.length).toBe(0);
    });

    it('should invoke fallback if TMDB returns broken or unusable image paths (safeguard)', async () => {
      // TMDB returns items with empty file paths or 0 dimensions
      mockTmdbProvider.getMovieImages!.mockResolvedValueOnce({
        posters: [
          {
            file_path: '',
            width: 0,
            height: 0
          }
        ]
      } as any);

      mockWebDiscovery.findMovieArtwork!.mockResolvedValueOnce([
        {
          id: 'valid_fallback',
          movieId: 'jailer-2',
          imageUrl: 'https://example.com/jailer2_fallback.jpg',
          sourceUrl: 'https://imdb.com/title/12345',
          sourceDomain: 'imdb.com',
          sourceType: 'IMDb',
          width: 1000,
          height: 1500,
          aspectRatio: 0.66,
          imageType: 'poster',
          confidenceScore: 0,
          qualityScore: 0,
          isOfficial: false,
          isDuplicate: false,
          verificationStatus: 'NEEDS_VERIFICATION',
          candidateTitle: 'Jailer 2',
          candidateYear: 2026,
          entityType: 'movie'
        }
      ]);

      const response = await artworkService.discoverArtwork('jailer-2', 'broken_tmdb', 'Jailer 2');

      // Fallback allowed to run because TMDB had 0 usable posters
      expect(mockWebDiscovery.findMovieArtwork).toHaveBeenCalledTimes(1);
      expect(response.status).toBe('FOUND');
      expect(response.candidates.length).toBe(1);
    });

    it('should search TMDB by title when tmdbId is a synthetic curated ID', async () => {
      mockTmdbProvider.searchMovie!.mockResolvedValueOnce([
        {
          id: 954445,
          title: 'Yezhu Kadal Yezhu Malai',
          poster_path: '/official_tmdb_poster.jpg'
        }
      ]);
      mockTmdbProvider.getMovieImages!.mockResolvedValueOnce({
        posters: [
          {
            file_path: '/official_tmdb_poster.jpg',
            width: 1000,
            height: 1500,
            aspect_ratio: 0.66
          }
        ]
      } as any);

      const response = await artworkService.discoverArtwork(
        'tmdb:ut-t01', 
        'ut-t01', 
        'Yezhu Kadal Yezhu Malai',
        { title: 'Yezhu Kadal Yezhu Malai', year: 2026 }
      );

      expect(mockTmdbProvider.searchMovie).toHaveBeenCalled();
      expect(response.status).toBe('FOUND');
      expect(response.candidates.length).toBeGreaterThan(0);
      expect(response.candidates[0].sourceDomain).toBe('tmdb.org');
    });

    it('should show NO_VERIFIED_ARTWORK and never fabricate an image when all candidates are unverified', async () => {
      mockTmdbProvider.getMovieImages!.mockResolvedValueOnce({ posters: [] } as any);
      mockWebDiscovery.findMovieArtwork!.mockResolvedValueOnce([]);

      const response = await artworkService.discoverArtwork('unknown-movie', 'none', 'Unknown Indie Film');

      expect(response.status).toBe('NO_VERIFIED_ARTWORK');
      expect(response.candidates).toEqual([]);
      expect(response.verifiedCandidates).toBe(0);
    });
  });
});

