import { PrismaService } from '../prisma/prisma.service';
export declare class SocialService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getAccounts(): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        platform: string;
        accountName: string;
        accountId: string | null;
        accessToken: string | null;
        refreshToken: string | null;
        expiresAt: Date | null;
        isMock: boolean;
    }[]>;
    mockConnect(platform: string, accountName: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        platform: string;
        accountName: string;
        accountId: string | null;
        accessToken: string | null;
        refreshToken: string | null;
        expiresAt: Date | null;
        isMock: boolean;
    }>;
}
