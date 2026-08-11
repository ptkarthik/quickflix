import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  async seedSimulatedData() {
    this.logger.log('Seeding simulated historical performance data...');

    const projects = await this.prisma.movieProject.findMany();
    if (projects.length === 0) {
      throw new Error('Need at least one project to seed data.');
    }
    const project = projects[0];

    const voiceProfiles = await this.prisma.voiceProfile.findMany();
    const voiceProfileId = voiceProfiles.length > 0 ? voiceProfiles[0].id : null;

    // Intentional Pattern: Question hooks perform ~15% better on retention than Statement hooks
    const hooks = [
      { type: 'QUESTION', retentionBase: 65, retentionRange: 15, viewBase: 25000 },
      { type: 'STATEMENT', retentionBase: 50, retentionRange: 15, viewBase: 22000 },
      { type: 'CONTROVERSIAL', retentionBase: 55, retentionRange: 20, viewBase: 40000 },
      { type: 'CURIOSITY', retentionBase: 60, retentionRange: 10, viewBase: 30000 }
    ];

    // Intentional Pattern: Quote Cards get fewer views but higher save rates
    const templates = [
      { type: 'REEL_BLUEPRINT', platform: 'REELS', viewMult: 2.0, saveRate: 0.02, likeRate: 0.08 },
      { type: 'REVIEW_CARD', platform: 'INSTAGRAM_FEED', viewMult: 0.8, saveRate: 0.03, likeRate: 0.1 },
      { type: 'QUOTE_CARD', platform: 'INSTAGRAM_FEED', viewMult: 0.5, saveRate: 0.12, likeRate: 0.05 },
      { type: 'MINIMAL_POSTER', platform: 'INSTAGRAM_FEED', viewMult: 0.9, saveRate: 0.01, likeRate: 0.09 }
    ];

    let createdCount = 0;

    for (let i = 0; i < 40; i++) {
      const hook = hooks[Math.floor(Math.random() * hooks.length)];
      const template = templates[Math.floor(Math.random() * templates.length)];
      
      const publishDate = new Date();
      publishDate.setDate(publishDate.getDate() - Math.floor(Math.random() * 60)); // Randomly past 60 days

      // Base metrics with intentional noise
      const views = Math.floor((hook.viewBase * template.viewMult) * (0.8 + Math.random() * 0.4));
      const likes = Math.floor(views * template.likeRate * (0.9 + Math.random() * 0.2));
      const saves = Math.floor(views * template.saveRate * (0.9 + Math.random() * 0.2));
      const shares = Math.floor(views * 0.01 * (0.5 + Math.random() * 1.5));
      const comments = Math.floor(views * 0.005 * (0.5 + Math.random() * 1.5));
      const retention = Math.min(100, Math.max(0, hook.retentionBase + (Math.random() * hook.retentionRange)));

      const schedule = await this.prisma.contentSchedule.create({
        data: {
          projectId: project.id,
          title: `Simulated Post ${i+1}`,
          contentType: template.type === 'REEL_BLUEPRINT' ? 'REEL' : 'GRAPHIC',
          platform: template.platform as any,
          scheduledFor: publishDate,
          status: 'PUBLISHED',
          publishedAt: publishDate,
          hookType: hook.type as any,
          templateType: template.type as any,
          voiceProfileId
        }
      });

      await this.prisma.contentPerformance.create({
        data: {
          scheduleId: schedule.id,
          views,
          likes,
          comments,
          shares,
          saves,
          retention,
          isSimulated: true,
          fetchedAt: new Date()
        }
      });

      createdCount++;
    }

    return { message: `Seeded ${createdCount} simulated performance records with intentional patterns.` };
  }

  async getDashboardData() {
    // We aggregate the performance snapshots (latest per schedule, though for simulated we only have 1)
    const performances = await this.prisma.contentPerformance.findMany({
      include: { schedule: { include: { project: true } } }
    });

    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalSaves = 0;
    let totalRetention = 0;

    const formatStats: Record<string, { views: number, engagement: number, count: number }> = {};
    const movieStats: Record<string, { views: number, engagement: number, count: number }> = {};

    performances.forEach(p => {
      totalViews += p.views;
      totalLikes += p.likes;
      totalComments += p.comments;
      totalShares += p.shares;
      totalSaves += p.saves;
      totalRetention += p.retention;

      const engagement = p.views > 0 ? ((p.likes + p.comments + p.shares + p.saves) / p.views) * 100 : 0;
      const format = p.schedule.templateType;
      const movie = p.schedule.project.title;

      if (!formatStats[format]) formatStats[format] = { views: 0, engagement: 0, count: 0 };
      formatStats[format].views += p.views;
      formatStats[format].engagement += engagement;
      formatStats[format].count += 1;

      if (!movieStats[movie]) movieStats[movie] = { views: 0, engagement: 0, count: 0 };
      movieStats[movie].views += p.views;
      movieStats[movie].engagement += engagement;
      movieStats[movie].count += 1;
    });

    const totalEngagements = totalLikes + totalComments + totalShares + totalSaves;
    const avgEngagement = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;
    const avgRetention = performances.length > 0 ? totalRetention / performances.length : 0;

    return {
      overview: {
        totalViews,
        avgEngagement,
        avgRetention,
        posts: performances.length,
        totalShares,
        totalSaves
      },
      byFormat: Object.keys(formatStats).map(format => ({
        format: format.replace(/_/g, ' '),
        views: formatStats[format].views,
        engagement: formatStats[format].engagement / formatStats[format].count
      })),
      byMovie: Object.keys(movieStats).map(movie => ({
        movie,
        views: movieStats[movie].views,
        engagement: movieStats[movie].engagement / movieStats[movie].count
      })),
      individual: performances.map(p => ({
        id: p.schedule.id,
        title: p.schedule.title,
        movie: p.schedule.project.title,
        format: p.schedule.templateType,
        publishedAt: p.schedule.publishedAt,
        views: p.views,
        likes: p.likes,
        shares: p.shares,
        saves: p.saves,
        retention: p.retention,
        isSimulated: p.isSimulated
      })).sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    };
  }
}
