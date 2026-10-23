import { TmdbProvider } from './providers/tmdb.provider';
import { PrismaService } from '../prisma/prisma.service';
import { ReleaseDiscoveryService } from './services/release-discovery.service';
export declare class ResearchService {
    private readonly tmdbProvider;
    private readonly releaseDiscovery;
    private readonly prisma;
    constructor(tmdbProvider: TmdbProvider, releaseDiscovery: ReleaseDiscoveryService, prisma: PrismaService);
    search(projectId: string): Promise<any[]>;
    linkAndFetch(projectId: string, tmdbId: string | number): Promise<import("./providers/research-provider.interface").ResearchData>;
    getUpcomingOttIndia(): Promise<import("./services/release-discovery.service").CanonicalMovie[]>;
    discoverAll(): Promise<{
        upcomingTheater: import("./services/release-discovery.service").CanonicalMovie[];
        nowInTheater: import("./services/release-discovery.service").CanonicalMovie[];
        upcomingOTT: import("./services/release-discovery.service").CanonicalMovie[];
        nowStreaming: import("./services/release-discovery.service").CanonicalMovie[];
        pendingValidation: import("./services/release-discovery.service").CanonicalMovie[];
        unclassified: import("./services/release-discovery.service").CanonicalMovie[];
        audit: any;
    }>;
    getMovieDetails(tmdbId: string | number): Promise<import("./providers/research-provider.interface").ResearchData>;
}
