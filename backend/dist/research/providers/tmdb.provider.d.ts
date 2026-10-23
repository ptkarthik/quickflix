import { MovieResearchProvider, ResearchData } from './research-provider.interface';
export declare class TmdbProvider implements MovieResearchProvider {
    private readonly logger;
    private readonly apiKey;
    private readonly baseUrl;
    private readonly http;
    private readonly indianLangs;
    private cachedDiscoverData;
    private cacheTimestamp;
    searchMovie(title: string, year?: number): Promise<any[]>;
    getMovieDetails(id: string | number): Promise<ResearchData>;
    getMovieImages(id: string | number): Promise<any>;
    discoverAllRaw(): Promise<{
        results: any[];
        rawMap: Map<string, any>;
    }>;
    discoverAll(): Promise<{
        upcomingTheater: any[];
        nowInTheater: any[];
        upcomingOTT: any[];
        nowStreaming: any[];
        audit?: any;
    }>;
    private discoverExhaustive;
    private getIndustry;
    private getFullCuratedData;
}
