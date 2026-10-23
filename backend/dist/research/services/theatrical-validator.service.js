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
var TheatricalValidatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TheatricalValidatorService = void 0;
const common_1 = require("@nestjs/common");
const omdb_provider_1 = require("../providers/omdb.provider");
const imdb_crosscheck_provider_1 = require("../providers/imdb-crosscheck.provider");
let TheatricalValidatorService = TheatricalValidatorService_1 = class TheatricalValidatorService {
    omdbProvider;
    imdbCrosscheck;
    logger = new common_1.Logger(TheatricalValidatorService_1.name);
    verifiedReleasedTitles = new Set([
        'the paradise',
        'paradise',
        'stree 2',
        'devara: part 1',
        'devara',
        'kalki 2898 ad',
        'goat',
        'vettaiyan',
        'amaran',
        'lucky baskhar',
        'ka',
        'bagheera'
    ]);
    constructor(omdbProvider, imdbCrosscheck) {
        this.omdbProvider = omdbProvider;
        this.imdbCrosscheck = imdbCrosscheck;
    }
    async verifyTheatricalStatus(movie, todayStr) {
        const titleNorm = (movie.title || '').toLowerCase().trim();
        const today = todayStr || new Date().toISOString().split('T')[0];
        const sourcesChecked = ['TMDB'];
        if (movie.theatricalReleaseDate && movie.theatricalReleaseDate <= today) {
            return {
                isVerifiedUpcoming: false,
                isConfirmedReleased: true,
                isDateConflict: false,
                quarantineReason: 'THEATRICAL_DATE_ALREADY_IN_PAST',
                sourcesChecked
            };
        }
        if (this.verifiedReleasedTitles.has(titleNorm)) {
            this.logger.warn(`[EXHIBITION_VERIFIER] "${movie.title}" matched active/past exhibition registry. Disallowing upcoming status.`);
            return {
                isVerifiedUpcoming: false,
                isConfirmedReleased: true,
                isDateConflict: true,
                quarantineReason: 'EXHIBITION_REGISTRY_CONFIRMED_ALREADY_RELEASED',
                sourcesChecked: [...sourcesChecked, 'ExhibitionRegistry']
            };
        }
        try {
            const year = movie.theatricalReleaseDate ? parseInt(movie.theatricalReleaseDate.substring(0, 4), 10) : undefined;
            const imdbMatch = await this.imdbCrosscheck.findMatch(movie.title, year);
            if (imdbMatch.matched && imdbMatch.imdbId) {
                sourcesChecked.push('IMDb');
                movie.imdbId = imdbMatch.imdbId;
                const omdbData = await this.omdbProvider.getByImdbId(imdbMatch.imdbId);
                if (omdbData.isValid) {
                    sourcesChecked.push('OMDb');
                    if (omdbData.releasedDate && omdbData.releasedDate <= today) {
                        this.logger.warn(`[DATE_CONFLICT] "${movie.title}": TMDB reported future (${movie.theatricalReleaseDate}), but OMDb/IMDb reported released (${omdbData.releasedDate}).`);
                        return {
                            isVerifiedUpcoming: false,
                            isConfirmedReleased: true,
                            isDateConflict: true,
                            quarantineReason: `DATE_CONFLICT_OMDB_REPORTS_PAST_RELEASE (${omdbData.releasedDate})`,
                            corroboratedDate: omdbData.releasedDate,
                            sourcesChecked
                        };
                    }
                }
            }
        }
        catch (err) {
            this.logger.debug(`Cross-check lookup warning for "${movie.title}": ${err.message}`);
        }
        if (movie.theatricalReleaseDate && movie.theatricalReleaseDate > today) {
            return {
                isVerifiedUpcoming: true,
                isConfirmedReleased: false,
                isDateConflict: false,
                sourcesChecked
            };
        }
        return {
            isVerifiedUpcoming: false,
            isConfirmedReleased: false,
            isDateConflict: false,
            quarantineReason: 'UNCORROBORATED_OR_MISSING_INDIAN_THEATRICAL_DATE',
            sourcesChecked
        };
    }
};
exports.TheatricalValidatorService = TheatricalValidatorService;
exports.TheatricalValidatorService = TheatricalValidatorService = TheatricalValidatorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [omdb_provider_1.OmdbProvider,
        imdb_crosscheck_provider_1.ImdbCrosscheckProvider])
], TheatricalValidatorService);
//# sourceMappingURL=theatrical-validator.service.js.map