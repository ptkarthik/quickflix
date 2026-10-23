"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MockAiGenerationProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockAiGenerationProvider = void 0;
const common_1 = require("@nestjs/common");
const uuid_1 = require("uuid");
let MockAiGenerationProvider = MockAiGenerationProvider_1 = class MockAiGenerationProvider {
    logger = new common_1.Logger(MockAiGenerationProvider_1.name);
    async generateImage(request) {
        const requestId = (0, uuid_1.v4)();
        const identityStats = { requested: request.identityReferences.length, fetched: 0, suppliedToModel: 0 };
        const visualStats = { requested: request.visualReferences.length, fetched: 0, suppliedToModel: 0 };
        this.logger.log(`[MockAI:${requestId}] REFERENCE_DISCOVERY: Identity References: ${identityStats.requested}, Visual References: ${visualStats.requested}`);
        this.logger.log(`[MockAI:${requestId}] REFERENCE_FETCH & MODEL_INPUT_PREPARATION started`);
        for (const ref of request.identityReferences) {
            identityStats.fetched++;
            identityStats.suppliedToModel++;
        }
        for (const ref of request.visualReferences) {
            visualStats.fetched++;
            visualStats.suppliedToModel++;
        }
        this.logger.log(`[MockAI:${requestId}] IDENTITY_REFERENCES: fetched: ${identityStats.fetched}, valid: ${identityStats.fetched}, supplied_to_model: ${identityStats.suppliedToModel}`);
        this.logger.log(`[MockAI:${requestId}] VISUAL_REFERENCES: fetched: ${visualStats.fetched}, valid: ${visualStats.fetched}, supplied_to_model: ${visualStats.suppliedToModel}`);
        this.logger.log(`[MockAI:${requestId}] MODEL_INPUT_PREPARATION completed (Mock Mode)`);
        this.logger.log(`[MockAI:${requestId}] GEMINI_REQUEST started to mock model (Simulating latency...)`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        this.logger.log(`[MockAI:${requestId}] GENERATION_ACCEPTED. Latency: 1500ms`);
        this.logger.log(`[MockAI:${requestId}] GENERATED_ASSET_SAVED successfully (Mock)`);
        return {
            imageUrl: '/mock_posters/poster_3.jpg',
            status: 'MOCK_AI',
            sourceType: 'MOCK_AI',
            provenance: {
                provider: 'mock',
                model: 'mock-generation-engine',
                promptVersion: 'v1_strict_textless',
                referenceImages: { identity: identityStats, visual: visualStats },
                generationRequestId: requestId,
                generatedAt: new Date().toISOString()
            }
        };
    }
};
exports.MockAiGenerationProvider = MockAiGenerationProvider;
exports.MockAiGenerationProvider = MockAiGenerationProvider = MockAiGenerationProvider_1 = __decorate([
    (0, common_1.Injectable)()
], MockAiGenerationProvider);
//# sourceMappingURL=mock-ai-generation.provider.js.map