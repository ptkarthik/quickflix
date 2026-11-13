import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** TMDB genres for OTT + cinema titles — they drive the automatic post theme. */
@Injectable()
export class GenreService {
  private readonly logger = new Logger(GenreService.name);

  constructor(private readonly prisma: PrismaService) {}

  async fetch(tmdbId: number, type: 'movie' | 'tv'): Promise<string[] | null> {
    const key = process.env.TMDB_API_KEY;
    if (!key) return null;
    try {
      const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${key}`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) return null;
      const j: any = await res.json();
      return (j.genres || []).map((g: any) => g.name).filter(Boolean);
    } catch {
      return null;
    }
  }

  /** Fill genres for titles that have a TMDB id but no genres yet (bounded per run). */
  async backfill(limit = 150): Promise<{ ott: number; cinema: number }> {
    let ott = 0;
    let cinema = 0;
    const ottRows = await this.prisma.ottRelease.findMany({ where: { tmdbId: { not: null }, genres: null, status: { not: 'REJECTED' } }, take: limit });
    for (let i = 0; i < ottRows.length; i += 8) {
      await Promise.all(
        ottRows.slice(i, i + 8).map(async r => {
          const g = await this.fetch(r.tmdbId!, r.contentType === 'tv' ? 'tv' : 'movie');
          if (g) {
            await this.prisma.ottRelease.update({ where: { id: r.id }, data: { genres: g.join(',') || '' } });
            ott++;
          }
        }),
      );
    }
    const cinemaRows = await this.prisma.cinemaRelease.findMany({ where: { tmdbId: { not: null }, genres: null, status: { not: 'REJECTED' } }, take: limit });
    for (let i = 0; i < cinemaRows.length; i += 8) {
      await Promise.all(
        cinemaRows.slice(i, i + 8).map(async r => {
          const g = await this.fetch(r.tmdbId!, 'movie');
          if (g) {
            await this.prisma.cinemaRelease.update({ where: { id: r.id }, data: { genres: g.join(',') || '' } });
            cinema++;
          }
        }),
      );
    }
    if (ott || cinema) this.logger.log(`[Genres] filled ${ott} OTT + ${cinema} cinema titles.`);
    return { ott, cinema };
  }
}
