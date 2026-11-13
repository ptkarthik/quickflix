import { NowInTheatersValidatorService, TheatricalCandidateInput } from './now-in-theaters-validator.service';

describe('NowInTheatersValidatorService - Synthetic Boundary & Invariance Suite', () => {
  let validator: NowInTheatersValidatorService;
  const TODAY = '2026-10-24'; // Fixed reference calendar date in Asia/Kolkata

  beforeEach(() => {
    validator = new NowInTheatersValidatorService();
  });

  describe('Synthetic Test Fixtures (SYN-01 through SYN-12)', () => {
    // SYN-01: Day 0 Boundary (Releasing Today)
    it('SYN-01: Day 0 Boundary - movie releasing today with confirmed showtimes classifies as CONFIRMED_NOW_IN_THEATERS', () => {
      const candidate: TheatricalCandidateInput = {
        title: 'Synthetic Release Today',
        theatricalReleaseDate: '2026-10-24',
        hasExplicitIndianTheatricalEvent: true,
        indianReleaseEvents: [{ type: 3, date: '2026-10-24' }],
        activeExhibition: {
          hasConfirmedActiveShowtimes: true,
          source: 'AUDITED_SHOWTIME_FIXTURE',
        },
      };

      const result = validator.validateTheatricalCandidate(candidate, TODAY);

      expect(result.status).toBe('CONFIRMED_NOW_IN_THEATERS');
      expect(result.reasonCode).toBe('EXHIBITION_CONFIRMED_FRESH_SHOWTIMES');
      expect(result.isEligibleForPublicFeed).toBe(true);
      expect(result.activeExhibitionConfirmed).toBe(true);
      expect(result.theatricalDateUsed).toBe('2026-10-24');
    });

    // SYN-02: Day 10 Active Run
    it('SYN-02: Day 10 Active Run - released 10 days ago with confirmed showtimes and no OTT classifies as CONFIRMED_NOW_IN_THEATERS', () => {
      const candidate: TheatricalCandidateInput = {
        title: 'Synthetic 10-Day Run',
        theatricalReleaseDate: '2026-10-14',
        hasExplicitIndianTheatricalEvent: true,
        indianReleaseEvents: [{ type: 3, date: '2026-10-14' }],
        isStreamingInIndia: false,
        activeExhibition: {
          hasConfirmedActiveShowtimes: true,
          source: 'AUDITED_SHOWTIME_FIXTURE',
        },
      };

      const result = validator.validateTheatricalCandidate(candidate, TODAY);

      expect(result.status).toBe('CONFIRMED_NOW_IN_THEATERS');
      expect(result.reasonCode).toBe('EXHIBITION_CONFIRMED_FRESH_SHOWTIMES');
      expect(result.isEligibleForPublicFeed).toBe(true);
      expect(result.isSimultaneouslyStreaming).toBe(false);
    });

    // SYN-03: Day 45 Upper Limit Boundary
    it('SYN-03: Day 45 Upper Limit Boundary - exactly 45 days ago with confirmed showtimes classifies as CONFIRMED_NOW_IN_THEATERS', () => {
      // 2026-10-24 - 45 days = 2026-09-09
      expect(validator.calculateCalendarDaysDiff('2026-09-09', TODAY)).toBe(45);

      const candidate: TheatricalCandidateInput = {
        title: 'Synthetic Day 45 Boundary',
        theatricalReleaseDate: '2026-09-09',
        hasExplicitIndianTheatricalEvent: true,
        indianReleaseEvents: [{ type: 3, date: '2026-09-09' }],
        activeExhibition: {
          hasConfirmedActiveShowtimes: true,
          source: 'AUDITED_SHOWTIME_FIXTURE',
        },
      };

      const result = validator.validateTheatricalCandidate(candidate, TODAY);

      expect(result.status).toBe('CONFIRMED_NOW_IN_THEATERS');
      expect(result.reasonCode).toBe('EXHIBITION_CONFIRMED_FRESH_SHOWTIMES');
      expect(result.isEligibleForPublicFeed).toBe(true);
    });

    // SYN-04: Day 46 Expired Run (No Showtimes)
    it('SYN-04: Day 46 Expired Run - 46 days ago with no showtimes classifies as EXCLUDED_THEATRICAL_RUN_ENDED', () => {
      // 2026-10-24 - 46 days = 2026-09-08
      expect(validator.calculateCalendarDaysDiff('2026-09-08', TODAY)).toBe(46);

      const candidate: TheatricalCandidateInput = {
        title: 'Synthetic Day 46 Expired',
        theatricalReleaseDate: '2026-09-08',
        hasExplicitIndianTheatricalEvent: true,
        indianReleaseEvents: [{ type: 3, date: '2026-09-08' }],
        activeExhibition: {
          hasConfirmedActiveShowtimes: false,
          source: 'NONE',
        },
      };

      const result = validator.validateTheatricalCandidate(candidate, TODAY);

      expect(result.status).toBe('EXCLUDED_THEATRICAL_RUN_ENDED');
      expect(result.reasonCode).toBe('THEATRICAL_RUN_ENDED_NO_SHOWTIMES');
      expect(result.isEligibleForPublicFeed).toBe(false);
    });

    // SYN-05: Day 70 Extended Blockbuster Run (Age does NOT disqualify when showtimes exist)
    it('SYN-05: Day 70 Extended Run - blockbuster older than 45 days with confirmed showtimes classifies as CONFIRMED_NOW_IN_THEATERS', () => {
      // 2026-10-24 - 70 days = 2026-08-15
      expect(validator.calculateCalendarDaysDiff('2026-08-15', TODAY)).toBe(70);

      const candidate: TheatricalCandidateInput = {
        title: 'Synthetic Day 70 Blockbuster',
        theatricalReleaseDate: '2026-08-15',
        hasExplicitIndianTheatricalEvent: true,
        indianReleaseEvents: [{ type: 3, date: '2026-08-15' }],
        activeExhibition: {
          hasConfirmedActiveShowtimes: true,
          source: 'AUDITED_SHOWTIME_FIXTURE',
        },
      };

      const result = validator.validateTheatricalCandidate(candidate, TODAY);

      // Deciding Evidence Rule: active showtimes qualify regardless of age
      expect(result.status).toBe('CONFIRMED_NOW_IN_THEATERS');
      expect(result.reasonCode).toBe('EXHIBITION_CONFIRMED_EXTENDED_RUN');
      expect(result.isEligibleForPublicFeed).toBe(true);
      expect(result.activeExhibitionConfirmed).toBe(true);
    });

    // SYN-06: Theatrical & OTT Coexistence
    it('SYN-06: Theatrical & OTT Coexistence - confirmed showtimes + streaming availability retains theatrical status with dual flag', () => {
      const candidate: TheatricalCandidateInput = {
        title: 'Synthetic Simultaneous Release',
        theatricalReleaseDate: '2026-09-15',
        hasExplicitIndianTheatricalEvent: true,
        indianReleaseEvents: [{ type: 3, date: '2026-09-15' }],
        isStreamingInIndia: true,
        streamingPlatforms: ['Netflix'],
        activeExhibition: {
          hasConfirmedActiveShowtimes: true,
          source: 'AUDITED_SHOWTIME_FIXTURE',
        },
      };

      const result = validator.validateTheatricalCandidate(candidate, TODAY);

      // OTT does NOT cancel confirmed cinema exhibition
      expect(result.status).toBe('CONFIRMED_NOW_IN_THEATERS');
      expect(result.reasonCode).toBe('EXHIBITION_CONFIRMED_COEXISTING_OTT');
      expect(result.isSimultaneouslyStreaming).toBe(true);
      expect(result.isEligibleForPublicFeed).toBe(true);
    });

    // SYN-07: Re-Release with Active Showtimes (Original year preserved)
    it('SYN-07: Re-Release with Active Showtimes - original year 2004 preserved, active re-release showtimes qualifies', () => {
      const candidate: TheatricalCandidateInput = {
        title: 'Synthetic Classic 4K Re-Release',
        originalReleaseYear: 2004,
        originalReleaseDate: '2004-04-16',
        theatricalReleaseDate: '2004-04-16', // Base date is historical
        hasExplicitIndianTheatricalEvent: true,
        reReleaseEvent: {
          isReRelease: true,
          originalReleaseDate: '2004-04-16',
          originalReleaseYear: 2004,
          reReleaseDate: '2026-10-12', // Re-released 12 days ago
          reReleaseCountry: 'IN',
          reReleaseType: 'THEATRICAL_RE_RELEASE',
          evidenceSource: 'TMDB_IN_RE_RELEASE_EVENT',
          evidenceConfidence: 'HIGH',
        },
        activeExhibition: {
          hasConfirmedActiveShowtimes: true,
          source: 'AUDITED_SHOWTIME_FIXTURE',
        },
      };

      const result = validator.validateTheatricalCandidate(candidate, TODAY);

      expect(result.status).toBe('CONFIRMED_NOW_IN_THEATERS');
      expect(result.reasonCode).toBe('EXHIBITION_CONFIRMED_RE_RELEASE');
      expect(result.isEligibleForPublicFeed).toBe(true);
      expect(result.originalReleaseYear).toBe(2004); // Original year preserved!
      expect(result.theatricalDateUsed).toBe('2026-10-12'); // Re-release date used for run
      expect(result.reReleaseEvent?.isReRelease).toBe(true);
    });

    // SYN-08: Re-Release Expired (No Showtimes)
    it('SYN-08: Re-Release Expired - re-release older than 45 days with no showtimes classifies as EXCLUDED_THEATRICAL_RUN_ENDED', () => {
      // 2026-08-01 is 84 days ago relative to 2026-10-24
      const candidate: TheatricalCandidateInput = {
        title: 'Synthetic Past Re-Release',
        originalReleaseYear: 2018,
        originalReleaseDate: '2018-10-12',
        hasExplicitIndianTheatricalEvent: true,
        reReleaseEvent: {
          isReRelease: true,
          originalReleaseDate: '2018-10-12',
          originalReleaseYear: 2018,
          reReleaseDate: '2026-08-01',
          reReleaseCountry: 'IN',
          reReleaseType: 'THEATRICAL_RE_RELEASE',
          evidenceSource: 'TMDB_IN_RE_RELEASE_EVENT',
          evidenceConfidence: 'HIGH',
        },
        activeExhibition: {
          hasConfirmedActiveShowtimes: false,
          source: 'NONE',
        },
      };

      const result = validator.validateTheatricalCandidate(candidate, TODAY);

      expect(result.status).toBe('EXCLUDED_THEATRICAL_RUN_ENDED');
      expect(result.reasonCode).toBe('THEATRICAL_RUN_ENDED_NO_SHOWTIMES');
      expect(result.isEligibleForPublicFeed).toBe(false);
      expect(result.originalReleaseYear).toBe(2018);
    });

    // SYN-09: Recent Release Awaiting Showtimes (Unconfirmed Exhibition excluded from public feed)
    it('SYN-09: Recent Release Awaiting Showtimes - released 6 days ago but lacking showtimes is quarantined from public feed', () => {
      const candidate: TheatricalCandidateInput = {
        title: 'Synthetic Recent Release No Showtimes',
        theatricalReleaseDate: '2026-10-18', // 6 days ago
        hasExplicitIndianTheatricalEvent: true,
        indianReleaseEvents: [{ type: 3, date: '2026-10-18' }],
        activeExhibition: undefined, // No live showtime provider available
      };

      const result = validator.validateTheatricalCandidate(candidate, TODAY);

      // System NEVER assumes a recent date proves active cinema screenings
      expect(result.status).toBe('RECENT_RELEASE_UNCONFIRMED_EXHIBITION');
      expect(result.reasonCode).toBe('RECENT_RELEASE_AWAITING_SHOWTIME_EVIDENCE');
      expect(result.isEligibleForPublicFeed).toBe(false);
      expect(result.activeExhibitionConfirmed).toBe(false);
    });

    // SYN-10: Overseas / Festival Only (No Indian Theatrical Event)
    it('SYN-10: Overseas Only - entity with foreign events but no Indian event classifies as QUARANTINED_OVERSEAS_ONLY', () => {
      const candidate: TheatricalCandidateInput = {
        title: 'Synthetic Overseas Festival Film',
        theatricalReleaseDate: undefined,
        hasExplicitIndianTheatricalEvent: false,
        foreignReleaseEvents: [{ country: 'FR', type: 3, date: '2026-10-02' }],
      };

      const result = validator.validateTheatricalCandidate(candidate, TODAY);

      expect(result.status).toBe('QUARANTINED_OVERSEAS_ONLY');
      expect(result.reasonCode).toBe('OVERSEAS_DATE_NOT_APPLICABLE_TO_INDIA');
      expect(result.isEligibleForPublicFeed).toBe(false);
    });

    // SYN-11: Date Conflict (> 7 Days Variance between TMDB and OMDb)
    it('SYN-11: Date Conflict - variance of 20 days between TMDB and OMDb classifies as QUARANTINED_DATE_CONFLICT', () => {
      const candidate: TheatricalCandidateInput = {
        title: 'Synthetic Conflicting Dates Film',
        theatricalReleaseDate: '2026-10-10',
        hasExplicitIndianTheatricalEvent: true,
        omdbReleasedDate: '2026-09-20', // 20 days difference
        activeExhibition: {
          hasConfirmedActiveShowtimes: true,
          source: 'AUDITED_SHOWTIME_FIXTURE',
        },
      };

      const result = validator.validateTheatricalCandidate(candidate, TODAY);

      expect(result.status).toBe('QUARANTINED_DATE_CONFLICT');
      expect(result.reasonCode).toBe('DATE_CONFLICT_TMDB_VS_OMDB');
      expect(result.isEligibleForPublicFeed).toBe(false);
    });

    // SYN-12: Future Release (> Today)
    it('SYN-12: Future Release - calendar date in the future routes to UPCOMING_THEATRICAL', () => {
      const candidate: TheatricalCandidateInput = {
        title: 'Synthetic Future Film',
        theatricalReleaseDate: '2026-11-15', // Future relative to 2026-10-24
        hasExplicitIndianTheatricalEvent: true,
      };

      const result = validator.validateTheatricalCandidate(candidate, TODAY);

      expect(result.status).toBe('UPCOMING_THEATRICAL');
      expect(result.reasonCode).toBe('FUTURE_THEATRICAL_DATE');
      expect(result.isEligibleForPublicFeed).toBe(false);
    });
  });

  describe('Mathematical Boundary Invariance', () => {
    it('should calculate calendar date differences strictly normalized to UTC midnight', () => {
      expect(validator.calculateCalendarDaysDiff('2026-10-14', '2026-10-24')).toBe(10);
      expect(validator.calculateCalendarDaysDiff('2026-09-09', '2026-10-24')).toBe(45);
      expect(validator.calculateCalendarDaysDiff('2026-09-08', '2026-10-24')).toBe(46);
      expect(validator.calculateCalendarDaysDiff('2026-08-15', '2026-10-24')).toBe(70);
    });

    it('should strictly exclude candidates from isEligibleForPublicFeed unless CONFIRMED_NOW_IN_THEATERS', () => {
      const unconfirmed: TheatricalCandidateInput = {
        title: 'Unconfirmed Candidate',
        theatricalReleaseDate: '2026-10-20',
        hasExplicitIndianTheatricalEvent: true,
      };
      const res1 = validator.validateTheatricalCandidate(unconfirmed, TODAY);
      expect(res1.isEligibleForPublicFeed).toBe(false);

      const confirmed: TheatricalCandidateInput = {
        title: 'Confirmed Candidate',
        theatricalReleaseDate: '2026-10-20',
        hasExplicitIndianTheatricalEvent: true,
        activeExhibition: { hasConfirmedActiveShowtimes: true, source: 'AUDITED_SHOWTIME_FIXTURE' },
      };
      const res2 = validator.validateTheatricalCandidate(confirmed, TODAY);
      expect(res2.isEligibleForPublicFeed).toBe(true);
    });
  });

  describe('Stage 1 Date Hardening & Calendar Invariance', () => {
    it('should reject a malformed date such as INVALID with QUARANTINED_INVALID_DATE', () => {
      const candidate: TheatricalCandidateInput = {
        title: 'Malformed Date Movie',
        theatricalReleaseDate: 'INVALID',
        hasExplicitIndianTheatricalEvent: true,
      };

      const result = validator.validateTheatricalCandidate(candidate, TODAY);

      expect(result.status).toBe('QUARANTINED_INVALID_DATE');
      expect(result.reasonCode).toBe('INVALID_CALENDAR_DATE_FORMAT');
      expect(result.isEligibleForPublicFeed).toBe(false);
      expect(result.activeExhibitionConfirmed).toBe(false);
    });

    it('should reject a partial date such as 2026 with QUARANTINED_INVALID_DATE', () => {
      const candidate: TheatricalCandidateInput = {
        title: 'Partial Date Movie',
        theatricalReleaseDate: '2026',
        hasExplicitIndianTheatricalEvent: true,
      };

      const result = validator.validateTheatricalCandidate(candidate, TODAY);

      expect(result.status).toBe('QUARANTINED_INVALID_DATE');
      expect(result.reasonCode).toBe('INVALID_CALENDAR_DATE_FORMAT');
      expect(result.isEligibleForPublicFeed).toBe(false);
    });

    it('should reject an impossible calendar date such as 2026-02-30 with QUARANTINED_INVALID_DATE', () => {
      expect(validator.isValidCalendarDate('2026-02-30')).toBe(false);

      const candidate: TheatricalCandidateInput = {
        title: 'Impossible Date Movie',
        theatricalReleaseDate: '2026-02-30',
        hasExplicitIndianTheatricalEvent: true,
      };

      const result = validator.validateTheatricalCandidate(candidate, TODAY);

      expect(result.status).toBe('QUARANTINED_INVALID_DATE');
      expect(result.reasonCode).toBe('INVALID_CALENDAR_DATE_FORMAT');
      expect(result.isEligibleForPublicFeed).toBe(false);
    });

    it('should correctly accept a valid leap date such as 2024-02-29 and reject non-leap 2023-02-29', () => {
      expect(validator.isValidCalendarDate('2024-02-29')).toBe(true);
      expect(validator.isValidCalendarDate('2023-02-29')).toBe(false);
      expect(validator.isValidCalendarDate('2026-02-29')).toBe(false);
      expect(validator.isValidCalendarDate('2000-02-29')).toBe(true);
      expect(validator.isValidCalendarDate('1900-02-29')).toBe(false);

      const candidate: TheatricalCandidateInput = {
        title: 'Leap Year Release',
        theatricalReleaseDate: '2024-02-29',
        hasExplicitIndianTheatricalEvent: true,
        activeExhibition: {
          hasConfirmedActiveShowtimes: true,
          source: 'AUDITED_SHOWTIME_FIXTURE',
        },
      };

      const result = validator.validateTheatricalCandidate(candidate, '2024-02-29');

      expect(result.status).toBe('CONFIRMED_NOW_IN_THEATERS');
      expect(result.reasonCode).toBe('EXHIBITION_CONFIRMED_FRESH_SHOWTIMES');
      expect(result.isEligibleForPublicFeed).toBe(true);
    });

    it('should calculate year-boundary calendar differences such as 2026-12-20 to 2027-01-05 as exactly 16 days', () => {
      const diff = validator.calculateCalendarDaysDiff('2026-12-20', '2027-01-05');
      expect(diff).toBe(16);
    });

    it('should correctly handle IST midnight rollover using fixed UTC timestamps', () => {
      // 18:29:59 UTC on Oct 24 = 23:59:59 IST on Oct 24
      const justBeforeMidnightUtc = new Date('2026-10-24T18:29:59.000Z');
      expect(validator.getIndiaTodayDateStr(justBeforeMidnightUtc)).toBe('2026-10-24');

      // 18:30:00 UTC on Oct 24 = 00:00:00 IST on Oct 25 (Midnight in India!)
      const exactlyMidnightUtc = new Date('2026-10-24T18:30:00.000Z');
      expect(validator.getIndiaTodayDateStr(exactlyMidnightUtc)).toBe('2026-10-25');

      // 20:30:00 UTC on Oct 24 = 02:00:00 IST on Oct 25
      const earlyMorningUtc = new Date('2026-10-24T20:30:00.000Z');
      expect(validator.getIndiaTodayDateStr(earlyMorningUtc)).toBe('2026-10-25');
    });

    it('should throw an explicit error if an invalid calendar date is passed to calculateCalendarDaysDiff', () => {
      expect(() => validator.calculateCalendarDaysDiff('INVALID', '2026-10-24')).toThrow(
        /Invalid calendar date/
      );
      expect(() => validator.calculateCalendarDaysDiff('2026-02-30', '2026-10-24')).toThrow(
        /Invalid calendar date/
      );
    });

    it('should reject non-string and missing dates with QUARANTINED_INVALID_DATE when claiming Indian theatrical event', () => {
      // Missing / undefined date
      const missingCandidate: TheatricalCandidateInput = {
        title: 'Missing Date Movie',
        theatricalReleaseDate: undefined,
        hasExplicitIndianTheatricalEvent: true,
      };
      const resMissing = validator.validateTheatricalCandidate(missingCandidate, TODAY);
      expect(resMissing.status).toBe('QUARANTINED_INVALID_DATE');
      expect(resMissing.reasonCode).toBe('INVALID_CALENDAR_DATE_FORMAT');
      expect(resMissing.isEligibleForPublicFeed).toBe(false);

      // Non-string date
      const nonStringCandidate: TheatricalCandidateInput = {
        title: 'Non-String Date Movie',
        theatricalReleaseDate: 12345 as any,
        hasExplicitIndianTheatricalEvent: true,
      };
      const resNonString = validator.validateTheatricalCandidate(nonStringCandidate, TODAY);
      expect(resNonString.status).toBe('QUARANTINED_INVALID_DATE');
      expect(resNonString.reasonCode).toBe('INVALID_CALENDAR_DATE_FORMAT');

      // Empty string date
      const emptyStringCandidate: TheatricalCandidateInput = {
        title: 'Empty Date Movie',
        theatricalReleaseDate: '',
        hasExplicitIndianTheatricalEvent: true,
      };
      const resEmpty = validator.validateTheatricalCandidate(emptyStringCandidate, TODAY);
      expect(resEmpty.status).toBe('QUARANTINED_INVALID_DATE');
      expect(resEmpty.reasonCode).toBe('INVALID_CALENDAR_DATE_FORMAT');
    });

    it('should reject malformed or impossible re-release and OMDb dates with QUARANTINED_INVALID_DATE', () => {
      // Re-release impossible date
      const impossibleReRelease: TheatricalCandidateInput = {
        title: 'Impossible Re-Release',
        theatricalReleaseDate: '2020-01-01',
        hasExplicitIndianTheatricalEvent: true,
        reReleaseEvent: {
          isReRelease: true,
          originalReleaseDate: '2020-01-01',
          originalReleaseYear: 2020,
          reReleaseDate: '2026-02-30', // Impossible date
          reReleaseCountry: 'IN',
          reReleaseType: 'THEATRICAL_RE_RELEASE',
          evidenceSource: 'TMDB_IN_RE_RELEASE_EVENT',
          evidenceConfidence: 'HIGH',
        },
      };
      const resReRel = validator.validateTheatricalCandidate(impossibleReRelease, TODAY);
      expect(resReRel.status).toBe('QUARANTINED_INVALID_DATE');
      expect(resReRel.reasonCode).toBe('INVALID_CALENDAR_DATE_FORMAT');

      // OMDb malformed date
      const malformedOmdb: TheatricalCandidateInput = {
        title: 'Malformed OMDb Date',
        theatricalReleaseDate: '2026-10-15',
        hasExplicitIndianTheatricalEvent: true,
        omdbReleasedDate: 'INVALID_OMDB_DATE',
      };
      const resOmdb = validator.validateTheatricalCandidate(malformedOmdb, TODAY);
      expect(resOmdb.status).toBe('QUARANTINED_INVALID_DATE');
      expect(resOmdb.reasonCode).toBe('INVALID_CALENDAR_DATE_FORMAT');
    });

    it('should preserve existing valid day-45 and day-46 behavior unchanged', () => {
      expect(validator.calculateCalendarDaysDiff('2026-09-09', TODAY)).toBe(45);
      expect(validator.calculateCalendarDaysDiff('2026-09-08', TODAY)).toBe(46);
    });
  });

  describe('TmdbProvider - discoverRecentPastTheatricalCandidates (Isolated Candidate Discovery)', () => {
    it('should return degraded telemetry when API key is missing', async () => {
      const { TmdbProvider } = require('../providers/tmdb.provider');
      const provider = new TmdbProvider();
      (provider as any).apiKey = undefined;

      const result = await provider.discoverRecentPastTheatricalCandidates({ referenceDateStr: TODAY });

      expect(result.candidates).toEqual([]);
      expect(result.telemetry.coverageCompletenessStatus).toBe('PROVIDER_DEGRADED');
      expect(result.telemetry.providerErrors[0].error).toBe('NO_TMDB_API_KEY');
    });

    it('should strictly require explicit IN theatrical release events and never substitute overseas dates', async () => {
      const { TmdbProvider } = require('../providers/tmdb.provider');
      const provider = new TmdbProvider();
      (provider as any).apiKey = 'test-key';

      // Mock http.get
      (provider as any).http.get = jest.fn((url: string) => {
        if (url.includes('/discover/movie')) {
          return Promise.resolve({
            data: {
              page: 1,
              total_pages: 1,
              total_results: 2,
              results: [
                { id: 101, title: 'Indian Cinema Release', original_language: 'ta', release_date: '2026-10-15', popularity: 25.0 },
                { id: 102, title: 'Cannes Festival Film', original_language: 'ml', release_date: '2026-10-02', popularity: 15.0 },
              ],
            },
          });
        }
        if (url.includes('/movie/101/release_dates')) {
          return Promise.resolve({
            data: {
              results: [
                {
                  iso_3166_1: 'IN',
                  release_dates: [{ type: 3, release_date: '2026-10-15T00:00:00.000Z' }],
                },
              ],
            },
          });
        }
        if (url.includes('/movie/102/release_dates')) {
          return Promise.resolve({
            data: {
              results: [
                {
                  iso_3166_1: 'FR',
                  release_dates: [{ type: 3, release_date: '2026-10-02T00:00:00.000Z' }],
                },
              ],
            },
          });
        }
        if (url.includes('/watch/providers')) {
          return Promise.resolve({
            data: { results: {} },
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      const result = await provider.discoverRecentPastTheatricalCandidates({
        referenceDateStr: TODAY,
        languages: ['ta'],
      });

      expect(result.candidates.length).toBe(2);

      const candidateA = result.candidates.find((c: any) => c.id === 101);
      expect(candidateA.hasExplicitIndianTheatricalEvent).toBe(true);
      expect(candidateA.theatricalReleaseDate).toBe('2026-10-15');

      const candidateB = result.candidates.find((c: any) => c.id === 102);
      expect(candidateB.hasExplicitIndianTheatricalEvent).toBe(false);
      // Strictly undefined: Never substitutes global release_date or French date!
      expect(candidateB.theatricalReleaseDate).toBeUndefined();
      expect(candidateB.foreignReleaseEvents.length).toBe(1);
      expect(candidateB.foreignReleaseEvents[0].country).toBe('FR');

      expect(result.telemetry.coverageCompletenessStatus).toBe('COMPLETE');
      expect(result.telemetry.isScanTruncated).toBe(false);
      expect(result.telemetry.uniqueDeduplicatedCandidates).toBe(2);
    });
  });

  describe('NowInTheatersAuditService - Stage 2 Diagnostic Orchestration', () => {
    let auditService: any;
    let mockTmdbProvider: any;
    let validatorService: NowInTheatersValidatorService;

    beforeEach(() => {
      validatorService = new NowInTheatersValidatorService();
      mockTmdbProvider = {
        discoverRecentPastTheatricalCandidates: jest.fn(),
      };
      const { NowInTheatersAuditService } = require('./now-in-theaters-audit.service');
      auditService = new NowInTheatersAuditService(mockTmdbProvider, validatorService);
    });

    it('should query all 10 configured regional languages and report exhibitionEvidenceProvider as NONE_INTEGRATED', async () => {
      mockTmdbProvider.discoverRecentPastTheatricalCandidates.mockResolvedValue({
        candidates: [
          {
            id: 201,
            tmdbId: 201,
            title: 'Tamil Hit Film',
            originalLanguage: 'ta',
            theatricalReleaseDate: '2026-10-10',
            hasExplicitIndianTheatricalEvent: true,
            indianReleaseEvents: [{ type: 3, date: '2026-10-10' }],
            foreignReleaseEvents: [],
            isStreamingInIndia: false,
          },
          {
            id: 202,
            tmdbId: 202,
            title: 'Telugu Blockbuster',
            originalLanguage: 'te',
            theatricalReleaseDate: '2026-10-15',
            hasExplicitIndianTheatricalEvent: true,
            indianReleaseEvents: [{ type: 3, date: '2026-10-15' }],
            foreignReleaseEvents: [],
            isStreamingInIndia: true,
            ottPlatforms: [{ name: 'Prime Video' }],
          },
        ],
        telemetry: {
          targetRegion: 'IN',
          targetDateWindow: { gte: '2026-09-09', lte: TODAY },
          languagesScanned: ['hi', 'ta', 'te', 'ml', 'kn', 'bn', 'mr', 'pa', 'gu', 'or'],
          pagesFetchedByLanguage: { hi: 1, ta: 1, te: 1 },
          totalPagesByLanguage: { hi: 1, ta: 1, te: 1 },
          totalRawCandidates: 2,
          uniqueDeduplicatedCandidates: 2,
          isScanTruncated: false,
          providerErrors: [],
          coverageCompletenessStatus: 'COMPLETE',
        },
      });

      const report = await auditService.runAudit({ referenceDateStr: TODAY });

      // Invariant: No live showtime provider integrated
      expect(report.exhibitionEvidenceProvider).toBe('NONE_INTEGRATED');
      expect(report.activeExhibitionConfirmedCount).toBe(0);
      expect(report.summary.confirmedNowInTheaters).toBe(0);

      // Distinguishes recent-but-unconfirmed exhibition vs streaming
      expect(report.summary.recentReleaseUnconfirmedExhibition).toBe(1);
      expect(report.summary.nowStreaming).toBe(1);
      expect(report.candidates.every((c: any) => c.isEligibleForPublicFeed === false)).toBe(true);

      // Regional breakdown verified
      expect(report.breakdownByLanguage.ta.count).toBe(1);
      expect(report.breakdownByLanguage.ta.industry).toBe('Kollywood');
      expect(report.breakdownByLanguage.te.count).toBe(1);
      expect(report.breakdownByLanguage.te.industry).toBe('Tollywood');

      // OTT status tracked independently
      const teluguMovie = report.candidates.find((c: any) => c.id === 202);
      expect(teluguMovie.isSimultaneouslyStreaming).toBe(true);
      expect(teluguMovie.status).toBe('NOW_STREAMING');

      // Verify the 10 supported languages were passed to discoverRecentPastTheatricalCandidates
      expect(mockTmdbProvider.discoverRecentPastTheatricalCandidates).toHaveBeenCalledWith({
        referenceDateStr: TODAY,
        windowDays: 45,
        languages: ['hi', 'ta', 'te', 'ml', 'kn', 'bn', 'mr', 'pa', 'gu', 'or'],
      });
    });

    it('should distinguish confirmed, unconfirmed, future, and quarantined categories without forcing all into unconfirmed', async () => {
      mockTmdbProvider.discoverRecentPastTheatricalCandidates.mockResolvedValue({
        candidates: [
          // 1. Unconfirmed recent release (age <= 45, no showtimes)
          {
            id: 301,
            tmdbId: 301,
            title: 'Recent Unconfirmed Film',
            originalLanguage: 'ml',
            theatricalReleaseDate: '2026-10-18',
            hasExplicitIndianTheatricalEvent: true,
            indianReleaseEvents: [{ type: 3, date: '2026-10-18' }],
            foreignReleaseEvents: [],
          },
          // 2. Future release (date > today)
          {
            id: 302,
            tmdbId: 302,
            title: 'Future Theatrical Film',
            originalLanguage: 'hi',
            theatricalReleaseDate: '2026-11-20',
            hasExplicitIndianTheatricalEvent: true,
            indianReleaseEvents: [{ type: 3, date: '2026-11-20' }],
            foreignReleaseEvents: [],
          },
          // 3. Quarantined overseas only (no IN event)
          {
            id: 303,
            tmdbId: 303,
            title: 'Overseas Festival Entry',
            originalLanguage: 'kn',
            theatricalReleaseDate: undefined,
            hasExplicitIndianTheatricalEvent: false,
            foreignReleaseEvents: [{ country: 'US', type: 3, date: '2026-10-10' }],
          },
          // 4. Quarantined invalid date
          {
            id: 304,
            tmdbId: 304,
            title: 'Corrupted Date Entry',
            originalLanguage: 'bn',
            theatricalReleaseDate: 'INVALID_DATE',
            hasExplicitIndianTheatricalEvent: true,
          },
          // 5. Expired run (age > 45, no showtimes)
          {
            id: 305,
            tmdbId: 305,
            title: 'Expired Theatrical Run',
            originalLanguage: 'mr',
            theatricalReleaseDate: '2026-08-01',
            hasExplicitIndianTheatricalEvent: true,
            indianReleaseEvents: [{ type: 3, date: '2026-08-01' }],
            foreignReleaseEvents: [],
          },
        ],
        telemetry: {
          targetRegion: 'IN',
          targetDateWindow: { gte: '2026-09-09', lte: TODAY },
          languagesScanned: ['hi', 'ta', 'te', 'ml', 'kn', 'bn', 'mr', 'pa', 'gu', 'or'],
          pagesFetchedByLanguage: {},
          totalPagesByLanguage: {},
          totalRawCandidates: 5,
          uniqueDeduplicatedCandidates: 5,
          isScanTruncated: false,
          providerErrors: [],
          coverageCompletenessStatus: 'COMPLETE',
        },
      });

      const report = await auditService.runAudit({ referenceDateStr: TODAY });

      expect(report.summary.totalCandidatesEvaluated).toBe(5);
      expect(report.summary.recentReleaseUnconfirmedExhibition).toBe(1);
      expect(report.summary.upcomingTheatrical).toBe(1);
      expect(report.summary.quarantinedOverseasOnly).toBe(1);
      expect(report.summary.quarantinedInvalidDate).toBe(1);
      expect(report.summary.excludedTheatricalRunEnded).toBe(1);
      expect(report.summary.confirmedNowInTheaters).toBe(0);
    });

    it('should reuse active audit promise on concurrent requests to prevent duplicate crawls', async () => {
      let resolveAudit: any;
      const delayedPromise = new Promise((resolve) => {
        resolveAudit = resolve;
      });

      mockTmdbProvider.discoverRecentPastTheatricalCandidates.mockReturnValue(delayedPromise);

      // Trigger two concurrent audit requests
      const auditPromise1 = auditService.runAudit({ referenceDateStr: TODAY });
      const auditPromise2 = auditService.runAudit({ referenceDateStr: TODAY });

      // Resolve the underlying discovery call
      resolveAudit({
        candidates: [],
        telemetry: {
          targetRegion: 'IN',
          targetDateWindow: { gte: '2026-09-09', lte: TODAY },
          languagesScanned: [],
          pagesFetchedByLanguage: {},
          totalPagesByLanguage: {},
          totalRawCandidates: 0,
          uniqueDeduplicatedCandidates: 0,
          isScanTruncated: false,
          providerErrors: [],
          coverageCompletenessStatus: 'COMPLETE',
        },
      });

      const [res1, res2] = await Promise.all([auditPromise1, auditPromise2]);

      expect(res1).toBe(res2); // Reused identical promise instance!
      expect(mockTmdbProvider.discoverRecentPastTheatricalCandidates).toHaveBeenCalledTimes(1);
    });

    it('should honestly report provider degraded status when API errors or truncated scans occur', async () => {
      mockTmdbProvider.discoverRecentPastTheatricalCandidates.mockResolvedValue({
        candidates: [],
        telemetry: {
          targetRegion: 'IN',
          targetDateWindow: { gte: '2026-09-09', lte: TODAY },
          languagesScanned: ['hi', 'ta', 'te'],
          pagesFetchedByLanguage: { hi: 1, ta: 0 },
          totalPagesByLanguage: { hi: 1, ta: 3 },
          totalRawCandidates: 0,
          uniqueDeduplicatedCandidates: 0,
          isScanTruncated: true,
          providerErrors: [{ language: 'ta', error: 'HTTP 429 Rate Limit' }],
          coverageCompletenessStatus: 'PROVIDER_DEGRADED',
        },
      });

      const report = await auditService.runAudit({ referenceDateStr: TODAY });

      expect(report.telemetry.coverageCompletenessStatus).toBe('PROVIDER_DEGRADED');
      expect(report.telemetry.isScanTruncated).toBe(true);
      expect(report.telemetry.providerErrors[0].error).toBe('HTTP 429 Rate Limit');
    });
  });
});


