import { PrismaService } from '../prisma/prisma.service';
export interface StatisticalFinding {
    category: string;
    insight: string;
    confidence: 'EARLY_SIGNAL' | 'STRONG_SIGNAL' | 'INSUFFICIENT_DATA';
    details: string;
}
export declare class AnalyticsEngineService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    generateFindings(projectId: string): Promise<StatisticalFinding[]>;
    private analyzeHooks;
    private analyzeFormats;
}
