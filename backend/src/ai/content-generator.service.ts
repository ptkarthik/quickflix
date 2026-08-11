import { Injectable, NotFoundException } from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewPromptBuilder } from './builders/review.builder';
import { InstagramPromptBuilder } from './builders/instagram.builder';
import { YouTubePromptBuilder } from './builders/youtube.builder';
import { ReelScriptPromptBuilder } from './builders/reel-script.builder';
import { ContentStrategyBuilder } from './builders/strategy.builder';
import { SettingsService } from '../settings/settings.service';
import { AnalyticsEngineService } from '../analytics/analytics-engine.service';

@Injectable()
export class ContentGeneratorService {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly analyticsEngineService: AnalyticsEngineService,
  ) {}

  async generateAll(projectId: string) {
    const movie = await this.prisma.movieProject.findUnique({ 
      where: { id: projectId },
      include: { assets: true }
    });
    if (!movie) throw new NotFoundException('Project not found');

    // 1. Generate Review first since it feeds into social
    const reviewContent = await this.generateType(movie, 'REVIEW');
    
    // 2. Generate Instagram & YouTube in parallel
    const [instagram, youtube] = await Promise.all([
      this.generateType(movie, 'INSTAGRAM', reviewContent),
      this.generateType(movie, 'YOUTUBE', reviewContent),
    ]);

    return { review: reviewContent, instagram, youtube };
  }

  async generateSpecific(projectId: string, type: string) {
    const movie = await this.prisma.movieProject.findUnique({ 
      where: { id: projectId },
      include: { assets: true }
    });
    if (!movie) throw new NotFoundException('Project not found');
    return this.generateType(movie, type.toUpperCase());
  }

  private async generateType(movie: any, type: string, existingReviewContext?: any) {
    let prompt = '';
    let reviewContext = existingReviewContext;

    if (type !== 'REVIEW' && !reviewContext) {
       const reviewGen = await this.prisma.generatedContent.findFirst({
         where: { projectId: movie.id, type: 'REVIEW', status: 'SUCCESS' },
         orderBy: { version: 'desc' }
       });
       if (reviewGen) {
         reviewContext = JSON.parse(reviewGen.content);
       }
    }

    const voiceProfile = await this.settingsService.getActiveVoiceProfile();
    const profileText = voiceProfile 
      ? `\nYOUR REVIEWING VOICE:\nLanguage: ${voiceProfile.language}\nStyle: ${voiceProfile.style}\nStructure: ${voiceProfile.structure}\nConstraints: ${voiceProfile.constraints}`
      : '';

    switch (type) {
      case 'REVIEW':
        prompt = ReviewPromptBuilder.build(movie) + profileText;
        break;
      case 'INSTAGRAM':
        prompt = InstagramPromptBuilder.build(movie, reviewContext || {}) + profileText;
        break;
      case 'YOUTUBE':
        prompt = YouTubePromptBuilder.build(movie, reviewContext || {}) + profileText;
        break;
      case 'REEL_SCRIPT':
        prompt = ReelScriptPromptBuilder.build(movie, reviewContext || {}) + profileText;
        break;
      case 'CONTENT_STRATEGY':
        const existingContent = await this.prisma.generatedContent.findMany({ where: { projectId: movie.id } });
        const schedules = await this.prisma.contentSchedule.findMany({ where: { projectId: movie.id } });
        const findings = await this.analyticsEngineService.generateFindings(movie.id);
        prompt = ContentStrategyBuilder.build(movie, reviewContext || {}, existingContent, schedules, findings) + profileText;
        break;
      default:
        throw new Error('Invalid generation type');
    }

    const content = await this.aiService.generateStructuredContent(prompt);
    
    const existing = await this.prisma.generatedContent.findFirst({
        where: { projectId: movie.id, type },
        orderBy: { version: 'desc' }
    });
    const version = existing ? existing.version + 1 : 1;

    await this.prisma.generatedContent.create({
      data: {
        projectId: movie.id,
        type,
        version,
        content: JSON.stringify(content),
        model: 'gemini-1.5-pro'
      }
    });

    return content;
  }
}
