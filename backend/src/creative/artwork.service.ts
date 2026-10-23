import { Injectable, Logger } from '@nestjs/common';
import { TmdbProvider } from '../research/providers/tmdb.provider';
import axios from 'axios';

// ====================================================
// CORE DOMAIN MODELS
// ====================================================

export interface ArtworkCandidate {
  id: string;
  movieId: string;
  imageUrl: string;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: string;
  width: number;
  height: number;
  aspectRatio: number;
  imageType: string;
  confidenceScore: number;
  qualityScore: number;
  isOfficial: boolean;
  isDuplicate: boolean;
  verificationStatus: 'VERIFIED' | 'NEEDS_VERIFICATION' | 'REJECTED';
  candidateTitle?: string;
  candidateYear?: number;
  entityType?: string;
}

// ====================================================
// SEARCH PROVIDER ABSTRACTION
// ====================================================

export interface ImageSearchProvider {
  search(query: string, limit?: number): Promise<Partial<ArtworkCandidate>[]>;
}

// ====================================================
// MOVIE IDENTITY & TITLE VERIFIER
// ====================================================

export class MovieIdentityVerifier {
  static normalizeTitle(title: string): string {
    if (!title) return '';
    return title
      .toLowerCase()
      // Map Roman numerals at word boundaries:
      .replace(/\bvi\b/g, '6')
      .replace(/\bv\b/g, '5')
      .replace(/\biv\b/g, '4')
      .replace(/\biii\b/g, '3')
      .replace(/\bii\b/g, '2')
      .replace(/\bi\b/g, '1')
      // Separate numbers from words: e.g. "jailer2" -> "jailer 2"
      .replace(/([a-z])(\d)/g, '$1 $2')
      .replace(/(\d)([a-z])/g, '$1 $2')
      // Clean punctuation except periods in decimals
      .replace(/[^\w\s.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static extractNumbers(normalized: string): string[] {
    const tokens = normalized.split(' ');
    const numbers: string[] = [];
    for (const t of tokens) {
      if (/^\d+(\.\d+)?$/.test(t)) {
        numbers.push(t);
      }
    }
    return numbers;
  }

  static extractCoreWords(normalized: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'film', 'movie', 'part', 'chapter', 'season', 'series']);
    return normalized
      .split(' ')
      .filter(w => w.length > 0 && !stopWords.has(w) && !/^\d+(\.\d+)?$/.test(w));
  }

  static checkDirectMatch(normExpected: string, normCandidate: string): boolean {
    if (normExpected === normCandidate) return true;

    const expectedNums = this.extractNumbers(normExpected);
    const candidateNums = this.extractNumbers(normCandidate);

    // 1. Strict Sequel Number Check:
    if (expectedNums.length > 0) {
      if (candidateNums.length === 0) return false;
      const primaryExpNum = expectedNums[0];
      if (!candidateNums.includes(primaryExpNum)) return false;
      // Disallow decimal variation mismatch e.g. 2.0 vs 2
      if (primaryExpNum === '2' && candidateNums.includes('2.0')) return false;
    } else {
      // Expected title has NO numbers, candidate must NOT be a sequel (e.g. Jailer 2 for Jailer)
      if (candidateNums.length > 0) return false;
    }

    const expectedWords = this.extractCoreWords(normExpected);
    const candidateWords = this.extractCoreWords(normCandidate);

    if (expectedWords.length === 0 || candidateWords.length === 0) return false;

    // Single-word expected core (e.g. 'jailer' or 'toxic'):
    if (expectedWords.length === 1) {
      return candidateWords[0] === expectedWords[0];
    }

    // First core word must match
    if (expectedWords[0] !== candidateWords[0]) return false;

    const candidateSet = new Set(candidateWords);
    const expectedSet = new Set(expectedWords);

    const expectedInCandidate = expectedWords.every(w => candidateSet.has(w));
    const candidateInExpected = candidateWords.every(w => expectedSet.has(w));

    if (expectedInCandidate || candidateInExpected) return true;

    const matchCount = expectedWords.filter(w => candidateSet.has(w)).length;
    const similarity = matchCount / Math.min(expectedWords.length, candidateWords.length);
    return similarity >= 0.75;
  }

  static isTitleMatch(expectedTitle: string, candidateTitle: string): boolean {
    if (!expectedTitle || !candidateTitle) return false;

    const rawExp = expectedTitle.trim().toLowerCase();
    const rawCand = candidateTitle.trim().toLowerCase();
    if (rawExp === rawCand) return true;

    const getBase = (t: string) => t.split(/[:–—\-]/)[0].trim();

    const expFull = this.normalizeTitle(expectedTitle);
    const candFull = this.normalizeTitle(candidateTitle);
    const expBase = this.normalizeTitle(getBase(expectedTitle));
    const candBase = this.normalizeTitle(getBase(candidateTitle));

    return (
      this.checkDirectMatch(expFull, candFull) ||
      this.checkDirectMatch(expBase, candFull) ||
      this.checkDirectMatch(expFull, candBase) ||
      this.checkDirectMatch(expBase, candBase)
    );
  }

  static verifyCandidate(
    candidate: ArtworkCandidate, 
    expectedTitle: string, 
    movieData: any = {}
  ): { verified: boolean; reason: string } {
    // TMDB official artwork associated directly with this TMDB movie ID is verified
    if (candidate.sourceDomain === 'tmdb.org' && candidate.isOfficial) {
      return { verified: true, reason: 'TMDB Official Asset' };
    }

    // Candidate title is strictly required for web discovery validation
    const titleToTest = candidate.candidateTitle;
    if (!titleToTest) {
      return { verified: false, reason: 'Missing candidate title' };
    }

    // Entity type verification (reject persons, podcasts, games, etc.)
    if (candidate.entityType) {
      const type = candidate.entityType.toLowerCase();
      if (
        type.includes('person') || 
        type.includes('actor') || 
        type.includes('podcast') || 
        type.includes('game') || 
        type.includes('music') ||
        type.includes('audio')
      ) {
        return { verified: false, reason: `Disallowed entity type: ${candidate.entityType}` };
      }
    }

    // Check against expected title
    let matches = this.isTitleMatch(expectedTitle, titleToTest);

    // If not matched, check authorized alternate / localized titles
    if (!matches && movieData) {
      const alternates: string[] = [
        movieData.original_title,
        movieData.originalTitle,
        ...(Array.isArray(movieData.alternateTitles) ? movieData.alternateTitles : []),
        ...(Array.isArray(movieData.aliases) ? movieData.aliases : [])
      ].filter(Boolean);

      for (const alt of alternates) {
        if (this.isTitleMatch(alt, titleToTest)) {
          matches = true;
          break;
        }
      }
    }

    if (!matches) {
      return { verified: false, reason: `Title mismatch: "${titleToTest}" does not match "${expectedTitle}"` };
    }

    // Release year validation if both are present
    const rawExpectedYear = 
      movieData?.releaseYear || 
      movieData?.year || 
      (movieData?.release_date ? parseInt(String(movieData.release_date).substring(0, 4)) : null) ||
      (movieData?.theatricalRelease ? parseInt(String(movieData.theatricalRelease).substring(0, 4)) : null) ||
      (movieData?.theatricalDate ? parseInt(String(movieData.theatricalDate).substring(0, 4)) : null) ||
      (movieData?.ottRelease ? parseInt(String(movieData.ottRelease).substring(0, 4)) : null) ||
      (movieData?.releaseDate ? parseInt(String(movieData.releaseDate).substring(0, 4)) : null);
    const expectedYear = rawExpectedYear ? Number(rawExpectedYear) : null;
    if (expectedYear && candidate.candidateYear) {
      const diff = Math.abs(expectedYear - candidate.candidateYear);
      if (diff > 2) {
        return { verified: false, reason: `Year mismatch: expected ~${expectedYear}, candidate is ${candidate.candidateYear}` };
      }
    }

    return { verified: true, reason: 'Web Candidate Identity Verified' };
  }
}

// ====================================================
// WIKIPEDIA IMAGE SEARCH PROVIDER
// ====================================================

@Injectable()
export class WikipediaImageSearchProvider implements ImageSearchProvider {
  /**
   * Strips Wikipedia disambiguation parentheticals before title matching.
   * e.g. "Jailer (2023 Tamil film)" → "Jailer"
   *      "Drishyam (film)" → "Drishyam"
   */
  static normalizeWikiTitle(pageTitle: string): string {
    return pageTitle
      .replace(/\s*\([^)]*(?:film|movie|series|show|\d{4})[^)]*\)/gi, '')
      .trim();
  }

  async search(query: string, limit: number = 2): Promise<Partial<ArtworkCandidate>[]> {
     const results: Partial<ArtworkCandidate>[] = [];
     try {
       const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=2`;
       const searchRes = await axios.get(searchUrl, { timeout: 5000 });
       const searchHits = searchRes.data?.query?.search;
       if (!searchHits || searchHits.length === 0) return [];
       
       for (const hit of searchHits.slice(0, limit)) {
         const pageTitle = hit.title;
         // Normalize Wikipedia title — strip parenthetical suffixes for identity matching
         const normalizedCandidateTitle = WikipediaImageSearchProvider.normalizeWikiTitle(pageTitle);
         
         const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&titles=${encodeURIComponent(pageTitle)}&pithumbsize=1000&format=json`;
         const imgRes = await axios.get(imgUrl, { timeout: 5000 });
         const pages = imgRes.data?.query?.pages;
         if (!pages) continue;
         
         const pageId = Object.keys(pages)[0];
         const page = pages[pageId];
         
         if (page.thumbnail?.source) {
            results.push({
               id: `wiki_${page.pageid}`,
               imageUrl: page.thumbnail.source,
               sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
               sourceDomain: 'wikipedia.org',
               sourceType: 'Wikipedia',
               width: page.thumbnail.width || 800,
               height: page.thumbnail.height || 1200,
               aspectRatio: page.thumbnail.width && page.thumbnail.height ? page.thumbnail.width / page.thumbnail.height : 0.66,
               imageType: 'poster',
               isOfficial: false,
               // Use the normalized title (without parentheticals) for identity matching
               candidateTitle: normalizedCandidateTitle || pageTitle,
               entityType: 'wikipedia_article'
            });
         }
       }
     } catch (e) {
        // Silently fail
     }
     
     return results;
  }
}

