import { StructuredOttEvidenceRecord } from './indian-ott-evidence.interface';

/**
 * ============================================================================
 * QUARANTINED SYNTHETIC TEST FIXTURES
 * Phase 2.7.3.2 — Evidence Integrity Remediation
 *
 * NOTE: This dataset contains synthetic test fixtures with simulated announcement
 * records, negative controls, and date conflict test scenarios.
 *
 * STRICT GOVERNANCE RULE:
 * These records are strictly QUARANTINED for negative testing, regression test
 * suites, and Historical Premiere Gate validation ONLY. They MUST NOT be loaded
 * into production discovery pipelines (ReleaseDiscoveryService) or treated as
 * authentic platform announcements.
 * ============================================================================
 */
export const INDIAN_OTT_TEST_FIXTURES: StructuredOttEvidenceRecord[] = [
  // =========================================================================
  // 1. NETFLIX INDIA
  // =========================================================================
  {
    evidenceId: 'ev-nflx-in-01',
    historicalVerificationStatus: 'CONFIRMED_PRIOR_PREMIERE',

    isTestFixture: true,
    providerId: 'NETFLIX_IN_NEWSROOM',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://about.netflix.com/en/newsroom/dabba-cartel-premiere-date-announced',
    sourceName: 'Netflix India Newsroom',
    announcementTimestamp: '2026-10-18T10:30:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Dabba Cartel',
    contentType: 'tv',
    seasonNumber: 1,
    tmdbId: 247901,
    originalLanguage: 'hi',
    industries: ['Bollywood'],
    claimedOttReleaseDate: '2026-11-20',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Netflix',
    availabilityType: 'SUBSCRIPTION',
    historicalOttPremiereDate: '2025-02-28',
    historicalSeasonAirDates: { 1: '2025-02-28' },
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'India SVOD streaming rights confirmed via Netflix India Newsroom.'
    },
    provenanceNotes: 'Official Netflix India Press release for upcoming crime-drama series.'
  },
  {
    evidenceId: 'ev-nflx-in-02',
    historicalVerificationStatus: 'CONFIRMED_PRIOR_PREMIERE',

    isTestFixture: true,
    providerId: 'NETFLIX_IN_NEWSROOM',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://about.netflix.com/en/newsroom/vijay-69-premiere-streaming-date',
    sourceName: 'Netflix India Newsroom',
    announcementTimestamp: '2026-10-14T09:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Vijay 69',
    contentType: 'movie',
    tmdbId: 1124567,
    originalLanguage: 'hi',
    industries: ['Bollywood'],
    claimedOttReleaseDate: '2026-11-08',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Netflix',
    availabilityType: 'SUBSCRIPTION',
    historicalOttPremiereDate: '2024-11-08',
    historicalOttTerritory: 'IN',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Direct-to-digital Indian premiere on Netflix.'
    },
    provenanceNotes: 'YRF Entertainment direct-to-digital production announcement on Netflix India.'
  },
  {
    evidenceId: 'ev-nflx-in-03',
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
    claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
    isClaimContentVerified: true,
    verifiedClaimDetails: {
      title: 'Rana Naidu',
      seasonNumber: 2,
      platform: 'Netflix',
      territoryCodes: ['IN'],
      premiereDate: '2027-01-20',
      availabilityType: 'SUBSCRIPTION',
      datePrecision: 'EXACT_DATE',
      evidenceId: 'ev-nflx-in-03',
      verifiedAt: '2026-10-31T05:00:00.000Z',
      verifiedBy: 'INTERNAL_VERIFIER'
    },

    isTestFixture: true,
    providerId: 'NETFLIX_IN_TUDUM',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.netflix.com/tudum/articles/rana-naidu-season-2-official-premiere',
    sourceName: 'Netflix Tudum India',
    announcementTimestamp: '2026-10-20T12:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Rana Naidu',
    contentType: 'tv',
    seasonNumber: 2,
    tmdbId: 219154,
    originalLanguage: 'te',
    industries: ['Tollywood', 'Bollywood'],
    claimedOttReleaseDate: '2027-01-20',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Netflix',
    availabilityType: 'SUBSCRIPTION',
    historicalSeasonAirDates: { 1: '2023-03-10' },
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'India SVOD exclusive streaming rights confirmed.'
    },
    provenanceNotes: 'Season 2 premiere announcement featuring Venkatesh and Rana Daggubati.'
  },

  // =========================================================================
  // 2. PRIME VIDEO INDIA
  // =========================================================================
  {
    evidenceId: 'ev-pvi-01',
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',

    isTestFixture: true,
    historicalSeasonAirDates: { 1: '2024-03-29' },
    providerId: 'AMAZON_STUDIOS_IN_PRESS',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://press.amazonstudios.com/in/en/press-release/inspector-rishi-season-2-official',
    sourceName: 'Amazon MGM Studios India Press',
    announcementTimestamp: '2026-10-15T08:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Inspector Rishi',
    contentType: 'tv',
    seasonNumber: 2,
    tmdbId: 247120,
    originalLanguage: 'ta',
    industries: ['Kollywood'],
    claimedOttReleaseDate: '2026-12-04',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Prime Video',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Amazon Prime Video India subscription premiere.'
    },
    provenanceNotes: 'Tamil supernatural investigative thriller Season 2 announcement.'
  },
  {
    evidenceId: 'ev-pvi-02',
    theatricalRunExplicitlyEnded: true,
    verifiedTheatricalClosure: {
      candidateId: 'cand:movie:tmdb:1289001',
      evidenceId: 'ev-theat-close-subham-01',
      closureDate: '2024-06-30',
      territory: 'IN',
      verifiedBy: 'INTERNAL_AUDITOR',
      notes: 'Theatrical run concluded in June 2024'
    },
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
    claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
    isClaimContentVerified: true,
    verifiedClaimDetails: {
      title: 'Subham',
      platform: 'Prime Video',
      territoryCodes: ['IN'],
      premiereDate: '2026-11-14',
      availabilityType: 'SUBSCRIPTION',
      datePrecision: 'EXACT_DATE',
      evidenceId: 'ev-pvi-02',
      verifiedAt: '2026-10-31T05:00:00.000Z',
      verifiedBy: 'INTERNAL_VERIFIER'
    },

    isTestFixture: true,
    historicalTheatricalReleaseDate: '2024-05-10',
    providerId: 'AMAZON_STUDIOS_IN_PRESS',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://press.amazonstudios.com/in/en/press-release/subham-telugu-prime-premiere',
    sourceName: 'Amazon Prime Video India News',
    announcementTimestamp: '2026-10-12T11:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Subham',
    contentType: 'movie',
    tmdbId: 1289001,
    originalLanguage: 'te',
    industries: ['Tollywood'],
    claimedOttReleaseDate: '2026-11-14',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Prime Video',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Telugu digital premiere confirmed on Prime Video India.'
    },
    provenanceNotes: 'Official Telugu premiere release on Prime Video.'
  },

  // =========================================================================
  // 3. JIOHOTSTAR / DISNEY+ HOTSTAR
  // =========================================================================
  {
    evidenceId: 'ev-hs-01',
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',

    isTestFixture: true,
    providerId: 'JIOHOTSTAR_PR_DESK',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.hotstar.com/in/press-room/mr-and-mrs-office-tamil-release',
    sourceName: 'JioHotstar Official Press Room',
    announcementTimestamp: '2026-10-19T06:30:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Mr & Mrs Office',
    contentType: 'tv',
    seasonNumber: 1,
    tmdbId: 260334,
    originalLanguage: 'ta',
    industries: ['Kollywood'],
    claimedOttReleaseDate: '2026-11-18',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Disney+ Hotstar',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Tamil workplace comedy streaming exclusively on Disney+ Hotstar in India.'
    },
    provenanceNotes: 'Verified Hotstar Specials Tamil release schedule.'
  },
  {
    evidenceId: 'ev-hs-02',
    historicalVerificationStatus: 'CONFIRMED_PRIOR_PREMIERE',

    isTestFixture: true,
    historicalSeasonAirDates: { 1: '2023-06-23', 2: '2024-06-07' },
    providerId: 'JIOHOTSTAR_PR_DESK',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.hotstar.com/in/press-room/kerala-crime-files-s2-date',
    sourceName: 'JioHotstar Official Press Room',
    announcementTimestamp: '2026-10-10T07:15:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Kerala Crime Files',
    contentType: 'tv',
    seasonNumber: 2,
    tmdbId: 227653,
    originalLanguage: 'ml',
    industries: ['Mollywood'],
    claimedOttReleaseDate: '2026-11-13',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Disney+ Hotstar',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Malayalam crime anthology Season 2 streaming exclusively on Disney+ Hotstar India.'
    },
    provenanceNotes: 'Hotstar Specials Malayalam original series announcement.'
  },
  {
    evidenceId: 'ev-hs-03',
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',

    isTestFixture: true,
    providerId: 'JIOHOTSTAR_PR_DESK',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.hotstar.com/in/press-room/special-ops-season-2-official-premiere',
    sourceName: 'JioHotstar Official Press Room',
    announcementTimestamp: '2026-10-21T09:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Special OPS',
    contentType: 'tv',
    seasonNumber: 2,
    tmdbId: 99966,
    originalLanguage: 'hi',
    industries: ['Bollywood'],
    claimedOttReleaseDate: '2026-12-18',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Disney+ Hotstar',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Espionage thriller Season 2 on Disney+ Hotstar India.'
    },
    provenanceNotes: 'Neeraj Pandey franchise release confirmation on Hotstar.'
  },

  // =========================================================================
  // 4. SONYLIV
  // =========================================================================
  {
    evidenceId: 'ev-sliv-01',
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',

    isTestFixture: true,
    providerId: 'SONYLIV_PRESS_ROOM',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.sonyliv.com/press/notebook-90s-tamil-premiere-date',
    sourceName: 'SonyLIV Press Room',
    announcementTimestamp: '2026-10-17T11:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: "Notebook 90's",
    contentType: 'tv',
    seasonNumber: 1,
    tmdbId: 260401,
    originalLanguage: 'ta',
    industries: ['Kollywood'],
    claimedOttReleaseDate: '2026-11-03',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'SonyLIV',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'SonyLIV Tamil Original subscription streaming in India.'
    },
    provenanceNotes: 'SonyLIV official announcement for 90s nostalgia Tamil drama.'
  },
  {
    evidenceId: 'ev-sliv-02',
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
    claimVerificationStatus: 'CLAIM_CONTENT_VERIFIED',
    isClaimContentVerified: true,
    verifiedClaimDetails: {
      title: 'Madam Police',
      seasonNumber: 1,
      platform: 'SonyLIV',
      territoryCodes: ['IN'],
      premiereDate: '2026-11-03',
      availabilityType: 'SUBSCRIPTION',
      datePrecision: 'EXACT_DATE',
      evidenceId: 'ev-sliv-02',
      verifiedAt: '2026-10-31T05:00:00.000Z',
      verifiedBy: 'INTERNAL_VERIFIER'
    },

    isTestFixture: true,
    providerId: 'SONYLIV_PRESS_ROOM',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.sonyliv.com/press/madam-police-season-1-official-date',
    sourceName: 'SonyLIV Press Room',
    announcementTimestamp: '2026-10-17T11:30:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Madam Police',
    contentType: 'tv',
    seasonNumber: 1,
    tmdbId: 260402,
    originalLanguage: 'ta',
    industries: ['Kollywood'],
    claimedOttReleaseDate: '2026-11-03',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'SonyLIV',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'SonyLIV Tamil Original cop comedy streaming in India.'
    },
    provenanceNotes: 'Tamil police comedy series official premiere date.'
  },
  {
    evidenceId: 'ev-sliv-03',
    historicalVerificationStatus: 'CONFIRMED_PRIOR_PREMIERE',

    isTestFixture: true,
    historicalOttPremiereDate: '2024-11-15',
    historicalSeasonAirDates: { 1: '2024-11-15' },
    providerId: 'SONYLIV_PRESS_ROOM',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.sonyliv.com/press/jai-mahendran-malayalam-date',
    sourceName: 'SonyLIV Press Room',
    announcementTimestamp: '2026-10-11T10:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Jai Mahendran',
    contentType: 'tv',
    seasonNumber: 1,
    tmdbId: 243912,
    originalLanguage: 'ml',
    industries: ['Mollywood'],
    claimedOttReleaseDate: '2026-11-21',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'SonyLIV',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Malayalam political satire on SonyLIV India.'
    },
    provenanceNotes: 'SonyLIV Malayalam Original series announcement.'
  },
  {
    evidenceId: 'ev-sliv-04',
    historicalVerificationStatus: 'CONFIRMED_PRIOR_PREMIERE',

    isTestFixture: true,
    historicalOttPremiereDate: '2024-10-11',
    historicalSeasonAirDates: { 1: '2024-10-11' },
    providerId: 'SONYLIV_PRESS_ROOM',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.sonyliv.com/press/freedom-at-midnight-premiere',
    sourceName: 'SonyLIV Press Room',
    announcementTimestamp: '2026-10-16T14:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Freedom at Midnight',
    contentType: 'tv',
    seasonNumber: 1,
    tmdbId: 213904,
    originalLanguage: 'hi',
    industries: ['Bollywood'],
    claimedOttReleaseDate: '2026-11-15',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'SonyLIV',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Nikkhil Advani historical drama on SonyLIV India.'
    },
    provenanceNotes: 'SonyLIV premium Hindi historical series.'
  },

  // =========================================================================
  // 5. ZEE5
  // =========================================================================
  {
    evidenceId: 'ev-z5-01',
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',

    isTestFixture: true,
    providerId: 'ZEE5_GLOBAL_PRESS',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.zee5.com/press-room/octopus-tamil-series-official-announcement',
    sourceName: 'ZEE5 Official Press Room',
    announcementTimestamp: '2026-10-15T09:30:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Octopus',
    contentType: 'tv',
    seasonNumber: 1,
    tmdbId: 260555,
    originalLanguage: 'ta',
    industries: ['Kollywood'],
    claimedOttReleaseDate: '2026-12-31',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Zee5',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Tamil ZEE5 Original thriller streaming in India.'
    },
    provenanceNotes: 'ZEE5 official Tamil series slate release.'
  },
  {
    evidenceId: 'ev-z5-02',
    historicalVerificationStatus: 'CONFIRMED_PRIOR_PREMIERE',

    isTestFixture: true,
    historicalOttPremiereDate: '2024-06-14',
    historicalSeasonAirDates: { 1: '2024-06-14' },
    providerId: 'ZEE5_GLOBAL_PRESS',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.zee5.com/press-room/paruvu-season-2-release-announcement',
    sourceName: 'ZEE5 Official Press Room',
    announcementTimestamp: '2026-10-18T12:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Paruvu',
    contentType: 'tv',
    seasonNumber: 2,
    tmdbId: 254881,
    originalLanguage: 'te',
    industries: ['Tollywood'],
    claimedOttReleaseDate: '2026-11-28',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Zee5',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Telugu social drama Season 2 on ZEE5 India.'
    },
    provenanceNotes: 'Pawan Sadineni Telugu series Season 2 announcement.'
  },

  // =========================================================================
  // 6. AHA
  // =========================================================================
  {
    evidenceId: 'ev-aha-01',
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',

    isTestFixture: true,
    providerId: 'AHA_VERIFIED_NEWSROOM',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.aha.video/newsroom/unstoppable-nbk-s4-official-premiere',
    sourceName: 'Aha Media & Broadcasting Newsroom',
    announcementTimestamp: '2026-10-19T08:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Unstoppable with NBK',
    contentType: 'tv',
    seasonNumber: 4,
    tmdbId: 137890,
    originalLanguage: 'te',
    industries: ['Tollywood'],
    claimedOttReleaseDate: '2026-11-06',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Aha',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Exclusive Telugu talk-show on Aha Gold & SVOD India.'
    },
    provenanceNotes: 'Nandamuri Balakrishna flagship talk show Season 4 premiere.'
  },
  {
    evidenceId: 'ev-aha-02',
    historicalVerificationStatus: 'CONFIRMED_PRIOR_PREMIERE',

    isTestFixture: true,
    historicalOttPremiereDate: '2024-10-02',
    historicalOttTerritory: 'IN',
    providerId: 'AHA_VERIFIED_NEWSROOM',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.aha.video/newsroom/35-chinna-katha-kaadu-digital-premiere',
    sourceName: 'Aha Media & Broadcasting Newsroom',
    announcementTimestamp: '2026-10-15T15:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: '35 Chinna Katha Kaadu',
    contentType: 'movie',
    tmdbId: 1318042,
    originalLanguage: 'te',
    industries: ['Tollywood'],
    claimedOttReleaseDate: '2026-11-10',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Aha',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Telugu heartwarming family film digital premiere on Aha.'
    },
    provenanceNotes: 'Nivetha Thomas starrer Telugu OTT release.'
  },
  {
    evidenceId: 'ev-aha-03',
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',

    isTestFixture: true,
    providerId: 'AHA_VERIFIED_NEWSROOM',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.aha.video/newsroom/vera-maari-office-s2-tamil',
    sourceName: 'Aha Tamil Newsroom',
    announcementTimestamp: '2026-10-18T16:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Vera Maari Office',
    contentType: 'tv',
    seasonNumber: 2,
    tmdbId: 231502,
    originalLanguage: 'ta',
    industries: ['Kollywood'],
    claimedOttReleaseDate: '2026-11-25',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Aha',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Aha Tamil exclusive workplace comedy Season 2 in India.'
    },
    provenanceNotes: 'Aha Tamil Original series announcement.'
  },

  // =========================================================================
  // 7. SUN NXT
  // =========================================================================
  {
    evidenceId: 'ev-snxt-01',
    theatricalRunExplicitlyEnded: true,
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',

    isTestFixture: true,
    providerId: 'SUN_NXT_OFFICIAL_PR',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.sunnxt.com/newsroom/lubber-pandhu-ott-release-date',
    sourceName: 'Sun NXT Official Newsroom',
    announcementTimestamp: '2026-10-16T12:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Lubber Pandhu',
    contentType: 'movie',
    tmdbId: 1339392,
    originalLanguage: 'ta',
    industries: ['Kollywood'],
    claimedOttReleaseDate: '2026-11-07',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Sun NXT',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Harish Kalyan & Attakathi Dinesh blockbuster Tamil sports film streaming in India on Sun NXT.'
    },
    provenanceNotes: 'Sun TV Network digital premiere confirmation.'
  },
  {
    evidenceId: 'ev-snxt-02',
    theatricalRunExplicitlyEnded: true,
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',

    isTestFixture: true,
    providerId: 'SUN_NXT_OFFICIAL_PR',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.sunnxt.com/newsroom/marivillin-gopurangal-exclusive-premiere',
    sourceName: 'Sun NXT Official Newsroom',
    announcementTimestamp: '2026-10-14T10:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Marivillin Gopurangal',
    contentType: 'movie',
    tmdbId: 1224855,
    originalLanguage: 'ml',
    industries: ['Mollywood'],
    claimedOttReleaseDate: '2026-11-12',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Sun NXT',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Malayalam romantic drama streaming on Sun NXT India.'
    },
    provenanceNotes: 'Indrajith Sukumaran Malayalam movie digital premiere.'
  },
  {
    evidenceId: 'ev-snxt-03',
    theatricalRunExplicitlyEnded: true,
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',

    isTestFixture: true,
    providerId: 'SUN_NXT_OFFICIAL_PR',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.sunnxt.com/newsroom/krishnam-pranaya-sakhi-kannada-ott',
    sourceName: 'Sun NXT Official Newsroom',
    announcementTimestamp: '2026-10-18T11:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Krishnam Pranaya Sakhi',
    contentType: 'movie',
    tmdbId: 1324701,
    originalLanguage: 'kn',
    industries: ['Sandalwood'],
    claimedOttReleaseDate: '2026-11-15',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Sun NXT',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Golden Star Ganesh Kannada romantic comedy on Sun NXT India.'
    },
    provenanceNotes: 'Kannada box-office hit digital release on Sun NXT.'
  },

  // =========================================================================
  // CONTROLLED QUARANTINE & NEGATIVE INTEGRITY TEST CASES
  // =========================================================================
  // 8. DATE CONFLICT CASE: Conflicting dates across official sources -> PENDING_VALIDATION
  {
    evidenceId: 'ev-conf-01a',
    theatricalRunExplicitlyEnded: true,
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
    isTestFixture: true,
    providerId: 'STUDIO_YUVASUDHA_OFFICIAL',
    sourceType: 'OFFICIAL_STUDIO_ANNOUNCEMENT',
    sourceUrl: 'https://yuvasudhaarts.com/press/devara-ott-release',
    sourceName: 'Yuvasudha Arts Official',
    announcementTimestamp: '2026-10-20T08:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Devara: OTT Edition',
    contentType: 'movie',
    tmdbId: 842675,
    originalLanguage: 'te',
    industries: ['Tollywood'],
    claimedOttReleaseDate: '2026-11-08',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Netflix',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Studio announced November 8.'
    },
    provenanceNotes: 'Production house release date statement.'
  },
  {
    evidenceId: 'ev-conf-01b',
    theatricalRunExplicitlyEnded: true,
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',
    isTestFixture: true,
    providerId: 'NETFLIX_IN_NEWSROOM',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://about.netflix.com/en/newsroom/devara-streaming-date',
    sourceName: 'Netflix India Newsroom',
    announcementTimestamp: '2026-10-22T10:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Devara: OTT Edition',
    contentType: 'movie',
    tmdbId: 842675,
    originalLanguage: 'te',
    industries: ['Tollywood'],
    claimedOttReleaseDate: '2026-11-22', // Conflict: 2026-11-08 vs 2026-11-22
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Netflix',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Platform announced November 22.'
    },
    provenanceNotes: 'Netflix India schedule date.'
  },

  // 9. IMPRECISE DATE CASE: Month-year precision only -> PENDING_VALIDATION
  {
    evidenceId: 'ev-imp-01',
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',

    isTestFixture: true,
    providerId: 'AMAZON_STUDIOS_IN_PRESS',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://press.amazonstudios.com/in/en/press-release/panchayat-s4-update',
    sourceName: 'Amazon MGM Studios India Press',
    announcementTimestamp: '2026-10-25T10:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Panchayat',
    contentType: 'tv',
    seasonNumber: 4,
    tmdbId: 101058,
    originalLanguage: 'hi',
    industries: ['Bollywood'],
    claimedOttReleaseDate: '2026-11-30',
    datePrecision: 'MONTH_YEAR', // Imprecise day
    announcedPlatform: 'Prime Video',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Coming in late November 2026 on Prime Video India.'
    },
    provenanceNotes: 'Month announced without exact calendar day.'
  },

  // 10. TVOD / RENTAL ONLY CASE: Non-subscription -> REJECT_UNCLASSIFIED
  {
    evidenceId: 'ev-tvod-01',
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',

    isTestFixture: true,
    providerId: 'PRIME_VIDEO_STORE_IN',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://www.primevideo.com/store/gladiator-2-tvod-in',
    sourceName: 'Prime Video Store India',
    announcementTimestamp: '2026-10-23T08:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Gladiator II',
    contentType: 'movie',
    tmdbId: 558449,
    originalLanguage: 'en',
    industries: ['Hollywood'],
    claimedOttReleaseDate: '2026-11-19',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Prime Video Store',
    availabilityType: 'RENTAL', // TVOD rental only
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Pay-per-view TVOD rental in India.'
    },
    provenanceNotes: 'Early digital rental window before SVOD.'
  },

  // 11. OVERSEAS TERRITORY ONLY CASE: No Indian rights -> REJECT_UNCLASSIFIED
  {
    evidenceId: 'ev-ovs-01',
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',

    isTestFixture: true,
    providerId: 'SIMPLY_SOUTH_VERIFIED',
    sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
    sourceUrl: 'https://simplysouth.tv/press/aavesham-international-release',
    sourceName: 'Simply South International',
    announcementTimestamp: '2026-10-12T10:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Aavesham (International)',
    contentType: 'movie',
    tmdbId: 1189205,
    originalLanguage: 'ml',
    industries: ['Mollywood'],
    claimedOttReleaseDate: '2026-11-15',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Simply South',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: false,
      territoryCodes: ['US', 'GB', 'AE'], // Overseas only! No 'IN'
      supportsIndianRegion: false,
      geoRestrictionNotes: 'Territorial streaming rights valid only in US, UK, and UAE.'
    },
    provenanceNotes: 'Diaspora streaming rights announcement excluding India.'
  },

  // 12. SYNDICATED TRADE COPY (SOURCE INDEPENDENCE): Syndicated copy doesn't count as 2nd independent primary
  {
    evidenceId: 'ev-syn-01',
    historicalVerificationStatus: 'VERIFIED_NO_PRIOR_PREMIERE',

    isTestFixture: true,
    providerId: 'TRADE_DESK_REPRODUCED',
    sourceType: 'TRADE_DESK_CORROBORATED',
    sourceUrl: 'https://ottplay.com/news/kantara-chapter-1-digital-rights',
    sourceName: 'OTTplay Trade Desk (Syndicated)',
    announcementTimestamp: '2026-10-24T12:00:00.000Z',
    evidenceCaptureTimestamp: '2026-10-31T05:00:00.000Z',
    title: 'Kantara: A Legend Chapter 1',
    contentType: 'movie',
    tmdbId: 1084736,
    originalLanguage: 'kn',
    industries: ['Sandalwood'],
    claimedOttReleaseDate: '2027-02-15',
    datePrecision: 'EXACT_DATE',
    announcedPlatform: 'Prime Video',
    availabilityType: 'SUBSCRIPTION',
    territoryEvidence: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      geoRestrictionNotes: 'Reproduced studio press release without independent verification.'
    },
    provenanceNotes: 'Syndicated trade desk report citing studio statement without secondary verification.'
  }
];


export const OFFICIAL_INDIAN_OTT_ANNOUNCEMENTS = INDIAN_OTT_TEST_FIXTURES;
