/**
 * Critics' ratings & one-liners for a title, from free public sources:
 *  - Bing News RSS ("<title> review") → each critic's article → the rating it states in its own structured data
 *    (schema.org Review: ratingValue / bestRating) or in its headline / description ("3.5/5", "★★★½"),
 *  - Wikipedia's "Critical response" section (critic, outlet, rating, quote).
 * Nothing is inferred: a rating appears only when the source states it; every item links to its source.
 */

export interface CriticReview {
  id: string;
  outlet: string;
  critic: string | null;
  /** as stated, e.g. 3.5 of 5 */
  rating: { value: number; best: number } | null;
  /** rating on a 5-point scale (for the average) */
  of5: number | null;
  oneLiner: string | null;
  headline: string | null;
  url: string | null;
  date: string | null;
  via: 'article' | 'headline' | 'wikipedia';
}

export interface BuzzItem { headline: string; outlet: string; url: string | null; date: string | null }

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const clean = (s: string) => decode(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export interface NewsItem { headline: string; url: string; outlet: string; date: string | null; description: string }

/** Bing News RSS → items with the real article URL (Bing wraps it in a redirect). */
export function parseBingNews(xml: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1];
    const tag = (t: string) => it.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`))?.[1] || '';
    let url = decode(tag('link'));
    const real = url.match(/[?&]url=([^&]+)/);
    if (real) url = decodeURIComponent(real[1]);
    const outlet = clean(tag('News:Source')).replace(/\s+on MSN$/i, '');
    out.push({ headline: clean(tag('title')), url, outlet, date: tag('pubDate') ? new Date(tag('pubDate')).toISOString().slice(0, 10) : null, description: clean(tag('description')) });
  }
  return out;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toLowerCase();

/** The headline is about this title (not its sequel / prequel / another film that starts the same). */
export function aboutTitle(headline: string, title: string) {
  const h = norm(headline);
  const t = norm(title).replace(/[:\-–—].*$/, '').trim();
  if (!t) return false;
  const re = new RegExp(`(^|[^a-z0-9])${esc(t)}(?![a-z0-9])(?!\\s*(\\d|ii|iii|part|chapter|returns|reloaded|2\\b))`, 'i');
  return re.test(h);
}

const BUZZ = /\b(twitter|x|netizens?|fans?|public|audience)\s+(review|reaction|verdict|response)s?\b|\blive updates?\b|\bbox office\b|\bfirst[- ]day\b|\bhighlights\b|^tag:|\breview by\s+[A-Z]|\breacts?\b|\bcelebrit/i;
const IS_REVIEW = /\breview\b|\bverdict\b/i;
export const isBuzz = (h: string) => BUZZ.test(h);
/** Stage / musical productions that share a film's name ("The Shawshank Redemption at Leeds Grand Theatre"). */
const STAGE = /\bat\s+(the\s+)?[A-Z][\w'’&. -]{1,40}\b(theatre|theater|playhouse|opera house)\b|\bstage (play|adaptation|production|version)\b|\bwest end\b|\bbroadway\b|\bthe musical\b|\bplayhouse\b/i;
export const isStage = (h: string) => STAGE.test(h);
/** A news review counts only if it was published around the release (old titles: use Wikipedia instead). */
export function nearRelease(date: string | null, year: number | null) {
  if (!date || !year) return true;
  const y = Number(date.slice(0, 4));
  return y >= year - 1 && y <= year + 2;
}
export const isCriticReview = (h: string) => IS_REVIEW.test(h) && !BUZZ.test(h);

/** "3.5/5", "3.5 out of 5", "3.5 stars", "★★★½", "Rating: 3/5" in free text. */
export function ratingInText(text: string): { value: number; best: number } | null {
  const t = text.replace(/\s+/g, ' ');
  let m = t.match(/(\d(?:\.\d{1,2})?)\s*(?:stars?\s*)?(?:\/|out of)\s*(5|10|4|four|five)\b/i);
  if (m) return valid(+m[1], ({ four: 4, five: 5 } as Record<string, number>)[m[2].toLowerCase()] ?? +m[2]);
  m = t.match(/(\d(?:\.\d{1,2})?)\s*stars?\b(?!\s*(?:cast|studded|power))/i);
  if (m) return valid(+m[1], 5);
  m = t.match(/(★{1,5})(½)?/);
  if (m) return valid(m[1].length + (m[2] ? 0.5 : 0), 5);
  return null;
}
const valid = (value: number, best: number) => (value > 0 && value <= best ? { value, best } : null);

/** schema.org Review rating in a page's JSON-LD (ratingValue / bestRating, author, publisher, description). */
export function ratingFromJsonLd(html: string): { rating: { value: number; best: number } | null; critic: string | null; outlet: string | null; description: string | null } {
  const res = { rating: null as { value: number; best: number } | null, critic: null as string | null, outlet: null as string | null, description: null as string | null };
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const nodes: any[] = [];
    const walk = (x: any) => {
      if (!x || typeof x !== 'object') return;
      if (Array.isArray(x)) return x.forEach(walk);
      nodes.push(x);
      for (const v of Object.values(x)) if (typeof v === 'object') walk(v);
    };
    walk(data);
    for (const n of nodes) {
      const r = n.reviewRating;
      if (!r || res.rating) continue;
      const v = parseFloat(r.ratingValue);
      const b = parseFloat(r.bestRating) || (v > 5 ? 10 : 5);
      const ok = valid(v, b);
      if (!ok) continue;
      res.rating = ok;
      const name = (x: any) => (Array.isArray(x) ? x[0]?.name : x?.name) || (typeof x === 'string' ? x : null);
      res.critic = name(n.author) || null;
      res.outlet = name(n.publisher) || null;
      res.description = typeof n.description === 'string' ? clean(n.description) : null;
    }
  }
  return res;
}

/** The verdict part of a review headline: "Jailer 2 Movie Review: Rajinikanth … sequel" → "Rajinikanth … sequel". */
export function verdictOf(headline: string, title: string): string | null {
  let h = headline.replace(/\s+[|–—-]\s+[^|–—]{2,40}$/, ''); // trailing " | Outlet" / " - Outlet" (not "whistle-worthy")
  const i = h.search(/\breview\b\s*[:\-–—]/i);
  if (i >= 0) h = h.slice(i).replace(/^review\s*[:\-–—]\s*/i, '');
  else h = h.replace(new RegExp(esc(title), 'ig'), '').replace(/\b(movie|film|series|web series|show)\s+review\b/ig, '');
  h = h.replace(/^['"‘“\s:,-]+|['"’”\s:,-]+$/g, '').trim();
  // generic page titles aren't a verdict
  if (/\b(cast\s*&\s*crew|critics review|rating|release date|box office|story|plot|where to watch|ott release)\b/i.test(h) && h.split(/\s+/).length < 8) return null;
  return h.length >= 12 && h.length <= 160 ? h : null;
}

// ───────────────────────── Wikipedia "Critical response" ─────────────────────────

/** Strip wikitext to plain text, keeping ''italics'' markers (outlet names) for parsing. */
export function wikiToText(w: string) {
  let s = w.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[\s\S]*?<\/ref>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  for (let i = 0; i < 6 && /\{\{[^{}]*\}\}/.test(s); i++) s = s.replace(/\{\{[^{}]*\}\}/g, '');
  s = s.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1').replace(/'''/g, '').replace(/<[^>]+>/g, '');
  return s;
}

export function parseWikiCritics(wikitext: string): CriticReview[] {
  const text = wikiToText(wikitext);
  const out: CriticReview[] = [];
  // split into sentences, but not after initials ("M. Suganth") or "Dr." / "Mr."
  const sentences = text.split(/(?<!\b[A-Z]\.)(?<!\b(?:Dr|Mr|Mrs|Ms|St|Jr|Sr)\.)(?<=[.!?]["”]?)\s+(?=[A-Z])/);
  for (const raw of sentences) {
    const s = raw.trim();
    const rating = ratingInText(s.replace(/''/g, ''));
    const outlet = s.match(/''([^']{2,60})''/)?.[1]?.trim();
    if (!outlet || !rating) continue;
    const critic = s.match(/^([A-Z][\w.'-]+(?:\s+[A-Z][\w.'-]+){0,3})\s+(?:of|from|for|writing for)\s+''/)?.[1] || null;
    const quote = s.match(/["“]([^"”]{12,220})["”]/)?.[1]?.trim() || null;
    out.push({
      id: `wiki:${norm(outlet)}`, outlet, critic, rating, of5: +(rating.value / rating.best * 5).toFixed(2),
      oneLiner: quote, headline: null, url: null, date: null, via: 'wikipedia',
    });
  }
  return out;
}

// ───────────────────────── summary ─────────────────────────

const STOP = new Set('a an the and or of in on to for with is it its this that as at by from be are was but not his her their our your you we they he she film movie series review rating stars star out than more most so too very just into over'.split(' '));

/** Phrases (2–3 words) that several critics used — "mass entertainer", "first half", "gripping thriller". */
export function commonPhrases(lines: string[], title: string, max = 8): Array<{ text: string; count: number }> {
  const titleWords = new Set(norm(title).split(/[^a-z0-9]+/).filter(Boolean));
  const counts = new Map<string, number>();
  for (const line of lines) {
    const words = norm(line).replace(/[^a-z0-9' -]/g, ' ').split(/\s+/).filter(Boolean);
    const seen = new Set<string>();
    for (const n of [2, 3]) {
      for (let i = 0; i + n <= words.length; i++) {
        const g = words.slice(i, i + n);
        if (STOP.has(g[0]) || STOP.has(g[n - 1]) || g.some(w => titleWords.has(w) || /^\d+$/.test(w))) continue;
        seen.add(g.join(' '));
      }
    }
    for (const p of seen) counts.set(p, (counts.get(p) || 0) + 1);
  }
  return [...counts.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, max).map(([text, count]) => ({ text, count }));
}

/** Short outlet name for a rating chip: "The Times of India" → "TOI". */
export function shortOutlet(o: string) {
  const known: Record<string, string> = {
    'the times of india': 'TOI', 'times of india': 'TOI', 'the indian express': 'Indian Express', 'indian express': 'Indian Express', 'the hindu': 'The Hindu',
    'hindustan times': 'HT', 'india today': 'India Today', 'news18': 'News18', 'ndtv': 'NDTV', 'the new indian express': 'TNIE', 'cinema express': 'Cinema Express',
    'firstpost': 'Firstpost', 'film companion': 'Film Companion', 'pinkvilla': 'Pinkvilla', 'ottplay': 'OTTplay', 'deccan chronicle': 'Deccan Chronicle',
    'the quint': 'The Quint', 'scroll.in': 'Scroll', 'rediff.com': 'Rediff', 'filmibeat': 'FilmiBeat', 'koimoi': 'Koimoi', 'bollywood hungama': 'Bollywood Hungama',
    'india tv news': 'India TV', 'the guardian': 'The Guardian', 'variety': 'Variety', 'the hollywood reporter': 'THR', 'rogerebert.com': 'RogerEbert.com', 'empire': 'Empire',
  };
  const k = norm(o).trim();
  return known[k] || o.replace(/^the\s+/i, '').slice(0, 24);
}
export const ratingLabel = (r: { value: number; best: number }) => `${Number.isInteger(r.value) ? r.value : r.value.toFixed(r.value * 4 % 1 === 0 ? 2 : 1).replace(/0$/, '')}/${r.best}`;
