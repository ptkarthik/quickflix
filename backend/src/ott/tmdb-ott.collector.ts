import { Injectable, Logger } from '@nestjs/common';
import { KNOWN_PLATFORMS, detectDubLanguage, normalizePlatform } from './ott-text.util';

export const INDIAN_LANGS = ['ta', 'te', 'ml', 'kn', 'hi', 'mr', 'bn', 'pa', 'gu', 'or'];

export interface TmdbReleaseClaim {
  tmdbId: number;
  contentType: 'movie' | 'tv';
  seasonNumber?: number;
  title: string;
  originalLanguage?: string;
  posterPath?: string;
  overview?: string;
  popularity?: number;
  originalYear?: number;
  date: string; // India digital release date (movie) or season premiere date (tv)
  platform?: string;
  dubLanguage?: string;
  text: string;
  url: string;
}

/**
 * Free structured data from TMDB (India region):
 *  - Movies: India "Digital" (type 4) release events, often with the platform in the note.
 *  - Series: new seasons premiering in the window on Indian streaming platforms.
 *  - Live check: what is streaming in India *right now* (watch providers, powered by JustWatch).
 */
@Injectable()
export class TmdbOttCollector {
  private readonly logger = new Logger(TmdbOttCollector.name);
  private readonly base = 'https://api.themoviedb.org/3';
  private providerNames: Map<number, string> | null = null;

  private get key() {
    return process.env.TMDB_API_KEY;
  }

  get enabled() {
    return !!this.key;
  }

