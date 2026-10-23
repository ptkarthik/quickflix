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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoverController = void 0;
const common_1 = require("@nestjs/common");
const research_service_1 = require("./research.service");
const creative_service_1 = require("../creative/creative.service");
let DiscoverController = class DiscoverController {
    researchService;
    creativeStudioService;
    constructor(researchService, creativeStudioService) {
        this.researchService = researchService;
        this.creativeStudioService = creativeStudioService;
    }
    async getUpcomingOtt() {
        return this.researchService.getUpcomingOttIndia();
    }
    async getAll() {
        return this.researchService.discoverAll();
    }
    async getMovieDetails(id) {
        return this.researchService.getMovieDetails(id);
    }
    async generatePosterConcepts(body) {
        return this.creativeStudioService.buildCreativeStudioPayload(body.canonicalMovieId || body.movieData?.canonicalId || body.movieData?.id, body.tmdbId || body.movieData?.tmdbId || body.movieData?.id, body.title || body.movieData?.title, body.movieData, body.manualRating, body.usedCandidateIds || [], '', body.forceDeepSearch);
    }
};
exports.DiscoverController = DiscoverController;
__decorate([
    (0, common_1.Get)('upcoming-ott'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DiscoverController.prototype, "getUpcomingOtt", null);
__decorate([
    (0, common_1.Get)('all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DiscoverController.prototype, "getAll", null);
__decorate([
    (0, common_1.Get)('movie/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DiscoverController.prototype, "getMovieDetails", null);
__decorate([
    (0, common_1.Post)('generate-poster'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DiscoverController.prototype, "generatePosterConcepts", null);
exports.DiscoverController = DiscoverController = __decorate([
    (0, common_1.Controller)('discover'),
    __metadata("design:paramtypes", [research_service_1.ResearchService,
        creative_service_1.CreativeStudioService])
], DiscoverController);
//# sourceMappingURL=discover.controller.js.map