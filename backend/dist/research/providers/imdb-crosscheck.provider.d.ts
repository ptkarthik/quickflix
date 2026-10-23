export interface ImdbMatchResult {
    imdbId?: string;
    title?: string;
    year?: number;
    entityType?: string;
    matched: boolean;
}
export declare class ImdbCrosscheckProvider {
    private readonly logger;
    private readonly http;
    findMatch(title: string, year?: number): Promise<ImdbMatchResult>;
}
