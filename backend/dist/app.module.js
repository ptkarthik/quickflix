"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const ai_module_1 = require("./ai/ai.module");
const projects_module_1 = require("./projects/projects.module");
const assets_module_1 = require("./assets/assets.module");
const serve_static_1 = require("@nestjs/serve-static");
const path_1 = require("path");
const research_module_1 = require("./research/research.module");
const calendar_module_1 = require("./calendar/calendar.module");
const settings_module_1 = require("./settings/settings.module");
const social_module_1 = require("./social/social.module");
const analytics_module_1 = require("./analytics/analytics.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            ai_module_1.AiModule,
            projects_module_1.ProjectsModule,
            assets_module_1.AssetsModule,
            research_module_1.ResearchModule,
            calendar_module_1.CalendarModule,
            settings_module_1.SettingsModule,
            social_module_1.SocialModule,
            analytics_module_1.AnalyticsModule,
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: (0, path_1.join)(process.cwd(), 'uploads'),
                serveRoot: '/uploads',
            }),
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map