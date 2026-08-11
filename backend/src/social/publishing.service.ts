import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MockInstagramProvider } from './providers/mock-instagram.provider';
import { MockYouTubeProvider } from './providers/mock-youtube.provider';
import { PublishingProvider } from './providers/publishing-provider.interface';

@Injectable()
export class PublishingService {
  private readonly logger = new Logger(PublishingService.name);
  
  private instagramProvider = new MockInstagramProvider();
  private youtubeProvider = new MockYouTubeProvider();

  constructor(private prisma: PrismaService) {}

  private getProvider(platform: string): PublishingProvider {
    if (platform === 'YOUTUBE') return this.youtubeProvider;
    return this.instagramProvider; // Default to IG for FEED/STORY/REELS
  }

  async publishSchedule(scheduleId: string) {
    const schedule = await this.prisma.contentSchedule.findUnique({
      where: { id: scheduleId },
      include: { asset: true, project: true }
    });

    if (!schedule) throw new Error('Schedule not found');

    // Transition to PUBLISHING
    await this.prisma.contentSchedule.update({
      where: { id: scheduleId },
      data: {
        status: 'PUBLISHING',
        lastPublishAttemptAt: new Date(),
        publishAttempts: { increment: 1 }
      }
    });

    // Determine account
    // In a real system, you'd match the account. For MVP, grab the first mock account for the platform.
    const platformType = schedule.platform === 'YOUTUBE' ? 'YOUTUBE' : 'INSTAGRAM';
    const account = await this.prisma.socialAccount.findFirst({
      where: { platform: platformType, status: 'CONNECTED' }
    });

    if (!account) {
      return this.markFailed(scheduleId, `No connected ${platformType} account found.`);
    }

    const provider = this.getProvider(schedule.platform);

    try {
      this.logger.log(`Publishing ${schedule.contentType} to ${account.platform}...`);
      const result = await provider.publish(
        account.id,
        schedule.id,
        schedule.contentType,
        schedule.asset?.path,
        schedule.notes || ''
      );

      if (result.success) {
        return this.markSuccess(scheduleId, result.externalId);
      } else {
        return this.markFailed(scheduleId, result.error || 'Unknown publishing error');
      }
    } catch (err: any) {
      this.logger.error(`Publishing failed: ${err.message}`);
      return this.markFailed(scheduleId, err.message);
    }
  }

  private async markSuccess(scheduleId: string, externalId?: string) {
    return this.prisma.contentSchedule.update({
      where: { id: scheduleId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        externalPostId: externalId,
        publishError: null
      }
    });
  }

  private async markFailed(scheduleId: string, error: string) {
    return this.prisma.contentSchedule.update({
      where: { id: scheduleId },
      data: {
        status: 'PUBLISH_FAILED',
        publishError: error
      }
    });
  }
}
