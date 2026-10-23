import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AnalyticsEngineService } from '../analytics/analytics-engine.service';
export declare class ContentGeneratorService {
    private readonly aiService;
    private readonly prisma;
    private readonly settingsService;
    private readonly analyticsEngineService;
    constructor(aiService: AiService, prisma: PrismaService, settingsService: SettingsService, analyticsEngineService: AnalyticsEngineService);
    generateAll(projectId: string): Promise<{
        review: {
            synopsis: string;
            oneLiner: string;
            rating: number;
            detailedReview: string;
            twoLiner?: undefined;
            shortReview?: undefined;
            pros?: undefined;
            cons?: undefined;
            verdict?: undefined;
        } | {
            oneLiner: string;
            twoLiner: string;
            shortReview: string;
            detailedReview: string;
            pros: string[];
            cons: string[];
            verdict: string;
            synopsis?: undefined;
            rating?: undefined;
        };
        instagram: {
            synopsis: string;
            oneLiner: string;
            rating: number;
            detailedReview: string;
            twoLiner?: undefined;
            shortReview?: undefined;
            pros?: undefined;
            cons?: undefined;
            verdict?: undefined;
        } | {
            oneLiner: string;
            twoLiner: string;
            shortReview: string;
            detailedReview: string;
            pros: string[];
            cons: string[];
            verdict: string;
            synopsis?: undefined;
            rating?: undefined;
        };
        youtube: {
            synopsis: string;
            oneLiner: string;
            rating: number;
            detailedReview: string;
            twoLiner?: undefined;
            shortReview?: undefined;
            pros?: undefined;
            cons?: undefined;
            verdict?: undefined;
        } | {
            oneLiner: string;
            twoLiner: string;
            shortReview: string;
            detailedReview: string;
            pros: string[];
            cons: string[];
            verdict: string;
            synopsis?: undefined;
            rating?: undefined;
        };
    }>;
    generateSpecific(projectId: string, type: string): Promise<{
        synopsis: string;
        oneLiner: string;
        rating: number;
        detailedReview: string;
        twoLiner?: undefined;
        shortReview?: undefined;
        pros?: undefined;
        cons?: undefined;
        verdict?: undefined;
    } | {
        oneLiner: string;
        twoLiner: string;
        shortReview: string;
        detailedReview: string;
        pros: string[];
        cons: string[];
        verdict: string;
        synopsis?: undefined;
        rating?: undefined;
    }>;
    private generateType;
}
