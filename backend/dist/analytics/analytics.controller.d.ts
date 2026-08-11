import { AnalyticsService } from './analytics.service';
export declare class AnalyticsController {
    private readonly analyticsService;
    constructor(analyticsService: AnalyticsService);
    seed(): Promise<{
        message: string;
    }>;
    getDashboard(): Promise<{
        overview: {
            totalViews: number;
            avgEngagement: number;
            avgRetention: number;
            posts: number;
            totalShares: number;
            totalSaves: number;
        };
        byFormat: {
            format: string;
            views: number;
            engagement: number;
        }[];
        byMovie: {
            movie: string;
            views: number;
            engagement: number;
        }[];
        individual: {
            id: string;
            title: string;
            movie: string;
            format: string;
            publishedAt: Date | null;
            views: number;
            likes: number;
            shares: number;
            saves: number;
            retention: number;
            isSimulated: boolean;
        }[];
    }>;
}
