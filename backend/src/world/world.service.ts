import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NON_SCRIPTED_TV, WorldFacts, WorldKind, mapTmdbDetails, mapTmdbListItem, scoreFields } from './world.util';
import { parseOmdbFull } from '../extras/extras.util';
import { FEATURE_TYPES, ImdbDatasetService } from './imdb-dataset.service';

export type WorldStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface WorldFilter {
  kind?: string;
  status?: string; // APPROVED | PENDING | REJECTED | ALL (default: not rejected)
  q?: string;
  language?: string; // comma list
  country?: string; // ISO code
  /** "Crime" · "Crime,Thriller" = both · "Science Fiction|Sci-Fi & Fantasy" = either */
  genre?: string;
  excludeGenre?: string;
  yearFrom?: string | number;
  yearTo?: string | number;
  minRating?: string | number;
  /** TMDB vote count (same scale for every title, unlike IMDb votes). */
  minVotes?: string | number;
  maxVotes?: string | number;
  minRuntime?: string | number;
  maxRuntime?: string | number;
  maxSeasons?: string | number;
  provider?: string;
  scriptedOnly?: string | boolean; // tv: hide reality/news/talk shows (default true)
  /** movies: feature films only — no TV episodes/specials, TV movies, mini-series, shorts, stand-up videos (default true) */
  featureOnly?: string | boolean;
  /** movies: hide documentaries (default true, unless you filter by the Documentary genre) */
  noDocs?: string | boolean;
  /** only titles free (with ads) to stream in India */
  freeIn?: string | boolean;
  sort?: string; // score | votes | year | title | newest
}

export interface ScanInput {
  kind: WorldKind;
  language?: string;
  country?: string;
  genreId?: number;
  yearFrom?: number;
  yearTo?: number;
  minVotes?: number;
  sort?: 'vote_count.desc' | 'popularity.desc' | 'vote_average.desc';
  pages?: number;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const num = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v));
const TMDB = 'https://api.themoviedb.org/3';

