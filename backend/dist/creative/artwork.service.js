"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var WikipediaImageSearchProvider_1, WebArtworkDiscoveryService_1, MovieArtworkService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovieArtworkService = exports.WebArtworkDiscoveryService = exports.ImdbImageSearchProvider = exports.WikipediaImageSearchProvider = exports.MovieIdentityVerifier = void 0;
const common_1 = require("@nestjs/common");
const tmdb_provider_1 = require("../research/providers/tmdb.provider");
const axios_1 = __importDefault(require("axios"));
class MovieIdentityVerifier {
    static normalizeTitle(title) {
        if (!title)
            return '';
        return title
            .toLowerCase()
            .replace(/\bvi\b/g, '6')
            .replace(/\bv\b/g, '5')
            .replace(/\biv\b/g, '4')
            .replace(/\biii\b/g, '3')
            .replace(/\bii\b/g, '2')
            .replace(/\bi\b/g, '1')
            .replace(/([a-z])(\d)/g, '$1 $2')
            .replace(/(\d)([a-z])/g, '$1 $2')
            .replace(/[^\w\s.]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    static extractNumbers(normalized) {
        const tokens = normalized.split(' ');
        const numbers = [];
        for (const t of tokens) {
            if (/^\d+(\.\d+)?$/.test(t)) {
                numbers.push(t);
            }
        }
        return numbers;
    }
    static extractCoreWords(normalized) {
        const stopWords = new Set(['the', 'a', 'an', 'film', 'movie', 'part', 'chapter', 'season', 'series']);
        return normalized
            .split(' ')
            .filter(w => w.length > 0 && !stopWords.has(w) && !/^\d+(\.\d+)?$/.test(w));
    }
    static checkDirectMatch(normExpected, normCandidate) {
        if (normExpected === normCandidate)
            return true;
        const expectedNums = this.extractNumbers(normExpected);
        const candidateNums = this.extractNumbers(normCandidate);
        if (expectedNums.length > 0) {
            if (candidateNums.length === 0)
                return false;
            const primaryExpNum = expectedNums[0];
            if (!candidateNums.includes(primaryExpNum))
                return false;
            if (primaryExpNum === '2' && candidateNums.includes('2.0'))
                return false;
        }
        else {
            if (candidateNums.length > 0)
                return false;
        }
        const expectedWords = this.extractCoreWords(normExpected);
        const candidateWords = this.extractCoreWords(normCandidate);
        if (expectedWords.length === 0 || candidateWords.length === 0)
            return false;
        if (expectedWords.length === 1) {
            return candidateWords[0] === expectedWords[0];
        }
        if (expectedWords[0] !== candidateWords[0])
            return false;
        const candidateSet = new Set(candidateWords);
        const expectedSet = new Set(expectedWords);
        const expectedInCandidate = expectedWords.every(w => candidateSet.has(w));
        const candidateInExpected = candidateWords.every(w => expectedSet.has(w));
        if (expectedInCandidate || candidateInExpected)
            return true;
        const matchCount = expectedWords.filter(w => candidateSet.has(w)).length;
        const similarity = matchCount / Math.min(expectedWords.length, candidateWords.length);
        return similarity >= 0.75;
    }
    static isTitleMatch(expectedTitle, candidateTitle) {
        if (!expectedTitle || !candidateTitle)
            return false;
        const rawExp = expectedTitle.trim().toLowerCase();
        const rawCand = candidateTitle.trim().toLowerCase();
        if (rawExp === rawCand)
            return true;
        const getBase = (t) => t.split(/[:–—\-]/)[0].trim();
        const expFull = this.normalizeTitle(expectedTitle);
        const candFull = this.normalizeTitle(candidateTitle);
        const expBase = this.normalizeTitle(getBase(expectedTitle));
        const candBase = this.normalizeTitle(getBase(candidateTitle));
        return (this.checkDirectMatch(expFull, candFull) ||
            this.checkDirectMatch(expBase, candFull) ||
            this.checkDirectMatch(expFull, candBase) ||
            this.checkDirectMatch(expBase, candBase));
    }
    static verifyCandidate(candidate, expectedTitle, movieData = {}) {
        if (candidate.sourceDomain === 'tmdb.org' && candidate.isOfficial) {
            return { verified: true, reason: 'TMDB Official Asset' };
        }
        const titleToTest = candidate.candidateTitle;
        if (!titleToTest) {
            return { verified: false, reason: 'Missing candidate title' };
        }
        if (candidate.entityType) {
            const type = candidate.entityType.toLowerCase();
            if (type.includes('person') ||
                type.includes('actor') ||
                type.includes('podcast') ||
                type.includes('game') ||
                type.includes('music') ||
                type.includes('audio')) {
                return { verified: false, reason: `Disallowed entity type: ${candidate.entityType}` };
            }
        }
        let matches = this.isTitleMatch(expectedTitle, titleToTest);
        if (!matches && movieData) {
            const alternates = [
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
        const rawExpectedYear = movieData?.releaseYear ||
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
exports.MovieIdentityVerifier = MovieIdentityVerifier;
let WikipediaImageSearchProvider = WikipediaImageSearchProvider_1 = class WikipediaImageSearchProvider {
    static normalizeWikiTitle(pageTitle) {
        return pageTitle
            .replace(/\s*\([^)]*(?:film|movie|series|show|\d{4})[^)]*\)/gi, '')
            .trim();
    }
    async search(query, limit = 2) {
        const results = [];
        try {
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=2`;
            const searchRes = await axios_1.default.get(searchUrl, { timeout: 5000 });
            const searchHits = searchRes.data?.query?.search;
            if (!searchHits || searchHits.length === 0)
                return [];
            for (const hit of searchHits.slice(0, limit)) {
                const pageTitle = hit.title;
                const normalizedCandidateTitle = WikipediaImageSearchProvider_1.normalizeWikiTitle(pageTitle);
                const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&titles=${encodeURIComponent(pageTitle)}&pithumbsize=1000&format=json`;
                const imgRes = await axios_1.default.get(imgUrl, { timeout: 5000 });
                const pages = imgRes.data?.query?.pages;
                if (!pages)
                    continue;
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
                        candidateTitle: normalizedCandidateTitle || pageTitle,
                        entityType: 'wikipedia_article'
                    });
                }
            }
        }
        catch (e) {
        }
        return results;
    }
};
exports.WikipediaImageSearchProvider = WikipediaImageSearchProvider;
exports.WikipediaImageSearchProvider = WikipediaImageSearchProvider = WikipediaImageSearchProvider_1 = __decorate([
    (0, common_1.Injectable)()
], WikipediaImageSearchProvider);
let ImdbImageSearchProvider = class ImdbImageSearchProvider {
    async search(query, limit = 5) {
        const results = [];
        try {
            const firstLetter = query.trim().charAt(0).toLowerCase();
            if (!firstLetter.match(/[a-z0-9]/))
                return [];
            const searchUrl = `https://v3.sg.media-imdb.com/suggestion/${firstLetter}/${encodeURIComponent(query)}.json`;
            const searchRes = await axios_1.default.get(searchUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 5000
            });
            if (!searchRes.data?.d)
                return [];
            for (const hit of searchRes.data.d) {
                const qid = (hit.qid || '').toLowerCase();
                const q = (hit.q || '').toLowerCase();
                const isDisallowed = qid === 'person' ||
                    qid === 'podcastseries' ||
                    qid === 'podcastepisode' ||
                    qid === 'videogame' ||
                    q.includes('podcast') ||
                    q.includes('game') ||
                    hit.vt === 1;
                if (isDisallowed)
                    continue;
                const isAllowedEntity = qid === 'movie' ||
                    qid === 'tvseries' ||
                    qid === 'tvminiseries' ||
                    qid === 'tvmovie' ||
                    q.includes('feature') ||
                    q.includes('tv series') ||
                    q.includes('tv movie') ||
                    q.includes('tv mini-series');
                if (!isAllowedEntity)
                    continue;
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
                        isOfficial: false,
                        candidateTitle: hit.l,
                        candidateYear: hit.y,
                        entityType: hit.qid || hit.q
                    });
                }
            }
        }
        catch (e) {
        }
        return results.slice(0, limit);
    }
};
exports.ImdbImageSearchProvider = ImdbImageSearchProvider;
exports.ImdbImageSearchProvider = ImdbImageSearchProvider = __decorate([
    (0, common_1.Injectable)()
], ImdbImageSearchProvider);
let WebArtworkDiscoveryService = WebArtworkDiscoveryService_1 = class WebArtworkDiscoveryService {
    wikiSearchProvider;
    imdbSearchProvider;
    logger = new common_1.Logger(WebArtworkDiscoveryService_1.name);
    constructor(wikiSearchProvider, imdbSearchProvider) {
        this.wikiSearchProvider = wikiSearchProvider;
        this.imdbSearchProvider = imdbSearchProvider;
    }
    async findMovieArtwork(movie, canonicalMovieId) {
        this.logger.log(`Starting Web Artwork Discovery for: ${movie.title}`);
        const cleanTitle = movie.title ? movie.title.trim() : '';
        if (!cleanTitle)
            return [];
        const baseTitle = cleanTitle.split(/[:–—\-]/)[0].trim();
        const rawYear = movie.releaseYear ||
            movie.year ||
            (movie.release_date ? String(movie.release_date).substring(0, 4) : null) ||
            (movie.theatricalRelease ? String(movie.theatricalRelease).substring(0, 4) : null) ||
            (movie.theatricalDate ? String(movie.theatricalDate).substring(0, 4) : null) ||
            (movie.ottRelease ? String(movie.ottRelease).substring(0, 4) : null) ||
            (movie.releaseDate ? String(movie.releaseDate).substring(0, 4) : null);
        const year = rawYear ? String(rawYear) : '';
        const queries = [cleanTitle];
        if (baseTitle && baseTitle !== cleanTitle) {
            queries.push(baseTitle);
        }
        if (year) {
            queries.push(`${cleanTitle} (${year} film)`);
            if (baseTitle && baseTitle !== cleanTitle) {
                queries.push(`${baseTitle} (${year} film)`);
            }
        }
        else {
            queries.push(`${cleanTitle} film`);
        }
        const allCandidates = [];
        const seenCandidateIds = new Set();
        const addCandidate = (res) => {
            if (!res.id || seenCandidateIds.has(res.id))
                return;
            seenCandidateIds.add(res.id);
            allCandidates.push({
                id: res.id,
                movieId: canonicalMovieId,
                imageUrl: res.imageUrl,
                sourceUrl: res.sourceUrl,
                sourceDomain: res.sourceDomain,
                sourceType: res.sourceType,
                width: res.width,
                height: res.height,
                aspectRatio: res.aspectRatio,
                imageType: res.imageType,
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
        const imdbQueries = Array.from(new Set([cleanTitle, baseTitle].filter(Boolean)));
        for (const q of imdbQueries) {
            const imdbResults = await this.imdbSearchProvider.search(q, 5);
            for (const res of imdbResults) {
                addCandidate(res);
            }
        }
        for (const q of queries) {
            const wikiResults = await this.wikiSearchProvider.search(q, 2);
            for (const res of wikiResults) {
                addCandidate(res);
            }
        }
        return allCandidates;
    }
};
exports.WebArtworkDiscoveryService = WebArtworkDiscoveryService;
exports.WebArtworkDiscoveryService = WebArtworkDiscoveryService = WebArtworkDiscoveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [WikipediaImageSearchProvider,
        ImdbImageSearchProvider])
], WebArtworkDiscoveryService);
let MovieArtworkService = MovieArtworkService_1 = class MovieArtworkService {
    tmdbProvider;
    webDiscoveryService;
    logger = new common_1.Logger(MovieArtworkService_1.name);
    cache = new Map();
    constructor(tmdbProvider, webDiscoveryService) {
        this.tmdbProvider = tmdbProvider;
        this.webDiscoveryService = webDiscoveryService;
    }
    async discoverArtwork(canonicalMovieId, tmdbId, title, fullMovieObj = {}, forceDeepSearch = false) {
        const cached = this.cache.get(String(canonicalMovieId));
        if (!forceDeepSearch && cached && cached.candidates.length > 0 && (Date.now() - cached.lastChecked < 1000 * 60 * 60 * 24)) {
            return this.buildResponse(cached.candidates);
        }
        let allCandidates = [];
        const debugInfo = { tmdbCount: 0, webCount: 0, duplicatesRemoved: 0, rejected: 0, verified: 0 };
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
        try {
            const isNumericId = !isNaN(Number(tmdbId)) && !String(tmdbId).startsWith('mock-');
            if (isNumericId) {
                const tmdbImages = await this.tmdbProvider.getMovieImages(tmdbId);
                if (tmdbImages && tmdbImages.posters && tmdbImages.posters.length > 0) {
                    tmdbImages.posters.forEach((p) => {
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
            const currentTmdbPosters = allCandidates.filter(c => c.sourceDomain === 'tmdb.org' && c.imageType === 'poster');
            if (currentTmdbPosters.length === 0) {
                const cleanTitle = title ? title.trim() : '';
                const baseTitle = cleanTitle.split(/[:–—\-]/)[0].trim();
                const rawYear = fullMovieObj?.releaseYear ||
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
                        if (!matches)
                            continue;
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
                        const realTmdbImages = await this.tmdbProvider.getMovieImages(hit.id);
                        if (realTmdbImages?.posters?.length > 0) {
                            realTmdbImages.posters.slice(0, MAX_TMDB_GALLERY_POSTERS).forEach((p) => {
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
                        if (hit.original_title && !fullMovieObj.original_title) {
                            fullMovieObj.original_title = hit.original_title;
                        }
                        break;
                    }
                }
            }
        }
        catch (e) {
            this.logger.warn(`TMDB Discovery failed for ${title}`);
        }
        const usableTmdbCandidates = allCandidates.filter(c => c.sourceDomain === 'tmdb.org' &&
            c.imageUrl &&
            typeof c.imageUrl === 'string' &&
            c.imageUrl.startsWith('https://image.tmdb.org/t/p/') &&
            c.width > 0 &&
            c.height > 0);
        if (usableTmdbCandidates.length === 0 || forceDeepSearch) {
            const webCandidates = await this.webDiscoveryService.findMovieArtwork(fullMovieObj.title ? fullMovieObj : { title, ...fullMovieObj }, canonicalMovieId);
            allCandidates.push(...webCandidates);
            debugInfo.webCount = webCandidates.length;
        }
        allCandidates = allCandidates.map(c => this.verifyAndScore(c, title, fullMovieObj));
        const CONCURRENCY_LIMIT = 5;
        const uniqueCandidates = [];
        const seenUrls = new Set();
        const urlDedupedCandidates = [];
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
        const validateBatch = async (batch) => {
            await Promise.all(batch.map(async (c) => {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000);
                    const headRes = await fetch(c.imageUrl, { method: 'HEAD', signal: controller.signal });
                    clearTimeout(timeoutId);
                    if (headRes.status === 404) {
                        c.verificationStatus = 'REJECTED';
                        debugInfo.rejected++;
                    }
                    else {
                        c.isDuplicate = false;
                        uniqueCandidates.push(c);
                    }
                }
                catch (e) {
                    if ((c.sourceDomain === 'tmdb.org' && c.isOfficial) || (c.sourceDomain === 'imdb.com' && c.verificationStatus === 'VERIFIED')) {
                        c.isDuplicate = false;
                        uniqueCandidates.push(c);
                    }
                    else {
                        c.verificationStatus = 'REJECTED';
                        debugInfo.rejected++;
                    }
                }
            }));
        };
        for (let i = 0; i < urlDedupedCandidates.length; i += CONCURRENCY_LIMIT) {
            await validateBatch(urlDedupedCandidates.slice(i, i + CONCURRENCY_LIMIT));
        }
        const finalCandidates = uniqueCandidates.filter(c => {
            if (c.verificationStatus === 'VERIFIED') {
                debugInfo.verified++;
                return true;
            }
            debugInfo.rejected++;
            return false;
        });
        finalCandidates.sort((a, b) => b.qualityScore - a.qualityScore);
        if (finalCandidates.length > 0) {
            this.cache.set(String(canonicalMovieId), {
                candidates: finalCandidates,
                lastChecked: Date.now()
            });
        }
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
            `=========================`);
        return this.buildResponse(finalCandidates, debugInfo);
    }
    buildResponse(candidates, debugInfo = null) {
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
    createCandidate(raw) {
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
    verifyAndScore(c, movieTitle, fullMovieObj = {}) {
        const identityCheck = MovieIdentityVerifier.verifyCandidate(c, movieTitle, fullMovieObj);
        if (!identityCheck.verified) {
            c.verificationStatus = 'REJECTED';
            c.qualityScore = 0;
            c.confidenceScore = 0;
            return c;
        }
        let sourceReliability = 0;
        let movieMatchConfidence = 0;
        let resolutionScore = 0;
        let posterAspectScore = 0;
        let officialArtworkScore = c.isOfficial ? 20 : 0;
        if (c.sourceDomain === 'tmdb.org') {
            sourceReliability = 25;
            movieMatchConfidence = 35;
        }
        else if (c.sourceDomain === 'imdb.com') {
            sourceReliability = 15;
            movieMatchConfidence = 20;
        }
        else if (['pinterest.com', 'reddit.com'].includes(c.sourceDomain)) {
            sourceReliability = -10;
            movieMatchConfidence = 10;
        }
        else {
            sourceReliability = 10;
            movieMatchConfidence = 15;
        }
        if (c.width < 1000 && c.sourceDomain !== 'tmdb.org') {
            resolutionScore = -20;
            if (c.width < 500)
                resolutionScore = -50;
        }
        else if (c.width >= 1500) {
            resolutionScore = 20;
        }
        else {
            resolutionScore = 10;
        }
        if (c.aspectRatio >= 0.6 && c.aspectRatio <= 0.8) {
            posterAspectScore = 15;
        }
        const totalScore = sourceReliability + movieMatchConfidence + resolutionScore + posterAspectScore + officialArtworkScore;
        c.qualityScore = Math.max(0, totalScore);
        c.confidenceScore = movieMatchConfidence;
        if (c.width < 500 || totalScore < 20) {
            c.verificationStatus = 'REJECTED';
        }
        else {
            c.verificationStatus = 'VERIFIED';
        }
        return c;
    }
};
exports.MovieArtworkService = MovieArtworkService;
exports.MovieArtworkService = MovieArtworkService = MovieArtworkService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tmdb_provider_1.TmdbProvider,
        WebArtworkDiscoveryService])
], MovieArtworkService);
//# sourceMappingURL=artwork.service.js.map