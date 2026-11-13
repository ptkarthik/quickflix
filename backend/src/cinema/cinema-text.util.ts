import { cleanTitle, detectDate, isDigestHeadline, makeDedupeKey } from '../ott/ott-text.util';

/** Headline/video talks about a cinema (theatrical) release, not OTT. */
export const THEATRICAL_WORDS = /\b(in (cinemas|theatres|theaters)|theatrical(ly)?|big screens?|worldwide (release|on)|grand release|releas(e|es|ing)\s+(on|from|this|in)|release date|hits screens|in theatres|box office)\b/i;
export const OTT_WORDS = /\b(ott|stream(s|ing)?|netflix|prime video|jiohotstar|hotstar|zee5|sony ?liv|aha|sun ?nxt|manorama ?max|etv win|digital premiere)\b/i;
export const POSTPONE_WORDS = /\b(postpone[ds]?|postponement|delay(ed|s)?|deferred|pushed( back)?|new release date|gets? a new date|release (date )?(changed|shifted)|preponed?|advanced)\b/i;

/** Months as written in Wikipedia "Opening" columns: "NOV", "N O V", "November". */
const MONTHS: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
export function parseMonthCell(cell: string): number | undefined {
  const k = cell.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3);
  return MONTHS[k];
}

/** Title of the film a cinema news headline is about (rule-based, no guessing). */
export function extractCinemaTitle(headline: string): string | undefined {
  const h = headline.replace(/\s+/g, ' ').trim();
  if (isDigestHeadline(h)) return undefined;
  // 1) quoted title: 'Jana Nayagan' release date …
  const q = h.match(/['‘“"]([^'’”"]{2,60})['’”"]/);
  if (q) return cleanTitle(q[1]);
  // 2) "<Title> release date …", "<Title> to release in theatres…", "<Title> postponed…"
  const m = h.match(
    /^(?:[A-Z][\w.]*(?:\s+[A-Z][\w.]*){0,3}['’]s\s+)?(.{2,60}?)\s+(?:movie\s+|film\s+)?(?:release date|releasing|to release|will release|set to release|gets (?:a )?(?:new )?release date|locks (?:its )?release date|release postponed|postponed|gets postponed|to hit (?:the )?(?:screens|theatres|cinemas)|hits (?:the )?(?:screens|theatres|cinemas)|in (?:cinemas|theatres|theaters)|trailer)\b/i,
  );
  if (m) return cleanTitle(m[1]);
  return undefined;
}

export interface CinemaHeadline {
  title: string;
  date?: string;
  postponed: boolean;
}

/** Parse a cinema headline into a claim; undefined when it isn't about one film's theatrical release. */
export function parseCinemaHeadline(headline: string, published: Date): CinemaHeadline | undefined {
  if (OTT_WORDS.test(headline)) return undefined; // OTT news belongs to OTT Desk
  const postponed = POSTPONE_WORDS.test(headline);
  if (!THEATRICAL_WORDS.test(headline) && !postponed) return undefined;
  const title = extractCinemaTitle(headline);
  if (!title) return undefined;
  return { title, date: detectDate(headline, published), postponed };
}

/** Same film across sources: title + original language. */
export function cinemaKey(title: string, language?: string | null): string {
  return `${makeDedupeKey(title)}~${language || 'xx'}`;
}

const LANGUAGE_NAMES: Record<string, string> = {
  tamil: 'ta', telugu: 'te', hindi: 'hi', malayalam: 'ml', kannada: 'kn', marathi: 'mr', bengali: 'bn', punjabi: 'pa', gujarati: 'gu', english: 'en',
};
/** "Tamil, Telugu & Hindi" → ['ta','te','hi'] */
export function languagesIn(text: string): string[] {
  const out = new Set<string>();
  for (const [name, code] of Object.entries(LANGUAGE_NAMES)) if (new RegExp(`\\b${name}\\b`, 'i').test(text)) out.add(code);
  return [...out];
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

const words = (t: string) => makeDedupeKey(t).replace(/[^a-z0-9]+/g, ' ').trim();
/** "OM: Chapter 1" → "om", "Suryaa: Ant Se Aarambh Tak" → "suryaa", "DNK: Donga Naa Koduku" → "dnk". */
const base = (t: string) => words(t.split(/\s*[:–—|]\s*|\s+-\s+/)[0]);

/**
 * Same film under different spellings? Only used together with "same language and same/adjacent date",
 * so it can be a little generous: transliteration typos (Itllu/Itlu) and subtitle variants (Om / OM: Chapter 1).
 */
export function sameFilmTitle(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  if (!wa || !wb) return false;
  if (wa === wb) return true;
  const ba = base(a);
  const bb = base(b);
  if (ba.length >= 2 && (ba === wb || bb === wa || ba === bb)) return true;
  const ca = wa.replace(/\s/g, '');
  const cb = wb.replace(/\s/g, '');
  const d = editDistance(ca, cb);
  return (Math.min(ca.length, cb.length) >= 5 && d <= 1) || (Math.min(ca.length, cb.length) >= 9 && d <= 2);
}
