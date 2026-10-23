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
exports.ContentGeneratorService = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("./ai.service");
const prisma_service_1 = require("../prisma/prisma.service");
const review_builder_1 = require("./builders/review.builder");
const instagram_builder_1 = require("./builders/instagram.builder");
const youtube_builder_1 = require("./builders/youtube.builder");
const reel_script_builder_1 = require("./builders/reel-script.builder");
const strategy_builder_1 = require("./builders/strategy.builder");
const settings_service_1 = require("../settings/settings.service");
const analytics_engine_service_1 = require("../analytics/analytics-engine.service");
let ContentGeneratorService = class ContentGeneratorService {
    aiService;
    prisma;
    settingsService;
    analyticsEngineService;
    constructor(aiService, prisma, settingsService, analyticsEngineService) {
        this.aiService = aiService;
        this.prisma = prisma;
        this.settingsService = settingsService;
        this.analyticsEngineService = analyticsEngineService;
    }
    async generateAll(projectId) {
        const movie = await this.prisma.movieProject.findUnique({
            where: { id: projectId },
            include: { assets: true }
        });
        if (!movie)
            throw new common_1.NotFoundException('Project not found');
        const reviewContent = await this.generateType(movie, 'REVIEW');
        const [instagram, youtube] = await Promise.all([
            this.generateType(movie, 'INSTAGRAM', reviewContent),
            this.generateType(movie, 'YOUTUBE', reviewContent),
        ]);
        return { review: reviewContent, instagram, youtube };
    }
    async generateSpecific(projectId, type) {
        const movie = await this.prisma.movieProject.findUnique({
            where: { id: projectId },
            include: { assets: true }
        });
        if (!movie)
            throw new common_1.NotFoundException('Project not found');
        return this.generateType(movie, type.toUpperCase());
    }
    async generateType(movie, type, existingReviewContext) {
        let prompt = '';
        let reviewContext = existingReviewContext;
        if (type !== 'REVIEW' && !reviewContext) {
            const reviewGen = await this.prisma.generatedContent.findFirst({
                where: { projectId: movie.id, type: 'REVIEW', status: 'SUCCESS' },
                orderBy: { version: 'desc' }
            });
            if (reviewGen) {
                reviewContext = JSON.parse(reviewGen.content);
            }
        }
        const voiceProfile = await this.settingsService.getActiveVoiceProfile();
        const profileText = voiceProfile
            ? `\nYOUR REVIEWING VOICE:\nLanguage: ${voiceProfile.language}\nStyle: ${voiceProfile.style}\nStructure: ${voiceProfile.structure}\nConstraints: ${voiceProfile.constraints}`
            : '';
        switch (type) {
            case 'REVIEW':
                prompt = review_builder_1.ReviewPromptBuilder.build(movie) + profileText;
                break;
            case 'INSTAGRAM':
                prompt = instagram_builder_1.InstagramPromptBuilder.build(movie, reviewContext || {}) + profileText;
                break;
            case 'YOUTUBE':
                prompt = youtube_builder_1.YouTubePromptBuilder.build(movie, reviewContext || {}) + profileText;
                break;
            case 'REEL_SCRIPT':
                prompt = reel_script_builder_1.ReelScriptPromptBuilder.build(movie, reviewContext || {}) + profileText;
                break;
            case 'CONTENT_STRATEGY':
                const existingContent = await this.prisma.generatedContent.findMany({ where: { projectId: movie.id } });
                const schedules = await this.prisma.contentSchedule.findMany({ where: { projectId: movie.id } });
                const findings = await this.analyticsEngineService.generateFindings(movie.id);
                prompt = strategy_builder_1.ContentStrategyBuilder.build(movie, reviewContext || {}, existingContent, schedules, findings) + profileText;
                break;
            default:
                throw new Error('Invalid generation type');
        }
        const content = await this.aiService.generateStructuredContent(prompt);
        const existing = await this.prisma.generatedContent.findFirst({
            where: { projectId: movie.id, type },
            orderBy: { version: 'desc' }
        });
        const version = existing ? existing.version + 1 : 1;
        await this.prisma.generatedContent.create({
            data: {
                projectId: movie.id,
                type,
                version,
                content: JSON.stringify(content),
                model: 'gemini-1.5-pro'
            }
        });
        return content;
    }
};
exports.ContentGeneratorService = ContentGeneratorService;
exports.ContentGeneratorService = ContentGeneratorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_service_1.AiService,
        prisma_service_1.PrismaService,
        settings_service_1.SettingsService,
        analytics_engine_service_1.AnalyticsEngineService])
], ContentGeneratorService);
//# sourceMappingURL=content-generator.service.js.map