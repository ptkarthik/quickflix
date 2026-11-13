import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { detectDate, detectDubLanguage } from './ott-text.util';

/**
 * Official platform YouTube channels (free public RSS, no API key).
 * These are the platforms announcing their own titles, so a platform+date stated here is the strongest
 * pre-release evidence we can get for free. Channel IDs were resolved from the platforms' @handles; keep
 * this list audited — a fan channel here would be treated as official.
 */
export const OFFICIAL_CHANNELS: Array<{ id: string; handle: string; platform: string }> = [
  { id: 'UCim0ZIz8SAQGPvg4mJHG3JA', handle: '@NetflixIndiaOfficial', platform: 'Netflix' },
  { id: 'UC4zWG9LccdWGUlF77LZ8toA', handle: '@PrimeVideoIN', platform: 'Prime Video' },
  { id: 'UC-LPIU24bQXVljUXivKEeRQ', handle: '@JioHotstar', platform: 'JioHotstar' },
  { id: 'UC8lPjTzRiG37n1Q2kpz3Rfg', handle: '@JioHotstarTamil', platform: 'JioHotstar' },
  { id: 'UC2DDhRE75LKKPjAxC-zsGRg', handle: '@JioHotstarTelugu', platform: 'JioHotstar' },
  { id: 'UCA09ogM92UefGEHtSZy5zkw', handle: '@JioHotstarMalayalam', platform: 'JioHotstar' },
  { id: 'UCOQNJjhXwvAScuELTT_i7cQ', handle: '@SonyLIV', platform: 'SonyLIV' },
  { id: 'UCQmxcMxjYcBM5Pel4qUW2hA', handle: '@SonyLIVTamil', platform: 'SonyLIV' },
  { id: 'UCXOgAl4w-FQero1ERbGHpXQ', handle: '@ZEE5', platform: 'ZEE5' },
  { id: 'UCT9QnaTLWv7UfQvy7rjXtQw', handle: '@ZEE5Kannada', platform: 'ZEE5' },
  { id: 'UCials1wQnEN_NykYZr1048w', handle: '@SunNXT', platform: 'Sun NXT' },
  { id: 'UCqyZfPcrNtfbpmygFSRj-_A', handle: '@ahaTamil', platform: 'Aha' },
  { id: 'UCz1ht-a2eKE_s1vMh3OHtIg', handle: '@ManoramaMAX', platform: 'ManoramaMAX' },
  { id: 'UCE8FZJKzY53hrncyM_n0QWA', handle: '@ETVWin', platform: 'ETV Win' },
  { id: 'UCr0_xzS43ijsp0ab4XUGjkQ', handle: '@hoichoi', platform: 'Hoichoi' },
];

export interface OfficialVideo {
  platform: string;
  channelHandle: string;
  videoTitle: string;
  description: string;
  url: string;
  publishedAt: Date;
  /** Explicit calendar date in the title/description (the premiere date), if any. */
  claimedDate?: string;
  /** Video explicitly about a dubbed version, e.g. "Hindi Trailer". */
  dubLanguage?: string;
  /** Wording suggests a release announcement rather than a clip/promo. */
  isReleaseAnnouncement: boolean;
  /** Title-like segments ("Jailer 2", "Parivarik ManuRanjan") to match against known titles. */
  segments: string[];
}

const NOISE_SEGMENT =
  /^(official\s+)?(trailer|teaser|promo( \d+)?|glimpse|first look|sneak peek|motion poster|lyric(al)? video|video song|song|bts|making|interview|review|reaction|episode.*|full episode|clip|streaming now.*|now streaming.*|streaming (on|from) .*|watch now|coming soon|out now|new episodes?.*|sat-sun.*|mon-fri.*|\d+\s*(pm|am)|(jio)?hotstar specials|\d+ days? to go|set your reminder( now)?|week \d+|tomorrow|today)$/i;

const PLATFORM_SEGMENT =
  /^(prime video( india)?|netflix( india)?|jio ?hotstar( specials)?|sony ?liv( original( film| series)?)?|zee5( original)?|sun ?nxt|aha|manorama ?max|etv win|hoichoi)$/i;

