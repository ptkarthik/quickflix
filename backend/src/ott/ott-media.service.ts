import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { PrismaService } from '../prisma/prisma.service';
import { LANGUAGE_LABELS } from './ott-text.util';

export type ImageSource = 'TMDB' | 'OFFICIAL' | 'WEB';

export interface ImageOption {
  /** Full-size image to use on the post. */
  url: string;
  /** Small preview for the picker grid. */
  thumb: string;
  source: ImageSource;
  kind: 'poster' | 'backdrop' | 'thumbnail' | 'web';
  width?: number;
  height?: number;
  /** Where the image came from (page or channel), shown so you can judge it. */
  label?: string;
  pageUrl?: string;
}

const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'Accept-Language': 'en-IN,en;q=0.9',
};

/** Builds the web image query from the release's verified attributes, so results are about the exact title. */
export function buildImageQuery(r: {
  title: string;
  contentType: string;
  seasonNumber?: number | null;
  language?: string | null;
  platform?: string | null;
  originalYear?: number | null;
  releaseDate?: string | null;
}): string {
  const year = r.originalYear || (r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : undefined);
  const parts = [
    `"${r.title}"`,
    r.contentType === 'tv' ? (r.seasonNumber && r.seasonNumber > 1 ? `season ${r.seasonNumber}` : 'series') : 'movie',
    year ? String(year) : '',
    r.language ? LANGUAGE_LABELS[r.language] || '' : '',
    r.platform || '',
    'poster',
  ];
  return parts.filter(Boolean).join(' ');
}

