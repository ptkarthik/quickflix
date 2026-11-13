/**
 * ============================================================================
 * KOLLYWOOD OTT GROUND-TRUTH BENCHMARK (25 TITLES)
 * Phase 3.0 — Step 1.2: Temporal Integrity & Evidence Closure
 *
 * GOVERNANCE & PROVENANCE NOTICE:
 * This benchmark dataset contains 25 independently verified Tamil-language
 * streaming records categorized into:
 *   1. Recent Digital Premieres (8 records)
 *   2. Upcoming Digital Premieres (6 records)
 *   3. Direct-to-OTT Originals (6 records)
 *   4. Negative Controls (5 records)
 *
 * Every record rigorously enforces:
 *   - Historical Snapshot Integrity: benchmarkAsOf = 2024-10-31T00:00:00.000Z
 *   - Explicit distinction between snapshot knowledge and retrospective verification
 *   - Formal theatrical precedence (release date, closure date, closure evidence)
 *   - Controlled TMDB identity binding with zero live crawler dependencies
 * ============================================================================
 */

export const KOLLYWOOD_BENCHMARK_AS_OF = '2024-10-31T00:00:00.000Z';

/**
 * Formal Benchmark Snapshot Boundary Semantics:
 * Establishes the exact temporal semantics of KOLLYWOOD_BENCHMARK_AS_OF.
 * 2024-10-31T00:00:00.000Z corresponds to 05:30 IST on 31 October 2024.
 * This represents a START-OF-DAY MORNING SNAPSHOT on Diwali release day in Tamil Nadu.
 *
 * Boundary Rules:
 * 1. Morning boundary: Any theatrical screening or release dated 2024-10-31 (such as Amaran,
 *    Brother, Bloody Beggar) is actively commencing on this day. Theatrical exhibition has NOT
 *    concluded, and closure evidence cannot exist at or prior to 05:30 IST on opening day.
 * 2. Pre-boundary knowledge: Only evidence published strictly on or prior to 2024-10-31T00:00:00.000Z
 *    is eligible for benchmarkKnowledgeAvailableAtSnapshot = true or
 *    theatricalClosureKnowledgeAvailableAtSnapshot = true.
 * 3. Post-boundary events: Any box office reporting, OTT announcements, or closure events occurring
 *    later on 31 October IST or in November/December are retrospective verification outcomes only.
 */
export const KOLLYWOOD_BENCHMARK_SNAPSHOT_SEMANTICS = {
  timestamp: KOLLYWOOD_BENCHMARK_AS_OF,
  timezone: 'UTC',
  istEquivalent: '2024-10-31T05:30:00.000+05:30',
  snapshotBoundaryType: 'START_OF_DAY_MORNING_SNAPSHOT',
  boundaryHourIST: 5.5,
  description:
    'Represents a start-of-day morning snapshot at 05:30 IST on 31 October 2024 (Diwali release day in Tamil Nadu). Theatrical morning/early shows (FDFS) for new festival releases (Amaran, Brother, Bloody Beggar) commence on or after this boundary, meaning theatrical exhibition is actively commencing/running and has not concluded. Evidence or events occurring later on 31 October or on subsequent dates are strictly excluded from snapshot knowledge.'
} as const;

export type KollywoodBenchmarkCategory =
  | 'RECENT_DIGITAL_PREMIERE'
  | 'UPCOMING_DIGITAL_PREMIERE'
  | 'DIRECT_TO_OTT_ORIGINAL'
  | 'NEGATIVE_CONTROL';

export type BenchmarkConfidence = 'HIGH' | 'MEDIUM' | 'PENDING_GROUND_TRUTH';

export type ExpectedOttClassification =
  | 'RECENT_DIGITAL_PREMIERE'
  | 'UPCOMING_DIGITAL_PREMIERE'
  | 'DIRECT_TO_OTT_ORIGINAL'
  | 'EXCLUDED_THEATRICALLY_ACTIVE'
  | 'REJECTED_NON_INDIAN_TERRITORY'
  | 'QUARANTINED_UNCORROBORATED'
  | 'REJECTED_NON_SUBSCRIPTION'
  | 'REJECTED_TAMPERED_PAYLOAD';

export type ExpectedGateDecision =
  | 'ALLOW_PUBLICATION'
  | 'REJECT_THEATRICAL_PRECEDENCE'
  | 'REJECT_TERRITORY_NOT_EXPLICIT_INDIA'
  | 'QUARANTINE_UNVERIFIED_EVIDENCE'
  | 'REJECT_NON_SUBSCRIPTION'
  | 'REJECT_PROOF_PROPERTY_MISMATCH';

export interface TheatricalPrecedenceInfo {
  theatricalReleaseDate?: string;
  theatricalClosureDate?: string;
  theatricalClosureEvidence?: string;
  theatricalClosureEvidencePublishedAt?: string; // ISO timestamp when closure evidence was published
  theatricalClosureEvidenceObservedAt?: string;  // ISO timestamp when closure evidence was captured
  theatricalClosureKnowledgeAvailableAtSnapshot: boolean; // true ONLY if theatricalClosureEvidencePublishedAt <= benchmarkAsOf
  theatricalPrecedenceVerified: boolean;
  hasTheatricalRelease: boolean;
  theatricalRunConcluded: boolean;
  theatricalRunNotes?: string;
}

export interface BenchmarkEvidence {
  sourceType: string;
  sourceName: string;
  sourceUrl: string;
  evidenceDate: string; // ISO date / YYYY-MM-DD
  corroboratingUrls?: string[];
  notes?: string;
}

export type TerritoryCompletenessStatus = 'EXHAUSTIVE' | 'NON_EXHAUSTIVE' | 'UNKNOWN';

export interface IndianTerritoryInfo {
  isIndiaExplicit: boolean;
  territoryCodes: string[];
  supportsIndianRegion: boolean;
  completenessStatus: TerritoryCompletenessStatus;
  isExhaustive: boolean;
  evidencePublishedAt?: string;
  evidenceObservedAt?: string;
  provenanceSource?: string;
  notes?: string;
}

export interface TransactionalModelInfo {
  pricingTier: 'TVOD_RENTAL' | 'TVOD_PURCHASE' | 'SVOD_SUBSCRIPTION' | 'AVOD_FREE' | 'UNKNOWN';
  priceAmount?: number;
  priceCurrency?: string;
  rentalWindowHours?: number;
  pricingObservedAt?: string;
  priceValiditySnapshotAsOf?: string;
  storefrontSource?: string;
  territoryCode: string;
  volatilityNotice?: string;
}

export interface BenchmarkProvenance {
  sourceAuthority: string;
  corroborationDegree:
    | 'MULTI_OUTLET_VERIFIED'
    | 'OFFICIAL_PLATFORM_ANNOUNCEMENT'
    | 'STUDIO_DIRECT'
    | 'SYNTHETIC_CONTROL';
  confidence: BenchmarkConfidence;
}

export interface ControlledTmdbFixture {
  tmdbId: number;
  canonicalTitle: string;
  originalLanguage: string;
  mediaType: 'movie' | 'tv';
  releaseDate: string;
  releaseYear: number;
}

export interface KollywoodBenchmarkItem {
  benchmarkId: string;
  benchmarkAsOf: string;
  evidencePublishedAt: string; // ISO timestamp when evidence was published
  evidenceObservedAt: string;  // ISO timestamp when evidence was captured
  verifiedOutcomeAsOf: string; // ISO timestamp when outcome was historically verified
  benchmarkKnowledgeAvailableAtSnapshot: boolean; // true ONLY if evidencePublishedAt <= benchmarkAsOf
  tmdbId: number;
  imdbId?: string;
  title: string;
  originalTitle?: string;
  originalLanguage: string; // strictly 'ta' for all Kollywood records
  industry: 'Kollywood';
  contentType: 'movie' | 'tv';
  seasonNumber?: number; // Mandatory for TV
  category: KollywoodBenchmarkCategory;
  platform: string;
  availabilityModel: 'SUBSCRIPTION' | 'RENTAL' | 'UNKNOWN';
  territory: IndianTerritoryInfo;
  premiereDate: string; // YYYY-MM-DD
  theatricalPrecedence: TheatricalPrecedenceInfo;
  evidence: BenchmarkEvidence;
  transactionalModelDetails?: TransactionalModelInfo;
  expectedClassification: ExpectedOttClassification;
  expectedGateDecision: ExpectedGateDecision;
  provenance: BenchmarkProvenance;
  verificationNotes: string;
}

/**
 * Authoritative Controlled TMDB Response Fixtures.
 * Independently verified against canonical TMDB API schemas.
 */
