export interface OmdbMovieMetadata {
    imdbId?: string;
    title?: string;
    year?: number;
    releasedDate?: string;
    boxOffice?: string;
    imdbRating?: string;
    genre?: string[];
    director?: string;
    actors?: string[];
    isValid: boolean;
}
export declare class OmdbProvider {
    private readonly logger;
    private readonly apiKey;
    private readonly baseUrl;
    private readonly http;
    getByTitle(title: string, year?: number): Promise<OmdbMovieMetadata>;
    getByImdbId(imdbId: string): Promise<OmdbMovieMetadata>;
    private normalizeOmdbResponse;
}
