import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BuzzItem, CriticReview, aboutTitle, isStage, nearRelease, commonPhrases, isBuzz, isCriticReview, parseBingNews, parseWikiCritics, ratingFromJsonLd, ratingInText, ratingLabel, shortOutlet, verdictOf,
} from './critics.util';

const DIR = path.join(process.cwd(), 'data', 'critics');
const FRESH_DAYS = 3;
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', 'Accept-Language': 'en-IN,en;q=0.9' };
// Pages that need JavaScript or are aggregators — keep their headline, don't fetch.
const NO_FETCH = /(^|\.)(msn\.com|news\.google\.com|youtube\.com|instagram\.com|facebook\.com|x\.com|twitter\.com)$/i;

export interface CriticsFile {
  fetchedAt: string;
  query: string;
  reviews: CriticReview[];
  buzz: BuzzItem[];
  /** review ids you ticked to show as rating chips */
  picks: string[];
  /** also show "Critics 3.4/5 (6)" */
  showAverage: boolean;
}
export interface TitleRef { title: string; year: number | null; kind: 'movie' | 'tv'; language: string | null; wikiTitle: string | null }

/** Critics' ratings + one-liners per title, fetched only when you ask (button in "One-liner & ratings"). */
@Injectable()
export class CriticsService {
  private readonly logger = new Logger(CriticsService.name);
  private inFlight = new Map<string, Promise<CriticsFile>>();

  private file = (domain: string, id: string) => path.join(DIR, `${domain}-${id.replace(/[^\w-]/g, '')}.json`);
  read(domain: string, id: string): CriticsFile | null {
    try {
      return JSON.parse(fs.readFileSync(this.file(domain, id), 'utf8'));
    } catch {
      return null;
    }
  }
  private write(domain: string, id: string, f: CriticsFile) {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(this.file(domain, id), JSON.stringify(f));
  }

  /** Rating chips you picked, ready for the slide ("TOI 3.5/5", "Critics 3.4/5 (6)"). */
  chips(domain: string, id: string): string[] {
    const f = this.read(domain, id);
    if (!f) return [];
    const out = f.picks.map(p => f.reviews.find(r => r.id === p)).filter((r): r is CriticReview => !!r?.rating).map(r => `${shortOutlet(r.outlet)} ${ratingLabel(r.rating!)}`);
    if (f.showAverage) {
      const s = summary(f.reviews);
      if (s.average != null) out.unshift(`Critics ${s.average}/5 (${s.count})`);
    }
    return out;
  }

  setPicks(domain: string, id: string, picks: string[] | undefined, showAverage: boolean | undefined) {
    const f = this.read(domain, id);
    if (!f) return;
    if (picks) f.picks = picks.filter(p => f.reviews.some(r => r.id === p)).slice(0, 6);
    if (showAverage !== undefined) f.showAverage = !!showAverage;
    this.write(domain, id, f);
  }

