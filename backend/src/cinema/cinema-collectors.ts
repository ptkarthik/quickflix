import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { detectDate } from '../ott/ott-text.util';
import { videoSegments } from '../ott/official-youtube.collector';
import { INDIAN_LANGS } from '../ott/tmdb-ott.collector';
import { OTT_WORDS, THEATRICAL_WORDS, languagesIn, parseCinemaHeadline, parseMonthCell } from './cinema-text.util';

const UA = 'QuickFlixPoster/1.0 (personal movie-update research tool)';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Official YouTube channels of production houses, music labels (who publish the trailers) and studios' India arms.
 * IDs were resolved from @handles and checked (name + subscriber count) on 2026-11-12. A fan channel here would be
 * treated as official — keep this list audited.
 */
export const CINEMA_CHANNELS: Array<{ id: string; handle: string; name: string; lang?: string }> = [
  // Tamil
  { id: 'UCA7gwgLgmCZ8DSmdf2bhb8g', handle: '@LycaProductions', name: 'Lyca Productions', lang: 'ta' },
  { id: 'UCciiOyy3uemzbp6_gSMcSwA', handle: '@RedGiantMovies', name: 'Red Giant Movies', lang: 'ta' },
  { id: 'UC9WXzTgk10ncJX1eOxHElCg', handle: '@AGSEntertainment', name: 'AGS Entertainment', lang: 'ta' },
  { id: 'UCbpjEr8lHlnkf1SQ5tnDEYw', handle: '@DreamWarriorPictures', name: 'Dream Warrior Pictures', lang: 'ta' },
  { id: 'UCqVDSxEb7MNfYvddpbri4TA', handle: '@YNOTStudios', name: 'YNOT Studios', lang: 'ta' },
  { id: 'UCLbdVvreihwZRL6kwuEUYsA', handle: '@thinkmusicofficial', name: 'Think Music India', lang: 'ta' },
  { id: 'UCTNtRdBAiZtHP9w7JinzfUg', handle: '@SonyMusicSouthVEVO', name: 'Sony Music South' },
  { id: 'UCzee67JnEcuvjErRyWP3GpQ', handle: '@SaregamaTamil', name: 'Saregama Tamil', lang: 'ta' },
  { id: 'UCAEv0ANkT221wXsTnxFnBsQ', handle: '@TSeriesTamil', name: 'T-Series Tamil', lang: 'ta' },
  { id: 'UCf0KybguYN3FqbRoxCbR6kw', handle: '@U1Records', name: 'U1 Records', lang: 'ta' },
  // Telugu
  { id: 'UCKZSn5C-RzrLjuWJF8wWiDw', handle: '@MythriMovieMakers', name: 'Mythri Movie Makers', lang: 'te' },
  { id: 'UC2woPAI_KMAR25R_oezEQqw', handle: '@SitharaEntertainments', name: 'Sithara Entertainments', lang: 'te' },
  { id: 'UCiJfiEg1FImWsVuEu0L8X6Q', handle: '@GeethaArts', name: 'Geetha Arts', lang: 'te' },
  { id: 'UCrzx3ZPXEZpzEGLF1gIuORQ', handle: '@PeopleMediaFactory', name: 'People Media Factory', lang: 'te' },
  { id: 'UCNApqoVYJbYSrni4YsbXzyQ', handle: '@AdityaMusic', name: 'Aditya Music', lang: 'te' },
  { id: 'UCnJjcn5FrgrOEp5_N45ZLEQ', handle: '@TSeriesTelugu', name: 'T-Series Telugu', lang: 'te' },
  { id: 'UCLsSLka8jODBozvi5VTQeaQ', handle: '@ZeeMusicSouth', name: 'Zee Music South' },
  // Hindi
  { id: 'UCbTLwN10NoCU4WDzLf1JMOA', handle: '@YRF', name: 'YRF', lang: 'hi' },
  { id: 'UCGdHCtXEzkCB7-g_NXYZPcw', handle: '@DharmaProductions', name: 'Dharma Productions', lang: 'hi' },
  { id: 'UCq-Fj5jknLsUf-MWSy4_brA', handle: '@tseries', name: 'T-Series', lang: 'hi' },
  { id: 'UC3jMepkLKF8y4iiwWmAB3RA', handle: '@ZeeStudiosOfficial', name: 'Zee Studios', lang: 'hi' },
  { id: 'UCn9BuiRZGR_tPM2GGT4jN-w', handle: '@ExcelMovies', name: 'Excel Movies', lang: 'hi' },
  { id: 'UC-LOdiPoxninevJ0DkleCLg', handle: '@MaddockFilms', name: 'Maddock Films', lang: 'hi' },
  { id: 'UCcXQd6kHKm0b41x8zMVMmMg', handle: '@JioStudios', name: 'Jio Studios', lang: 'hi' },
  { id: 'UCSHLoG-bXj1aVA2T5y8t84A', handle: '@BalajiMotionPictures', name: 'Balaji Motion Pictures', lang: 'hi' },
  { id: 'UC3ar28GS6o1p0m_wabfk2zw', handle: '@PenMovies', name: 'Pen Movies', lang: 'hi' },
  { id: 'UCFFbwnve3yF62-tVXkTyHqg', handle: '@ZeeMusicCompany', name: 'Zee Music Company', lang: 'hi' },
  { id: 'UC56gTxNs4f9xZ7Pa2i5xNzg', handle: '@SonyMusicIndia', name: 'Sony Music India', lang: 'hi' },
  { id: 'UCJrDMFOdv1I2k8n9oK_V21w', handle: '@TipsOfficial', name: 'Tips Official', lang: 'hi' },
  { id: 'UC_A7K2dXFsTMAciGmnNxy-Q', handle: '@SaregamaMusic', name: 'Saregama Music', lang: 'hi' },
  // Malayalam
  { id: 'UC_J44kyEsEB8LPlhfm2Xb4g', handle: '@AashirvadCinemasOfficial', name: 'Aashirvad Cinemas', lang: 'ml' },
  { id: 'UCq6f9bBWaWTHl0FhH167RgA', handle: '@GoodwillEntertainments', name: 'Goodwill Entertainments', lang: 'ml' },
  { id: 'UCyx6Udkt-zEqwEaoq-uWubQ', handle: '@ManoramaMusic', name: 'Manorama Music', lang: 'ml' },
  { id: 'UCoRF8GByEjmM_yHwUGIDGyQ', handle: '@SaregamaMalayalam', name: 'Saregama Malayalam', lang: 'ml' },
  { id: 'UCvANYBOSmq2IasMM-djF-cQ', handle: '@MillenniumAudios', name: 'Millennium Audios', lang: 'ml' },
  // Kannada
  { id: 'UC3DOgauBYLQQXdH1siGjfpw', handle: '@KVNProductionsOfficial', name: 'KVN Productions', lang: 'kn' },
  { id: 'UCLtCejNl8eAg4PO_9lf2TIg', handle: '@AnandAudio', name: 'Anand Audio', lang: 'kn' },
  { id: 'UCPSb5hoJuGd_M421vocSM2A', handle: '@PRKAudio', name: 'PRK Audio', lang: 'kn' },
  { id: 'UCKFnbjBQDzzh002TMJcyuZA', handle: '@SaregamaKannada', name: 'Saregama Kannada', lang: 'kn' },
  // Hollywood releases in India
  { id: 'UC2FrJXBb3WVAKZ8jpxkZxlA', handle: '@WarnerBrosIndia', name: 'Warner Bros. India', lang: 'en' },
  { id: 'UCFqyJFbsV-uEcosvNhg0PaQ', handle: '@SonyPicturesIndia', name: 'Sony Pictures India', lang: 'en' },
  { id: 'UCobkbYYx90aDf_oMxwni0bQ', handle: '@UniversalPicturesIndia', name: 'Universal Pictures India', lang: 'en' },
  { id: 'UCspalUJnv2_zLW7Av3GJ5cQ', handle: '@ParamountPicturesIndia', name: 'Paramount Pictures India', lang: 'en' },
  { id: 'UCcpyP5B4qeKplEHv6wYnJcw', handle: '@DisneyIndia', name: 'Disney India', lang: 'en' },
];

