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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ReleaseDiscoveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReleaseDiscoveryService = void 0;
const common_1 = require("@nestjs/common");
const tmdb_provider_1 = require("../providers/tmdb.provider");
const artwork_service_1 = require("../../creative/artwork.service");
const movie_classification_service_1 = require("./movie-classification.service");
const theatrical_validator_service_1 = require("./theatrical-validator.service");
let ReleaseDiscoveryService = ReleaseDiscoveryService_1 = class ReleaseDiscoveryService {
    tmdbProvider;
    artworkService;
    movieClassificationService;
    theatricalValidator;
    logger = new common_1.Logger(ReleaseDiscoveryService_1.name);
    cachedMasterList = null;
    cacheTimestamp = 0;
    constructor(tmdbProvider, artworkService, movieClassificationService, theatricalValidator) {
        this.tmdbProvider = tmdbProvider;
        this.artworkService = artworkService;
        this.movieClassificationService = movieClassificationService;
        this.theatricalValidator = theatricalValidator;
    }
    async discoverAll() {
        if (this.cachedMasterList && (Date.now() - this.cacheTimestamp < 1000 * 60 * 5)) {
            return this.formatResponse(this.cachedMasterList, { cached: true });
        }
        this.logger.log('Starting Multi-Source Release Discovery...');
        const tmdbResults = await this.tmdbProvider.discoverAllRaw();
        const mockJustWatchResults = [];
        const masterMap = new Map();
        const mergeMovie = (movie, sourceName) => {
            const key = movie.tmdbId ? `tmdb:${movie.tmdbId}` : `title:${movie.title?.toLowerCase().replace(/\s+/g, '')}:${movie.year}`;
            if (masterMap.has(key)) {
                const existing = masterMap.get(key);
                if (!existing.sources.includes(sourceName))
                    existing.sources.push(sourceName);
                if (!existing.theatricalRelease && movie.theatricalRelease)
                    existing.theatricalRelease = movie.theatricalRelease;
                if (!existing.ottRelease && movie.ottRelease)
                    existing.ottRelease = movie.ottRelease;
                if (movie.theatricalStatus && (!existing.theatricalStatus || existing.theatricalStatus === 'UNKNOWN')) {
                    existing.theatricalStatus = movie.theatricalStatus;
                }
                if (movie.ottDateConfirmed)
                    existing.ottDateConfirmed = true;
                if (movie.isDirectToOtt)
                    existing.isDirectToOtt = true;
                if (movie.primaryPlatform && !existing.primaryPlatform)
                    existing.primaryPlatform = movie.primaryPlatform;
                if (movie.watchUrl && !existing.watchUrl)
                    existing.watchUrl = movie.watchUrl;
                if (movie.streamingStatus && !existing.streamingStatus)
                    existing.streamingStatus = movie.streamingStatus;
                if (movie.ottPlatforms && movie.ottPlatforms.length > 0) {
                    existing.ottPlatforms = Array.from(new Set([...(existing.ottPlatforms || []), ...movie.ottPlatforms]));
                }
                if (movie.industries) {
                    existing.industries = Array.from(new Set([...existing.industries, ...movie.industries]));
                }
            }
            else {
                masterMap.set(key, {
                    canonicalId: key,
                    title: movie.title || 'Unknown Title',
                    year: movie.year || new Date().getFullYear(),
                    originalLanguage: movie.originalLanguage || 'en',
                    industries: movie.industries || [],
                    theatricalRelease: movie.theatricalRelease,
                    ottRelease: movie.ottRelease,
                    theatricalStatus: movie.theatricalStatus || 'UNKNOWN',
                    ottPlatforms: movie.ottPlatforms || [],
                    ottDateConfirmed: movie.ottDateConfirmed || false,
                    primaryPlatform: movie.primaryPlatform,
                    watchUrl: movie.watchUrl,
                    streamingStatus: movie.streamingStatus,
                    isDirectToOtt: movie.isDirectToOtt || false,
                    sources: [sourceName],
                    artworkStatus: 'DISCOVERY_RUNNING',
                    classification: movie.classification || 'UNCLASSIFIED',
                    tmdbId: movie.tmdbId,
                    overview: movie.overview,
                    popularity: movie.popularity,
                    posterPath: movie.posterPath,
                    backdropPath: movie.backdropPath
                });
            }
        };
        tmdbResults.results.forEach((m) => mergeMovie(m, 'TMDB'));
        mockJustWatchResults.forEach((m) => mergeMovie(m, 'JustWatch'));
        const masterList = Array.from(masterMap.values());
        for (const movie of masterList) {
            const rawTmdb = tmdbResults.rawMap.get(String(movie.tmdbId));
            if (rawTmdb?.poster_path) {
                movie.artworkStatus = 'READY';
                movie.posterPath = rawTmdb.poster_path;
            }
            else if (movie.posterPath) {
                movie.artworkStatus = 'READY';
            }
            else {
                movie.artworkStatus = 'ARTWORK_REQUIRED';
            }
            if (rawTmdb?.backdrop_path) {
                movie.backdropPath = rawTmdb.backdrop_path;
            }
        }
        this.cachedMasterList = masterList;
        this.cacheTimestamp = Date.now();
        const audit = {
            tmdbCount: tmdbResults.results.length,
            justWatchCount: mockJustWatchResults.length,
            uniqueCanonicalCount: masterList.length,
            artworkReady: masterList.filter(m => m.artworkStatus === 'READY').length,
            artworkRequired: masterList.filter(m => m.artworkStatus === 'ARTWORK_REQUIRED').length,
            discoveryRunning: masterList.filter(m => m.artworkStatus === 'DISCOVERY_RUNNING').length,
        };
        this.logger.log(`Discovery Complete: ${audit.uniqueCanonicalCount} Canonical Movies`);
        return await this.formatResponse(masterList, audit);
    }
    async formatResponse(masterList, audit) {
        const todayStr = new Date().toISOString().split('T')[0];
        for (const movie of masterList) {
            const releaseData = {
                movieId: movie.tmdbId || movie.canonicalId,
                title: movie.title,
                originalLanguage: movie.originalLanguage,
                industries: movie.industries,
                overview: movie.overview,
                posterPath: movie.posterPath,
                backdropPath: movie.backdropPath,
                popularity: movie.popularity,
                sources: movie.sources,
                theatricalReleaseDate: movie.theatricalRelease,
                theatricalStatus: movie.theatricalStatus || 'UNKNOWN',
                theatricalWindowDays: 45,
                ottReleaseDate: movie.ottRelease,
                ottPlatforms: movie.ottPlatforms || [],
                ottDateConfirmed: movie.ottDateConfirmed ?? (!!movie.ottRelease && (movie.ottPlatforms?.length || 0) > 0),
                isDirectToOtt: movie.isDirectToOtt || false
            };
            const category = this.movieClassificationService.classifyMovie(releaseData, todayStr);
            movie.classification = category;
            if (!movie.primaryPlatform && movie.ottPlatforms && movie.ottPlatforms.length > 0) {
                movie.primaryPlatform = movie.ottPlatforms[0].name;
            }
            if (!movie.watchUrl && movie.ottPlatforms && movie.ottPlatforms.length > 0) {
                movie.watchUrl = movie.ottPlatforms[0].watchUrl;
            }
            if (!movie.watchUrl && movie.primaryPlatform) {
                movie.watchUrl = this.getPlatformSearchUrl(movie.primaryPlatform, movie.title);
            }
            if (category === 'NOW_STREAMING') {
                movie.streamingStatus = movie.primaryPlatform
                    ? `Streaming Now on ${movie.primaryPlatform}`
                    : 'Streaming Now in India';
            }
            else if (category === 'UPCOMING_OTT') {
                const dateStr = movie.ottRelease ? this.formatDateDisplay(movie.ottRelease) : 'Soon';
                movie.streamingStatus = movie.primaryPlatform
                    ? `Arriving ${dateStr} on ${movie.primaryPlatform}`
                    : `Coming to OTT ${dateStr}`;
            }
            else if (category === 'NOW_IN_THEATERS') {
                movie.streamingStatus = 'In Theaters Now';
            }
            else if (category === 'UPCOMING_THEATRICAL') {
                const dateStr = movie.theatricalRelease ? this.formatDateDisplay(movie.theatricalRelease) : 'Soon';
                movie.streamingStatus = `In Theaters ${dateStr}`;
            }
        }
        const upcomingTheater = [];
        const pendingValidation = [];
        const theatricalValidationAudit = {
            evaluated: 0,
            passed: 0,
            rejected: 0,
            quarantinedCount: 0,
            rejections: []
        };
        const rawUpcomingCandidates = masterList.filter(m => m.classification === 'UPCOMING_THEATRICAL');
        for (const m of rawUpcomingCandidates) {
            theatricalValidationAudit.evaluated++;
            const releaseData = {
                movieId: m.tmdbId || m.canonicalId,
                title: m.title,
                originalLanguage: m.originalLanguage,
                industries: m.industries,
                overview: m.overview,
                posterPath: m.posterPath,
                backdropPath: m.backdropPath,
                popularity: m.popularity,
                sources: m.sources,
                theatricalReleaseDate: m.theatricalRelease,
                theatricalStatus: m.theatricalStatus || 'UPCOMING',
                theatricalWindowDays: 45,
                ottReleaseDate: m.ottRelease,
                ottPlatforms: m.ottPlatforms || [],
                ottDateConfirmed: m.ottDateConfirmed || false,
                isDirectToOtt: m.isDirectToOtt || false
            };
            const verification = await this.theatricalValidator.verifyTheatricalStatus(releaseData, todayStr);
            if (verification.isConfirmedReleased) {
                theatricalValidationAudit.rejected++;
                theatricalValidationAudit.rejections.push({
                    title: m.title,
                    reason: verification.quarantineReason || 'EXHIBITION_OR_DATE_CONFIRMED_ALREADY_RELEASED',
                    sourcesChecked: verification.sourcesChecked
                });
                m.theatricalStatus = 'CURRENTLY_RUNNING';
                m.classification = 'NOW_IN_THEATERS';
                m.streamingStatus = 'In Theaters Now';
                this.logger.warn(`[THEATRICAL_EXHIBITION_PREVENTION] "${m.title}": Disallowed from upcoming. Reclassified as NOW_IN_THEATERS.`);
                continue;
            }
            if (verification.isDateConflict || !verification.isVerifiedUpcoming) {
                theatricalValidationAudit.quarantinedCount++;
                theatricalValidationAudit.rejections.push({
                    title: m.title,
                    reason: verification.quarantineReason || 'HELD_IN_PENDING_VALIDATION_QUARANTINE',
                    sourcesChecked: verification.sourcesChecked
                });
                m.classification = 'PENDING_VALIDATION';
                m.streamingStatus = 'Pending Verification: Date Held';
                pendingValidation.push(m);
                this.logger.warn(`[THEATRICAL_QUARANTINED] "${m.title}": ${verification.quarantineReason}`);
                continue;
            }
            const result = this.movieClassificationService.validateUpcomingTheatrical(releaseData, todayStr);
            if (result.isValid) {
                theatricalValidationAudit.passed++;
                upcomingTheater.push(m);
            }
            else {
                theatricalValidationAudit.rejected++;
                theatricalValidationAudit.rejections.push({ title: m.title, reason: result.rejectionReason || 'UNKNOWN' });
                if (result.rejectionReason?.includes('CONFLICT') || result.rejectionReason?.includes('HELD_FOR_VALIDATION')) {
                    m.classification = 'PENDING_VALIDATION';
                    pendingValidation.push(m);
                }
                else {
                    m.classification = 'UNCLASSIFIED';
                }
                this.logger.warn(`[THEATRICAL_VALIDATOR_REJECTED] "${m.title}": ${result.rejectionReason}`);
            }
        }
        upcomingTheater.sort((a, b) => (a.theatricalRelease || '').localeCompare(b.theatricalRelease || ''));
        const nowInTheater = masterList
            .filter(m => m.classification === 'NOW_IN_THEATERS')
            .sort((a, b) => (b.theatricalRelease || '').localeCompare(a.theatricalRelease || ''));
        const upcomingOTT = masterList
            .filter(m => m.classification === 'UPCOMING_OTT')
            .sort((a, b) => (a.ottRelease || '').localeCompare(b.ottRelease || ''));
        const nowStreaming = masterList
            .filter(m => m.classification === 'NOW_STREAMING')
            .sort((a, b) => (b.ottRelease || '').localeCompare(a.ottRelease || ''));
        const unclassified = masterList
            .filter(m => m.classification === 'UNCLASSIFIED');
        const counts = [
            upcomingTheater.length,
            nowInTheater.length,
            upcomingOTT.length,
            nowStreaming.length,
            pendingValidation.length,
            unclassified.length
        ];
        const totalClassified = counts.reduce((a, b) => a + b, 0);
        const bucketIds = new Set();
        let duplicates = 0;
        for (const list of [upcomingTheater, nowInTheater, upcomingOTT, nowStreaming, pendingValidation, unclassified]) {
            for (const m of list) {
                if (bucketIds.has(m.canonicalId))
                    duplicates++;
                bucketIds.add(m.canonicalId);
            }
        }
        const updatedAudit = {
            ...audit,
            classificationEngine: {
                active: true,
                today: todayStr,
                upcomingTheaterCount: upcomingTheater.length,
                nowInTheaterCount: nowInTheater.length,
                upcomingOTTCount: upcomingOTT.length,
                nowStreamingCount: nowStreaming.length,
                pendingValidationCount: pendingValidation.length,
                unclassifiedCount: unclassified.length,
                totalEvaluated: totalClassified,
                leakageDetections: duplicates,
                mutualExclusivityGuaranteed: duplicates === 0,
                theatricalValidator: theatricalValidationAudit
            }
        };
        return {
            upcomingTheater,
            nowInTheater,
            upcomingOTT,
            nowStreaming,
            pendingValidation,
            unclassified,
            audit: updatedAudit
        };
    }
    getPlatformSearchUrl(platform, title) {
        const encoded = encodeURIComponent(title);
        switch (platform.toLowerCase()) {
            case 'netflix':
                return `https://www.netflix.com/search?q=${encoded}`;
            case 'prime video':
            case 'amazon prime':
            case 'amazon prime video':
                return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encoded}`;
            case 'disney+ hotstar':
            case 'hotstar':
                return `https://www.hotstar.com/in/explore?search_query=${encoded}`;
            case 'jiocinema':
            case 'jio cinema':
                return `https://www.jiocinema.com/search/${encoded}`;
            case 'sonyliv':
            case 'sony liv':
                return `https://www.sonyliv.com/search/${encoded}`;
            case 'zee5':
                return `https://www.zee5.com/search?q=${encoded}`;
            case 'aha':
                return `https://www.aha.video/search?q=${encoded}`;
            case 'apple tv':
            case 'apple tv+':
                return `https://tv.apple.com/`;
            default:
                return `https://www.google.com/search?q=${encoded}+watch+online+india`;
        }
    }
    formatDateDisplay(dateStr) {
        if (!dateStr)
            return '';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        }
        catch {
            return dateStr;
        }
    }
    getMockJustWatchData() {
        return [
            {
                title: 'OTT Only Hidden Gem',
                year: 2026,
                originalLanguage: 'hi',
                industries: ['Bollywood'],
                ottRelease: '2026-11-20',
                theatricalStatus: 'ENDED',
                isDirectToOtt: true,
                ottDateConfirmed: true,
                primaryPlatform: 'Netflix',
                watchUrl: 'https://www.netflix.com/search?q=OTT%20Only%20Hidden%20Gem',
                ottPlatforms: [
                    {
                        name: 'Netflix',
                        availableInIndia: true,
                        verified: true,
                        availabilityType: 'SUBSCRIPTION',
                        availableFrom: '2026-11-20',
                        watchUrl: 'https://www.netflix.com/search?q=OTT%20Only%20Hidden%20Gem'
                    }
                ]
            },
            {
                title: 'Drishyam 3: The Conclusion',
                year: 2026,
                originalLanguage: 'hi',
                industries: ['Bollywood'],
                theatricalRelease: '2026-10-02',
                theatricalStatus: 'CURRENTLY_RUNNING',
                tmdbId: '987654321',
                ottPlatforms: [],
                ottDateConfirmed: false
            }
        ];
    }
};
exports.ReleaseDiscoveryService = ReleaseDiscoveryService;
exports.ReleaseDiscoveryService = ReleaseDiscoveryService = ReleaseDiscoveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => artwork_service_1.MovieArtworkService))),
    __metadata("design:paramtypes", [tmdb_provider_1.TmdbProvider,
        artwork_service_1.MovieArtworkService,
        movie_classification_service_1.MovieClassificationService,
        theatrical_validator_service_1.TheatricalValidatorService])
], ReleaseDiscoveryService);
//# sourceMappingURL=release-discovery.service.js.map