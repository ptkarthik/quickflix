import { PrismaService } from '../prisma/prisma.service';
export declare class AssetsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createAsset(data: {
        projectId: string;
        type: string;
        filename: string;
        originalName: string;
        mimeType: string;
        path: string;
        isGenerated?: boolean;
        width?: number;
        height?: number;
        template?: string;
        format?: string;
    }): import(".prisma/client").Prisma.Prisma__MovieAssetClient<{
        id: string;
        createdAt: Date;
        projectId: string;
        type: string;
        filename: string;
        originalName: string;
        mimeType: string;
        path: string;
        isGenerated: boolean;
        width: number | null;
        height: number | null;
        template: string | null;
        format: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    findByProject(projectId: string): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        projectId: string;
        type: string;
        filename: string;
        originalName: string;
        mimeType: string;
        path: string;
        isGenerated: boolean;
        width: number | null;
        height: number | null;
        template: string | null;
        format: string | null;
    }[]>;
    findAll(): import(".prisma/client").Prisma.PrismaPromise<({
        project: {
            title: string;
        };
    } & {
        id: string;
        createdAt: Date;
        projectId: string;
        type: string;
        filename: string;
        originalName: string;
        mimeType: string;
        path: string;
        isGenerated: boolean;
        width: number | null;
        height: number | null;
        template: string | null;
        format: string | null;
    })[]>;
}
