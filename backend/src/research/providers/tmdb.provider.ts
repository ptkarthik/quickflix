import { Injectable, Logger } from '@nestjs/common';
import { MovieResearchProvider, ResearchData } from './research-provider.interface';
import axios from 'axios';
import * as https from 'https';

export interface RecentPastTheatricalDiscoveryOptions {
  windowDays?: number; // default 45
  extendedWindowDays?: number; // default 90
  referenceDateStr?: string; // YYYY-MM-DD
  languages?: string[];
  maxPagesPerQuery?: number;
}

export interface CandidateDiscoveryTelemetry {
  targetRegion: 'IN';
  targetDateWindow: { gte: string; lte: string };
  languagesScanned: string[];
  pagesFetchedByLanguage: Record<string, number>;
  totalPagesByLanguage: Record<string, number>;
  totalRawCandidates: number;
  uniqueDeduplicatedCandidates: number;
  isScanTruncated: boolean;
  providerErrors: Array<{ language: string; page?: number; error: string }>;
  coverageCompletenessStatus: 'COMPLETE' | 'PARTIALLY_TRUNCATED' | 'PROVIDER_DEGRADED';
}

export interface DiscoveredTheatricalCandidate {
  id: number | string;
  tmdbId: number | string;
  title: string;
  originalTitle?: string;
  originalLanguage?: string;
  industries?: string[];
  overview?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  popularity?: number;
  originalReleaseDate?: string;
  originalReleaseYear?: number;
  theatricalReleaseDate?: string;
  hasExplicitIndianTheatricalEvent: boolean;
  indianReleaseEvents: Array<{ type: number; date: string; note?: string }>;
  foreignReleaseEvents: Array<{ country: string; type: number; date: string }>;
  reReleaseEvent?: {
    isReRelease: true;
    reReleaseDate: string;
    originalReleaseDate: string;
    originalReleaseYear: number;
    evidenceSource: 'TMDB_IN_RE_RELEASE_EVENT';
  };
  ottPlatforms?: any[];
  ottDateConfirmed?: boolean;
  isStreamingInIndia?: boolean;
  raw?: any;
}

export interface TvSeriesDiscoveryTelemetry {
  targetDateWindow: { gte: string; lte: string };
  languagesScanned: string[];
  totalRawDiscovered: number;
  uniqueCanonicalCount: number;
  duplicateCountRemoved: number;
  countsByRegion: {
    indian: number;
    international: number;
  };
  countsByLanguage: Record<string, number>;
  countsByType: {
    newSeries: number;
    upcomingSeasons: number;
  };
  dateEvidenceQuality: {
    confirmedFutureDate: number;
    unverifiedOrPastExcluded: number;
  };
  platformDistribution: Record<string, number>;
}

@Injectable()
export class TmdbProvider implements MovieResearchProvider {
  private readonly logger = new Logger(TmdbProvider.name);
  private readonly apiKey = process.env.TMDB_API_KEY;
  private readonly baseUrl = 'https://api.themoviedb.org/3';
  
