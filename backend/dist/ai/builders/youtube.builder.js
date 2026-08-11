"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubePromptBuilder = void 0;
class YouTubePromptBuilder {
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
      You are a YouTube growth expert for a movie review channel.
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
        "titles": ["SEO Title 1", "Clickable Title 2", "Review Title 3"],
        "description": "A full YouTube description including the review summary and standard boilerplate.",
        "tags": "Comma-separated tags for YouTube SEO.",
        "shortDescription": "A 1-2 sentence description for Shorts or quick reading.",
        "pinnedComment": "An engaging comment to pin at the top of the video."
      }
    `;
    }
}
exports.YouTubePromptBuilder = YouTubePromptBuilder;
//# sourceMappingURL=youtube.builder.js.map