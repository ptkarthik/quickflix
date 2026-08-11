"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentStrategyBuilder = void 0;
class ContentStrategyBuilder {
    static build(movie, reviewContent, existingContent, schedules) {
        const existingTypes = existingContent.map(c => c.type).join(', ') || 'None';
        let assetsManifest = 'No assets available.';
        if (movie.assets && movie.assets.length > 0) {
            assetsManifest = 'AVAILABLE ASSETS:\n' + movie.assets.map((a) => `${a.id} -> ${a.type} (isGenerated: ${a.isGenerated})`).join('\n');
        }
        let scheduleManifest = 'SCHEDULED ITEMS:\n';
        if (schedules && schedules.length > 0) {
            scheduleManifest += schedules.map(s => `- Day ${s.scheduledFor}: ${s.title} (${s.platform})`).join('\n');
        }
        else {
            scheduleManifest += 'None';
        }
        return `
      You are an expert Social Media Content Strategist for movie reviews.
      
      MOVIE CONTEXT
      ------------
      Title: ${movie.title}
      Rating: ${movie.rating} / 5
      Approved Review: ${reviewContent?.detailedReview || reviewContent?.shortReview || 'N/A'}
      
      EXISTING STATE
      -------------
      Already Generated AI Content Types: ${existingTypes}
      ${assetsManifest}
      ${scheduleManifest}

      RULE:
      Based on the movie's rating, your review, and what content/assets ALREADY exist, recommend a high-value publishing sequence.
      DO NOT recommend content types that already exist in the schedule (unless it's a completely different platform/format and makes sense).
      Focus on a logical flow (e.g., Awareness -> Engagement -> Deep Dive).

      Available Formats to Recommend:
      - REEL (Instagram/TikTok/YouTube Shorts)
      - REVIEW_CARD (Instagram Feed)
      - QUOTE_CARD (Instagram Feed)
      - RATING_CARD (Instagram Feed)
      - MINIMAL_POSTER (Instagram Feed)
      - TOP_5_REASONS (Instagram Feed/Story)
      - YOUTUBE_REVIEW (Long form video)

      Please output a JSON object with exactly the following structure:
      {
        "rationale": "A brief 2-sentence explanation of why this strategy fits this specific movie and review.",
        "schedule": [
          {
            "id": "A unique identifier for this recommendation (e.g. format_dayOffset_randomHex)",
            "dayOffset": 1, 
            "format": "REEL",
            "purpose": "Awareness / Hook",
            "notes": "Start with a controversial hook based on the 3.5 rating."
          },
          {
            "id": "format_dayOffset_randomHex2",
            "dayOffset": 3,
            "format": "REVIEW_CARD",
            "purpose": "Rating reinforcement",
            "notes": "Post the detailed review card for the core audience."
          }
        ]
      }
    `;
    }
}
exports.ContentStrategyBuilder = ContentStrategyBuilder;
//# sourceMappingURL=strategy.builder.js.map