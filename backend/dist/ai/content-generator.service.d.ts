import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
export declare class ContentGeneratorService {
    private readonly aiService;
    private readonly prisma;
    private readonly settingsService;
    constructor(aiService: AiService, prisma: PrismaService, settingsService: SettingsService);
    generateAll(projectId: string): Promise<{
        review: any;
        instagram: any;
        youtube: any;
    }>;
    generateSpecific(projectId: string, type: string): Promise<any>;
    private generateType;
}
