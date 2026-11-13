import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import {
  detectDate,
  detectDubLanguage,
  detectLanguage,
  detectPlatform,
  extractTitle,
  isDigestHeadline,
  splitSeason,
} from './ott-text.util';

export interface NewsCandidate {
  title: string;
  seasonNumber?: number;
  platform?: string;
  releaseDate?: string;
  language?: string;
  dubLanguage?: string;
  headline: string;
  sourceUrl: string;
  sourceName?: string;
  publishedAt?: string;
}

export interface NewsCollectResult {
  candidates: NewsCandidate[];
  feedsFetched: number;
  feedErrors: Array<{ query: string; error: string }>;
  headlinesSeen: number;
  digestHeadlinesSkipped: number;
  unparsedHeadlines: number;
}

/**
 * Free source: Google News RSS search, restricted to India (gl=IN).
 * It aggregates Times of India, NDTV, India Today, The Hindu, New Indian Express,
 * Pinkvilla, 123Telugu and others, so regional OTT announcements show up early.
 * No API key, no cost. Headlines are parsed with rules only (no AI).
 */
@Injectable()
export class NewsCollectorService {
  private readonly logger = new Logger(NewsCollectorService.name);

  /** [search query, language hint] — language hint is only a default; the reviewer can change it. */
  private readonly queries: Array<[string, string | undefined]> = [
    ['tamil "OTT release"', 'ta'],
    ['telugu "OTT release"', 'te'],
    ['malayalam "OTT release"', 'ml'],
    ['kannada "OTT release"', 'kn'],
    ['hindi "OTT release"', 'hi'],
    ['"OTT release date"', undefined],
    ['"OTT release" (JioHotstar OR SonyLIV OR ZEE5 OR "Sun NXT" OR Aha OR ManoramaMAX OR "ETV Win")', undefined],
    ['("now streaming" OR "to stream on") (Tamil OR Telugu OR Malayalam OR Hindi OR Kannada)', undefined],
  ];

  async collect(daysBack = 7, referenceDate = new Date()): Promise<NewsCollectResult> {
    const result: NewsCollectResult = {
      candidates: [],
      feedsFetched: 0,
      feedErrors: [],
      headlinesSeen: 0,
      digestHeadlinesSkipped: 0,
      unparsedHeadlines: 0,
    };
    const seenLinks = new Set<string>();

    for (const [query, langHint] of this.queries) {
      const url =
        'https://news.google.com/rss/search?q=' +
        encodeURIComponent(`${query} when:${daysBack}d`) +
        '&hl=en-IN&gl=IN&ceid=IN:en';
      let xml: string;
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (QuickFlix OTT desk)' },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        xml = await res.text();
        result.feedsFetched++;
      } catch (err: any) {
        result.feedErrors.push({ query, error: err.message });
        continue;
      }

      const $ = cheerio.load(xml, { xmlMode: true });
      $('item').each((_, el) => {
        const item = $(el);
        const rawTitle = item.find('title').first().text().trim();
        const link = item.find('link').first().text().trim();
        const sourceName = item.find('source').first().text().trim() || undefined;
        const pubDate = item.find('pubDate').first().text().trim();
        if (!rawTitle || !link || seenLinks.has(link)) return;
        seenLinks.add(link);
        result.headlinesSeen++;

        // Google News appends " - Publisher" to every headline.
        const headline = sourceName && rawTitle.endsWith(` - ${sourceName}`)
          ? rawTitle.slice(0, -(sourceName.length + 3)).trim()
          : rawTitle.replace(/\s+-\s+[^-]{2,60}$/, '').trim();

        if (isDigestHeadline(headline)) {
          result.digestHeadlinesSkipped++;
          return;
        }
        const rawExtracted = extractTitle(headline);
        if (!rawExtracted) {
          result.unparsedHeadlines++;
          return;
        }
        const { base, season } = splitSeason(rawExtracted);
        const published = pubDate ? new Date(pubDate) : referenceDate;
        const reference = isNaN(published.getTime()) ? referenceDate : published;

        result.candidates.push({
          title: base,
          seasonNumber: season,
          platform: detectPlatform(headline),
          releaseDate: detectDate(headline, reference),
          language: detectLanguage(headline) || langHint,
          dubLanguage: detectDubLanguage(headline),
          headline,
          sourceUrl: link,
          sourceName,
          publishedAt: isNaN(published.getTime()) ? undefined : published.toISOString(),
        });
      });

      await new Promise(r => setTimeout(r, 400)); // be polite to the free feed
    }

    this.logger.log(
      `[NewsCollector] ${result.feedsFetched} feeds, ${result.headlinesSeen} headlines, ` +
        `${result.candidates.length} candidates, ${result.digestHeadlinesSkipped} digests skipped, ` +
        `${result.unparsedHeadlines} unparsed, ${result.feedErrors.length} feed errors.`,
    );
    return result;
  }
}
