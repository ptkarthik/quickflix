import { apiFetch } from './api';
import { OttRelease, PUBLISHABLE, addDays, fmtDate, fmtRange, languageLabel, todayIst, weekStart } from './ott';
import { CinemaRelease, cinemaBucket } from './cinema';
import { recentDateChange } from './cinemaCaptions';
import { WorldTitle, worldApi } from './world';
import { listPresets, presetFilter } from './worldPresets';
import { THEME_LIBRARY } from './themeLibrary';

/**
 * Ready-made posts: every day the app builds carousels for each desk from its titles
 * (OTT: this week's releases by language / platform / genre…; Cinema: this week, now showing, this month…;
 * World: every ready-made list + fresh daily mixes). You open one, change anything, and post it — the
 * Instagram confirm step stays. OTT & Cinema use only titles you approved; World posts are marked
 * "Needs your OK" until you accept them (that approves their titles).
 */
export type Desk = 'ott' | 'cinema' | 'world';
export interface Preview { id: string; title: string; poster?: string | null }
export interface Dropped { id: string; title: string; why: string; at: string }
export interface ReadyInput {
  templateId: string;
  periodKey: string;
  group: string;
  emoji?: string | null;
  kicker: string;
  heading: string;
  subheading: string;
  /** OTT: weekly | picks · Cinema: cinema-weekly | cinema-month | cinema-now | cinema-postponed | cinema-picks · World: world */
  style: string;
  itemIds: string[];
  preview: Preview[];
  notes?: Record<string, string> | null;
  themeBase?: string | null;
  cta?: string | null;
  numbered?: boolean;
  windowFrom?: string | null;
  windowTo?: string | null;
  status?: 'READY' | 'NEEDS_OK';
}
export interface ReadyPost extends ReadyInput {
  id: string;
  desk: Desk;
  status: 'READY' | 'NEEDS_OK';
  edited: boolean;
  dropped: Dropped[];
  notes: Record<string, string>;
  generatedOn: string;
  postedAt: string | null;
  permalink: string | null;
  createdAt: string;
  updatedAt: string;
}
export type ReadyStatus = ReadyPost['status'] | 'POSTED' | 'DISMISSED';

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string })?.message || `Request failed (${res.status})`);
  return body as T;
}
const send = (method: string, body: unknown) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const readyApi = {
  list: (desk: Desk) => apiFetch(`/ready/${desk}`).then(r => json<{ lastRefresh: string | null; posts: Array<Omit<ReadyPost, 'status'> & { status: ReadyStatus }> }>(r)),
  recentlyPosted: (desk: Desk) => apiFetch(`/ready/${desk}/recently-posted`).then(r => json<string[]>(r)),
  sync: (desk: Desk, body: { today: string; posts: ReadyInput[]; drops?: Array<{ id: string; itemIds: string[]; dropped: Dropped[] }>; keepPeriods?: string[] }) =>
    apiFetch(`/ready/${desk}/sync`, send('POST', body), 0).then(r => json<{ added: number; refreshed: number; kept: number; removed: number }>(r)),
  update: (id: string, patch: Partial<Omit<ReadyInput, 'status'>> & { status?: ReadyStatus; permalink?: string | null }) =>
    apiFetch(`/ready/post/${id}`, send('PATCH', patch), 0).then(r => json<ReadyPost & { status: ReadyStatus }>(r)),
  reset: (id: string) => apiFetch(`/ready/post/${id}/reset`, { method: 'POST' }, 0).then(r => json<ReadyPost>(r)),
};

