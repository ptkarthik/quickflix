import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FeedItem, Story, buildStories, parseGoogleNews, parseGoogleTrends } from './trends.util';

const DIR = path.join(process.cwd(), 'data', 'trends');
const FILE = path.join(DIR, 'latest.json');
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' };

const FEEDS: Array<{ key: string; url: string; lang: 'en' | 'ta'; trends?: boolean }> = [
  { key: 'trends', url: 'https://trends.google.com/trending/rss?geo=IN', lang: 'en', trends: true },
  { key: 'tn', url: 'https://news.google.com/rss/search?q=Tamil+Nadu+when:1d&hl=en-IN&gl=IN&ceid=IN:en', lang: 'en' },
  { key: 'chennai', url: 'https://news.google.com/rss/headlines/section/geo/Chennai?hl=en-IN&gl=IN&ceid=IN:en', lang: 'en' },
  { key: 'tamil', url: 'https://news.google.com/rss?hl=ta&gl=IN&ceid=IN:ta', lang: 'ta' },
  { key: 'india', url: 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en', lang: 'en' },
];

interface Snapshot { fetchedAt: string; stories: Story[]; errors: string[] }

/** What's trending in Tamil Nadu / India right now (refreshed every 30 min, and on demand). Read-only news feeds. */
@Injectable()
export class TrendsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TrendsService.name);
  private snap: Snapshot | null = null;
  private running: Promise<Snapshot> | null = null;
  private timers: NodeJS.Timeout[] = [];

  onApplicationBootstrap() {
    try { this.snap = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
    if (process.env.NODE_ENV === 'test') return;
    const tick = () => { this.refresh().catch(e => this.logger.warn(`[Trends] ${e.message}`)); };
    this.timers.push(setTimeout(tick, 60000), setInterval(tick, 30 * 60000));
  }
  onModuleDestroy() {
    this.timers.forEach(t => clearTimeout(t));
  }

  refresh() {
    if (!this.running) this.running = this.collect().finally(() => { this.running = null; });
    return this.running;
  }

  private async collect(): Promise<Snapshot> {
    const t0 = Date.now();
    const errors: string[] = [];
    const items: FeedItem[] = [];
    await Promise.all(FEEDS.map(async f => {
      try {
        const r = await fetch(f.url, { headers: UA, signal: AbortSignal.timeout(25000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const xml = await r.text();
        items.push(...(f.trends ? parseGoogleTrends(xml) : parseGoogleNews(xml, f.key, f.lang)));
      } catch (e) {
        errors.push(`${f.key}: ${(e as Error).message}`);
      }
    }));
    // keep the last 36 hours
    const fresh = items.filter(i => !i.date || Date.now() - Date.parse(i.date) < 36 * 3600000);
    const stories = buildStories(fresh).slice(0, 150);
    const snap: Snapshot = { fetchedAt: new Date().toISOString(), stories, errors };
    if (stories.length || !this.snap) {
      this.snap = snap;
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(snap));
    }
    this.logger.log(`[Trends] ${items.length} headlines → ${stories.length} stories (${stories.filter(s => s.tamilNadu).length} Tamil Nadu) in ${Math.round((Date.now() - t0) / 1000)} s${errors.length ? ` · ${errors.join('; ')}` : ''}`);
    return snap;
  }

  async list(q: { scope?: string; category?: string; sensitive?: string }) {
    if (!this.snap) await this.refresh();
    const s = this.snap!;
    let stories = s.stories;
    if (q.scope === 'tn') stories = stories.filter(x => x.tamilNadu);
    else if (q.scope === 'india') stories = stories.filter(x => !x.tamilNadu);
    if (q.category) stories = stories.filter(x => x.category === q.category);
    const hidden = stories.filter(x => x.sensitive).length;
    if (q.sensitive !== 'true') stories = stories.filter(x => !x.sensitive);
    const categories = [...new Set(s.stories.map(x => x.category))].sort();
    return { fetchedAt: s.fetchedAt, errors: s.errors, stories: stories.slice(0, 80), hiddenSensitive: q.sensitive === 'true' ? 0 : hidden, categories };
  }
}
