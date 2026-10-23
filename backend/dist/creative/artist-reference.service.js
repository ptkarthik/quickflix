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
var ArtistReferenceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtistReferenceService = void 0;
const common_1 = require("@nestjs/common");
const tmdb_provider_1 = require("../research/providers/tmdb.provider");
let ArtistReferenceService = ArtistReferenceService_1 = class ArtistReferenceService {
    tmdbProvider;
    logger = new common_1.Logger(ArtistReferenceService_1.name);
    constructor(tmdbProvider) {
        this.tmdbProvider = tmdbProvider;
    }
    async buildReferencePack(movieData, tmdbId) {
        this.logger.log(`Building Artist Reference Pack for: ${movieData.title || 'Unknown'} (ID: ${tmdbId || movieData.id})`);
        const pack = {
            artists: [],
            totalReferences: 0,
            packStatus: 'NO_DATA'
        };
        let castList = [];
        try {
            const targetId = tmdbId || movieData.id;
            if (targetId) {
                const tmdbDetails = await this.tmdbProvider.getMovieDetails(targetId);
                castList = tmdbDetails.cast || [];
            }
        }
        catch (err) {
            this.logger.warn(`Failed to fetch TMDB credits: ${err.message}`);
        }
        if (castList.length === 0 && movieData.cast) {
            castList = movieData.cast;
        }
        const roles = ['Hero 1', 'Hero 2', 'Supporting'];
        let verifiedCount = 0;
        for (let i = 0; i < Math.min(castList.length, 3); i++) {
            const actorName = typeof castList[i] === 'string' ? castList[i] : (castList[i].name || `Actor ${i + 1}`);
            const profilePath = typeof castList[i] === 'object' ? castList[i].profile_path : null;
            const references = [];
            if (profilePath) {
                references.push({
                    url: `https://image.tmdb.org/t/p/original${profilePath}`,
                    sourceUrl: `https://themoviedb.org/person`,
                    sourceType: 'tmdb',
                    retrievalStatus: 'SUCCESS',
                    validationStatus: 'SOURCE_VERIFIED',
                    suppliedToModel: true,
                    confidence: 95
                });
            }
            else {
                this.logger.warn(`No validated profile image found for actor: ${actorName}`);
            }
            const hasRefs = references.length > 0;
            if (hasRefs)
                verifiedCount++;
            pack.artists.push({
                role: roles[i] || `Supporting ${i}`,
                name: actorName,
                references,
                referenceCount: references.length,
                retrievalStatus: hasRefs ? 'SUCCESS' : 'NO_DATA'
            });
            pack.totalReferences += references.length;
        }
        if (pack.artists.length > 0 && verifiedCount === pack.artists.length) {
            pack.packStatus = 'SOURCE_VERIFIED';
        }
        else if (pack.artists.length > 0 && verifiedCount > 0) {
            pack.packStatus = 'PARTIAL';
        }
        else {
            pack.packStatus = 'FAILED';
        }
        return pack;
    }
};
exports.ArtistReferenceService = ArtistReferenceService;
exports.ArtistReferenceService = ArtistReferenceService = ArtistReferenceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tmdb_provider_1.TmdbProvider])
], ArtistReferenceService);
//# sourceMappingURL=artist-reference.service.js.map