  get(domain: string, id: string, t: TitleRef, force: boolean) {
    const cached = this.read(domain, id);
    if (cached && !force && Date.now() - new Date(cached.fetchedAt).getTime() < FRESH_DAYS * 86400000) return Promise.resolve(withSummary(cached));
    const key = `${domain}:${id}`;
    if (!this.inFlight.has(key)) {
      const p = this.fetchAll(t)
        .then(r => {
          const f: CriticsFile = { ...r, picks: cached?.picks?.filter(x => r.reviews.some(v => v.id === x)) || [], showAverage: cached?.showAverage || false };
          this.write(domain, id, f);
          return f;
        })
        .finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, p);
    }
    return this.inFlight.get(key)!.then(withSummary);
  }

  private async text(url: string, max = 2_500_000, ms = 12000): Promise<string | null> {
    try {
      const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(ms) });
      if (!r.ok || !r.body) return null;
      const reader = r.body.getReader();
      const parts: Uint8Array[] = [];
      let n = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        n += value.length;
        if (n > max) { await reader.cancel().catch(() => null); break; }
      }
      return Buffer.concat(parts).toString('utf8');
    } catch {
      return null;
    }
  }

  private async fetchAll(t: TitleRef): Promise<Omit<CriticsFile, 'picks' | 'showAverage'>> {
    const t0 = Date.now();
    const word = t.kind === 'tv' ? 'series review' : 'movie review';
    const queries = [`"${t.title}" ${word}`, `${t.title} review`];
    const seenUrl = new Set<string>();
    const news = [];
    for (const q of queries) {
      const xml = await this.text(`https://www.bing.com/news/search?format=rss&count=30&q=${encodeURIComponent(q)}`, 1_500_000);
      for (const it of xml ? parseBingNews(xml) : []) {
        if (seenUrl.has(it.url) || !aboutTitle(it.headline, t.title) || isStage(`${it.headline} ${it.description}`) || !nearRelease(it.date, t.year)) continue;
        seenUrl.add(it.url);
        news.push(it);
      }
    }
    const buzz: BuzzItem[] = news.filter(n => isBuzz(n.headline)).slice(0, 8).map(n => ({ headline: n.headline, outlet: n.outlet, url: n.url, date: n.date }));
    const critics = news.filter(n => isCriticReview(n.headline)).slice(0, 16);

    const reviews: CriticReview[] = [];
    for (let i = 0; i < critics.length; i += 4) {
      const got = await Promise.all(critics.slice(i, i + 4).map(async n => {
        let host = '';
        try { host = new URL(n.url).hostname; } catch {}
        const html = host && !NO_FETCH.test(host) ? await this.text(n.url) : null;
        const ld = html ? ratingFromJsonLd(html) : { rating: null, critic: null, outlet: null, description: null };
        const rating = ld.rating || ratingInText(n.headline) || ratingInText(n.description);
        const outlet = n.outlet || ld.outlet || host.replace(/^www\./, '');
        const r: CriticReview = {
          id: `news:${outlet.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          outlet, critic: ld.critic, rating, of5: rating ? +((rating.value / rating.best) * 5).toFixed(2) : null,
          oneLiner: verdictOf(n.headline, t.title), headline: n.headline, url: n.url, date: n.date, via: ld.rating ? 'article' : 'headline',
        };
        return r;
      }));
      reviews.push(...got);
    }

    const wikiTitle = t.wikiTitle || (await this.findWiki(t));
    if (wikiTitle) {
      const wiki = await this.wikiCritics(wikiTitle);
      for (const w of wiki) if (!reviews.some(r => r.id.replace(/^\w+:/, '') === w.id.replace(/^\w+:/, ''))) reviews.push(w);
    }

    // one per outlet: keep the one that states a rating
    const byOutlet = new Map<string, CriticReview>();
    for (const r of reviews) {
      const k = shortOutlet(r.outlet).toLowerCase();
      const cur = byOutlet.get(k);
      if (!cur || (!cur.rating && r.rating)) byOutlet.set(k, r);
    }
    const out = [...byOutlet.values()].filter(r => r.rating || r.oneLiner).sort((a, b) => Number(!!b.rating) - Number(!!a.rating) || (b.date || '').localeCompare(a.date || ''));
    this.logger.log(`[Critics] "${t.title}": ${out.length} reviews (${out.filter(r => r.rating).length} rated), ${buzz.length} buzz in ${Math.round((Date.now() - t0) / 1000)} s`);
    return { fetchedAt: new Date().toISOString(), query: queries[0], reviews: out, buzz };
  }

  /** Wikipedia article for the title when we don't have one saved: "<title> <year> film" search, title must match. */
  private async findWiki(t: TitleRef): Promise<string | null> {
    const q = `${t.title} ${t.year || ''} ${t.kind === 'tv' ? 'TV series' : 'film'}`;
    try {
      const j = JSON.parse((await this.text(`https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', list: 'search', srsearch: q, srlimit: '5', format: 'json', formatversion: '2' })}`, 300_000)) || '{}');
      const want = t.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const hit = (j?.query?.search || []).find((r: { title: string }) => r.title.toLowerCase().replace(/\(.*\)/, '').replace(/[^a-z0-9]+/g, ' ').trim() === want);
      return hit?.title || null;
    } catch {
      return null;
    }
  }

  private async wikiCritics(title: string): Promise<CriticReview[]> {
    const api = (p: Record<string, string>) => `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...p })}`;
    try {
      const secs = JSON.parse((await this.text(api({ action: 'parse', page: title, prop: 'sections', redirects: '1' }), 500_000)) || '{}');
      const list: Array<{ index: string; line: string }> = secs?.parse?.sections || [];
      const sec = list.find(s => /critical (response|reception)/i.test(s.line)) || list.find(s => /^(reception|reviews|critical)/i.test(s.line));
      if (!sec) return [];
      const wt = JSON.parse((await this.text(api({ action: 'parse', page: title, prop: 'wikitext', section: sec.index, redirects: '1' }), 800_000)) || '{}');
      const reviews = parseWikiCritics(wt?.parse?.wikitext || '');
      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}#${encodeURIComponent(sec.line.replace(/ /g, '_'))}`;
      return reviews.map(r => ({ ...r, url }));
    } catch {
      return [];
    }
  }
}

export function summary(reviews: CriticReview[]) {
  const rated = reviews.filter(r => r.of5 != null);
  const average = rated.length ? Math.round((rated.reduce((a, r) => a + r.of5!, 0) / rated.length) * 10) / 10 : null;
  return { average, count: rated.length };
}

function withSummary(f: CriticsFile) {
  const s = summary(f.reviews);
  return { ...f, average: s.average, ratedCount: s.count, phrases: commonPhrases(f.reviews.map(r => r.oneLiner || r.headline || '').filter(Boolean), f.query.replace(/^"|".*$/g, '')) };
}
