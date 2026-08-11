import { PrismaService } from '../prisma/prisma.service';
export declare class SettingsService {
    private prisma;
    constructor(prisma: PrismaService);
    getVoiceProfiles(): Promise<{
        id: string;
        name: string;
        language: string;
        style: string;
        structure: string;
        constraints: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    createVoiceProfile(data: any): Promise<{
        id: string;
        name: string;
        language: string;
        style: string;
        structure: string;
        constraints: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    setActiveVoiceProfile(id: string): Promise<{
        id: string;
        name: string;
        language: string;
        style: string;
        structure: string;
        constraints: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    getActiveVoiceProfile(): Promise<{
        id: string;
        name: string;
        language: string;
        style: string;
        structure: string;
        constraints: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
}
