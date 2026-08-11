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
var PublishingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const mock_instagram_provider_1 = require("./providers/mock-instagram.provider");
const mock_youtube_provider_1 = require("./providers/mock-youtube.provider");
let PublishingService = PublishingService_1 = class PublishingService {
    prisma;
    logger = new common_1.Logger(PublishingService_1.name);
    instagramProvider = new mock_instagram_provider_1.MockInstagramProvider();
    youtubeProvider = new mock_youtube_provider_1.MockYouTubeProvider();
    constructor(prisma) {
        this.prisma = prisma;
    }
    getProvider(platform) {
        if (platform === 'YOUTUBE')
            return this.youtubeProvider;
        return this.instagramProvider;
    }
    async publishSchedule(scheduleId) {
        const schedule = await this.prisma.contentSchedule.findUnique({
            where: { id: scheduleId },
            include: { asset: true, project: true }
        });
        if (!schedule)
            throw new Error('Schedule not found');
        await this.prisma.contentSchedule.update({
            where: { id: scheduleId },
            data: {
                status: 'PUBLISHING',
                lastPublishAttemptAt: new Date(),
                publishAttempts: { increment: 1 }
            }
        });
        const platformType = schedule.platform === 'YOUTUBE' ? 'YOUTUBE' : 'INSTAGRAM';
        const account = await this.prisma.socialAccount.findFirst({
            where: { platform: platformType, status: 'CONNECTED' }
        });
        if (!account) {
            return this.markFailed(scheduleId, `No connected ${platformType} account found.`);
        }
        const provider = this.getProvider(schedule.platform);
        try {
            this.logger.log(`Publishing ${schedule.contentType} to ${account.platform}...`);
            const result = await provider.publish(account.id, schedule.id, schedule.contentType, schedule.asset?.path, schedule.notes || '');
            if (result.success) {
                return this.markSuccess(scheduleId, result.externalId);
            }
            else {
                return this.markFailed(scheduleId, result.error || 'Unknown publishing error');
            }
        }
        catch (err) {
            this.logger.error(`Publishing failed: ${err.message}`);
            return this.markFailed(scheduleId, err.message);
        }
    }
    async markSuccess(scheduleId, externalId) {
        return this.prisma.contentSchedule.update({
            where: { id: scheduleId },
            data: {
                status: 'PUBLISHED',
                publishedAt: new Date(),
                externalPostId: externalId,
                publishError: null
            }
        });
    }
    async markFailed(scheduleId, error) {
        return this.prisma.contentSchedule.update({
            where: { id: scheduleId },
            data: {
                status: 'PUBLISH_FAILED',
                publishError: error
            }
        });
    }
};
exports.PublishingService = PublishingService;
exports.PublishingService = PublishingService = PublishingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PublishingService);
//# sourceMappingURL=publishing.service.js.map