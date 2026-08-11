import { SocialService } from './social.service';
import { PublishingService } from './publishing.service';
export declare class SocialController {
    private readonly socialService;
    private readonly publishingService;
    constructor(socialService: SocialService, publishingService: PublishingService);
    getAccounts(): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        platform: string;
        accountName: string;
        accountId: string | null;
        accessToken: string | null;
        refreshToken: string | null;
        expiresAt: Date | null;
        isMock: boolean;
    }[]>;
    mockConnect(body: {
        platform: string;
        accountName: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        platform: string;
        accountName: string;
        accountId: string | null;
        accessToken: string | null;
        refreshToken: string | null;
        expiresAt: Date | null;
        isMock: boolean;
    }>;
    publish(id: string): Promise<{
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
}
