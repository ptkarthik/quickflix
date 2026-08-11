"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReelScriptPromptBuilder = void 0;
class ReelScriptPromptBuilder {
    static build(movie, reviewContent) {
        let researchContext = '';
        if (movie.researchData) {
            try {
                const data = typeof movie.researchData === 'string' ? JSON.parse(movie.researchData) : movie.researchData;
                researchContext = `
FACTUAL RESEARCH
----------------
Title: ${data.title}
Director: ${data.director}
Cast: ${data.cast.join(', ')}
Synopsis: ${data.synopsis}
Genres: ${data.genres.join(', ')}
`;
            }
            catch (e) { }
        }
        let assetsManifest = 'No assets available. Use generic visual descriptions.';
        if (movie.assets && movie.assets.length > 0) {
            assetsManifest = 'AVAILABLE ASSETS:\n' + movie.assets.map((a) => `${a.id} -> ${a.type} (${a.originalName})`).join('\n');
        }
        return `
      You are an expert short-form video scriptwriter (TikTok, Instagram Reels, YouTube Shorts) and video editor.
      ${researchContext}

      ${assetsManifest}

      USER'S REVIEW
      ------------
      Movie: ${movie.title}
      Rating: ${movie.rating} / 5
      Review: ${reviewContent.shortReview || movie.review || 'No review available'}

      RULE:
      Never alter the user's rating or opinion.
      Use factual research only to improve accuracy and context.
      When suggesting visuals, use the exact assetId from AVAILABLE ASSETS if possible, otherwise use generic descriptions (e.g. "Text Graphic").

      Generate a 60-second video production blueprint separated into specific timed scenes.
      Please output a JSON array of scene objects with exactly the following structure:
      [
        {
          "startTime": "0s",
          "endTime": "3s",
          "visual": {
            "type": "asset or text",
            "assetId": "exact id from available assets, or null",
            "direction": "e.g., Close crop / slow zoom"
          },
          "voiceover": "Script to be spoken",
          "textOverlay": "Text shown on screen",
          "transition": "e.g., Hard cut, Fade"
        }
      ]
    `;
    }
}
exports.ReelScriptPromptBuilder = ReelScriptPromptBuilder;
//# sourceMappingURL=reel-script.builder.js.map