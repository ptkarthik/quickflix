import { AiCaptionCopy, addDays, fmtDate, fmtRange, starString, splitTags } from './ott';
import { CinemaRelease, cinemaLanguages } from './cinema';
import type { PostItem } from './postDomain';

/**
 * Cinema caption templates (no AI needed). Every fact — title, date, languages, certificate, runtime,
 * postponement — comes from the approved film data. AI lines (hook/blurb/teasers/closing) are optional extras.
 */

export type CinemaPostKind = 'weekly' | 'month' | 'now' | 'postponed' | 'picks';

/** "Call to action" endings you can pick per post. */
export const CINEMA_CTAS = [
  { id: 'book', label: '🎟 Book your tickets', line: 'Book your tickets now 🎟', single: 'Book your tickets now 🎟', outro: 'Book your tickets!' },
  { id: 'watch', label: '🍿 What are you gonna watch?', line: 'What are you gonna watch first? Tell us below 👇', single: 'Are you gonna watch this one? Tell us below 👇', outro: 'What are you gonna watch?' },
  { id: 'fdfs', label: '🔥 FDFS plans?', line: 'FDFS plans? Tag your movie gang 🔥', single: 'FDFS plans? Tag your movie gang 🔥', outro: 'FDFS plans? Tag your gang!' },
  { id: 'excited', label: '🤩 Most excited for?', line: 'Which one are you most excited for? Comment below 👇', single: 'How excited are you for this one? Comment below 👇', outro: 'Which one are you most excited for?' },
  { id: 'weekend', label: '📅 Weekend plan', line: 'Weekend movie plan sorted? Save this post 📌', single: 'Weekend movie plan sorted? Save this post 📌', outro: "What's your weekend movie?" },
  { id: 'review', label: '⭐ Watched it? Review', line: 'Watched it already? Drop your review below ⭐', single: 'Watched it already? Drop your review below ⭐', outro: 'Watched it? Drop your review!' },
  { id: 'none', label: 'No call to action', line: '', single: '', outro: 'Thanks for watching!' },
] as const;
export type CinemaCtaId = (typeof CINEMA_CTAS)[number]['id'];
export const ctaOf = (id: string) => CINEMA_CTAS.find(c => c.id === id) || CINEMA_CTAS[0];

const LANG_TAGS: Record<string, string[]> = {
  ta: ['#TamilCinema', '#Kollywood'],
  te: ['#TeluguCinema', '#Tollywood'],
  ml: ['#MalayalamCinema', '#Mollywood'],
  kn: ['#KannadaCinema', '#Sandalwood'],
  hi: ['#Bollywood', '#HindiMovies'],
  mr: ['#MarathiCinema'],
  bn: ['#BengaliCinema'],
  pa: ['#PunjabiCinema'],
  en: ['#Hollywood'],
  ko: ['#KoreanCinema'],
  ja: ['#Anime'],
};

function cinemaTags(items: PostItem[], extra: string[]) {
  const tags = new Set<string>(extra);
  for (const r of items) {
    const c = r.cinema;
    const langs = [r.language, ...(c?.alsoIn || '').split(',')].filter(Boolean) as string[];
    for (const l of langs.slice(0, 2)) for (const t of LANG_TAGS[l] || []) tags.add(t);
  }
  return Array.from(tags).slice(0, 25).join(' ');
}

const tidy = (lines: Array<string | null>) =>
  lines
    .filter((l): l is string => l !== null)
    .filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n')
    .trim();

const dayDate = (d?: string | null) => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' });

/** A date change the watcher recorded in the last `days` days (postponed / preponed / new date pending). */
export function recentDateChange(c: CinemaRelease | undefined, today: string, days = 30): null | { from: string; to: string | null; later: boolean } {
  if (!c?.previousDate || c.previousDate === c.releaseDate) return null;
  if (!c.dateChangedAt || c.dateChangedAt.slice(0, 10) < addDays(today, -days)) return null;
  return { from: c.previousDate, to: c.releaseDate, later: !c.releaseDate || c.releaseDate > c.previousDate };
}

/** "Tamil • also in Telugu, Hindi" */
export function languagesLine(r: PostItem) {
  const ls = r.cinema ? cinemaLanguages(r.cinema) : [];
  if (!ls.length) return '';
  return ls.length === 1 ? ls[0] : `${ls[0]} • also in ${ls.slice(1).join(', ')}`;
}

/** "U/A • 2h 38m" */
export function certRuntime(r: PostItem) {
  const c = r.cinema;
  if (!c) return '';
  const rt = c.runtime ? `${Math.floor(c.runtime / 60)}h ${String(c.runtime % 60).padStart(2, '0')}m` : '';
  return [c.certificate, rt].filter(Boolean).join(' • ');
}

/** The date line on slides: "In cinemas Fri, 20 Nov" / "Now in cinemas" / "Postponed · new date TBA". */
export function cinemaDateLine(r: PostItem, today: string, kind?: CinemaPostKind | 'single') {
  const ch = kind === 'postponed' ? recentDateChange(r.cinema, today) : null;
  if (ch) return ch.to ? `${ch.later ? 'Now' : 'Earlier'}: ${dayDate(ch.to)}` : 'New date to be announced';
  if (!r.releaseDate) return 'Date to be announced';
  return r.releaseDate > today ? `In cinemas ${dayDate(r.releaseDate)}` : 'Now in cinemas';
}

