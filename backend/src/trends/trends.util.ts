/**
 * "Trending now" for Tamil Nadu & India: headlines from free feeds (Google Trends India, Google News — India, Tamil Nadu,
 * Chennai, Tamil-language) grouped into stories, scored by how many outlets carry them + search interest + freshness.
 * Facts stay the outlets' — the app only groups, counts, tags and links.
 */

export interface FeedItem { headline: string; outlet: string; url: string; date: string | null; feed: string; lang: 'en' | 'ta'; traffic?: number; trendTerm?: string }
export interface Story {
  id: string;
  title: string;
  headlines: Array<{ text: string; outlet: string; url: string; date: string | null; lang: 'en' | 'ta' }>;
  outlets: number;
  latest: string | null;
  tamilNadu: boolean;
  trend: { term: string; traffic: number } | null;
  category: string;
  sensitive: string | null;
  score: number;
}

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const tag = (xml: string, t: string) => xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] || '';
const iso = (d: string) => { const t = Date.parse(d); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

/** Google News RSS: "Headline - Outlet" titles; <source> has the outlet. */
export function parseGoogleNews(xml: string, feed: string, lang: 'en' | 'ta'): FeedItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const it = m[1];
    const outlet = decode(tag(it, 'source'));
    let headline = decode(tag(it, 'title'));
    if (outlet && headline.endsWith(` - ${outlet}`)) headline = headline.slice(0, -(outlet.length + 3));
    return { headline, outlet, url: decode(tag(it, 'link')), date: iso(decode(tag(it, 'pubDate'))), feed, lang };
  }).filter(i => i.headline);
}

/** Google Trends "trending now" RSS: search term + approx. searches + its news articles. */
export function parseGoogleTrends(xml: string): FeedItem[] {
  const out: FeedItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1];
    const term = decode(tag(it, 'title'));
    const traffic = Number(decode(tag(it, 'ht:approx_traffic')).replace(/[^\d]/g, '')) || 0;
    const date = iso(decode(tag(it, 'pubDate')));
    const termWords = words(term);
    for (const n of it.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/g)) {
      // Trends sometimes attaches unrelated articles — keep only ones that mention the search term
      const hw = new Set(words(decode(tag(n[1], 'ht:news_item_title'))));
      if (termWords.length && !termWords.some(w => hw.has(w))) continue;
      out.push({ headline: decode(tag(n[1], 'ht:news_item_title')), outlet: decode(tag(n[1], 'ht:news_item_source')), url: decode(tag(n[1], 'ht:news_item_url')), date, feed: 'trends', lang: 'en', traffic, trendTerm: term });
    }
  }
  return out.filter(i => i.headline);
}

const STOP = new Set(('a an the and or of in on to for with is are was were be by at from as its it this that after over amid into says said will can new not no us about more than up out his her their who what how why when '
  + 'news live updates today latest report reports video watch read check here 2025 2026').split(' '));
const words = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));

const TN = /\b(tamil ?nadu|chennai|madurai|coimbatore|kovai|trichy|tiruchi|tiruchirappalli|salem|tirunelveli|thoothukudi|tuticorin|vellore|erode|tiruppur|thanjavur|kanyakumari|nagercoil|hosur|kancheepuram|chengalpattu|kallakurichi|villupuram|cuddalore|nilgiris|ooty|karur|namakkal|dindigul|sivaganga|ramanathapuram|rameswaram|pudukkottai|krishnagiri|dharmapuri|ariyalur|perambalur|tenkasi|virudhunagar|theni|tiruvannamalai|ranipet|tirupattur|mayiladuthurai|nagapattinam|tiruvarur|puducherry|pondicherry|stalin|udhayanidhi|edappadi|palaniswami|annamalai|vijay|tvk|dmk|aiadmk|pmk|vck|tnpsc|cmrl|tangedco|tasmac|marina)\b/i;
export const isTamilNadu = (s: string, lang: 'en' | 'ta') => lang === 'ta' || TN.test(s) || /[஀-௿]/.test(s);

