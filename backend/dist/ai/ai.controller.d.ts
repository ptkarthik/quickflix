import { ContentGeneratorService } from './content-generator.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class AiController {
    private readonly generatorService;
    private readonly prisma;
    constructor(generatorService: ContentGeneratorService, prisma: PrismaService);
    generateAll(id: string): Promise<{
        review: any;
        instagram: any;
        youtube: any;
    }>;
    generateSpecific(id: string, type: string): Promise<any>;
    saveEditedContent(id: string, type: string, body: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        type: string;
        content: string;
    }>;
}
