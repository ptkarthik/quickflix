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
var AnalyticsEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsEngineService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AnalyticsEngineService = AnalyticsEngineService_1 = class AnalyticsEngineService {
    prisma;
    logger = new common_1.Logger(AnalyticsEngineService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async generateFindings(projectId) {
        const performances = await this.prisma.contentPerformance.findMany({
            where: { schedule: { projectId } },
            include: { schedule: true }
        });
        if (performances.length < 5) {
            return [{
                    category: 'GENERAL',
                    insight: 'Not enough historical data yet.',
                    confidence: 'INSUFFICIENT_DATA',
                    details: 'Post more content to generate insights.'
                }];
        }
        const findings = [];
        const hookFinding = this.analyzeHooks(performances);
        if (hookFinding)
            findings.push(hookFinding);
        const formatFinding = this.analyzeFormats(performances);
        if (formatFinding)
            findings.push(formatFinding);
        return findings;
    }
    analyzeHooks(performances) {
        const hookStats = {};
        performances.forEach(p => {
            const hook = p.schedule.hookType;
            if (hook === 'NONE')
                return;
            if (!hookStats[hook])
                hookStats[hook] = { posts: 0, totalRetention: 0 };
            hookStats[hook].posts += 1;
            hookStats[hook].totalRetention += p.retention;
        });
        const hooks = Object.keys(hookStats).map(h => ({
            name: h,
            posts: hookStats[h].posts,
            avgRetention: hookStats[h].totalRetention / hookStats[h].posts
        })).filter(h => h.posts >= 3);
        if (hooks.length < 2)
            return null;
        hooks.sort((a, b) => b.avgRetention - a.avgRetention);
        const best = hooks[0];
        const second = hooks[1];
        const difference = best.avgRetention - second.avgRetention;
        if (difference < 2)
            return null;
        const confidence = best.posts > 10 && second.posts > 10 ? 'STRONG_SIGNAL' : 'EARLY_SIGNAL';
        return {
            category: 'HOOK',
            insight: `${best.name.replace(/_/g, ' ')} hooks show higher retention than ${second.name.replace(/_/g, ' ')} hooks.`,
            confidence,
            details: `Across ${best.posts} posts, ${best.name} hooks averaged ${best.avgRetention.toFixed(1)}% retention compared to ${second.avgRetention.toFixed(1)}% for ${second.name} hooks (Difference: +${difference.toFixed(1)}%).`
        };
    }
    analyzeFormats(performances) {
        const formatStats = {};
        performances.forEach(p => {
            const format = p.schedule.templateType;
            if (format === 'NONE')
                return;
            if (!formatStats[format])
                formatStats[format] = { posts: 0, totalViews: 0, totalSaves: 0 };
            formatStats[format].posts += 1;
            formatStats[format].totalViews += p.views;
            formatStats[format].totalSaves += p.saves;
        });
        const formats = Object.keys(formatStats).map(f => {
            const stats = formatStats[f];
            return {
                name: f,
                posts: stats.posts,
                avgViews: stats.totalViews / stats.posts,
                saveRate: (stats.totalSaves / stats.totalViews) * 100
            };
        }).filter(f => f.posts >= 3);
        if (formats.length < 2)
            return null;
        const highSaveFormat = formats.reduce((prev, current) => (prev.saveRate > current.saveRate) ? prev : current);
        const avgViewFormat = formats.reduce((prev, current) => (prev.avgViews > current.avgViews) ? prev : current);
        if (highSaveFormat.name !== avgViewFormat.name && highSaveFormat.saveRate > (avgViewFormat.saveRate * 1.5)) {
            const confidence = highSaveFormat.posts > 8 ? 'STRONG_SIGNAL' : 'EARLY_SIGNAL';
            return {
                category: 'FORMAT',
                insight: `${highSaveFormat.name.replace(/_/g, ' ')}s have lower reach but significantly higher save rates.`,
                confidence,
                details: `${highSaveFormat.name.replace(/_/g, ' ')}s average ${highSaveFormat.saveRate.toFixed(2)}% save rate (vs ${avgViewFormat.saveRate.toFixed(2)}% for ${avgViewFormat.name.replace(/_/g, ' ')}), making them useful for evergreen engagement.`
            };
        }
        return null;
    }
};
exports.AnalyticsEngineService = AnalyticsEngineService;
exports.AnalyticsEngineService = AnalyticsEngineService = AnalyticsEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AnalyticsEngineService);
//# sourceMappingURL=analytics-engine.service.js.map