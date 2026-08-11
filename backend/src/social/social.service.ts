import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(private prisma: PrismaService) {}

  async getAccounts() {
    return this.prisma.socialAccount.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async mockConnect(platform: string, accountName: string) {
    this.logger.log(`Mock OAuth connecting to ${platform} for ${accountName}`);
    
    return this.prisma.socialAccount.create({
      data: {
        platform,
        accountName,
        accountId: `mock_${platform.toLowerCase()}_${Date.now()}`,
        accessToken: `mock_access_token_${Date.now()}`,
        refreshToken: `mock_refresh_token_${Date.now()}`,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60), // 60 days
        status: 'CONNECTED',
        isMock: true
      }
    });
  }
}