export const WIKI_LANGS: Array<{ code: string; name: string }> = [
  { code: 'ta', name: 'Tamil' }, { code: 'te', name: 'Telugu' }, { code: 'hi', name: 'Hindi' }, { code: 'ml', name: 'Malayalam' },
  { code: 'kn', name: 'Kannada' }, { code: 'mr', name: 'Marathi' }, { code: 'bn', name: 'Bengali' }, { code: 'pa', name: 'Punjabi' }, { code: 'gu', name: 'Gujarati' },
];

export interface TmdbCinemaClaim {
  tmdbId: number;
  title: string;
  originalTitle: string;
  language: string;
  date: string; // India theatrical
  certificate?: string;
  runtime?: number;
  posterPath?: string;
  overview?: string;
  ottDate?: string;
  alsoIn: string[];
  popularity: number;
}

export interface WikiCinemaRow {
  title: string;
  language: string;
  date: string;
  production?: string;
  pageUrl: string;
}

export interface CinemaVideo {
  channel: (typeof CINEMA_CHANNELS)[number];
  videoTitle: string;
  url: string;
  publishedAt: Date;
  claimedDate?: string;
  segments: string[];
  alsoIn: string[];
}

export interface CinemaNewsItem {
  title: string;
  date?: string;
  postponed: boolean;
  headline: string;
  url: string;
  sourceName: string;
  publishedAt: Date;
  languages: string[];
}

