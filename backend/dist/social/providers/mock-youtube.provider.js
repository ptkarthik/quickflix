"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockYouTubeProvider = void 0;
class MockYouTubeProvider {
    async publish(accountId, contentId, contentType, assetPath, text) {
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
exports.MockYouTubeProvider = MockYouTubeProvider;
//# sourceMappingURL=mock-youtube.provider.js.map