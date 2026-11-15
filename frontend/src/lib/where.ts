import { apiFetch } from './api';
import type { PostItem } from './postDomain';

/** Where to watch in India — legal sources only (TMDB / JustWatch + official free uploads you approved). */
export interface WhereService { name: string; logo: string | null }
export interface WhereResult {
  region: string;
  link: string | null;
  stream: WhereService[];
  free: WhereService[];
  rent: WhereService[];
  buy: WhereService[];
  official: Array<{ source: 'youtube' | 'archive'; title: string; channel: string | null; url: string }>;
  elsewhere: Array<{ country: string; services: string[] }>;
  status: 'stream' | 'free' | 'rent' | 'none';
  checkedAt: string;
  note?: string;
}
export interface LinkCheck { ok: boolean; source: string | null; verdict: 'licensed' | 'official-channel' | 'check-channel' | 'unknown' | 'invalid'; message: string }

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string })?.message || `Request failed (${res.status})`);
  return body as T;
}

export const whereApi = {
  get: (domain: string, id: string, force = false) => apiFetch(`/extras/${domain}/${id}/where${force ? '?force=true' : ''}`, undefined, 0).then(r => json<WhereResult>(r)),
  checkLink: (url: string) =>
    apiFetch('/extras/where/check-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) }).then(r => json<LinkCheck>(r)),
};

const names = (l: WhereService[], n = 3) => l.slice(0, n).map(s => s.name);
const COUNTRY: Record<string, string> = { US: 'the US', GB: 'the UK', CA: 'Canada', AU: 'Australia', SG: 'Singapore', AE: 'the UAE' };
const isFuture = (d?: string | null) => !!d && d.slice(0, 10) > new Date().toISOString().slice(0, 10);

/** What we know without the live check (an OTT premiere date, "in cinemas") — used when the check finds nothing yet. */
function deskFallback(r: PostItem): string | null {
  if (r.cinema) return r.releaseDate && isFuture(r.releaseDate) ? `In cinemas from ${r.releaseDate.slice(0, 10)}` : 'In cinemas';
  if (r.platform) return isFuture(r.releaseDate) ? `Coming to ${r.platform}${r.releaseDate ? ` on ${r.releaseDate.slice(0, 10)}` : ''}` : r.platform;
  return null;
}

/** One short phrase for a list ("Netflix, Prime Video" / "Free on MX Player" / "Rent: Apple TV" / "Not streaming in India yet"). */
export function whereShort(w: WhereResult | null | undefined, r: PostItem): string {
  if (w?.stream.length) return names(w.stream, 2).join(', ');
  if (w?.free.length || w?.official.length) return `Free: ${[...names(w.free, 2), ...(w.official.length ? [w.official[0].source === 'archive' ? 'Internet Archive' : 'YouTube (official)'] : [])].slice(0, 2).join(', ')}`;
  const fb = deskFallback(r);
  if (fb) return fb;
  if (w?.rent.length || w?.buy.length) return `Rent/Buy: ${names([...w.rent, ...w.buy], 2).join(', ')}`;
  return w ? 'Not streaming in India right now' : '';
}

export interface WhereOpts { download?: boolean; elsewhere?: boolean }

/** Caption lines for one title. */
export function whereLines(w: WhereResult | null | undefined, r: PostItem, o: WhereOpts = {}): string[] {
  if (!w) return [];
  const out: string[] = [];
  if (w.stream.length) out.push(`📺 Stream in India: ${names(w.stream, 4).join(', ')}`);
  const free = [...names(w.free, 3), ...w.official.slice(0, 1).map(v => (v.source === 'archive' ? 'Internet Archive (public domain)' : `YouTube — ${v.channel || 'official channel'}`))];
  if (free.length) out.push(`🆓 Free & legal: ${free.join(', ')}`);
  if (w.rent.length || w.buy.length) out.push(`💳 Rent / buy: ${names([...w.rent, ...w.buy], 3).join(', ')}`);
  if (!out.length) {
    const fb = deskFallback(r);
    if (fb) out.push(`📺 ${fb}`);
    else {
      const away = o.elsewhere && w.elsewhere[0] ? ` (streaming on ${w.elsewhere[0].services[0]} in ${COUNTRY[w.elsewhere[0].country] || w.elsewhere[0].country})` : '';
      out.push(`📺 Not streaming in India right now${away}`);
    }
  }
  if (o.download && (w.stream.length || w.rent.length || w.buy.length)) out.push('⬇️ Download in the app to watch offline');
  return out;
}

/** Text for the "Where to watch" slide. */
export function whereSlideText(w: WhereResult | null | undefined, r: PostItem): string {
  if (!w) return '';
  const blocks: string[] = [];
  if (w.stream.length) blocks.push(`STREAM\n${names(w.stream, 4).join(' • ')}`);
  const free = [...names(w.free, 3), ...w.official.slice(0, 1).map(v => (v.source === 'archive' ? 'Internet Archive' : 'YouTube (official)'))];
  if (free.length) blocks.push(`FREE\n${free.join(' • ')}`);
  if (w.rent.length || w.buy.length) blocks.push(`RENT / BUY\n${names([...w.rent, ...w.buy], 3).join(' • ')}`);
  if (!blocks.length) blocks.push(deskFallback(r) || 'Not streaming in India right now');
  return blocks.join('\n\n');
}

/** Puts the where-to-watch lines into a single-title caption (replacing the template's own "Watch in India" line). */
export function captionWithWhere(caption: string, lines: string[]): string {
  if (!lines.length) return caption;
  const rows = caption.split('\n').filter(l => !l.startsWith('📺 Watch in India'));
  const at = rows.findIndex(l => l.startsWith('🎬'));
  if (at < 0) return [...rows, '', ...lines].join('\n');
  let i = at + 1;
  while (i < rows.length && /^(⭐|💬|📺|🍿)/.test(rows[i])) i++;
  rows.splice(i, 0, ...lines);
  return rows.join('\n');
}

/** A "Where to watch" block for a list caption (before "Follow …" / hashtags). */
export function captionWithWhereList(caption: string, items: PostItem[], map: Record<string, WhereResult | undefined>, numbered: boolean): string {
  const rows = items.map(r => ({ r, s: whereShort(map[r.id], r) })).filter(x => x.s);
  if (!rows.length) return caption;
  const block = ['📺 Where to watch (India)', ...rows.map((x, i) => `${numbered ? `${i + 1}.` : '•'} ${x.r.title} — ${x.s}`)];
  const lines = caption.split('\n');
  let at = lines.findIndex(l => /^\s*Follow /.test(l) || l.startsWith('#'));
  if (at < 0) at = lines.length;
  while (at > 0 && lines[at - 1].trim() === '') at--;
  lines.splice(at, 0, '', ...block);
  return lines.join('\n');
}

export const checkedLabel = (iso?: string) => {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 2 ? 'checked just now' : mins < 60 ? `checked ${mins} min ago` : mins < 1440 ? `checked ${Math.round(mins / 60)} h ago` : `checked ${iso.slice(0, 10)}`;
};
