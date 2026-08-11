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
exports.AiController = void 0;
const common_1 = require("@nestjs/common");
const content_generator_service_1 = require("./content-generator.service");
const prisma_service_1 = require("../prisma/prisma.service");
let AiController = class AiController {
    generatorService;
    prisma;
    constructor(generatorService, prisma) {
        this.generatorService = generatorService;
        this.prisma = prisma;
    }
    async generateAll(id) {
        return this.generatorService.generateAll(id);
    }
    async generateSpecific(id, type) {
        return this.generatorService.generateSpecific(id, type);
    }
    async saveEditedContent(id, type, body) {
        const uppercaseType = type.toUpperCase();
        return this.prisma.editedContent.upsert({
            where: {
                projectId_type: { projectId: id, type: uppercaseType }
            },
            update: {
                content: JSON.stringify(body.content)
            },
            create: {
                projectId: id,
                type: uppercaseType,
                content: JSON.stringify(body.content)
            }
        });
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Post)('generate'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "generateAll", null);
__decorate([
    (0, common_1.Post)('generate/:type'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "generateSpecific", null);
__decorate([
    (0, common_1.Patch)('content/:type'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('type')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "saveEditedContent", null);
exports.AiController = AiController = __decorate([
    (0, common_1.Controller)('projects/:id'),
    __metadata("design:paramtypes", [content_generator_service_1.ContentGeneratorService,
        prisma_service_1.PrismaService])
], AiController);
//# sourceMappingURL=ai.controller.js.map