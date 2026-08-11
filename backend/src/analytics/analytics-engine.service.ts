import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface StatisticalFinding {
  category: string; // 'HOOK' | 'FORMAT'
  insight: string;
  confidence: 'EARLY_SIGNAL' | 'STRONG_SIGNAL' | 'INSUFFICIENT_DATA';
  details: string;
}

@Injectable()
export class AnalyticsEngineService {
  private readonly logger = new Logger(AnalyticsEngineService.name);

  constructor(private prisma: PrismaService) {}

  async generateFindings(projectId: string): Promise<StatisticalFinding[]> {
    const performances = await this.prisma.contentPerformance.findMany({
      where: { schedule: { projectId } },
      include: { schedule: true }
    });

    if (performances.length < 5) {
      return [{
        category: 'GENERAL',
        insight: 'Not enough historical data yet.',
        confidence: 'INSUFFICIENT_DATA',
        details: 'Post more content to generate insights.'
      }];
    }

    const findings: StatisticalFinding[] = [];

    // 1. Hook Analysis
    const hookFinding = this.analyzeHooks(performances);
    if (hookFinding) findings.push(hookFinding);

    // 2. Format / Template Analysis
    const formatFinding = this.analyzeFormats(performances);
    if (formatFinding) findings.push(formatFinding);

    return findings;
  }

  private analyzeHooks(performances: any[]): StatisticalFinding | null {
    const hookStats: Record<string, { posts: number; totalRetention: number }> = {};
    
    performances.forEach(p => {
      const hook = p.schedule.hookType;
      if (hook === 'NONE') return;
      if (!hookStats[hook]) hookStats[hook] = { posts: 0, totalRetention: 0 };
      hookStats[hook].posts += 1;
      hookStats[hook].totalRetention += p.retention;
    });

    // Find the top two hooks by post count to compare (or just the best performing one vs average)
    const hooks = Object.keys(hookStats).map(h => ({
      name: h,
      posts: hookStats[h].posts,
      avgRetention: hookStats[h].totalRetention / hookStats[h].posts
    })).filter(h => h.posts >= 3); // minimum 3 posts to compare

    if (hooks.length < 2) return null;

    hooks.sort((a, b) => b.avgRetention - a.avgRetention);
    
    const best = hooks[0];
    const second = hooks[1];
    
    const difference = best.avgRetention - second.avgRetention;
    if (difference < 2) return null; // Not significant

    const confidence = best.posts > 10 && second.posts > 10 ? 'STRONG_SIGNAL' : 'EARLY_SIGNAL';

    return {
      category: 'HOOK',
      insight: `${best.name.replace(/_/g, ' ')} hooks show higher retention than ${second.name.replace(/_/g, ' ')} hooks.`,
      confidence,
      details: `Across ${best.posts} posts, ${best.name} hooks averaged ${best.avgRetention.toFixed(1)}% retention compared to ${second.avgRetention.toFixed(1)}% for ${second.name} hooks (Difference: +${difference.toFixed(1)}%).`
    };
  }

  private analyzeFormats(performances: any[]): StatisticalFinding | null {
    const formatStats: Record<string, { posts: number; totalViews: number; totalSaves: number }> = {};
    
    performances.forEach(p => {
      const format = p.schedule.templateType;
      if (format === 'NONE') return;
      if (!formatStats[format]) formatStats[format] = { posts: 0, totalViews: 0, totalSaves: 0 };
      formatStats[format].posts += 1;
      formatStats[format].totalViews += p.views;
      formatStats[format].totalSaves += p.saves;
    });

    const formats = Object.keys(formatStats).map(f => {
      const stats = formatStats[f];
      return {
        name: f,
        posts: stats.posts,
        avgViews: stats.totalViews / stats.posts,
        saveRate: (stats.totalSaves / stats.totalViews) * 100 // Saves per view %
      };
    }).filter(f => f.posts >= 3);

    if (formats.length < 2) return null;

    // Find if Quote Cards or similar have high save rate but low views
    const highSaveFormat = formats.reduce((prev, current) => (prev.saveRate > current.saveRate) ? prev : current);
    const avgViewFormat = formats.reduce((prev, current) => (prev.avgViews > current.avgViews) ? prev : current);

    if (highSaveFormat.name !== avgViewFormat.name && highSaveFormat.saveRate > (avgViewFormat.saveRate * 1.5)) {
      const confidence = highSaveFormat.posts > 8 ? 'STRONG_SIGNAL' : 'EARLY_SIGNAL';
      return {
        category: 'FORMAT',
        insight: `${highSaveFormat.name.replace(/_/g, ' ')}s have lower reach but significantly higher save rates.`,
        confidence,
        details: `${highSaveFormat.name.replace(/_/g, ' ')}s average ${highSaveFormat.saveRate.toFixed(2)}% save rate (vs ${avgViewFormat.saveRate.toFixed(2)}% for ${avgViewFormat.name.replace(/_/g, ' ')}), making them useful for evergreen engagement.`
      };
    }

    return null;
  }
}