/** Parses Bing Images result HTML (free, no key). Each result tile carries JSON in its `m` attribute. */
export function parseBingImages(html: string, limit = 30): ImageOption[] {
  const $ = cheerio.load(html);
  const out: ImageOption[] = [];
  const seen = new Set<string>();
  $('a.iusc').each((_, el) => {
    if (out.length >= limit) return false;
    const raw = $(el).attr('m');
    if (!raw) return;
    try {
      const m = JSON.parse(raw) as { murl?: string; turl?: string; purl?: string; t?: string };
      if (!m.murl || !/^https?:\/\//.test(m.murl) || seen.has(m.murl)) return;
      // Facebook crawler links expire and usually fail to load.
      if (/lookaside\.fbsbx\.com/.test(m.murl)) return;
      seen.add(m.murl);
      let host = '';
      try {
        host = new URL(m.purl || m.murl).hostname.replace(/^www\./, '');
      } catch {}
      out.push({ url: m.murl, thumb: m.turl || m.murl, source: 'WEB', kind: 'web', label: [host, m.t].filter(Boolean).join(' — ').slice(0, 120), pageUrl: m.purl });
    } catch {
      /* skip malformed tile */
    }
  });
  return out;
}

@Injectable()
export class OttMediaService {
  private readonly logger = new Logger(OttMediaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Image choices for one release: exact TMDB art first, then official trailer thumbnails, then web results. */
  async imageOptions(id: string, query?: string, kind: 'ott' | 'cinema' | 'world' = 'ott') {
    const r =
      kind === 'cinema' ? await this.cinemaAsRelease(id)
        : kind === 'world' ? await this.worldAsRelease(id)
          : await this.prisma.ottRelease.findUnique({ where: { id }, include: { evidence: true } });
    if (!r) throw new NotFoundException(kind === 'ott' ? 'OTT release not found' : 'Title not found');
    const webQuery = query?.trim() || buildImageQuery(r);

    const [tmdb, web] = await Promise.all([
      r.tmdbId ? this.tmdbImages(r.tmdbId, r.contentType as 'movie' | 'tv', r.seasonNumber, r.language) : Promise.resolve([]),
      this.webImages(webQuery),
    ]);

    // Official platform trailers we matched to this title during collection.
    const official: ImageOption[] = [];
    const seenVid = new Set<string>();
    for (const e of r.evidence) {
      if (e.sourceType !== 'OFFICIAL_YOUTUBE' || !e.sourceUrl) continue;
      const vid = e.sourceUrl.match(/[?&]v=([\w-]{11})|youtu\.be\/([\w-]{11})|shorts\/([\w-]{11})/);
      const v = vid && (vid[1] || vid[2] || vid[3]);
      if (!v || seenVid.has(v)) continue;
      seenVid.add(v);
      official.push({
        url: `https://i.ytimg.com/vi/${v}/maxresdefault.jpg`,
        thumb: `https://i.ytimg.com/vi/${v}/hqdefault.jpg`,
        source: 'OFFICIAL',
        kind: 'thumbnail',
        width: 1280,
        height: 720,
        label: `${e.sourceName || 'Official channel'} — ${(e.text || '').slice(0, 80)}`,
        pageUrl: e.sourceUrl,
      });
    }

    return { query: webQuery, tmdb, official, web: web.images, webError: web.error };
  }

  /** A cinema film in the shape the image search needs (theatrical films are always movies, no platform). */
  private async cinemaAsRelease(id: string) {
    const c = await this.prisma.cinemaRelease.findUnique({ where: { id }, include: { evidence: true } });
    if (!c) return null;
    return {
      title: c.title,
      contentType: 'movie',
      seasonNumber: null,
      language: c.language,
      platform: null,
      originalYear: null,
      releaseDate: c.releaseDate,
      tmdbId: c.tmdbId,
      evidence: c.evidence.map(e => ({ sourceType: e.sourceType, sourceUrl: e.sourceUrl, sourceName: e.sourceName, text: e.text })),
    };
  }

  /** A World database title in the shape the image search needs. */
  private async worldAsRelease(id: string) {
    const w = await this.prisma.worldTitle.findUnique({ where: { id } });
    if (!w) return null;
    return {
      title: w.title,
      contentType: w.kind,
      seasonNumber: null,
      language: w.language,
      platform: null,
      originalYear: w.year,
      releaseDate: w.releaseDate,
      tmdbId: w.tmdbId,
      evidence: [] as Array<{ sourceType: string; sourceUrl: string | null; sourceName: string | null; text: string | null }>,
    };
  }

  private async tmdbImages(tmdbId: number, type: 'movie' | 'tv', season: number | null, lang: string | null): Promise<ImageOption[]> {
    const key = process.env.TMDB_API_KEY;
    if (!key) return [];
    const langs = ['null', 'en', lang, 'hi', 'ta', 'te', 'ml', 'kn'].filter(Boolean).join(',');
    const get = async (path: string) => {
      try {
        const res = await fetch(`https://api.themoviedb.org/3${path}?api_key=${key}&include_image_language=${langs}`, { signal: AbortSignal.timeout(12000) });
        return res.ok ? ((await res.json()) as { posters?: any[]; backdrops?: any[] }) : null;
      } catch {
        return null;
      }
    };
    const [main, seasonImgs] = await Promise.all([
      get(`/${type}/${tmdbId}/images`),
      type === 'tv' && season && season > 1 ? get(`/tv/${tmdbId}/season/${season}/images`) : Promise.resolve(null),
    ]);
    const byVotes = (a: any, b: any) => (b.vote_count || 0) - (a.vote_count || 0) || (b.vote_average || 0) - (a.vote_average || 0);
    const map = (arr: any[] | undefined, kind: 'poster' | 'backdrop', max: number): ImageOption[] =>
      (arr || [])
        .slice()
        .sort(byVotes)
        .slice(0, max)
        .map(i => ({
          url: `https://image.tmdb.org/t/p/${kind === 'poster' ? 'w780' : 'w1280'}${i.file_path}`,
          thumb: `https://image.tmdb.org/t/p/${kind === 'poster' ? 'w185' : 'w300'}${i.file_path}`,
          source: 'TMDB' as const,
          kind,
          width: i.width,
          height: i.height,
          label: `TMDB ${kind}${i.iso_639_1 ? ` (${LANGUAGE_LABELS[i.iso_639_1] || i.iso_639_1})` : ' (no text)'}`,
        }));
    return [...map(seasonImgs?.posters, 'poster', 6), ...map(main?.posters, 'poster', 14), ...map(main?.backdrops, 'backdrop', 10)];
  }

  private async webImages(q: string): Promise<{ images: ImageOption[]; error?: string }> {
    try {
      const res = await fetch(`https://www.bing.com/images/search?q=${encodeURIComponent(q)}&form=HDRSC2&first=1`, { headers: UA, signal: AbortSignal.timeout(15000) });
      if (!res.ok) return { images: [], error: `Web image search failed (HTTP ${res.status})` };
      const images = parseBingImages(await res.text());
      return { images, error: images.length ? undefined : 'Web image search returned no results — try a different search.' };
    } catch (err: any) {
      this.logger.warn(`[ImageSearch] ${err.message}`);
      return { images: [], error: `Web image search failed: ${err.message}` };
    }
  }
}