// ───────────────────────── helpers ─────────────────────────

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** cover + 8 titles + end slide = 10, the most Instagram's posting API takes in one carousel */
export const MAX_TITLES = 8;
/** "Tamil", "Spanish"… (falls back to the browser's language names for codes the desk list doesn't have) */
function langName(code: string) {
  const l = languageLabel(code);
  if (l && l.length > 3) return l;
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || l || code; } catch { return l || code; }
}
/** A different look per post (stable for the same post), from the theme library. */
export function themeFor(key: string, prefer?: string[]): string {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pool = prefer?.length ? THEME_LIBRARY.filter(t => prefer.includes(t.category)) : THEME_LIBRARY;
  const list = pool.length ? pool : THEME_LIBRARY;
  return list[h % list.length].id;
}
/** Genre → look family, so a horror list doesn't get a festive look. */
const MOOD: Array<[RegExp, string[]]> = [
  [/horror|thriller|crime|mystery|war/i, ['Black & white', 'Cool', 'Cinematic']],
  [/romance|date|family|feel|comedy/i, ['Warm & desi', 'Festive', 'Vintage']],
  [/sci|fantasy|anime|animation|mind/i, ['Neon', 'Cool']],
  [/classic|90s|history|2000s|golden/i, ['Vintage', 'Black & white']],
];
const moodOf = (s: string) => MOOD.find(([re]) => re.test(s))?.[1];
const fri = (week: string) => addDays(week, 4);
const posterOf = (p: string | null | undefined) => p || null;

const GENRES: Array<{ id: string; label: string; re: RegExp; emoji: string }> = [
  { id: 'thriller', label: 'Thrillers', re: /thriller|crime|mystery/i, emoji: '🔪' },
  { id: 'action', label: 'Action', re: /action/i, emoji: '💥' },
  { id: 'comedy', label: 'Comedies', re: /comedy/i, emoji: '😂' },
  { id: 'romance', label: 'Romance', re: /romance/i, emoji: '💖' },
  { id: 'horror', label: 'Horror', re: /horror/i, emoji: '👻' },
  { id: 'family', label: 'Family Watches', re: /family|animation/i, emoji: '👨‍👩‍👧' },
  { id: 'drama', label: 'Dramas', re: /drama/i, emoji: '🎭' },
];
const byDate = <T extends { releaseDate: string | null }>(a: T, b: T) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999');
const inRange = (d: string | null, from: string, to: string) => !!d && d >= from && d <= to;

// ───────────────────────── OTT ─────────────────────────

/** Why an OTT title no longer fits a post (null = still fits). */
export function ottMisfit(r: OttRelease | undefined, p: Pick<ReadyInput, 'windowFrom' | 'windowTo'>): string | null {
  if (!r) return 'removed from the OTT desk';
  if (r.status === 'REJECTED') return 'rejected / reported as not coming';
  if (p.windowFrom && p.windowTo && !inRange(r.releaseDate, p.windowFrom, p.windowTo))
    return r.releaseDate ? `date moved to ${r.releaseDate}` : 'date no longer announced';
  return null;
}

/** Titles a ready-made post may use: yours (approved) + ones from trusted sources still waiting for your review. */
export const usable = (r: { status: string; trust: string }) => r.status === 'APPROVED' || (r.status === 'PENDING' && (PUBLISHABLE as string[]).includes(r.trust));

