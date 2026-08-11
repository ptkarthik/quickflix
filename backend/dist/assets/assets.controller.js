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
exports.AssetsController = void 0;
const common_1 = require("@nestjs/common");
const assets_service_1 = require("./assets.service");
const platform_express_1 = require("@nestjs/platform-express");
let AssetsController = class AssetsController {
    assetsService;
    constructor(assetsService) {
        this.assetsService = assetsService;
    }
    uploadFile(projectId, type, file) {
        return this.assetsService.createAsset({
            projectId,
            type: type || 'other',
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            path: `uploads/${projectId}/${file.filename}`,
        });
    }
    uploadGenerated(projectId, type, template, format, width, height, file) {
        return this.assetsService.createAsset({
            projectId,
            type: type || 'GENERATED_CREATIVE',
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            path: `uploads/${projectId}/${file.filename}`,
            isGenerated: true,
            template,
            format,
            width: width ? parseInt(width, 10) : undefined,
            height: height ? parseInt(height, 10) : undefined
        });
    }
    findByProject(projectId) {
        return this.assetsService.findByProject(projectId);
    }
    findAll() {
        return this.assetsService.findAll();
    }
};
exports.AssetsController = AssetsController;
__decorate([
    (0, common_1.Post)(':projectId'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)('type')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], AssetsController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Post)(':projectId/generated'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)('type')),
    __param(2, (0, common_1.Body)('template')),
    __param(3, (0, common_1.Body)('format')),
    __param(4, (0, common_1.Body)('width')),
    __param(5, (0, common_1.Body)('height')),
    __param(6, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, Object]),
    __metadata("design:returntype", void 0)
], AssetsController.prototype, "uploadGenerated", null);
__decorate([
    (0, common_1.Get)('project/:projectId'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AssetsController.prototype, "findByProject", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AssetsController.prototype, "findAll", null);
exports.AssetsController = AssetsController = __decorate([
    (0, common_1.Controller)('assets'),
    __metadata("design:paramtypes", [assets_service_1.AssetsService])
], AssetsController);
//# sourceMappingURL=assets.controller.js.map