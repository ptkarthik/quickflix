import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import * as zlib from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { PrismaService } from '../prisma/prisma.service';
import { scoreFields } from './world.util';

const URL = 'https://datasets.imdbws.com/title.ratings.tsv.gz';
const DIR = path.join(process.cwd(), 'data', 'imdb');
const FILE = path.join(DIR, 'title.ratings.tsv.gz');
const BASICS_URL = 'https://datasets.imdbws.com/title.basics.tsv.gz';
const BASICS = path.join(DIR, 'title.basics.tsv.gz');

/** IMDb title types that are a feature film. Everything else (tvEpisode, tvSpecial, tvMovie, tvMiniSeries, short, video, …) is not. */
export const FEATURE_TYPES = ['movie'];

/** One line of title.basics.tsv → [tconst, titleType], or null. */
export function parseBasicsLine(line: string): [string, string] | null {
  const i = line.indexOf('\t');
  const j = line.indexOf('\t', i + 1);
  if (i < 0 || j < 0) return null;
  const tconst = line.slice(0, i);
  const type = line.slice(i + 1, j);
  return /^tt\d{5,12}$/.test(tconst) && /^[a-zA-Z]{2,20}$/.test(type) ? [tconst, type] : null;
}

/** One line of title.ratings.tsv → row, or null for the header / anything malformed. */
export function parseRatingLine(line: string): { tconst: string; rating: number; votes: number } | null {
  const [tconst, r, v] = line.split('\t');
  if (!/^tt\d{5,12}$/.test(tconst || '')) return null;
  const rating = Number(r);
  const votes = Number(v);
  if (!Number.isFinite(rating) || rating < 1 || rating > 10 || !Number.isInteger(votes) || votes < 0) return null;
  return { tconst, rating, votes };
}

/**
 * IMDb's official daily ratings file — every title's IMDb rating & votes, free, no key, no daily limit
 * (IMDb licence: personal & non-commercial use). Replaces OMDb as the IMDb source; OMDb is kept for RT/Metacritic.
 */