// ====================================================
// IMDB IMAGE SEARCH PROVIDER
// ====================================================

@Injectable()
export class ImdbImageSearchProvider implements ImageSearchProvider {
  async search(query: string, limit: number = 5): Promise<Partial<ArtworkCandidate>[]> {
     const results: Partial<ArtworkCandidate>[] = [];
     try {
       const firstLetter = query.trim().charAt(0).toLowerCase();
       if (!firstLetter.match(/[a-z0-9]/)) return [];
       
       const searchUrl = `https://v3.sg.media-imdb.com/suggestion/${firstLetter}/${encodeURIComponent(query)}.json`;
       const searchRes = await axios.get(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 5000
       });
       
       if (!searchRes.data?.d) return [];
       
       for (const hit of searchRes.data.d) {
          const qid = (hit.qid || '').toLowerCase();
          const q = (hit.q || '').toLowerCase();

          // Reject disallowed entity types: persons, actors, podcasts, games
          const isDisallowed = 
            qid === 'person' || 
            qid === 'podcastseries' || 
            qid === 'podcastepisode' || 
            qid === 'videogame' ||
            q.includes('podcast') ||
            q.includes('game') ||
            hit.vt === 1;

          if (isDisallowed) continue;

          // Accept only verified movies or TV series
          const isAllowedEntity = 
            qid === 'movie' || 
            qid === 'tvseries' || 
            qid === 'tvminiseries' || 
            qid === 'tvmovie' || 
            q.includes('feature') || 
            q.includes('tv series') || 
            q.includes('tv movie') || 
            q.includes('tv mini-series');

          if (!isAllowedEntity) continue;

          if (hit.i && hit.i.imageUrl) {
             let highResUrl = hit.i.imageUrl;
             highResUrl = highResUrl.replace(/_V1_.*\.jpg$/, '_V1_.jpg');
             
             results.push({
                id: `imdb_${hit.id}`,
                imageUrl: highResUrl,
                sourceUrl: `https://www.imdb.com/title/${hit.id}/`,
                sourceDomain: 'imdb.com',
                sourceType: 'IMDb',
                width: hit.i.width || 1000,
                height: hit.i.height || 1500,
                aspectRatio: hit.i.width && hit.i.height ? hit.i.width / hit.i.height : 0.66,
                imageType: 'poster',
                isOfficial: false, // Never automatically mark IMDb images as official
                candidateTitle: hit.l,
                candidateYear: hit.y,
                entityType: hit.qid || hit.q
             });
          }
       }
     } catch (e) {
        // Silently fail
     }
     
