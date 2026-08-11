"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var TmdbProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TmdbProvider = void 0;
const common_1 = require("@nestjs/common");
let TmdbProvider = TmdbProvider_1 = class TmdbProvider {
    logger = new common_1.Logger(TmdbProvider_1.name);
    apiKey = process.env.TMDB_API_KEY;
    baseUrl = 'https://api.themoviedb.org/3';
    async searchMovie(title, year) {
        if (!this.apiKey) {
            this.logger.warn('TMDB_API_KEY is not set. Returning mock search results.');
            return [
                { id: 'mock-1', title: `${title} (Mock)`, release_date: `${year || 2023}-01-01`, overview: 'Mock synopsis.' }
            ];
        }
        try {
            let url = `${this.baseUrl}/search/movie?api_key=${this.apiKey}&query=${encodeURIComponent(title)}`;
            if (year) {
                url += `&year=${year}`;
            }
            const response = await fetch(url);
            const data = await response.json();
            return data.results || [];
        }
        catch (err) {
            this.logger.error('Failed to search TMDB', err);
            throw err;
        }
    }
    async getMovieDetails(id) {
        if (!this.apiKey) {
            return {
                title: "Mock Title",
                synopsis: "This is a mock synopsis since TMDB API is not configured.",
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
            const response = await fetch(url);
            const data = await response.json();
            const director = data.credits?.crew?.find((c) => c.job === 'Director')?.name || 'Unknown';
            const cast = data.credits?.cast?.slice(0, 5).map((c) => c.name) || [];
            const genres = data.genres?.map((g) => g.name) || [];
            const productionInfo = data.production_companies?.map((p) => p.name).join(', ') || 'Unknown';
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
        }
        catch (err) {
            this.logger.error('Failed to get TMDB details', err);
            throw err;
        }
    }
};
exports.TmdbProvider = TmdbProvider;
exports.TmdbProvider = TmdbProvider = TmdbProvider_1 = __decorate([
    (0, common_1.Injectable)()
], TmdbProvider);
//# sourceMappingURL=tmdb.provider.js.map