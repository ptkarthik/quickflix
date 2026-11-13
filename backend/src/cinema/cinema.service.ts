import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenreService } from '../media/genre.service';
import { makeDedupeKey } from '../ott/ott-text.util';
import { videoMatchesTitle } from '../ott/official-youtube.collector';
import { CinemaCollectors, TmdbCinemaClaim, WikiCinemaRow } from './cinema-collectors';
import { CinemaClaim, CinemaEvidenceType, computeCinemaTrust, suggestCinemaDate } from './cinema-trust.util';
import { cinemaKey, sameFilmTitle } from './cinema-text.util';

export type CinemaStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
const STATUSES: CinemaStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export interface CinemaInput {
  title?: string;
  language?: string | null;
  alsoIn?: string | null;
  releaseDate?: string | null;
  status?: CinemaStatus;
  certificate?: string | null;
  runtime?: number | null;
  posterPath?: string | null;
  overview?: string | null;
  notes?: string | null;
  tmdbId?: number | null;
  myRating?: number | null;
  myReview?: string | null;
  sourceUrl?: string | null;
}

interface Evidence {
  sourceType: CinemaEvidenceType;
  sourceKey: string;
  sourceName?: string;
  sourceUrl?: string;
  claimedDate?: string;
  postponed?: boolean;
  text?: string;
  observedAt?: Date;
}

/** Window we track: recent releases (for "now in cinemas") through ~6 months ahead. */
const PAST_DAYS = 45;
const AHEAD_DAYS = 180;

