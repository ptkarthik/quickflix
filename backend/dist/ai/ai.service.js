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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const generative_ai_1 = require("@google/generative-ai");
let AiService = class AiService {
    genAI;
    constructor() {
        this.genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'mock-key');
    }
    async generateStructuredContent(prompt) {
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock-key') {
            console.warn("No GEMINI_API_KEY found. Returning mocked data.");
            return this.getMockResponse(prompt);
        }
        const model = this.genAI.getGenerativeModel({
            model: "gemini-1.5-pro",
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        return JSON.parse(text);
    }
    getMockResponse(prompt) {
        if (prompt.includes('ReelScript') || prompt.includes('short-form video')) {
            return { hook: 'Mock hook (0-3s)', context: 'Mock context (3-8s)', mainOpinion: 'Mock opinion (8-25s)', prosCons: 'Mock pros/cons (25-40s)', verdict: 'Mock verdict (40-50s)', cta: 'Mock CTA (50-60s)' };
        }
        if (prompt.includes('Instagram')) {
            return { hook: 'Mock Instagram Hook', caption: 'Mock Instagram Caption', shortCaption: 'Mock Short Caption', hashtags: '#mock #movie', reelOverlayText: 'Mock Overlay', cta: 'Mock CTA' };
        }
        if (prompt.includes('YouTube')) {
            return { titles: ['Mock Title 1', 'Mock Title 2', 'Mock Title 3'], description: 'Mock description', tags: '#mock', shortDescription: 'Mock short desc', pinnedComment: 'Mock comment' };
        }
        return { oneLiner: 'Mock one-liner', twoLiner: 'Mock two-liner', shortReview: 'Mock short review', detailedReview: 'Mock detailed review', pros: ['Pro 1', 'Pro 2'], cons: ['Con 1', 'Con 2'], verdict: 'Mock verdict' };
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AiService);
//# sourceMappingURL=ai.service.js.map