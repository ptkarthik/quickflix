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
    getDynamicIndianOttContent(prompt) {
        const indianHooks = [
            "Blood. Betrayal. Brotherhood.",
            "The Hunt Begins Tonight.",
            "No Rules. Only Revenge.",
            "A City Built on Lies.",
            "Love. Duty. Sacrifice.",
            "Fear Has a New Address.",
            "The Final Chapter Unfolds.",
            "Truth is the Deadliest Weapon."
        ];
        const indianSynopses = [
            "In the lawless badlands of UP, a rogue cop must confront his own dark past to take down a ruthless cartel. The line between justice and vengeance blurs in this high-octane thriller.",
            "A gripping saga of power, politics, and family secrets set against the vibrant backdrop of Mumbai's underworld. Trust no one when the stakes are this high.",
            "When a mysterious tech billionaire vanishes in Bangalore, a suspended detective is pulled into a conspiracy that threatens the entire nation's digital infrastructure.",
            "A heartwarming romantic drama set in the breathtaking valleys of Kashmir. Two star-crossed lovers must defy their families to protect a love that spans generations.",
            "An edge-of-your-seat psychological horror where a family moving into an ancient Kerala heritage home discovers that some doors should never be opened."
        ];
        const indianReviews = [
            "A masterful stroke of modern Indian cinema. The pacing is relentless, the cinematography is stunning, and the lead performance is absolutely award-worthy. A must-watch on OTT this weekend.",
            "Pushes the boundaries of Indian storytelling. While the second half slows down slightly, the explosive climax more than makes up for it. Highly recommended for thriller fans.",
            "An emotional rollercoaster that perfectly captures the essence of heartland India. The raw dialogue and authentic setting make this one of the best digital releases of the year."
        ];
        const randomHook = indianHooks[Math.floor(Math.random() * indianHooks.length)];
        const randomSynopsis = indianSynopses[Math.floor(Math.random() * indianSynopses.length)];
        const randomReview = indianReviews[Math.floor(Math.random() * indianReviews.length)];
        const randomRating = (Math.random() * (5.0 - 3.5) + 3.5).toFixed(1);
        if (prompt.includes('Poster') || prompt.includes('poster')) {
            return {
                synopsis: randomSynopsis,
                oneLiner: randomHook,
                rating: parseFloat(randomRating),
                detailedReview: randomReview
            };
        }
        return { oneLiner: randomHook, twoLiner: 'Mock two-liner', shortReview: 'Mock short review', detailedReview: randomReview, pros: ['Pro 1', 'Pro 2'], cons: ['Con 1', 'Con 2'], verdict: 'Mock verdict' };
    }
    async generateStructuredContent(prompt) {
        return this.getDynamicIndianOttContent(prompt);
    }
    async generatePosterConcepts(movieData, userPrompt) {
        const basePrompt = `Create a text-free movie poster artwork for "${movieData.title}". Genre: ${(movieData.genres || []).map((g) => g.name || g).join(', ')}. ${userPrompt}`;
        const cinematicPrompt = `${basePrompt}. Style: Highly dramatic, dark atmospheric lighting, high contrast, cinematic composition, epic scale.`;
        const minimalPrompt = `${basePrompt}. Style: Clean, elegant, lots of negative space, sophisticated color palette, editorial streaming-platform aesthetic, subtle gradients.`;
        const genrePrompt = `${basePrompt}. Style: Highly stylized, vibrant, neon-drenched or mood-specific depending on the exact genre, strong visual identity, punchy colors.`;
        console.log(`Generating AI Art Concepts:\n1. ${cinematicPrompt}\n2. ${minimalPrompt}\n3. ${genrePrompt}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return [
            {
                id: 'cinematic',
                label: 'Cinematic',
                backgroundUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
                promptUsed: cinematicPrompt
            },
            {
                id: 'minimal',
                label: 'Minimal Premium',
                backgroundUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
                promptUsed: minimalPrompt
            },
            {
                id: 'genre',
                label: 'Genre Driven',
                backgroundUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80',
                promptUsed: genrePrompt
            }
        ];
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AiService);
//# sourceMappingURL=ai.service.js.map