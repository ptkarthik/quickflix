import { PublishingProvider } from './publishing-provider.interface';
export declare class MockYouTubeProvider implements PublishingProvider {
    publish(accountId: string, contentId: string, contentType: string, assetPath?: string, text?: string): Promise<{
        success: boolean;
        error: string;
        externalId?: undefined;
    } | {
        success: boolean;
        externalId: string;
        error?: undefined;
    }>;
}
