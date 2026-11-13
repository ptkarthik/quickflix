import { TmdbProvider } from './tmdb.provider';

describe('TmdbProvider - Phase 2.6.2 Targeted Fixes', () => {
  let provider: TmdbProvider;
  let mockHttp: { get: jest.Mock };

  beforeEach(() => {
    provider = new TmdbProvider();
    mockHttp = { get: jest.fn() };
    (provider as any).http = mockHttp;
    jest.clearAllMocks();
  });

  describe('Fix 1: Quarantine of Curated TV Series', () => {
    it('should configure all 9 curated TV series with unconfirmed dates and quarantine flags', async () => {
      // In offline mode with deterministic reference date to avoid wall-clock drift
      const curatedSeries = await provider.discoverUpcomingTvSeries({ todayStr: '2026-10-24' });

      expect(curatedSeries.length).toBe(9);

      const expectedTitles = [
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

      for (const series of curatedSeries) {
        expect(expectedTitles).toContain(series.title);
        // Fix 1 assertions:
        expect(series.ottDateConfirmed).toBe(false);
        expect(series.uncorroboratedDate).toBe(true);
        expect(series.hasIndianTerritoryEvidence).toBe(false);
        expect(series.releaseEventType).toBe('UNKNOWN');
        expect(series.evidenceSource).toBe('CURATED_SPECULATIVE_DATE');

        // Platform should be identified and available in India
        if (series.ottPlatforms.length > 0) {
          expect(series.ottPlatforms[0].name).toBeDefined();
          expect(series.ottPlatforms[0].availableInIndia).toBe(true);
          expect(series.ottPlatforms[0].availableFrom).toBeUndefined();
        }
      }
    });
  });

  describe('Fix 2: TMDB Release Event Classification (Type 4 vs Type 5 & 6)', () => {
    it('should map Type 4 (Digital) to OTT, but strictly exclude Type 5 (Physical) and Type 6 (Linear TV)', async () => {
      // Set an API key so provider attempts API path
      (provider as any).apiKey = 'test-api-key';

      // Mock discover response with 1 movie
      mockHttp.get.mockImplementation((url: string) => {
        if (url.includes('/discover/movie')) {
          return Promise.resolve({
            data: {
              page: 1,
              total_pages: 1,
              total_results: 1,
              results: [
                {
                  id: 101,
                  title: 'Test Release Movie',
                  original_title: 'Test Release Movie',
                  original_language: 'hi',
                  release_date: '2026-11-20',
                  popularity: 10.0
                }
              ]
            }
          });
        }

        if (url.includes('/release_dates')) {
          return Promise.resolve({
            data: {
              results: [
                {
                  iso_3166_1: 'IN',
                  release_dates: [
                    { type: 3, release_date: '2026-10-15T00:00:00.000Z' }, // Theatrical
                    { type: 4, release_date: '2026-11-20T00:00:00.000Z' }, // Digital (OTT candidate)
                    { type: 5, release_date: '2026-12-01T00:00:00.000Z' }, // Physical (DVD/Blu-ray) - MUST EXCLUDE
                    { type: 6, release_date: '2026-12-15T00:00:00.000Z' }  // Linear TV - MUST EXCLUDE
                  ]
                }
              ]
            }
          });
        }

        if (url.includes('/watch/providers')) {
          return Promise.resolve({
            data: { results: {} }
          });
        }

        return Promise.resolve({ data: {} });
      });

      const { results } = await provider.discoverAllRaw();
      expect(results.length).toBe(1);

      const movie = results[0];
      const ottEvents = (movie.releaseEvents || []).filter((e: any) => e.type === 'OTT');
      const theatricalEvents = (movie.releaseEvents || []).filter((e: any) => e.type === 'THEATRICAL');

      // Theatrical event (Type 3) must be mapped
      expect(theatricalEvents.length).toBe(1);
      expect(theatricalEvents[0].date).toBe('2026-10-15');

      // Only Digital (Type 4) must be mapped to OTT
      expect(ottEvents.length).toBe(1);
      expect(ottEvents[0].date).toBe('2026-11-20');

      // Physical (Type 5: 2026-12-01) and Linear TV (Type 6: 2026-12-15) must NOT exist in OTT events
      const ottDates = ottEvents.map((e: any) => e.date);
      expect(ottDates).not.toContain('2026-12-01');
      expect(ottDates).not.toContain('2026-12-15');
    });

    it('should yield zero OTT events when candidate has only Physical (Type 5) and Linear TV (Type 6) events', async () => {
      (provider as any).apiKey = 'test-api-key';

      mockHttp.get.mockImplementation((url: string) => {
        if (url.includes('/discover/movie')) {
          return Promise.resolve({
            data: {
              page: 1,
              total_pages: 1,
              total_results: 1,
              results: [
                {
                  id: 102,
                  title: 'TV and Physical Only Film',
                  original_title: 'TV and Physical Only Film',
                  original_language: 'ta',
                  release_date: '2026-10-01',
                  popularity: 10.0
                }
              ]
            }
          });
        }

        if (url.includes('/release_dates')) {
          return Promise.resolve({
            data: {
              results: [
                {
                  iso_3166_1: 'IN',
                  release_dates: [
                    { type: 5, release_date: '2026-11-01T00:00:00.000Z' }, // Physical only
                    { type: 6, release_date: '2026-11-10T00:00:00.000Z' }  // Linear TV broadcast only
                  ]
                }
              ]
            }
          });
        }

        if (url.includes('/watch/providers')) {
          return Promise.resolve({ data: { results: {} } });
        }

        return Promise.resolve({ data: {} });
      });

      const { results } = await provider.discoverAllRaw();
      expect(results.length).toBe(1);

      const movie = results[0];
      const ottEvents = (movie.releaseEvents || []).filter((e: any) => e.type === 'OTT');
      // Must be strictly empty!
      expect(ottEvents).toEqual([]);
    });
  });
});
