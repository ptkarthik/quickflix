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
var SocialService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let SocialService = SocialService_1 = class SocialService {
    prisma;
    logger = new common_1.Logger(SocialService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAccounts() {
        return this.prisma.socialAccount.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }
    async mockConnect(platform, accountName) {
        this.logger.log(`Mock OAuth connecting to ${platform} for ${accountName}`);
        return this.prisma.socialAccount.create({
            data: {
                platform,
                accountName,
                accountId: `mock_${platform.toLowerCase()}_${Date.now()}`,
                accessToken: `mock_access_token_${Date.now()}`,
                refreshToken: `mock_refresh_token_${Date.now()}`,
                expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
                status: 'CONNECTED',
                isMock: true
            }
        });
    }
};
exports.SocialService = SocialService;
exports.SocialService = SocialService = SocialService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SocialService);
//# sourceMappingURL=social.service.js.map