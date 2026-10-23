"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var OmdbProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OmdbProvider = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const https = __importStar(require("https"));
let OmdbProvider = OmdbProvider_1 = class OmdbProvider {
    logger = new common_1.Logger(OmdbProvider_1.name);
    apiKey = process.env.OMDB_API_KEY || 'acdaf73';
    baseUrl = 'https://www.omdbapi.com';
    http = axios_1.default.create({
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 5000
    });
    async getByTitle(title, year) {
        if (!this.apiKey) {
            return { isValid: false };
        }
        try {
            const url = `${this.baseUrl}/?apikey=${this.apiKey}&t=${encodeURIComponent(title)}${year ? `&y=${year}` : ''}`;
            const res = await this.http.get(url);
            if (res.data && res.data.Response === 'True') {
                return this.normalizeOmdbResponse(res.data);
            }
        }
        catch (err) {
            this.logger.debug(`OMDb lookup failed for "${title}": ${err.message}`);
        }
        return { isValid: false };
    }
    async getByImdbId(imdbId) {
        if (!this.apiKey || !imdbId) {
            return { isValid: false };
        }
        try {
            const url = `${this.baseUrl}/?apikey=${this.apiKey}&i=${encodeURIComponent(imdbId)}`;
            const res = await this.http.get(url);
            if (res.data && res.data.Response === 'True') {
                return this.normalizeOmdbResponse(res.data);
            }
        }
        catch (err) {
            this.logger.debug(`OMDb lookup by IMDb ID failed for "${imdbId}": ${err.message}`);
        }
        return { isValid: false };
    }
    normalizeOmdbResponse(data) {
        let releasedDate = undefined;
        if (data.Released && data.Released !== 'N/A') {
            try {
                const d = new Date(data.Released);
                if (!isNaN(d.getTime())) {
                    releasedDate = d.toISOString().split('T')[0];
                }
            }
            catch {
            }
        }
        const yearNum = data.Year ? parseInt(data.Year.replace(/\D/g, ''), 10) : undefined;
        return {
            imdbId: data.imdbID,
            title: data.Title,
            year: yearNum,
            releasedDate,
            boxOffice: data.BoxOffice !== 'N/A' ? data.BoxOffice : undefined,
            imdbRating: data.imdbRating !== 'N/A' ? data.imdbRating : undefined,
            genre: data.Genre ? data.Genre.split(',').map((g) => g.trim()) : [],
            director: data.Director !== 'N/A' ? data.Director : undefined,
            actors: data.Actors ? data.Actors.split(',').map((a) => a.trim()) : [],
            isValid: true
        };
    }
};
exports.OmdbProvider = OmdbProvider;
exports.OmdbProvider = OmdbProvider = OmdbProvider_1 = __decorate([
    (0, common_1.Injectable)()
], OmdbProvider);
//# sourceMappingURL=omdb.provider.js.map