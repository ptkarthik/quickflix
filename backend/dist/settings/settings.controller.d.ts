import { SettingsService } from './settings.service';
export declare class SettingsController {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
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
    createVoiceProfile(body: any): Promise<{
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
