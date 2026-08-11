export interface PublishingProvider {
  publish(
    accountId: string, 
    contentId: string, 
    contentType: string, 
    assetPath?: string, 
    text?: string
  ): Promise<{ success: boolean; externalId?: string; error?: string }>;
}