/** Expand a wikitable (rowspan/colspan) into a plain grid of cell texts. */
export function tableGrid($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): string[][] {
  const grid: string[][] = [];
  table.find('tr').each((ri, tr) => {
    grid[ri] = grid[ri] || [];
    let ci = 0;
    $(tr)
      .children('th,td')
      .each((_, cell) => {
        while (grid[ri][ci] !== undefined) ci++;
        const rs = Math.min(60, Number($(cell).attr('rowspan')) || 1);
        const cs = Math.min(10, Number($(cell).attr('colspan')) || 1);
        const text = $(cell).text().replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
        for (let a = 0; a < rs; a++) for (let b = 0; b < cs; b++) {
          grid[ri + a] = grid[ri + a] || [];
          grid[ri + a][ci + b] = text;
        }
        ci += cs;
      });
  });
  return grid;
}

/** Rows of Wikipedia "List of <Language> films of <year>" Opening tables. */
export function parseWikiFilmList(html: string, year: number, language: string, pageUrl: string): WikiCinemaRow[] {
  const $ = cheerio.load(html);
  const out: WikiCinemaRow[] = [];
  $('table.wikitable').each((_, t) => {
    const grid = tableGrid($, $(t));
    const head = grid[0] || [];
    if (!/opening/i.test(head.join(' '))) return;
    const titleCol = head.findIndex(h => /^title$/i.test(h));
    const prodCol = head.findIndex(h => /production|studio/i.test(h));
    if (titleCol < 2) return;
    for (const row of grid.slice(1)) {
      const month = parseMonthCell(row[0] || '');
      const day = parseInt((row[1] || '').replace(/\D+/g, ''), 10);
      const title = (row[titleCol] || '').replace(/[†‡*#§]+/g, '').trim();
      if (!month || !day || day > 31 || !title || title.length > 80 || /^title$/i.test(title)) continue;
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (isNaN(Date.parse(date))) continue;
      out.push({ title, language, date, production: prodCol > 0 ? row[prodCol] : undefined, pageUrl });
    }
  });
  return out;
}

@Injectable()
export class CinemaCollectors {
  private readonly logger = new Logger(CinemaCollectors.name);

  // ───────────── TMDB (India theatrical release events) ─────────────
  async tmdb(from: string, to: string): Promise<{ claims: TmdbCinemaClaim[]; errors: string[] }> {
    const key = process.env.TMDB_API_KEY;
    if (!key) return { claims: [], errors: ['TMDB_API_KEY not set'] };
    const get = async (path: string, params: Record<string, string | number> = {}) => {
      const qs = new URLSearchParams({ api_key: key, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
      for (let i = 0; i < 3; i++) {
        try {
          const res = await fetch(`https://api.themoviedb.org/3${path}?${qs}`, { signal: AbortSignal.timeout(15000) });
          if (res.status === 429) { await sleep(1500 * (i + 1)); continue; }
          return res.ok ? ((await res.json()) as any) : null;
        } catch {
          await sleep(500);
        }
      }
      return null;
    };
    const errors: string[] = [];
    const ids = new Map<number, any>();
    for (let page = 1; page <= 25; page++) {
      const d = await get('/discover/movie', { region: 'IN', with_release_type: '2|3', 'release_date.gte': from, 'release_date.lte': to, sort_by: 'popularity.desc', page });
      if (!d) { errors.push(`discover page ${page} failed`); break; }
      for (const m of d.results || []) ids.set(m.id, m);
      if (page >= (d.total_pages || 1)) break;
    }
    const minIntl = Number(process.env.CINEMA_MIN_POPULARITY_INTL || 5);
    const keep = [...ids.values()].filter(m => INDIAN_LANGS.includes(m.original_language) || (m.popularity || 0) >= minIntl);
    const claims: TmdbCinemaClaim[] = [];
    for (let i = 0; i < keep.length; i += 8) {
      await Promise.all(
        keep.slice(i, i + 8).map(async m => {
          const d = await get(`/movie/${m.id}`, { append_to_response: 'release_dates' });
          if (!d) return;
          const india = (d.release_dates?.results || []).find((r: any) => r.iso_3166_1 === 'IN')?.release_dates || [];
          const theatrical = india.filter((e: any) => e.type === 3 || e.type === 2).map((e: any) => e.release_date.slice(0, 10)).sort();
          if (!theatrical.length) return;
          const wide = india.filter((e: any) => e.type === 3).map((e: any) => e.release_date.slice(0, 10)).sort();
          const digital = india.filter((e: any) => e.type === 4).map((e: any) => e.release_date.slice(0, 10)).sort();
          const cert = india.map((e: any) => (e.certification || '').trim()).find(Boolean);
          const alsoIn = languagesIn(india.map((e: any) => e.note || '').join(' ')).filter(l => l !== d.original_language);
          claims.push({
            tmdbId: d.id,
            title: d.title,
            originalTitle: d.original_title,
            language: d.original_language,
            date: (wide[0] || theatrical[0]) as string,
            certificate: cert,
            runtime: d.runtime || undefined,
            posterPath: d.poster_path || undefined,
            overview: d.overview || undefined,
            ottDate: digital[0],
            alsoIn,
            popularity: d.popularity || 0,
          });
        }),
      );
    }
    this.logger.log(`[Cinema/TMDB] ${ids.size} discovered, ${claims.length} with an India theatrical date (${from} → ${to}).`);
    return { claims, errors };
  }

  // ───────────── Wikipedia film lists ─────────────
  async wikipedia(years: number[]): Promise<{ rows: WikiCinemaRow[]; errors: string[] }> {
    const rows: WikiCinemaRow[] = [];
    const errors: string[] = [];
    for (const year of years) {
      for (const l of WIKI_LANGS) {
        const page = `List_of_${l.name}_films_of_${year}`;
        try {
          // Wikipedia rate-limits bursts ("You are making too many requests") — go slowly and retry.
          let j: any = null;
          for (let attempt = 0; attempt < 3 && !j; attempt++) {
            const res = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=text&formatversion=2&redirects=1&page=${page}`, {
              headers: { 'User-Agent': UA },
              signal: AbortSignal.timeout(30000),
            });
            const body = await res.text();
            try {
              j = JSON.parse(body);
            } catch {
              await sleep(8000 * (attempt + 1));
            }
          }
          if (!j) throw new Error('rate-limited by Wikipedia');
          if (j.error) { if (j.error.code !== 'missingtitle') errors.push(`${page}: ${j.error.info}`); continue; }
          rows.push(...parseWikiFilmList(j.parse.text, year, l.code, `https://en.wikipedia.org/wiki/${page}`));
        } catch (err: any) {
          errors.push(`${page}: ${err.message}`);
        }
        await sleep(1500);
      }
    }
    this.logger.log(`[Cinema/Wikipedia] ${rows.length} dated rows from ${years.join(', ')}.`);
    return { rows, errors };
  }

  // ───────────── Official YouTube channels ─────────────
  parseVideo(channel: (typeof CINEMA_CHANNELS)[number], videoTitle: string, description: string, url: string, publishedAt: Date): CinemaVideo {
    const firstLines = description.split('\n').slice(0, 4).join(' ');
    const isOtt = OTT_WORDS.test(videoTitle) || OTT_WORDS.test(firstLines.slice(0, 200));
    let claimedDate: string | undefined;
    if (!isOtt) {
      if (THEATRICAL_WORDS.test(videoTitle) || /\b(in|from)\s+(cinemas?|theat(re|er)s?)\b/i.test(videoTitle)) claimedDate = detectDate(videoTitle, publishedAt);
      if (!claimedDate && THEATRICAL_WORDS.test(firstLines)) claimedDate = detectDate(firstLines, publishedAt);
      // "… | Nov 13" style titles on trailers/promos of a film
      if (!claimedDate && /\b(trailer|teaser|promo|glimpse|release)\b/i.test(videoTitle)) claimedDate = detectDate(videoTitle, publishedAt);
    }
    return { channel, videoTitle, url, publishedAt, claimedDate, segments: videoSegments(videoTitle, publishedAt), alsoIn: languagesIn(videoTitle) };
  }

  async youtube(): Promise<{ videos: CinemaVideo[]; errors: string[] }> {
    const videos: CinemaVideo[] = [];
    const errors: string[] = [];
    for (let i = 0; i < CINEMA_CHANNELS.length; i += 6) {
      await Promise.all(
        CINEMA_CHANNELS.slice(i, i + 6).map(async ch => {
          try {
            const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const $ = cheerio.load(await res.text(), { xmlMode: true });
            $('entry').each((_, el) => {
              const e = $(el);
              const title = e.find('title').first().text().trim();
              const url = e.find('link').attr('href') || '';
              const published = new Date(e.find('published').first().text().trim());
              const description = e.find('media\\:description').first().text();
              if (title && url) videos.push(this.parseVideo(ch, title, description, url, isNaN(published.getTime()) ? new Date() : published));
            });
          } catch (err: any) {
            errors.push(`${ch.handle}: ${err.message}`);
          }
        }),
      );
    }
    this.logger.log(`[Cinema/YouTube] ${CINEMA_CHANNELS.length - errors.length}/${CINEMA_CHANNELS.length} channels, ${videos.length} videos, ${videos.filter(v => v.claimedDate).length} with a cinema date.`);
    return { videos, errors };
  }

  // ───────────── Google News (India) ─────────────
  async news(): Promise<{ items: CinemaNewsItem[]; errors: string[] }> {
    const langs = ['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada', 'Marathi', 'Bengali', 'Hollywood'];
    const queries = [
      ...langs.map(l => `${l} film release date theatres when:14d`),
      ...langs.map(l => `${l} film postponed when:21d`),
      '"in cinemas" release date when:7d',
      '"new release date" film when:14d',
    ];
    const items: CinemaNewsItem[] = [];
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const q of queries) {
      try {
        const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const $ = cheerio.load(await res.text(), { xmlMode: true });
        $('item').each((_, el) => {
          const it = $(el);
          const raw = it.find('title').first().text().trim();
          const link = it.find('link').first().text().trim();
          const sourceName = it.find('source').first().text().trim() || 'News';
          const pub = new Date(it.find('pubDate').first().text().trim() || Date.now());
          const headline = raw.endsWith(` - ${sourceName}`) ? raw.slice(0, -(sourceName.length + 3)).trim() : raw;
          if (seen.has(headline)) return;
          seen.add(headline);
          const parsed = parseCinemaHeadline(headline, pub);
          if (parsed) items.push({ ...parsed, headline, url: link, sourceName, publishedAt: pub, languages: languagesIn(headline) });
        });
      } catch (err: any) {
        errors.push(`${q}: ${err.message}`);
      }
      await sleep(400);
    }
    this.logger.log(`[Cinema/News] ${seen.size} headlines, ${items.length} about one film's cinema release (${items.filter(i => i.postponed).length} postponement).`);
    return { items, errors };
  }
}
