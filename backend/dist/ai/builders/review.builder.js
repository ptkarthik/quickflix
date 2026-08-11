"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewPromptBuilder = void 0;
class ReviewPromptBuilder {
    static build(movie) {
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
      You are an expert movie critic.
      ${researchContext}

      USER'S REVIEW
      ------------
      Movie: ${movie.title} (${movie.releaseYear || 'Unknown Year'})
      Genre: ${movie.genre || 'Unknown'}
      User's Rating: ${movie.rating} / 5
      User's Initial Hook/Thoughts: "${movie.oneLiner || 'None'}"
      User's Short Review: "${movie.review || 'None'}"

      RULE:
      The User's Rating (${movie.rating}) is the absolute source of truth. Your review MUST be written around this assessment. Do not invent a different opinion. Enhance and expand the user's opinion.
      Use factual research only to improve accuracy and context.

      Please output a JSON object with exactly the following structure:
      {
        "oneLiner": "A punchy, engaging one-liner summarizing the review.",
        "twoLiner": "A slightly more descriptive hook (2 sentences).",
        "shortReview": "A 50-100 word concise review.",
        "detailedReview": "A 300-500 word detailed review expanding on the user's thoughts.",
        "pros": ["Pro 1", "Pro 2", "Pro 3"],
        "cons": ["Con 1", "Con 2"],
        "verdict": "A concise recommendation."
      }
    `;
    }
}
exports.ReviewPromptBuilder = ReviewPromptBuilder;
//# sourceMappingURL=review.builder.js.map