export function buildOtt(all: OttRelease[], today = todayIst()): ReadyInput[] {
  const approved = all.filter(usable);
  const week = weekStart(today);
  const end = addDays(week, 6);
  const out: ReadyInput[] = [];
  const add = (x: Omit<ReadyInput, 'preview' | 'itemIds' | 'periodKey'> & { items: OttRelease[]; periodKey?: string }, min = 2) => {
    const items = x.items.slice(0, MAX_TITLES);
    if (items.length < min) return;
    const { items: _drop, ...rest } = x;
    void _drop;
    out.push({ ...rest, periodKey: x.periodKey || week, itemIds: items.map(r => r.id), preview: items.map(r => ({ id: r.id, title: r.title, poster: posterOf(r.posterPath) })), themeBase: x.themeBase || themeFor(`ott:${x.templateId}:${week}`, moodOf(x.heading)), status: items.every(r => r.status === 'APPROVED') ? 'READY' : 'NEEDS_OK' });
  };
  const thisWeek = approved.filter(r => inRange(r.releaseDate, week, end)).sort(byDate);
  const range = fmtRange(week, end);
  const wk = { style: 'weekly', windowFrom: week, windowTo: end, numbered: false };

  add({ templateId: 'week-all', group: 'This week', emoji: '🍿', kicker: 'This week on OTT', heading: 'OTT Releases', subheading: range, items: thisWeek, ...wk }, 1);
  const langs = [...new Set(thisWeek.map(r => r.language).filter(Boolean))] as string[];
  for (const l of langs) {
    const items = thisWeek.filter(r => r.language === l);
    add({ templateId: `week-lang-${l}`, group: 'Languages', emoji: '🗣', kicker: 'This week on OTT', heading: `${langName(l)} OTT Releases`, subheading: range, items, ...wk });
  }
  const platforms = [...new Set(thisWeek.map(r => r.platform).filter(Boolean))] as string[];
  for (const pl of platforms) {
    const items = thisWeek.filter(r => r.platform === pl);
    add({ templateId: `week-platform-${pl.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, group: 'Platforms', emoji: '📺', kicker: 'This week', heading: `New on ${pl}`, subheading: range, items, ...wk });
  }
  add({ templateId: 'week-movies', group: 'This week', emoji: '🎬', kicker: 'This week on OTT', heading: 'New Movies on OTT', subheading: range, items: thisWeek.filter(r => r.contentType === 'movie'), ...wk });
  add({ templateId: 'week-series', group: 'This week', emoji: '📺', kicker: 'This week on OTT', heading: 'New Series to Binge', subheading: range, items: thisWeek.filter(r => r.contentType === 'tv'), ...wk });
  add({ templateId: 'weekend', group: 'This week', emoji: '🛋', kicker: 'Weekend watchlist', heading: 'OTT Releases This Weekend', subheading: fmtRange(fri(week), end), items: approved.filter(r => inRange(r.releaseDate, fri(week), end)).sort(byDate), style: 'weekly', windowFrom: fri(week), windowTo: end, numbered: false });
  add({ templateId: 'today', periodKey: today, group: 'Today', emoji: '🔔', kicker: 'Streaming from today', heading: 'New on OTT Today', subheading: fmtDate(today, { weekday: 'long', day: 'numeric', month: 'short' }), items: approved.filter(r => r.releaseDate === today), style: 'weekly', windowFrom: today, windowTo: today, numbered: false }, 1);
  add({ templateId: 'week-dubbed', group: 'This week', emoji: '🎙', kicker: 'Dubbed & streaming', heading: 'Dubbed Releases This Week', subheading: range, items: thisWeek.filter(r => !!r.dubLanguage), ...wk });
  add({ templateId: 'just-landed', group: 'Streaming now', emoji: '🆕', kicker: 'Just landed', heading: 'Just Landed on OTT', subheading: fmtRange(addDays(today, -7), addDays(today, -1)), items: approved.filter(r => inRange(r.releaseDate, addDays(today, -7), addDays(today, -1))).sort((a, b) => -byDate(a, b)), style: 'weekly', windowFrom: addDays(today, -7), windowTo: addDays(today, -1), numbered: false });
  const nextFrom = addDays(end, 1), nextTo = addDays(end, 7);
  add({ templateId: 'next-week', group: 'Coming up', emoji: '🗓', kicker: 'Coming next week', heading: 'Coming to OTT Next Week', subheading: fmtRange(nextFrom, nextTo), items: approved.filter(r => inRange(r.releaseDate, nextFrom, nextTo)).sort(byDate), style: 'weekly', windowFrom: nextFrom, windowTo: nextTo, numbered: false });

  // genre picks from what's streaming (last 45 days) + this week
  const streaming = approved.filter(r => inRange(r.releaseDate, addDays(today, -45), end));
  for (const g of GENRES) {
    const items = streaming.filter(r => g.re.test(r.genres || '')).sort((a, b) => (b.myRating ?? 0) - (a.myRating ?? 0) || -byDate(a, b));
    add({ templateId: `genre-${g.id}`, group: 'Genres', emoji: g.emoji, kicker: 'OTT picks', heading: `${g.label} to Stream Now`, subheading: plural(Math.min(items.length, MAX_TITLES), 'title') + ' worth your time', items, style: 'picks', numbered: true }, 3);
  }
  // per language, streaming now (top languages only)
  const langCount = new Map<string, number>();
  streaming.forEach(r => r.language && langCount.set(r.language, (langCount.get(r.language) || 0) + 1));
  for (const [l] of [...langCount].sort((a, b) => b[1] - a[1]).slice(0, 4)) {
    const items = streaming.filter(r => r.language === l && (r.releaseDate || '') <= today).sort((a, b) => (b.myRating ?? 0) - (a.myRating ?? 0) || -byDate(a, b));
    add({ templateId: `now-lang-${l}`, group: 'Streaming now', emoji: '⭐', kicker: 'OTT picks', heading: `Best New ${langName(l)} Titles on OTT`, subheading: plural(Math.min(items.length, MAX_TITLES), 'title') + ' worth your time', items, style: 'picks', numbered: true }, 3);
  }
  const rated = approved.filter(r => (r.myRating ?? 0) >= 3.5).sort((a, b) => (b.myRating ?? 0) - (a.myRating ?? 0));
  add({ templateId: 'my-rated', group: 'My picks', emoji: '🏆', kicker: 'My verdicts', heading: 'My Top-Rated OTT Picks', subheading: plural(Math.min(rated.length, MAX_TITLES), 'title') + ' I loved', items: rated, style: 'picks', numbered: true }, 2);
  return out;
}

// ───────────────────────── Cinema ─────────────────────────

export function cinemaMisfit(r: CinemaRelease | undefined, p: Pick<ReadyInput, 'windowFrom' | 'windowTo' | 'style'>, today = todayIst()): string | null {
  if (!r) return 'removed from the Cinema desk';
  if (r.status === 'REJECTED') return 'rejected / reported as not releasing';
  if (p.style === 'cinema-now' && cinemaBucket(r, today) !== 'now') return cinemaBucket(r, today) === 'ott' ? 'left cinemas (now on OTT)' : 'not in cinemas now';
  if (p.windowFrom && p.windowTo && !inRange(r.releaseDate, p.windowFrom, p.windowTo)) return r.releaseDate ? `date moved to ${r.releaseDate}` : 'date no longer announced';
  return null;
}

export function buildCinema(all: CinemaRelease[], today = todayIst()): ReadyInput[] {
  const approved = all.filter(usable);
  const week = weekStart(today);
  const end = addDays(week, 6);
  const out: ReadyInput[] = [];
  const add = (x: Omit<ReadyInput, 'preview' | 'itemIds' | 'periodKey'> & { items: CinemaRelease[]; periodKey?: string }, min = 2) => {
    const items = x.items.slice(0, MAX_TITLES);
    if (items.length < min) return;
    const { items: _drop, ...rest } = x;
    void _drop;
    out.push({ ...rest, periodKey: x.periodKey || week, itemIds: items.map(r => r.id), preview: items.map(r => ({ id: r.id, title: r.title, poster: posterOf(r.posterPath) })), themeBase: x.themeBase || themeFor(`cinema:${x.templateId}:${week}`, moodOf(x.heading)), status: items.every(r => r.status === 'APPROVED') ? 'READY' : 'NEEDS_OK' });
  };
  const range = fmtRange(week, end);
  const thisWeek = approved.filter(r => inRange(r.releaseDate, week, end)).sort(byDate);
  const wk = { style: 'cinema-weekly', windowFrom: week, windowTo: end, numbered: false, cta: 'book' };
  add({ templateId: 'week-all', group: 'This week', emoji: '🎟', kicker: 'This week in cinemas', heading: 'New in Cinemas', subheading: range, items: thisWeek, ...wk }, 1);
  for (const l of [...new Set(thisWeek.map(r => r.language).filter(Boolean))] as string[])
    add({ templateId: `week-lang-${l}`, group: 'Languages', emoji: '🗣', kicker: 'This week in cinemas', heading: `New ${langName(l)} Films in Cinemas`, subheading: range, items: thisWeek.filter(r => r.language === l), ...wk });
  add({ templateId: 'weekend', group: 'This week', emoji: '🍿', kicker: 'Weekend in cinemas', heading: 'Releasing This Weekend', subheading: fmtRange(fri(week), end), items: approved.filter(r => inRange(r.releaseDate, fri(week), end)).sort(byDate), style: 'cinema-weekly', windowFrom: fri(week), windowTo: end, numbered: false, cta: 'fdfs' });
  const now = approved.filter(r => cinemaBucket(r, today) === 'now').sort((a, b) => -byDate(a, b));
  add({ templateId: 'now', group: 'Now showing', emoji: '🎬', kicker: 'In theatres now', heading: 'Now Showing', subheading: plural(Math.min(now.length, MAX_TITLES), 'film') + ' playing near you', items: now, style: 'cinema-now', numbered: false, cta: 'watch' });
  for (const l of [...new Set(now.map(r => r.language).filter(Boolean))] as string[])
    add({ templateId: `now-lang-${l}`, group: 'Now showing', emoji: '🗣', kicker: 'In theatres now', heading: `${langName(l)} Films in Cinemas Now`, subheading: plural(Math.min(now.filter(r => r.language === l).length, MAX_TITLES), 'film') + ' playing near you', items: now.filter(r => r.language === l), style: 'cinema-now', numbered: false, cta: 'watch' });
  const month = today.slice(0, 7);
  const monthEnd = addDays(`${month}-28`, 4).slice(0, 7) === month ? addDays(`${month}-28`, 3) : `${month}-31`;
  const thisMonth = approved.filter(r => (r.releaseDate || '').startsWith(month) && (r.releaseDate || '') >= today).sort(byDate);
  add({ templateId: `month-${month}`, group: 'Coming up', emoji: '🗓', kicker: 'Coming to cinemas', heading: 'This Month in Cinemas', subheading: plural(Math.min(thisMonth.length, MAX_TITLES), 'film') + ' to watch in theatres', items: thisMonth, style: 'cinema-month', windowFrom: today, windowTo: monthEnd, numbered: false, cta: 'excited' });
  const nextFrom = addDays(end, 1), nextTo = addDays(end, 7);
  add({ templateId: 'next-week', group: 'Coming up', emoji: '⏭', kicker: 'Next week in cinemas', heading: 'Coming to Cinemas Next Week', subheading: fmtRange(nextFrom, nextTo), items: approved.filter(r => inRange(r.releaseDate, nextFrom, nextTo)).sort(byDate), style: 'cinema-weekly', windowFrom: nextFrom, windowTo: nextTo, numbered: false, cta: 'excited' });
  const moved = approved.filter(r => recentDateChange(r, today));
  add({ templateId: 'postponed', group: 'Date changes', emoji: '📢', kicker: 'Release date update', heading: 'Date Changes', subheading: plural(Math.min(moved.length, MAX_TITLES), 'film') + ' moved', items: moved, style: 'cinema-postponed', numbered: false, cta: 'excited' }, 1);
  const awaited = approved.filter(r => inRange(r.releaseDate, addDays(today, 1), addDays(today, 60))).sort(byDate);
  add({ templateId: 'most-awaited', group: 'Coming up', emoji: '🔥', kicker: 'Most awaited', heading: 'Most Awaited Films', subheading: 'in the next 2 months', items: awaited, style: 'cinema-picks', numbered: true, cta: 'excited' }, 3);
  const pool = [...now, ...awaited];
  for (const g of GENRES) {
    const items = pool.filter(r => g.re.test(r.genres || ''));
    add({ templateId: `genre-${g.id}`, group: 'Genres', emoji: g.emoji, kicker: 'Cinema picks', heading: `${g.label} in Cinemas`, subheading: plural(Math.min(items.length, MAX_TITLES), 'film') + ' worth the ticket', items, style: 'cinema-picks', numbered: true, cta: 'watch' }, 3);
  }
  return out;
}

// ───────────────────────── World ─────────────────────────

export const worldMisfit = (t: WorldTitle | undefined) => (!t ? 'no longer in the database' : t.status === 'REJECTED' ? 'you rejected it' : null);

const FRESH_LANGS: Array<[string, string]> = [['ko', 'Korean'], ['ja', 'Japanese'], ['es', 'Spanish'], ['fr', 'French'], ['ta', 'Tamil'], ['ml', 'Malayalam'], ['te', 'Telugu'], ['hi', 'Hindi'], ['it', 'Italian'], ['tr', 'Turkish']];
const FRESH_GENRES: Array<[string, string, string]> = [['Thriller|Crime', 'Thrillers', '🔪'], ['Romance', 'Romantic Movies', '💖'], ['Comedy', 'Comedies', '😂'], ['Action', 'Action Movies', '💥'], ['Horror', 'Horror Movies', '👻'], ['Drama', 'Dramas', '🎭'], ['Mystery', 'Mysteries', '🔍']];

/**
 * World: every ready-made list (kept for the week, refreshed daily) + ~10 fresh mixes a day (language × genre,
 * "more like this" second pages). Titles you posted in the last 30 days are skipped, and a title appears in at most
 * 3 of today's fresh posts so they don't all repeat.
 */
export async function buildWorld(today = todayIst(), recentlyPosted: string[] = [], fresh = 10): Promise<ReadyInput[]> {
  const week = weekStart(today);
  const avoid = new Set(recentlyPosted);
  const presets = listPresets(Number(today.slice(0, 4)));
  type Job = { templateId: string; periodKey: string; group: string; emoji: string; kicker: string; heading: string; n: number; filter: Parameters<typeof worldApi.list>[0]; skip?: number };
  const jobs: Job[] = presets.map(p => ({
    templateId: `list-${p.id}`, periodKey: week, group: p.group, emoji: p.emoji,
    kicker: p.kind === 'tv' ? 'Series picks' : 'Movie picks', heading: p.heading, n: p.n, filter: presetFilter(p),
  }));
  // fresh daily mixes, rotating by day
  const day = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86400000);
  const combos = FRESH_LANGS.flatMap(([l, ln]) => FRESH_GENRES.map(([g, gl, e]) => ({ l, ln, g, gl, e })));
  for (let i = 0; i < Math.ceil(fresh * 0.7); i++) {
    const c = combos[(day * 7 + i * 11) % combos.length];
    jobs.push({ templateId: `fresh-${c.l}-${c.g.toLowerCase().replace(/[^a-z]+/g, '-')}`, periodKey: today, group: 'Fresh today', emoji: c.e, kicker: `${c.ln} cinema`, heading: `{n} ${c.ln} ${c.gl} You Should Watch`, n: 5, filter: { kind: 'movie', language: c.l, genre: c.g, minVotes: ['ta', 'ml', 'te', 'hi'].includes(c.l) ? '20' : '100', minRating: '6.5', sort: 'score' } });
  }
  for (let i = 0; i < Math.floor(fresh * 0.3); i++) {
    const p = presets[(day * 5 + i * 13) % presets.length];
    jobs.push({ templateId: `more-${p.id}`, periodKey: today, group: 'Fresh today', emoji: p.emoji, kicker: 'More picks', heading: `${p.heading.replace('Top {n}', '{n} More').replace(/^\{n\}/, '{n} More')}`, n: p.n, filter: presetFilter(p), skip: p.n });
  }

  const usedToday = new Map<string, number>();
  const out: ReadyInput[] = [];
  const run = async (j: Job) => {
    const res = await worldApi.list({ ...j.filter, skip: j.skip || 0, take: j.n + 20 }).catch(() => null);
    if (!res) return;
    const fresh = j.periodKey === today;
    const items = res.items.filter(t => t.status !== 'REJECTED' && !avoid.has(t.id) && (!fresh || (usedToday.get(t.id) || 0) < 3)).slice(0, Math.min(j.n, MAX_TITLES));
    if (items.length < Math.min(3, j.n, MAX_TITLES)) return;
    if (fresh) items.forEach(t => usedToday.set(t.id, (usedToday.get(t.id) || 0) + 1));
    const kindWord = items.every(t => t.kind === 'tv') ? 'series' : items.length === 1 ? 'movie' : 'movies';
    out.push({
      templateId: j.templateId, periodKey: j.periodKey, group: j.group, emoji: j.emoji, kicker: j.kicker,
      heading: j.heading.replace('{n}', String(items.length)), subheading: `${items.length} ${kindWord} worth your time`,
      style: 'world', itemIds: items.map(t => t.id), preview: items.map(t => ({ id: t.id, title: t.title, poster: posterOf(t.posterPath) })),
      themeBase: themeFor(`world:${j.templateId}:${j.periodKey}`, moodOf(`${j.heading} ${j.group}`)), cta: 'watched', numbered: true,
      status: items.every(t => t.status === 'APPROVED') ? 'READY' : 'NEEDS_OK',
    });
  };
  // a few at a time — gentle on the backend
  for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map(run));
  return out;
}

/** Periods still current (older untouched posts are cleared). */
export const keepPeriods = (desk: Desk, today = todayIst()) =>
  desk === 'world' ? [weekStart(today), today, addDays(today, -1), addDays(today, -2)] : [weekStart(today), today];
