import { CalendarService } from './calendar.service';
export declare class CalendarController {
    private readonly calendarService;
    constructor(calendarService: CalendarService);
    create(body: {
        projectId: string;
        title: string;
        contentType: string;
        contentId?: string;
        assetId?: string;
        scheduledFor: string;
        platform: string;
        notes?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        title: string;
        contentType: string;
        contentId: string | null;
        assetId: string | null;
        scheduledFor: Date;
        status: string;
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
    findAll(): Promise<({
        project: {
            title: string;
        };
        asset: {
            path: string;
            template: string | null;
            format: string | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        title: string;
        contentType: string;
        contentId: string | null;
        assetId: string | null;
        scheduledFor: Date;
        status: string;
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
    })[]>;
    updateStatus(id: string, status: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        title: string;
        contentType: string;
        contentId: string | null;
        assetId: string | null;
        scheduledFor: Date;
        status: string;
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
