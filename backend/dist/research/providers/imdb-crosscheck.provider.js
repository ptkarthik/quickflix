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
var ImdbCrosscheckProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImdbCrosscheckProvider = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const https = __importStar(require("https"));
let ImdbCrosscheckProvider = ImdbCrosscheckProvider_1 = class ImdbCrosscheckProvider {
    logger = new common_1.Logger(ImdbCrosscheckProvider_1.name);
    http = axios_1.default.create({
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    async findMatch(title, year) {
        const cleanTitle = title.trim();
        if (!cleanTitle)
            return { matched: false };
        const firstChar = cleanTitle.charAt(0).toLowerCase();
        if (!firstChar.match(/[a-z0-9]/))
            return { matched: false };
        try {
            const url = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(cleanTitle)}.json`;
            const res = await this.http.get(url);
            if (res.data?.d && Array.isArray(res.data.d)) {
                for (const hit of res.data.d) {
                    const qid = (hit.qid || '').toLowerCase();
                    const q = (hit.q || '').toLowerCase();
                    if (qid === 'person' || qid === 'videogame' || qid === 'podcastseries')
                        continue;
                    const hitTitle = (hit.l || '').toLowerCase();
                    const targetTitle = cleanTitle.toLowerCase();
                    const isDirectMatch = hitTitle === targetTitle || hitTitle.includes(targetTitle) || targetTitle.includes(hitTitle);
                    const isYearMatch = year ? (hit.y && Math.abs(hit.y - year) <= 1) : true;
                    if (isDirectMatch && isYearMatch && hit.id && hit.id.startsWith('tt')) {
                        return {
                            imdbId: hit.id,
                            title: hit.l,
                            year: hit.y,
                            entityType: hit.qid || hit.q,
                            matched: true
                        };
                    }
                }
            }
        }
        catch (err) {
            this.logger.debug(`IMDb suggestion query failed for "${title}": ${err.message}`);
        }
        return { matched: false };
    }
};
exports.ImdbCrosscheckProvider = ImdbCrosscheckProvider;
exports.ImdbCrosscheckProvider = ImdbCrosscheckProvider = ImdbCrosscheckProvider_1 = __decorate([
    (0, common_1.Injectable)()
], ImdbCrosscheckProvider);
//# sourceMappingURL=imdb-crosscheck.provider.js.map