import { PrismaService } from '../prisma/prisma.service';
export declare class AnalyticsService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    seedSimulatedData(): Promise<{
        message: string;
    }>;
    getDashboardData(): Promise<{
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