const CATS: Array<[string, RegExp]> = [
  ['Weather', /\b(rain|rainfall|cyclone|storm|imd|monsoon|heat ?wave|flood|weather|depression|low pressure|orange alert|red alert|yellow alert)\b|மழை|புயல்|வானிலை/i],
  ['Cricket & sports', /\b(cricket|ipl|t20|odi|test match|bcci|kohli|rohit|dhoni|csk|football|kabaddi|chess|olympic|hockey|tennis|badminton|vs\b|match|tournament|premier league|world cup|trophy|ranji|syed mushtaq|wicket|innings|century)\b|கிரிக்கெட்/i],
  ['Politics', /\b(dmk|aiadmk|bjp|congress|tvk|pmk|vck|election|minister|chief minister|cm |stalin|vijay|edappadi|annamalai|modi|rahul|assembly|parliament|lok sabha|rajya sabha|governor|party|mla|mp |poll)\b|திமுக|அதிமுக|தவெக|பாஜக|முதல்வர்|அமைச்சர்/i],
  ['Money & prices', /\b(gold|silver|petrol|diesel|price|rate|sensex|nifty|stock|ipo|gmp|rupee|budget|tax|gst|salary|da hike|pension|loan|emi|rbi|bank)\b|தங்கம்|விலை/i],
  ['Jobs & education', /\b(exam|result|results|admit card|hall ticket|tnpsc|neet|jee|upsc|ssc|recruitment|vacancy|job|jobs|school|college|university|board|syllabus|scholarship)\b|தேர்வு|வேலை/i],
  ['Tech', /\b(iphone|android|samsung|apple|google|ai\b|chatgpt|whatsapp|instagram|launch|5g|smartphone|laptop|elon|tesla|isro|satellite|rocket)\b/i],
  ['Travel & transport', /\b(metro|train|vande bharat|railway|bus|airport|flight|highway|toll|traffic|road)\b|மெட்ரோ|ரயில்/i],
  ['Cinema & OTT', /\b(movie|film|box office|trailer|teaser|ott|netflix|prime video|hotstar|actor|actress|director|song|album|kollywood|rajinikanth|ajith|kamal|dhanush|suriya)\b|திரைப்படம்|படம்/i],
  ['Crime & law', /\b(arrest|arrested|police|court|case|fir|cbi|ed |raid|fraud|scam|bail|verdict|sentenced|high court|supreme court)\b|கைது|வழக்கு|நீதிமன்ற/i],
];
/** The category with the most keyword hits (not just the first rule that matches). */
export function categoryOf(s: string) {
  let best = 'General';
  let max = 0;
  for (const [name, re] of CATS) {
    const n = (s.match(new RegExp(re.source, 'gi')) || []).length;
    if (n > max) { max = n; best = name; }
  }
  return best;
}

/** Stories that must not be turned into "viral" content (deaths, violence, communal, suicide …). */
const SENSITIVE: Array<[string, RegExp]> = [
  ['death / tragedy', /\b(dead|death|deaths|dies|died|killed|killing|toll|bodies|body found|drowned|electrocuted|stampede|tragedy|mourn|funeral|accident|(plane|car|bus|train|road|helicopter) crash|(building|wall|bridge|roof) collapse)\b|உயிரிழ|பலி|மரணம்/i],
  ['violence / crime', /\b(murder|murdered|stabbed|attack|attacked|assault|rape|molest|sexual|acid|lynch|shot dead|hacked to death|kidnap)\b|கொலை|பாலியல்/i],
  ['suicide', /\b(suicide|ends life|end his life|end her life)\b|தற்கொலை/i],
  ['communal / caste', /\b(communal|caste|riot|communal clash|caste clash|religious|temple row|mosque|church row|hate speech|honour killing|dalit)\b|சாதி|மதக்/i],
  ['terror / war', /\b(terror|terrorist|blast|bomb|bombing|militant|missile|airstrike|war on|at war|war in)\b/i],
];
export const sensitiveOf = (s: string) => SENSITIVE.find(([, re]) => re.test(s))?.[0] || null;

