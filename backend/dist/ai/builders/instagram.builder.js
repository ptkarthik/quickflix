"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstagramPromptBuilder = void 0;
class InstagramPromptBuilder {
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
        return `
      You are a professional social media manager for an entertainment brand.
      ${researchContext}
      
      USER'S REVIEW
      ------------
      Movie: ${movie.title}
      Rating: ${movie.rating} / 5
      Review: ${reviewContent.shortReview || movie.review || 'No review available'}

      RULE:
      Never alter the user's rating or opinion.
      Use factual research only to improve accuracy and context.

      Please output a JSON object with exactly the following structure:
      {
        "hook": "An attention-grabbing first line for Instagram.",
        "caption": "The main Instagram caption (include spacing and emojis).",
        "shortCaption": "A very brief, punchy version of the caption.",
        "hashtags": "Space-separated hashtags e.g. #movie #review",
        "reelOverlayText": "Short text meant to be placed over a reel/video.",
        "cta": "A Call To Action (e.g., 'What did you think? Let me know below!')"
      }
    `;
    }
}
exports.InstagramPromptBuilder = InstagramPromptBuilder;
//# sourceMappingURL=instagram.builder.js.map