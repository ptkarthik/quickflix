import { MovieResearchProvider, ResearchData } from './research-provider.interface';
export declare class TmdbProvider implements MovieResearchProvider {
    private readonly logger;
    private readonly apiKey;
    private readonly baseUrl;
    searchMovie(title: string, year?: number): Promise<any[]>;
    getMovieDetails(id: string | number): Promise<ResearchData>;
}
