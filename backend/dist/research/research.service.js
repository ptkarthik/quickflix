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
exports.ResearchService = void 0;
const common_1 = require("@nestjs/common");
const tmdb_provider_1 = require("./providers/tmdb.provider");
const prisma_service_1 = require("../prisma/prisma.service");
const release_discovery_service_1 = require("./services/release-discovery.service");
let ResearchService = class ResearchService {
    tmdbProvider;
    releaseDiscovery;
    prisma;
    constructor(tmdbProvider, releaseDiscovery, prisma) {
        this.tmdbProvider = tmdbProvider;
        this.releaseDiscovery = releaseDiscovery;
        this.prisma = prisma;
    }
    async search(projectId) {
        const project = await this.prisma.movieProject.findUnique({ where: { id: projectId } });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        return this.tmdbProvider.searchMovie(project.title, project.releaseYear ?? undefined);
    }
    async linkAndFetch(projectId, tmdbId) {
        const research = await this.tmdbProvider.getMovieDetails(tmdbId);
        await this.prisma.movieProject.update({
            where: { id: projectId },
            data: {
                researchFetchedAt: new Date(),
                researchVersion: '1.0'
            }
        });
        return research;
    }
    async getUpcomingOttIndia() {
        const all = await this.discoverAll();
        return all.upcomingOTT;
    }
    async discoverAll() {
        return this.releaseDiscovery.discoverAll();
    }
    async getMovieDetails(tmdbId) {
        return this.tmdbProvider.getMovieDetails(tmdbId);
    }
};
exports.ResearchService = ResearchService;
exports.ResearchService = ResearchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tmdb_provider_1.TmdbProvider,
        release_discovery_service_1.ReleaseDiscoveryService,
        prisma_service_1.PrismaService])
], ResearchService);
//# sourceMappingURL=research.service.js.map