"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockInstagramProvider = void 0;
class MockInstagramProvider {
    async publish(accountId, contentId, contentType, assetPath, text) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (Math.random() < 0.1) {
            return { success: false, error: 'Instagram API rate limit exceeded.' };
        }
        return {
            success: true,
            externalId: `mock_ig_${Date.now()}`
        };
    }
}
exports.MockInstagramProvider = MockInstagramProvider;
//# sourceMappingURL=mock-instagram.provider.js.map