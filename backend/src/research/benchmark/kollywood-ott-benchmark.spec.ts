import {
  KOLLYWOOD_OTT_BENCHMARK_25,
  KOLLYWOOD_BENCHMARK_AS_OF,
  KOLLYWOOD_BENCHMARK_SNAPSHOT_SEMANTICS,
  CONTROLLED_TMDB_FIXTURES,
  validateKollywoodBenchmark,
  KollywoodBenchmarkItem
} from './kollywood-ott-benchmark.fixture';

describe('Kollywood Ground-Truth Benchmark Remediation (Phase 3.0 — Step 1.2: Temporal Integrity & Evidence Closure)', () => {
  it('should contain exactly 25 independently verified Tamil benchmark records', () => {
    expect(KOLLYWOOD_OTT_BENCHMARK_25).toBeDefined();
    expect(KOLLYWOOD_OTT_BENCHMARK_25.length).toBe(25);
  });

  it('should strictly pass benchmark schema validation with zero errors', () => {
    const result = validateKollywoodBenchmark(KOLLYWOOD_OTT_BENCHMARK_25);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.summary.totalItems).toBe(25);
  });

  it('should establish an explicit benchmarkAsOf timestamp across all records', () => {
    expect(KOLLYWOOD_BENCHMARK_AS_OF).toBe('2024-10-31T00:00:00.000Z');
    for (const item of KOLLYWOOD_OTT_BENCHMARK_25) {
      expect(item.benchmarkAsOf).toBe(KOLLYWOOD_BENCHMARK_AS_OF);
    }
  });

  it('should enforce original_language = "ta" for all 25 benchmark records without exception', () => {
    for (const item of KOLLYWOOD_OTT_BENCHMARK_25) {
      expect(item.originalLanguage).toBe('ta');
      expect(item.industry).toBe('Kollywood');
    }
  });

  it('should verify all 25 records against controlled TMDB response fixtures', () => {
    for (const item of KOLLYWOOD_OTT_BENCHMARK_25) {
      const fixture = CONTROLLED_TMDB_FIXTURES[item.tmdbId];
      expect(fixture).toBeDefined();
      expect(fixture.tmdbId).toBe(item.tmdbId);
      expect(fixture.originalLanguage).toBe('ta');
      expect(fixture.mediaType).toBe(item.contentType);
      expect(fixture.canonicalTitle).toBeDefined();
      expect(fixture.releaseDate).toBeDefined();
      expect(fixture.releaseYear).toBeGreaterThanOrEqual(2023);
      if (item.category !== 'NEGATIVE_CONTROL') {
        expect(fixture.canonicalTitle).toBe(item.title);
      }
    }
  });

  it('should have exact category distribution (8 Recent, 6 Upcoming, 6 Direct-to-OTT, 5 Negative Controls)', () => {
    const result = validateKollywoodBenchmark(KOLLYWOOD_OTT_BENCHMARK_25);
    expect(result.summary.recentDigitalPremieres).toBe(8);
    expect(result.summary.upcomingDigitalPremieres).toBe(6);
    expect(result.summary.directToOttOriginals).toBe(6);
    expect(result.summary.negativeControls).toBe(5);
  });

  it('should have 100% HIGH confidence ground-truth verification and zero unverified items', () => {
    const result = validateKollywoodBenchmark(KOLLYWOOD_OTT_BENCHMARK_25);
    expect(result.summary.confidenceBreakdown.HIGH).toBe(25);
    expect(result.summary.confidenceBreakdown.MEDIUM).toBe(0);
    expect(result.summary.confidenceBreakdown.PENDING_GROUND_TRUTH).toBe(0);
  });

  describe('Historical Snapshot Integrity & Temporal Non-Leakage (Phase 3.0 — Step 1.2)', () => {
    it('should enforce valid ISO timestamps and fields across all 25 records', () => {
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      for (const item of KOLLYWOOD_OTT_BENCHMARK_25) {
        expect(item.benchmarkAsOf).toBe(KOLLYWOOD_BENCHMARK_AS_OF);
        expect(item.evidencePublishedAt).toMatch(isoRegex);
        expect(item.evidenceObservedAt).toMatch(isoRegex);
        expect(item.verifiedOutcomeAsOf).toBeDefined();
        expect(typeof item.benchmarkKnowledgeAvailableAtSnapshot).toBe('boolean');
      }
    });

    it('should strictly prohibit temporal leakage: no post-snapshot evidence marked available at snapshot', () => {
      const snapshotTimestamp = new Date(KOLLYWOOD_BENCHMARK_AS_OF).getTime();
      for (const item of KOLLYWOOD_OTT_BENCHMARK_25) {
        const evidenceTime = new Date(item.evidencePublishedAt).getTime();
        if (evidenceTime > snapshotTimestamp) {
          expect(item.benchmarkKnowledgeAvailableAtSnapshot).toBe(false);
        } else {
          expect(item.benchmarkKnowledgeAvailableAtSnapshot).toBe(true);
        }
      }
    });

    it('should pass explicit temporal audit for the 7 critical titles', () => {
      // 1. Vettaiyan: Announced 2024-11-01 -> post-snapshot, false
      const vettaiyan = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-01')!;
      expect(vettaiyan.benchmarkKnowledgeAvailableAtSnapshot).toBe(false);
      expect(vettaiyan.evidencePublishedAt).toBe('2024-11-01T06:00:00.000Z');
      expect(vettaiyan.verifiedOutcomeAsOf).toBe('2024-11-08T00:00:00.000Z');

      // 2. Black: Announced 2024-10-30 -> pre-snapshot, true
      const black = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-02')!;
      expect(black.benchmarkKnowledgeAvailableAtSnapshot).toBe(true);
      expect(black.evidencePublishedAt).toBe('2024-10-30T10:00:00.000Z');
      expect(black.verifiedOutcomeAsOf).toBe('2024-11-01T00:00:00.000Z');

      // 3. Brother: Announced 2024-11-24 -> post-snapshot, false
      const brother = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-03')!;
      expect(brother.benchmarkKnowledgeAvailableAtSnapshot).toBe(false);
      expect(brother.evidencePublishedAt).toBe('2024-11-24T05:00:00.000Z');
      expect(brother.verifiedOutcomeAsOf).toBe('2024-11-29T00:00:00.000Z');

      // 4. Bloody Beggar: Announced 2024-11-25 -> post-snapshot, false
      const bloodyBeggar = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-04')!;
      expect(bloodyBeggar.benchmarkKnowledgeAvailableAtSnapshot).toBe(false);
      expect(bloodyBeggar.evidencePublishedAt).toBe('2024-11-25T04:00:00.000Z');
      expect(bloodyBeggar.verifiedOutcomeAsOf).toBe('2024-11-29T00:00:00.000Z');

      // 5. Andhagan: Announced 2024-11-20 -> post-snapshot, false
      const andhagan = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-05')!;
      expect(andhagan.benchmarkKnowledgeAvailableAtSnapshot).toBe(false);
      expect(andhagan.evidencePublishedAt).toBe('2024-11-20T09:00:00.000Z');
      expect(andhagan.verifiedOutcomeAsOf).toBe('2024-11-26T00:00:00.000Z');

      // 6. Thangalaan: Announced 2024-11-28 -> post-snapshot, false
      const thangalaan = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-06')!;
      expect(thangalaan.benchmarkKnowledgeAvailableAtSnapshot).toBe(false);
      expect(thangalaan.evidencePublishedAt).toBe('2024-11-28T10:00:00.000Z');
      expect(thangalaan.verifiedOutcomeAsOf).toBe('2024-12-10T00:00:00.000Z');

      // 7. Coolie: Production report 2024-07-20 -> pre-snapshot, true (quarantined rumor)
      const coolie = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-NEG-03')!;
      expect(coolie.benchmarkKnowledgeAvailableAtSnapshot).toBe(true);
      expect(coolie.evidencePublishedAt).toBe('2024-07-20T10:00:00.000Z');
      expect(coolie.verifiedOutcomeAsOf).toBe('2025-09-11T00:00:00.000Z');
      expect(coolie.expectedClassification).toBe('QUARANTINED_UNCORROBORATED');
    });
  });

  describe('Theatrical Precedence Verification & Active Screening Protection (Phase 3.0 — Step 1.2)', () => {
    it('should distinguish theatricalReleaseDate, theatricalClosureDate, and closure evidence for all theatrical films', () => {
      const theatricalItems = KOLLYWOOD_OTT_BENCHMARK_25.filter(
        (i) => i.theatricalPrecedence.hasTheatricalRelease
      );
      expect(theatricalItems.length).toBe(19);

      for (const item of theatricalItems) {
        const tp = item.theatricalPrecedence;
        expect(tp.theatricalReleaseDate).toBeDefined();
        expect(tp.theatricalReleaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        if (tp.theatricalPrecedenceVerified) {
          expect(tp.theatricalRunConcluded).toBe(true);
          expect(tp.theatricalClosureDate).toBeDefined();
          expect(tp.theatricalClosureDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(tp.theatricalClosureEvidence).toBeDefined();
          expect(tp.theatricalClosureEvidence!.length).toBeGreaterThan(10);
          expect(tp.theatricalClosureDate! >= tp.theatricalReleaseDate!).toBe(true);
        } else {
          expect(tp.theatricalRunConcluded).toBe(false);
          expect(tp.theatricalClosureDate).toBeUndefined();
          expect(tp.theatricalClosureEvidence).toBeUndefined();
        }
      }
    });

    it('should strictly never infer theatrical closure for active theatrical releases (Amaran)', () => {
      const amaran = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-NEG-01')!;
      expect(amaran.theatricalPrecedence.hasTheatricalRelease).toBe(true);
      expect(amaran.theatricalPrecedence.theatricalReleaseDate).toBe('2024-10-31');
      expect(amaran.theatricalPrecedence.theatricalRunConcluded).toBe(false);
      expect(amaran.theatricalPrecedence.theatricalPrecedenceVerified).toBe(false);
      expect(amaran.theatricalPrecedence.theatricalClosureDate).toBeUndefined();
      expect(amaran.theatricalPrecedence.theatricalClosureEvidence).toBeUndefined();
      expect(amaran.expectedGateDecision).toBe('REJECT_THEATRICAL_PRECEDENCE');
    });

    it('should strictly forbid theatrical attributes on direct-to-OTT originals', () => {
      const dttItems = KOLLYWOOD_OTT_BENCHMARK_25.filter(
        (i) => i.category === 'DIRECT_TO_OTT_ORIGINAL'
      );
      expect(dttItems.length).toBe(6);
      for (const item of dttItems) {
        expect(item.theatricalPrecedence.hasTheatricalRelease).toBe(false);
        expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(false);
        expect(item.theatricalPrecedence.theatricalPrecedenceVerified).toBe(true); // Precedence verified as non-theatrical
        expect(item.theatricalPrecedence.theatricalReleaseDate).toBeUndefined();
        expect(item.theatricalPrecedence.theatricalClosureDate).toBeUndefined();
        expect(item.theatricalPrecedence.theatricalClosureEvidence).toBeUndefined();
      }
    });
  });

  describe('Category 1: Individual Record Assertions — Recent Digital Premieres (8 items)', () => {
    const asOfDate = KOLLYWOOD_BENCHMARK_AS_OF.split('T')[0];

    it('KB-RDP-01: Lubber Pandhu (TMDB: 1097000)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-RDP-01')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Lubber Pandhu');
      expect(item.tmdbId).toBe(1097000);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Disney+ Hotstar');
      expect(item.availabilityModel).toBe('SUBSCRIPTION');
      expect(item.theatricalPrecedence.hasTheatricalRelease).toBe(true);
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(true);
      expect(item.theatricalPrecedence.theatricalReleaseDate).toBe('2024-09-20');
      expect(item.premiereDate).toBe('2024-10-31');
      expect(item.premiereDate <= asOfDate).toBe(true);
      expect(item.territory.isIndiaExplicit).toBe(true);
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-RDP-02: Meiyazhagan (TMDB: 1136423)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-RDP-02')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Meiyazhagan');
      expect(item.tmdbId).toBe(1136423);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Netflix');
      expect(item.availabilityModel).toBe('SUBSCRIPTION');
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(true);
      expect(item.premiereDate).toBe('2024-10-25');
      expect(item.premiereDate <= asOfDate).toBe(true);
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-RDP-03: Maharaja (TMDB: 1118224)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-RDP-03')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Maharaja');
      expect(item.tmdbId).toBe(1118224);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Netflix');
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(true);
      expect(item.premiereDate).toBe('2024-07-12');
      expect(item.premiereDate <= asOfDate).toBe(true);
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-RDP-04: Raayan (TMDB: 1136418)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-RDP-04')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Raayan');
      expect(item.tmdbId).toBe(1136418);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Amazon Prime Video');
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(true);
      expect(item.premiereDate).toBe('2024-08-23');
      expect(item.premiereDate <= asOfDate).toBe(true);
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-RDP-05: Vaazhai (TMDB: 1051426)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-RDP-05')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Vaazhai');
      expect(item.tmdbId).toBe(1051426);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Disney+ Hotstar');
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(true);
      expect(item.premiereDate).toBe('2024-10-11');
      expect(item.premiereDate <= asOfDate).toBe(true);
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-RDP-06: Garudan (TMDB: 1238692)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-RDP-06')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Garudan');
      expect(item.tmdbId).toBe(1238692);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Amazon Prime Video');
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(true);
      expect(item.premiereDate).toBe('2024-07-03');
      expect(item.premiereDate <= asOfDate).toBe(true);
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-RDP-07: Kottukkaali (TMDB: 1242372)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-RDP-07')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Kottukkaali');
      expect(item.tmdbId).toBe(1242372);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Amazon Prime Video');
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(true);
      expect(item.premiereDate).toBe('2024-09-27');
      expect(item.premiereDate <= asOfDate).toBe(true);
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-RDP-08: Demonte Colony 2 (TMDB: 1059064)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-RDP-08')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Demonte Colony 2');
      expect(item.tmdbId).toBe(1059064);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('ZEE5');
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(true);
      expect(item.premiereDate).toBe('2024-09-27');
      expect(item.premiereDate <= asOfDate).toBe(true);
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });
  });

  describe('Category 2: Individual Record Assertions — Upcoming Digital Premieres (6 items)', () => {
    const asOfDate = KOLLYWOOD_BENCHMARK_AS_OF.split('T')[0];

    it('KB-UDP-01: Vettaiyan (TMDB: 1144944)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-01')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Vettaiyan');
      expect(item.tmdbId).toBe(1144944);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Amazon Prime Video');
      expect(item.availabilityModel).toBe('SUBSCRIPTION');
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(true);
      expect(item.premiereDate).toBe('2024-11-08');
      expect(item.premiereDate >= asOfDate).toBe(true);
      expect(item.expectedClassification).toBe('UPCOMING_DIGITAL_PREMIERE');
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-UDP-02: Black (TMDB: 1339396)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-02')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Black');
      expect(item.tmdbId).toBe(1339396);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Amazon Prime Video');
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(true);
      expect(item.premiereDate).toBe('2024-11-01');
      expect(item.premiereDate >= asOfDate).toBe(true);
      expect(item.expectedClassification).toBe('UPCOMING_DIGITAL_PREMIERE');
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-UDP-03: Brother (TMDB: 1181822)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-03')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Brother');
      expect(item.tmdbId).toBe(1181822);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('ZEE5');
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(true);
      expect(item.premiereDate).toBe('2024-11-29');
      expect(item.premiereDate >= asOfDate).toBe(true);
      expect(item.expectedClassification).toBe('UPCOMING_DIGITAL_PREMIERE');
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-UDP-04: Bloody Beggar (TMDB: 1284004)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-04')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Bloody Beggar');
      expect(item.tmdbId).toBe(1284004);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Amazon Prime Video');
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(true);
      expect(item.premiereDate).toBe('2024-11-29');
      expect(item.premiereDate >= asOfDate).toBe(true);
      expect(item.expectedClassification).toBe('UPCOMING_DIGITAL_PREMIERE');
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-UDP-05: Andhagan (TMDB: 979929)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-05')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Andhagan');
      expect(item.tmdbId).toBe(979929);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Amazon Prime Video');
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(true);
      expect(item.theatricalPrecedence.theatricalReleaseDate).toBe('2024-08-09');
      expect(item.premiereDate).toBe('2024-11-26');
      expect(item.premiereDate >= asOfDate).toBe(true);
      expect(item.expectedClassification).toBe('UPCOMING_DIGITAL_PREMIERE');
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-UDP-06: Thangalaan (TMDB: 1010818) - Reverified Subscription Classification', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-06')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Thangalaan');
      expect(item.tmdbId).toBe(1010818);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Netflix');
      expect(item.availabilityModel).toBe('SUBSCRIPTION'); // Explicitly verified SVOD
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(true);
      expect(item.premiereDate).toBe('2024-12-10');
      expect(item.premiereDate >= asOfDate).toBe(true);
      expect(item.expectedClassification).toBe('UPCOMING_DIGITAL_PREMIERE');
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });
  });

  describe('Category 3: Individual Record Assertions — Direct-to-OTT Originals (6 items)', () => {
    it('KB-DTO-01: Inspector Rishi (TMDB: 247120, S1, 2024-03-29)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-DTO-01')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Inspector Rishi');
      expect(item.tmdbId).toBe(247120);
      expect(item.contentType).toBe('tv');
      expect(item.seasonNumber).toBe(1);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Amazon Prime Video');
      expect(item.availabilityModel).toBe('SUBSCRIPTION');
      expect(item.theatricalPrecedence.hasTheatricalRelease).toBe(false);
      expect(item.premiereDate).toBe('2024-03-29');
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-DTO-02: Chutney Sambar (TMDB: 259685, S1, 2024-07-26)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-DTO-02')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Chutney Sambar');
      expect(item.tmdbId).toBe(259685);
      expect(item.contentType).toBe('tv');
      expect(item.seasonNumber).toBe(1);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Disney+ Hotstar');
      expect(item.theatricalPrecedence.hasTheatricalRelease).toBe(false);
      expect(item.premiereDate).toBe('2024-07-26');
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-DTO-03: Thalaimai Seyalagam (TMDB: 254880, S1, 2024-05-17)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-DTO-03')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Thalaimai Seyalagam');
      expect(item.tmdbId).toBe(254880);
      expect(item.contentType).toBe('tv');
      expect(item.seasonNumber).toBe(1);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('ZEE5');
      expect(item.theatricalPrecedence.hasTheatricalRelease).toBe(false);
      expect(item.premiereDate).toBe('2024-05-17');
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-DTO-04: Vera Maari Office (TMDB: 231502, S2, 2024-08-15)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-DTO-04')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Vera Maari Office');
      expect(item.tmdbId).toBe(231502);
      expect(item.contentType).toBe('tv');
      expect(item.seasonNumber).toBe(2);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Aha Tamil');
      expect(item.theatricalPrecedence.hasTheatricalRelease).toBe(false);
      expect(item.premiereDate).toBe('2024-08-15');
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-DTO-05: Goli Soda Rising (TMDB: 268600, S1, 2024-09-13)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-DTO-05')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Goli Soda Rising');
      expect(item.tmdbId).toBe(268600);
      expect(item.contentType).toBe('tv');
      expect(item.seasonNumber).toBe(1);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Disney+ Hotstar');
      expect(item.theatricalPrecedence.hasTheatricalRelease).toBe(false);
      expect(item.premiereDate).toBe('2024-09-13');
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });

    it('KB-DTO-06: Snakes and Ladders (TMDB: 271500, S1, 2024-10-18)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-DTO-06')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Snakes and Ladders');
      expect(item.tmdbId).toBe(271500);
      expect(item.contentType).toBe('tv');
      expect(item.seasonNumber).toBe(1);
      expect(item.originalLanguage).toBe('ta');
      expect(item.platform).toBe('Amazon Prime Video');
      expect(item.theatricalPrecedence.hasTheatricalRelease).toBe(false);
      expect(item.premiereDate).toBe('2024-10-18');
      expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
    });
  });

  describe('Category 4: Individual Record Assertions — Negative Controls (5 items)', () => {
    it('KB-NEG-01: Amaran (TMDB: 969602) - Active Theatrical Run Rejection Gate', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-NEG-01')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Amaran');
      expect(item.tmdbId).toBe(969602);
      expect(item.originalLanguage).toBe('ta');
      expect(item.theatricalPrecedence.theatricalReleaseDate).toBe('2024-10-31');
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(false);
      expect(item.premiereDate).toBe('2024-12-11');
      expect(item.expectedClassification).toBe('EXCLUDED_THEATRICALLY_ACTIVE');
      expect(item.expectedGateDecision).toBe('REJECT_THEATRICAL_PRECEDENCE');
    });

    it('KB-NEG-02: Star (TMDB: 1276338) - Non-Indian Territory Exclusion Gate (Simply South Overseas)', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-NEG-02')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Star');
      expect(item.tmdbId).toBe(1276338);
      expect(item.originalLanguage).toBe('ta'); // Strictly Tamil
      expect(item.platform).toBe('Simply South');
      expect(item.territory.isIndiaExplicit).toBe(false);
      expect(item.territory.territoryCodes).not.toContain('IN');
      expect(item.territory.territoryCodes).toEqual(['US', 'GB', 'SG', 'MY', 'AE', 'CA', 'AU']);
      expect(item.expectedClassification).toBe('REJECTED_NON_INDIAN_TERRITORY');
      expect(item.expectedGateDecision).toBe('REJECT_TERRITORY_NOT_EXPLICIT_INDIA');
    });

    it('KB-NEG-03: Coolie (TMDB: 1177098) - Uncorroborated Production Rumor Quarantine Gate', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-NEG-03')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Coolie');
      expect(item.tmdbId).toBe(1177098);
      expect(item.originalLanguage).toBe('ta');
      expect(item.theatricalPrecedence.theatricalRunConcluded).toBe(false);
      expect(item.theatricalPrecedence.theatricalPrecedenceVerified).toBe(false);
      expect(item.evidence.sourceType).toBe('COMMUNITY_SUBMISSION');
      expect(item.benchmarkKnowledgeAvailableAtSnapshot).toBe(true);
      expect(item.expectedClassification).toBe('QUARANTINED_UNCORROBORATED');
      expect(item.expectedGateDecision).toBe('QUARANTINE_UNVERIFIED_EVIDENCE');
    });

    it('KB-NEG-04: Aranmanai 4 (TMDB: 1140905) - Non-Subscription TVOD Rejection Gate', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-NEG-04')!;
      expect(item).toBeDefined();
      expect(item.title).toBe('Aranmanai 4');
      expect(item.tmdbId).toBe(1140905);
      expect(item.originalLanguage).toBe('ta');
      expect(item.availabilityModel).toBe('RENTAL');
      expect(item.verificationNotes).toContain('₹99');
      expect(item.expectedClassification).toBe('REJECTED_NON_SUBSCRIPTION');
      expect(item.expectedGateDecision).toBe('REJECT_NON_SUBSCRIPTION');
    });

    it('KB-NEG-05: Indian 2 / Indian 3 (TMDB: 552398) - Proof Property Title Mismatch Gate', () => {
      const item = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-NEG-05')!;
      expect(item).toBeDefined();
      expect(item.tmdbId).toBe(552398); // Authoritative Indian 2
      expect(item.title).toBe('Indian 3'); // Tampered payload title
      expect(item.originalTitle).toBe('இந்தியன் 2');
      expect(item.originalLanguage).toBe('ta');
      expect(item.expectedClassification).toBe('REJECTED_TAMPERED_PAYLOAD');
      expect(item.expectedGateDecision).toBe('REJECT_PROOF_PROPERTY_MISMATCH');

      // Verify that Indian 3 has distinct TMDB ID 1231204
      expect(CONTROLLED_TMDB_FIXTURES[1231204].canonicalTitle).toBe('Indian 3');
      expect(CONTROLLED_TMDB_FIXTURES[1231204].tmdbId).not.toBe(552398);
      // Verify that Indian 2 has canonicalTitle 'Indian 2'
      expect(CONTROLLED_TMDB_FIXTURES[552398].canonicalTitle).toBe('Indian 2');
    });
  });

  describe('Data Integrity & Uniqueness', () => {
    it('should have strictly unique benchmark IDs across all 25 items', () => {
      const ids = KOLLYWOOD_OTT_BENCHMARK_25.map((i) => i.benchmarkId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(25);
    });

    it('should have strictly unique TMDB IDs across all 25 items', () => {
      const tmdbIds = KOLLYWOOD_OTT_BENCHMARK_25.map((i) => i.tmdbId);
      const uniqueTmdbIds = new Set(tmdbIds);
      expect(uniqueTmdbIds.size).toBe(25);
    });

    it('should have valid HTTP(S) source URLs for all 25 evidence records', () => {
      for (const item of KOLLYWOOD_OTT_BENCHMARK_25) {
        expect(item.evidence.sourceUrl).toMatch(/^https?:\/\//);
      }
    });

    it('should ensure positive gate decisions are strictly isolated to positive categories', () => {
      for (const item of KOLLYWOOD_OTT_BENCHMARK_25) {
        if (item.category === 'NEGATIVE_CONTROL') {
          expect(item.expectedGateDecision).not.toBe('ALLOW_PUBLICATION');
        } else {
          expect(item.expectedGateDecision).toBe('ALLOW_PUBLICATION');
        }
      }
    });
  });

  describe('Step 1.2 Review Amendment 1: Benchmark Snapshot Boundary Semantics & Amaran Day-1 Protection', () => {
    it('should establish explicit START_OF_DAY_MORNING_SNAPSHOT semantics at 05:30 IST', () => {
      expect(KOLLYWOOD_BENCHMARK_SNAPSHOT_SEMANTICS).toBeDefined();
      expect(KOLLYWOOD_BENCHMARK_SNAPSHOT_SEMANTICS.timestamp).toBe('2024-10-31T00:00:00.000Z');
      expect(KOLLYWOOD_BENCHMARK_SNAPSHOT_SEMANTICS.istEquivalent).toBe('2024-10-31T05:30:00.000+05:30');
      expect(KOLLYWOOD_BENCHMARK_SNAPSHOT_SEMANTICS.snapshotBoundaryType).toBe('START_OF_DAY_MORNING_SNAPSHOT');
      expect(KOLLYWOOD_BENCHMARK_SNAPSHOT_SEMANTICS.description).toContain('start-of-day morning snapshot at 05:30 IST');
    });

    it('should verify Amaran (KB-NEG-01) at morning boundary: theatrical run commencing, closure unverified', () => {
      const amaran = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-NEG-01')!;
      expect(amaran.theatricalPrecedence.hasTheatricalRelease).toBe(true);
      expect(amaran.theatricalPrecedence.theatricalReleaseDate).toBe('2024-10-31');
      expect(amaran.theatricalPrecedence.theatricalRunConcluded).toBe(false);
      expect(amaran.theatricalPrecedence.theatricalPrecedenceVerified).toBe(false);
      expect(amaran.theatricalPrecedence.theatricalClosureDate).toBeUndefined();
      expect(amaran.theatricalPrecedence.theatricalClosureEvidence).toBeUndefined();
      expect(amaran.theatricalPrecedence.theatricalClosureKnowledgeAvailableAtSnapshot).toBe(false);
      expect(amaran.theatricalPrecedence.theatricalClosureEvidencePublishedAt).toBeUndefined();
      expect(amaran.theatricalPrecedence.theatricalClosureEvidenceObservedAt).toBeUndefined();
      expect(amaran.expectedGateDecision).toBe('REJECT_THEATRICAL_PRECEDENCE');
      expect(amaran.theatricalPrecedence.theatricalRunNotes).toContain('morning snapshot boundary 05:30 IST');
    });
  });

  describe('Step 1.2 Review Amendment 2: Theatrical Closure Evidence Temporal Integrity', () => {
    it('should provide full closure evidence timestamps for all verified concluded theatrical runs', () => {
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      const verifiedTheatrical = KOLLYWOOD_OTT_BENCHMARK_25.filter(
        (i) => i.theatricalPrecedence.hasTheatricalRelease && i.theatricalPrecedence.theatricalPrecedenceVerified
      );
      // 17 titles: 8 RDP + 6 UDP + 3 Negative Controls (Star, Aranmanai 4, Indian 2)
      expect(verifiedTheatrical.length).toBe(17);

      for (const item of verifiedTheatrical) {
        const tp = item.theatricalPrecedence;
        expect(tp.theatricalClosureEvidencePublishedAt).toBeDefined();
        expect(tp.theatricalClosureEvidencePublishedAt).toMatch(isoRegex);
        expect(tp.theatricalClosureEvidenceObservedAt).toBeDefined();
        expect(tp.theatricalClosureEvidenceObservedAt).toMatch(isoRegex);
        expect(typeof tp.theatricalClosureKnowledgeAvailableAtSnapshot).toBe('boolean');
      }
    });

    it('should enforce Case A (closure date after snapshot): Brother, Bloody Beggar', () => {
      const snapshotTime = new Date(KOLLYWOOD_BENCHMARK_AS_OF).getTime();

      // Brother (released theatrically 2024-10-31, closed 2024-11-28)
      const brother = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-03')!;
      expect(brother.theatricalPrecedence.theatricalClosureDate).toBe('2024-11-28');
      expect(new Date(brother.theatricalPrecedence.theatricalClosureDate!).getTime()).toBeGreaterThan(snapshotTime);
      expect(new Date(brother.theatricalPrecedence.theatricalClosureEvidencePublishedAt!).getTime()).toBeGreaterThan(snapshotTime);
      expect(brother.theatricalPrecedence.theatricalClosureKnowledgeAvailableAtSnapshot).toBe(false);

      // Bloody Beggar (released theatrically 2024-10-31, closed 2024-11-28)
      const bloodyBeggar = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-04')!;
      expect(bloodyBeggar.theatricalPrecedence.theatricalClosureDate).toBe('2024-11-28');
      expect(new Date(bloodyBeggar.theatricalPrecedence.theatricalClosureDate!).getTime()).toBeGreaterThan(snapshotTime);
      expect(new Date(bloodyBeggar.theatricalPrecedence.theatricalClosureEvidencePublishedAt!).getTime()).toBeGreaterThan(snapshotTime);
      expect(bloodyBeggar.theatricalPrecedence.theatricalClosureKnowledgeAvailableAtSnapshot).toBe(false);
    });

    it('should enforce Case B (closure date before snapshot, but closure evidence published after snapshot): Thangalaan, Vettaiyan', () => {
      const snapshotDate = KOLLYWOOD_BENCHMARK_AS_OF.split('T')[0];
      const snapshotTime = new Date(KOLLYWOOD_BENCHMARK_AS_OF).getTime();

      // 1. Thangalaan: Theatrical run ended September 26, 2024 (before snapshot)
      const thangalaan = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-06')!;
      expect(thangalaan.theatricalPrecedence.theatricalClosureDate).toBe('2024-09-26');
      expect(thangalaan.theatricalPrecedence.theatricalClosureDate! < snapshotDate).toBe(true);
      expect(thangalaan.theatricalPrecedence.theatricalClosureEvidencePublishedAt).toBe('2024-11-28T10:00:00.000Z');
      expect(new Date(thangalaan.theatricalPrecedence.theatricalClosureEvidencePublishedAt!).getTime()).toBeGreaterThan(snapshotTime);
      expect(thangalaan.theatricalPrecedence.theatricalClosureKnowledgeAvailableAtSnapshot).toBe(false);

      // 2. Vettaiyan: Theatrical run ended October 30, 2024 (before snapshot)
      const vettaiyan = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-01')!;
      expect(vettaiyan.theatricalPrecedence.theatricalClosureDate).toBe('2024-10-30');
      expect(vettaiyan.theatricalPrecedence.theatricalClosureDate! <= snapshotDate).toBe(true);
      expect(vettaiyan.theatricalPrecedence.theatricalClosureEvidencePublishedAt).toBe('2024-11-01T06:00:00.000Z');
      expect(new Date(vettaiyan.theatricalPrecedence.theatricalClosureEvidencePublishedAt!).getTime()).toBeGreaterThan(snapshotTime);
      expect(vettaiyan.theatricalPrecedence.theatricalClosureKnowledgeAvailableAtSnapshot).toBe(false);
    });

    it('should reject benchmark items where post-snapshot closure evidence is falsely marked available at snapshot', () => {
      const invalidItem: KollywoodBenchmarkItem = JSON.parse(
        JSON.stringify(KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-UDP-06')!)
      );
      // Falsify: mark post-snapshot evidence as available at snapshot
      invalidItem.theatricalPrecedence.theatricalClosureKnowledgeAvailableAtSnapshot = true;

      const modifiedBenchmark = KOLLYWOOD_OTT_BENCHMARK_25.map((item) =>
        item.benchmarkId === 'KB-UDP-06' ? invalidItem : item
      );

      const result = validateKollywoodBenchmark(modifiedBenchmark);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Temporal leakage: theatricalClosureKnowledgeAvailableAtSnapshot is true but theatricalClosureEvidencePublishedAt'))).toBe(true);
    });

    it('should reject benchmark items where pre-snapshot closure evidence is falsely marked unavailable at snapshot', () => {
      const invalidItem: KollywoodBenchmarkItem = JSON.parse(
        JSON.stringify(KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-RDP-01')!)
      );
      // Falsify: mark pre-snapshot evidence as unavailable at snapshot
      invalidItem.theatricalPrecedence.theatricalClosureKnowledgeAvailableAtSnapshot = false;

      const modifiedBenchmark = KOLLYWOOD_OTT_BENCHMARK_25.map((item) =>
        item.benchmarkId === 'KB-RDP-01' ? invalidItem : item
      );

      const result = validateKollywoodBenchmark(modifiedBenchmark);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Inconsistency: theatricalClosureEvidencePublishedAt') && e.includes('is <= benchmarkAsOf but theatricalClosureKnowledgeAvailableAtSnapshot is false'))).toBe(true);
    });
  });

  describe('Step 1.2 Review Amendment 3: Strengthened Territory Evidence Invariants', () => {
    it('should require Star (KB-NEG-02) territory exclusion to be EXHAUSTIVE with explicit provenance', () => {
      const star = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-NEG-02')!;
      expect(star.territory.isIndiaExplicit).toBe(false);
      expect(star.territory.completenessStatus).toBe('EXHAUSTIVE');
      expect(star.territory.isExhaustive).toBe(true);
      expect(star.territory.provenanceSource).toContain('Simply South International Geo-Catalog & Distribution Charter');
      expect(star.territory.territoryCodes).toEqual(['US', 'GB', 'SG', 'MY', 'AE', 'CA', 'AU']);
      expect(star.territory.territoryCodes).not.toContain('IN');
      expect(star.territory.evidencePublishedAt).toBeDefined();
      expect(star.territory.evidenceObservedAt).toBeDefined();
    });

    it('should reject territory exclusion when completenessStatus is NON_EXHAUSTIVE or UNKNOWN', () => {
      const nonExhaustiveItem: KollywoodBenchmarkItem = JSON.parse(
        JSON.stringify(KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-NEG-02')!)
      );
      nonExhaustiveItem.territory.completenessStatus = 'NON_EXHAUSTIVE';
      nonExhaustiveItem.territory.isExhaustive = false;

      const modifiedBenchmark = KOLLYWOOD_OTT_BENCHMARK_25.map((item) =>
        item.benchmarkId === 'KB-NEG-02' ? nonExhaustiveItem : item
      );

      const result = validateKollywoodBenchmark(modifiedBenchmark);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Incomplete or non-exhaustive territory list cannot establish that Indian availability is absent'))).toBe(true);
    });

    it('should reject territory exclusion when provenanceSource is missing', () => {
      const missingProvenanceItem: KollywoodBenchmarkItem = JSON.parse(
        JSON.stringify(KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-NEG-02')!)
      );
      missingProvenanceItem.territory.provenanceSource = '';

      const modifiedBenchmark = KOLLYWOOD_OTT_BENCHMARK_25.map((item) =>
        item.benchmarkId === 'KB-NEG-02' ? missingProvenanceItem : item
      );

      const result = validateKollywoodBenchmark(modifiedBenchmark);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Territory exclusion requires explicit provenanceSource'))).toBe(true);
    });
  });

  describe('Step 1.2 Review Amendment 4: Strengthened Transactional TVOD Metadata & Volatility Invariants', () => {
    it('should verify Aranmanai 4 (KB-NEG-04) preserves exact transactional TVOD rental terms and volatility notice', () => {
      const aranmanai = KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-NEG-04')!;
      expect(aranmanai.availabilityModel).toBe('RENTAL');
      expect(aranmanai.transactionalModelDetails).toBeDefined();

      const tm = aranmanai.transactionalModelDetails!;
      expect(tm.pricingTier).toBe('TVOD_RENTAL');
      expect(tm.priceAmount).toBe(99);
      expect(tm.priceCurrency).toBe('INR');
      expect(tm.rentalWindowHours).toBe(48);
      expect(tm.territoryCode).toBe('IN');
      expect(tm.pricingObservedAt).toBe('2024-06-21T11:00:00.000Z');
      expect(tm.priceValiditySnapshotAsOf).toBe('2024-10-31T00:00:00.000Z');
      expect(tm.storefrontSource).toContain('Amazon Prime Video Store India TVOD storefront');
      expect(tm.volatilityNotice).toContain('Transactional pricing is observation-bound to the snapshot window');
    });

    it('should reject RENTAL records if transactionalModelDetails is absent', () => {
      const missingDetailsItem: KollywoodBenchmarkItem = JSON.parse(
        JSON.stringify(KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-NEG-04')!)
      );
      delete missingDetailsItem.transactionalModelDetails;

      const modifiedBenchmark = KOLLYWOOD_OTT_BENCHMARK_25.map((item) =>
        item.benchmarkId === 'KB-NEG-04' ? missingDetailsItem : item
      );

      const result = validateKollywoodBenchmark(modifiedBenchmark);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('RENTAL availabilityModel requires explicit transactionalModelDetails'))).toBe(true);
    });

    it('should reject transactionalModelDetails with invalid pricingTier or missing required fields', () => {
      const invalidTierItem: KollywoodBenchmarkItem = JSON.parse(
        JSON.stringify(KOLLYWOOD_OTT_BENCHMARK_25.find((i) => i.benchmarkId === 'KB-NEG-04')!)
      );
      (invalidTierItem.transactionalModelDetails as any).pricingTier = 'INVALID_TIER';

      const modifiedBenchmark = KOLLYWOOD_OTT_BENCHMARK_25.map((item) =>
        item.benchmarkId === 'KB-NEG-04' ? invalidTierItem : item
      );

      const result = validateKollywoodBenchmark(modifiedBenchmark);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid transactionalModelDetails.pricingTier'))).toBe(true);
    });
  });
});
