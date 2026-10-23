export interface RatingData {
    source: string;
    rating: number;
    maximumRating: number;
    voteCount: number;
    timestamp: number;
    normalized: number;
}
export declare class RatingAggregationService {
    getRating(manualRating: number | null, sources: RatingData[]): {
        mode: 'MANUAL' | 'AGGREGATED' | 'NOT_AVAILABLE';
        displayString: string;
        value: number | null;
    };
}
