"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreativeModule = void 0;
const common_1 = require("@nestjs/common");
const artwork_service_1 = require("./artwork.service");
const rating_service_1 = require("./rating.service");
const creative_service_1 = require("./creative.service");
const research_module_1 = require("../research/research.module");
const artist_reference_service_1 = require("./artist-reference.service");
const title_intelligence_service_1 = require("./title-intelligence.service");
const ai_generation_service_1 = require("./ai-generation/ai-generation.service");
const ai_generation_provider_1 = require("./ai-generation/ai-generation.provider");
const gemini_image_provider_1 = require("./ai-generation/gemini-image.provider");
const mock_ai_generation_provider_1 = require("./ai-generation/mock-ai-generation.provider");
const axios_1 = require("@nestjs/axios");
let CreativeModule = class CreativeModule {
};
exports.CreativeModule = CreativeModule;
exports.CreativeModule = CreativeModule = __decorate([
    (0, common_1.Module)({
        imports: [(0, common_1.forwardRef)(() => research_module_1.ResearchModule), axios_1.HttpModule],
        providers: [
            artwork_service_1.MovieArtworkService,
            rating_service_1.RatingAggregationService,
            creative_service_1.CreativeStudioService,
            artwork_service_1.WebArtworkDiscoveryService,
            artwork_service_1.WikipediaImageSearchProvider,
            artwork_service_1.ImdbImageSearchProvider,
            artist_reference_service_1.ArtistReferenceService,
            title_intelligence_service_1.MovieTitleIntelligenceService,
            ai_generation_service_1.AiGenerationService,
            gemini_image_provider_1.GeminiImageProvider,
            mock_ai_generation_provider_1.MockAiGenerationProvider,
            {
                provide: ai_generation_provider_1.AiGenerationProvider,
                useFactory: (gemini, mock) => {
                    return process.env.USE_MOCK_AI === 'true' ? mock : gemini;
                },
                inject: [gemini_image_provider_1.GeminiImageProvider, mock_ai_generation_provider_1.MockAiGenerationProvider]
            }
        ],
        exports: [creative_service_1.CreativeStudioService, artwork_service_1.MovieArtworkService]
    })
], CreativeModule);
//# sourceMappingURL=creative.module.js.map