export function cinemaSingleCaption(
  r: PostItem,
  opts: { rating: number | null; review: string; handle: string; extraTags: string; today: string; cta: string; ai?: AiCaptionCopy | null },
) {
  const ai = opts.ai;
  const upcoming = !!r.releaseDate && r.releaseDate > opts.today;
  const ch = recentDateChange(r.cinema, opts.today);
  const where = ch
    ? `⚠️ Release date changed: ${ch.to ? `now ${dayDate(ch.to)}` : 'new date to be announced'} (was ${dayDate(ch.from)})`
    : !r.releaseDate
      ? '🗓 Release date to be announced'
      : upcoming
        ? `🗓 In cinemas from ${dayDate(r.releaseDate)}`
        : `🍿 Now playing in cinemas (released ${dayDate(r.releaseDate)})`;
  const cta = ctaOf(opts.cta);
  return tidy([
    ...(ai?.hook ? [ai.hook, ''] : []),
    `🎬 ${r.title}`,
    where,
    languagesLine(r) ? `🗣 ${languagesLine(r)}` : null,
    certRuntime(r) ? `🎞 ${certRuntime(r)}` : null,
    '',
    opts.rating != null ? `My rating: ${starString(opts.rating)} (${opts.rating}/5)` : null,
    opts.review.trim() || null,
    ai?.blurb ? '' : null,
    ai?.blurb || null,
    '',
    ai?.closing || null,
    cta.single || null,
    opts.handle ? `Follow ${opts.handle} for cinema updates & reviews` : null,
    '',
    cinemaTags([r], [
      ch ? '#ReleaseDateUpdate' : upcoming ? '#ComingSoon' : '#NowShowing',
      opts.rating != null ? '#MovieReview' : '#InCinemas',
      '#MovieUpdates',
      ...splitTags(opts.extraTags),
    ]),
  ]);
}

export const CINEMA_KIND_TAGS: Record<CinemaPostKind, string[]> = {
  weekly: ['#ThisWeekInCinemas', '#NewReleases', '#InCinemas', '#FDFS'],
  month: ['#ComingSoon', '#InCinemas', '#UpcomingMovies'],
  now: ['#NowShowing', '#InCinemas', '#WhatToWatch'],
  postponed: ['#ReleaseDateUpdate', '#Postponed', '#MovieUpdates'],
  picks: ['#MustWatch', '#InCinemas', '#WhatToWatch'],
};

/** The caption headline for a carousel. */
export function cinemaHeadline(kind: CinemaPostKind, p: { from: string; to: string; month: string; heading: string }) {
  if (kind === 'weekly') return `🎬 New in Cinemas This Week (${fmtRange(p.from, p.to)})`;
  if (kind === 'month') return `🗓 ${monthLabel(p.month)} in Cinemas`;
  if (kind === 'now') return '🍿 Now Playing in Cinemas';
  if (kind === 'postponed') return '⚠️ Release Date Updates';
  return `⭐ ${p.heading}`;
}

export const monthLabel = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'long', year: 'numeric' });

export function cinemaListCaption(
  kind: CinemaPostKind,
  items: PostItem[],
  p: { from: string; to: string; month: string; heading: string; notes: Record<string, string>; handle: string; extraTags: string; cta: string; today: string; ai?: AiCaptionCopy | null },
) {
  const ai = p.ai;
  const lines = items.map((r, i) => {
    const lang = r.cinema ? languagesLine(r).replace(' • also in ', ' + ') : '';
    let when: string;
    if (kind === 'postponed') {
      const ch = recentDateChange(r.cinema, p.today);
      when = ch ? `${ch.to ? `now ${dayDate(ch.to)}` : 'new date TBA'} (was ${dayDate(ch.from)})` : dayDate(r.releaseDate);
    } else if (kind === 'now') {
      when = r.releaseDate ? `since ${dayDate(r.releaseDate)}` : '';
    } else {
      when = r.releaseDate ? dayDate(r.releaseDate) : 'Date TBA';
    }
    const note = p.notes[r.id]?.trim() || ai?.teasers[r.id];
    const head = kind === 'picks' ? `${i + 1}. ${r.title}` : `🎬 ${r.title}`;
    return `${head}${lang ? ` (${lang})` : ''}${when ? ` — ${when}` : ''}${note ? `\n   ${note}` : ''}`;
  });
  const cta = ctaOf(p.cta);
  return tidy([
    ...(ai?.hook ? [ai.hook, ''] : []),
    cinemaHeadline(kind, p),
    '',
    ...lines,
    '',
    ai?.closing || null,
    cta.line || null,
    kind === 'postponed' ? 'Dates can change again — we’ll keep you posted.' : 'Save this post for your movie plans 📌',
    p.handle ? `\nFollow ${p.handle} for weekly cinema updates` : null,
    '',
    cinemaTags(items, [...CINEMA_KIND_TAGS[kind], ...splitTags(p.extraTags)]),
  ]);
}
