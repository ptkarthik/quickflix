import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const DESKS = ['ott', 'cinema', 'world'] as const;
export type Desk = (typeof DESKS)[number];
const STATUSES = ['READY', 'NEEDS_OK', 'POSTED', 'DISMISSED'];

/** One ready-made post as the generator (in the app) sends it. */
export interface ReadyInput {
  templateId: string;
  periodKey: string;
  group: string;
  emoji?: string | null;
  kicker: string;
  heading: string;
  subheading: string;
  style: string;
  itemIds: string[];
  preview?: Array<{ id: string; title: string; poster?: string | null }>;
  notes?: Record<string, string> | null;
  themeBase?: string | null;
  cta?: string | null;
  numbered?: boolean;
  windowFrom?: string | null;
  windowTo?: string | null;
  status?: string;
}
export interface Dropped { id: string; title: string; why: string; at: string }

const parse = <T>(s: string | null | undefined, fb: T): T => {
  try { return s ? (JSON.parse(s) as T) : fb; } catch { return fb; }
};
const out = (r: any) => ({ ...r, itemIds: parse<string[]>(r.itemIds, []), preview: parse<Array<{ id: string; title: string; poster?: string | null }>>(r.preview, []), notes: parse<Record<string, string>>(r.notes, {}), dropped: parse<Dropped[]>(r.dropped, []) });

/**
 * Storage for ready-made posts. The app builds them (it has the same rules as the post editors) and syncs them here once a day:
 * new ones are added, untouched ones refreshed, ones you edited keep your choices (only titles that stopped qualifying are
 * dropped, with the reason), ones you deleted stay deleted for that week/day, posted ones are never changed.
 */
@Injectable()
export class ReadyService {
  constructor(private readonly prisma: PrismaService) {}

  private desk(d: string): Desk {
    if (!(DESKS as readonly string[]).includes(d)) throw new BadRequestException('desk must be ott, cinema or world');
    return d as Desk;
  }

  async list(desk: string, includeDismissed = false) {
    const rows = await this.prisma.readyPost.findMany({
      where: { desk: this.desk(desk), ...(includeDismissed ? {} : { status: { not: 'DISMISSED' } }) },
      orderBy: [{ createdAt: 'asc' }],
    });
    const last = rows.reduce((m, r) => (r.generatedOn > m ? r.generatedOn : m), '');
    return { lastRefresh: last || null, posts: rows.map(out) };
  }