  private async get<T = any>(path: string, params: Record<string, string | number> = {}): Promise<T | null> {
    const qs = new URLSearchParams({ api_key: this.key!, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${this.base}${path}?${qs}`, { signal: AbortSignal.timeout(12000) });
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        if (!res.ok) return null;
        return (await res.json()) as T;
      } catch {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    return null;
  }

  private async batch<I, O>(items: I[], size: number, fn: (i: I) => Promise<O>): Promise<O[]> {
    const out: O[] = [];
    for (let i = 0; i < items.length; i += size) {
      out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
      await new Promise(r => setTimeout(r, 150));
    }
    return out;
  }

  private minIntlPopularity() {
    const v = Number(process.env.OTT_MIN_POPULARITY_INTL);
    return v >= 0 && !isNaN(v) && process.env.OTT_MIN_POPULARITY_INTL ? v : 3;
  }

  private keep(lang: string | undefined, popularity: number | undefined) {
    return INDIAN_LANGS.includes(lang || '') || (popularity || 0) >= this.minIntlPopularity();
  }

  /** TMDB provider ids → our canonical platform names (only Indian subscription platforms we track). */
  async indianProviderIds(): Promise<Map<number, string>> {
    if (this.providerNames) return this.providerNames;
    const map = new Map<number, string>();
    for (const kind of ['movie', 'tv']) {
      const res = await this.get<{ results: Array<{ provider_id: number; provider_name: string }> }>(`/watch/providers/${kind}`, { watch_region: 'IN' });
      for (const p of res?.results || []) {
        const name = normalizePlatform(p.provider_name);
        if (name && KNOWN_PLATFORMS.includes(name)) map.set(p.provider_id, name);
      }
    }
    this.providerNames = map;
    return map;
  }

  async collectReleases(fromDate: string, toDate: string): Promise<{ claims: TmdbReleaseClaim[]; errors: string[] }> {
    if (!this.enabled) return { claims: [], errors: ['TMDB_API_KEY not set'] };
    const errors: string[] = [];
    const claims: TmdbReleaseClaim[] = [];

    // ── Movies with an India digital release in the window ──
    const movies: any[] = [];
    for (let page = 1; page <= 15; page++) {
      const res = await this.get<any>('/discover/movie', {
        region: 'IN', with_release_type: 4, 'release_date.gte': fromDate, 'release_date.lte': toDate,
        sort_by: 'popularity.desc', include_adult: 'false', page,
      });
      if (!res) { errors.push(`discover/movie page ${page} failed`); break; }
      movies.push(...res.results);
      if (page >= res.total_pages) break;
    }
    const keptMovies = movies.filter(m => this.keep(m.original_language, m.popularity));
    await this.batch(keptMovies, 8, async m => {
      const rd = await this.get<any>(`/movie/${m.id}/release_dates`);
      const inEvents: Array<{ type: number; release_date: string; note?: string }> = rd?.results?.find((r: any) => r.iso_3166_1 === 'IN')?.release_dates || [];
      const digital = inEvents
        .filter(e => e.type === 4)
        .map(e => ({ date: e.release_date.slice(0, 10), note: (e.note || '').trim() }))
        .filter(e => e.date >= fromDate && e.date <= toDate)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (digital.length === 0) return;
      // With region=IN, discover's release_date is the India (digital) date — the original year must come from
      // the earliest release anywhere, otherwise old films newly added to a platform look like new releases.
      const earliest = (rd?.results || [])
        .flatMap((r: any) => (r.release_dates || []).map((e: any) => String(e.release_date).slice(0, 10)))
        .filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort()[0];
      const originalYear = earliest ? parseInt(earliest.slice(0, 4), 10) : undefined;

      // Dub events are identified only when the note names a language; unlabelled extra events are
      // recorded in the text but not claimed (they would otherwise create false date conflicts).
      const byVersion = new Map<string, { date: string; note: string }>();
      for (const e of digital) {
        const dub = detectDubLanguage(e.note) || (/^(tamil|telugu|malayalam|kannada|hindi|english)$/i.test(e.note) ? detectDubLanguage(`(${e.note})`) : undefined);
        const versionKey = dub && dub !== m.original_language ? dub : '';
        if (!byVersion.has(versionKey)) byVersion.set(versionKey, e);
      }
      const allDates = digital.map(e => `${e.date}${e.note ? ` (${e.note})` : ''}`).join(', ');
      for (const [dub, e] of byVersion) {
        const notePlatform = normalizePlatform(e.note);
        claims.push({
          tmdbId: m.id,
          contentType: 'movie',
          title: m.title,
          originalLanguage: m.original_language,
          posterPath: m.poster_path || undefined,
          overview: m.overview || undefined,
          popularity: m.popularity,
          originalYear,
          date: e.date,
          platform: notePlatform && KNOWN_PLATFORMS.includes(notePlatform) ? notePlatform : undefined,
          dubLanguage: dub || undefined,
          text: `TMDB India digital release: ${allDates}`,
          url: `https://www.themoviedb.org/movie/${m.id}/releases`,
        });
      }
    });

    // ── Series: new seasons premiering in the window on Indian streaming platforms ──
    const providers = await this.indianProviderIds();
    const shows: any[] = [];
    if (providers.size > 0) {
      for (let page = 1; page <= 8; page++) {
        const res = await this.get<any>('/discover/tv', {
          watch_region: 'IN', with_watch_monetization_types: 'flatrate', with_watch_providers: Array.from(providers.keys()).join('|'),
          'air_date.gte': fromDate, 'air_date.lte': toDate, sort_by: 'popularity.desc', page,
        });
        if (!res) { errors.push(`discover/tv page ${page} failed`); break; }
        shows.push(...res.results);
        if (page >= res.total_pages) break;
      }
    }
    const keptShows = shows.filter(s => this.keep(s.original_language, s.popularity));
    await this.batch(keptShows, 8, async s => {
      const d = await this.get<any>(`/tv/${s.id}`);
      if (!d) return;
      // A season *premiere* inside the window (not just new episodes of an ongoing season).
      const season = (d.seasons || [])
        .filter((x: any) => x.season_number > 0 && x.air_date && x.air_date >= fromDate && x.air_date <= toDate)
        .sort((a: any, b: any) => b.air_date.localeCompare(a.air_date))[0];
      if (!season) return;
      const network = (d.networks || []).map((n: any) => normalizePlatform(n.name)).find((p: string | undefined) => p && KNOWN_PLATFORMS.includes(p));
      claims.push({
        tmdbId: s.id,
        contentType: 'tv',
        seasonNumber: season.season_number,
        title: s.name,
        originalLanguage: s.original_language,
        posterPath: season.poster_path || s.poster_path || undefined,
        overview: s.overview || undefined,
        popularity: s.popularity,
        originalYear: s.first_air_date ? parseInt(s.first_air_date.slice(0, 4), 10) : undefined,
        date: season.air_date,
        platform: network,
        text: `TMDB: Season ${season.season_number} premieres ${season.air_date}${network ? ` (network: ${network})` : ''}`,
        url: `https://www.themoviedb.org/tv/${s.id}/season/${season.season_number}`,
      });
    });

    this.logger.log(`[TmdbOtt] ${claims.length} claims (${keptMovies.length}/${movies.length} movies, ${keptShows.length}/${shows.length} series kept).`);
    return { claims, errors };
  }

  /** Platforms (ours) where the title is streaming in India right now. null = lookup failed. */
  async livePlatformsInIndia(tmdbId: number, contentType: 'movie' | 'tv'): Promise<string[] | null> {
    if (!this.enabled) return null;
    const res = await this.get<any>(`/${contentType}/${tmdbId}/watch/providers`);
    if (!res) return null;
    const IN = res.results?.IN;
    if (!IN) return [];
    const names = [...(IN.flatrate || []), ...(IN.ads || []), ...(IN.free || [])]
      .map((p: any) => normalizePlatform(p.provider_name))
      .filter((p: string | undefined): p is string => !!p && KNOWN_PLATFORMS.includes(p));
    return Array.from(new Set(names));
  }
}
