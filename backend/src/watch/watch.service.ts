import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { zipSync, strToU8 } from 'fflate';
import { PrismaService } from '../prisma/prisma.service';
import { WorldService } from '../world/world.service';
import { SiteBrand, SiteData, SiteTitle, SiteVideo, renderSite } from './site-template';
import { mapArchiveDoc, mapYoutubeVideo, parseChannelRef, pickTrailer } from './watch.util';

const YT = 'https://www.googleapis.com/youtube/v3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

/**
 * The client "Watch Free" site — legal sources only, every item approved by you:
 *  1. titles free (with ads) in India on official apps (TMDB/JustWatch providers) → link out;
 *  2. full movies uploaded by official YouTube channels you added → YouTube's own player;
 *  3. public-domain films on the Internet Archive → the Archive's own player;
 *  4. official trailers (TMDB → YouTube) + where to watch.
 */
@Injectable()
export class WatchService {
  private readonly logger = new Logger(WatchService.name);
  fetchImpl: typeof fetch = (...a) => fetch(...a);
  scanning: Record<string, { active: boolean; note?: string }> = {};

  constructor(
    private readonly prisma: PrismaService,
    private readonly world: WorldService,
  ) {}

  // ───────────── YouTube (official channels you trust) ─────────────

  private ytKey() {
    const k = process.env.YT_API_KEY?.trim();
    if (!k) throw new ServiceUnavailableException('Add a free YouTube Data API key as YT_API_KEY in backend/.env (Google Cloud → Credentials → API key).');
    return k;
  }
  private async yt<T = any>(path: string, params: Record<string, string | number>) {
    const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), key: this.ytKey() });
    const res = await this.fetchImpl(`${YT}/${path}?${q}`, { signal: AbortSignal.timeout(20000) });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = body.error?.errors?.[0]?.reason;
      throw new BadRequestException(`YouTube: ${body.error?.message || `HTTP ${res.status}`}${reason === 'quotaExceeded' ? ' — today’s free quota is used up; try tomorrow.' : ''}`);
    }
    return body as T;
  }

  private channelRow(c: any) {
    return {
      channelId: c.id as string,
      title: c.snippet?.title as string,
      handle: c.snippet?.customUrl || null,
      subscribers: c.statistics?.hiddenSubscriberCount ? null : Number(c.statistics?.subscriberCount || 0) || null,
      thumbnail: c.snippet?.thumbnails?.default?.url || null,
    };
  }

  /** Find channels by name — you pick the official one (subscriber counts help). */
  async searchChannels(q: string) {
    if (!q.trim()) return [];
    const s = await this.yt('search', { part: 'snippet', type: 'channel', q: q.trim(), maxResults: 10, regionCode: 'IN' });
    const ids = (s.items || []).map((i: any) => i.snippet?.channelId || i.id?.channelId).filter(Boolean);
    if (!ids.length) return [];
    const c = await this.yt('channels', { part: 'snippet,statistics', id: ids.join(',') });
    const have = new Set((await this.prisma.watchChannel.findMany({ select: { channelId: true } })).map(x => x.channelId));
    return (c.items || []).map((x: any) => ({ ...this.channelRow(x), added: have.has(x.id) })).sort((a: any, b: any) => (b.subscribers || 0) - (a.subscribers || 0));
  }

  async addChannel(ref: string) {
    const r = parseChannelRef(ref || '');
    if (!r) throw new BadRequestException('Paste a YouTube channel link (…/@handle or …/channel/UC…).');
    const c = await this.yt('channels', { part: 'snippet,statistics', ...(r.id ? { id: r.id } : { forHandle: r.handle! }) });
    const item = c.items?.[0];
    if (!item) throw new NotFoundException('No YouTube channel found for that link.');
    const row = this.channelRow(item);
    return this.prisma.watchChannel.upsert({ where: { channelId: row.channelId }, create: row, update: { ...row, enabled: true } });
  }

  channels() {
    return this.prisma.watchChannel.findMany({ orderBy: { createdAt: 'asc' } });
  }
  async removeChannel(id: string) {
    await this.prisma.watchChannel.delete({ where: { id } }).catch(() => null);
    return { removed: true };
  }

  /** Read a channel's uploads (up to ~2,000 newest) and queue its full-length films (60+ min, watchable in India). */
  async scanChannel(id: string) {
    const ch = await this.prisma.watchChannel.findUnique({ where: { id } });
    if (!ch) throw new NotFoundException('Channel not found');
    this.ytKey();
    const key = `yt:${id}`;
    if (this.scanning[key]?.active) return this.scanning[key];
    this.scanning[key] = { active: true, note: 'Reading uploads…' };
    (async () => {
      const uploads = `UU${ch.channelId.slice(2)}`;
      let page: string | undefined;
      let seen = 0;
      let added = 0;
      let films = 0;
      for (let i = 0; i < 40; i++) {
        const p = await this.yt('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: 50, ...(page ? { pageToken: page } : {}) });
        const ids: string[] = (p.items || []).map((x: any) => x.contentDetails?.videoId).filter(Boolean);
        seen += ids.length;
        if (ids.length) {
          const v = await this.yt('videos', { part: 'snippet,contentDetails,status,statistics', id: ids.join(',') });
          for (const item of v.items || []) {
            const m = mapYoutubeVideo(item);
            if (!m) continue;
            films++;
            const r = await this.prisma.freeVideo.upsert({
              where: { source_externalId: { source: 'youtube', externalId: m.externalId } },
              create: { ...m, status: 'PENDING' },
              update: { title: m.title, thumbnail: m.thumbnail, embeddable: m.embeddable, views: m.views, minutes: m.minutes, channel: m.channel },
            });
            if (r.createdAt.getTime() === r.updatedAt.getTime()) added++;
          }
        }
        this.scanning[key] = { active: true, note: `${seen} uploads read · ${films} full-length films` };
        page = p.nextPageToken;
        if (!page) break;
      }
      const note = `${seen} uploads read · ${films} full-length films (${added} new to review)`;
      await this.prisma.watchChannel.update({ where: { id }, data: { lastScanAt: new Date(), lastScanNote: note } });
      this.scanning[key] = { active: false, note };
    })().catch(e => {
      this.scanning[key] = { active: false, note: `Failed: ${e.message}` };
    });
    return this.scanning[key];
  }

  // ───────────── Internet Archive (public domain) ─────────────

  /** Queue public-domain feature films (most watched first), optionally matching a search ("Chaplin", "Hindi", "noir"). */
  async scanArchive(input: { q?: string; rows?: number; page?: number }) {
    const rows = Math.max(10, Math.min(Number(input.rows) || 100, 300));
    const extra = (input.q || '').replace(/[^\p{L}\p{N} '-]/gu, ' ').trim();
    const q = `collection:(feature_films) AND mediatype:(movies) AND licenseurl:(*publicdomain*)${extra ? ` AND (${extra})` : ''}`;
    const fl = ['identifier', 'title', 'year', 'date', 'description', 'language', 'licenseurl', 'runtime', 'downloads'].map(f => `fl[]=${f}`).join('&');
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&${fl}&sort[]=downloads+desc&rows=${rows}&page=${Math.max(1, Number(input.page) || 1)}&output=json`;
    const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new ServiceUnavailableException(`Internet Archive: HTTP ${res.status}`);
    const body: any = await res.json();
    let added = 0;
    let found = 0;
    for (const d of body.response?.docs || []) {
      const m = mapArchiveDoc(d);
      if (!m || (m.minutes != null && m.minutes < 40)) continue; // feature films only, not shorts
      found++;
      const exists = await this.prisma.freeVideo.findUnique({ where: { source_externalId: { source: 'archive', externalId: m.externalId } } });
      if (exists) continue;
      await this.prisma.freeVideo.create({ data: { ...m, status: 'PENDING' } });
      added++;
    }
    return { total: body.response?.numFound ?? 0, found, added };
  }

  // ───────────── review queue ─────────────

  async videos(f: { source?: string; status?: string; q?: string; skip?: string; take?: string }) {
    const where: any = {};
    if (f.source) where.source = f.source;
    if (f.status && f.status !== 'ALL') where.status = f.status;
    if (f.q?.trim()) where.title = { contains: f.q.trim() };
    const take = Math.min(Number(f.take) || 60, 200);
    const [total, items, counts] = await Promise.all([
      this.prisma.freeVideo.count({ where }),
      this.prisma.freeVideo.findMany({ where, orderBy: [{ views: { sort: 'desc', nulls: 'last' } }], skip: Number(f.skip) || 0, take }),
      this.prisma.freeVideo.groupBy({ by: ['source', 'status'], _count: { _all: true } }),
    ]);
    return { total, items, counts: counts.map(c => ({ source: c.source, status: c.status, n: c._count._all })) };
  }

  async setStatus(ids: string[], status: string) {
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) throw new BadRequestException('Bad status');
    const r = await this.prisma.freeVideo.updateMany({ where: { id: { in: (ids || []).slice(0, 500) } }, data: { status } });
    return { updated: r.count };
  }

  // ───────────── trailers + site ─────────────

  /** Official trailer keys for approved World titles (checked again after 30 days). */
  async refreshTrailers(limit = 400) {
    const key = process.env.TMDB_API_KEY;
    if (!key) throw new ServiceUnavailableException('TMDB_API_KEY is missing');
    const due = await this.prisma.worldTitle.findMany({
      where: { status: 'APPROVED', OR: [{ trailerCheckedAt: null }, { trailerCheckedAt: { lt: new Date(Date.now() - 30 * 86400000) } }] },
      select: { id: true, kind: true, tmdbId: true, language: true },
      take: limit,
    });
    let found = 0;
    for (const t of due) {
      try {
        const res = await this.fetchImpl(`https://api.themoviedb.org/3/${t.kind}/${t.tmdbId}/videos?api_key=${key}&include_video_language=en,${t.language || 'en'},null`, { signal: AbortSignal.timeout(15000) });
        const body: any = res.ok ? await res.json() : {};
        const trailerKey = pickTrailer(body.results || [], t.language);
        if (trailerKey) found++;
        await this.prisma.worldTitle.update({ where: { id: t.id }, data: { trailerKey, trailerCheckedAt: new Date() } });
      } catch {}
      await new Promise(r => setTimeout(r, 60));
    }
    return { checked: due.length, found };
  }

  async summary() {
    const approved = await this.prisma.worldTitle.findMany({ where: { status: 'APPROVED' }, select: { providersIn: true, trailerKey: true, trailerCheckedAt: true } });
    const freeApproved = approved.filter(t => /"type":"free"/.test(t.providersIn || '')).length;
    const freeAll = await this.prisma.worldTitle.count({ where: { status: { not: 'REJECTED' }, providersIn: { contains: '"type":"free"' } } });
    const v = await this.prisma.freeVideo.groupBy({ by: ['source', 'status'], _count: { _all: true } });
    const n = (source: string, status: string) => v.find(x => x.source === source && x.status === status)?._count._all || 0;
    return {
      free: { approved: freeApproved, available: freeAll },
      trailers: { approved: approved.length, withTrailer: approved.filter(t => t.trailerKey).length, unchecked: approved.filter(t => !t.trailerCheckedAt).length },
      youtube: { approved: n('youtube', 'APPROVED'), pending: n('youtube', 'PENDING'), keySet: !!process.env.YT_API_KEY?.trim() },
      classics: { approved: n('archive', 'APPROVED'), pending: n('archive', 'PENDING') },
      channels: await this.prisma.watchChannel.count(),
    };
  }

  async siteData(brandIn: Partial<SiteBrand>): Promise<SiteData> {
    const brand: SiteBrand = {
      name: (brandIn.name || 'Watch Free').slice(0, 40),
      tagline: (brandIn.tagline || 'Movies & series you can watch free — legally').slice(0, 120),
      handle: (brandIn.handle || '').slice(0, 40),
      accent: brandIn.accent || '#FACC15',
      instagram: brandIn.instagram, youtube: brandIn.youtube, facebook: brandIn.facebook,
    };
    const langs = new Map((await this.world.tmdbLanguages().catch(() => [])).map(l => [l.code, l.name]));
    const rows = await this.prisma.worldTitle.findMany({ where: { status: 'APPROVED' }, orderBy: [{ rank: { sort: 'desc', nulls: 'last' } }] });
    const extras = await this.prisma.titleExtra.findMany({ where: { domain: 'world', refId: { in: rows.map(r => r.id) } }, select: { refId: true, oneLiner: true } });
    const oneLiner = new Map(extras.map(e => [e.refId, e.oneLiner]));
    const titles: SiteTitle[] = rows.map(t => {
      let providers: Array<{ name: string; type: string }> = [];
      try {
        providers = JSON.parse(t.providersIn || '[]');
      } catch {}
      return {
        id: t.id, kind: t.kind === 'tv' ? 'tv' : 'movie', title: t.title, year: t.year,
        language: (t.language && (t.language === 'cn' ? 'Cantonese' : langs.get(t.language))) || t.language || '',
        genres: (t.genres || '').split(',').map(g => g.trim()).filter(Boolean).slice(0, 3),
        overview: t.overview || '',
        poster: t.posterPath ? (t.posterPath.startsWith('/') ? `${TMDB_IMG}/w342${t.posterPath}` : t.posterPath) : null,
        backdrop: t.backdropPath ? `${TMDB_IMG}/w1280${t.backdropPath}` : null,
        rating: t.score != null && t.scoreSource ? `${t.scoreSource} ${t.score.toFixed(1)}` : null,
        length: t.kind === 'tv' ? (t.seasons ? `${t.seasons} season${t.seasons > 1 ? 's' : ''}` : '') : t.runtime ? `${Math.floor(t.runtime / 60)}h ${t.runtime % 60}m` : '',
        oneLiner: oneLiner.get(t.id) || null,
        free: providers.filter(p => p.type === 'free').map(p => p.name),
        stream: providers.filter(p => p.type === 'stream').map(p => p.name),
        watchUrl: `https://www.themoviedb.org/${t.kind === 'tv' ? 'tv' : 'movie'}/${t.tmdbId}/watch?locale=IN`,
        trailer: t.trailerKey,
      };
    });
    const vids = await this.prisma.freeVideo.findMany({ where: { status: 'APPROVED' }, orderBy: [{ views: { sort: 'desc', nulls: 'last' } }] });
    const v = (x: (typeof vids)[number]): SiteVideo => ({
      id: x.externalId, source: x.source === 'archive' ? 'archive' : 'youtube', title: x.title, channel: x.channel || '', year: x.year, minutes: x.minutes,
      thumb: x.thumbnail, description: x.description || '', language: x.language, embeddable: x.embeddable,
    });
    return {
      brand,
      generatedAt: new Date().toISOString(),
      free: titles.filter(t => t.free.length),
      trailers: titles.filter(t => t.trailer),
      youtube: vids.filter(x => x.source === 'youtube').map(v),
      classics: vids.filter(x => x.source === 'archive').map(v),
    };
  }

  async siteHtml(brand: Partial<SiteBrand>) {
    return renderSite(await this.siteData(brand));
  }

  /** index.html in a zip — drag the unzipped folder onto app.netlify.com/drop (free) or any static host. */
  async exportZip(brand: Partial<SiteBrand>) {
    const html = await this.siteHtml(brand);
    return Buffer.from(zipSync({ 'watch-free-site/index.html': strToU8(html), 'watch-free-site/robots.txt': strToU8('User-agent: *\nAllow: /\n') }));
  }
}