@Injectable()
export class CinemaService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(CinemaService.name);
  private timer?: NodeJS.Timeout;
  private kickoff?: NodeJS.Timeout;
  private running: Promise<any> | null = null;
  private lastRun: { at: string; summary: any } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly collectors: CinemaCollectors,
    private readonly genres: GenreService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.CINEMA_AUTO_COLLECT === 'false') return;
    const hours = Number(process.env.CINEMA_COLLECT_INTERVAL_HOURS || 6);
    this.kickoff = setTimeout(() => this.collect().catch(e => this.logger.warn(`[Cinema] auto-collect failed: ${e.message}`)), 45000);
    this.timer = setInterval(() => this.collect().catch(e => this.logger.warn(`[Cinema] auto-collect failed: ${e.message}`)), hours * 3600000);
  }
  onModuleDestroy() {
    clearTimeout(this.kickoff);
    clearInterval(this.timer);
  }

  todayIst(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  shift(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  // ───────────── read ─────────────
  list(q: { status?: string; trust?: string; from?: string; to?: string; language?: string }) {
    const where: any = {};
    if (q.status) where.status = { in: q.status.split(',') };
    if (q.trust) where.trust = { in: q.trust.split(',') };
    if (q.language) where.language = { in: q.language.split(',') };
    if (q.from || q.to) where.releaseDate = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) };
    return this.prisma.cinemaRelease.findMany({ where, include: { evidence: { orderBy: { observedAt: 'desc' } } }, orderBy: [{ releaseDate: 'asc' }, { title: 'asc' }] });
  }

  async counts() {
    const rows = await this.prisma.cinemaRelease.groupBy({ by: ['status', 'trust'], _count: true });
    const out: Record<string, number> = {};
    for (const r of rows) {
      out[r.status] = (out[r.status] || 0) + r._count;
      out[`${r.status}_${r.trust}`] = r._count;
    }
    return out;
  }

  private withEvidence(id: string) {
    return this.prisma.cinemaRelease.findUnique({ where: { id }, include: { evidence: { orderBy: { observedAt: 'desc' } } } });
  }

  // ───────────── manual edits ─────────────
  async createManual(input: CinemaInput) {
    const data = this.sanitize(input, true);
    const key = cinemaKey(data.title as string, (data.language as string) || null);
    const clash = await this.prisma.cinemaRelease.findUnique({ where: { dedupeKey: key } });
    if (clash) throw new ConflictException(`"${clash.title}" already exists (${clash.status}). Edit that entry instead.`);
    const row = await this.prisma.cinemaRelease.create({ data: { ...(data as any), dedupeKey: key, origin: 'MANUAL', userLocked: !!data.releaseDate } });
    if (data.releaseDate) {
      await this.addEvidence(row.id, { sourceType: 'MANUAL', sourceKey: 'manual', sourceName: 'You', sourceUrl: input.sourceUrl || 'manual', claimedDate: data.releaseDate as string });
    }
    await this.recompute(row.id, { keepStatus: true });
    return this.withEvidence(row.id);
  }

  async update(id: string, input: CinemaInput) {
    const existing = await this.prisma.cinemaRelease.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Release not found');
    const data: any = this.sanitize(input, false);
    if (input.status !== undefined) {
      if (!STATUSES.includes(input.status)) throw new BadRequestException(`status must be one of ${STATUSES.join(', ')}`);
      data.status = input.status;
    }
    if (data.releaseDate !== undefined && data.releaseDate !== existing.releaseDate) {
      data.userLocked = !!data.releaseDate;
      if (data.releaseDate) {
        await this.addEvidence(id, { sourceType: 'MANUAL', sourceKey: 'manual', sourceName: 'You', sourceUrl: 'manual', claimedDate: data.releaseDate });
        if (existing.releaseDate) {
          data.previousDate = existing.releaseDate;
          data.dateChangedAt = new Date();
          data.dateHistory = this.pushHistory(existing.dateHistory, data.releaseDate, 'you');
        }
      }
    }
    const title = data.title ?? existing.title;
    const lang = data.language !== undefined ? data.language : existing.language;
    const key = cinemaKey(title, lang);
    if (key !== existing.dedupeKey) {
      const clash = await this.prisma.cinemaRelease.findUnique({ where: { dedupeKey: key } });
      if (clash && clash.id !== id) throw new ConflictException(`"${clash.title}" already exists (${clash.status}).`);
      data.dedupeKey = key;
    }
    await this.prisma.cinemaRelease.update({ where: { id }, data });
    await this.recompute(id, { keepStatus: true });
    return this.withEvidence(id);
  }

  async remove(id: string) {
    await this.prisma.cinemaRelease.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Release not found');
    });
    return { deleted: true };
  }

  async bulkStatus(ids: string[], status: CinemaStatus) {
    if (!STATUSES.includes(status)) throw new BadRequestException('bad status');
    const r = await this.prisma.cinemaRelease.updateMany({ where: { id: { in: ids } }, data: { status } });
    return { updated: r.count };
  }

  async approveConfirmed() {
    const r = await this.prisma.cinemaRelease.updateMany({ where: { status: 'PENDING', trust: 'CONFIRMED', releaseDate: { not: null } }, data: { status: 'APPROVED' } });
    return { approved: r.count };
  }

  private sanitize(input: CinemaInput, requireTitle: boolean): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (input.title !== undefined) {
      const t = String(input.title).trim();
      if (!t) throw new BadRequestException('title cannot be empty');
      out.title = t.slice(0, 200);
    } else if (requireTitle) throw new BadRequestException('title is required');
    if (input.releaseDate !== undefined) {
      const d = input.releaseDate ? String(input.releaseDate).trim() : null;
      if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d)))) throw new BadRequestException('releaseDate must be YYYY-MM-DD');
      out.releaseDate = d;
    }
    for (const k of ['language', 'alsoIn', 'certificate', 'posterPath', 'overview', 'notes', 'myReview'] as const) {
      if (input[k] !== undefined) out[k] = input[k] ? String(input[k]).trim().slice(0, 2000) : null;
    }
    if (input.tmdbId !== undefined) out.tmdbId = input.tmdbId ? Number(input.tmdbId) : null;
    if (input.runtime !== undefined) out.runtime = input.runtime ? Number(input.runtime) : null;
    if (input.myRating !== undefined) {
      const v = input.myRating === null || (input.myRating as any) === '' ? null : Number(input.myRating);
      if (v !== null && (!Number.isFinite(v) || v < 0 || v > 5 || Math.round(v * 2) !== v * 2)) throw new BadRequestException('myRating must be 0-5 in steps of 0.5');
      out.myRating = v;
    }
    return out;
  }

  // ───────────── collection ─────────────
  getStatus() {
    return { running: !!this.running, lastRun: this.lastRun };
  }

  collect() {
    if (this.running) return this.running;
    this.running = this.runCollect().finally(() => (this.running = null));
    return this.running;
  }

  private async runCollect() {
    const today = this.todayIst();
    const from = this.shift(today, -PAST_DAYS);
    const to = this.shift(today, AHEAD_DAYS);
    const years = [...new Set([Number(from.slice(0, 4)), Number(today.slice(0, 4)), Number(to.slice(0, 4))])];
    const s = { created: 0, merged: 0, evidenceAdded: 0, tmdb: 0, wikipedia: 0, wikiMatched: 0, youtube: 0, youtubeMatched: 0, news: 0, newsMatched: 0, dateChanges: 0, movedBackToReview: 0, errors: [] as string[], trust: {} as Record<string, number> };

    const [tmdb, wiki, yt, news] = await Promise.all([this.collectors.tmdb(from, to), this.collectors.wikipedia(years), this.collectors.youtube(), this.collectors.news()]);
    s.errors.push(...tmdb.errors, ...wiki.errors.slice(0, 5), ...yt.errors.slice(0, 5), ...news.errors.slice(0, 5));

    // 1) TMDB: the backbone (ids, posters, certificates)
    for (const c of tmdb.claims) {
      s.tmdb++;
      const row = await this.upsertFromTmdb(c, s);
      if (!row) continue;
      s.evidenceAdded += await this.addEvidence(row.id, {
        sourceType: 'TMDB_THEATRICAL', sourceKey: 'tmdb', sourceName: 'TMDB', sourceUrl: `https://www.themoviedb.org/movie/${c.tmdbId}/releases`,
        claimedDate: c.date, text: `India theatrical release ${c.date}${c.certificate ? ` · ${c.certificate}` : ''}`, observedAt: new Date(),
      });
    }

    // 2) Wikipedia lists (independent second source; also finds films TMDB lacks)
    const wikiRows = wiki.rows.filter(r => r.date >= from && r.date <= to);
    let tmdbLookups = 0;
    for (const w of wikiRows) {
      s.wikipedia++;
      let row = await this.findByTitle(w.title, w.language, w.date);
      if (!row) {
        const hit = tmdbLookups++ < 60 ? await this.tmdbSearch(w.title, w.language, Number(w.date.slice(0, 4))) : null;
        if (hit) row = await this.prisma.cinemaRelease.findFirst({ where: { tmdbId: hit.id } });
        if (!row) row = await this.createFrom({ title: hit?.title || w.title, language: w.language, tmdbId: hit?.id, posterPath: hit?.poster_path, overview: hit?.overview, production: w.production, origin: 'WIKIPEDIA' }, s);
      }
      if (!row) continue;
      if (row.status === 'REJECTED') continue;
      s.wikiMatched++;
      if (!row.production && w.production) await this.prisma.cinemaRelease.update({ where: { id: row.id }, data: { production: w.production.slice(0, 200) } });
      s.evidenceAdded += await this.addEvidence(row.id, {
        sourceType: 'WIKIPEDIA', sourceKey: 'wikipedia', sourceName: 'Wikipedia', sourceUrl: w.pageUrl, claimedDate: w.date,
        text: `Listed under ${w.date} in ${w.pageUrl.split('/').pop()?.replace(/_/g, ' ')}`, observedAt: new Date(),
      });
    }

    // 3) Official channels (strict title match against films we already track)
    const active = await this.prisma.cinemaRelease.findMany({ where: { status: { not: 'REJECTED' }, OR: [{ releaseDate: null }, { releaseDate: { gte: from } }] } });
    for (const v of yt.videos) {
      if (!v.claimedDate) continue;
      s.youtube++;
      const matches = active.filter(r => videoMatchesTitle(v.segments, r.title) && (!v.channel.lang || !r.language || r.language === v.channel.lang || (r.alsoIn || '').includes(v.channel.lang)));
      if (matches.length !== 1) continue; // ambiguous or unknown → skip, never guess
      s.youtubeMatched++;
      s.evidenceAdded += await this.addEvidence(matches[0].id, {
        sourceType: 'OFFICIAL_YOUTUBE', sourceKey: `yt:${v.channel.handle}`, sourceName: v.channel.name, sourceUrl: v.url, claimedDate: v.claimedDate, text: v.videoTitle, observedAt: v.publishedAt,
      });
    }

    // 4) News (adds claims + postponement reports to films we track; never creates films on its own)
    for (const n of news.items) {
      s.news++;
      const cands = active.filter(r => makeDedupeKey(r.title) === makeDedupeKey(n.title) && (!n.languages.length || !r.language || n.languages.includes(r.language)));
      if (cands.length !== 1) continue;
      s.newsMatched++;
      s.evidenceAdded += await this.addEvidence(cands[0].id, {
        sourceType: 'NEWS', sourceKey: `news:${n.sourceName.toLowerCase()}`, sourceName: n.sourceName, sourceUrl: n.url, claimedDate: n.date, postponed: n.postponed, text: n.headline, observedAt: n.publishedAt,
      });
    }

    // 5) one film = one entry, then recompute everything active
    s.merged = await this.mergeDuplicates();
    await this.genres.backfill().catch(() => null);
    const ids = (await this.prisma.cinemaRelease.findMany({ where: { status: { not: 'REJECTED' } }, select: { id: true } })).map(r => r.id);
    for (const id of ids) {
      const r = await this.recompute(id, { keepStatus: true });
      if (r?.dateChanged) s.dateChanges++;
      if (r?.movedBack) s.movedBackToReview++;
    }
    const trustRows = await this.prisma.cinemaRelease.groupBy({ by: ['trust'], where: { status: { not: 'REJECTED' } }, _count: true });
    for (const t of trustRows) s.trust[t.trust] = t._count;
    this.lastRun = { at: new Date().toISOString(), summary: s };
    this.logger.log(`[Cinema] Collect: +${s.created} films, +${s.evidenceAdded} evidence, ${s.dateChanges} date change(s), trust ${JSON.stringify(s.trust)}.`);
    return s;
  }

  private async upsertFromTmdb(c: TmdbCinemaClaim, s: { created: number }) {
    let row = await this.prisma.cinemaRelease.findFirst({ where: { tmdbId: c.tmdbId } });
    if (!row) row = await this.findByTitle(c.title, c.language, c.date);
    if (!row && c.originalTitle !== c.title) row = await this.findByTitle(c.originalTitle, c.language, c.date);
    if (row?.status === 'REJECTED') return null;
    const details = {
      tmdbId: c.tmdbId,
      posterPath: row?.posterPath && !row.posterPath.startsWith('/') ? row.posterPath : c.posterPath ?? row?.posterPath ?? null, // keep a picture you chose
      overview: row?.overview || c.overview || null,
      certificate: c.certificate || row?.certificate || null,
      runtime: c.runtime || row?.runtime || null,
      ottDate: c.ottDate || row?.ottDate || null,
      alsoIn: c.alsoIn.length ? c.alsoIn.join(',') : row?.alsoIn || null,
    };
    if (row) return this.prisma.cinemaRelease.update({ where: { id: row.id }, data: details });
    return this.createFrom({ title: c.title, language: c.language, ...details, origin: 'TMDB' }, s);
  }

  private async createFrom(d: { title: string; language: string; origin: string; [k: string]: any }, s: { created: number }) {
    const key = cinemaKey(d.title, d.language);
    const existing = await this.prisma.cinemaRelease.findUnique({ where: { dedupeKey: key } });
    if (existing) return existing.status === 'REJECTED' ? null : existing;
    s.created++;
    return this.prisma.cinemaRelease.create({
      data: {
        title: d.title, language: d.language, origin: d.origin, dedupeKey: key,
        tmdbId: d.tmdbId ?? null, posterPath: d.posterPath ?? null, overview: d.overview ?? null, certificate: d.certificate ?? null,
        runtime: d.runtime ?? null, ottDate: d.ottDate ?? null, alsoIn: d.alsoIn ?? null, production: d.production?.slice(0, 200) ?? null,
      },
    });
  }

  /** Same title + language, date within ~4 months (different films can share a title). */
  private async findByTitle(title: string, language: string, date?: string) {
    const exact = await this.prisma.cinemaRelease.findUnique({ where: { dedupeKey: cinemaKey(title, language) } });
    if (exact) return exact;
    const norm = makeDedupeKey(title);
    const sameLang = await this.prisma.cinemaRelease.findMany({ where: { language } });
    const cands = sameLang.filter(r => makeDedupeKey(r.title) === norm);
    if (!date) return cands[0] || null;
    const exactTitle = cands.find(r => !r.releaseDate || Math.abs(Date.parse(r.releaseDate) - Date.parse(date)) < 120 * 86400000);
    if (exactTitle) return exactTitle;
    // Spelling variants (Itllu/Itlu Arjuna, Om / OM: Chapter 1) — only with the same language AND a date within 2 days.
    return sameLang.find(r => r.releaseDate && Math.abs(Date.parse(r.releaseDate) - Date.parse(date)) <= 2 * 86400000 && sameFilmTitle(r.title, title)) || null;
  }

  /** Merge films that are the same under spelling variants (same language, dates ≤2 days apart). Keeps the TMDB-linked one. */
  private async mergeDuplicates(): Promise<number> {
    const rows = await this.prisma.cinemaRelease.findMany({ where: { status: { not: 'REJECTED' }, releaseDate: { not: null } }, orderBy: { createdAt: 'asc' } });
    const gone = new Set<string>();
    let merged = 0;
    for (const a of rows) {
      if (gone.has(a.id)) continue;
      for (const b of rows) {
        if (b.id === a.id || gone.has(b.id) || a.language !== b.language) continue;
        if (Math.abs(Date.parse(a.releaseDate!) - Date.parse(b.releaseDate!)) > 2 * 86400000 || !sameFilmTitle(a.title, b.title)) continue;
        if (a.tmdbId && b.tmdbId && a.tmdbId !== b.tmdbId) continue; // TMDB says they're different films
        // keep: approved > locked > TMDB-linked > older
        const score = (r: typeof a) => (r.status === 'APPROVED' ? 8 : 0) + (r.userLocked ? 4 : 0) + (r.tmdbId ? 2 : 0);
        const [keep, drop] = score(b) > score(a) ? [b, a] : [a, b];
        const ev = await this.prisma.cinemaEvidence.findMany({ where: { releaseId: drop.id } });
        for (const e of ev) {
          const clash = await this.prisma.cinemaEvidence.findUnique({
            where: { releaseId_sourceType_sourceKey_sourceUrl: { releaseId: keep.id, sourceType: e.sourceType, sourceKey: e.sourceKey, sourceUrl: e.sourceUrl || '' } },
          });
          if (clash) await this.prisma.cinemaEvidence.delete({ where: { id: e.id } });
          else await this.prisma.cinemaEvidence.update({ where: { id: e.id }, data: { releaseId: keep.id } });
        }
        await this.prisma.cinemaRelease.update({
          where: { id: keep.id },
          data: {
            tmdbId: keep.tmdbId ?? drop.tmdbId, posterPath: keep.posterPath ?? drop.posterPath, overview: keep.overview ?? drop.overview,
            production: keep.production ?? drop.production, certificate: keep.certificate ?? drop.certificate,
            notes: [keep.notes, drop.title !== keep.title ? `Also listed as “${drop.title}”.` : null].filter(Boolean).join('\n') || null,
          },
        });
        await this.prisma.cinemaRelease.delete({ where: { id: drop.id } });
        gone.add(drop.id);
        merged++;
        if (drop.id === a.id) break;
      }
    }
    return merged;
  }

  private tmdbCache = new Map<string, any>();
  private async tmdbSearch(title: string, language: string, year: number) {
    const k = `${title}|${language}|${year}`;
    if (this.tmdbCache.has(k)) return this.tmdbCache.get(k);
    let hit: any = null;
    try {
      const qs = new URLSearchParams({ api_key: process.env.TMDB_API_KEY || '', query: title, primary_release_year: String(year), region: 'IN' });
      const res = await fetch(`https://api.themoviedb.org/3/search/movie?${qs}`, { signal: AbortSignal.timeout(12000) });
      const j: any = res.ok ? await res.json() : { results: [] };
      const norm = makeDedupeKey(title);
      hit = (j.results || []).find((m: any) => m.original_language === language && (makeDedupeKey(m.title) === norm || makeDedupeKey(m.original_title) === norm)) || null;
    } catch {}
    this.tmdbCache.set(k, hit);
    return hit;
  }

  /** Upsert one piece of evidence; current-state sources refresh their claim and time each collect. Returns 1 if new. */
  private async addEvidence(releaseId: string, e: Evidence): Promise<number> {
    const where = { releaseId_sourceType_sourceKey_sourceUrl: { releaseId, sourceType: e.sourceType, sourceKey: e.sourceKey, sourceUrl: e.sourceUrl || '' } };
    const existing = await this.prisma.cinemaEvidence.findUnique({ where });
    const data = {
      sourceName: e.sourceName ?? null, claimedDate: e.claimedDate ?? null, postponed: !!e.postponed, text: e.text?.slice(0, 500) ?? null,
      observedAt: e.observedAt ?? new Date(),
    };
    if (existing) {
      await this.prisma.cinemaEvidence.update({ where: { id: existing.id }, data });
      return 0;
    }
    await this.prisma.cinemaEvidence.create({ data: { releaseId, sourceType: e.sourceType, sourceKey: e.sourceKey, sourceUrl: e.sourceUrl || '', ...data } });
    return 1;
  }

  private pushHistory(raw: string | null, date: string, by: string) {
    let h: Array<{ date: string; at: string; by: string }> = [];
    try {
      h = raw ? JSON.parse(raw) : [];
    } catch {}
    h.push({ date, at: new Date().toISOString(), by });
    return JSON.stringify(h.slice(-20));
  }

  /** Re-derive date + trust from evidence. Date changes and conflicts send approved films back to review. */
  async recompute(id: string, opts: { keepStatus: boolean }) {
    const row = await this.prisma.cinemaRelease.findUnique({ where: { id }, include: { evidence: true } });
    if (!row) return null;
    const claims: CinemaClaim[] = row.evidence.map(e => ({
      sourceType: e.sourceType as CinemaEvidenceType, sourceKey: e.sourceKey, sourceName: e.sourceName, claimedDate: e.claimedDate, postponed: e.postponed, observedAt: e.observedAt,
    }));
    const suggested = row.userLocked ? row.releaseDate : suggestCinemaDate(claims) ?? row.releaseDate;
    let { trust, reason } = computeCinemaTrust(suggested, claims);

    // Cross-check with the OTT Desk: same film there?
    let ottDate = row.ottDate;
    const ottRows = await this.prisma.ottRelease.findMany({
      where: { status: { not: 'REJECTED' }, dubLanguage: null, OR: [...(row.tmdbId ? [{ tmdbId: row.tmdbId }] : []), { language: row.language }] },
    });
    const ott = ottRows.find(o => (row.tmdbId && o.tmdbId === row.tmdbId) || (o.contentType === 'movie' || o.contentType === 'tv') && sameFilmTitle(o.title, row.title));
    if (ott?.releaseDate) {
      // Already streaming → it leaves "now in cinemas"
      if (ott.liveStatus === 'LIVE' || ott.status === 'APPROVED') ottDate = ott.releaseDate;
      // Same title on OTT within a week of this "cinema" date and no theatrical record on TMDB → likely direct-to-OTT
      const nearSameDay = suggested && Math.abs(Date.parse(ott.releaseDate) - Date.parse(suggested)) <= 7 * 86400000;
      const tmdbTheatrical = claims.some(c => c.sourceType === 'TMDB_THEATRICAL');
      if (nearSameDay && !tmdbTheatrical && !row.userLocked) {
        trust = 'CONFLICT';
        reason = `Also on the OTT Desk as a ${ott.platform || 'streaming'} ${ott.contentType === 'tv' ? 'series' : 'release'} on ${ott.releaseDate} — likely direct-to-OTT, not a cinema release. Reject it here if so.`;
      }
    }

    const data: any = { trust, trustReason: reason, ottDate };
    let dateChanged = false;
    let movedBack = false;
    if (suggested !== row.releaseDate) {
      data.releaseDate = suggested;
      if (row.releaseDate && suggested) {
        dateChanged = true;
        data.previousDate = row.releaseDate;
        data.dateChangedAt = new Date();
        data.dateHistory = this.pushHistory(row.dateHistory, suggested, 'sources');
      }
    }
    if (row.status === 'APPROVED' && (dateChanged || (trust === 'CONFLICT' && row.trust !== 'CONFLICT'))) {
      data.status = 'PENDING';
      movedBack = true;
      const why = dateChanged ? `release date changed ${row.releaseDate} → ${suggested}` : reason;
      data.notes = [`⚠ Moved back to review on ${this.todayIst()}: ${why}`, row.notes].filter(Boolean).join('\n').slice(0, 2000);
    } else if (!opts.keepStatus) {
      data.status = 'PENDING';
    }
    await this.prisma.cinemaRelease.update({ where: { id }, data });
    return { dateChanged, movedBack };
  }
}
