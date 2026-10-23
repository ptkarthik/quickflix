import { Injectable } from '@nestjs/common';

export interface RatingData {
  source: string;
  rating: number;
  maximumRating: number;
  voteCount: number;
  timestamp: number;
  normalized: number; // 5-point scale
}

@Injectable()
export class RatingAggregationService {
  
  getRating(manualRating: number | null, sources: RatingData[]): {
    mode: 'MANUAL' | 'AGGREGATED' | 'NOT_AVAILABLE';
    displayString: string;
    value: number | null;
  } {
    // MODE A - MANUAL RATING
    if (manualRating !== null && manualRating !== undefined) {
      return {
        mode: 'MANUAL',
        displayString: `⭐ ${manualRating.toFixed(2)}/5`,
        value: manualRating
      };
    }

    // MODE B - AUTOMATIC RATING
    if (!sources || sources.length === 0) {
      return {
        mode: 'NOT_AVAILABLE',
        displayString: 'RATING NOT AVAILABLE',
        value: null
      };
    }

    let totalScore = 0;
    let totalWeight = 0;

    for (const src of sources) {
       // Normalize to 5-point
       const normalized = (src.rating / src.maximumRating) * 5.0;
       
       // Weight by vote count (simple log scale or fixed)
       const weight = src.voteCount > 1000 ? 1.5 : (src.voteCount > 0 ? 1.0 : 0.5);
       
       totalScore += (normalized * weight);
       totalWeight += weight;
    }

    if (totalWeight === 0) {
      return {
        mode: 'NOT_AVAILABLE',
        displayString: 'RATING NOT AVAILABLE',
        value: null
      };
    }

    const aggregated = totalScore / totalWeight;
    return {
      mode: 'AGGREGATED',
      displayString: `⭐ ${aggregated.toFixed(2)}/5 (Aggregated)`,
      value: aggregated
    };
  }
}