// Words that appear in half of all Tamil Nadu headlines don't make two headlines "the same story".
const COMMON = new Set(['tamil', 'nadu', 'chennai', 'india', 'indian', 'government', 'govt', 'state', 'district', 'centre', 'union', 'தமிழ்நாடு', 'தமிழக', 'சென்னை']);
/** How alike two headlines are: 3+ shared meaningful words = same story; otherwise overlap / Jaccard. */
function similarity(a: Set<string>, b: Set<string>) {
  let shared = 0;
  let sa = 0;
  let sb = 0;
  for (const x of a) if (!COMMON.has(x)) { sa++; if (b.has(x)) shared++; }
  for (const x of b) if (!COMMON.has(x)) sb++;
  if (shared >= 3) return 1;
  if (shared >= 2 && shared / Math.max(1, Math.min(sa, sb)) >= 0.5) return 0.6;
  return shared / Math.max(1, sa + sb - shared);
}

/** Group headlines about the same thing (shared words / same trend term), then score. */
export function buildStories(items: FeedItem[], now = Date.now()): Story[] {
  // each headline is compared with every headline already in a group (not a growing word pile), so groups don't snowball
  type Acc = { items: FeedItem[]; sets: Array<Set<string>>; trend: { term: string; traffic: number } | null };
  const groups: Acc[] = [];
  for (const it of items) {
    const w = new Set(words(it.headline));
    if (w.size < 2) continue;
    let best: Acc | null = null;
    let bestScore = 0;
    for (const g of groups) {
      const sameTrend = it.trendTerm && g.trend?.term === it.trendTerm;
      const s = sameTrend ? 1 : Math.max(...g.sets.map(x => similarity(w, x)));
      if (s > bestScore) { best = g; bestScore = s; }
    }
    if (best && bestScore >= 0.34) {
      best.items.push(it);
      best.sets.push(w);
      if (it.trendTerm && (!best.trend || (it.traffic || 0) > best.trend.traffic)) best.trend = { term: it.trendTerm, traffic: it.traffic || 0 };
    } else {
      groups.push({ items: [it], sets: [w], trend: it.trendTerm ? { term: it.trendTerm, traffic: it.traffic || 0 } : null });
    }
  }
  return groups.map(g => {
    const seen = new Set<string>();
    const headlines = g.items.filter(i => { const k = `${i.outlet}|${i.headline}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .map(i => ({ text: i.headline, outlet: i.outlet, url: i.url, date: i.date, lang: i.lang }));
    const outlets = new Set(headlines.map(h => h.outlet.toLowerCase())).size;
    const latest = headlines.map(h => h.date).filter(Boolean).sort().pop() || null;
    const all = headlines.map(h => h.text).join(' | ');
    const tamilNadu = g.items.some(i => isTamilNadu(i.headline, i.lang) || i.feed === 'tn' || i.feed === 'chennai');
    const ageH = latest ? (now - Date.parse(latest)) / 3600000 : 48;
    const trafficScore = g.trend ? Math.log10(1 + g.trend.traffic) * 2 : 0;
    const score = +(outlets * 3 + trafficScore + Math.max(0, 6 - ageH / 4) + (tamilNadu ? 3 : 0)).toFixed(2);
    // the English headline from the most-cited outlet makes the clearest title; Tamil when that's all there is
    const title = (headlines.find(h => h.lang === 'en') || headlines[0]).text;
    return {
      id: hash(title), title, headlines: headlines.slice(0, 12), outlets, latest, tamilNadu, trend: g.trend,
      category: categoryOf(all), sensitive: sensitiveOf(all), score,
    };
  }).sort((a, b) => b.score - a.score);
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `s${(h >>> 0).toString(36)}`;
}