/** Title-like segments of a video title ("Jailer 2 Ultimate SHOWDOWN | Rajinikanth | Prime Video India | November 12"). */
export function videoSegments(videoTitle: string, publishedAt: Date): string[] {
  return videoTitle
    .split(/\s*[|｜]\s*|\s+[-–—]\s+/)
    .map(s =>
      s
        .replace(/#\S+/g, '')
        .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
        .replace(/\s+(?:(?:is\s+)?(?:streaming\s+)?(?:tomorrow|today|now)\s+)?(?:streaming\s+)?(?:on|from)\s+(?:jio\s*hotstar|netflix|prime video|sony ?liv|zee5|sun ?nxt|aha|manorama ?max|etv win|hoichoi)\b.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(s => s.length >= 2 && s.length <= 60 && s.split(' ').length <= 7)
    .filter(s => !NOISE_SEGMENT.test(s))
    .filter(s => !detectDate(s, publishedAt))
    .filter(s => !PLATFORM_SEGMENT.test(s));
}

const normWords = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Does this official video talk about this title? Strict on purpose — a false match creates false
 * "official" evidence. A segment must BE the title, or START with a multi-word title:
 *   "Jailer 2 Ultimate SHOWDOWN" ✓ for "Jailer 2";  "When Family Becomes the Greatest Strength" ✗ for "The Greatest".
 */
export function videoMatchesTitle(segments: string[], title: string): boolean {
  const t = normWords(title);
  if (t.length < 3) return false;
  return segments.some(seg => {
    const s = normWords(seg);
    return s === t || (t.split(' ').length >= 2 && s.startsWith(`${t} `));
  });
}

@Injectable()
export class OfficialYoutubeCollector {
  private readonly logger = new Logger(OfficialYoutubeCollector.name);

  async collect(): Promise<{ videos: OfficialVideo[]; feedsFetched: number; feedErrors: string[] }> {
    const videos: OfficialVideo[] = [];
    const feedErrors: string[] = [];
    let feedsFetched = 0;

    for (const ch of OFFICIAL_CHANNELS) {
      try {
        const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        feedsFetched++;
        const $ = cheerio.load(xml, { xmlMode: true });
        $('entry').each((_, el) => {
          const e = $(el);
          const videoTitle = e.find('title').first().text().trim();
          const url = e.find('link').attr('href') || '';
          const published = new Date(e.find('published').first().text().trim());
          const description = e.find('media\\:description').first().text().trim();
          if (!videoTitle || !url) return;
          videos.push(this.parse(ch, videoTitle, description, url, isNaN(published.getTime()) ? new Date() : published));
        });
      } catch (err: any) {
        feedErrors.push(`${ch.handle}: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 250));
    }
    this.logger.log(`[OfficialYouTube] ${feedsFetched}/${OFFICIAL_CHANNELS.length} feeds, ${videos.length} videos, ${videos.filter(v => v.claimedDate).length} with a date.`);
    return { videos, feedsFetched, feedErrors };
  }

  parse(ch: { platform: string; handle: string }, videoTitle: string, description: string, url: string, publishedAt: Date): OfficialVideo {
    // Dates: prefer the title; the description often contains unrelated dates (e.g. episode air dates).
    const firstDescLines = description.split('\n').slice(0, 3).join(' ');
    const claimedDate = detectDate(videoTitle, publishedAt) || (/(stream|premier|from|on\s)/i.test(firstDescLines) ? detectDate(firstDescLines, publishedAt) : undefined);
    const text = `${videoTitle} ${firstDescLines}`;
    const isReleaseAnnouncement =
      !!claimedDate || /\b(streaming (now|from|on)|now streaming|premieres?|world digital premiere|releasing on|arrives on|watch (it )?(now|on))\b/i.test(text);
    // TV-serial uploads ("Episode 122 | … | 25 Aug 2026") carry air dates that are not premieres.
    const isSerialEpisode = /\bepisode\s*:?\s*\d+|full episode\b/i.test(videoTitle);

    return {
      platform: ch.platform,
      channelHandle: ch.handle,
      videoTitle,
      description,
      url,
      publishedAt,
      claimedDate: isSerialEpisode ? undefined : claimedDate,
      dubLanguage: detectDubLanguage(videoTitle),
      isReleaseAnnouncement: isReleaseAnnouncement && !isSerialEpisode,
      segments: videoSegments(videoTitle, publishedAt),
    };
  }
}