     return results.slice(0, limit);
  }
}

// ====================================================
// WEB ARTWORK DISCOVERY SERVICE
// ====================================================

@Injectable()
export class WebArtworkDiscoveryService {
  private readonly logger = new Logger(WebArtworkDiscoveryService.name);

  constructor(
    private wikiSearchProvider: WikipediaImageSearchProvider,
    private imdbSearchProvider: ImdbImageSearchProvider
  ) {}

  async findMovieArtwork(movie: any, canonicalMovieId: string): Promise<ArtworkCandidate[]> {
    this.logger.log(`Starting Web Artwork Discovery for: ${movie.title}`);
    
    const cleanTitle = movie.title ? movie.title.trim() : '';
    if (!cleanTitle) return [];

    const baseTitle = cleanTitle.split(/[:–—\-]/)[0].trim();

    const rawYear = 
      movie.releaseYear || 
      movie.year || 
      (movie.release_date ? String(movie.release_date).substring(0, 4) : null) ||
      (movie.theatricalRelease ? String(movie.theatricalRelease).substring(0, 4) : null) ||
      (movie.theatricalDate ? String(movie.theatricalDate).substring(0, 4) : null) ||
      (movie.ottRelease ? String(movie.ottRelease).substring(0, 4) : null) ||
      (movie.releaseDate ? String(movie.releaseDate).substring(0, 4) : null);
    const year = rawYear ? String(rawYear) : '';

    const queries: string[] = [cleanTitle];
    if (baseTitle && baseTitle !== cleanTitle) {
      queries.push(baseTitle);
    }

    if (year) {
      queries.push(`${cleanTitle} (${year} film)`);
      if (baseTitle && baseTitle !== cleanTitle) {
        queries.push(`${baseTitle} (${year} film)`);
      }
    } else {
      queries.push(`${cleanTitle} film`);
    }

    const allCandidates: ArtworkCandidate[] = [];
    const seenCandidateIds = new Set<string>();

    const addCandidate = (res: Partial<ArtworkCandidate>) => {
      if (!res.id || seenCandidateIds.has(res.id)) return;
      seenCandidateIds.add(res.id);
      allCandidates.push({
        id: res.id,
        movieId: canonicalMovieId,
        imageUrl: res.imageUrl!,
        sourceUrl: res.sourceUrl!,
        sourceDomain: res.sourceDomain!,
        sourceType: res.sourceType!,
        width: res.width!,
        height: res.height!,
        aspectRatio: res.aspectRatio!,
        imageType: res.imageType!,
        confidenceScore: 0,
        qualityScore: 0,
        isOfficial: false,
        isDuplicate: false,
        verificationStatus: 'NEEDS_VERIFICATION',
        candidateTitle: res.candidateTitle,
        candidateYear: res.candidateYear,
        entityType: res.entityType
      });
    };

    // 1. IMDB: Query cleanTitle AND baseTitle
    const imdbQueries = Array.from(new Set([cleanTitle, baseTitle].filter(Boolean)));
    for (const q of imdbQueries) {
      const imdbResults = await this.imdbSearchProvider.search(q, 5);
      for (const res of imdbResults) {
        addCandidate(res);
      }
    }

    // 2. Wikipedia (Fallback)
    for (const q of queries) {
      const wikiResults = await this.wikiSearchProvider.search(q, 2);
      for (const res of wikiResults) {
        addCandidate(res);
      }
    }
    
    return allCandidates;
  }
}

