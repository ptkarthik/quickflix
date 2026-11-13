import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { OttRelease, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GenreService } from '../media/genre.service';
import { TmdbProvider } from '../research/providers/tmdb.provider';
import { NewsCollectorService } from './news-collector.service';
import { OfficialYoutubeCollector, OfficialVideo, videoMatchesTitle, videoSegments } from './official-youtube.collector';
import { INDIAN_LANGS, TmdbOttCollector } from './tmdb-ott.collector';
import { makeDedupeKey, normalizePlatform } from './ott-text.util';
import { EvidenceType, LiveStatus, computeTrust, suggestFacts } from './trust.util';

export type OttStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
const STATUSES: OttStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
const PUBLISHABLE = ['CONFIRMED', 'CORROBORATED'];

export interface OttReleaseInput {
  title?: string;
  contentType?: 'movie' | 'tv';
  seasonNumber?: number | null;
  dubLanguage?: string | null;
  language?: string | null;
  platform?: string | null;
  releaseDate?: string | null;
  status?: OttStatus;
  sourceUrl?: string | null;
  sourceName?: string | null;
  tmdbId?: number | null;
  posterPath?: string | null;
  overview?: string | null;
  notes?: string | null;
  myRating?: number | null;
  myReview?: string | null;
}

interface Identity {
  title: string;
  contentType?: 'movie' | 'tv';
  seasonNumber?: number | null;
  dubLanguage?: string | null;
  tmdbId?: number | null;
  language?: string | null;
  posterPath?: string | null;
  overview?: string | null;
  originalYear?: number | null;
  origin: 'NEWS' | 'TMDB' | 'OFFICIAL' | 'MANUAL';
}

interface EvidenceInput {
  sourceType: EvidenceType;
  sourceKey: string;
  sourceName?: string | null;
  sourceUrl: string;
  claimedPlatform?: string | null;
  claimedDate?: string | null;
  text?: string | null;
}

export interface CollectSummary {
  startedAt: string;
  finishedAt: string;
  tmdb: { claims: number; errors: number };
  official: { feedsFetched: number; videos: number; matched: number; newTitles: number; errors: number };
  news: { feedsFetched: number; headlinesSeen: number; candidates: number; feedErrors: number };
  live: { checked: number; live: number };
  created: number;
  evidenceAdded: number;
  trust: Record<string, number>;
  movedBackToReview: number;
}

