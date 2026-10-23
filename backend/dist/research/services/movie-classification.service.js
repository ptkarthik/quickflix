"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MovieClassificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovieClassificationService = void 0;
const common_1 = require("@nestjs/common");
let MovieClassificationService = class MovieClassificationService {
    static { MovieClassificationService_1 = this; }
    logger = new common_1.Logger(MovieClassificationService_1.name);
    static DEFAULT_THEATRICAL_WINDOW_DAYS = 45;
    isValidDateStr(dateStr) {
        if (!dateStr || typeof dateStr !== 'string')
            return false;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
            return false;
        const d = new Date(dateStr);
        return !isNaN(d.getTime()) && dateStr.startsWith(d.toISOString().substring(0, 10));
    }
    daysDifference(targetDate, baseDate) {
        const t = new Date(targetDate).getTime();
        const b = new Date(baseDate).getTime();
        return Math.round((t - b) / (1000 * 60 * 60 * 24));
    }
    resolveTheatricalStatus(theatricalDate, todayStr, explicitStatus, windowDays = MovieClassificationService_1.DEFAULT_THEATRICAL_WINDOW_DAYS) {
        const today = todayStr || new Date().toISOString().split('T')[0];
        if (theatricalDate && this.isValidDateStr(theatricalDate)) {
            if (theatricalDate <= today) {
                const daysSinceRelease = this.daysDifference(today, theatricalDate);
                if (daysSinceRelease >= 0 && daysSinceRelease <= windowDays) {
                    return 'CURRENTLY_RUNNING';
                }
                return 'ENDED';
            }
            else {
                return 'UPCOMING';
            }
        }
        if (explicitStatus && explicitStatus !== 'UNKNOWN') {
            return explicitStatus;
        }
        return 'UNKNOWN';
    }
    classifyMovie(movie, todayStr) {
        const today = todayStr || new Date().toISOString().split('T')[0];
        const activeIndianSubscriptionOtt = movie.ottPlatforms.some((p) => {
            if (!p.availableInIndia || !p.verified)
                return false;
            if (p.availabilityType && p.availabilityType !== 'SUBSCRIPTION')
                return false;
            if (p.availableFrom && this.isValidDateStr(p.availableFrom) && p.availableFrom > today) {
                return false;
            }
            if (!p.availableFrom && this.isValidDateStr(movie.ottReleaseDate) && movie.ottReleaseDate > today) {
                return false;
            }
            if (p.availableUntil && this.isValidDateStr(p.availableUntil) && p.availableUntil < today) {
                return false;
            }
            return true;
        });
        const hasPremieredOtt = movie.ottDateConfirmed &&
            this.isValidDateStr(movie.ottReleaseDate) &&
            movie.ottReleaseDate <= today &&
            movie.ottPlatforms.some((p) => p.availableInIndia && p.verified);
        if (activeIndianSubscriptionOtt || hasPremieredOtt) {
            return 'NOW_STREAMING';
        }
        const effectiveTheatricalStatus = this.resolveTheatricalStatus(movie.theatricalReleaseDate, today, movie.theatricalStatus, movie.theatricalWindowDays || MovieClassificationService_1.DEFAULT_THEATRICAL_WINDOW_DAYS);
        const isTheatricalUpcoming = effectiveTheatricalStatus === 'UPCOMING' &&
            this.isValidDateStr(movie.theatricalReleaseDate) &&
            movie.theatricalReleaseDate > today;
        const isTheatricalCurrentlyRunning = effectiveTheatricalStatus === 'CURRENTLY_RUNNING' &&
            !movie.isDirectToOtt &&
            this.isValidDateStr(movie.theatricalReleaseDate) &&
            movie.theatricalReleaseDate <= today;
        const hasConfirmedFutureOtt = movie.ottDateConfirmed &&
            this.isValidDateStr(movie.ottReleaseDate) &&
            movie.ottReleaseDate > today &&
            movie.ottPlatforms.some((p) => p.availableInIndia && p.verified);
        if (movie.dateConflictDetected || movie.uncorroboratedDate) {
            return 'PENDING_VALIDATION';
        }
        if (isTheatricalCurrentlyRunning || (movie.exhibitionConfirmedPast && (!movie.theatricalReleaseDate || this.daysDifference(today, movie.theatricalReleaseDate) <= 45))) {
            return 'NOW_IN_THEATERS';
        }
        if (hasConfirmedFutureOtt && !isTheatricalCurrentlyRunning) {
            return 'UPCOMING_OTT';
        }
        if (isTheatricalUpcoming && !movie.isDirectToOtt && !movie.exhibitionConfirmedPast) {
            const validation = this.validateUpcomingTheatrical(movie, today);
            if (validation.isValid) {
                return 'UPCOMING_THEATRICAL';
            }
            if (validation.rejectionReason?.includes('CONFLICT') || validation.rejectionReason?.includes('HELD_FOR_VALIDATION')) {
                return 'PENDING_VALIDATION';
            }
        }
        return 'UNCLASSIFIED';
    }
    validateUpcomingTheatrical(movie, todayStr) {
        const today = todayStr || new Date().toISOString().split('T')[0];
        const title = (movie.title || '').trim();
        if (!title || title.length < 2) {
            return { isValid: false, rejectionReason: 'INVALID_TITLE_EMPTY' };
        }
        if (/^(test[:\s]|mock[:\s]|placeholder[:\s]|dummy[:\s])/i.test(title)) {
            return { isValid: false, rejectionReason: 'SYNTHETIC_TEST_ENTITY_REJECTED' };
        }
        if (movie.isDirectToOtt) {
            return { isValid: false, rejectionReason: 'DIRECT_TO_OTT_EXCLUDED_FROM_THEATRICAL' };
        }
        if (!movie.theatricalReleaseDate || !this.isValidDateStr(movie.theatricalReleaseDate)) {
            return { isValid: false, rejectionReason: 'MISSING_OR_INVALID_THEATRICAL_DATE' };
        }
        if (movie.theatricalReleaseDate <= today) {
            return {
                isValid: false,
                rejectionReason: 'THEATRICAL_DATE_ALREADY_PASSED_OR_RUNNING_TODAY'
            };
        }
        if (movie.exhibitionConfirmedPast) {
            return {
                isValid: false,
                rejectionReason: 'EXHIBITION_CONFIRMED_ALREADY_IN_OR_PAST_THEATERS'
            };
        }
        if (movie.dateConflictDetected) {
            return {
                isValid: false,
                rejectionReason: `THEATRICAL_DATE_CONFLICT_DETECTED (${movie.dateConflictDetails || 'Discrepancy across sources'})`
            };
        }
        if (movie.uncorroboratedDate) {
            return {
                isValid: false,
                rejectionReason: 'UNCORROBORATED_DATE_HELD_FOR_VALIDATION'
            };
        }
        const daysUntilRelease = this.daysDifference(movie.theatricalReleaseDate, today);
        if (daysUntilRelease > 365) {
            return {
                isValid: false,
                rejectionReason: 'THEATRICAL_DATE_TOO_DISTANT_OR_UNCONFIRMED'
            };
        }
        const effectiveStatus = this.resolveTheatricalStatus(movie.theatricalReleaseDate, today, movie.theatricalStatus, movie.theatricalWindowDays);
        if (effectiveStatus !== 'UPCOMING') {
            return {
                isValid: false,
                rejectionReason: `THEATRICAL_STATUS_NOT_UPCOMING (${effectiveStatus})`
            };
        }
        const activeIndianSubscriptionOtt = (movie.ottPlatforms || []).some((p) => {
            if (!p.availableInIndia || !p.verified)
                return false;
            if (p.availabilityType && p.availabilityType !== 'SUBSCRIPTION')
                return false;
            if (p.availableFrom && this.isValidDateStr(p.availableFrom) && p.availableFrom > today) {
                return false;
            }
            if (p.availableUntil && this.isValidDateStr(p.availableUntil) && p.availableUntil < today) {
                return false;
            }
            return true;
        });
        if (activeIndianSubscriptionOtt) {
            return {
                isValid: false,
                rejectionReason: 'ALREADY_STREAMING_ON_INDIAN_OTT'
            };
        }
        if (movie.ottDateConfirmed &&
            this.isValidDateStr(movie.ottReleaseDate) &&
            movie.ottReleaseDate <= today &&
            (movie.ottPlatforms || []).some((p) => p.availableInIndia && p.verified)) {
            return {
                isValid: false,
                rejectionReason: 'OTT_PREMIERE_ALREADY_PASSED_IN_INDIA'
            };
        }
        const indianLangs = new Set(['hi', 'te', 'ta', 'ml', 'kn', 'bn', 'mr', 'pa', 'gu', 'or', 'as', 'ur']);
        const lang = (movie.originalLanguage || '').toLowerCase();
        const isIndianLang = indianLangs.has(lang);
        const indianIndustries = new Set(['bollywood', 'tollywood', 'kollywood', 'mollywood', 'sandalwood', 'bengali', 'marathi', 'punjabi']);
        const isIndianIndustry = (movie.industries || []).some((ind) => indianIndustries.has(ind.toLowerCase()));
        const hasIndiaSource = (movie.sources || []).some((s) => s.includes('IN') || s.includes('India'));
        if (lang && !isIndianLang && !isIndianIndustry && !hasIndiaSource && lang !== 'en') {
            return {
                isValid: false,
                rejectionReason: 'NOT_RELEVANT_TO_INDIAN_THEATRICAL_MARKET'
            };
        }
        return {
            isValid: true,
            auditDetails: {
                movieId: movie.movieId,
                title: movie.title,
                theatricalDate: movie.theatricalReleaseDate,
                today,
                language: movie.originalLanguage,
                isIndianProduction: isIndianLang || isIndianIndustry,
                hasActiveIndianOtt: false,
                isDirectToOtt: false,
                daysUntilRelease
            }
        };
    }
};
exports.MovieClassificationService = MovieClassificationService;
exports.MovieClassificationService = MovieClassificationService = MovieClassificationService_1 = __decorate([
    (0, common_1.Injectable)()
], MovieClassificationService);
//# sourceMappingURL=movie-classification.service.js.map