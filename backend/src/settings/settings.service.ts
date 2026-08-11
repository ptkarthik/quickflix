import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getVoiceProfiles() {
    return this.prisma.voiceProfile.findMany({
      orderBy: { createdAt: 'asc' }
    });
  }

  async createVoiceProfile(data: any) {
    return this.prisma.voiceProfile.create({ data });
  }

  async setActiveVoiceProfile(id: string) {
    await this.prisma.$transaction([
      this.prisma.voiceProfile.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      }),
      this.prisma.voiceProfile.update({
        where: { id },
        data: { isActive: true }
      })
    ]);
    return this.prisma.voiceProfile.findUnique({ where: { id } });
  }

  async getActiveVoiceProfile() {
    return this.prisma.voiceProfile.findFirst({
      where: { isActive: true }
    });
  }
}