  /**
   * One daily refresh for a desk. `posts` = everything the generator made today;
   * `drops` = titles that stopped qualifying in posts you edited (the app checks them);
   * `expire` = periods that are over (untouched posts from them are removed).
   */
  async sync(deskIn: string, body: { today: string; posts: ReadyInput[]; drops?: Array<{ id: string; itemIds: string[]; dropped: Dropped[] }>; keepPeriods?: string[] }) {
    const desk = this.desk(deskIn);
    const today = String(body.today || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new BadRequestException('today must be YYYY-MM-DD');
    const existing = await this.prisma.readyPost.findMany({ where: { desk } });
    const byKey = new Map(existing.map(r => [`${r.templateId}|${r.periodKey}`, r]));
    let added = 0, refreshed = 0, kept = 0, removed = 0;

    for (const p of (body.posts || []).slice(0, 400)) {
      if (!p.templateId || !p.periodKey || !Array.isArray(p.itemIds)) continue;
      const data = {
        group: p.group, emoji: p.emoji ?? null, kicker: p.kicker, heading: p.heading, subheading: p.subheading, style: p.style,
        itemIds: JSON.stringify(p.itemIds.slice(0, 20)), preview: JSON.stringify((p.preview || []).slice(0, 20)), notes: p.notes ? JSON.stringify(p.notes) : null, themeBase: p.themeBase ?? null,
        cta: p.cta ?? null, numbered: p.numbered ?? true, windowFrom: p.windowFrom ?? null, windowTo: p.windowTo ?? null,
        status: STATUSES.includes(p.status || '') ? p.status! : 'READY', generatedOn: today,
      };
      const old = byKey.get(`${p.templateId}|${p.periodKey}`);
      if (!old) {
        await this.prisma.readyPost.create({ data: { desk, templateId: p.templateId, periodKey: p.periodKey, ...data } });
        added++;
      } else if (old.edited || old.status === 'POSTED' || old.status === 'DISMISSED') {
        kept++;
      } else {
        // untouched → today's version (keeps an OK you already gave unless the titles changed)
        const sameTitles = old.itemIds === data.itemIds;
        await this.prisma.readyPost.update({ where: { id: old.id }, data: { ...data, status: sameTitles && old.status === 'READY' ? 'READY' : data.status } });
        refreshed++;
      }
    }
    for (const d of body.drops || []) {
      const old = existing.find(r => r.id === d.id);
      if (!old || old.status === 'POSTED') continue;
      const prev = parse<Dropped[]>(old.dropped, []);
      await this.prisma.readyPost.update({ where: { id: old.id }, data: { itemIds: JSON.stringify(d.itemIds), preview: JSON.stringify(parse<Array<{ id: string }>>(old.preview, []).filter(x => d.itemIds.includes(x.id))), dropped: JSON.stringify([...prev, ...d.dropped].slice(-30)), generatedOn: today } });
    }
    // periods that are over: untouched ones go; edited / posted ones stay (you can delete them)
    if (body.keepPeriods?.length) {
      const keep = new Set(body.keepPeriods);
      const r = await this.prisma.readyPost.deleteMany({ where: { desk, periodKey: { notIn: [...keep] }, edited: false, status: { in: ['READY', 'NEEDS_OK', 'DISMISSED'] } } });
      removed = r.count;
    }
    return { added, refreshed, kept, removed };
  }

  async update(id: string, patch: Partial<ReadyInput> & { status?: string; permalink?: string | null }) {
    const old = await this.prisma.readyPost.findUnique({ where: { id } });
    if (!old) throw new NotFoundException('Ready-made post not found');
    const data: Record<string, unknown> = {};
    for (const k of ['kicker', 'heading', 'subheading', 'themeBase', 'cta', 'emoji'] as const) if (patch[k] !== undefined) data[k] = patch[k];
    if (patch.numbered !== undefined) data.numbered = !!patch.numbered;
    if (patch.itemIds) data.itemIds = JSON.stringify(patch.itemIds.slice(0, 20));
    if (patch.preview) data.preview = JSON.stringify(patch.preview.slice(0, 20));
    if (patch.notes !== undefined) data.notes = patch.notes ? JSON.stringify(patch.notes) : null;
    const contentChanged = Object.keys(data).length > 0;
    if (contentChanged) data.edited = true;
    if (patch.status) {
      if (!STATUSES.includes(patch.status)) throw new BadRequestException('bad status');
      data.status = patch.status;
      if (patch.status === 'POSTED') { data.postedAt = new Date(); data.permalink = patch.permalink ?? null; }
    }
    return out(await this.prisma.readyPost.update({ where: { id }, data }));
  }

  /** Back to the app's version on the next refresh (forget your edits). */
  async reset(id: string) {
    const old = await this.prisma.readyPost.findUnique({ where: { id } });
    if (!old) throw new NotFoundException('Ready-made post not found');
    return out(await this.prisma.readyPost.update({ where: { id }, data: { edited: false, dropped: null, generatedOn: '' } }));
  }

  /** Titles used in posts you published lately (fresh posts avoid repeating them). */
  async recentlyPosted(deskIn: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const rows = await this.prisma.readyPost.findMany({ where: { desk: this.desk(deskIn), status: 'POSTED', postedAt: { gte: since } }, select: { itemIds: true } });
    return [...new Set(rows.flatMap(r => parse<string[]>(r.itemIds, [])))];
  }
}