// ====================================================
// MAIN MOVIE ARTWORK SERVICE (ORCHESTRATOR)
// ====================================================

@Injectable()
export class MovieArtworkService {
  private readonly logger = new Logger(MovieArtworkService.name);
  
  private cache = new Map<string, {
    candidates: ArtworkCandidate[],
    lastChecked: number
  }>();

  constructor(
    private tmdbProvider: TmdbProvider,
    private webDiscoveryService: WebArtworkDiscoveryService
  ) {}

  async discoverArtwork(
    canonicalMovieId: string, 
    tmdbId: string | number, 
    title: string, 
    fullMovieObj: any = {}, 
    forceDeepSearch: boolean = false
  ): Promise<{
    status: 'FOUND' | 'NO_VERIFIED_ARTWORK',
    candidates: ArtworkCandidate[],
    totalCandidates: number,
    verifiedCandidates: number,
    debugInfo: any
  }> {
    const cached = this.cache.get(String(canonicalMovieId));
    if (!forceDeepSearch && cached && cached.candidates.length > 0 && (Date.now() - cached.lastChecked < 1000 * 60 * 60 * 24)) {
      return this.buildResponse(cached.candidates);
    }

    let allCandidates: ArtworkCandidate[] = [];
    const debugInfo = { tmdbCount: 0, webCount: 0, duplicatesRemoved: 0, rejected: 0, verified: 0 };

    // 0. API RESPONSE PRIMARY ARTWORK
    if (fullMovieObj.posterPath || fullMovieObj.poster_path) {
      const pPath = fullMovieObj.posterPath || fullMovieObj.poster_path;
      if (typeof pPath === 'string' && pPath.trim() !== '') {
        allCandidates.push(this.createCandidate({
           id: `primary_poster_${pPath}`,
           movieId: canonicalMovieId,
           imageUrl: `https://image.tmdb.org/t/p/original${pPath}`,
           sourceUrl: `https://themoviedb.org/movie/${tmdbId}`,
           sourceDomain: 'tmdb.org',
           sourceType: 'API Primary',
           width: 1000,
           height: 1500,
           aspectRatio: 0.66,
           imageType: 'poster',
           isOfficial: true,
           verificationStatus: 'VERIFIED',
           qualityScore: 100,
           candidateTitle: title
        }));
        debugInfo.tmdbCount++;
      }
    }

    if (fullMovieObj.backdropPath || fullMovieObj.backdrop_path) {
      const bPath = fullMovieObj.backdropPath || fullMovieObj.backdrop_path;
      if (typeof bPath === 'string' && bPath.trim() !== '') {
        allCandidates.push(this.createCandidate({
           id: `primary_backdrop_${bPath}`,
           movieId: canonicalMovieId,
           imageUrl: `https://image.tmdb.org/t/p/original${bPath}`,
           sourceUrl: `https://themoviedb.org/movie/${tmdbId}`,
           sourceDomain: 'tmdb.org',
           sourceType: 'API Primary',
           width: 1920,
           height: 1080,
           aspectRatio: 1.77,
           imageType: 'backdrop',
           isOfficial: true,
           verificationStatus: 'VERIFIED',
           qualityScore: 90,
           candidateTitle: title
        }));
      }
    }

    // 1. TMDB DISCOVERY
    try {
      const isNumericId = !isNaN(Number(tmdbId)) && !String(tmdbId).startsWith('mock-');
      if (isNumericId) {
        const tmdbImages = await this.tmdbProvider.getMovieImages(tmdbId);
        if (tmdbImages && tmdbImages.posters && tmdbImages.posters.length > 0) {
          tmdbImages.posters.forEach((p: any) => {
            if (p.file_path && typeof p.file_path === 'string' && p.file_path.trim() !== '') {
              allCandidates.push(this.createCandidate({
                id: `tmdb_${p.file_path}`,
                movieId: canonicalMovieId,
                imageUrl: `https://image.tmdb.org/t/p/original${p.file_path}`,
                sourceUrl: `https://themoviedb.org/movie/${tmdbId}`,
                sourceDomain: 'tmdb.org',
                sourceType: 'TMDB verified',
                width: p.width || 1000,
                height: p.height || 1500,
                aspectRatio: p.aspect_ratio || 0.66,
                imageType: 'poster',
                isOfficial: true,
                language: p.iso_639_1,
                voteAverage: p.vote_average,
                voteCount: p.vote_count,
                candidateTitle: title
              }));
              debugInfo.tmdbCount++;
            }
          });
        }
      }

      // If no TMDB posters were found yet, try searching TMDB by title (for curated or non-numeric IDs)
      const currentTmdbPosters = allCandidates.filter(c => c.sourceDomain === 'tmdb.org' && c.imageType === 'poster');
      if (currentTmdbPosters.length === 0) {
        const cleanTitle = title ? title.trim() : '';
        const baseTitle = cleanTitle.split(/[:–—\-]/)[0].trim();
        const rawYear = 
          fullMovieObj?.releaseYear || 
          fullMovieObj?.year || 
          (fullMovieObj?.release_date ? parseInt(String(fullMovieObj.release_date).substring(0, 4)) : null);
        const searchYear = rawYear ? Number(rawYear) : undefined;

        let searchHits = await this.tmdbProvider.searchMovie(cleanTitle, searchYear);
        if ((!searchHits || searchHits.length === 0) && baseTitle !== cleanTitle) {
          searchHits = await this.tmdbProvider.searchMovie(baseTitle, searchYear);
        }

        if (searchHits && searchHits.length > 0) {
          const MAX_TMDB_GALLERY_POSTERS = 30;

          for (const hit of searchHits.slice(0, 3)) {
            const matches = MovieIdentityVerifier.isTitleMatch(title, hit.title) || 
                            (hit.original_title && MovieIdentityVerifier.isTitleMatch(title, hit.original_title));
            if (!matches) continue;

            // LEAK 4 FIX: Guard against same-title different-year TMDB hit flooding gallery.
            // If we have an expected year AND the hit's release year is significantly off, skip.
            if (searchYear && hit.release_date) {
              const hitYear = parseInt(String(hit.release_date).substring(0, 4));
              if (!isNaN(hitYear) && Math.abs(hitYear - searchYear) > 2) {
                this.logger.warn(`TMDB title-search skipping "${hit.title}" (${hitYear}) — year mismatch with expected ${searchYear}`);
                continue;
              }
            }

            if (hit.poster_path) {
              allCandidates.push(this.createCandidate({
                id: `tmdb_${hit.poster_path}`,
                movieId: canonicalMovieId,
                imageUrl: `https://image.tmdb.org/t/p/original${hit.poster_path}`,
                sourceUrl: `https://themoviedb.org/movie/${hit.id}`,
                sourceDomain: 'tmdb.org',
                sourceType: 'TMDB verified',
                width: 1000,
                height: 1500,
                aspectRatio: 0.66,
                imageType: 'poster',
                isOfficial: true,
                candidateTitle: hit.title
              }));
              debugInfo.tmdbCount++;
            }

            // Fetch gallery for this matching TMDB movie, capped at MAX_TMDB_GALLERY_POSTERS
            const realTmdbImages = await this.tmdbProvider.getMovieImages(hit.id);
            if (realTmdbImages?.posters?.length > 0) {
              realTmdbImages.posters.slice(0, MAX_TMDB_GALLERY_POSTERS).forEach((p: any) => {
                if (p.file_path && typeof p.file_path === 'string' && p.file_path.trim() !== '') {
                  allCandidates.push(this.createCandidate({
                    id: `tmdb_${p.file_path}`,
                    movieId: canonicalMovieId,
                    imageUrl: `https://image.tmdb.org/t/p/original${p.file_path}`,
                    sourceUrl: `https://themoviedb.org/movie/${hit.id}`,
                    sourceDomain: 'tmdb.org',
                    sourceType: 'TMDB verified',
                    width: p.width || 1000,
                    height: p.height || 1500,
                    aspectRatio: p.aspect_ratio || 0.66,
                    imageType: 'poster',
                    isOfficial: true,
                    language: p.iso_639_1,
                    voteAverage: p.vote_average,
                    voteCount: p.vote_count,
                    candidateTitle: hit.title
                  }));
                  debugInfo.tmdbCount++;
                }
              });
            }

            // Capture alias/original title on movie object to help alternate validation
            if (hit.original_title && !fullMovieObj.original_title) {
              fullMovieObj.original_title = hit.original_title;
            }

            break;
          }
        }
      }
    } catch (e) {
      this.logger.warn(`TMDB Discovery failed for ${title}`);
    }

    // Usable matching TMDB artwork: must have valid image URL, non-zero dimensions, and poster format
    const usableTmdbCandidates = allCandidates.filter(c => 
      c.sourceDomain === 'tmdb.org' && 
      c.imageUrl && 
      typeof c.imageUrl === 'string' &&
      c.imageUrl.startsWith('https://image.tmdb.org/t/p/') &&
      c.width > 0 && 
      c.height > 0
    );

    // 2. WEB DISCOVERY FALLBACK
    // Only invoke web discovery if there is ZERO usable matching TMDB artwork (or forceDeepSearch)
    if (usableTmdbCandidates.length === 0 || forceDeepSearch) {
       const webCandidates = await this.webDiscoveryService.findMovieArtwork(
         fullMovieObj.title ? fullMovieObj : { title, ...fullMovieObj }, 
         canonicalMovieId
       );
       allCandidates.push(...webCandidates);
       debugInfo.webCount = webCandidates.length;
    }

    // 3. VERIFY & SCORE (Strict Identity & Entity Check First)
    allCandidates = allCandidates.map(c => this.verifyAndScore(c, title, fullMovieObj));

    // 4. DEEP DEDUPLICATION & VALIDATION
    // LEAK 5 FIX: Process HEAD requests in batches of 5 (semaphore) to prevent
    // 200 concurrent network requests for popular movies with large galleries.
    const CONCURRENCY_LIMIT = 5;
    const uniqueCandidates: ArtworkCandidate[] = [];
    const seenUrls = new Set<string>();

    // First pass: URL-based dedup (synchronous, no network needed)
    const urlDedupedCandidates: ArtworkCandidate[] = [];
    for (const c of allCandidates) {
      if (c.verificationStatus === 'REJECTED') {
        debugInfo.rejected++;
        continue;
      }
      const normalizedUrl = c.imageUrl.split('?')[0].replace('https://', '').replace('http://', '').toLowerCase();
      if (seenUrls.has(normalizedUrl)) {
        c.isDuplicate = true;
        debugInfo.duplicatesRemoved++;
        continue;
      }
      seenUrls.add(normalizedUrl);
      urlDedupedCandidates.push(c);
    }

    // Second pass: HEAD validation with concurrency cap (LEAK 5 FIX)
    const validateBatch = async (batch: ArtworkCandidate[]): Promise<void> => {
      await Promise.all(batch.map(async (c) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const headRes = await fetch(c.imageUrl, { method: 'HEAD', signal: controller.signal });
          clearTimeout(timeoutId);

          if (headRes.status === 404) {
            c.verificationStatus = 'REJECTED';
            debugInfo.rejected++;
          } else {
            // LEAK 2 FIX: Content-length hash removed — URL dedup already covers true duplicates.
            // Content-length alone is not a reliable proxy for image identity.
            c.isDuplicate = false;
            uniqueCandidates.push(c);
          }
        } catch (e) {
          // Network failure or timeout:
          // For TMDB official assets or strictly verified IMDb candidates, do not reject solely due to timeout
          if ((c.sourceDomain === 'tmdb.org' && c.isOfficial) || (c.sourceDomain === 'imdb.com' && c.verificationStatus === 'VERIFIED')) {
            c.isDuplicate = false;
            uniqueCandidates.push(c);
          } else {
            c.verificationStatus = 'REJECTED';
            debugInfo.rejected++;
          }
        }
      }));
    };

    for (let i = 0; i < urlDedupedCandidates.length; i += CONCURRENCY_LIMIT) {
      await validateBatch(urlDedupedCandidates.slice(i, i + CONCURRENCY_LIMIT));
    }

    // 5. FILTER REJECTED (Only strictly VERIFIED candidates can reach the gallery)
    const finalCandidates = uniqueCandidates.filter(c => {
       if (c.verificationStatus === 'VERIFIED') {
          debugInfo.verified++;
          return true;
       }
       debugInfo.rejected++;
       return false;
    });

    // 6. RANK BY SCORE DESC
    finalCandidates.sort((a, b) => b.qualityScore - a.qualityScore);

    if (finalCandidates.length > 0) {
      this.cache.set(String(canonicalMovieId), {
        candidates: finalCandidates,
        lastChecked: Date.now()
      });
    }

    // Logging
    const topSelected = finalCandidates.length > 0 ? finalCandidates[0] : null;
    this.logger.log(`\n=== ARTWORK DISCOVERY ===\n` + 
      `Movie: ${title}\n` +
      `TMDB usable posters: ${usableTmdbCandidates.length}\n` + 
      `Web queries executed: ${debugInfo.webCount > 0 ? 'Yes' : 'No'}\n` +
      `Candidates found: ${allCandidates.length}\n` +
      `Duplicates: ${debugInfo.duplicatesRemoved}\n` +
      `Rejected: ${debugInfo.rejected}\n` +
      `Verified: ${debugInfo.verified}\n` +
      `Selected: ${topSelected ? topSelected.sourceUrl : 'None'}\n` +
      `Resolution: ${topSelected ? `${topSelected.width}x${topSelected.height}` : 'N/A'}\n` +
      `=========================`
    );

    return this.buildResponse(finalCandidates, debugInfo);
  }

  private buildResponse(candidates: ArtworkCandidate[], debugInfo: any = null): {
    status: 'FOUND' | 'NO_VERIFIED_ARTWORK',
    candidates: ArtworkCandidate[],
    totalCandidates: number,
    verifiedCandidates: number,
    debugInfo: any
  } {
    const verified = candidates.filter(c => c.verificationStatus === 'VERIFIED');
    return {
      status: verified.length > 0 ? 'FOUND' : 'NO_VERIFIED_ARTWORK',
      candidates: verified,
      totalCandidates: verified.length,
      verifiedCandidates: verified.length,
      debugInfo: debugInfo || { 
        tmdbCount: verified.filter(c => c.sourceDomain === 'tmdb.org').length,
        webCount: verified.length - verified.filter(c => c.sourceDomain === 'tmdb.org').length,
        duplicatesRemoved: 0, 
        rejected: 0, 
        verified: verified.length 
      }
    };
  }

  private createCandidate(raw: any): ArtworkCandidate {
    return {
      id: raw.id,
      movieId: raw.movieId,
      imageUrl: raw.imageUrl,
      sourceUrl: raw.sourceUrl,
      sourceDomain: raw.sourceDomain,
      sourceType: raw.sourceType,
      width: raw.width,
      height: raw.height,
      aspectRatio: raw.aspectRatio,
      imageType: raw.imageType,
      confidenceScore: 0,
      qualityScore: 0,
      isOfficial: raw.isOfficial,
      isDuplicate: false,
      verificationStatus: 'NEEDS_VERIFICATION',
      ...raw
    };
  }

  private verifyAndScore(c: ArtworkCandidate, movieTitle: string, fullMovieObj: any = {}): ArtworkCandidate {
    // 1. Strict Identity Check: Mismatched candidates are immediately REJECTED with qualityScore = 0
    const identityCheck = MovieIdentityVerifier.verifyCandidate(c, movieTitle, fullMovieObj);

    if (!identityCheck.verified) {
      c.verificationStatus = 'REJECTED';
      c.qualityScore = 0;
      c.confidenceScore = 0;
      return c;
    }

    // 2. Score only candidates that passed strict identity verification
    let sourceReliability = 0;
    let movieMatchConfidence = 0;
    let resolutionScore = 0;
    let posterAspectScore = 0;
    let officialArtworkScore = c.isOfficial ? 20 : 0;

    // Source Priority
    if (c.sourceDomain === 'tmdb.org') {
      sourceReliability = 25;
      movieMatchConfidence = 35;
    } else if (c.sourceDomain === 'imdb.com') {
      sourceReliability = 15;
      movieMatchConfidence = 20;
    } else if (['pinterest.com', 'reddit.com'].includes(c.sourceDomain)) {
      sourceReliability = -10;
      movieMatchConfidence = 10;
    } else {
      sourceReliability = 10;
      movieMatchConfidence = 15;
    }

    // HD Resolution Requirement
    if (c.width < 1000 && c.sourceDomain !== 'tmdb.org') {
      resolutionScore = -20;
      if (c.width < 500) resolutionScore = -50; 
    } else if (c.width >= 1500) {
      resolutionScore = 20;
    } else {
      resolutionScore = 10;
    }

    // Aspect Ratio (Portrait)
    if (c.aspectRatio >= 0.6 && c.aspectRatio <= 0.8) {
      posterAspectScore = 15;
    }

    const totalScore = sourceReliability + movieMatchConfidence + resolutionScore + posterAspectScore + officialArtworkScore;
    
    c.qualityScore = Math.max(0, totalScore);
    c.confidenceScore = movieMatchConfidence;

    // Explicit Verification Threshold: Even if score is high, minimum width required
    if (c.width < 500 || totalScore < 20) {
       c.verificationStatus = 'REJECTED';
    } else {
       c.verificationStatus = 'VERIFIED';
    }

    return c;
  }
}
