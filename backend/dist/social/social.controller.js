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
exports.SocialController = void 0;
const common_1 = require("@nestjs/common");
const social_service_1 = require("./social.service");
const publishing_service_1 = require("./publishing.service");
let SocialController = class SocialController {
    socialService;
    publishingService;
    constructor(socialService, publishingService) {
        this.socialService = socialService;
        this.publishingService = publishingService;
    }
    getAccounts() {
        return this.socialService.getAccounts();
    }
    mockConnect(body) {
        return this.socialService.mockConnect(body.platform, body.accountName);
    }
    publish(id) {
        return this.publishingService.publishSchedule(id);
    }
};
exports.SocialController = SocialController;
__decorate([
    (0, common_1.Get)('social/accounts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "getAccounts", null);
__decorate([
    (0, common_1.Post)('social/mock-connect'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "mockConnect", null);
__decorate([
    (0, common_1.Post)('calendar/:id/publish'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "publish", null);
exports.SocialController = SocialController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [social_service_1.SocialService,
        publishing_service_1.PublishingService])
], SocialController);
//# sourceMappingURL=social.controller.js.map