@Injectable()
export class ImdbDatasetService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ImdbDatasetService.name);
  private timer?: NodeJS.Timeout;
  private kickoff?: NodeJS.Timeout;
  status: { running: boolean; rows?: number; updatedTitles?: number; typedTitles?: number; fileDate?: string; typesDate?: string; error?: string; finishedAt?: string } = { running: false };

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    if (process.env.IMDB_DATASETS === 'false') return;
    this.kickoff = setTimeout(() => this.sync().catch(() => null), 30000);
    this.timer = setInterval(() => this.sync().catch(() => null), 6 * 3600000); // re-checks; downloads only when >20h old
  }
  onModuleDestroy() {
    clearTimeout(this.kickoff);
    clearInterval(this.timer);
  }

  fileDate(file = FILE): Date | null {
    try {
      return fs.statSync(file).mtime;
    } catch {
      return null;
    }
  }

  async get(imdbId?: string | null) {
    if (!imdbId) return null;
    return this.prisma.imdbRating.findUnique({ where: { tconst: imdbId } });
  }

  /** Download (if older than 20h, or forced), load into ImdbRating, then update every World title's IMDb columns. */
  async sync(force = false) {
    if (this.status.running) return this.status;
    this.status = { running: true };
    try {
      const age = this.fileDate();
      const haveRows = (await this.prisma.imdbRating.count()) > 0;
      const stale = force || !age || Date.now() - age.getTime() > 20 * 3600000;
      if (stale) await this.download();
      if (stale || !haveRows) this.status.rows = await this.load();
      this.status.updatedTitles = await this.applyToWorld();
      this.status.typedTitles = await this.syncTypes(force);
      this.status.typesDate = this.fileDate(BASICS)?.toISOString();
      this.status.fileDate = this.fileDate()?.toISOString();
      this.status.finishedAt = new Date().toISOString();
      this.logger.log(`[IMDb] ratings file ${this.status.fileDate} · ${this.status.rows ?? 'cached'} rows · ${this.status.updatedTitles} World titles updated`);
    } catch (e: any) {
      this.status.error = e.message;
      this.logger.warn(`[IMDb] dataset sync failed: ${e.message}`);
    } finally {
      this.status.running = false;
    }
    return this.status;
  }

  private async download(url = URL, file = FILE, timeoutMs = 120000) {
    fs.mkdirSync(DIR, { recursive: true });
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok || !res.body) throw new Error(`download HTTP ${res.status}`);
    const tmp = `${file}.part`;
    await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(tmp));
    fs.renameSync(tmp, file);
  }

  /**
   * IMDb's title types (title.basics, ~230 MB, downloaded weekly) → WorldTitle.imdbType for every title we hold,
   * so "Movies" can mean feature films only (no TV episodes / specials / TV movies / mini-series / stand-up videos).
   */
  async syncTypes(force = false): Promise<number> {
    const age = this.fileDate(BASICS);
    if (force || !age || Date.now() - age.getTime() > 6.5 * 86400000) await this.download(BASICS_URL, BASICS, 15 * 60000);
    const rows = await this.prisma.worldTitle.findMany({ where: { imdbId: { not: null } }, select: { id: true, imdbId: true, imdbType: true } });
    const want = new Map<string, Array<{ id: string; imdbType: string | null }>>();
    for (const r of rows) {
      const list = want.get(r.imdbId!) || [];
      list.push(r);
      want.set(r.imdbId!, list);
    }
    const changes: Array<{ id: string; type: string }> = [];
    const rl = readline.createInterface({ input: fs.createReadStream(BASICS).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    for await (const line of rl) {
      const id = line.slice(0, line.indexOf('\t'));
      const hits = want.get(id);
      if (!hits) continue;
      const p = parseBasicsLine(line);
      if (!p) continue;
      for (const h of hits) if (h.imdbType !== p[1]) changes.push({ id: h.id, type: p[1] });
    }
    for (let i = 0; i < changes.length; i += 500) {
      await this.prisma.$transaction(changes.slice(i, i + 500).map(c => this.prisma.worldTitle.update({ where: { id: c.id }, data: { imdbType: c.type } })));
    }
    return changes.length;
  }


  /**
   * Every IMDb movie / series with at least `minVotes` votes (from IMDb's own full title list + ratings file) —
   * used to find well-known titles that TMDB's discover search didn't surface. Adult titles are skipped.
   */
  async knownTitles(minVotes: number, types = ['movie', 'tvSeries', 'tvMiniSeries']): Promise<Array<{ tconst: string; type: string; title: string; year: number | null; votes: number }>> {
    if (!fs.existsSync(BASICS)) await this.download(BASICS_URL, BASICS, 15 * 60000);
    const rows = await this.prisma.imdbRating.findMany({ where: { votes: { gte: minVotes } }, select: { tconst: true, votes: true } });
    const votes = new Map(rows.map(r => [r.tconst, r.votes]));
    const want = new Set(types);
    const out: Array<{ tconst: string; type: string; title: string; year: number | null; votes: number }> = [];
    const rl = readline.createInterface({ input: fs.createReadStream(BASICS).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    for await (const line of rl) {
      const id = line.slice(0, line.indexOf('\t'));
      const v = votes.get(id);
      if (v == null) continue;
      // tconst, titleType, primaryTitle, originalTitle, isAdult, startYear, …
      const f = line.split('\t');
      if (!want.has(f[1]) || f[4] === '1') continue;
      out.push({ tconst: id, type: f[1], title: f[2], year: /^\d{4}$/.test(f[5]) ? Number(f[5]) : null, votes: v });
    }
    return out.sort((a, b) => b.votes - a.votes);
  }

  private async load(): Promise<number> {
    const rl = readline.createInterface({ input: fs.createReadStream(FILE).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    let batch: string[] = [];
    let rows = 0;
    const flush = async () => {
      if (!batch.length) return;
      // values are validated (tt-id regex, numbers) so inlining is safe; params would hit SQLite's variable limit
      await this.prisma.$executeRawUnsafe(`INSERT OR REPLACE INTO ImdbRating (tconst, rating, votes) VALUES ${batch.join(',')}`);
      batch = [];
    };
    await this.prisma.$executeRawUnsafe('DELETE FROM ImdbRating');
    for await (const line of rl) {
      const r = parseRatingLine(line);
      if (!r) continue;
      batch.push(`('${r.tconst}',${r.rating},${r.votes})`);
      rows++;
      if (batch.length >= 1000) await flush();
    }
    await flush();
    return rows;
  }

  /** Copy IMDb rating/votes onto World titles (matched by IMDb id) and recompute their score/rank. */
  async applyToWorld(): Promise<number> {
    const titles: Array<{ id: string; imdbId: string; imdbRating: number | null; imdbVotes: number | null; tmdbRating: number | null; tmdbVotes: number | null; rating: number; votes: number }> =
      await this.prisma.$queryRawUnsafe(
        `SELECT w.id, w.imdbId, w.imdbRating, w.imdbVotes, w.tmdbRating, w.tmdbVotes, r.rating, r.votes
         FROM WorldTitle w JOIN ImdbRating r ON r.tconst = w.imdbId
         WHERE w.imdbRating IS NULL OR w.imdbRating <> r.rating OR w.imdbVotes IS NULL OR w.imdbVotes <> r.votes`,
      );
    for (let i = 0; i < titles.length; i += 300) {
      await this.prisma.$transaction(
        titles.slice(i, i + 300).map(t => {
          const next = { imdbRating: t.rating, imdbVotes: Number(t.votes), tmdbRating: t.tmdbRating, tmdbVotes: t.tmdbVotes == null ? null : Number(t.tmdbVotes) };
          return this.prisma.worldTitle.update({ where: { id: t.id }, data: { imdbRating: next.imdbRating, imdbVotes: next.imdbVotes, ...scoreFields(next) } });
        }),
      );
    }
    return titles.length;
  }
}
