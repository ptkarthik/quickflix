import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    
    // Seed Default Voice Profile
    const count = await this.voiceProfile.count();
    if (count === 0) {
      await this.voiceProfile.create({
        data: {
          name: 'Default Movie Review Voice',
          language: 'Tamil / English / Tanglish',
          style: 'Colloquial, conversational, strong opinions',
          structure: 'Hook -> Story -> Performances -> Technical -> Pros/Cons -> Verdict',
          constraints: 'Natural Tamil, no artificial literary language, conversational phrasing',
          isActive: true
        }
      });
    }
  }
}
