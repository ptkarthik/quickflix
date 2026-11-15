import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { LinkCheck, WhereResult, checkSourceLink, parseWhere, whereStatus } from './where.util';

const DIR = path.join(process.cwd(), 'data', 'where');
const FRESH_MS = 12 * 3600000;

/** Where to watch any title on any desk — re-checked live (cached 12h), legal sources only. */
@Injectable()
export class WhereService {
  private readonly logger = new Logger(WhereService.name);
  fetchImpl: typeof fetch = (...a) => fetch(...a);

  constructor(private readonly prisma: PrismaService) {}

  private file(kind: string, tmdbId: number) {
    return path.join(DIR, `${kind}-${tmdbId}.json`);
  }

  private read(kind: string, tmdbId: number): WhereResult | null {
    try {
      return JSON.parse(fs.readFileSync(this.file(kind, tmdbId), 'utf8'));
    } catch {
      return null;
    }
  }

  async forTitle(kind: 'movie' | 'tv', tmdbId: number | null, opts: { force?: boolean; worldId?: string | null } = {}): Promise<WhereResult> {
    const now = new Date().toISOString();
    const empty = (note: string): WhereResult => ({ region: 'IN', link: null, stream: [], free: [], rent: [], buy: [], official: [], elsewhere: [], status: 'none', checkedAt: now, note });
    if (!tmdbId) return empty('Not linked to TMDB yet — link it (Find poster) so we can check where it’s streaming.');
    const cached = this.read(kind, tmdbId);
    if (!opts.force && cached && Date.now() - new Date(cached.checkedAt).getTime() < FRESH_MS) return cached;

    const key = process.env.TMDB_API_KEY;
    if (!key) return cached || empty('TMDB_API_KEY is missing in backend/.env');
    let resp: any;
    try {
      const res = await this.fetchImpl(`https://api.themoviedb.org/3/${kind}/${tmdbId}/watch/providers?api_key=${key}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
      resp = await res.json();
    } catch (e: any) {
      // offline: show the last check (with its date) rather than nothing
      if (cached) return { ...cached, note: `Couldn’t re-check just now (${e.message}) — showing the check from ${cached.checkedAt.slice(0, 10)}.` };
      return empty(`Couldn’t check where it’s streaming (${e.message}). Try again.`);
    }

    const world = opts.worldId
      ? await this.prisma.worldTitle.findUnique({ where: { id: opts.worldId }, select: { id: true } })
      : await this.prisma.worldTitle.findUnique({ where: { kind_tmdbId: { kind, tmdbId } }, select: { id: true } }).catch(() => null);
    const vids = world
      ? await this.prisma.freeVideo.findMany({ where: { worldTitleId: world.id, status: 'APPROVED' }, select: { source: true, externalId: true, title: true, channel: true } })
      : [];
    const official = vids.map(v => ({
      source: (v.source === 'archive' ? 'archive' : 'youtube') as 'youtube' | 'archive',
      title: v.title,
      channel: v.channel,
      url: v.source === 'archive' ? `https://archive.org/details/${encodeURIComponent(v.externalId)}` : `https://www.youtube.com/watch?v=${encodeURIComponent(v.externalId)}`,
    }));

    const parsed = parseWhere(resp, 'IN');
    const out: WhereResult = { ...parsed, official, status: 'none', checkedAt: now };
    out.status = whereStatus(out);

    try {
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(this.file(kind, tmdbId), JSON.stringify(out));
    } catch (e: any) {
      this.logger.warn(`where cache write failed: ${e.message}`);
    }
    // keep the World database's "where to watch" in step (used by filters & bulk lists)
    if (world) {
      const providersIn = JSON.stringify([
        ...out.stream.map(s => ({ name: s.name, type: 'stream' })),
        ...out.free.map(s => ({ name: s.name, type: 'free' })),
        ...out.rent.map(s => ({ name: s.name, type: 'rent' })),
        ...out.buy.map(s => ({ name: s.name, type: 'buy' })),
      ]);
      await this.prisma.worldTitle.update({ where: { id: world.id }, data: { providersIn } }).catch(() => null);
    }
    return out;
  }

  async checkLink(url: string): Promise<LinkCheck> {
    const channels = await this.prisma.watchChannel.findMany({ where: { enabled: true }, select: { channelId: true, handle: true } });
    const ids = channels.flatMap(c => [c.channelId, c.handle].filter((x): x is string => !!x));
    const r = checkSourceLink(url || '', ids);
    if (r.verdict === 'check-channel') {
      // a watch?v= link doesn't contain the channel — see if it's an approved official upload
      const v = /[?&]v=([\w-]{6,})|youtu\.be\/([\w-]{6,})/.exec(url);
      const id = v?.[1] || v?.[2];
      if (id) {
        const fv = await this.prisma.freeVideo.findUnique({ where: { source_externalId: { source: 'youtube', externalId: id } } });
        if (fv?.status === 'APPROVED') return { ok: true, source: `YouTube · ${fv.channel || 'official channel'}`, verdict: 'official-channel', message: 'An official upload you approved — fine to share.' };
      }
    }
    return r;
  }
}
