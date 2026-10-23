import { AssetsService } from './assets.service';
export declare class AssetsController {
    private readonly assetsService;
    constructor(assetsService: AssetsService);
    uploadFile(projectId: string, type: string, file: Express.Multer.File): import(".prisma/client").Prisma.Prisma__MovieAssetClient<{
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
    uploadGenerated(projectId: string, type: string, template: string, format: string, width: string, height: string, file: Express.Multer.File): import(".prisma/client").Prisma.Prisma__MovieAssetClient<{
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
    proxyImage(url: string, res: any): Promise<any>;
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