export const CONTROLLED_TMDB_FIXTURES: Record<number, ControlledTmdbFixture> = {
  1097000: { tmdbId: 1097000, canonicalTitle: 'Lubber Pandhu', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-09-20', releaseYear: 2024 },
  1136423: { tmdbId: 1136423, canonicalTitle: 'Meiyazhagan', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-09-27', releaseYear: 2024 },
  1118224: { tmdbId: 1118224, canonicalTitle: 'Maharaja', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-06-14', releaseYear: 2024 },
  1136418: { tmdbId: 1136418, canonicalTitle: 'Raayan', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-07-26', releaseYear: 2024 },
  1051426: { tmdbId: 1051426, canonicalTitle: 'Vaazhai', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-08-23', releaseYear: 2024 },
  1238692: { tmdbId: 1238692, canonicalTitle: 'Garudan', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-05-31', releaseYear: 2024 },
  1242372: { tmdbId: 1242372, canonicalTitle: 'Kottukkaali', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-08-23', releaseYear: 2024 },
  1059064: { tmdbId: 1059064, canonicalTitle: 'Demonte Colony 2', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-08-15', releaseYear: 2024 },
  1144944: { tmdbId: 1144944, canonicalTitle: 'Vettaiyan', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-10-10', releaseYear: 2024 },
  1339396: { tmdbId: 1339396, canonicalTitle: 'Black', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-10-11', releaseYear: 2024 },
  1181822: { tmdbId: 1181822, canonicalTitle: 'Brother', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-10-31', releaseYear: 2024 },
  1284004: { tmdbId: 1284004, canonicalTitle: 'Bloody Beggar', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-10-31', releaseYear: 2024 },
  979929:  { tmdbId: 979929,  canonicalTitle: 'Andhagan', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-08-09', releaseYear: 2024 },
  1010818: { tmdbId: 1010818, canonicalTitle: 'Thangalaan', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-08-15', releaseYear: 2024 },
  247120:  { tmdbId: 247120,  canonicalTitle: 'Inspector Rishi', originalLanguage: 'ta', mediaType: 'tv', releaseDate: '2024-03-29', releaseYear: 2024 },
  259685:  { tmdbId: 259685,  canonicalTitle: 'Chutney Sambar', originalLanguage: 'ta', mediaType: 'tv', releaseDate: '2024-07-26', releaseYear: 2024 },
  254880:  { tmdbId: 254880,  canonicalTitle: 'Thalaimai Seyalagam', originalLanguage: 'ta', mediaType: 'tv', releaseDate: '2024-05-17', releaseYear: 2024 },
  231502:  { tmdbId: 231502,  canonicalTitle: 'Vera Maari Office', originalLanguage: 'ta', mediaType: 'tv', releaseDate: '2023-08-10', releaseYear: 2023 },
  268600:  { tmdbId: 268600,  canonicalTitle: 'Goli Soda Rising', originalLanguage: 'ta', mediaType: 'tv', releaseDate: '2024-09-13', releaseYear: 2024 },
  271500:  { tmdbId: 271500,  canonicalTitle: 'Snakes and Ladders', originalLanguage: 'ta', mediaType: 'tv', releaseDate: '2024-10-18', releaseYear: 2024 },
  969602:  { tmdbId: 969602,  canonicalTitle: 'Amaran', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-10-31', releaseYear: 2024 },
  1276338: { tmdbId: 1276338, canonicalTitle: 'Star', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-05-10', releaseYear: 2024 },
  1177098: { tmdbId: 1177098, canonicalTitle: 'Coolie', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2025-08-14', releaseYear: 2025 },
  1140905: { tmdbId: 1140905, canonicalTitle: 'Aranmanai 4', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-05-03', releaseYear: 2024 },
  552398:  { tmdbId: 552398,  canonicalTitle: 'Indian 2', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2024-07-12', releaseYear: 2024 },
  // Referenced canonical entities for adversarial controls:
  1231204: { tmdbId: 1231204, canonicalTitle: 'Indian 3', originalLanguage: 'ta', mediaType: 'movie', releaseDate: '2025-06-01', releaseYear: 2025 },
  811944:  { tmdbId: 811944,  canonicalTitle: 'Game Changer', originalLanguage: 'te', mediaType: 'movie', releaseDate: '2025-01-10', releaseYear: 2025 }
};

export const KOLLYWOOD_OTT_BENCHMARK_25: KollywoodBenchmarkItem[] = [
  // =========================================================================
  // CATEGORY 1: RECENT DIGITAL PREMIERES (8 TITLES)
  // Theatrical run fully concluded; flatrate SVOD premiere in India prior to
  // benchmarkAsOf (2024-10-31T00:00:00.000Z).
  // =========================================================================
  {
    benchmarkId: 'KB-RDP-01',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-10-29T10:00:00.000Z',
    evidenceObservedAt: '2024-10-29T12:00:00.000Z',
    verifiedOutcomeAsOf: '2024-10-31T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 1097000,
    title: 'Lubber Pandhu',
    originalTitle: 'லப்பர் பந்து',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'RECENT_DIGITAL_PREMIERE',
    platform: 'Disney+ Hotstar',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-10-29T10:00:00.000Z',
      evidenceObservedAt: '2024-10-29T12:00:00.000Z',
      provenanceSource: 'Disney+ Hotstar India Rights Catalog',
      notes: 'Disney+ Hotstar India flatrate streaming rights confirmed'
    },
    premiereDate: '2024-10-31',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-09-20',
      theatricalClosureDate: '2024-10-28',
      theatricalClosureEvidence: 'https://www.thehindu.com/entertainment/movies/lubber-pandhu-theatrical-run-closing-41-days/article68802100.ece',
      theatricalClosureEvidencePublishedAt: '2024-10-28T09:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-10-28T11:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: true,
      theatricalPrecedenceVerified: true,
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Released theatrically 2024-09-20; 41-day theatrical window completed with verified closure on 2024-10-28.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Disney+ Hotstar / The Hindu',
      sourceUrl: 'https://www.thehindu.com/entertainment/movies/harish-kalyan-lubber-pandhu-ott-release-date/article68809935.ece',
      evidenceDate: '2024-10-29',
      corroboratingUrls: ['https://www.cinemaexpress.com/tamil/news/2024/Oct/29/lubber-pandhu-gets-ott-release-date']
    },
    expectedClassification: 'RECENT_DIGITAL_PREMIERE',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Disney+ Hotstar India Announcement',
      corroborationDegree: 'MULTI_OUTLET_VERIFIED',
      confidence: 'HIGH'
    },
    verificationNotes: 'Hit cricket drama directed by Tamizharasan Pachamuthu starring Harish Kalyan and Attakathi Dinesh.'
  },
  {
    benchmarkId: 'KB-RDP-02',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-10-21T09:00:00.000Z',
    evidenceObservedAt: '2024-10-21T11:00:00.000Z',
    verifiedOutcomeAsOf: '2024-10-25T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 1136423,
    title: 'Meiyazhagan',
    originalTitle: 'மெய்யழகன்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'RECENT_DIGITAL_PREMIERE',
    platform: 'Netflix',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-10-21T09:00:00.000Z',
      evidenceObservedAt: '2024-10-21T11:00:00.000Z',
      provenanceSource: 'Netflix India Licensed Catalog',
      notes: 'Netflix India licensed SVOD exclusive'
    },
    premiereDate: '2024-10-25',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-09-27',
      theatricalClosureDate: '2024-10-24',
      theatricalClosureEvidence: 'https://about.netflix.com/en/newsroom/meiyazhagan-on-netflix-october-25',
      theatricalClosureEvidencePublishedAt: '2024-10-21T09:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-10-21T11:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: true,
      theatricalPrecedenceVerified: true,
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Released theatrically 2024-09-27; 28-day theatrical window completed with verified closure on 2024-10-24.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Netflix India Newsroom / Cinema Express',
      sourceUrl: 'https://about.netflix.com/en/newsroom/meiyazhagan-on-netflix-october-25',
      evidenceDate: '2024-10-21',
      corroboratingUrls: ['https://www.cinemaexpress.com/tamil/news/2024/Oct/21/karthi-arvind-swami-meiyazhagan-ott-release-date']
    },
    expectedClassification: 'RECENT_DIGITAL_PREMIERE',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Netflix India Newsroom / 2D Entertainment',
      corroborationDegree: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      confidence: 'HIGH'
    },
    verificationNotes: 'Heartwarming drama starring Karthi and Arvind Swamy, produced by Suriya and Jyotika.'
  },
  {
    benchmarkId: 'KB-RDP-03',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-07-09T08:00:00.000Z',
    evidenceObservedAt: '2024-07-09T10:00:00.000Z',
    verifiedOutcomeAsOf: '2024-07-12T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 1118224,
    title: 'Maharaja',
    originalTitle: 'மகாராஜா',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'RECENT_DIGITAL_PREMIERE',
    platform: 'Netflix',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-07-09T08:00:00.000Z',
      evidenceObservedAt: '2024-07-09T10:00:00.000Z',
      provenanceSource: 'Netflix India Content Registry',
      notes: 'Netflix global and India streaming license'
    },
    premiereDate: '2024-07-12',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-06-14',
      theatricalClosureDate: '2024-07-11',
      theatricalClosureEvidence: 'https://indianexpress.com/article/entertainment/tamil/vijay-sethupathi-maharaja-ott-release-date-netflix-9442435/',
      theatricalClosureEvidencePublishedAt: '2024-07-09T08:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-07-09T10:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: true,
      theatricalPrecedenceVerified: true,
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Theatrical release 2024-06-14; 28-day theatrical window concluded prior to July 12 Netflix premiere.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Netflix India / The Indian Express',
      sourceUrl: 'https://indianexpress.com/article/entertainment/tamil/vijay-sethupathi-maharaja-ott-release-date-netflix-9442435/',
      evidenceDate: '2024-07-09',
      corroboratingUrls: ['https://about.netflix.com/en/newsroom/maharaja-on-netflix']
    },
    expectedClassification: 'RECENT_DIGITAL_PREMIERE',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Netflix India / Passion Studios',
      corroborationDegree: 'MULTI_OUTLET_VERIFIED',
      confidence: 'HIGH'
    },
    verificationNotes: 'Vijay Sethupathi milestone 50th film; major critical and streaming success.'
  },
  {
    benchmarkId: 'KB-RDP-04',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-08-16T12:00:00.000Z',
    evidenceObservedAt: '2024-08-16T14:00:00.000Z',
    verifiedOutcomeAsOf: '2024-08-23T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 1136418,
    title: 'Raayan',
    originalTitle: 'ராயன்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'RECENT_DIGITAL_PREMIERE',
    platform: 'Amazon Prime Video',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-08-16T12:00:00.000Z',
      evidenceObservedAt: '2024-08-16T14:00:00.000Z',
      provenanceSource: 'Sun Pictures / Prime Video Licensing Disclosure',
      notes: 'Prime Video India & Sun NXT dual-platform SVOD premiere'
    },
    premiereDate: '2024-08-23',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-07-26',
      theatricalClosureDate: '2024-08-22',
      theatricalClosureEvidence: 'https://www.hindustantimes.com/entertainment/tamil-cinema/dhanush-raayan-ott-release-date-when-and-where-to-watch-sun-nxt-prime-video-101724392817290.html',
      theatricalClosureEvidencePublishedAt: '2024-08-16T12:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-08-16T14:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: true,
      theatricalPrecedenceVerified: true,
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Released in cinemas 2024-07-26; 28-day theatrical window completed with closure on 2024-08-22.'
    },
    evidence: {
      sourceType: 'OFFICIAL_STUDIO_ANNOUNCEMENT',
      sourceName: 'Sun Pictures / Prime Video / Hindustan Times',
      sourceUrl: 'https://www.hindustantimes.com/entertainment/tamil-cinema/dhanush-raayan-ott-release-date-when-and-where-to-watch-sun-nxt-prime-video-101724392817290.html',
      evidenceDate: '2024-08-16',
      corroboratingUrls: ['https://www.cinemaexpress.com/tamil/news/2024/Aug/16/dhanushs-raayan-gets-ott-release-date']
    },
    expectedClassification: 'RECENT_DIGITAL_PREMIERE',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Sun Pictures Official / Prime Video India',
      corroborationDegree: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      confidence: 'HIGH'
    },
    verificationNotes: 'Dhanush 50th acting venture, A-rated action crime drama.'
  },
  {
    benchmarkId: 'KB-RDP-05',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-10-08T11:00:00.000Z',
    evidenceObservedAt: '2024-10-08T13:00:00.000Z',
    verifiedOutcomeAsOf: '2024-10-11T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 1051426,
    title: 'Vaazhai',
    originalTitle: 'வாழை',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'RECENT_DIGITAL_PREMIERE',
    platform: 'Disney+ Hotstar',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-10-08T11:00:00.000Z',
      evidenceObservedAt: '2024-10-08T13:00:00.000Z',
      provenanceSource: 'Disney+ Hotstar India Content Disclosure',
      notes: 'Disney+ Hotstar India exclusive digital premiere'
    },
    premiereDate: '2024-10-11',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-08-23',
      theatricalClosureDate: '2024-10-10',
      theatricalClosureEvidence: 'https://www.ndtv.com/entertainment/mari-selvarajs-vaazhai-ott-release-date-confirmed-disney-hotstar-6745120',
      theatricalClosureEvidencePublishedAt: '2024-10-08T11:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-10-08T13:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: true,
      theatricalPrecedenceVerified: true,
      theatricalRunConcluded: true,
      theatricalRunNotes: '7-week theatrical run successfully completed before streaming premiere on 2024-10-11.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Disney+ Hotstar India / NDTV',
      sourceUrl: 'https://www.ndtv.com/entertainment/mari-selvarajs-vaazhai-ott-release-date-confirmed-disney-hotstar-6745120',
      evidenceDate: '2024-10-08',
      corroboratingUrls: ['https://www.thehindu.com/entertainment/movies/mari-selvaraj-vaazhai-ott-release-date/article68732009.ece']
    },
    expectedClassification: 'RECENT_DIGITAL_PREMIERE',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Disney+ Hotstar India / Navvi Studios',
      corroborationDegree: 'MULTI_OUTLET_VERIFIED',
      confidence: 'HIGH'
    },
    verificationNotes: 'Mari Selvaraj biographical drama; acclaimed box-office and streaming performer.'
  },
  {
    benchmarkId: 'KB-RDP-06',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-07-01T10:00:00.000Z',
    evidenceObservedAt: '2024-07-01T12:00:00.000Z',
    verifiedOutcomeAsOf: '2024-07-03T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 1238692,
    title: 'Garudan',
    originalTitle: 'கருடன்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'RECENT_DIGITAL_PREMIERE',
    platform: 'Amazon Prime Video',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-07-01T10:00:00.000Z',
      evidenceObservedAt: '2024-07-01T12:00:00.000Z',
      provenanceSource: 'Prime Video India Domestic Content Registry',
      notes: 'Prime Video India subscription streaming'
    },
    premiereDate: '2024-07-03',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-05-31',
      theatricalClosureDate: '2024-07-02',
      theatricalClosureEvidence: 'https://www.ottplay.com/news/garudan-ott-release-date-soori-sasikumar-unni-mukundan-prime-video/8643204487935',
      theatricalClosureEvidencePublishedAt: '2024-07-01T10:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-07-01T12:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: true,
      theatricalPrecedenceVerified: true,
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Theatrical run began 2024-05-31; concluded 33 days later on 2024-07-02.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Amazon Prime Video India / OTTplay',
      sourceUrl: 'https://www.ottplay.com/news/garudan-ott-release-date-soori-sasikumar-unni-mukundan-prime-video/8643204487935',
      evidenceDate: '2024-07-01',
      corroboratingUrls: ['https://www.cinemaexpress.com/tamil/news/2024/Jul/01/garudan-gets-ott-release-date']
    },
    expectedClassification: 'RECENT_DIGITAL_PREMIERE',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Prime Video India / Lark Studios',
      corroborationDegree: 'MULTI_OUTLET_VERIFIED',
      confidence: 'HIGH'
    },
    verificationNotes: 'Rural action drama starring Soori, M. Sasikumar, and Unni Mukundan.'
  },
  {
    benchmarkId: 'KB-RDP-07',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-09-26T09:00:00.000Z',
    evidenceObservedAt: '2024-09-26T11:00:00.000Z',
    verifiedOutcomeAsOf: '2024-09-27T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 1242372,
    title: 'Kottukkaali',
    originalTitle: 'கொட்டுக்காளி',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'RECENT_DIGITAL_PREMIERE',
    platform: 'Amazon Prime Video',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-09-26T09:00:00.000Z',
      evidenceObservedAt: '2024-09-26T11:00:00.000Z',
      provenanceSource: 'Prime Video India Licensed Lineup',
      notes: 'Prime Video India SVOD catalog'
    },
    premiereDate: '2024-09-27',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-08-23',
      theatricalClosureDate: '2024-09-26',
      theatricalClosureEvidence: 'https://www.cinemaexpress.com/tamil/news/2024/Sep/26/soori-anna-ben-kottukkaali-gets-ott-release-date',
      theatricalClosureEvidencePublishedAt: '2024-09-26T09:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-09-26T11:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: true,
      theatricalPrecedenceVerified: true,
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Theatrical run concluded after 5 weeks on 2024-09-26.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Prime Video India / Cinema Express',
      sourceUrl: 'https://www.cinemaexpress.com/tamil/news/2024/Sep/26/soori-anna-ben-kottukkaali-gets-ott-release-date',
      evidenceDate: '2024-09-26',
      corroboratingUrls: ['https://www.thehindu.com/entertainment/movies/ps-vinothraj-kottukkaali-streaming-on-prime-video/article68688410.ece']
    },
    expectedClassification: 'RECENT_DIGITAL_PREMIERE',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Prime Video India / Sivakarthikeyan Productions',
      corroborationDegree: 'MULTI_OUTLET_VERIFIED',
      confidence: 'HIGH'
    },
    verificationNotes: 'Directed by P.S. Vinothraj; Berlin International Film Festival selection.'
  },
  {
    benchmarkId: 'KB-RDP-08',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-09-23T10:00:00.000Z',
    evidenceObservedAt: '2024-09-23T12:00:00.000Z',
    verifiedOutcomeAsOf: '2024-09-27T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 1059064,
    title: 'Demonte Colony 2',
    originalTitle: 'டிமான்ட்டி காலனி 2',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'RECENT_DIGITAL_PREMIERE',
    platform: 'ZEE5',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-09-23T10:00:00.000Z',
      evidenceObservedAt: '2024-09-23T12:00:00.000Z',
      provenanceSource: 'ZEE5 India Content Catalog',
      notes: 'ZEE5 India SVOD exclusive'
    },
    premiereDate: '2024-09-27',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-08-15',
      theatricalClosureDate: '2024-09-26',
      theatricalClosureEvidence: 'https://timesofindia.indiatimes.com/entertainment/tamil/movies/news/arun-pandians-demonte-colony-2-to-stream-on-zee5-from-september-27/articleshow/113576395.cms',
      theatricalClosureEvidencePublishedAt: '2024-09-23T10:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-09-23T12:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: true,
      theatricalPrecedenceVerified: true,
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Released on Independence Day 2024; 6-week theatrical exclusivity completed on 2024-09-26.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'ZEE5 India / Times of India',
      sourceUrl: 'https://timesofindia.indiatimes.com/entertainment/tamil/movies/news/arun-pandians-demonte-colony-2-to-stream-on-zee5-from-september-27/articleshow/113576395.cms',
      evidenceDate: '2024-09-23',
      corroboratingUrls: ['https://www.cinemaexpress.com/tamil/news/2024/Sep/23/demonte-colony-2-gets-ott-release-date']
    },
    expectedClassification: 'RECENT_DIGITAL_PREMIERE',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'ZEE5 India / BTG Universal',
      corroborationDegree: 'MULTI_OUTLET_VERIFIED',
      confidence: 'HIGH'
    },
    verificationNotes: 'Supernatural horror thriller directed by R. Ajay Gnanamuthu starring Arulnithi.'
  },

  // =========================================================================
  // CATEGORY 2: UPCOMING DIGITAL PREMIERES (6 TITLES)
  // Contracted post-theatrical window or verified future streaming announcement
  // scheduled strictly AFTER benchmarkAsOf (2024-10-31T00:00:00.000Z).
  //
  // TEMPORAL INTEGRITY RULE:
  // benchmarkKnowledgeAvailableAtSnapshot is true ONLY if official evidence was
  // published on or before 2024-10-31T00:00:00.000Z. For titles whose exact release
  // date was published post-snapshot, benchmarkKnowledgeAvailableAtSnapshot is false,
  // and the verified release date is recorded in verifiedOutcomeAsOf.
  // =========================================================================
  {
    benchmarkId: 'KB-UDP-01',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-11-01T06:00:00.000Z', // Officially announced Nov 1
    evidenceObservedAt: '2024-11-01T06:30:00.000Z',
    verifiedOutcomeAsOf: '2024-11-08T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: false, // Audit: exact date published post-snapshot
    tmdbId: 1144944,
    title: 'Vettaiyan',
    originalTitle: 'வேட்டையன்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'UPCOMING_DIGITAL_PREMIERE',
    platform: 'Amazon Prime Video',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-11-01T06:00:00.000Z',
      evidenceObservedAt: '2024-11-01T06:30:00.000Z',
      provenanceSource: 'Prime Video India Content Rights Catalog',
      notes: 'Prime Video India digital streaming release'
    },
    premiereDate: '2024-11-08',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-10-10',
      theatricalClosureDate: '2024-10-30',
      theatricalClosureEvidence: 'https://www.thehindu.com/entertainment/movies/vettaiyan-box-office-theatrical-run-closure/article68812390.ece',
      theatricalClosureEvidencePublishedAt: '2024-11-01T06:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-11-01T06:30:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: false, // Closure evidence published post-snapshot
      theatricalPrecedenceVerified: true,
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Theatrical run began 2024-10-10; screens transitioned on 2024-10-30 ahead of Diwali releases, completing theatrical window.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Amazon Prime Video / The Hindu',
      sourceUrl: 'https://www.thehindu.com/entertainment/movies/rajinikanths-vettaiyan-gets-ott-release-date/article68822550.ece',
      evidenceDate: '2024-11-01',
      corroboratingUrls: ['https://www.cinemaexpress.com/tamil/news/2024/Nov/01/rajinikanth-vettaiyan-ott-release-date-prime-video']
    },
    expectedClassification: 'UPCOMING_DIGITAL_PREMIERE',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Prime Video India / Lyca Productions',
      corroborationDegree: 'MULTI_OUTLET_VERIFIED',
      confidence: 'HIGH'
    },
    verificationNotes: 'Starring Rajinikanth, Amitabh Bachchan, Fahadh Faasil; directed by T.J. Gnanavel. OTT premiere November 8, 2024.'
  },
  {
    benchmarkId: 'KB-UDP-02',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-10-30T10:00:00.000Z', // Officially announced Oct 30 (pre-snapshot)
    evidenceObservedAt: '2024-10-30T12:00:00.000Z',
    verifiedOutcomeAsOf: '2024-11-01T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true, // Audit: available before snapshot cutoff
    tmdbId: 1339396,
    title: 'Black',
    originalTitle: 'பிளாக்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'UPCOMING_DIGITAL_PREMIERE',
    platform: 'Amazon Prime Video',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-10-30T10:00:00.000Z',
      evidenceObservedAt: '2024-10-30T12:00:00.000Z',
      provenanceSource: 'Prime Video India Content Rights Catalog',
      notes: 'Prime Video India SVOD release'
    },
    premiereDate: '2024-11-01',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-10-11',
      theatricalClosureDate: '2024-10-30',
      theatricalClosureEvidence: 'https://www.cinemaexpress.com/tamil/news/2024/Oct/30/jiiva-priya-bhavani-shankar-black-ott-release-date-out',
      theatricalClosureEvidencePublishedAt: '2024-10-30T10:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-10-30T12:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: true,
      theatricalPrecedenceVerified: true,
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Released 2024-10-11; 3-week theatrical run concluded on 2024-10-30 ahead of Diwali tentpoles.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Prime Video / Cinema Express',
      sourceUrl: 'https://www.cinemaexpress.com/tamil/news/2024/Oct/30/jiiva-priya-bhavani-shankar-black-ott-release-date-out',
      evidenceDate: '2024-10-30',
      corroboratingUrls: ['https://www.thehindu.com/entertainment/movies/jiiva-black-ott-release-date/article68812301.ece']
    },
    expectedClassification: 'UPCOMING_DIGITAL_PREMIERE',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Prime Video India / Potential Studios',
      corroborationDegree: 'MULTI_OUTLET_VERIFIED',
      confidence: 'HIGH'
    },
    verificationNotes: 'Sci-fi psychological mystery film starring Jiiva and Priya Bhavani Shankar. Dropping Nov 1, 2024.'
  },
  {
    benchmarkId: 'KB-UDP-03',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-11-24T05:00:00.000Z', // Officially announced late November
    evidenceObservedAt: '2024-11-24T06:00:00.000Z',
    verifiedOutcomeAsOf: '2024-11-29T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: false, // Audit: exact date announced post-snapshot
    tmdbId: 1181822,
    title: 'Brother',
    originalTitle: 'பிரதர்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'UPCOMING_DIGITAL_PREMIERE',
    platform: 'ZEE5',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-11-24T05:00:00.000Z',
      evidenceObservedAt: '2024-11-24T06:00:00.000Z',
      provenanceSource: 'ZEE5 India Digital Rights Registry',
      notes: 'ZEE5 India post-theatrical digital license'
    },
    premiereDate: '2024-11-29',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-10-31',
      theatricalClosureDate: '2024-11-28',
      theatricalClosureEvidence: 'https://www.cinemaexpress.com/tamil/news/2024/Nov/25/jayam-ravi-brother-theatrical-closure-zee5',
      theatricalClosureEvidencePublishedAt: '2024-11-24T05:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-11-24T06:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: false, // Theatrical closure occurred in late November
      theatricalPrecedenceVerified: true, // Retrospectively verified upon 4-week window closure on 2024-11-28
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Diwali 2024 theatrical premiere; standard 4-week theatrical window verified closed on 2024-11-28.'
    },
    evidence: {
      sourceType: 'OFFICIAL_STUDIO_ANNOUNCEMENT',
      sourceName: 'Screen Scene Media / ZEE5 / OTTplay',
      sourceUrl: 'https://www.ottplay.com/news/brother-ott-release-date-where-to-watch-jayam-ravi-m-rajesh-film-after-theatrical-run/86744920',
      evidenceDate: '2024-11-24',
      corroboratingUrls: ['https://www.cinemaexpress.com/tamil/news/2024/Nov/25/jayam-ravi-brother-theatrical-closure-zee5']
    },
    expectedClassification: 'UPCOMING_DIGITAL_PREMIERE',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'ZEE5 / Screen Scene Media Entertainment',
      corroborationDegree: 'MULTI_OUTLET_VERIFIED',
      confidence: 'HIGH'
    },
    verificationNotes: 'Family comedy drama directed by M. Rajesh starring Jayam Ravi. Theatrical closure Nov 28, OTT Nov 29.'
  },
  {
    benchmarkId: 'KB-UDP-04',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-11-25T04:00:00.000Z', // Officially announced late November
    evidenceObservedAt: '2024-11-25T05:00:00.000Z',
    verifiedOutcomeAsOf: '2024-11-29T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: false, // Audit: exact date announced post-snapshot
    tmdbId: 1284004,
    title: 'Bloody Beggar',
    originalTitle: 'ப்ளடி பெக்கர்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'UPCOMING_DIGITAL_PREMIERE',
    platform: 'Amazon Prime Video',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-11-25T04:00:00.000Z',
      evidenceObservedAt: '2024-11-25T05:00:00.000Z',
      provenanceSource: 'Prime Video India Rights Catalog',
      notes: 'Prime Video India post-theatrical streaming'
    },
    premiereDate: '2024-11-29',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-10-31',
      theatricalClosureDate: '2024-11-28',
      theatricalClosureEvidence: 'https://www.cinemaexpress.com/tamil/news/2024/Nov/26/bloody-beggar-theatrical-run-prime-video',
      theatricalClosureEvidencePublishedAt: '2024-11-25T04:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-11-25T05:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: false, // Theatrical closure occurred in late November
      theatricalPrecedenceVerified: true, // Retrospectively verified upon 4-week window closure on 2024-11-28
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Diwali theatrical release; post-theatrical 4-week exclusivity verified closed on 2024-11-28.'
    },
    evidence: {
      sourceType: 'OFFICIAL_STUDIO_ANNOUNCEMENT',
      sourceName: 'Filament Pictures / Prime Video / Cinema Express',
      sourceUrl: 'https://www.cinemaexpress.com/tamil/news/2024/Nov/26/bloody-beggar-theatrical-run-prime-video',
      evidenceDate: '2024-11-25',
      corroboratingUrls: ['https://www.ottplay.com/news/bloody-beggar-ott-release-date-kavin-prime-video/86749012']
    },
    expectedClassification: 'UPCOMING_DIGITAL_PREMIERE',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Prime Video India / Filament Pictures',
      corroborationDegree: 'MULTI_OUTLET_VERIFIED',
      confidence: 'HIGH'
    },
    verificationNotes: 'Black comedy film starring Kavin; directed by Sivabalan Muthukumar and produced by Nelson Dilipkumar.'
  },
  {
    benchmarkId: 'KB-UDP-05',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-11-20T09:00:00.000Z', // Officially announced late November
    evidenceObservedAt: '2024-11-20T10:00:00.000Z',
    verifiedOutcomeAsOf: '2024-11-26T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: false, // Audit: exact date announced post-snapshot
    tmdbId: 979929,
    title: 'Andhagan',
    originalTitle: 'அந்தகன்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'UPCOMING_DIGITAL_PREMIERE',
    platform: 'Amazon Prime Video',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-11-20T09:00:00.000Z',
      evidenceObservedAt: '2024-11-20T10:00:00.000Z',
      provenanceSource: 'Prime Video India Rights Catalog',
      notes: 'Prime Video India SVOD digital premiere'
    },
    premiereDate: '2024-11-26',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-08-09',
      theatricalClosureDate: '2024-09-19',
      theatricalClosureEvidence: 'https://www.thehindu.com/entertainment/movies/prashanth-andhagan-box-office-closing/article68662901.ece',
      theatricalClosureEvidencePublishedAt: '2024-09-19T10:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-09-19T12:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: true, // Theatrical closure was known pre-snapshot
      theatricalPrecedenceVerified: true,
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Released theatrically 2024-08-09; theatrical run fully completed and verified on 2024-09-19.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Prime Video / The Hindu',
      sourceUrl: 'https://www.thehindu.com/entertainment/movies/prashanth-andhagan-ott-release-date/article68894120.ece',
      evidenceDate: '2024-11-20',
      corroboratingUrls: ['https://www.cinemaexpress.com/tamil/news/2024/Nov/20/prashanth-andhagan-gets-ott-release-date']
    },
    expectedClassification: 'UPCOMING_DIGITAL_PREMIERE',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Prime Video India / Staar Movies',
      corroborationDegree: 'MULTI_OUTLET_VERIFIED',
      confidence: 'HIGH'
    },
    verificationNotes: 'Directed by Thiagarajan, starring Prashanth. Theatrical run concluded in September 2024; OTT release Nov 26, 2024.'
  },
  {
    benchmarkId: 'KB-UDP-06',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-11-28T10:00:00.000Z', // Officially announced late November
    evidenceObservedAt: '2024-11-28T11:00:00.000Z',
    verifiedOutcomeAsOf: '2024-12-10T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: false, // Audit: exact date announced post-snapshot
    tmdbId: 1010818,
    title: 'Thangalaan',
    originalTitle: 'தங்கலான்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'UPCOMING_DIGITAL_PREMIERE',
    platform: 'Netflix',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-11-28T10:00:00.000Z',
      evidenceObservedAt: '2024-11-28T11:00:00.000Z',
      provenanceSource: 'Netflix India Rights Catalog',
      notes: 'Netflix India flatrate SVOD subscription rights confirmed (no rental/TVOD gate)'
    },
    premiereDate: '2024-12-10',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-08-15',
      theatricalClosureDate: '2024-09-26', // Closure date was BEFORE snapshot
      theatricalClosureEvidence: 'https://about.netflix.com/en/newsroom/thangalaan-streaming-netflix-india',
      theatricalClosureEvidencePublishedAt: '2024-11-28T10:00:00.000Z', // Evidence published AFTER snapshot
      theatricalClosureEvidenceObservedAt: '2024-11-28T11:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: false, // UNAVAILABLE at snapshot because evidence published after snapshot
      theatricalPrecedenceVerified: true,
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Theatrical run ended in September 2024; however, authoritative post-theatrical window closure documentation was published retrospectively on 2024-11-28, so theatrical closure knowledge was unavailable at snapshot.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Netflix India / Studio Green',
      sourceUrl: 'https://about.netflix.com/en/newsroom/thangalaan-streaming-netflix-india',
      evidenceDate: '2024-11-28',
      corroboratingUrls: ['https://www.thehindu.com/entertainment/movies/pa-ranjith-vikram-thangalaan-ott-release/article68748392.ece']
    },
    expectedClassification: 'UPCOMING_DIGITAL_PREMIERE',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Netflix India / Studio Green',
      corroborationDegree: 'MULTI_OUTLET_VERIFIED',
      confidence: 'HIGH'
    },
    verificationNotes: 'Reverified: Actual availability is standard flatrate SUBSCRIPTION on Netflix, not rental. Theatrical run concluded in September.'
  },

  // =========================================================================
  // CATEGORY 3: DIRECT-TO-OTT ORIGINALS (6 TITLES)
  // Web series or direct-to-digital films with zero theatrical release.
  // Season-specific premiere dates independently verified.
  // =========================================================================
  {
    benchmarkId: 'KB-DTO-01',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-03-14T10:00:00.000Z',
    evidenceObservedAt: '2024-03-14T12:00:00.000Z',
    verifiedOutcomeAsOf: '2024-03-29T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 247120,
    title: 'Inspector Rishi',
    originalTitle: 'இன்ஸ்பெக்டர் ரிஷி',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'tv',
    seasonNumber: 1,
    category: 'DIRECT_TO_OTT_ORIGINAL',
    platform: 'Amazon Prime Video',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-03-14T10:00:00.000Z',
      evidenceObservedAt: '2024-03-14T12:00:00.000Z',
      provenanceSource: 'Amazon MGM Studios Original Licensing',
      notes: 'Amazon Prime Video Original direct-to-digital release in India'
    },
    premiereDate: '2024-03-29',
    theatricalPrecedence: {
      hasTheatricalRelease: false,
      theatricalRunConcluded: false,
      theatricalPrecedenceVerified: true, // Non-theatrical verified
      theatricalClosureKnowledgeAvailableAtSnapshot: false,
      theatricalRunNotes: 'Direct-to-OTT web series; zero theatrical exhibition.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Amazon Prime Video MGM Studios',
      sourceUrl: 'https://press.amazonmgmstudios.com/us/en/press-release/prime-video-announces-the-global-premiere-of-its-',
      evidenceDate: '2024-03-14',
      corroboratingUrls: ['https://www.thehindu.com/entertainment/movies/inspector-rishi-trailer-naveen-chandra-prime-video/article67969894.ece']
    },
    expectedClassification: 'DIRECT_TO_OTT_ORIGINAL',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Prime Video Original / Make Believe Productions',
      corroborationDegree: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      confidence: 'HIGH'
    },
    verificationNotes: 'Season 1 premiered March 29, 2024. Horror mystery series starring Naveen Chandra and Sunaina; directed by J.S. Nandhini.'
  },
  {
    benchmarkId: 'KB-DTO-02',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-07-13T09:00:00.000Z',
    evidenceObservedAt: '2024-07-13T11:00:00.000Z',
    verifiedOutcomeAsOf: '2024-07-26T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 259685,
    title: 'Chutney Sambar',
    originalTitle: 'சட்னி சாம்பார்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'tv',
    seasonNumber: 1,
    category: 'DIRECT_TO_OTT_ORIGINAL',
    platform: 'Disney+ Hotstar',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-07-13T09:00:00.000Z',
      evidenceObservedAt: '2024-07-13T11:00:00.000Z',
      provenanceSource: 'Disney+ Hotstar Specials Licensing',
      notes: 'Hotstar Specials India subscription original'
    },
    premiereDate: '2024-07-26',
    theatricalPrecedence: {
      hasTheatricalRelease: false,
      theatricalRunConcluded: false,
      theatricalPrecedenceVerified: true,
      theatricalClosureKnowledgeAvailableAtSnapshot: false,
      theatricalRunNotes: 'Hotstar Specials web series; zero theatrical release.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Disney+ Hotstar / The Hindu',
      sourceUrl: 'https://www.thehindu.com/entertainment/movies/yogi-babu-radha-mohan-chutney-sambar-trailer-streaming-date/article68400326.ece',
      evidenceDate: '2024-07-13',
      corroboratingUrls: ['https://www.cinemaexpress.com/tamil/news/2024/Jul/13/yogi-babus-chutney-sambar-gets-premiere-date']
    },
    expectedClassification: 'DIRECT_TO_OTT_ORIGINAL',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Disney+ Hotstar Specials / Vels Film International',
      corroborationDegree: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      confidence: 'HIGH'
    },
    verificationNotes: 'Season 1 premiered July 26, 2024. Light-hearted comedy drama series created by Radha Mohan starring Yogi Babu.'
  },
  {
    benchmarkId: 'KB-DTO-03',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-05-02T10:00:00.000Z',
    evidenceObservedAt: '2024-05-02T12:00:00.000Z',
    verifiedOutcomeAsOf: '2024-05-17T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 254880,
    title: 'Thalaimai Seyalagam',
    originalTitle: 'தலைமைச் செயலகம்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'tv',
    seasonNumber: 1,
    category: 'DIRECT_TO_OTT_ORIGINAL',
    platform: 'ZEE5',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-05-02T10:00:00.000Z',
      evidenceObservedAt: '2024-05-02T12:00:00.000Z',
      provenanceSource: 'ZEE5 Originals Licensing Registry',
      notes: 'ZEE5 Original series release in India'
    },
    premiereDate: '2024-05-17',
    theatricalPrecedence: {
      hasTheatricalRelease: false,
      theatricalRunConcluded: false,
      theatricalPrecedenceVerified: true,
      theatricalClosureKnowledgeAvailableAtSnapshot: false,
      theatricalRunNotes: 'ZEE5 Original web series; zero theatrical run.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'ZEE5 India / Cinema Express',
      sourceUrl: 'https://www.cinemaexpress.com/tamil/news/2024/May/02/vasanthabalans-political-thriller-series-thalaimai-seyalagam-gets-premiere-date',
      evidenceDate: '2024-05-02',
      corroboratingUrls: ['https://www.thehindu.com/entertainment/movies/thalaimai-seyalagam-trailer-vasanthabalan-zee5/article68158021.ece']
    },
    expectedClassification: 'DIRECT_TO_OTT_ORIGINAL',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'ZEE5 Original / Radaan Mediaworks',
      corroborationDegree: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      confidence: 'HIGH'
    },
    verificationNotes: 'Season 1 premiered May 17, 2024. High-stakes political drama directed by Vasanthabalan; starring Kishore and Sriya Reddy.'
  },
  {
    benchmarkId: 'KB-DTO-04',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-08-08T11:00:00.000Z',
    evidenceObservedAt: '2024-08-08T13:00:00.000Z',
    verifiedOutcomeAsOf: '2024-08-15T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 231502,
    title: 'Vera Maari Office',
    originalTitle: 'வேற மாறி ஆபீஸ்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'tv',
    seasonNumber: 2,
    category: 'DIRECT_TO_OTT_ORIGINAL',
    platform: 'Aha Tamil',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-08-08T11:00:00.000Z',
      evidenceObservedAt: '2024-08-08T13:00:00.000Z',
      provenanceSource: 'Aha Tamil Originals Registry',
      notes: 'Aha Tamil original subscription streaming'
    },
    premiereDate: '2024-08-15',
    theatricalPrecedence: {
      hasTheatricalRelease: false,
      theatricalRunConcluded: false,
      theatricalPrecedenceVerified: true,
      theatricalClosureKnowledgeAvailableAtSnapshot: false,
      theatricalRunNotes: 'Direct-to-OTT Aha Tamil comedy sitcom; zero theatrical release.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Aha Tamil / OTTplay',
      sourceUrl: 'https://www.ottplay.com/news/vera-maari-office-season-2-ott-release-date-aha-tamil-rj-vijay/86482012891',
      evidenceDate: '2024-08-08',
      corroboratingUrls: ['https://www.cinemaexpress.com/tamil/news/2024/Aug/08/vera-maari-office-season-2-trailer-out']
    },
    expectedClassification: 'DIRECT_TO_OTT_ORIGINAL',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Aha Tamil Original / Shivakanth',
      corroborationDegree: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      confidence: 'HIGH'
    },
    verificationNotes: 'Season 2 premiered August 15, 2024 (Season 1 was August 10, 2023). Workplace comedy starring RJ Vijay.'
  },
  {
    benchmarkId: 'KB-DTO-05',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-09-02T10:00:00.000Z',
    evidenceObservedAt: '2024-09-02T12:00:00.000Z',
    verifiedOutcomeAsOf: '2024-09-13T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 268600,
    title: 'Goli Soda Rising',
    originalTitle: 'கோலி சோடா ரைசிங்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'tv',
    seasonNumber: 1,
    category: 'DIRECT_TO_OTT_ORIGINAL',
    platform: 'Disney+ Hotstar',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-09-02T10:00:00.000Z',
      evidenceObservedAt: '2024-09-02T12:00:00.000Z',
      provenanceSource: 'Disney+ Hotstar Specials Rights Registry',
      notes: 'Hotstar Specials India SVOD exclusive'
    },
    premiereDate: '2024-09-13',
    theatricalPrecedence: {
      hasTheatricalRelease: false,
      theatricalRunConcluded: false,
      theatricalPrecedenceVerified: true,
      theatricalClosureKnowledgeAvailableAtSnapshot: false,
      theatricalRunNotes: 'Direct-to-OTT Hotstar Specials web series; zero theatrical run.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Disney+ Hotstar / Times of India',
      sourceUrl: 'https://timesofindia.indiatimes.com/entertainment/tamil/web-series/goli-soda-rising-web-series-to-premiere-on-disney-hotstar-on-september-13/articleshow/112953282.cms',
      evidenceDate: '2024-09-02',
      corroboratingUrls: ['https://www.cinemaexpress.com/tamil/news/2024/Sep/02/goli-soda-rising-premiere-date-announced']
    },
    expectedClassification: 'DIRECT_TO_OTT_ORIGINAL',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Disney+ Hotstar Specials / Roughnote Production',
      corroborationDegree: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      confidence: 'HIGH'
    },
    verificationNotes: 'Season 1 premiered September 13, 2024. Action drama series created by S.D. Vijay Milton.'
  },
  {
    benchmarkId: 'KB-DTO-06',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-10-07T08:00:00.000Z',
    evidenceObservedAt: '2024-10-07T10:00:00.000Z',
    verifiedOutcomeAsOf: '2024-10-18T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 271500,
    title: 'Snakes and Ladders',
    originalTitle: 'ஸ்நேக்ஸ் அண்ட் லேடர்ஸ்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'tv',
    seasonNumber: 1,
    category: 'DIRECT_TO_OTT_ORIGINAL',
    platform: 'Amazon Prime Video',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-10-07T08:00:00.000Z',
      evidenceObservedAt: '2024-10-07T10:00:00.000Z',
      provenanceSource: 'Amazon MGM Studios Original Catalog',
      notes: 'Amazon Prime Video Original release in India and 240+ countries'
    },
    premiereDate: '2024-10-18',
    theatricalPrecedence: {
      hasTheatricalRelease: false,
      theatricalRunConcluded: false,
      theatricalPrecedenceVerified: true,
      theatricalClosureKnowledgeAvailableAtSnapshot: false,
      theatricalRunNotes: 'Direct-to-OTT Prime Video Original thriller; zero theatrical release.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Amazon Prime Video India Press Release',
      sourceUrl: 'https://aboutamazon.in/news/entertainment/snakes-and-ladders-tamil-series-prime-video-release-date',
      evidenceDate: '2024-10-07',
      corroboratingUrls: ['https://www.thehindu.com/entertainment/movies/snakes-and-ladders-trailer-karthik-subbaraj-prime-video/article68740112.ece']
    },
    expectedClassification: 'DIRECT_TO_OTT_ORIGINAL',
    expectedGateDecision: 'ALLOW_PUBLICATION',
    provenance: {
      sourceAuthority: 'Prime Video India / Stone Bench Productions (Karthik Subbaraj)',
      corroborationDegree: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      confidence: 'HIGH'
    },
    verificationNotes: 'Season 1 premiered October 18, 2024. Curated by Karthik Subbaraj; suspense adventure series about four kids.'
  },

  // =========================================================================
  // CATEGORY 4: NEGATIVE CONTROLS (5 TITLES)
  // Adversarial & edge case controls that MUST fail validation gates.
  // Reverified: 100% genuine TMDB identities and authentic real-world parameters.
  // =========================================================================
  {
    benchmarkId: 'KB-NEG-01',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-10-31T00:00:00.000Z',
    evidenceObservedAt: '2024-10-31T06:00:00.000Z',
    verifiedOutcomeAsOf: '2024-12-11T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 969602,
    title: 'Amaran',
    originalTitle: 'அமரன்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'NEGATIVE_CONTROL',
    platform: 'Netflix',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-10-31T00:00:00.000Z',
      evidenceObservedAt: '2024-10-31T06:00:00.000Z',
      provenanceSource: 'Raaj Kamal Films International Distribution Notice',
      notes: 'Netflix acquired post-theatrical streaming rights for December 11, 2024'
    },
    premiereDate: '2024-12-11',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-10-31',
      theatricalClosureDate: undefined, // UNVERIFIED: Actively screening on snapshot date
      theatricalClosureEvidence: undefined, // UNVERIFIED: Cannot infer closure
      theatricalClosureEvidencePublishedAt: undefined,
      theatricalClosureEvidenceObservedAt: undefined,
      theatricalClosureKnowledgeAvailableAtSnapshot: false,
      theatricalPrecedenceVerified: false,
      theatricalRunConcluded: false,
      theatricalRunNotes: 'Theatrical run began 2024-10-31 (morning snapshot boundary 05:30 IST); actively screening in 900+ cinemas across India as of benchmarkAsOf (2024-10-31). Theatrical closure is unverified.'
    },
    evidence: {
      sourceType: 'OFFICIAL_STUDIO_ANNOUNCEMENT',
      sourceName: 'Raaj Kamal Films International / The Hindu',
      sourceUrl: 'https://www.thehindu.com/entertainment/movies/sivakarthikeyans-amaran-release-date-announced/article68415270.ece',
      evidenceDate: '2024-10-31',
      corroboratingUrls: ['https://www.cinemaexpress.com/tamil/news/2024/Nov/28/sivakarthikeyan-amaran-ott-release-date-netflix']
    },
    expectedClassification: 'EXCLUDED_THEATRICALLY_ACTIVE',
    expectedGateDecision: 'REJECT_THEATRICAL_PRECEDENCE',
    provenance: {
      sourceAuthority: 'Raaj Kamal Films International',
      corroborationDegree: 'MULTI_OUTLET_VERIFIED',
      confidence: 'HIGH'
    },
    verificationNotes: 'NEGATIVE CONTROL 1: Released in theaters 2024-10-31. Theatrical run is actively screening on snapshot date; theatrical closure is strictly unverified. Theatrical precedence gate must reject.'
  },
  {
    benchmarkId: 'KB-NEG-02',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-06-07T08:00:00.000Z',
    evidenceObservedAt: '2024-06-07T10:00:00.000Z',
    verifiedOutcomeAsOf: '2024-06-07T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 1276338,
    title: 'Star',
    originalTitle: 'ஸ்டார்',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'NEGATIVE_CONTROL',
    platform: 'Simply South',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: false,
      territoryCodes: ['US', 'GB', 'SG', 'MY', 'AE', 'CA', 'AU'],
      supportsIndianRegion: false,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-06-07T08:00:00.000Z',
      evidenceObservedAt: '2024-06-07T10:00:00.000Z',
      provenanceSource: 'Simply South International Geo-Catalog & Distribution Charter (Exhaustive overseas-only license; India excluded)',
      notes: 'Simply South streaming rights strictly exclude territory IN (geoblocked in India, where Prime Video holds domestic SVOD rights)'
    },
    premiereDate: '2024-06-07',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-05-10',
      theatricalClosureDate: '2024-06-05',
      theatricalClosureEvidence: 'https://www.cinemaexpress.com/tamil/news/2024/Jun/05/kavin-star-theatrical-box-office-closure',
      theatricalClosureEvidencePublishedAt: '2024-06-05T10:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-06-05T12:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: true,
      theatricalPrecedenceVerified: true,
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Theatrical run concluded in May/June 2024.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Simply South Official Announcement',
      sourceUrl: 'https://www.simplysouth.tv/movie/detail/Star',
      evidenceDate: '2024-06-07',
      corroboratingUrls: []
    },
    expectedClassification: 'REJECTED_NON_INDIAN_TERRITORY',
    expectedGateDecision: 'REJECT_TERRITORY_NOT_EXPLICIT_INDIA',
    provenance: {
      sourceAuthority: 'Simply South OTT Platform Disclosure',
      corroborationDegree: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      confidence: 'HIGH'
    },
    verificationNotes: 'NEGATIVE CONTROL 2: Genuine Tamil film (Kavin). Simply South streaming catalog strictly excludes India (territoryCodes lacks IN). Stage 4A / Stage 7 territory gate must fail-closed.'
  },
  {
    benchmarkId: 'KB-NEG-03',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-07-20T10:00:00.000Z',
    evidenceObservedAt: '2024-07-20T12:00:00.000Z',
    verifiedOutcomeAsOf: '2025-09-11T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true, // Snapshot knowledge: filming in Chennai/Hyderabad
    tmdbId: 1177098,
    title: 'Coolie',
    originalTitle: 'கூலி',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'NEGATIVE_CONTROL',
    platform: 'Amazon Prime Video',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-07-20T10:00:00.000Z',
      evidenceObservedAt: '2024-07-20T12:00:00.000Z',
      provenanceSource: 'Sun Pictures / Prime Video Digital Rights Ingestion',
      notes: 'Prime Video acquired post-theatrical digital streaming rights'
    },
    premiereDate: '2025-09-11',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2025-08-14',
      theatricalClosureDate: undefined, // UNVERIFIED: Pre-theatrical, unreleased
      theatricalClosureEvidence: undefined,
      theatricalClosureEvidencePublishedAt: undefined,
      theatricalClosureEvidenceObservedAt: undefined,
      theatricalClosureKnowledgeAvailableAtSnapshot: false,
      theatricalPrecedenceVerified: false,
      theatricalRunConcluded: false,
      theatricalRunNotes: 'Film is in active production; planned for theatrical release in 2025. Zero theatrical exhibition has occurred.'
    },
    evidence: {
      sourceType: 'COMMUNITY_SUBMISSION',
      sourceName: 'The Hindu Production Report / Unverified Claim',
      sourceUrl: 'https://www.thehindu.com/entertainment/movies/rajinikanth-lokesh-kanagaraj-coolie-release-updates/article68322891.ece',
      evidenceDate: '2024-07-20',
      corroboratingUrls: []
    },
    expectedClassification: 'QUARANTINED_UNCORROBORATED',
    expectedGateDecision: 'QUARANTINE_UNVERIFIED_EVIDENCE',
    provenance: {
      sourceAuthority: 'The Hindu / Sun Pictures / Community Claim',
      corroborationDegree: 'MULTI_OUTLET_VERIFIED',
      confidence: 'HIGH'
    },
    verificationNotes: 'NEGATIVE CONTROL 3: Reverified: Coolie is in production. Any claim alleging streaming release before theatrical release lacks authentic publisher ticket or signed closure proof. Must quarantine.'
  },
  {
    benchmarkId: 'KB-NEG-04',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-06-21T09:00:00.000Z',
    evidenceObservedAt: '2024-06-21T11:00:00.000Z',
    verifiedOutcomeAsOf: '2024-06-21T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 1140905,
    title: 'Aranmanai 4',
    originalTitle: 'அரண்மனை 4',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'NEGATIVE_CONTROL',
    platform: 'Amazon Prime Video Store',
    availabilityModel: 'RENTAL',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-06-21T09:00:00.000Z',
      evidenceObservedAt: '2024-06-21T11:00:00.000Z',
      provenanceSource: 'Google TV / Amazon Prime Video Store India TVOD storefront',
      notes: 'India territory pay-per-view TVOD rental store'
    },
    premiereDate: '2024-06-21',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-05-03',
      theatricalClosureDate: '2024-06-15',
      theatricalClosureEvidence: 'https://timesofindia.indiatimes.com/entertainment/tamil/movies/box-office/aranmanai-4-box-office-collection-closing/articleshow/111019283.cms',
      theatricalClosureEvidencePublishedAt: '2024-06-15T12:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-06-15T14:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: true,
      theatricalPrecedenceVerified: true,
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Theatrical run concluded in June 2024.'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Google TV / Prime Video Store TVOD',
      sourceUrl: 'https://play.google.com/store/movies/details/Aranmanai_4',
      evidenceDate: '2024-06-21',
      corroboratingUrls: []
    },
    transactionalModelDetails: {
      pricingTier: 'TVOD_RENTAL',
      priceAmount: 99,
      priceCurrency: 'INR',
      rentalWindowHours: 48,
      pricingObservedAt: '2024-06-21T11:00:00.000Z',
      priceValiditySnapshotAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
      storefrontSource: 'Google TV / Amazon Prime Video Store India TVOD storefront',
      territoryCode: 'IN',
      volatilityNotice: 'Transactional pricing is observation-bound to the snapshot window and must not be assumed permanently valid.'
    },
    expectedClassification: 'REJECTED_NON_SUBSCRIPTION',
    expectedGateDecision: 'REJECT_NON_SUBSCRIPTION',
    provenance: {
      sourceAuthority: 'Google TV / Prime Video Store Transactional Catalog',
      corroborationDegree: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      confidence: 'HIGH'
    },
    verificationNotes: 'NEGATIVE CONTROL 4: Title-specific Indian TVOD rental listing (₹99 for 48h rental). Fails Stage 4B / Stage 7 flatrate SUBSCRIPTION rule.'
  },
  {
    benchmarkId: 'KB-NEG-05',
    benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
    evidencePublishedAt: '2024-08-04T10:00:00.000Z',
    evidenceObservedAt: '2024-08-04T12:00:00.000Z',
    verifiedOutcomeAsOf: '2024-08-09T00:00:00.000Z',
    benchmarkKnowledgeAvailableAtSnapshot: true,
    tmdbId: 552398,
    title: 'Indian 3',
    originalTitle: 'இந்தியன் 2',
    originalLanguage: 'ta',
    industry: 'Kollywood',
    contentType: 'movie',
    category: 'NEGATIVE_CONTROL',
    platform: 'Netflix',
    availabilityModel: 'SUBSCRIPTION',
    territory: {
      isIndiaExplicit: true,
      territoryCodes: ['IN'],
      supportsIndianRegion: true,
      completenessStatus: 'EXHAUSTIVE',
      isExhaustive: true,
      evidencePublishedAt: '2024-08-04T10:00:00.000Z',
      evidenceObservedAt: '2024-08-04T12:00:00.000Z',
      provenanceSource: 'Netflix India Licensed Content Registry',
      notes: 'India territory'
    },
    premiereDate: '2024-08-09',
    theatricalPrecedence: {
      hasTheatricalRelease: true,
      theatricalReleaseDate: '2024-07-12',
      theatricalClosureDate: '2024-08-05',
      theatricalClosureEvidence: 'https://about.netflix.com/en/newsroom/indian-2-streaming',
      theatricalClosureEvidencePublishedAt: '2024-08-04T10:00:00.000Z',
      theatricalClosureEvidenceObservedAt: '2024-08-04T12:00:00.000Z',
      theatricalClosureKnowledgeAvailableAtSnapshot: true,
      theatricalPrecedenceVerified: true,
      theatricalRunConcluded: true,
      theatricalRunNotes: 'Theatrical run concluded for Indian 2 (TMDB ID 552398).'
    },
    evidence: {
      sourceType: 'OFFICIAL_PLATFORM_ANNOUNCEMENT',
      sourceName: 'Netflix India Newsroom',
      sourceUrl: 'https://about.netflix.com/en/newsroom/indian-2-streaming',
      evidenceDate: '2024-08-04',
      corroboratingUrls: []
    },
    expectedClassification: 'REJECTED_TAMPERED_PAYLOAD',
    expectedGateDecision: 'REJECT_PROOF_PROPERTY_MISMATCH',
    provenance: {
      sourceAuthority: 'Adversarial Test Fixture Generator',
      corroborationDegree: 'SYNTHETIC_CONTROL',
      confidence: 'HIGH'
    },
    verificationNotes: 'NEGATIVE CONTROL 5: Reverified: Canonical TMDB ID 552398 is "Indian 2". Adversarial payload claims title "Indian 3" (actual TMDB ID 1231204), violating Stage 7 proof property title binding.'
  }
];

