/**
 * Rule-based (no AI) helpers for turning Indian entertainment news headlines
 * into OTT release candidates. Anything extracted here is only a *suggestion*:
 * every candidate lands in the manual review queue as PENDING.
 */

export const PLATFORM_ALIASES: Array<{ name: string; patterns: RegExp }> = [
  { name: 'Netflix', patterns: /\bnetflix\b/i },
  { name: 'Prime Video', patterns: /\b(amazon\s+)?prime(\s+video)?\b/i },
  { name: 'JioHotstar', patterns: /\b(jio\s*hotstar|disney\+?\s*hotstar|hotstar|jio\s*cinema)\b/i },
  { name: 'SonyLIV', patterns: /\bsony\s*liv\b/i },
  { name: 'ZEE5', patterns: /\bzee\s*5\b/i },
  { name: 'Aha', patterns: /\baha(\s+video|\s+tamil)?\b/i },
  { name: 'Sun NXT', patterns: /\bsun\s*nxt\b/i },
  { name: 'ManoramaMAX', patterns: /\bmanorama\s*max\b/i },
  { name: 'Apple TV+', patterns: /\bapple\s*tv\+?/i },
  { name: 'Lionsgate Play', patterns: /\blionsgate\s*play\b/i },
  { name: 'Hoichoi', patterns: /\bhoichoi\b/i },
  { name: 'ETV Win', patterns: /\betv\s*win\b/i },
  { name: 'Amazon MX Player', patterns: /\bmx\s*player\b/i },
  { name: 'Chaupal', patterns: /\bchaupal\b/i },
  { name: 'Simply South', patterns: /\bsimply\s*south\b/i },
];

export const KNOWN_PLATFORMS = PLATFORM_ALIASES.map(p => p.name);

/** Map any platform spelling (TMDB, news, user input) to one canonical name. */
export function normalizePlatform(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const hit = PLATFORM_ALIASES.find(p => p.patterns.test(raw));
  return hit ? hit.name : raw.trim() || undefined;
}

/**
 * The platform a headline actually claims: the earliest *non-negated* mention.
 * "…it's neither Netflix nor Amazon Prime Video" → undefined; "SonyLIV or Netflix?" (speculation) → undefined.
 */