@Injectable()
export class OttService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OttService.name);
  private collecting: Promise<CollectSummary> | null = null;
  private lastCollect: CollectSummary | null = null;
  private timer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdb: TmdbProvider,
    private readonly tmdbOtt: TmdbOttCollector,
    private readonly news: NewsCollectorService,
    private readonly official: OfficialYoutubeCollector,
    private readonly genres: GenreService,
  ) {}

  // ───────────────────────── scheduling ─────────────────────────

  onApplicationBootstrap() {
    if (process.env.OTT_AUTO_COLLECT === 'false') {
      this.logger.log('[OTT] Auto-collect disabled (OTT_AUTO_COLLECT=false).');
      return;
    }
    const hours = Number(process.env.OTT_COLLECT_INTERVAL_HOURS) > 0 ? Number(process.env.OTT_COLLECT_INTERVAL_HOURS) : 6;
    const run = () => this.collect().catch(err => this.logger.error(`[OTT] Collect failed: ${err.message}`));
    this.startupTimer = setTimeout(run, 30_000);
    this.startupTimer.unref?.();
    this.timer = setInterval(run, hours * 3600_000);
    this.timer.unref?.();
    this.logger.log(`[OTT] Auto-collect + re-verification every ${hours}h (first run in 30s).`);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
  }

  getCollectStatus() {
    return { running: !!this.collecting, last: this.lastCollect };
  }

  // ───────────────────────── queries ─────────────────────────

  async list(filter: { status?: string; from?: string; to?: string; language?: string; trust?: string }) {
    const where: Prisma.OttReleaseWhereInput = {};
    if (filter.status) {
      const statuses = filter.status.split(',').map(s => s.trim().toUpperCase()).filter(s => STATUSES.includes(s as OttStatus));
      if (statuses.length) where.status = { in: statuses };
    }
    if (filter.trust) where.trust = { in: filter.trust.split(',').map(s => s.trim().toUpperCase()) };
    if (filter.from || filter.to) {
      where.releaseDate = { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) };
    }
    if (filter.language) where.language = { in: filter.language.split(',') };

    const rows = await this.prisma.ottRelease.findMany({ where, include: { evidence: { orderBy: { observedAt: 'desc' } } } });
    return rows.sort((a, b) => {
      if (a.releaseDate && b.releaseDate) return a.releaseDate.localeCompare(b.releaseDate);
      if (a.releaseDate) return -1;
      if (b.releaseDate) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  async counts() {
    const grouped = await this.prisma.ottRelease.groupBy({ by: ['status', 'trust'], _count: { _all: true } });
    const out: Record<string, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, PENDING_CONFIRMED: 0 };
    for (const g of grouped) {
      out[g.status] = (out[g.status] || 0) + g._count._all;
      if (g.status === 'PENDING' && g.trust === 'CONFIRMED') out.PENDING_CONFIRMED += g._count._all;
    }
    return out;
  }

  private withEvidence(id: string) {
    return this.prisma.ottRelease.findUnique({ where: { id }, include: { evidence: { orderBy: { observedAt: 'desc' } } } });
  }

  // ───────────────────────── human actions ─────────────────────────

  /**
   * Manual entry = one more source (your link). It goes live immediately only if, together with
   * existing evidence, the facts are CONFIRMED/CORROBORATED; otherwise it waits in the queue.
   */
  async createManual(input: OttReleaseInput) {
    const data = this.sanitize(input, true);
    const release = await this.findOrCreateRelease({
      title: data.title as string,
      contentType: (data.contentType as any) || 'movie',
      seasonNumber: (data.seasonNumber as number | null | undefined) ?? null,
      dubLanguage: (data.dubLanguage as string) ?? null,
      language: (data.language as string) ?? null,
      origin: 'MANUAL',
    });
    if (!release) throw new ConflictException('This title was rejected earlier. Find it under "rejected" in the Review Queue to restore it.');

    const lockData: Prisma.OttReleaseUpdateInput = {};
    if (data.platform !== undefined) lockData.platform = data.platform as string | null;
    if (data.releaseDate !== undefined) lockData.releaseDate = data.releaseDate as string | null;
    if (data.language !== undefined && data.language) lockData.language = data.language as string;
    await this.prisma.ottRelease.update({ where: { id: release.id }, data: { ...lockData, userLocked: true } });

    await this.addEvidence(release.id, {
      sourceType: 'MANUAL',
      sourceKey: 'manual',
      sourceName: 'You',
      sourceUrl: (data.sourceUrl as string) || `manual:${release.id}`,
      claimedPlatform: (data.platform as string) || null,
      claimedDate: (data.releaseDate as string) || null,
      text: data.sourceUrl ? 'Added manually with announcement link' : 'Added manually (no link)',
    });
    if (!release.posterPath) await this.enrich(release.id).catch(() => null);
    await this.liveCheck(release.id).catch(() => null);
    const after = await this.recompute(release.id);
    if (after && PUBLISHABLE.includes(after.trust) && after.status === 'PENDING') {
      await this.prisma.ottRelease.update({ where: { id: release.id }, data: { status: 'APPROVED' } });
    }
    return this.withEvidence(release.id);
  }

  async update(id: string, input: OttReleaseInput) {
    const existing = await this.prisma.ottRelease.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('OTT release not found');
    const data: any = this.sanitize(input, false);
    if (input.status !== undefined) {
      if (!STATUSES.includes(input.status)) throw new BadRequestException(`status must be one of ${STATUSES.join(', ')}`);
      data.status = input.status;
    }
    // Any human edit of the facts locks them against automatic suggestions.
    if (
      (data.platform !== undefined && data.platform !== existing.platform) ||
      (data.releaseDate !== undefined && data.releaseDate !== existing.releaseDate)
    ) {
      data.userLocked = true;
    }

    const title = data.title ?? existing.title;
    const season = data.seasonNumber !== undefined ? data.seasonNumber : existing.seasonNumber;
    const dub = data.dubLanguage !== undefined ? data.dubLanguage : existing.dubLanguage;
    const dedupeKey = this.keyFor(title, season, dub);
    if (dedupeKey !== existing.dedupeKey) {
      const clash = await this.prisma.ottRelease.findUnique({ where: { dedupeKey } });
      if (clash && clash.id !== id) {
        throw new ConflictException(`"${clash.title}" already exists (${clash.status}). Edit or delete that entry instead.`);
      }
      data.dedupeKey = dedupeKey;
    }
    await this.prisma.ottRelease.update({ where: { id }, data });
    if (data.tmdbId !== undefined || data.platform !== undefined || data.dubLanguage !== undefined) await this.liveCheck(id).catch(() => null);
    await this.recompute(id, { keepStatus: true });
    return this.withEvidence(id);
  }

  async remove(id: string) {
    await this.prisma.ottRelease.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('OTT release not found');
    });
    return { deleted: true };
  }

  async bulkStatus(ids: string[], status: OttStatus) {
    if (!STATUSES.includes(status)) throw new BadRequestException('Invalid status');
    const res = await this.prisma.ottRelease.updateMany({ where: { id: { in: ids } }, data: { status } });
    return { updated: res.count };
  }

  /** One click: approve every pending item whose facts are CONFIRMED (official channel or verified live). */
  async approveConfirmed() {
    const res = await this.prisma.ottRelease.updateMany({
      where: { status: 'PENDING', trust: 'CONFIRMED', platform: { not: null } },
      data: { status: 'APPROVED' },
    });
    return { approved: res.count };
  }

  searchTmdb(query: string) {
    return this.tmdb.searchTitles(query);
  }

  /** Fill poster / TMDB id / language from an exact TMDB title match; merges duplicates sharing a TMDB id. */
  async enrich(id: string, force = false) {
    const row = await this.prisma.ottRelease.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('OTT release not found');
    if (row.tmdbId && row.posterPath && row.originalYear && !force) return row;
    const match = await this.findTmdbMatch(row.title, row.contentType as any, row.language || undefined);
    if (!match) return row;

    // Same title already tracked under its TMDB id (e.g. news spelling vs TMDB spelling)? Merge into it.
    if (!row.tmdbId) {
      const twin = await this.prisma.ottRelease.findFirst({
        where: { id: { not: row.id }, tmdbId: match.tmdbId, contentType: match.contentType, seasonNumber: row.seasonNumber, dubLanguage: row.dubLanguage },
      });
      if (twin) return this.merge(row.id, twin.id);
    }
    return this.prisma.ottRelease.update({
      where: { id },
      data: {
        tmdbId: force || !row.tmdbId ? match.tmdbId : row.tmdbId,
        posterPath: force || !row.posterPath ? match.posterPath ?? row.posterPath : row.posterPath,
        overview: force || !row.overview ? match.overview ?? row.overview : row.overview,
        language: row.status === 'PENDING' && row.origin !== 'MANUAL' ? match.originalLanguage || row.language : row.language || match.originalLanguage || null,
        contentType: force || !row.tmdbId ? match.contentType : row.contentType,
        originalYear: force || !row.originalYear ? (match.releaseDate ? parseInt(match.releaseDate.slice(0, 4), 10) : row.originalYear) : row.originalYear,
      },
    });
  }

  // ───────────────────────── collection + verification ─────────────────────────

  collect(): Promise<CollectSummary> {
    if (this.collecting) return this.collecting;
    this.collecting = this.runCollect().finally(() => {
      this.collecting = null;
    });
    return this.collecting;
  }

  private async runCollect(): Promise<CollectSummary> {
    const startedAt = new Date().toISOString();
    const today = this.todayIst();
    const summary: CollectSummary = {
      startedAt, finishedAt: '',
      tmdb: { claims: 0, errors: 0 },
      official: { feedsFetched: 0, videos: 0, matched: 0, newTitles: 0, errors: 0 },
      news: { feedsFetched: 0, headlinesSeen: 0, candidates: 0, feedErrors: 0 },
      live: { checked: 0, live: 0 },
      created: 0, evidenceAdded: 0, trust: {}, movedBackToReview: 0,
    };
    const createdBefore = await this.prisma.ottRelease.count();
    const evidenceBefore = await this.prisma.ottEvidence.count();

    await this.backfillLegacyEvidence();

    // 1) TMDB structured release dates (movies: India digital; series: season premieres on Indian platforms)
    const tmdb = await this.tmdbOtt.collectReleases(this.shiftDays(today, -30), this.shiftDays(today, 120));
    summary.tmdb = { claims: tmdb.claims.length, errors: tmdb.errors.length };
    for (const c of tmdb.claims) {
      const release = await this.findOrCreateRelease({
        title: c.title, contentType: c.contentType, seasonNumber: c.contentType === 'tv' ? c.seasonNumber : null,
        dubLanguage: c.dubLanguage, tmdbId: c.tmdbId, language: c.originalLanguage, posterPath: c.posterPath, overview: c.overview, originalYear: c.originalYear, origin: 'TMDB',
      });
      if (!release) continue;
      await this.addEvidence(release.id, {
        sourceType: 'TMDB_RELEASE', sourceKey: 'tmdb', sourceName: 'TMDB', sourceUrl: c.url,
        claimedPlatform: c.platform, claimedDate: c.date, text: c.text,
      });
    }

    // 2) Official platform YouTube channels (first drop stored official evidence that no longer passes the strict matcher)
    await this.pruneOfficialEvidence();
    const off = await this.official.collect();
    summary.official.feedsFetched = off.feedsFetched;
    summary.official.videos = off.videos.length;
    summary.official.errors = off.feedErrors.length;
    let tmdbLookups = 0;
    const known = await this.prisma.ottRelease.findMany({ where: { status: { not: 'REJECTED' } }, select: { id: true, title: true, dubLanguage: true, language: true, seasonNumber: true, contentType: true } });
    for (const v of off.videos) {
      const r = await this.applyOfficialVideo(v, () => tmdbLookups++ < 60, known);
      if (r === 'matched') summary.official.matched++;
      if (r === 'created') { summary.official.matched++; summary.official.newTitles++; }
    }

    // 3) News headlines (Google News India) — supporting evidence only
    const newsResult = await this.news.collect(7);
    summary.news = { feedsFetched: newsResult.feedsFetched, headlinesSeen: newsResult.headlinesSeen, candidates: newsResult.candidates.length, feedErrors: newsResult.feedErrors.length };
    for (const c of newsResult.candidates) {
      const release = await this.findOrCreateRelease({
        title: c.title, contentType: c.seasonNumber ? 'tv' : undefined, seasonNumber: c.seasonNumber ?? null,
        dubLanguage: c.dubLanguage, language: c.language, origin: 'NEWS',
      });
      if (!release) continue;
      const date = c.releaseDate && c.releaseDate >= this.shiftDays(today, -45) ? c.releaseDate : null;
      await this.addEvidence(release.id, {
        sourceType: 'NEWS', sourceKey: `news:${(c.sourceName || 'unknown').toLowerCase()}`, sourceName: c.sourceName || 'News',
        sourceUrl: c.sourceUrl, claimedPlatform: normalizePlatform(c.platform) ?? null, claimedDate: date, text: c.headline,
      });
    }

    // 4) Posters / TMDB ids for new rows (also merges spelling duplicates)
    const needEnrich = await this.prisma.ottRelease.findMany({ where: { status: { not: 'REJECTED' }, tmdbId: null }, select: { id: true } });
    for (let i = 0; i < needEnrich.length; i += 4) {
      await Promise.all(needEnrich.slice(i, i + 4).map(r => this.enrich(r.id).catch(() => null)));
    }

    // 5) Live-in-India verification (re-run every collect = daily re-verification)
    const liveCandidates = await this.prisma.ottRelease.findMany({
      where: {
        status: { not: 'REJECTED' }, tmdbId: { not: null }, dubLanguage: null,
        OR: [{ releaseDate: null }, { releaseDate: { gte: this.shiftDays(today, -60), lte: this.shiftDays(today, 3) } }],
      },
      select: { id: true },
    });
    for (let i = 0; i < liveCandidates.length; i += 6) {
      const res = await Promise.all(liveCandidates.slice(i, i + 6).map(r => this.liveCheck(r.id).catch(() => null)));
      summary.live.checked += res.filter(x => x !== null).length;
      summary.live.live += res.filter(x => x === 'LIVE').length;
      await new Promise(r => setTimeout(r, 150));
    }

    // 6) Recompute trust for everything active
    const active = await this.prisma.ottRelease.findMany({ where: { status: { not: 'REJECTED' } }, select: { id: true } });
    for (const r of active) {
      const res = await this.recompute(r.id);
      if (res?.movedBack) summary.movedBackToReview++;
      if (res) summary.trust[res.trust] = (summary.trust[res.trust] || 0) + 1;
    }

    // 7) Genres (drive the automatic post theme)
    await this.genres.backfill().catch(() => null);

    summary.created = (await this.prisma.ottRelease.count()) - createdBefore;
    summary.evidenceAdded = (await this.prisma.ottEvidence.count()) - evidenceBefore;
    summary.finishedAt = new Date().toISOString();
    this.lastCollect = summary;
    this.logger.log(`[OTT] Collect: +${summary.created} releases, +${summary.evidenceAdded} evidence, trust ${JSON.stringify(summary.trust)}, ${summary.movedBackToReview} moved back to review.`);
    return summary;
  }

  /** Official video → evidence on a known release, or a new release when a segment exactly matches a TMDB title. */
  private async applyOfficialVideo(
    v: OfficialVideo,
    mayLookup: () => boolean,
    known: Array<Pick<OttRelease, 'id' | 'title' | 'dubLanguage' | 'language' | 'seasonNumber' | 'contentType'>>,
  ): Promise<'matched' | 'created' | 'skipped'> {
    // Match known titles first (cheap, no API calls).
    const matches = known.filter(k => videoMatchesTitle(v.segments, k.title));

    const evidenceFor = (releaseId: string) =>
      this.addEvidence(releaseId, {
        sourceType: 'OFFICIAL_YOUTUBE', sourceKey: `official:${v.platform}`, sourceName: `${v.platform} (${v.channelHandle})`, sourceUrl: v.url,
        claimedPlatform: v.platform, claimedDate: v.isReleaseAnnouncement ? v.claimedDate ?? null : null, text: v.videoTitle,
      });

    if (matches.length > 0) {
      for (const k of matches) {
        // A dub-specific video ("Hindi Trailer") is evidence for that dub release, not the original.
        const videoDub = v.dubLanguage && v.dubLanguage !== k.language ? v.dubLanguage : null;
        if ((k.dubLanguage || null) === videoDub) {
          await evidenceFor(k.id);
        } else if (videoDub && !k.dubLanguage) {
          const dubRelease = await this.findOrCreateRelease({ title: k.title, contentType: k.contentType as any, seasonNumber: k.seasonNumber, dubLanguage: videoDub, language: k.language, origin: 'OFFICIAL' });
          if (dubRelease) {
            if (!known.some(x => x.id === dubRelease.id)) known.push(dubRelease);
            await evidenceFor(dubRelease.id);
          }
        }
      }
      return 'matched';
    }

    // New titles only from dated release announcements, and only on an exact TMDB title match.
    if (!v.isReleaseAnnouncement || !v.claimedDate) return 'skipped';
    for (const seg of v.segments) {
      if (!mayLookup()) return 'skipped';
      const m = await this.findTmdbMatch(seg);
      if (!m) continue;
      const videoDub = v.dubLanguage && v.dubLanguage !== m.originalLanguage ? v.dubLanguage : null;
      const release = await this.findOrCreateRelease({
        title: m.title, contentType: m.contentType, seasonNumber: null, dubLanguage: videoDub, tmdbId: m.tmdbId,
        language: m.originalLanguage, posterPath: m.posterPath, overview: m.overview, originalYear: m.releaseDate ? parseInt(m.releaseDate.slice(0, 4), 10) : null, origin: 'OFFICIAL',
      });
      if (!release) return 'skipped';
      known.push(release);
      await evidenceFor(release.id);
      return 'created';
    }
    return 'skipped';
  }

  /** Check what is streaming in India now and record it as evidence. Returns the live status. */
  async liveCheck(id: string): Promise<LiveStatus | null> {
    const row = await this.prisma.ottRelease.findUnique({ where: { id } });
    if (!row || !row.tmdbId) return null;
    // Watch providers can't tell a dub apart, and a later season of a show already on the platform
    // would look "live" — so only original-language movies and first seasons are verifiable this way.
    if (row.dubLanguage || (row.contentType === 'tv' && (row.seasonNumber ?? 1) > 1)) {
      if (row.liveStatus !== 'UNKNOWN') await this.prisma.ottRelease.update({ where: { id }, data: { liveStatus: 'UNKNOWN', livePlatforms: null } });
      return 'UNKNOWN';
    }
    const platforms = await this.tmdbOtt.livePlatformsInIndia(row.tmdbId, row.contentType === 'tv' ? 'tv' : 'movie');
    if (platforms === null) return null; // lookup failed: keep previous state
    const status: LiveStatus = platforms.length > 0 ? 'LIVE' : 'NOT_LIVE';
    await this.prisma.ottRelease.update({
      where: { id },
      data: {
        liveStatus: status,
        livePlatforms: platforms.join(',') || null,
        liveCheckedAt: new Date(),
        liveFirstSeenAt: status === 'LIVE' && !row.liveFirstSeenAt ? new Date() : row.liveFirstSeenAt,
      },
    });
    if (status === 'LIVE') {
      await this.addEvidence(id, {
        sourceType: 'TMDB_LIVE', sourceKey: 'tmdb-live', sourceName: 'JustWatch via TMDB (India)',
        sourceUrl: `https://www.themoviedb.org/${row.contentType === 'tv' ? 'tv' : 'movie'}/${row.tmdbId}/watch?locale=IN`,
        claimedPlatform: row.platform && platforms.includes(row.platform) ? row.platform : platforms[0],
        text: `Streaming in India now on: ${platforms.join(', ')}`,
      });
    }
    return status;
  }

  /**
   * Recompute trust; fill unlocked platform/date from evidence; if an approved item's facts changed or
   * fell to CONFLICT, move it back to the review queue with a note (it must never stay public silently).
   */
  async recompute(id: string, opts: { keepStatus?: boolean } = {}) {
    const row = await this.withEvidence(id);
    if (!row) return null;
    const livePlatforms = row.livePlatforms ? row.livePlatforms.split(',') : [];
    const claims = row.evidence.map(e => ({ sourceType: e.sourceType as EvidenceType, sourceKey: e.sourceKey, sourceName: e.sourceName, claimedPlatform: e.claimedPlatform, claimedDate: e.claimedDate }));

    let platform = row.platform;
    let releaseDate = row.releaseDate;
    if (!row.userLocked) {
      const s = suggestFacts(claims, livePlatforms);
      if (s.platform) platform = s.platform;
      if (s.date) releaseDate = s.date;
    }
    const { trust, reason } = computeTrust({
      platform, releaseDate, liveStatus: row.liveStatus as LiveStatus, livePlatforms, evidence: claims, today: this.todayIst(),
    });

    const factsChanged = platform !== row.platform || releaseDate !== row.releaseDate;
    let status = row.status;
    let notes = row.notes;
    let movedBack = false;
    if (!opts.keepStatus && row.status === 'APPROVED' && (trust === 'CONFLICT' || factsChanged)) {
      status = 'PENDING';
      movedBack = true;
      const why = trust === 'CONFLICT' ? reason : `Sources changed it to ${platform || '?'} / ${releaseDate || '?'} (was ${row.platform || '?'} / ${row.releaseDate || '?'})`;
      const note = `⚠ Moved back to review on ${this.todayIst()}: ${why}`;
      notes = notes ? `${notes}\n${note}` : note;
    }
    if (factsChanged || trust !== row.trust || reason !== row.trustReason || status !== row.status || notes !== row.notes) {
      await this.prisma.ottRelease.update({ where: { id }, data: { platform, releaseDate, trust, trustReason: reason, status, notes } });
    }
    return { trust, movedBack, status };
  }

  // ───────────────────────── identity & evidence storage ─────────────────────────

  private keyFor(title: string, season?: number | null, dub?: string | null) {
    return makeDedupeKey(title, season) + (dub ? `@${dub}` : '');
  }

  /** Find the release this claim is about (by TMDB id, else by normalised title) or create it. Returns null if rejected. */
  private async findOrCreateRelease(idn: Identity): Promise<OttRelease | null> {
    const season = idn.contentType === 'tv' && idn.seasonNumber && idn.seasonNumber > 1 ? idn.seasonNumber : null;
    const dub = idn.dubLanguage && idn.dubLanguage !== idn.language ? idn.dubLanguage : null;
    const dedupeKey = this.keyFor(idn.title, season, dub);

    let existing: OttRelease | null = null;
    if (idn.tmdbId) {
      existing = await this.prisma.ottRelease.findFirst({
        where: { tmdbId: idn.tmdbId, contentType: idn.contentType || 'movie', seasonNumber: season, dubLanguage: dub },
      });
    }
    existing = existing || (await this.prisma.ottRelease.findUnique({ where: { dedupeKey } }));

    if (existing) {
      if (existing.status === 'REJECTED') return null;
      const fill: Prisma.OttReleaseUpdateInput = {};
      if (!existing.tmdbId && idn.tmdbId) { fill.tmdbId = idn.tmdbId; fill.contentType = idn.contentType || existing.contentType; }
      if (!existing.posterPath && idn.posterPath) fill.posterPath = idn.posterPath;
      if (!existing.overview && idn.overview) fill.overview = idn.overview;
      if (idn.originalYear && (!existing.originalYear || idn.originalYear < existing.originalYear)) fill.originalYear = idn.originalYear;
      if (idn.tmdbId && idn.language && existing.status === 'PENDING' && existing.origin !== 'MANUAL') fill.language = idn.language;
      else if (!existing.language && idn.language) fill.language = idn.language;
      return Object.keys(fill).length ? this.prisma.ottRelease.update({ where: { id: existing.id }, data: fill }) : existing;
    }

    return this.prisma.ottRelease.create({
      data: {
        title: idn.title.trim().slice(0, 200),
        dedupeKey,
        contentType: idn.contentType || 'movie',
        seasonNumber: season,
        dubLanguage: dub,
        language: idn.language ?? null,
        tmdbId: idn.tmdbId ?? null,
        posterPath: idn.posterPath ?? null,
        overview: idn.overview ?? null,
        originalYear: idn.originalYear ?? null,
        origin: idn.origin === 'OFFICIAL' ? 'TMDB' : idn.origin,
        status: 'PENDING',
      },
    });
  }

  private async addEvidence(releaseId: string, e: EvidenceInput) {
    const platform = e.claimedPlatform ? normalizePlatform(e.claimedPlatform) ?? null : null;
    try {
      await this.prisma.ottEvidence.upsert({
        where: { releaseId_sourceType_sourceKey_sourceUrl: { releaseId, sourceType: e.sourceType, sourceKey: e.sourceKey, sourceUrl: e.sourceUrl } },
        update: { claimedPlatform: platform, claimedDate: e.claimedDate ?? null, text: e.text ?? null, sourceName: e.sourceName ?? null, observedAt: new Date() },
        create: { releaseId, sourceType: e.sourceType, sourceKey: e.sourceKey, sourceName: e.sourceName ?? null, sourceUrl: e.sourceUrl, claimedPlatform: platform, claimedDate: e.claimedDate ?? null, text: e.text ?? null },
      });
    } catch (err: any) {
      this.logger.warn(`[OTT] addEvidence failed: ${err.message}`);
    }
  }

  /** Move evidence from `fromId` into `intoId` and delete `fromId`. */
  private async merge(fromId: string, intoId: string) {
    const from = await this.withEvidence(fromId);
    if (!from) return this.prisma.ottRelease.findUnique({ where: { id: intoId } });
    for (const e of from.evidence) {
      await this.addEvidence(intoId, { sourceType: e.sourceType as EvidenceType, sourceKey: e.sourceKey, sourceName: e.sourceName, sourceUrl: e.sourceUrl || `merged:${e.id}`, claimedPlatform: e.claimedPlatform, claimedDate: e.claimedDate, text: e.text });
    }
    await this.prisma.ottRelease.delete({ where: { id: fromId } });
    this.logger.log(`[OTT] Merged "${from.title}" into existing release ${intoId}.`);
    return this.prisma.ottRelease.findUnique({ where: { id: intoId } });
  }

  /** Re-validate stored official-channel evidence with the current matcher; remove false matches. */
  private async pruneOfficialEvidence() {
    const rows = await this.prisma.ottEvidence.findMany({ where: { sourceType: 'OFFICIAL_YOUTUBE' }, include: { release: { select: { title: true } } } });
    const bad = rows.filter(e => !videoMatchesTitle(videoSegments(e.text || '', e.observedAt), e.release.title));
    if (bad.length) {
      await this.prisma.ottEvidence.deleteMany({ where: { id: { in: bad.map(e => e.id) } } });
      this.logger.warn(`[OTT] Removed ${bad.length} official-evidence row(s) that no longer match their title.`);
    }
  }

  /** Rows created before the evidence table existed: turn their source link into NEWS evidence. */
  private async backfillLegacyEvidence() {
    const legacy = await this.prisma.ottRelease.findMany({ where: { evidence: { none: {} }, sourceUrl: { not: null }, origin: { in: ['NEWS', 'TMDB'] } } });
    for (const r of legacy) {
      const isTmdb = r.origin === 'TMDB';
      await this.addEvidence(r.id, {
        sourceType: isTmdb ? 'TMDB_RELEASE' : 'NEWS',
        sourceKey: isTmdb ? 'tmdb' : `news:${(r.sourceName || 'unknown').toLowerCase()}`,
        sourceName: isTmdb ? 'TMDB' : r.sourceName || 'News',
        sourceUrl: r.sourceUrl!, claimedPlatform: r.userLocked ? null : r.platform, claimedDate: r.userLocked ? null : r.releaseDate, text: r.headline,
      });
    }
  }

  private async findTmdbMatch(title: string, contentType?: 'movie' | 'tv', language?: string) {
    const results = await this.tmdb.searchTitles(title);
    const key = makeDedupeKey(title);
    const exact = results.filter(r => makeDedupeKey(r.title) === key);
    if (exact.length === 0) return undefined; // no fuzzy guesses: a wrong poster/identity is worse than none
    const score = (r: (typeof exact)[number]) =>
      (language && r.originalLanguage === language ? 100 : 0) +
      (INDIAN_LANGS.includes(r.originalLanguage || '') ? 50 : 0) +
      (contentType && r.contentType === contentType ? 20 : 0) +
      (r.releaseDate && r.releaseDate >= this.shiftDays(this.todayIst(), -400) ? 15 : 0) +
      (r.posterPath ? 10 : 0) +
      Math.min(r.popularity || 0, 9);
    return exact.sort((a, b) => score(b) - score(a))[0];
  }

  // ───────────────────────── helpers ─────────────────────────

  private sanitize(input: OttReleaseInput, requireTitle: boolean): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (input.title !== undefined) {
      const t = String(input.title).trim();
      if (!t) throw new BadRequestException('title cannot be empty');
      out.title = t.slice(0, 200);
    } else if (requireTitle) {
      throw new BadRequestException('title is required');
    }
    if (input.contentType !== undefined) {
      if (input.contentType !== 'movie' && input.contentType !== 'tv') throw new BadRequestException('contentType must be movie or tv');
      out.contentType = input.contentType;
    }
    if (input.seasonNumber !== undefined) {
      const s = input.seasonNumber === null || (input.seasonNumber as any) === '' ? null : Number(input.seasonNumber);
      if (s !== null && (!Number.isInteger(s) || s < 1 || s > 99)) throw new BadRequestException('seasonNumber must be 1-99');
      out.seasonNumber = s;
    }
    if (input.releaseDate !== undefined) {
      const d = input.releaseDate ? String(input.releaseDate).trim() : null;
      if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d)))) throw new BadRequestException('releaseDate must be YYYY-MM-DD');
      out.releaseDate = d;
    }
    if (input.platform !== undefined) out.platform = normalizePlatform(input.platform) ?? null;
    if (input.sourceUrl !== undefined) {
      const u = input.sourceUrl ? String(input.sourceUrl).trim() : null;
      if (u && !/^https?:\/\//i.test(u)) throw new BadRequestException('sourceUrl must start with http(s)://');
      out.sourceUrl = u;
    }
    for (const k of ['language', 'dubLanguage', 'sourceName', 'posterPath', 'overview', 'notes'] as const) {
      if (input[k] !== undefined) out[k] = input[k] ? String(input[k]).trim() : null;
    }
    if (input.tmdbId !== undefined) out.tmdbId = input.tmdbId ? Number(input.tmdbId) : null;
    if (input.myRating !== undefined) {
      const v = input.myRating === null || (input.myRating as any) === '' ? null : Number(input.myRating);
      if (v !== null && (!Number.isFinite(v) || v < 0 || v > 5 || Math.round(v * 2) !== v * 2)) throw new BadRequestException('myRating must be 0-5 in steps of 0.5');
      out.myRating = v;
    }
    if (input.myReview !== undefined) out.myReview = input.myReview ? String(input.myReview).trim().slice(0, 1000) : null;
    return out;
  }

  todayIst(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  private shiftDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
}
