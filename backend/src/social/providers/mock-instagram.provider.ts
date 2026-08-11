import { PublishingProvider } from './publishing-provider.interface';

export class MockInstagramProvider implements PublishingProvider {
  async publish(accountId: string, contentId: string, contentType: string, assetPath?: string, text?: string) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate random failure (10% chance) to test retry logic
    if (Math.random() < 0.1) {
      return { success: false, error: 'Instagram API rate limit exceeded.' };
    }
    
    return {
      success: true,
      externalId: `mock_ig_${Date.now()}`
    };
  }
}
