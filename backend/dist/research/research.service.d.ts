import { TmdbProvider } from './providers/tmdb.provider';
import { PrismaService } from '../prisma/prisma.service';
export declare class ResearchService {
    private readonly tmdbProvider;
    private readonly prisma;
    constructor(tmdbProvider: TmdbProvider, prisma: PrismaService);
    search(projectId: string): Promise<any[]>;
    linkAndFetch(projectId: string, tmdbId: string | number): Promise<import("./providers/research-provider.interface").ResearchData>;
}