  // Custom axios instance that ignores SSL errors caused by local Antivirus proxies (Kaspersky, etc.)
  private readonly http = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false, family: 4 })
  });

  // All Indian languages: hi=Hindi, te=Telugu, ta=Tamil, ml=Malayalam, kn=Kannada, bn=Bengali, mr=Marathi, pa=Punjabi
  private readonly indianLangs = 'hi|te|ta|ml|kn|bn|mr|pa';
  
  private cachedDiscoverData: any = null;
  private cacheTimestamp: number = 0;
  private lastTvSeriesTelemetry: TvSeriesDiscoveryTelemetry | null = null;

  public getLastTvSeriesTelemetry(): TvSeriesDiscoveryTelemetry | null {
    return this.lastTvSeriesTelemetry;
  }

  async searchMovie(title: string, year?: number): Promise<any[]> {
    if (!this.apiKey) {
      this.logger.warn('TMDB_API_KEY is not set. Returning mock search results.');
      return [
        { id: 'mock-1', title: `${title} (Mock Fallback)`, release_date: `${year || 2023}-01-01`, overview: `Mock synopsis (Network Error)` }
      ];
    }

    try {
      let url = `${this.baseUrl}/search/movie?api_key=${this.apiKey}&query=${encodeURIComponent(title)}`;
      if (year) {
        url += `&year=${year}`;
      }
      
      const response = await this.http.get(url);
      return response.data.results || [];
    } catch (err) {
      this.logger.error('Failed to search TMDB', err);
      return [
        { id: 'mock-1', title: `${title} (Mock Fallback)`, release_date: `${year || 2023}-01-01`, overview: `Mock synopsis (Network Error: ${err.message})` }
      ];
    }
  }

  async getMovieDetails(id: string | number): Promise<ResearchData> {
    if (!this.apiKey) {
       return {
         title: "Mock Title (Network Error)",
         synopsis: `This is a mock synopsis since TMDB API fetch failed.`,
         releaseDate: "2023-01-01",
         genres: ["Mock Genre"],
         director: "Mock Director",
         cast: ["Actor A", "Actor B"],
         runtime: 120,
         productionInfo: "Mock Studio"
       };
    }

    try {
      const url = `${this.baseUrl}/movie/${id}?api_key=${this.apiKey}&append_to_response=credits`;
      const response = await this.http.get(url);
      const data = response.data;

      const director = data.credits?.crew?.find((c: any) => c.job === 'Director')?.name || 'Unknown';
      const cast = data.credits?.cast?.slice(0, 5).map((c: any) => ({ name: c.name, profile_path: c.profile_path })) || [];
      const genres = data.genres?.map((g: any) => g.name) || [];
      const productionInfo = data.production_companies?.map((p: any) => p.name).join(', ') || 'Unknown';

      return {
        title: data.title,
        synopsis: data.overview,
        releaseDate: data.release_date,
        genres,
        director,
        cast,
        runtime: data.runtime || 0,
        productionInfo
      };
    } catch (err) {
      this.logger.error('Failed to get TMDB details', err);
      return {
         title: "Mock Title (Network Error)",
         synopsis: `This is a mock synopsis since TMDB API fetch failed. Error: ${err.message}`,
         releaseDate: "2023-01-01",
         genres: ["Mock Genre"],
         director: "Mock Director",
         cast: ["Actor A", "Actor B"],
         runtime: 120,
         productionInfo: "Mock Studio"
       };
    }
  }

  async getMovieImages(id: string | number): Promise<any> {
    if (!this.apiKey) return { posters: [], backdrops: [], logos: [] };
    try {
      const url = `${this.baseUrl}/movie/${id}/images?api_key=${this.apiKey}`;
      const response = await this.http.get(url);
      return response.data;
    } catch (err) {
      this.logger.error(`Failed to get TMDB images for ${id}`, err);
      return { posters: [], backdrops: [], logos: [] };
    }
  }

  /**
   * Movie + TV search for the OTT desk. Unlike searchMovie(), this never returns
   * mock data: on a missing key or network error it returns an empty list.
   */
  async searchTitles(query: string): Promise<Array<{
    tmdbId: number;
    contentType: 'movie' | 'tv';
    title: string;
    originalLanguage?: string;
    releaseDate?: string;
    posterPath?: string;
    overview?: string;
    popularity?: number;
  }>> {
    if (!this.apiKey || !query.trim()) return [];
    try {
      const url = `${this.baseUrl}/search/multi?api_key=${this.apiKey}&query=${encodeURIComponent(query.trim())}&region=IN&include_adult=false`;
      const res = await this.http.get(url, { timeout: 8000 });
      return (res.data?.results || [])
        .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
        .map((r: any) => ({
          tmdbId: r.id,
          contentType: r.media_type,
          title: r.media_type === 'tv' ? r.name : r.title,
          originalLanguage: r.original_language,
          releaseDate: (r.media_type === 'tv' ? r.first_air_date : r.release_date) || undefined,
          posterPath: r.poster_path || undefined,
          overview: r.overview || undefined,
          popularity: r.popularity,
        }));
    } catch (err: any) {
      this.logger.warn(`TMDB searchTitles failed for "${query}": ${err.message}`);
      return [];
    }
  }

  // =====================================================
  // COMPREHENSIVE DISCOVER ENGINE
  // 4 Categories: Upcoming Theater | Now In Theater | Upcoming OTT | Now Streaming
  // Industries: Bollywood, Tollywood, Kollywood, Mollywood, Sandalwood, Hollywood
  // =====================================================


  async discoverAllRaw(): Promise<{ results: any[], rawMap: Map<string, any> }> {
    if (!this.apiKey) return { results: [], rawMap: new Map() };

    const today = new Date();
    const fmt = (d: any) => d.toISOString().split('T')[0];
    const addDays = (d: any, days: number) => { const nd = new Date(d); nd.setDate(nd.getDate() + days); return nd; };

    const windows = [{ start: 0, end: 30 }, { start: 30, end: 60 }, { start: 60, end: 90 }, { start: 90, end: 180 }, { start: 180, end: 365 }];
    const langs = ['', 'hi', 'te', 'ta', 'ml', 'kn', 'en', 'bn', 'mr', 'pa', 'gu', 'or', 'ja', 'ko'];
    const discoverQueue = [];
    
    for (const win of windows) {
      const gte = fmt(addDays(today, win.start));
      const lte = fmt(addDays(today, win.end));
      for (const lang of langs) {
        discoverQueue.push(() => this.discoverExhaustive({ langFilter: lang, region: 'IN', releaseType: '2|3', dateGte: gte, dateLte: lte }));
        discoverQueue.push(() => this.discoverExhaustive({ langFilter: lang, region: 'IN', releaseType: '4|5|6', dateGte: gte, dateLte: lte }));
      }
    }

    const discoveredMovies = new Map<string, any>();
    const chunkSize = 20; 
    for (let i = 0; i < discoverQueue.length; i += chunkSize) {
      const chunk = discoverQueue.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map(fn => fn()));
      for (const res of chunkResults) {
        for (const m of res.results) {
          if (!discoveredMovies.has(String(m.id))) discoveredMovies.set(String(m.id), { ...m, releaseEvents: [] });
        }
      }
      if (i + chunkSize < discoverQueue.length) await new Promise(r => setTimeout(r, 100));
    }

    const verificationQueue = Array.from(discoveredMovies.values());
    const verificationChunkSize = 30; 
    for (let i = 0; i < verificationQueue.length; i += verificationChunkSize) {
      const chunk = verificationQueue.slice(i, i + verificationChunkSize);
      await Promise.all(chunk.map(async (m) => {
        try {
          const [relRes, watchRes] = await Promise.all([
            this.http.get(`${this.baseUrl}/movie/${m.id}/release_dates?api_key=${this.apiKey}`).catch(() => null),
            this.http.get(`${this.baseUrl}/movie/${m.id}/watch/providers?api_key=${this.apiKey}`).catch(() => null)
          ]);

          const results = relRes?.data?.results || [];
          const indiaReleases = results.find((r: any) => r.iso_3166_1 === 'IN');
          if (indiaReleases && indiaReleases.release_dates) {
             for (const event of indiaReleases.release_dates) {
                const date = event.release_date.split('T')[0];
                if (event.type === 2 || event.type === 3) m.releaseEvents.push({ type: 'THEATRICAL', date, source: 'TMDB', country: 'IN' });
                // Fix 2: Only Type 4 (Digital) is a potential OTT candidate; Type 5 (Physical) and Type 6 (Linear TV) are excluded
                if (event.type === 4) m.releaseEvents.push({ type: 'OTT', date, source: 'TMDB', country: 'IN' });
             }
          }

          const inProviders = watchRes?.data?.results?.IN;
          if (inProviders) {
             m.ottPlatforms = m.ottPlatforms || [];
             if (inProviders.flatrate && inProviders.flatrate.length > 0) {
                for (const p of inProviders.flatrate) {
                   m.ottPlatforms.push({
                      name: p.provider_name,
                      availableInIndia: true,
                      verified: true,
                      availabilityType: 'SUBSCRIPTION',
                      watchUrl: inProviders.link,
                      logoPath: p.logo_path
                   });
                }
                m.ottDateConfirmed = true;
                if (!m.primaryPlatform) m.primaryPlatform = inProviders.flatrate[0].provider_name;
                if (!m.watchUrl) m.watchUrl = inProviders.link;
             } else if (inProviders.rent && inProviders.rent.length > 0) {
                for (const p of inProviders.rent) {
                   m.ottPlatforms.push({
                      name: p.provider_name,
                      availableInIndia: true,
                      verified: true,
                      availabilityType: 'RENTAL',
                      watchUrl: inProviders.link,
                      logoPath: p.logo_path
                   });
                }
             }
          }
        } catch (e) {}
      }));
      if (i + verificationChunkSize < verificationQueue.length) await new Promise(r => setTimeout(r, 100));
    }

    const results = [];
    const todayStr = fmt(today);
    for (const m of discoveredMovies.values()) {
      const theatricalEvents = m.releaseEvents.filter((e: any) => e.type === 'THEATRICAL' && e.country === 'IN').map((e: any) => e.date).sort();
      const ottEvents = m.releaseEvents.filter((e: any) => e.type === 'OTT' && e.country === 'IN').map((e: any) => e.date).sort();
      
      const isIndianLang = ['hi', 'te', 'ta', 'ml', 'kn', 'bn', 'mr', 'pa', 'gu', 'or'].includes(m.original_language || m.originalLanguage || '');
      const rawReleaseDate = m.release_date ? String(m.release_date).split('T')[0] : null;

      const theatricalDate = theatricalEvents.length > 0 
        ? theatricalEvents[theatricalEvents.length - 1] 
        : (isIndianLang && rawReleaseDate ? rawReleaseDate : (m.theatricalDate || m.theatricalRelease || null));
      const ottDate = ottEvents.length > 0 ? ottEvents[ottEvents.length - 1] : (m.ottDate || m.ottRelease || null);
      
      const theatricalStatus = theatricalDate ? (theatricalDate > todayStr ? 'UPCOMING' : 'CURRENTLY_RUNNING') : 'UNKNOWN';

      results.push({
        title: m.title,
        year: m.release_date ? parseInt(String(m.release_date).substring(0, 4)) : new Date().getFullYear(),
        originalLanguage: m.original_language || m.originalLanguage,
        industries: m.industries || [this.getIndustry(m.original_language || m.originalLanguage || '')],
        theatricalRelease: theatricalDate,
        ottRelease: ottDate,
        theatricalStatus,
        ottPlatforms: m.ottPlatforms || [],
        ottDateConfirmed: m.ottDateConfirmed || (ottDate !== null),
        primaryPlatform: m.primaryPlatform || (m.ottPlatforms?.[0]?.name),
        watchUrl: m.watchUrl || (m.ottPlatforms?.[0]?.watchUrl),
        classification: 'UNCLASSIFIED', // Will be classified by central MovieClassificationService
        tmdbId: m.id,
        overview: m.overview,
        popularity: m.popularity,
        posterPath: m.poster_path || m.posterPath,
        backdropPath: m.backdrop_path || m.backdropPath,
        releaseEventType: ottDate ? 'INDIA_OTT_DIGITAL' : (theatricalDate ? 'THEATRICAL' : 'UNKNOWN'),
        hasIndianTerritoryEvidence: (ottEvents.length > 0) || (m.ottPlatforms && m.ottPlatforms.some((p: any) => p.availableInIndia && p.verified)),
        evidenceSource: ottEvents.length > 0 ? 'TMDB_IN_DIGITAL_RELEASE' : (theatricalEvents.length > 0 ? 'TMDB_IN_THEATRICAL_RELEASE' : undefined),
        releaseEvents: m.releaseEvents
      });
    }

    // Filter out low-popularity junk from TMDB (require valid title & popularity)
    const filteredResults = results.filter(
      (m) => m.title && m.title.trim().length > 0 && m.popularity && m.popularity >= 1.0
    );

    this.logger.log(`Live TMDB Discover completed: ${filteredResults.length} authentic Indian-market candidates.`);
    return { results: filteredResults, rawMap: discoveredMovies };
  }

  // =====================================================
  // DEDICATED UPCOMING TV SERIES DISCOVERY PATH
  // Discover authentic future Indian & International TV series premieres & upcoming seasons
  // =====================================================

  private mapNetworkToIndianPlatform(networkName?: string): { name: string; availableInIndia: boolean; verified: boolean } | null {
    if (!networkName) return null;
    const lower = networkName.toLowerCase().trim();
    if (lower.includes('netflix')) return { name: 'Netflix', availableInIndia: true, verified: true };
    if (lower.includes('prime video') || lower.includes('amazon')) return { name: 'Prime Video', availableInIndia: true, verified: true };
    if (lower.includes('hotstar') || lower.includes('disney+')) return { name: 'Disney+ Hotstar', availableInIndia: true, verified: true };
    if (lower.includes('jiocinema') || lower.includes('jio cinema')) return { name: 'JioCinema', availableInIndia: true, verified: true };
    if (lower.includes('sonyliv') || lower.includes('sony liv')) return { name: 'SonyLIV', availableInIndia: true, verified: true };
    if (lower.includes('zee5')) return { name: 'Zee5', availableInIndia: true, verified: true };
    if (lower.includes('aha')) return { name: 'Aha', availableInIndia: true, verified: true };
    if (lower.includes('apple tv')) return { name: 'Apple TV+', availableInIndia: true, verified: true };
    return null;
  }

  private getCuratedTvSeriesForOffline(todayStr: string, dateLte: string): any[] {
    const curated = this.getFullCuratedData().upcomingOTT;
    const valid = curated.filter(c => c.release_date > todayStr && c.release_date <= dateLte);
    
    const enriched = valid.map(c => {
      const seasonMatch = c.title.match(/season\s*(\d+)/i);
      const seasonNumber = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
      const baseTitle = c.title.replace(/\s*season\s*\d+/i, '').replace(/:\s*$/, '').trim();
      const primaryPlatform = c.platform || undefined;
      return {
        canonicalId: `tmdb:tv:${c.id}`,
        tmdbId: c.id,
        title: baseTitle,
        seasonNumber,
        year: parseInt(c.release_date.substring(0, 4), 10),
        originalLanguage: c.original_language,
        industries: [this.getIndustry(c.original_language)],
        contentType: 'tv' as const,
        theatricalRelease: undefined,
        theatricalStatus: 'UNKNOWN' as const,
        ottRelease: c.release_date,
        ottDateConfirmed: false, // Fix 1: Specific season release date is unconfirmed/speculative
        uncorroboratedDate: true, // Fix 1: Route to PENDING_VALIDATION quarantine
        isDirectToOtt: true,
        ottPlatforms: primaryPlatform ? [{
          name: primaryPlatform,
          availableInIndia: true,
          verified: true, // Platform known and operates in India; season date is quarantined via uncorroboratedDate
          availabilityType: 'SUBSCRIPTION' as const,
          availableFrom: undefined,
          watchUrl: c.watchUrl
        }] : [],
        primaryPlatform,
        watchUrl: c.watchUrl,
        classification: 'UPCOMING_OTT' as const,
        overview: c.overview,
        popularity: 5.0,
        posterPath: c.poster_path,
        backdropPath: c.backdrop_path,
        sources: ['CURATED:TV'],
        releaseEventType: 'UNKNOWN' as const, // Fix 1: Do not claim confirmed digital release event
        hasIndianTerritoryEvidence: false, // Fix 1: Remove unsupported hardcoded confirmation
        evidenceSource: 'CURATED_SPECULATIVE_DATE'
      };
    });

    this.lastTvSeriesTelemetry = {
      targetDateWindow: { gte: todayStr, lte: dateLte },
      languagesScanned: ['hi', 'te', 'pa', 'en'],
      totalRawDiscovered: valid.length,
      uniqueCanonicalCount: enriched.length,
      duplicateCountRemoved: 0,
      countsByRegion: {
        indian: enriched.filter(e => ['hi', 'te', 'pa', 'ta', 'ml', 'kn', 'bn', 'mr'].includes(e.originalLanguage)).length,
        international: enriched.filter(e => !['hi', 'te', 'pa', 'ta', 'ml', 'kn', 'bn', 'mr'].includes(e.originalLanguage)).length,
      },
      countsByLanguage: enriched.reduce((acc: any, cur: any) => {
        acc[cur.originalLanguage] = (acc[cur.originalLanguage] || 0) + 1;
        return acc;
      }, {}),
      countsByType: {
        newSeries: enriched.filter(e => (e.seasonNumber || 1) <= 1).length,
        upcomingSeasons: enriched.filter(e => (e.seasonNumber || 1) > 1).length,
      },
      dateEvidenceQuality: {
        confirmedFutureDate: enriched.length,
        unverifiedOrPastExcluded: curated.length - valid.length
      },
      platformDistribution: enriched.reduce((acc: any, cur: any) => {
        const p = cur.primaryPlatform || 'Platform TBA';
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      }, {})
    };

    return enriched;
  }

  async discoverUpcomingTvSeries(options?: {
    todayStr?: string;
    windowDays?: number;
    languages?: string[];
  }): Promise<any[]> {
    const todayStr = options?.todayStr || new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const windowDays = options?.windowDays ?? 365;
    const refDate = new Date(`${todayStr}T00:00:00Z`);
    const futureDate = new Date(refDate.getTime() + windowDays * 86400000);
    const dateLte = futureDate.toISOString().split('T')[0];

    if (!this.apiKey) {
      return this.getCuratedTvSeriesForOffline(todayStr, dateLte);
    }

    // Regional Indian languages + top International markets (English, Korean, Japanese)
    const languages = options?.languages ?? [
      'hi', 'ta', 'te', 'ml', 'kn', 'bn', 'mr', 'pa',
      'en', 'ko', 'ja'
    ];

    const discoveredSeriesMap = new Map<string, any>();
    let totalRawDiscovered = 0;
    let duplicateCountRemoved = 0;

    // Multi-strategy query: Query both popularity.desc and first_air_date.asc to avoid relying exclusively on popularity
    const sortStrategies = ['popularity.desc', 'first_air_date.asc'];

    for (const lang of languages) {
      for (const sortBy of sortStrategies) {
        try {
          const url = `${this.baseUrl}/discover/tv?api_key=${this.apiKey}&with_original_language=${lang}&first_air_date.gte=${todayStr}&first_air_date.lte=${dateLte}&sort_by=${sortBy}&page=1`;
          
          let res: any = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              res = await this.http.get(url, { timeout: 6000 });
              break;
            } catch (e: any) {
              if (attempt === 2) throw e;
              await new Promise(r => setTimeout(r, 350 * (attempt + 1)));
            }
          }

          const results = res?.data?.results || [];
          for (const show of results) {
            totalRawDiscovered++;
            const seriesKey = String(show.id);
            if (discoveredSeriesMap.has(seriesKey)) {
              duplicateCountRemoved++;
              continue;
            }
            discoveredSeriesMap.set(seriesKey, show);
          }
        } catch (err: any) {
          this.logger.warn(`[TmdbProvider] TV discovery query for lang=${lang} sortBy=${sortBy} failed: ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 80));
      }
    }

    const seriesList = Array.from(discoveredSeriesMap.values());
    this.logger.log(`[TmdbProvider] TV series discovery found ${seriesList.length} unique raw candidate shows across ${languages.length} languages.`);

    // Sub-resource lookups: Fetch /tv/{id} details in bounded chunks
    const enrichedResults: any[] = [];
    let unverifiedOrPastExcluded = 0;
    const batchSize = 6;
    
    for (let i = 0; i < seriesList.length; i += batchSize) {
      const batch = seriesList.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (s) => {
          let detailData: any = null;
          try {
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                const detailRes = await this.http.get(`${this.baseUrl}/tv/${s.id}?api_key=${this.apiKey}`, { timeout: 5000 });
                detailData = detailRes?.data;
                break;
              } catch (e: any) {
                if (attempt === 2) break;
                await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
              }
            }
          } catch {}

          // Distinguish upcoming seasons from original first_air_date
          const rawFirstAir = s.first_air_date ? String(s.first_air_date).split('T')[0] : null;
          const seasons = (detailData?.seasons || []) as Array<{ season_number: number; air_date?: string; name?: string }>;
          
          // Check for upcoming seasons with air_date strictly in the future
          const upcomingSeasons = seasons
            .filter(sn => sn.season_number > 0 && sn.air_date && /^\d{4}-\d{2}-\d{2}$/.test(sn.air_date) && sn.air_date > todayStr && sn.air_date <= dateLte)
            .sort((a, b) => (a.air_date || '').localeCompare(b.air_date || ''));

          let validatedAirDate: string | null = null;
          let seasonNumber = 1;

          if (upcomingSeasons.length > 0) {
            // Authentic upcoming season premiere
            validatedAirDate = upcomingSeasons[0].air_date!;
            seasonNumber = upcomingSeasons[0].season_number;
          } else if (rawFirstAir && /^\d{4}-\d{2}-\d{2}$/.test(rawFirstAir) && rawFirstAir > todayStr && rawFirstAir <= dateLte) {
            // Brand-new series premiere
            validatedAirDate = rawFirstAir;
            seasonNumber = 1;
          } else {
            // Rule: Past first-air date with no upcoming season or missing/invalid date MUST NOT be treated as upcoming OTT!
            unverifiedOrPastExcluded++;
            return;
          }

          // Platform resolution: match TMDB networks against known Indian streaming providers
          const networks = (detailData?.networks || []).map((n: any) => n.name);
          let primaryPlatform: string | undefined = undefined;
          let matchedIndianPlatform = false;

          for (const net of networks) {
            const mapped = this.mapNetworkToIndianPlatform(net);
            if (mapped) {
              primaryPlatform = mapped.name;
              matchedIndianPlatform = true;
              break;
            }
          }

          const ottPlatforms = matchedIndianPlatform && primaryPlatform
            ? [{
                name: primaryPlatform,
                availableInIndia: true,
                verified: true,
                availabilityType: 'SUBSCRIPTION' as const,
                availableFrom: validatedAirDate
              }]
            : []; // Platform TBA only if confirmed digital release in India

          enrichedResults.push({
            canonicalId: `tmdb:tv:${s.id}`,
            tmdbId: s.id,
            title: s.name,
            seasonNumber,
            year: parseInt(validatedAirDate.substring(0, 4), 10),
            originalLanguage: s.original_language,
            industries: [this.getIndustry(s.original_language)],
            contentType: 'tv' as const,
            theatricalRelease: undefined,
            theatricalStatus: 'UNKNOWN' as const,
            ottRelease: matchedIndianPlatform ? validatedAirDate : undefined,
            ottDateConfirmed: matchedIndianPlatform,
            isDirectToOtt: matchedIndianPlatform,
            ottPlatforms,
            primaryPlatform,
            watchUrl: undefined,
            classification: matchedIndianPlatform ? ('UPCOMING_OTT' as const) : ('UNCLASSIFIED' as const),
            overview: s.overview || detailData?.overview,
            popularity: s.popularity,
            posterPath: s.poster_path || detailData?.poster_path,
            backdropPath: s.backdrop_path || detailData?.backdrop_path,
            sources: ['TMDB:TV'],
            releaseEventType: matchedIndianPlatform ? ('INDIA_OTT_DIGITAL' as const) : ('LINEAR_TV_BROADCAST' as const),
            originalNetworks: networks,
            broadcastAirDate: validatedAirDate,
            hasIndianTerritoryEvidence: matchedIndianPlatform
          });
        })
      );
      if (i + batchSize < seriesList.length) {
        await new Promise(r => setTimeout(r, 120));
      }
    }

    // Telemetry computation
    const indianLangsSet = new Set(['hi', 'ta', 'te', 'ml', 'kn', 'bn', 'mr', 'pa']);
    const countsByRegion = { indian: 0, international: 0 };
    const countsByLanguage: Record<string, number> = {};
    const countsByType = { newSeries: 0, upcomingSeasons: 0 };
    const platformDistribution: Record<string, number> = {};

    for (const item of enrichedResults) {
      if (indianLangsSet.has(item.originalLanguage)) {
        countsByRegion.indian++;
      } else {
        countsByRegion.international++;
      }

      countsByLanguage[item.originalLanguage] = (countsByLanguage[item.originalLanguage] || 0) + 1;

      if ((item.seasonNumber || 1) > 1) {
        countsByType.upcomingSeasons++;
      } else {
        countsByType.newSeries++;
      }

      const pName = item.primaryPlatform || 'Platform TBA';
      platformDistribution[pName] = (platformDistribution[pName] || 0) + 1;
    }

    this.lastTvSeriesTelemetry = {
      targetDateWindow: { gte: todayStr, lte: dateLte },
      languagesScanned: languages,
      totalRawDiscovered,
      uniqueCanonicalCount: enrichedResults.length,
      duplicateCountRemoved,
      countsByRegion,
      countsByLanguage,
      countsByType,
      dateEvidenceQuality: {
        confirmedFutureDate: enrichedResults.length,
        unverifiedOrPastExcluded
      },
      platformDistribution
    };

    this.logger.log(`[TmdbProvider] TV series discovery completed: ${enrichedResults.length} confirmed upcoming series (Indian: ${countsByRegion.indian}, International: ${countsByRegion.international}, Excluded past/unverified: ${unverifiedOrPastExcluded}).`);

    return enrichedResults;
  }

  // =====================================================
  // ISOLATED NOW IN THEATERS DISCOVERY PATH
  // Dedicated recent past ingestion without modifying discoverAllRaw
  // =====================================================

  async discoverRecentPastTheatricalCandidates(
    options?: RecentPastTheatricalDiscoveryOptions
  ): Promise<{ candidates: DiscoveredTheatricalCandidate[]; telemetry: CandidateDiscoveryTelemetry }> {
    const windowDays = options?.windowDays ?? 45;
    const languages = options?.languages ?? ['', 'hi', 'te', 'ta', 'ml', 'kn', 'bn', 'mr', 'pa', 'gu', 'or'];

    // Normalize reference date to India (Asia/Kolkata)
    const todayStr = options?.referenceDateStr || new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const refDate = new Date(`${todayStr}T00:00:00Z`);
    const pastDate = new Date(refDate.getTime() - windowDays * 86400000);
    const dateGte = pastDate.toISOString().split('T')[0];
    const dateLte = todayStr;

    const telemetry: CandidateDiscoveryTelemetry = {
      targetRegion: 'IN',
      targetDateWindow: { gte: dateGte, lte: dateLte },
      languagesScanned: languages,
      pagesFetchedByLanguage: {},
      totalPagesByLanguage: {},
      totalRawCandidates: 0,
      uniqueDeduplicatedCandidates: 0,
      isScanTruncated: false,
      providerErrors: [],
      coverageCompletenessStatus: 'COMPLETE'
    };

    if (!this.apiKey) {
      telemetry.coverageCompletenessStatus = 'PROVIDER_DEGRADED';
      telemetry.providerErrors.push({ language: 'ALL', error: 'NO_TMDB_API_KEY' });
      return { candidates: [], telemetry };
    }

    const discoveredMovies = new Map<string, any>();

    // 1. Ingestion: Query past Indian theatrical releases
    for (const lang of languages) {
      try {
        const res = await this.discoverExhaustive({
          langFilter: lang,
          region: 'IN',
          releaseType: '2|3',
          dateGte,
          dateLte
        });

        telemetry.pagesFetchedByLanguage[lang || 'all'] = res.pagesFetched;
        telemetry.totalPagesByLanguage[lang || 'all'] = res.totalPages;
        telemetry.totalRawCandidates += res.results.length;

        if (res.totalPages > res.pagesFetched) {
          telemetry.isScanTruncated = true;
          telemetry.coverageCompletenessStatus = 'PARTIALLY_TRUNCATED';
        }

        for (const m of res.results) {
          if (!discoveredMovies.has(String(m.id))) {
            discoveredMovies.set(String(m.id), { ...m, releaseEvents: [] });
          }
        }
      } catch (err: any) {
        telemetry.providerErrors.push({ language: lang || 'all', error: err.message });
        telemetry.coverageCompletenessStatus = 'PROVIDER_DEGRADED';
      }
    }

    telemetry.uniqueDeduplicatedCandidates = discoveredMovies.size;

    // 2. Sub-Resource Lookups: /release_dates and /watch/providers
    const candidatesList = Array.from(discoveredMovies.values());
    const chunkSize = 25;

    for (let i = 0; i < candidatesList.length; i += chunkSize) {
      const chunk = candidatesList.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (m) => {
          try {
            const [relRes, watchRes] = await Promise.all([
              this.http.get(`${this.baseUrl}/movie/${m.id}/release_dates?api_key=${this.apiKey}`).catch(() => null),
              this.http.get(`${this.baseUrl}/movie/${m.id}/watch/providers?api_key=${this.apiKey}`).catch(() => null)
            ]);

            const allCountryResults = relRes?.data?.results || [];
            m.rawReleaseEventsByCountry = allCountryResults;

            // Strict Indian Release Events
            const indiaReleases = allCountryResults.find((r: any) => r.iso_3166_1 === 'IN');
            m.indianReleaseEvents = [];
            if (indiaReleases && indiaReleases.release_dates) {
              for (const event of indiaReleases.release_dates) {
                const date = (event.release_date || '').split('T')[0];
                m.indianReleaseEvents.push({ type: event.type, date, note: event.note || '' });
              }
            }

            // Foreign Release Events (non-IN)
            m.foreignReleaseEvents = [];
            for (const cr of allCountryResults) {
              if (cr.iso_3166_1 !== 'IN' && cr.release_dates) {
                for (const event of cr.release_dates) {
                  const date = (event.release_date || '').split('T')[0];
                  m.foreignReleaseEvents.push({ country: cr.iso_3166_1, type: event.type, date });
                }
              }
            }

            // OTT Providers in India
            const inProviders = watchRes?.data?.results?.IN;
            m.ottPlatforms = [];
            m.isStreamingInIndia = false;
            if (inProviders) {
              if (inProviders.flatrate && inProviders.flatrate.length > 0) {
                m.isStreamingInIndia = true;
                for (const p of inProviders.flatrate) {
                  m.ottPlatforms.push({
                    name: p.provider_name,
                    availableInIndia: true,
                    verified: true,
                    availabilityType: 'SUBSCRIPTION',
                    watchUrl: inProviders.link,
                    logoPath: p.logo_path
                  });
                }
              }
            }
          } catch (e) {}
        })
      );
      if (i + chunkSize < candidatesList.length) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    // 3. Transform and Structure Candidates
    const candidates: DiscoveredTheatricalCandidate[] = [];

    for (const m of discoveredMovies.values()) {
      const indianTheatricalEvents = (m.indianReleaseEvents || [])
        .filter((e: any) => e.type === 2 || e.type === 3)
        .sort((a: any, b: any) => a.date.localeCompare(b.date));

      const hasExplicitIndianTheatricalEvent = indianTheatricalEvents.length > 0;
      const rawOriginalReleaseDate = m.release_date ? String(m.release_date).split('T')[0] : undefined;
      const originalYear = rawOriginalReleaseDate ? parseInt(rawOriginalReleaseDate.substring(0, 4), 10) : undefined;

      // STRICT RULE: Never fall back to m.release_date or overseas dates for theatricalReleaseDate
      const latestIndianTheatricalDate = hasExplicitIndianTheatricalEvent
        ? indianTheatricalEvents[indianTheatricalEvents.length - 1].date
        : undefined;

      // Re-Release Detection:
      // If historical original release year is earlier than current year,
      // and an explicit Indian theatrical event exists within the target window,
      // model it as a separate Re-Release Event.
      let reReleaseEvent: DiscoveredTheatricalCandidate['reReleaseEvent'] = undefined;
      const currentYear = new Date(todayStr).getFullYear();

      if (
        originalYear &&
        originalYear < currentYear &&
        hasExplicitIndianTheatricalEvent &&
        latestIndianTheatricalDate &&
        latestIndianTheatricalDate >= dateGte &&
        latestIndianTheatricalDate <= dateLte
      ) {
        reReleaseEvent = {
          isReRelease: true,
          reReleaseDate: latestIndianTheatricalDate,
          originalReleaseDate: rawOriginalReleaseDate || '',
          originalReleaseYear: originalYear,
          evidenceSource: 'TMDB_IN_RE_RELEASE_EVENT'
        };
      }

      candidates.push({
        id: m.id,
        tmdbId: m.id,
        title: m.title,
        originalTitle: m.original_title,
        originalLanguage: m.original_language,
        industries: [this.getIndustry(m.original_language || '')],
        overview: m.overview,
        posterPath: m.poster_path,
        backdropPath: m.backdrop_path,
        popularity: m.popularity,
        originalReleaseDate: rawOriginalReleaseDate,
        originalReleaseYear: originalYear,
        theatricalReleaseDate: latestIndianTheatricalDate,
        hasExplicitIndianTheatricalEvent,
        indianReleaseEvents: m.indianReleaseEvents || [],
        foreignReleaseEvents: m.foreignReleaseEvents || [],
        reReleaseEvent,
        ottPlatforms: m.ottPlatforms || [],
        ottDateConfirmed: !!m.isStreamingInIndia,
        isStreamingInIndia: !!m.isStreamingInIndia,
        raw: m
      });
    }

    return { candidates, telemetry };
  }

  async discoverAll(): Promise<{
    upcomingTheater: any[];
    nowInTheater: any[];
    upcomingOTT: any[];
    nowStreaming: any[];
    audit?: any;
  }> {
    if (this.cachedDiscoverData && (Date.now() - this.cacheTimestamp < 1000 * 60 * 5)) {
      this.logger.log('Returning cached discover data');
      return this.cachedDiscoverData;
    }

    if (!this.apiKey) {
      this.logger.warn('No TMDB key. Returning full curated database.');
      return this.getFullCuratedData();
    }

    this.logger.log('STARTING DISCOVERY ENGINE (Date-Driven, Exhaustive)');

    const today = new Date();
    const fmt = (d: any) => d.toISOString().split('T')[0];
    const addDays = (d: any, days: number) => { const nd = new Date(d); nd.setDate(nd.getDate() + days); return nd; };

    // 2. DATE WINDOW CHUNKING (Overlapping to catch boundaries)
    const windows = [
      { start: 0, end: 30 },
      { start: 30, end: 60 },
      { start: 60, end: 90 },
      { start: 90, end: 180 },
      { start: 180, end: 365 }
    ];

    // 3. LANGUAGE COVERAGE
    const langs = ['', 'hi', 'te', 'ta', 'ml', 'kn', 'en', 'bn', 'mr', 'pa', 'gu', 'or', 'ja', 'ko'];

    const discoverQueue = [];
    
    // 1. THEATER & OTT DISCOVERY (Exhaustive)
    for (const win of windows) {
      const gte = fmt(addDays(today, win.start));
      const lte = fmt(addDays(today, win.end));
      
      for (const lang of langs) {
        discoverQueue.push(() => this.discoverExhaustive({ langFilter: lang, region: 'IN', releaseType: '2|3', dateGte: gte, dateLte: lte }));
        discoverQueue.push(() => this.discoverExhaustive({ langFilter: lang, region: 'IN', releaseType: '4|5|6', dateGte: gte, dateLte: lte }));
      }
    }

    // Execute Discovery in chunks
    const discoveredMovies = new Map();
    let totalQueries = 0;
    let tmdbTotalPages = 0;
    let pagesFetched = 0;
    let tmdbTotalResults = 0;
    
    const chunkSize = 20; 
    for (let i = 0; i < discoverQueue.length; i += chunkSize) {
      const chunk = discoverQueue.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map(fn => fn()));
      for (const res of chunkResults) {
        tmdbTotalPages += res.totalPages;
        pagesFetched += res.pagesFetched;
        tmdbTotalResults += res.totalResults;
        for (const m of res.results) {
          if (!discoveredMovies.has(String(m.id))) {
            discoveredMovies.set(String(m.id), { ...m, releaseEvents: [] });
          }
        }
      }
      totalQueries += chunk.length;
      if (i + chunkSize < discoverQueue.length) await new Promise(r => setTimeout(r, 100));
    }

    // 8. DISCOVERY SAFETY NET (Find gaps before they are inserted)
    const curated = this.getFullCuratedData();
    const allCurated = [...curated.upcomingTheater, ...curated.nowInTheater, ...curated.upcomingOTT, ...curated.nowStreaming];
    
    let criticalGaps = 0;
    for (const c of allCurated) {
      const cAny = c as any;
      const isKnownTheatricalInNextYear = String(cAny.id).startsWith('ut-') || String(cAny.id).startsWith('nt-') || (cAny.classification && cAny.classification.includes('THEATER'));
      
      const existing = Array.from(discoveredMovies.values()).find(m => String(m.id) === String(cAny.id) || m.title?.toLowerCase() === cAny.title?.toLowerCase());
      
      if (isKnownTheatricalInNextYear && !existing) {
        criticalGaps++;
        this.logger.error(`CRITICAL DISCOVERY GAP: ${cAny.title} (Lang: ${cAny.original_language}, Date: ${cAny.release_date}, ID: ${cAny.id}) was completely missed by TMDB queries! Source: curated`);
      }
    }

    if (criticalGaps === 0) {
      this.logger.log(`SAFETY NET PASSED: No known canonical Indian theatrical releases were missed by TMDB queries.`);
    }

    // 5. SOURCE EXPANSION: Add Curated Data to canonical pool
    for (const c of allCurated) {
      const cAny = c as any;
      const existing = Array.from(discoveredMovies.values()).find(m => String(m.id) === String(cAny.id) || m.title?.toLowerCase() === cAny.title?.toLowerCase());
      const key = existing ? String(existing.id) : String(cAny.id);
      
      if (!discoveredMovies.has(key)) discoveredMovies.set(key, { ...cAny, releaseEvents: [] });
      
      const m = discoveredMovies.get(key);
      if (!m.poster_path && cAny.poster_path) m.poster_path = cAny.poster_path;
      if (cAny.platform) m.platform = cAny.platform;
    }

    this.logger.log(`DISCOVERY COMPLETE: Found ${discoveredMovies.size} canonical movies across ${totalQueries} query variants.`);

    // 4. VERY IMPORTANT TMDB REGION CAVEAT: Verify explicit India Release Events!
    const verificationQueue = Array.from(discoveredMovies.values());
    const verificationChunkSize = 30; 
    
    let verifiedIndiaTheatrical = 0;
    let verifiedIndiaOtt = 0;

    for (let i = 0; i < verificationQueue.length; i += verificationChunkSize) {
      const chunk = verificationQueue.slice(i, i + verificationChunkSize);
      
      await Promise.all(chunk.map(async (m) => {
        if (String(m.id).startsWith('ut-') || String(m.id).startsWith('nt-') || String(m.id).startsWith('uo-') || String(m.id).startsWith('ns-')) {
           const isTheatrical = String(m.id).includes('t-');
           // Curated series (uo-) must have verified date evidence; only confirmed streaming (ns-) gets automatic OTT event
           const isOtt = String(m.id).includes('s-');
           if (isTheatrical) m.releaseEvents.push({ type: 'THEATRICAL', date: m.release_date, source: 'CURATED', country: 'IN' });
           if (isOtt) m.releaseEvents.push({ type: 'OTT', date: m.release_date, source: 'CURATED', country: 'IN' });
           return;
        }

        try {
          const res = await this.http.get(`${this.baseUrl}/movie/${m.id}/release_dates?api_key=${this.apiKey}`);
          const results = res.data.results || [];
          
          const indiaReleases = results.find((r: any) => r.iso_3166_1 === 'IN');
          if (indiaReleases && indiaReleases.release_dates) {
             for (const event of indiaReleases.release_dates) {
                const date = event.release_date.split('T')[0];
                if (event.type === 2 || event.type === 3) {
                   m.releaseEvents.push({ type: 'THEATRICAL', date, source: 'TMDB', country: 'IN' });
                   verifiedIndiaTheatrical++;
                }
                // Fix 2: Only Type 4 (Digital) is a potential OTT candidate; Type 5 (Physical) and Type 6 (Linear TV) are excluded
                if (event.type === 4) {
                   m.releaseEvents.push({ type: 'OTT', date, source: 'TMDB', country: 'IN' });
                   verifiedIndiaOtt++;
                }
             }
          }
        } catch (e) {
        }
      }));
      
      if (i + verificationChunkSize < verificationQueue.length) await new Promise(r => setTimeout(r, 100));
    }

    // 6. COMPLETENESS AUDIT
    this.logger.log(`AUDIT: Verified ${verifiedIndiaTheatrical} Indian Theatrical events and ${verifiedIndiaOtt} Indian OTT events across ${discoveredMovies.size} canonical movies.`);

    // ==========================================
    // CANONICAL MOVIE CLASSIFICATION ENGINE
    // ==========================================
    
    const todayStr = fmt(today);
    const nowInTheater = [];
    const upcomingTheater = [];
    const nowStreaming = [];
    const upcomingOTT = [];
    const needsVerification = [];

    for (const m of discoveredMovies.values()) {
      const theatricalEvents = m.releaseEvents.filter((e: any) => e.type === 'THEATRICAL' && e.country === 'IN').map((e: any) => e.date).sort();
      const ottEvents = m.releaseEvents.filter((e: any) => e.type === 'OTT' && e.country === 'IN').map((e: any) => e.date).sort();
      
      m.theatricalDate = theatricalEvents.length > 0 ? theatricalEvents[theatricalEvents.length - 1] : null;
      m.ottDate = ottEvents.length > 0 ? ottEvents[ottEvents.length - 1] : null;

      const hasTheatrical = m.theatricalDate !== null;
      const hasOTT = m.ottDate !== null;
      
      const isTheatricalUpcoming = hasTheatrical && m.theatricalDate > todayStr;
      const isTheatricalReleased = hasTheatrical && m.theatricalDate <= todayStr;
      const isOTTUpcoming = hasOTT && m.ottDate > todayStr;
      const isOTTReleased = hasOTT && m.ottDate <= todayStr;

      if (!m.industry) m.industry = this.getIndustry(m.original_language || '');

      if (hasTheatrical) {
        if (isTheatricalUpcoming) {
          m.classification = 'UPCOMING_THEATER';
          upcomingTheater.push(m);
        } else if (isTheatricalReleased) {
          m.classification = 'NOW_IN_THEATER';
          const daysOld = (today.getTime() - new Date(m.theatricalDate).getTime()) / (1000 * 3600 * 24);
          if (daysOld <= 45) nowInTheater.push(m);
        }
      } 
      else if (hasOTT) {
        if (isOTTUpcoming) {
          m.classification = 'UPCOMING_OTT_EXCLUSIVE';
          upcomingOTT.push(m);
        } else if (isOTTReleased) {
          m.classification = 'NOW_STREAMING';
          const daysOld = (today.getTime() - new Date(m.ottDate).getTime()) / (1000 * 3600 * 24);
          if (daysOld <= 45) nowStreaming.push(m);
        }
      } 
      else {
        m.classification = 'UNKNOWN';
        needsVerification.push(m);
      }
    }
    
    // RULE 8: Automated Invariant Test (Exclusivity Guarantee)
    const theatricalIds = new Set([...nowInTheater, ...upcomingTheater].map(m => String(m.id)));
    const ottExclusiveIds = new Set([...nowStreaming, ...upcomingOTT].map(m => String(m.id)));
    const intersection = [...theatricalIds].filter(id => ottExclusiveIds.has(id));
    
    if (intersection.length > 0) {
       throw new Error(`CRITICAL INVARIANT FAILURE: Canonical IDs found in both THEATRICAL and OTT_EXCLUSIVE buckets: ${intersection.join(', ')}`);
    }

    const safeTime = (a: any) => {
      const d = a.theatricalDate || a.ottDate;
      if (!d) return 0;
      const t = new Date(d).getTime();
      return isNaN(t) ? 0 : t;
    };

    const sortAsc = (a: any, b: any) => {
      const ta = safeTime(a);
      const tb = safeTime(b);
      if (ta === 0 && tb !== 0) return 1;
      if (tb === 0 && ta !== 0) return -1;
      return ta - tb;
    };

    const sortDesc = (a: any, b: any) => {
      const ta = safeTime(a);
      const tb = safeTime(b);
      if (ta === 0 && tb !== 0) return 1;
      if (tb === 0 && ta !== 0) return -1;
      return tb - ta;
    };

    upcomingTheater.sort(sortAsc);
    upcomingOTT.sort(sortAsc);
    nowInTheater.sort(sortDesc);
    nowStreaming.sort(sortDesc);

    const finalData = { 
      upcomingTheater, nowInTheater, upcomingOTT, nowStreaming,
      audit: {
         source: {
           tmdbTotalResults,
           tmdbTotalPages,
           pagesFetched,
           dateWindowsQueried: windows.length,
           languagesQueried: langs.length
         },
         discoveredCanonical: discoveredMovies.size,
         totalQueries,
         verifiedIndiaTheatrical,
         verifiedIndiaOtt,
         needsVerification: needsVerification.length,
         duplicatesRemoved: (tmdbTotalResults + allCurated.length) - discoveredMovies.size
      }
    };
    this.cachedDiscoverData = finalData;
    this.cacheTimestamp = Date.now();

    return finalData;
  }

  // Helper: Exhaustive single TMDB discover call using total_pages
  private async discoverExhaustive(opts: { langFilter: string; region: string; releaseType: string; dateGte: string; dateLte: string }): Promise<{results: any[], pagesFetched: number, totalPages: number, totalResults: number}> {
    const allResults = [];
    let currentPage = 1;
    let totalPages = 1;
    let totalResults = 0;
    
    try {
      while (currentPage <= totalPages) {
        let langQuery = opts.langFilter ? `&with_original_language=${opts.langFilter}` : '';
        const isIndianLang = ['hi', 'te', 'ta', 'ml', 'kn', 'bn', 'mr', 'pa', 'gu', 'or'].includes(opts.langFilter);
        const regionParam = isIndianLang ? '' : `&region=${opts.region}`;
        const releaseTypeParam = isIndianLang ? '' : `&with_release_type=${opts.releaseType}`;
        const dateParam = isIndianLang 
          ? `&primary_release_date.gte=${opts.dateGte}&primary_release_date.lte=${opts.dateLte}`
          : `&release_date.gte=${opts.dateGte}&release_date.lte=${opts.dateLte}`;

        const url = `${this.baseUrl}/discover/movie?api_key=${this.apiKey}${regionParam}${langQuery}${releaseTypeParam}${dateParam}&sort_by=popularity.desc&page=${currentPage}`;
        
        const res = await this.http.get(url);
        if (res.data.results) allResults.push(...res.data.results);
        
        totalPages = res.data.total_pages || 1;
        totalResults = res.data.total_results || 0;
        currentPage++;
        
        if (currentPage <= totalPages) {
          await new Promise(r => setTimeout(r, 20)); // rate limit protection
        }
      }
    } catch (e) {
      this.logger.warn(`TMDB discover exhaustive chunk failed: ${e.message}`);
    }
    
    return { results: allResults, pagesFetched: currentPage - 1, totalPages, totalResults };
  }

  private getIndustry(lang: string): string {
    const map: Record<string, string> = {
      hi: 'Bollywood', te: 'Tollywood', ta: 'Kollywood',
      ml: 'Mollywood', kn: 'Sandalwood', bn: 'Bengali',
      mr: 'Marathi', pa: 'Punjabi', en: 'Hollywood'
    };
    return map[lang] || 'Other';
  }

  // =====================================================
  // CURATED FALLBACK DATABASE
  // =====================================================

  private getFullCuratedData() {
    return {
      upcomingTheater: [
        // --- TEST FIXTURES (Future dates) ---
        { id: 'ut-f01', title: 'Test: Low Pop Tomorrow', release_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], overview: 'Low pop edge case', poster_path: null, industry: 'Kollywood', original_language: 'ta', popularity: 0.1 },
        { id: 'ut-f02', title: 'Test: 7 Days Out', release_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], overview: '7 days edge case', poster_path: null, industry: 'Tollywood', original_language: 'te' },
        { id: 'ut-f03', title: 'Test: 31 Days Boundary', release_date: new Date(Date.now() + 31 * 86400000).toISOString().split('T')[0], overview: 'Window boundary test', poster_path: null, industry: 'Bollywood', original_language: 'hi' },
        { id: 'ut-f04', title: 'Test: Missing from TMDB', release_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0], overview: 'Curated only test', poster_path: null, industry: 'Kollywood', original_language: 'ta' },
        { id: 'ut-f05', title: 'Test: Postponed Release', release_date: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0], overview: 'Postponed theatrical', poster_path: null, industry: 'Mollywood', original_language: 'ml' },
        // --- KOLLYWOOD (Tamil) ---
        { id: 'ut-t03', title: 'OM Chapter 1: Udhiram', release_date: '2026-10-24', overview: 'Dhanush and Mammootty star in this epic saga with Sai Pallavi and Sreeleela. Directed by Vetrimaaran.', poster_path: null, backdrop_path: null, industry: 'Kollywood', original_language: 'ta' },
        { id: 'ut-t04', title: 'Coolie', release_date: '2026-11-05', overview: 'Superstar Rajinikanth teams up with Lokesh Kanagaraj. Set in the Lokesh Cinematic Universe.', poster_path: null, backdrop_path: null, industry: 'Kollywood', original_language: 'ta' },
        { id: 'ut-t05', title: 'Arasan', release_date: '2026-11-06', overview: 'Silambarasan TR and Vijay Sethupathi star in this thriller set in the Vada Chennai universe.', poster_path: null, backdrop_path: null, industry: 'Kollywood', original_language: 'ta' },
        { id: 'ut-t06', title: 'Scene', release_date: '2026-11-06', overview: 'Suriya stars alongside Nazriya Nazim and Naslen Gafoor in this highly anticipated action drama.', poster_path: null, backdrop_path: null, industry: 'Kollywood', original_language: 'ta' },
        { id: 'ut-t07', title: '7G Rainbow Colony 2', release_date: '2026-11-06', overview: 'The sequel to the cult classic returns with the beloved characters in a new chapter.', poster_path: null, backdrop_path: null, industry: 'Kollywood', original_language: 'ta' },
        // --- TOLLYWOOD (Telugu) ---
        { id: 'ut-te01', title: 'Vishwambhara', release_date: '2026-10-26', overview: 'Megastar Chiranjeevi stars alongside Trisha and Meenakshi Chaudhary in this massive spectacle.', poster_path: null, backdrop_path: null, industry: 'Tollywood', original_language: 'te' },
        { id: 'ut-te02', title: 'Ranabaali', release_date: '2026-10-30', overview: 'Vijay Deverakonda and Rashmika Mandanna reunite for this action-packed entertainer.', poster_path: null, backdrop_path: null, industry: 'Tollywood', original_language: 'te' },
        { id: 'ut-te03', title: 'JGM - Jana Gana Mana', release_date: '2026-11-03', overview: 'Vijay Deverakonda stars in this patriotic action thriller with massive expectations.', poster_path: null, backdrop_path: null, industry: 'Tollywood', original_language: 'te' },
        { id: 'ut-te04', title: 'RC 17', release_date: '2026-11-12', overview: 'Ram Charan returns in this untitled mega-budget action drama.', poster_path: null, backdrop_path: null, industry: 'Tollywood', original_language: 'te' },
        { id: 'ut-te05', title: 'HIT: The Fourth Case', release_date: '2026-11-13', overview: 'Karthi leads the next installment of the successful HIT franchise.', poster_path: null, backdrop_path: null, industry: 'Tollywood', original_language: 'te' },
        { id: 'ut-te06', title: 'Mysaa', release_date: '2026-11-27', overview: 'Rashmika Mandanna leads this emotional drama that has generated massive buzz.', poster_path: null, backdrop_path: null, industry: 'Tollywood', original_language: 'te' },
        // --- BOLLYWOOD (Hindi) ---
        { id: 'ut-b03', title: 'Ramayana: Part 1', release_date: '2026-11-05', overview: 'Ranbir Kapoor, Sai Pallavi and Yash star in this epic mythological spectacle directed by Nitesh Tiwari.', poster_path: null, backdrop_path: null, industry: 'Bollywood', original_language: 'hi' },
        { id: 'ut-b04', title: 'Love & War', release_date: '2026-12-25', overview: 'Sanjay Leela Bhansali directs Ranbir, Alia and Vicky in an epic saga of love and conflict.', poster_path: null, backdrop_path: null, industry: 'Bollywood', original_language: 'hi' },
        { id: 'ut-b05', title: 'Spirit', release_date: '2026-12-20', overview: 'Prabhas stars in this intense action drama directed by Sandeep Reddy Vanga.', poster_path: null, backdrop_path: null, industry: 'Bollywood', original_language: 'hi' },
        { id: 'ut-b06', title: 'Avengers: Doomsday', release_date: '2026-12-18', overview: 'The Avengers face Doctor Doom in this massive MCU event. Robert Downey Jr. returns.', poster_path: null, backdrop_path: null, industry: 'Hollywood', original_language: 'en' },
        // --- MOLLYWOOD (Malayalam) ---
        { id: 'ut-m03', title: 'Titans', release_date: '2026-11-06', overview: 'A massive Malayalam action ensemble featuring top stars.', poster_path: null, backdrop_path: null, industry: 'Mollywood', original_language: 'ml' },
        { id: 'ut-m04', title: "Bachelor Party D'eux", release_date: '2026-11-19', overview: 'Amal Neerad directs Naslen Gafoor in this stylish sequel.', poster_path: null, backdrop_path: null, industry: 'Mollywood', original_language: 'ml' },
        // --- SANDALWOOD (Kannada) ---
        { id: 'ut-k01', title: 'Toxic: A Fairy Tale for Grown-ups', release_date: '2026-10-25', overview: 'Rocking Star Yash returns in a high-octane action saga set in Goa.', poster_path: null, backdrop_path: null, industry: 'Sandalwood', original_language: 'kn' },
        // --- HOLLYWOOD ---
        { id: 'ut-h01', title: 'Clayface', release_date: '2026-10-23', overview: 'DC Studios brings the tragic villain Clayface to the big screen. Directed by James Watkins.', poster_path: null, backdrop_path: null, industry: 'Hollywood', original_language: 'en' },
        { id: 'ut-h02', title: 'Mission: Impossible - The Final Reckoning', release_date: '2026-10-23', overview: 'Tom Cruise returns as Ethan Hunt in the concluding chapter of the spy franchise.', poster_path: null, backdrop_path: null, industry: 'Hollywood', original_language: 'en' },
      ],
      nowInTheater: [
        // --- BOLLYWOOD ---
        { id: 'nt-b01', title: 'War 2', release_date: '2026-09-12', overview: 'Hrithik Roshan leads the YRF Spy Universe in a globe-trotting action thriller.', poster_path: null, backdrop_path: null, industry: 'Bollywood', original_language: 'hi' },
        { id: 'nt-b02', title: 'Drishyam 3: The Conclusion', release_date: '2026-10-02', overview: 'Ajay Devgn and Tabu return for the final chapter of the iconic thriller franchise.', poster_path: null, backdrop_path: null, industry: 'Bollywood', original_language: 'hi' },
        { id: 'nt-b03', title: 'Pooja Meri Jaan', release_date: '2026-09-25', overview: 'A heartfelt family drama that has struck a chord with audiences across India.', poster_path: null, backdrop_path: null, industry: 'Bollywood', original_language: 'hi' },
        { id: 'nt-b04', title: 'Udta Teer', release_date: '2026-10-09', overview: 'Ayushmann Khurrana and Sara Ali Khan star in this sports drama.', poster_path: null, backdrop_path: null, industry: 'Bollywood', original_language: 'hi' },
        // --- TOLLYWOOD ---
        { id: 'nt-te01', title: 'Devara: Part 2', release_date: '2026-09-20', overview: 'Jr. NTR returns in the epic conclusion of the coastal action saga.', poster_path: null, backdrop_path: null, industry: 'Tollywood', original_language: 'te' },
        { id: 'nt-te02', title: 'Thella Kagitham', release_date: '2026-09-25', overview: 'A gripping Telugu thriller that has been running strong at the box office.', poster_path: null, backdrop_path: null, industry: 'Tollywood', original_language: 'te' },
        // --- KOLLYWOOD ---
        { id: 'nt-t01', title: 'Vidaamuyarchi', release_date: '2026-09-15', overview: 'Ajith Kumar stars in a high-stakes survival thriller set across international landscapes.', poster_path: null, backdrop_path: null, industry: 'Kollywood', original_language: 'ta' },
        { id: 'nt-t02', title: 'Jailer 2', release_date: '2026-09-20', overview: 'Rajinikanth returns as the fierce retired jailer in this blockbuster sequel.', poster_path: null, backdrop_path: null, industry: 'Kollywood', original_language: 'ta' },
        { id: 'nt-t03', title: 'Baththa', release_date: '2026-10-01', overview: 'In 1986 Madras, a timid eight-year-old boy accidentally traps a feared don.', poster_path: null, backdrop_path: null, industry: 'Kollywood', original_language: 'ta' },
        { id: 'nt-t04', title: 'Dorothy', release_date: '2026-10-05', overview: 'A suspenseful drama running successfully in theaters.', poster_path: null, backdrop_path: null, industry: 'Kollywood', original_language: 'ta' },
        { id: 'nt-t05', title: 'Yezhu Kadal Yezhu Malai', release_date: '2026-10-01', overview: 'A fantasy drama directed by Ram starring Nivin Pauly, Anjali & Soori. Premiered at Rotterdam Film Festival.', poster_path: null, backdrop_path: null, industry: 'Kollywood', original_language: 'ta' },
        { id: 'nt-t06', title: 'Anbil Avan', release_date: '2026-10-02', overview: 'An action-romance starring Ashok Selvan and Preity Mukhundhan. Worldwide theatrical release.', poster_path: null, backdrop_path: null, industry: 'Kollywood', original_language: 'ta' },
        // --- MOLLYWOOD ---
        { id: 'nt-m01', title: 'L2: Empuraan', release_date: '2026-09-10', overview: 'Mohanlal returns as the legendary Khureshi Ab\'ram in this mega-sequel to Lucifer.', poster_path: null, backdrop_path: null, industry: 'Mollywood', original_language: 'ml' },
        { id: 'nt-m02', title: 'Prathimukham', release_date: '2026-09-25', overview: 'A powerful Malayalam drama directed by Sidhartha Siva, now running in theaters.', poster_path: null, backdrop_path: null, industry: 'Mollywood', original_language: 'ml' },
        { id: 'nt-m03', title: 'Torpedo', release_date: '2026-10-09', overview: 'Naslen K. Gafoor and Fahadh Faasil star in this gripping thriller.', poster_path: null, backdrop_path: null, industry: 'Mollywood', original_language: 'ml' },
        { id: 'nt-m04', title: 'Avaraachan & Sons', release_date: '2026-10-12', overview: 'Biju Menon and Sreenath Bhasi lead this family drama.', poster_path: null, backdrop_path: null, industry: 'Mollywood', original_language: 'ml' },
        // --- SANDALWOOD ---
        { id: 'nt-k01', title: 'Father', release_date: '2026-09-26', overview: 'Darling Krishna and Prakash Raj star in this emotional drama.', poster_path: null, backdrop_path: null, industry: 'Sandalwood', original_language: 'kn' },
        { id: 'nt-k02', title: 'Bail', release_date: '2026-10-02', overview: 'Shiva Rajkumar and Sangeetha Krish star in this intense courtroom drama.', poster_path: null, backdrop_path: null, industry: 'Sandalwood', original_language: 'kn' },
        { id: 'nt-k03', title: 'Pinaka', release_date: '2026-10-02', overview: 'Ganesh and Archana Iyer star in this action-packed entertainer.', poster_path: null, backdrop_path: null, industry: 'Sandalwood', original_language: 'kn' },
        // --- HOLLYWOOD ---
        { id: 'nt-h01', title: 'The Fantastic Four: First Steps', release_date: '2026-09-25', overview: 'Marvel\'s First Family makes their MCU debut in a retro-futuristic adventure.', poster_path: null, backdrop_path: null, industry: 'Hollywood', original_language: 'en' },
      ],
      upcomingOTT: [
        // --- BOLLYWOOD ---
        { id: 'uo-b01', title: 'The Family Man Season 3', release_date: '2026-12-05', overview: 'Srikant Tiwari faces a deadly new threat from the North East. Streaming on Prime Video.', poster_path: null, backdrop_path: null, industry: 'Bollywood', platform: 'Prime Video', watchUrl: 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=The%20Family%20Man', original_language: 'hi' },
        { id: 'uo-b02', title: 'Panchayat Season 4', release_date: '2026-11-14', overview: 'Phulera prepares for crucial elections. Abhishek is caught in escalating rivalries. Streaming on Prime Video.', poster_path: null, backdrop_path: null, industry: 'Bollywood', platform: 'Prime Video', watchUrl: 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=Panchayat', original_language: 'hi' },
        { id: 'uo-b03', title: 'Asur Season 3', release_date: '2027-03-15', overview: 'The mythological cyber thriller returns. Streaming on JioCinema.', poster_path: null, backdrop_path: null, industry: 'Bollywood', platform: 'JioCinema', watchUrl: 'https://www.jiocinema.com/search/Asur', original_language: 'hi' },
        { id: 'uo-b04', title: 'Scam 2010: The Subrata Roy Saga', release_date: '2026-12-11', overview: 'The Scam franchise continues. The rise and fall of the Sahara empire. Streaming on SonyLIV.', poster_path: null, backdrop_path: null, industry: 'Bollywood', platform: 'SonyLIV', watchUrl: 'https://www.sonyliv.com/search/Scam', original_language: 'hi' },
        { id: 'uo-b05', title: 'Made in Heaven Season 3', release_date: '2026-11-28', overview: 'Tara and Karan navigate India\'s evolving wedding industry. Streaming on Prime Video.', poster_path: null, backdrop_path: null, industry: 'Bollywood', platform: 'Prime Video', watchUrl: 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=Made%20in%20Heaven', original_language: 'hi' },
        // --- TOLLYWOOD ---
        { id: 'uo-te01', title: 'Rana Naidu Season 2', release_date: '2027-01-20', overview: 'The fixer of Bollywood is back with deadlier secrets. Streaming on Netflix.', poster_path: null, backdrop_path: null, industry: 'Tollywood', platform: 'Netflix', watchUrl: 'https://www.netflix.com/search?q=Rana%20Naidu', original_language: 'te' },
        // --- PUNJABI ---
        { id: 'uo-p01', title: 'Kohhra Season 2', release_date: '2026-11-15', overview: 'The fog-drenched murder mystery returns with a new crime in rural Punjab. Streaming on Netflix.', poster_path: null, backdrop_path: null, industry: 'Punjabi', platform: 'Netflix', watchUrl: 'https://www.netflix.com/search?q=Kohhra', original_language: 'pa' },
        // --- HOLLYWOOD ---
        { id: 'uo-h01', title: 'Stranger Things: Season 5', release_date: '2026-11-28', overview: 'The final season. The Upside Down reaches its apocalyptic conclusion. Streaming on Netflix.', poster_path: null, backdrop_path: null, industry: 'Hollywood', platform: 'Netflix', watchUrl: 'https://www.netflix.com/search?q=Stranger%20Things', original_language: 'en' },
        { id: 'uo-h02', title: 'Squid Game: Season 3', release_date: '2026-12-15', overview: 'The deadly games enter their final, most brutal round. Streaming on Netflix.', poster_path: null, backdrop_path: null, industry: 'Hollywood', platform: 'Netflix', watchUrl: 'https://www.netflix.com/search?q=Squid%20Game', original_language: 'en' },
      ],
      nowStreaming: [
        // --- BOLLYWOOD ---
        { id: 'ns-b01', title: 'Mirzapur Season 4', release_date: '2026-09-25', overview: 'The battle for Purvanchal reaches its bloody climax. Streaming on Prime Video.', poster_path: null, backdrop_path: null, industry: 'Bollywood', platform: 'Prime Video', watchUrl: 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=Mirzapur', original_language: 'hi' },
        { id: 'ns-b02', title: 'Delhi Crime Season 3', release_date: '2026-09-06', overview: 'DCP Vartika Chaturvedi investigates a chilling new case. Streaming on Netflix.', poster_path: null, backdrop_path: null, industry: 'Bollywood', platform: 'Netflix', watchUrl: 'https://www.netflix.com/search?q=Delhi%20Crime', original_language: 'hi' },
        { id: 'ns-b03', title: 'Guns & Gulaabs Season 2', release_date: '2026-09-26', overview: 'The quirky, violent world of Gulaabganj returns. Streaming on Netflix.', poster_path: null, backdrop_path: null, industry: 'Bollywood', platform: 'Netflix', watchUrl: 'https://www.netflix.com/search?q=Guns%20and%20Gulaabs', original_language: 'hi' },
        { id: 'ns-b04', title: 'Dahaad Season 2', release_date: '2026-09-10', overview: 'Anjali Bhaati takes on a massive new case. Streaming on Prime Video.', poster_path: null, backdrop_path: null, industry: 'Bollywood', platform: 'Prime Video', watchUrl: 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=Dahaad', original_language: 'hi' },
        { id: 'ns-b05', title: 'Farzi Season 2', release_date: '2026-09-14', overview: 'Sunny\'s counterfeit empire expands globally. Streaming on Prime Video.', poster_path: null, backdrop_path: null, industry: 'Bollywood', platform: 'Prime Video', watchUrl: 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=Farzi', original_language: 'hi' },
        // --- HOLLYWOOD ---
        { id: 'ns-h01', title: 'Dune: Prophecy Season 2', release_date: '2026-09-12', overview: 'The epic prequel series expands the Dune universe. Streaming on JioCinema.', poster_path: null, backdrop_path: null, industry: 'Hollywood', platform: 'JioCinema', watchUrl: 'https://www.jiocinema.com/search/Dune', original_language: 'en' },
        { id: 'ns-h02', title: 'The Bear Season 4', release_date: '2026-09-18', overview: 'Carmy and the team face new challenges at the restaurant. Streaming on Hotstar.', poster_path: null, backdrop_path: null, industry: 'Hollywood', platform: 'Hotstar', watchUrl: 'https://www.hotstar.com/in/explore?search_query=The%20Bear', original_language: 'en' },
      ],
    };
  }
}
