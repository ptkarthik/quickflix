import { PrismaService } from '../prisma/prisma.service';
export declare class PublishingService {
    private prisma;
    private readonly logger;
    private instagramProvider;
    private youtubeProvider;
    constructor(prisma: PrismaService);
    private getProvider;
    publishSchedule(scheduleId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        status: string;
        projectId: string;
        contentType: string;
        contentId: string | null;
        assetId: string | null;
        scheduledFor: Date;
        platform: string;
        notes: string | null;
        strategyItemId: string | null;
        hookType: string;
        templateType: string;
        voiceProfileId: string | null;
        publishedAt: Date | null;
        publishError: string | null;
        externalPostId: string | null;
        lastPublishAttemptAt: Date | null;
        publishAttempts: number;
    }>;
    private markSuccess;
    private markFailed;
}
