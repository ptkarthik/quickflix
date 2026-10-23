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
var AiGenerationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiGenerationService = void 0;
const common_1 = require("@nestjs/common");
const ai_generation_provider_1 = require("./ai-generation.provider");
const uuid_1 = require("uuid");
let AiGenerationService = AiGenerationService_1 = class AiGenerationService {
    provider;
    logger = new common_1.Logger(AiGenerationService_1.name);
    constructor(provider) {
        this.provider = provider;
    }
    async generatePosterImage(movieTitle, artistReferences, visualReferenceUrl, titleProfile) {
        const requestId = (0, uuid_1.v4)();
        this.logger.log(`[${requestId}] Starting AI generation for: ${movieTitle}`);
        const visualMotif = titleProfile?.dna?.visualMotif || 'cinematic lighting, dramatic composition';
        const prompt = `A highly detailed, professional cinematic still for a movie. Atmosphere: ${visualMotif}. NO TEXT, NO TYPOGRAPHY, NO LOGOS, NO WATERMARKS. Pure textless cinematic composition.`;
        const identityReferences = [];
        if (artistReferences && artistReferences.artists) {
            for (const artist of artistReferences.artists) {
                if (artist.references && artist.references.length > 0) {
                    const validRef = artist.references.find(r => r.validationStatus === 'SOURCE_VERIFIED');
                    if (validRef) {
                        identityReferences.push({
                            url: validRef.url,
                            sourceType: 'actor'
                        });
                    }
                }
            }
        }
        const visualReferences = [];
        if (visualReferenceUrl) {
            visualReferences.push({
                url: visualReferenceUrl,
                sourceType: 'artwork'
            });
        }
        const request = {
            prompt,
            identityReferences,
            visualReferences,
            aspectRatio: '2:3',
            outputQuality: 'high'
        };
        try {
            this.logger.log(`[${requestId}] Dispatching to AI provider with ${identityReferences.length} identity refs and ${visualReferences.length} visual refs`);
            const result = await this.provider.generateImage(request);
            if (result.status === 'AI_GENERATED' || result.status === 'MOCK_AI') {
                this.logger.log(`[${requestId}] Successfully generated AI image (${result.status})`);
            }
            else {
                this.logger.warn(`[${requestId}] AI Generation failed: ${result.errorMessage}`);
            }
            if (result.provenance) {
                result.provenance.generationRequestId = requestId;
            }
            return result;
        }
        catch (error) {
            this.logger.error(`[${requestId}] Unhandled error during AI generation: ${error.message}`, error.stack);
            return {
                imageUrl: '',
                status: 'AI_GENERATION_FAILED',
                sourceType: 'AI_GENERATED',
                errorMessage: error.message
            };
        }
    }
};
exports.AiGenerationService = AiGenerationService;
exports.AiGenerationService = AiGenerationService = AiGenerationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_generation_provider_1.AiGenerationProvider])
], AiGenerationService);
//# sourceMappingURL=ai-generation.service.js.map