export function detectPlatform(text: string): string | undefined {
  const mentions: Array<{ name: string; index: number }> = [];
  for (const p of PLATFORM_ALIASES) {
    // "Aha" is a common word fragment; only accept it right after "on".
    const re = new RegExp((p.name === 'Aha' ? /\bon\s+aha\b/i : p.patterns).source, 'gi');
    for (const m of text.matchAll(re)) {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 20), m.index);
      if (/\b(neither|nor|not|isn'?t|instead of|rather than|skips?|snubs?)\s+(?:on\s+)?$/i.test(before)) continue;
      mentions.push({ name: p.name, index: m.index ?? 0 });
    }
  }
  if (mentions.length === 0) return undefined;
  const distinct = new Set(mentions.map(m => m.name));
  if (distinct.size >= 2 && /\?/.test(text) && /\bor\b/i.test(text)) return undefined; // "X or Y?" speculation
  return mentions.sort((a, b) => a.index - b.index)[0].name;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Extract an explicit calendar date ("21 November", "Nov 21st", "November 21, 2026").
 * The year is inferred as the next occurrence on/after (referenceDate - 30 days)
 * when it is not written. Returns YYYY-MM-DD or undefined.
 */
export function detectDate(text: string, referenceDate: Date): string | undefined {
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b,?\\s*(\\d{4})?`, 'i');
  const monthFirst = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b,?\\s*(\\d{4})?`, 'i');

  let day: number | undefined;
  let month: number | undefined;
  let year: number | undefined;

  const a = text.match(dayFirst);
  const b = text.match(monthFirst);
  if (a && (!b || (a.index ?? 0) <= (b.index ?? 0))) {
    day = parseInt(a[1], 10);
    month = MONTHS[a[2].toLowerCase()];
    year = a[3] ? parseInt(a[3], 10) : undefined;
  } else if (b) {
    month = MONTHS[b[1].toLowerCase()];
    day = parseInt(b[2], 10);
    year = b[3] ? parseInt(b[3], 10) : undefined;
  }
  if (!day || !month || day > 31) return undefined;

  if (!year) {
    const floor = new Date(referenceDate.getTime() - 30 * 86400000);
    year = floor.getUTCFullYear();
    const candidate = Date.UTC(year, month - 1, day);
    if (candidate < floor.getTime()) year += 1;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1) return undefined; // e.g. 31 Nov
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Headlines that list many titles at once; they can't be split without AI. */
export function isDigestHeadline(headline: string): boolean {
  return (
    /\bott\s+releases\b/i.test(headline) || // plural "OTT releases" = a list
    /\bott\s+release\s+(movies|films|shows|series)\b/i.test(headline) ||
    /\b(releases|movies|films|shows|series|titles|dramas)\s+(to watch|to stream|this week|this weekend|releasing|streaming)\b/i.test(headline) ||
    /\bthis week'?s\b|\btop\s+\d+\b|\b\d+\s+(new\s+|best\s+|top\s+|upcoming\s+)?(ott|movies|films|shows|releases|series|dramas)\b/i.test(headline) ||
    /\b(weekend watchlist|what to watch|the best\b|best (new )?(movies|shows|comedies|thrillers|k-dramas?))/i.test(headline)
  );
}

const OTT_WORDS = /\b(ott|stream(?:s|ing)?|premiere|digital|release date|netflix|prime video|hotstar|sonyliv|zee5|sun nxt|aha)\b/i;

/** Words that never end a title in these headlines ("Ranabaali Locks Its OTT ..."). */
const TRAILING_NOISE = new Set([
  'locks', 'lock', 'its', 'gets', 'get', 'finally', 'officially', 'reportedly', 'film', 'films', 'movie', 'movies',
  'series', 'web', 'show', 'on', 'which', 'tamil', 'telugu', 'malayalam', 'kannada', 'hindi', 'marathi', 'bengali',
  'dubbed', 'version', 'new', 'upcoming', 'release', 'now', 'is', 'has', 'set', 'confirmed', 'announced', 'date',
]);
const LEADING_NOISE = /^(?:exclusive|breaking|confirmed|official|watch|update|know|have you heard\??|is the|is|when is|where to watch|days before|ahead of|now streaming|streaming now|out now|ott)\s*[:\-|?]?\s+/i;
const JUNK_IN_TITLE = /\b(when and where|here'?s|everything|all you need|explained|reportedly|crore|deal|box office|cost it|reacts|guide to|the best|starring|novel|adapted)\b|[;?]/i;
const BAD_START = /^(\d+\s|top\b|best\b|new\b|latest\b|this\b|friday\b|weekend\b|upcoming\b|how\b|why\b|what\b|which\b)/i;

/**
 * Pull the film/series title out of a typical Indian OTT headline, e.g.
 *   "'Scene' OTT release date: When and where ..."         -> Scene
 *   "Ranabaali OTT Release: When And Where To Watch ..."   -> Ranabaali
 *   "Rajinikanth's 'Jailer 2' now streaming on Prime Video" -> Jailer 2
 *   "Kantara Chapter 1 now streaming on Prime Video"        -> Kantara Chapter 1
 * Returns undefined rather than guessing when the headline doesn't fit.
 */
export function extractTitle(headline: string): string | undefined {
  const h = headline.replace(/\s+/g, ' ').trim();

  // 1) A quoted title near the start, followed by OTT wording: ... 'Jailer 2' OTT release ...
  const quoteRe = /(?:^|[\s(:])['‘"“]([^'’"”‘“]{2,60})['’"”](?=[\s:,.)!?]|$)/g;
  for (const m of h.matchAll(quoteRe)) {
    if ((m.index ?? 0) > 60) break;
    const after = h.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 80);
    if (OTT_WORDS.test(after)) {
      const t = cleanTitle(m[1]);
      if (t) return t;
    }
  }

  // 2) Unquoted: strip lead-ins and actor possessives, then take the shortest valid pattern match.
  const s = h
    .replace(LEADING_NOISE, '')
    .replace(/^(?:[A-Z][\w.\-]*\s+){0,2}[A-Z][\w.\-]*['’]s\s+(?:(?:new|upcoming|latest)\s+)?(?:(?:web\s+)?series|film|movie|show)?\s*/, '');
  const patterns: RegExp[] = [
    /^(.{2,80}?)\s+(?:ott|digital)\s+(?:release|premiere|debut|date|streaming|rights|platform)/i,
    /^(.{2,80}?)\s+(?:is\s+)?(?:now\s+)?streaming\s+(?:on|from|now|in)\b/i,
    /^(.{2,80}?)\s+(?:to|will)\s+(?:stream|premiere|release)\s+on\b/i,
    /^(.{2,80}?)\s+(?:arrives|lands|premieres|drops|debuts|streams)\s+on\b/i,
    /^(.{2,80}?)\s+(?:on|in)\s+ott\b/i,
  ];
  const found = patterns
    .map(re => s.match(re))
    .filter((m): m is RegExpMatchArray => !!m)
    .map(m => cleanTitle(m[1]))
    .filter((t): t is string => !!t);
  if (found.length === 0) return undefined;
  return found.sort((a, b) => a.length - b.length)[0];
}

export function cleanTitle(raw: string): string | undefined {
  let t = raw.replace(LEADING_NOISE, '').replace(/^['"‘’“”\s]+|['"‘’“”\s:\-|,–]+$/g, '').trim();

  // "Jailer 2: How an Early OTT Release..." -> "Jailer 2"
  t = t.replace(/\s*:\s+(how|why|what|when|where|here|is|did|will|the reason)\b.*$/i, '').trim();

  // Strip trailing noise words: "Ranabaali Locks Its" -> "Ranabaali", "All Pass Tamil Movie" -> "All Pass"
  const words = t.split(' ');
  while (words.length > 1 && TRAILING_NOISE.has(words[words.length - 1].toLowerCase().replace(/[^a-z]/g, ''))) words.pop();
  t = words.join(' ').replace(/['"‘’“”\s:\-|,–]+$/g, '').trim();

  if (t.length < 2 || t.length > 60) return undefined;
  if (t.split(/\s+/).length > 7) return undefined;
  if (JUNK_IN_TITLE.test(t) || BAD_START.test(t)) return undefined;
  if (!/[A-Za-z\u0900-\u0dff]/.test(t)) return undefined;
  return t;
}

/** Detect "Season 2" / "S2" in a title and return the base title + season. */
export function splitSeason(title: string): { base: string; season?: number } {
  const m = title.match(/^(.*?)[\s:,-]*(?:season\s*(\d{1,2})|\bS(\d{1,2})\b)\s*$/i);
  if (m && m[1].trim().length >= 2) {
    return { base: m[1].trim(), season: parseInt(m[2] || m[3], 10) };
  }
  return { base: title.trim() };
}

/** Stable identity used to dedupe news/TMDB/manual entries for the same title. */
export function makeDedupeKey(title: string, season?: number | null): string {
  const norm = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9ऀ-෿]+/g, '');
  return season && season > 1 ? `${norm}#s${season}` : norm;
}

const LANGUAGE_WORDS: Array<[string, RegExp]> = [
  ['ta', /\b(tamil|kollywood)\b/i],
  ['te', /\b(telugu|tollywood)\b/i],
  ['ml', /\b(malayalam|mollywood)\b/i],
  ['kn', /\b(kannada|sandalwood)\b/i],
  ['hi', /\b(hindi|bollywood)\b/i],
  ['mr', /\bmarathi\b/i],
  ['bn', /\bbengali\b/i],
  ['pa', /\bpunjabi\b/i],
];

/**
 * Language of a *dubbed version* explicitly named in text: "Hindi version", "Hindi dubbed", "dubbed in Telugu",
 * "(Hindi)", "Hindi Trailer". Multi-language lists ("in Hindi, Tamil and Telugu") are NOT a dub signal.
 */
export function detectDubLanguage(text: string): string | undefined {
  const names = '(tamil|telugu|malayalam|kannada|hindi|marathi|bengali|punjabi|english)';
  const patterns = [
    new RegExp(`\\b${names}\\s+(?:dubbed\\s+)?(?:version|dub(?:bed)?)\\b`, 'i'),
    new RegExp(`\\bdubbed\\s+(?:in(?:to)?\\s+)?${names}\\b`, 'i'),
    new RegExp(`\\(\\s*${names}\\s*\\)`, 'i'),
    new RegExp(`\\b${names}\\s+(?:official\\s+)?trailer\\b`, 'i'),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const word = m[1].toLowerCase();
      const hit = LANGUAGE_WORDS.find(([, r]) => r.test(word));
      if (hit) return hit[0];
      if (word === 'english') return 'en';
    }
  }
  return undefined;
}

export function detectLanguage(text: string): string | undefined {
  for (const [code, re] of LANGUAGE_WORDS) if (re.test(text)) return code;
  return undefined;
}

export const LANGUAGE_LABELS: Record<string, string> = {
  ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada', hi: 'Hindi',
  mr: 'Marathi', bn: 'Bengali', pa: 'Punjabi', en: 'English', ko: 'Korean', ja: 'Japanese',
};
