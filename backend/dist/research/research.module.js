"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResearchModule = void 0;
const common_1 = require("@nestjs/common");
const research_service_1 = require("./research.service");
const research_controller_1 = require("./research.controller");
const discover_controller_1 = require("./discover.controller");
const tmdb_provider_1 = require("./providers/tmdb.provider");
const release_discovery_service_1 = require("./services/release-discovery.service");
const prisma_module_1 = require("../prisma/prisma.module");
const ai_module_1 = require("../ai/ai.module");
const creative_module_1 = require("../creative/creative.module");
const movie_classification_service_1 = require("./services/movie-classification.service");
const omdb_provider_1 = require("./providers/omdb.provider");
const imdb_crosscheck_provider_1 = require("./providers/imdb-crosscheck.provider");
const theatrical_validator_service_1 = require("./services/theatrical-validator.service");
let ResearchModule = class ResearchModule {
};
exports.ResearchModule = ResearchModule;
exports.ResearchModule = ResearchModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, ai_module_1.AiModule, (0, common_1.forwardRef)(() => creative_module_1.CreativeModule)],
        controllers: [research_controller_1.ResearchController, discover_controller_1.DiscoverController],
        providers: [
            research_service_1.ResearchService,
            tmdb_provider_1.TmdbProvider,
            omdb_provider_1.OmdbProvider,
            imdb_crosscheck_provider_1.ImdbCrosscheckProvider,
            theatrical_validator_service_1.TheatricalValidatorService,
            release_discovery_service_1.ReleaseDiscoveryService,
            movie_classification_service_1.MovieClassificationService
        ],
        exports: [
            research_service_1.ResearchService,
            tmdb_provider_1.TmdbProvider,
            omdb_provider_1.OmdbProvider,
            imdb_crosscheck_provider_1.ImdbCrosscheckProvider,
            theatrical_validator_service_1.TheatricalValidatorService,
            release_discovery_service_1.ReleaseDiscoveryService,
            movie_classification_service_1.MovieClassificationService
        ]
    })
], ResearchModule);
//# sourceMappingURL=research.module.js.map