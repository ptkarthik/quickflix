import { ResearchService } from './research.service';
export declare class ResearchController {
    private readonly researchService;
    constructor(researchService: ResearchService);
    search(id: string): Promise<any[]>;
    linkAndFetch(id: string, body: {
        tmdbId: string | number;
    }): Promise<import("./providers/research-provider.interface").ResearchData>;
}