@Injectable()
export class WorldService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WorldService.name);
  fetchImpl: typeof fetch = (...a) => fetch(...a);
  private timer?: NodeJS.Timeout;
  private kickoff?: NodeJS.Timeout;
  private enriching = false;
  private genreCache: Partial<Record<WorldKind, Record<number, string>>> = {};
  private facetCache = new Map<string, { at: number; data: unknown }>();
  private omdbBlockedUntil = 0;
  scan: { active: boolean; kind?: string; page: number; pages: number; seen: number; added: number; error?: string; startedAt?: string; finishedAt?: string; mode?: string; lang?: string; langDone?: number; langTotal?: number } = { active: false, page: 0, pages: 0, seen: 0, added: 0 };
  lastEnrich: { at?: string; tmdb: number; omdb: number; note?: string } = { tmdb: 0, omdb: 0 };

  constructor(
    private readonly prisma: PrismaService,
    private readonly imdb: ImdbDatasetService,
  ) {}

  // ───────────────────────── background enrichment ─────────────────────────

  onApplicationBootstrap() {
    this.backfillRank().catch(e => this.logger.warn(`[World] rank backfill failed: ${e.message}`));
    if (process.env.WORLD_AUTO_ENRICH === 'false') return;
    const minutes = Number(process.env.WORLD_ENRICH_INTERVAL_MIN || 20);
    this.kickoff = setTimeout(() => this.enrichBatch().catch(e => this.logger.warn(`[World] enrich failed: ${e.message}`)), 90000);
    this.timer = setInterval(() => this.enrichBatch().catch(e => this.logger.warn(`[World] enrich failed: ${e.message}`)), minutes * 60000);
  }
  onModuleDestroy() {
    clearTimeout(this.kickoff);
    clearInterval(this.timer);
  }

  /** Weighted "Best rated" value for rows that don't have one yet (one-off after the column was added). */
  async backfillRank() {
    const rows = await this.prisma.worldTitle.findMany({ where: { rank: null, score: { not: null } }, select: { id: true, imdbRating: true, imdbVotes: true, tmdbRating: true, tmdbVotes: true } });
    for (let i = 0; i < rows.length; i += 500) {
      await this.prisma.$transaction(rows.slice(i, i + 500).map(r => this.prisma.worldTitle.update({ where: { id: r.id }, data: scoreFields(r) })));
    }
    if (rows.length) this.logger.log(`[World] ranked ${rows.length} titles`);
  }

  /**
   * Fill / refresh facts from TMDB (free, no daily limit; ~20 requests a second, well inside TMDB's limits):
   * never-checked titles first, then anything not checked for 45 days. Keeps going until nothing is left
   * (or `tmdbLimit`), then RT / Metacritic from OMDb within its daily budget (IMDb itself comes from IMDb's daily file).
   */
  async enrichBatch(tmdbLimit = Number(process.env.WORLD_TMDB_BATCH || 100000)) {
    if (this.enriching) return this.lastEnrich;
    this.enriching = true;
    let tmdb = 0;
    let omdb = 0;
    try {
      const staleBefore = new Date(Date.now() - 45 * 86400000);
      while (tmdb < tmdbLimit) {
        const stale = await this.prisma.worldTitle.findMany({
          where: { status: { not: 'REJECTED' }, OR: [{ tmdbCheckedAt: null }, { tmdbCheckedAt: { lt: staleBefore } }] },
          orderBy: [{ tmdbCheckedAt: { sort: 'asc', nulls: 'first' } }, { status: 'asc' }, { tmdbVotes: { sort: 'desc', nulls: 'last' } }],
          take: Math.min(400, tmdbLimit - tmdb),
          select: { id: true },
        });
        if (!stale.length) break;
        const queue = [...stale];
        const worker = async () => {
          for (let t = queue.shift(); t; t = queue.shift()) {
            const id = t.id;
            const ok = await this.refreshTmdb(id).then(
              () => true,
              async () => {
                // mark as tried so one broken title can't stall the queue; it is retried after 45 days
                await this.prisma.worldTitle.update({ where: { id }, data: { tmdbCheckedAt: new Date() } }).catch(() => null);
                return false;
              },
            );
            if (ok) tmdb++;
            await sleep(250);
          }
        };
        await Promise.all(Array.from({ length: 6 }, worker));
        this.lastEnrich = { at: new Date().toISOString(), tmdb, omdb, note: 'running' };
        this.facetCache.clear();
      }
      const budget = await this.omdbBudgetLeft();
      if (budget > 0 && process.env.OMDB_API_KEY) {
        const todo = await this.prisma.worldTitle.findMany({
          where: { omdbCheckedAt: null, imdbId: { not: null }, status: { not: 'REJECTED' } },
          orderBy: [{ status: 'asc' }, { imdbVotes: { sort: 'desc', nulls: 'last' } }],
          take: budget,
          select: { id: true },
        });
        for (const t of todo) {
          const r = await this.refreshOmdb(t.id).catch(() => 'error' as const);
          if (r === 'limit') break;
          if (r === 'ok') omdb++;
          await sleep(150);
        }
      }
      this.lastEnrich = { at: new Date().toISOString(), tmdb, omdb };
      if (tmdb || omdb) this.logger.log(`[World] refreshed ${tmdb} from TMDB, ${omdb} RT/Metacritic from OMDb`);
      this.facetCache.clear();
      return this.lastEnrich;
    } finally {
      this.enriching = false;
    }
  }

  private startOfIstDay(): Date {
    const ist = new Date(Date.now() + 5.5 * 3600000);
    return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3600000);
  }
  async omdbBudgetLeft() {
    if (Date.now() < this.omdbBlockedUntil) return 0;
    // Background refresh uses at most this many OMDb calls a day; the rest of the free ~1,000 stays for your clicks.
    const limit = Number(process.env.OMDB_BACKGROUND_DAILY_LIMIT || 600);
    const used = await this.prisma.worldTitle.count({ where: { omdbCheckedAt: { gte: this.startOfIstDay() } } });
    return Math.max(0, limit - used);
  }

  // ───────────────────────── TMDB / OMDb ─────────────────────────

  private async tmdb(path: string, params: Record<string, string | number | undefined> = {}) {
    const key = process.env.TMDB_API_KEY;
    if (!key) throw new ServiceUnavailableException('TMDB_API_KEY is missing in backend/.env');
    const q = new URLSearchParams({ api_key: key });
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await this.fetchImpl(`${TMDB}${path}?${q}`, { signal: AbortSignal.timeout(15000) });
        if (res.status === 429) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
        return (await res.json()) as any;
      } catch (e: any) {
        if (attempt === 2) throw e;
        await sleep(800 * (attempt + 1));
      }
    }
    return null;
  }

  async genres(kind: WorldKind): Promise<Record<number, string>> {
    if (this.genreCache[kind]) return this.genreCache[kind]!;
    const d = await this.tmdb(`/genre/${kind}/list`);
    const map: Record<number, string> = {};
    for (const g of d?.genres || []) map[g.id] = g.name;
    if (Object.keys(map).length) this.genreCache[kind] = map;
    return map;
  }

  private withScore<T extends Partial<WorldFacts> & { imdbRating?: number | null; imdbVotes?: number | null }>(prev: any, next: T) {
    const merged = { ...prev, ...next };
    return { ...next, ...scoreFields(merged) };
  }

  /** Re-reads facts + India providers from TMDB. Never touches your status, rating, review or a picture you chose. */
  async refreshTmdb(id: string) {
    const t = await this.prisma.worldTitle.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Title not found');
    const d = await this.tmdb(`/${t.kind}/${t.tmdbId}`, { append_to_response: 'external_ids,watch/providers,credits' });
    if (!d) {
      return this.prisma.worldTitle.update({ where: { id }, data: { tmdbCheckedAt: new Date(), notes: t.notes || 'Not found on TMDB any more.' } });
    }
    const facts = mapTmdbDetails(t.kind as WorldKind, d);
    const keepPicture = t.posterPath && !t.posterPath.startsWith('/'); // a picture you picked (full URL) stays
    // IMDb rating from IMDb's own daily file (no quota) as soon as we know the IMDb id
    const ir = await this.imdb.get(facts.imdbId || t.imdbId);
    const imdbCols = ir ? { imdbRating: ir.rating, imdbVotes: ir.votes } : {};
    const data = this.withScore(t, { ...facts, ...imdbCols, posterPath: keepPicture ? t.posterPath : facts.posterPath ?? t.posterPath, tmdbCheckedAt: new Date() } as any);
    return this.prisma.worldTitle.update({ where: { id }, data });
  }

  /** Real IMDb (+ Rotten Tomatoes) ratings from OMDb. Returns 'limit' when today's free quota is used up. */
  async refreshOmdb(id: string): Promise<'ok' | 'none' | 'limit' | 'skip'> {
    const key = process.env.OMDB_API_KEY;
    const t = await this.prisma.worldTitle.findUnique({ where: { id } });
    if (!key || !t?.imdbId) return 'skip';
    if ((await this.omdbBudgetLeft()) <= 0) return 'limit';
    const res = await this.fetchImpl(`https://www.omdbapi.com/?apikey=${key}&i=${encodeURIComponent(t.imdbId)}`, { signal: AbortSignal.timeout(12000) });
    const body: any = await res.json().catch(() => ({}));
    if (/limit/i.test(body?.Error || '') || res.status === 401) {
      this.omdbBlockedUntil = Date.now() + 3 * 3600000;
      this.logger.warn(`[World] OMDb: ${body?.Error || `HTTP ${res.status}`} — pausing IMDb lookups`);
      return 'limit';
    }
    const r = parseOmdbFull(body);
    const ir = await this.imdb.get(t.imdbId);
    const imdb = ir ? { imdbRating: ir.rating, imdbVotes: ir.votes } : { imdbRating: r?.imdbRating ?? t.imdbRating, imdbVotes: r?.imdbVotes ?? t.imdbVotes };
    await this.prisma.worldTitle.update({
      where: { id },
      data: this.withScore(t, { ...imdb, rtCritics: r?.rtCritics ?? null, metascore: r?.metascore ?? null, omdbCheckedAt: new Date() } as any),
    });
    return r ? 'ok' : 'none';
  }

  /** Refresh one title now (detail view / before posting). */
  async refresh(id: string, opts: { force?: boolean } = {}) {
    const t = await this.prisma.worldTitle.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Title not found');
    const old = (d: Date | null, days: number) => !d || Date.now() - d.getTime() > days * 86400000;
    if (opts.force || old(t.tmdbCheckedAt, 7)) await this.refreshTmdb(id);
    const fresh = await this.prisma.worldTitle.findUnique({ where: { id } });
    if (fresh?.imdbId && (opts.force || old(fresh.omdbCheckedAt, 30))) await this.refreshOmdb(id).catch(() => null);
    return this.prisma.worldTitle.findUnique({ where: { id } });
  }

  // ───────────────────────── browse ─────────────────────────

  private where(f: WorldFilter): Prisma.WorldTitleWhereInput {
    const and: Prisma.WorldTitleWhereInput[] = [];
    const kind = f.kind === 'tv' ? 'tv' : f.kind === 'movie' ? 'movie' : undefined;
    if (kind) and.push({ kind });
    if (f.status && f.status !== 'ALL') and.push({ status: f.status });
    else if (!f.status) and.push({ status: { not: 'REJECTED' } });
    if (f.q?.trim()) and.push({ OR: [{ title: { contains: f.q.trim() } }, { originalTitle: { contains: f.q.trim() } }] });
    const langs = (f.language || '').split(',').map(s => s.trim()).filter(Boolean);
    if (langs.length) and.push({ language: { in: langs } });
    if (f.country) and.push({ countries: { contains: f.country.toUpperCase() } });
    for (const all of (f.genre || '').split(',').map(s => s.trim()).filter(Boolean)) {
      const any = all.split('|').map(s => s.trim()).filter(Boolean);
      and.push({ OR: any.map(g => ({ genres: { contains: g } })) });
    }
    for (const g of (f.excludeGenre || '').split(',').map(s => s.trim()).filter(Boolean)) and.push({ OR: [{ genres: null }, { NOT: { genres: { contains: g } } }] });
    if (f.provider) and.push({ providersIn: { contains: `"${f.provider}"` } });
    if (f.freeIn === true || f.freeIn === 'true') and.push({ providersIn: { contains: '"type":"free"' } });
    if (num(f.yearFrom)) and.push({ year: { gte: num(f.yearFrom) } });
    if (num(f.yearTo)) and.push({ year: { lte: num(f.yearTo) } });
    if (num(f.minRating)) and.push({ score: { gte: num(f.minRating) } });
    if (num(f.minVotes)) and.push({ tmdbVotes: { gte: num(f.minVotes) } });
    if (num(f.maxVotes)) and.push({ tmdbVotes: { lte: num(f.maxVotes) } });
    if (num(f.minRuntime)) and.push({ runtime: { gte: num(f.minRuntime) } });
    if (num(f.maxRuntime)) and.push({ runtime: { lte: num(f.maxRuntime), gt: 0 } });
    if (num(f.maxSeasons)) and.push({ seasons: { lte: num(f.maxSeasons), gte: 1 } });
    const yes = (v: unknown) => v === undefined || v === true || v === 'true';
    if (kind === 'movie' && yes(f.featureOnly)) {
      // IMDb's own type when we know it; otherwise TMDB's "TV Movie" genre and a feature-length runtime
      and.push({ OR: [{ imdbType: null }, { imdbType: { in: FEATURE_TYPES } }] });
      and.push({ OR: [{ genres: null }, { NOT: { genres: { contains: 'TV Movie' } } }] });
      and.push({ OR: [{ runtime: null }, { runtime: { gte: 40 } }] });
    }
    if (kind === 'movie' && yes(f.noDocs) && !/documentary/i.test(f.genre || '')) {
      and.push({ OR: [{ genres: null }, { NOT: { genres: { contains: 'Documentary' } } }] });
    }
    if (kind === 'tv' && yes(f.scriptedOnly)) {
      // a "series" that IMDb says is a film / single TV movie isn't a series
      and.push({ OR: [{ imdbType: null }, { imdbType: { notIn: ['movie', 'tvMovie', 'short', 'video', 'tvShort', 'tvEpisode', 'tvSpecial'] } }] });
    }
    const scripted = f.scriptedOnly === undefined || f.scriptedOnly === true || f.scriptedOnly === 'true';
    if (kind === 'tv' && scripted) {
      and.push({ OR: [{ seriesType: null }, { seriesType: { notIn: NON_SCRIPTED_TV } }] });
      for (const g of ['Reality', 'News', 'Talk']) and.push({ OR: [{ genres: null }, { NOT: { genres: { contains: g } } }] });
    }
    return { AND: and };
  }

  private orderBy(sort?: string): Prisma.WorldTitleOrderByWithRelationInput[] {
    switch (sort) {
      case 'votes':
        return [{ tmdbVotes: { sort: 'desc', nulls: 'last' } }];
      case 'year':
        return [{ year: { sort: 'desc', nulls: 'last' } }, { scoreVotes: { sort: 'desc', nulls: 'last' } }];
      case 'title':
        return [{ title: 'asc' }];
      case 'newest':
        return [{ createdAt: 'desc' }];
      case 'raw':
        return [{ score: { sort: 'desc', nulls: 'last' } }, { scoreVotes: { sort: 'desc', nulls: 'last' } }];
      case 'popular':
        return [{ popularity: { sort: 'desc', nulls: 'last' } }];
      default: // best rated: score weighted by votes
        return [{ rank: { sort: 'desc', nulls: 'last' } }, { scoreVotes: { sort: 'desc', nulls: 'last' } }];
    }
  }

  async list(f: WorldFilter & { skip?: string | number; take?: string | number }) {
    const where = this.where(f);
    const take = Math.min(Math.max(num(f.take) || 48, 1), 200);
    const skip = Math.max(num(f.skip) || 0, 0);
    const [total, items] = await Promise.all([
      this.prisma.worldTitle.count({ where }),
      this.prisma.worldTitle.findMany({ where, orderBy: this.orderBy(f.sort), skip, take }),
    ]);
    return { total, items };
  }

  /** How many titles each filter matches (for the ready-made list gallery). */
  async counts(filters: WorldFilter[]) {
    return Promise.all((filters || []).slice(0, 80).map(f => this.prisma.worldTitle.count({ where: this.where(f) })));
  }

  get(id: string) {
    return this.prisma.worldTitle.findUnique({ where: { id } }).then(t => {
      if (!t) throw new NotFoundException('Title not found');
      return t;
    });
  }

  /** Languages / countries / genres / providers present, with counts (for the filter chips). */
  async facets(kind?: string) {
    const key = kind || 'all';
    const hit = this.facetCache.get(key);
    if (hit && Date.now() - hit.at < 5 * 60000) return hit.data;
    const rows = await this.prisma.worldTitle.findMany({
      where: { status: { not: 'REJECTED' }, ...(kind ? { kind } : {}) },
      select: { language: true, countries: true, genres: true, providersIn: true, status: true },
    });
    const count = (m: Map<string, number>, k?: string | null) => k && m.set(k, (m.get(k) || 0) + 1);
    const languages = new Map<string, number>();
    const countries = new Map<string, number>();
    const genres = new Map<string, number>();
    const providers = new Map<string, number>();
    let approved = 0;
    for (const r of rows) {
      if (r.status === 'APPROVED') approved++;
      count(languages, r.language);
      for (const c of (r.countries || '').split(',')) count(countries, c.trim());
      for (const g of (r.genres || '').split(',')) count(genres, g.trim());
      try {
        for (const p of JSON.parse(r.providersIn || '[]')) if (p.type === 'stream' || p.type === 'free') count(providers, p.name);
      } catch {}
    }
    const sorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, n]) => ({ value, n }));
    const data = { total: rows.length, approved, languages: sorted(languages), countries: sorted(countries), genres: sorted(genres), providers: sorted(providers), enrich: this.lastEnrich };
    this.facetCache.set(key, { at: Date.now(), data });
    return data;
  }

  // ───────────────────────── edit / approve ─────────────────────────

  async update(id: string, body: { status?: string; myRating?: number | null; myReview?: string | null; posterPath?: string | null; notes?: string | null }) {
    const data: Prisma.WorldTitleUpdateInput = {};
    if (body.status !== undefined) {
      if (!['PENDING', 'APPROVED', 'REJECTED'].includes(body.status)) throw new BadRequestException('Bad status');
      data.status = body.status;
    }
    if (body.myRating !== undefined) {
      const v = body.myRating === null || (body.myRating as any) === '' ? null : Number(body.myRating);
      if (v !== null && (!Number.isFinite(v) || v < 0 || v > 5 || Math.round(v * 2) !== v * 2)) throw new BadRequestException('myRating must be 0-5 in steps of 0.5');
      data.myRating = v;
    }
    for (const k of ['myReview', 'posterPath', 'notes'] as const) {
      if (body[k] !== undefined) data[k] = typeof body[k] === 'string' ? (body[k] as string).trim().slice(0, k === 'posterPath' ? 2000 : 1000) || null : null;
    }
    this.facetCache.clear();
    return this.prisma.worldTitle.update({ where: { id }, data }).catch(() => {
      throw new NotFoundException('Title not found');
    });
  }

  /** Approve / reject by ids, or every title matching a filter (your click, with the count confirmed in the UI). */
  async bulkStatus(body: { ids?: string[]; filter?: WorldFilter; status: WorldStatus }) {
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(body.status)) throw new BadRequestException('Bad status');
    const where = body.ids?.length ? { id: { in: body.ids } } : body.filter ? this.where(body.filter) : null;
    if (!where) throw new BadRequestException('Give ids or a filter');
    const r = await this.prisma.worldTitle.updateMany({ where, data: { status: body.status } });
    this.facetCache.clear();
    return { updated: r.count };
  }

  // ───────────────────────── add from TMDB ─────────────────────────

  async searchTmdb(q: string, kind?: string) {
    if (!q.trim()) return [];
    const kinds: WorldKind[] = kind === 'tv' ? ['tv'] : kind === 'movie' ? ['movie'] : ['movie', 'tv'];
    const out: Array<WorldFacts & { kind: WorldKind; tmdbId: number; inLibrary: string | null }> = [];
    for (const k of kinds) {
      const [d, g] = await Promise.all([this.tmdb(`/search/${k}`, { query: q.trim() }), this.genres(k)]);
      for (const r of (d?.results || []).slice(0, 10)) out.push({ ...mapTmdbListItem(k, r, g), kind: k, tmdbId: r.id, inLibrary: null });
    }
    const have = await this.prisma.worldTitle.findMany({ where: { OR: out.map(o => ({ kind: o.kind, tmdbId: o.tmdbId })) }, select: { id: true, kind: true, tmdbId: true } });
    for (const o of out) o.inLibrary = have.find(h => h.kind === o.kind && h.tmdbId === o.tmdbId)?.id || null;
    return out.sort((a, b) => (b.tmdbVotes || 0) - (a.tmdbVotes || 0));
  }

  /** You picked it yourself → saved as APPROVED (like manual entry on the other desks), facts from TMDB. */
  async add(body: { kind: WorldKind; tmdbId: number }) {
    const kind: WorldKind = body.kind === 'tv' ? 'tv' : 'movie';
    const tmdbId = Number(body.tmdbId);
    if (!tmdbId) throw new BadRequestException('tmdbId required');
    const existing = await this.prisma.worldTitle.findUnique({ where: { kind_tmdbId: { kind, tmdbId } } });
    if (existing) return this.refresh(existing.id);
    const d = await this.tmdb(`/${kind}/${tmdbId}`, { append_to_response: 'external_ids,watch/providers,credits' });
    if (!d) throw new NotFoundException('Not found on TMDB');
    const facts = mapTmdbDetails(kind, d);
    const created = await this.prisma.worldTitle.create({
      data: { kind, tmdbId, ...facts, ...scoreFields(facts), status: 'APPROVED', origin: 'MANUAL', tmdbCheckedAt: new Date() },
    });
    this.facetCache.clear();
    if (created.imdbId) await this.refreshOmdb(created.id).catch(() => null);
    return this.prisma.worldTitle.findUnique({ where: { id: created.id } });
  }

  // ───────────────────────── scan (bulk discover) ─────────────────────────

  /** Pull titles from TMDB discover into the database (as PENDING) in the background. */
  startScan(input: ScanInput) {
    if (this.scan.active) return { started: false, scan: this.scan };
    const kind: WorldKind = input.kind === 'tv' ? 'tv' : 'movie';
    const pages = Math.max(1, Math.min(Number(input.pages) || 5, 25));
    this.scan = { active: true, kind, page: 0, pages, seen: 0, added: 0, startedAt: new Date().toISOString() };
    this.runScan({ ...input, kind, pages }).catch(e => {
      this.scan.error = e.message;
    }).finally(() => {
      this.scan.active = false;
      this.scan.finishedAt = new Date().toISOString();
      this.facetCache.clear();
    });
    return { started: true, scan: this.scan };
  }

  private async runScan(input: ScanInput & { kind: WorldKind; pages: number }) {
    await this.runScanPages(input);
    this.logger.log(`[World] scan ${input.kind}: ${this.scan.seen} seen, ${this.scan.added} new`);
    // fill details (IMDb id, providers) for what we just added, in the background
    this.enrichBatch().catch(() => null);
  }

  private async runScanPages(input: ScanInput & { kind: WorldKind; pages: number }) {
    const g = await this.genres(input.kind);
    const dateKey = input.kind === 'movie' ? 'primary_release_date' : 'first_air_date';
    for (let page = 1; page <= input.pages; page++) {
      const d = await this.tmdb(`/discover/${input.kind}`, {
        page,
        sort_by: input.sort || 'vote_count.desc',
        'vote_count.gte': input.minVotes ?? 50,
        with_original_language: input.language,
        with_origin_country: input.country,
        with_genres: input.genreId,
        [`${dateKey}.gte`]: input.yearFrom ? `${input.yearFrom}-01-01` : undefined,
        [`${dateKey}.lte`]: input.yearTo ? `${input.yearTo}-12-31` : undefined,
        include_adult: 'false',
      });
      const results: any[] = d?.results || [];
      this.scan.page = page;
      this.scan.pages = Math.min(input.pages, d?.total_pages || page);
      for (const r of results) {
        this.scan.seen++;
        const facts = mapTmdbListItem(input.kind, r, g);
        const existing = await this.prisma.worldTitle.findUnique({ where: { kind_tmdbId: { kind: input.kind, tmdbId: r.id } } });
        if (existing) {
          // keep facts fresh, but never touch your status/rating/review/picture
          await this.prisma.worldTitle.update({
            where: { id: existing.id },
            data: this.withScore(existing, { tmdbRating: facts.tmdbRating, tmdbVotes: facts.tmdbVotes, popularity: facts.popularity, overview: existing.overview || facts.overview } as any),
          });
          continue;
        }
        await this.prisma.worldTitle.create({ data: { kind: input.kind, tmdbId: r.id, ...facts, ...scoreFields(facts), status: 'PENDING', origin: 'TMDB' } });
        this.scan.added++;
      }
      if (!results.length || page >= (d?.total_pages || 0)) break;
      await sleep(250);
    }
  }

  // ───────────────────────── every language ─────────────────────────

  private langCache?: Array<{ code: string; name: string; native: string | null }>;

  /** All 180+ languages TMDB knows (names from TMDB, so "cn" is Cantonese, not Chinese). */
  async tmdbLanguages() {
    if (this.langCache) return this.langCache;
    const d: any[] = (await this.tmdb('/configuration/languages')) || [];
    const list = d
      .filter(l => l?.iso_639_1 && l.iso_639_1 !== 'xx')
      .map(l => ({ code: String(l.iso_639_1), name: String(l.english_name || l.iso_639_1), native: l.name && l.name !== l.english_name ? String(l.name) : null }));
    if (list.length) this.langCache = list;
    return list;
  }

  /** Every language with how many movies / series we hold (0 = not scanned yet). */
  async languages() {
    const [all, rows] = await Promise.all([
      this.tmdbLanguages().catch(() => [] as Array<{ code: string; name: string; native: string | null }>),
      this.prisma.worldTitle.groupBy({ by: ['language', 'kind'], where: { status: { not: 'REJECTED' } }, _count: { _all: true } }),
    ]);
    const counts = new Map<string, { movie: number; tv: number }>();
    for (const r of rows) {
      if (!r.language) continue;
      const c = counts.get(r.language) || { movie: 0, tv: 0 };
      c[r.kind === 'tv' ? 'tv' : 'movie'] += r._count._all;
      counts.set(r.language, c);
    }
    const out = all.map(l => ({ ...l, movie: counts.get(l.code)?.movie || 0, tv: counts.get(l.code)?.tv || 0 }));
    for (const [code, c] of counts) if (!out.some(o => o.code === code)) out.push({ code, name: code, native: null, ...c });
    return out.sort((a, b) => b.movie + b.tv - (a.movie + a.tv) || a.name.localeCompare(b.name));
  }

  /** How deep to go per language: Indian languages deepest, big world cinemas next, everything else the top titles. */
  private sweepDepth(code: string, perLanguage: number) {
    const INDIAN = ['hi', 'ta', 'te', 'ml', 'kn', 'bn', 'mr', 'pa', 'gu', 'or', 'as', 'ur', 'bh', 'sa', 'ne', 'si'];
    const MAJOR = ['en', 'ko', 'ja', 'zh', 'cn', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'tr', 'th', 'id', 'fa', 'ar', 'pl', 'sv', 'da', 'no', 'nl', 'tl', 'vi', 'he', 'ms'];
    if (INDIAN.includes(code)) return perLanguage * 4;
    if (MAJOR.includes(code)) return perLanguage * 2;
    return perLanguage;
  }

  /**
   * Pull the most-voted movies and series of EVERY language from TMDB (as PENDING — they still need your approval for posts).
   * Facts, IMDb ids and India providers are filled in afterwards by the background refresh.
   */
  startLanguageSweep(input: { kinds?: WorldKind[]; perLanguage?: number; minVotes?: number; languages?: string[] } = {}) {
    if (this.scan.active) return { started: false, scan: this.scan };
    const kinds: WorldKind[] = input.kinds?.length ? input.kinds.filter(k => k === 'movie' || k === 'tv') : ['movie', 'tv'];
    const perLanguage = Math.max(20, Math.min(Number(input.perLanguage) || 100, 500));
    const minVotes = Math.max(0, Number(input.minVotes ?? 10));
    this.scan = { active: true, kind: kinds.join('+'), page: 0, pages: 0, seen: 0, added: 0, startedAt: new Date().toISOString(), mode: 'languages', lang: '', langDone: 0, langTotal: 0 };
    (async () => {
      const langs = input.languages?.length ? input.languages : (await this.tmdbLanguages()).map(l => l.code);
      this.scan.langTotal = langs.length * kinds.length;
      for (const code of langs) {
        for (const kind of kinds) {
          this.scan.lang = `${code} ${kind}`;
          const pages = Math.ceil(this.sweepDepth(code, perLanguage) / 20);
          await this.runScanPages({ kind, language: code, minVotes, sort: 'vote_count.desc', pages });
          this.scan.langDone = (this.scan.langDone || 0) + 1;
        }
      }
    })()
      .catch(e => (this.scan.error = e.message))
      .finally(() => {
        this.scan.active = false;
        this.scan.finishedAt = new Date().toISOString();
        this.facetCache.clear();
        this.logger.log(`[World] language sweep: ${this.scan.seen} seen, ${this.scan.added} new`);
        this.enrichBatch().catch(() => null);
      });
    return { started: true, scan: this.scan };
  }

  // ───────────────────────── data check ─────────────────────────

  /** What's missing or suspicious in the database, so it can be seen and fixed. */
  async health() {
    const c = (where: Prisma.WorldTitleWhereInput) => this.prisma.worldTitle.count({ where: { status: { not: 'REJECTED' }, ...where } });
    const [total, movies, series, approved, neverChecked, checkedNoImdbId, noImdbRating, noOverview, noPoster, noLanguage, noGenres, garbled, rtKnown, providersKnown, imdbRows] = await Promise.all([
      c({}),
      c({ kind: 'movie' }),
      c({ kind: 'tv' }),
      c({ status: 'APPROVED' }),
      c({ tmdbCheckedAt: null }),
      c({ tmdbCheckedAt: { not: null }, imdbId: null }),
      c({ imdbId: { not: null }, imdbRating: null }),
      c({ tmdbCheckedAt: { not: null }, OR: [{ overview: null }, { overview: '' }] }),
      c({ posterPath: null }),
      c({ tmdbCheckedAt: { not: null }, language: null }),
      c({ genres: null }),
      c({ OR: [{ title: { contains: '�' } }, { overview: { contains: '�' } }] }),
      c({ rtCritics: { not: null } }),
      c({ providersIn: { not: null, notIn: ['[]'] } }),
      this.prisma.imdbRating.count(),
    ]);
    const notFeature = await c({ kind: 'movie', imdbType: { not: null, notIn: FEATURE_TYPES } });
    const typed = await c({ imdbType: { not: null } });
    const dupes: Array<{ imdbId: string; n: bigint }> = await this.prisma.$queryRawUnsafe(
      `SELECT imdbId, COUNT(*) n FROM WorldTitle WHERE imdbId IS NOT NULL AND status <> 'REJECTED' GROUP BY kind, imdbId HAVING COUNT(*) > 1 LIMIT 50`,
    );
    const langs = await this.languages();
    return {
      total, movies, series, approved,
      languagesWithTitles: langs.filter(l => l.movie + l.tv > 0).length,
      languagesKnown: langs.length,
      neverChecked, checkedNoImdbId, noImdbRating, noOverview, noPoster, noLanguage, noGenres, garbled,
      rtKnown, providersKnown, notFeature, typed,
      duplicateImdbIds: dupes.map(d => ({ imdbId: d.imdbId, n: Number(d.n) })),
      imdbFile: { rows: imdbRows, date: this.imdb.fileDate()?.toISOString() || null, sync: this.imdb.status },
      omdbBudgetLeft: await this.omdbBudgetLeft(),
      enrich: { ...this.lastEnrich, running: this.enriching },
      scan: this.scan,
      sources: {
        tmdb: !!process.env.TMDB_API_KEY,
        omdb: !!process.env.OMDB_API_KEY,
        imdbDatasets: process.env.IMDB_DATASETS !== 'false',
        mdblist: !!process.env.MDBLIST_API_KEY,
      },
    };
  }
}