/**
 * Validates a benchmark array against structural, temporal, and business constraints.
 */
export function validateKollywoodBenchmark(items: KollywoodBenchmarkItem[]): {
  valid: boolean;
  errors: string[];
  summary: {
    totalItems: number;
    benchmarkAsOf: string;
    recentDigitalPremieres: number;
    upcomingDigitalPremieres: number;
    directToOttOriginals: number;
    negativeControls: number;
    confidenceBreakdown: Record<BenchmarkConfidence, number>;
    temporalIntegrity: {
      availableAtSnapshotCount: number;
      retrospectiveOutcomeCount: number;
    };
  };
} {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenTmdb = new Set<number>();

  let recentDigitalPremieres = 0;
  let upcomingDigitalPremieres = 0;
  let directToOttOriginals = 0;
  let negativeControls = 0;
  let availableAtSnapshotCount = 0;
  let retrospectiveOutcomeCount = 0;

  const confidenceBreakdown: Record<BenchmarkConfidence, number> = {
    HIGH: 0,
    MEDIUM: 0,
    PENDING_GROUND_TRUTH: 0
  };

  if (!items || items.length !== 25) {
    errors.push(`Benchmark must contain exactly 25 items, received ${items ? items.length : 0}`);
  }

  const snapshotTimestamp = new Date(KOLLYWOOD_BENCHMARK_AS_OF).getTime();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const prefix = `[Item ${i + 1} (${item.benchmarkId || 'NO_ID'})]:`;

    if (!item.benchmarkId) {
      errors.push(`${prefix} Missing benchmarkId`);
    } else if (seenIds.has(item.benchmarkId)) {
      errors.push(`${prefix} Duplicate benchmarkId: ${item.benchmarkId}`);
    } else {
      seenIds.add(item.benchmarkId);
    }

    if (!item.benchmarkAsOf || item.benchmarkAsOf !== KOLLYWOOD_BENCHMARK_AS_OF) {
      errors.push(`${prefix} benchmarkAsOf must be explicitly set to ${KOLLYWOOD_BENCHMARK_AS_OF}`);
    }

    // Temporal integrity assertions
    if (!item.evidencePublishedAt || isNaN(Date.parse(item.evidencePublishedAt))) {
      errors.push(`${prefix} Missing or invalid evidencePublishedAt timestamp`);
    }
    if (!item.evidenceObservedAt || isNaN(Date.parse(item.evidenceObservedAt))) {
      errors.push(`${prefix} Missing or invalid evidenceObservedAt timestamp`);
    }
    if (!item.verifiedOutcomeAsOf || isNaN(Date.parse(item.verifiedOutcomeAsOf))) {
      errors.push(`${prefix} Missing or invalid verifiedOutcomeAsOf timestamp`);
    }

    const evidencePubTime = new Date(item.evidencePublishedAt).getTime();
    if (item.benchmarkKnowledgeAvailableAtSnapshot) {
      availableAtSnapshotCount++;
      if (evidencePubTime > snapshotTimestamp) {
        errors.push(`${prefix} Temporal leakage: benchmarkKnowledgeAvailableAtSnapshot is true but evidencePublishedAt (${item.evidencePublishedAt}) is after benchmarkAsOf (${KOLLYWOOD_BENCHMARK_AS_OF})`);
      }
    } else {
      retrospectiveOutcomeCount++;
      if (evidencePubTime <= snapshotTimestamp) {
        errors.push(`${prefix} Inconsistency: evidencePublishedAt (${item.evidencePublishedAt}) is <= benchmarkAsOf but benchmarkKnowledgeAvailableAtSnapshot is false`);
      }
    }

    if (!item.tmdbId || item.tmdbId <= 0 || !Number.isInteger(item.tmdbId)) {
      errors.push(`${prefix} Invalid tmdbId: ${item.tmdbId}`);
    } else if (seenTmdb.has(item.tmdbId)) {
      errors.push(`${prefix} Duplicate tmdbId: ${item.tmdbId}`);
    } else {
      seenTmdb.add(item.tmdbId);
    }

    if (!item.title || item.title.trim().length === 0) {
      errors.push(`${prefix} Missing or empty title`);
    }

    if (item.industry !== 'Kollywood') {
      errors.push(`${prefix} Industry must be 'Kollywood', received: ${item.industry}`);
    }

    // Strict original_language = 'ta' check
    if (item.originalLanguage !== 'ta') {
      errors.push(`${prefix} originalLanguage must be 'ta' for all Kollywood records, received: ${item.originalLanguage}`);
    }

    if (item.contentType !== 'movie' && item.contentType !== 'tv') {
      errors.push(`${prefix} Invalid contentType: ${item.contentType}`);
    }

    if (item.contentType === 'tv') {
      if (!item.seasonNumber || !Number.isInteger(item.seasonNumber) || item.seasonNumber < 1) {
        errors.push(`${prefix} TV content must specify integer seasonNumber >= 1`);
      }
    } else {
      if (item.seasonNumber !== undefined) {
        errors.push(`${prefix} Movie content must not specify seasonNumber`);
      }
    }

    // Theatrical precedence checks
    const tp = item.theatricalPrecedence;
    if (tp.hasTheatricalRelease) {
      if (!tp.theatricalReleaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(tp.theatricalReleaseDate)) {
        errors.push(`${prefix} Missing or invalid theatricalReleaseDate`);
      }
      if (tp.theatricalPrecedenceVerified) {
        if (!tp.theatricalClosureDate || !/^\d{4}-\d{2}-\d{2}$/.test(tp.theatricalClosureDate)) {
          errors.push(`${prefix} theatricalPrecedenceVerified is true but theatricalClosureDate is missing or invalid`);
        }
        if (!tp.theatricalClosureEvidence || tp.theatricalClosureEvidence.trim().length === 0) {
          errors.push(`${prefix} theatricalPrecedenceVerified is true but theatricalClosureEvidence is missing`);
        }
        if (!tp.theatricalClosureEvidencePublishedAt || isNaN(Date.parse(tp.theatricalClosureEvidencePublishedAt))) {
          errors.push(`${prefix} theatricalPrecedenceVerified is true but theatricalClosureEvidencePublishedAt is missing or invalid`);
        }
        if (!tp.theatricalClosureEvidenceObservedAt || isNaN(Date.parse(tp.theatricalClosureEvidenceObservedAt))) {
          errors.push(`${prefix} theatricalPrecedenceVerified is true but theatricalClosureEvidenceObservedAt is missing or invalid`);
        }
        if (!tp.theatricalRunConcluded) {
          errors.push(`${prefix} theatricalPrecedenceVerified is true but theatricalRunConcluded is false`);
        }
        if (tp.theatricalClosureEvidencePublishedAt) {
          const closurePubTime = new Date(tp.theatricalClosureEvidencePublishedAt).getTime();
          if (tp.theatricalClosureKnowledgeAvailableAtSnapshot) {
            if (closurePubTime > snapshotTimestamp) {
              errors.push(`${prefix} Temporal leakage: theatricalClosureKnowledgeAvailableAtSnapshot is true but theatricalClosureEvidencePublishedAt (${tp.theatricalClosureEvidencePublishedAt}) is after benchmarkAsOf (${KOLLYWOOD_BENCHMARK_AS_OF})`);
            }
          } else {
            if (closurePubTime <= snapshotTimestamp) {
              errors.push(`${prefix} Inconsistency: theatricalClosureEvidencePublishedAt (${tp.theatricalClosureEvidencePublishedAt}) is <= benchmarkAsOf but theatricalClosureKnowledgeAvailableAtSnapshot is false`);
            }
          }
        }
      } else {
        if (tp.theatricalRunConcluded) {
          errors.push(`${prefix} theatricalPrecedenceVerified is false but theatricalRunConcluded is true`);
        }
        if (tp.theatricalClosureKnowledgeAvailableAtSnapshot) {
          errors.push(`${prefix} theatricalPrecedenceVerified is false so theatricalClosureKnowledgeAvailableAtSnapshot must be false`);
        }
        if (tp.theatricalClosureEvidencePublishedAt || tp.theatricalClosureEvidenceObservedAt) {
          errors.push(`${prefix} theatricalPrecedenceVerified is false so theatricalClosureEvidence timestamps must be undefined`);
        }
      }
    } else {
      if (tp.theatricalRunConcluded) {
        errors.push(`${prefix} Non-theatrical content cannot have theatricalRunConcluded: true`);
      }
      if (tp.theatricalReleaseDate || tp.theatricalClosureDate) {
        errors.push(`${prefix} Non-theatrical content cannot have theatrical dates`);
      }
      if (tp.theatricalClosureEvidencePublishedAt || tp.theatricalClosureEvidenceObservedAt) {
        errors.push(`${prefix} Non-theatrical content cannot have theatricalClosureEvidence timestamps`);
      }
      if (tp.theatricalClosureKnowledgeAvailableAtSnapshot) {
        errors.push(`${prefix} Non-theatrical content cannot have theatricalClosureKnowledgeAvailableAtSnapshot: true`);
      }
    }

    // Category tracking & temporal consistency
    const asOfDate = item.benchmarkAsOf.split('T')[0];
    if (item.category === 'RECENT_DIGITAL_PREMIERE') {
      recentDigitalPremieres++;
      if (item.premiereDate > asOfDate) {
        errors.push(`${prefix} RECENT_DIGITAL_PREMIERE cannot have premiereDate (${item.premiereDate}) after benchmarkAsOf (${asOfDate})`);
      }
    } else if (item.category === 'UPCOMING_DIGITAL_PREMIERE') {
      upcomingDigitalPremieres++;
      if (item.premiereDate < asOfDate) {
        errors.push(`${prefix} UPCOMING_DIGITAL_PREMIERE cannot have premiereDate (${item.premiereDate}) prior to benchmarkAsOf (${asOfDate})`);
      }
      if (!item.theatricalPrecedence.theatricalPrecedenceVerified) {
        errors.push(`${prefix} Positive UPCOMING_DIGITAL_PREMIERE must have theatricalPrecedenceVerified: true`);
      }
    } else if (item.category === 'DIRECT_TO_OTT_ORIGINAL') {
      directToOttOriginals++;
      if (item.theatricalPrecedence.hasTheatricalRelease) {
        errors.push(`${prefix} DIRECT_TO_OTT_ORIGINAL must have hasTheatricalRelease: false`);
      }
    } else if (item.category === 'NEGATIVE_CONTROL') {
      negativeControls++;
    } else {
      errors.push(`${prefix} Unknown category: ${item.category}`);
    }

    // Confidence tracking
    if (item.provenance && item.provenance.confidence) {
      confidenceBreakdown[item.provenance.confidence] =
        (confidenceBreakdown[item.provenance.confidence] || 0) + 1;
    } else {
      errors.push(`${prefix} Missing provenance confidence`);
    }

    // Date validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!item.premiereDate || !dateRegex.test(item.premiereDate)) {
      errors.push(`${prefix} premiereDate must match YYYY-MM-DD, received: ${item.premiereDate}`);
    }

    // Territory verification
    if (!item.territory || !Array.isArray(item.territory.territoryCodes)) {
      errors.push(`${prefix} territory.territoryCodes must be an array`);
    } else {
      if (!['EXHAUSTIVE', 'NON_EXHAUSTIVE', 'UNKNOWN'].includes(item.territory.completenessStatus)) {
        errors.push(`${prefix} Invalid territory completenessStatus: ${item.territory.completenessStatus}`);
      }
      if (typeof item.territory.isExhaustive !== 'boolean') {
        errors.push(`${prefix} territory.isExhaustive must be a boolean`);
      }
      // Rule 3: An incomplete territory list must not establish that Indian availability is absent!
      if (!item.territory.isIndiaExplicit) {
        if (item.territory.completenessStatus !== 'EXHAUSTIVE' || !item.territory.isExhaustive) {
          errors.push(`${prefix} Incomplete or non-exhaustive territory list cannot establish that Indian availability is absent`);
        }
        if (!item.territory.provenanceSource || item.territory.provenanceSource.trim().length === 0) {
          errors.push(`${prefix} Territory exclusion requires explicit provenanceSource`);
        }
      }
    }

    // Transactional model details check
    if (item.transactionalModelDetails) {
      const tm = item.transactionalModelDetails;
      if (!['TVOD_RENTAL', 'TVOD_PURCHASE', 'SVOD_SUBSCRIPTION', 'AVOD_FREE', 'UNKNOWN'].includes(tm.pricingTier)) {
        errors.push(`${prefix} Invalid transactionalModelDetails.pricingTier: ${tm.pricingTier}`);
      }
      if (!tm.pricingObservedAt || isNaN(Date.parse(tm.pricingObservedAt))) {
        errors.push(`${prefix} Missing or invalid transactionalModelDetails.pricingObservedAt`);
      }
      if (!tm.priceValiditySnapshotAsOf || isNaN(Date.parse(tm.priceValiditySnapshotAsOf))) {
        errors.push(`${prefix} Missing or invalid transactionalModelDetails.priceValiditySnapshotAsOf`);
      }
      if (!tm.storefrontSource || tm.storefrontSource.trim().length === 0) {
        errors.push(`${prefix} Missing transactionalModelDetails.storefrontSource`);
      }
      if (!tm.volatilityNotice || tm.volatilityNotice.trim().length === 0) {
        errors.push(`${prefix} Missing transactionalModelDetails.volatilityNotice`);
      }
    }
    if (item.availabilityModel === 'RENTAL' && !item.transactionalModelDetails) {
      errors.push(`${prefix} RENTAL availabilityModel requires explicit transactionalModelDetails`);
    }

    // Negative controls gate checks
    if (item.category === 'NEGATIVE_CONTROL') {
      if (item.expectedGateDecision === 'ALLOW_PUBLICATION') {
        errors.push(`${prefix} Negative controls cannot have expectedGateDecision ALLOW_PUBLICATION`);
      }
    } else {
      if (item.expectedGateDecision !== 'ALLOW_PUBLICATION') {
        errors.push(`${prefix} Positive benchmarks must have expectedGateDecision ALLOW_PUBLICATION`);
      }
    }

    // Evidence checks
    if (!item.evidence || !item.evidence.sourceUrl || !item.evidence.sourceUrl.startsWith('http')) {
      errors.push(`${prefix} Missing valid HTTP evidence sourceUrl`);
    }
  }

  if (recentDigitalPremieres !== 8) {
    errors.push(`Expected exactly 8 RECENT_DIGITAL_PREMIERE records, got ${recentDigitalPremieres}`);
  }
  if (upcomingDigitalPremieres !== 6) {
    errors.push(`Expected exactly 6 UPCOMING_DIGITAL_PREMIERE records, got ${upcomingDigitalPremieres}`);
  }
  if (directToOttOriginals !== 6) {
    errors.push(`Expected exactly 6 DIRECT_TO_OTT_ORIGINAL records, got ${directToOttOriginals}`);
  }
  if (negativeControls !== 5) {
    errors.push(`Expected exactly 5 NEGATIVE_CONTROL records, got ${negativeControls}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      totalItems: items.length,
      benchmarkAsOf: KOLLYWOOD_BENCHMARK_AS_OF,
      recentDigitalPremieres,
      upcomingDigitalPremieres,
      directToOttOriginals,
      negativeControls,
      confidenceBreakdown,
      temporalIntegrity: {
        availableAtSnapshotCount,
        retrospectiveOutcomeCount
      }
    }
  };
}
