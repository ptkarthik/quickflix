export declare class AiService {
    private genAI;
    constructor();
    private getDynamicIndianOttContent;
    generateStructuredContent(prompt: string): Promise<{
        synopsis: string;
        oneLiner: string;
        rating: number;
        detailedReview: string;
        twoLiner?: undefined;
        shortReview?: undefined;
        pros?: undefined;
        cons?: undefined;
        verdict?: undefined;
    } | {
        oneLiner: string;
        twoLiner: string;
        shortReview: string;
        detailedReview: string;
        pros: string[];
        cons: string[];
        verdict: string;
        synopsis?: undefined;
        rating?: undefined;
    }>;
    generatePosterConcepts(movieData: any, userPrompt: string): Promise<{
        id: string;
        label: string;
        backgroundUrl: string;
        promptUsed: string;
    }[]>;
}
