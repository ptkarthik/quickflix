import { PublishingProvider } from './publishing-provider.interface';

export class MockYouTubeProvider implements PublishingProvider {
  async publish(accountId: string, contentId: string, contentType: string, assetPath?: string, text?: string) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    if (Math.random() < 0.1) {
      return { success: false, error: 'YouTube API authentication error.' };
    }
    
    return {
      success: true,
      externalId: `mock_yt_${Date.now()}`
    };
  }
}
