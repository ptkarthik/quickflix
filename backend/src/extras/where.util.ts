/**
 * Where to watch — legal sources only.
 * Availability comes from TMDB's watch providers (data by JustWatch); free full movies from official
 * YouTube channels / the Internet Archive that you approved. We never suggest any other site.
 */

export interface WhereService {
  name: string;
  logo: string | null;
}

export interface WhereResult {
  region: string;
  /** TMDB's "where to watch" page for the title (lists every platform with links). */
  link: string | null;
  stream: WhereService[];
  free: WhereService[];
  rent: WhereService[];
  buy: WhereService[];
  /** Official free full-length uploads you approved (YouTube official channels, Internet Archive public domain). */
  official: Array<{ source: 'youtube' | 'archive'; title: string; channel: string | null; url: string }>;
  /** When nothing in India: subscription services in a few other countries (for "streaming in the US on …"). */
  elsewhere: Array<{ country: string; services: string[] }>;
  status: 'stream' | 'free' | 'rent' | 'none';
  checkedAt: string;
  note?: string;
}

const LOGO = 'https://image.tmdb.org/t/p/w92';
const ELSEWHERE = ['US', 'GB', 'CA', 'AU', 'SG', 'AE'];

/** Services that list the same title twice (e.g. "Netflix basic with Ads", "… Amazon Channel") → one name. */
export function cleanServiceName(n: string): string {
  return n
    .replace(/\s+(basic|standard)?\s*with ads$/i, '')
    .replace(/^Amazon Prime Video$/i, 'Prime Video')
    .replace(/\s+Amazon Channel$/i, '')
    .replace(/\s+Apple TV Channel$/i, '')
    .trim();
}

function services(list: any[] | undefined): WhereService[] {
  const out: WhereService[] = [];
  for (const p of [...(list || [])].sort((a, b) => (a?.display_priority ?? 99) - (b?.display_priority ?? 99))) {
    const name = typeof p?.provider_name === 'string' ? cleanServiceName(p.provider_name) : '';
    if (name && !out.some(o => o.name === name)) out.push({ name, logo: p.logo_path ? `${LOGO}${p.logo_path}` : null });
  }
  return out;
}

/** TMDB /{movie|tv}/{id}/watch/providers response → where to watch in `region`, plus a few other countries. */
export function parseWhere(resp: any, region = 'IN'): Omit<WhereResult, 'official' | 'checkedAt' | 'status'> {
  const all = resp?.results || {};
  const r = all[region] || {};
  const stream = services(r.flatrate);
  const free = services([...(r.free || []), ...(r.ads || [])]).filter(s => !stream.some(x => x.name === s.name));
  const rent = services(r.rent);
  const buy = services(r.buy).filter(s => !rent.some(x => x.name === s.name));
  const elsewhere: Array<{ country: string; services: string[] }> = [];
  if (!stream.length && !free.length) {
    for (const c of ELSEWHERE) {
      const s = services(all[c]?.flatrate).map(x => x.name);
      if (s.length) elsewhere.push({ country: c, services: s.slice(0, 3) });
    }
  }
  return { region, link: typeof r.link === 'string' ? r.link : null, stream, free, rent, buy, elsewhere };
}

export function whereStatus(w: Pick<WhereResult, 'stream' | 'free' | 'rent' | 'buy' | 'official'>): WhereResult['status'] {
  if (w.stream.length) return 'stream';
  if (w.free.length || w.official.length) return 'free';
  if (w.rent.length || w.buy.length) return 'rent';
  return 'none';
}

/** Licensed platforms & official stores (host suffix → name). Anything else gets a warning, never a suggestion. */
export const LEGAL_SOURCES: Array<[string, string]> = [
  ['netflix.com', 'Netflix'],
  ['primevideo.com', 'Prime Video'],
  ['amazon.in', 'Amazon'],
  ['amazon.com', 'Amazon'],
  ['hotstar.com', 'JioHotstar'],
  ['jiocinema.com', 'JioCinema'],
  ['zee5.com', 'ZEE5'],
  ['sonyliv.com', 'Sony LIV'],
  ['aha.video', 'aha'],
  ['sunnxt.com', 'Sun NXT'],
  ['mxplayer.in', 'MX Player'],
  ['airtelxstream.in', 'Airtel Xstream'],
  ['erosnow.com', 'Eros Now'],
  ['hoichoi.tv', 'hoichoi'],
  ['manoramamax.com', 'ManoramaMAX'],
  ['simplysouth.tv', 'Simply South'],
  ['lionsgateplay.com', 'Lionsgate Play'],
  ['mubi.com', 'MUBI'],
  ['apple.com', 'Apple TV'],
  ['tv.apple.com', 'Apple TV'],
  ['play.google.com', 'Google Play'],
  ['tubi.tv', 'Tubi'],
  ['crunchyroll.com', 'Crunchyroll'],
  ['disneyplus.com', 'Disney+'],
  ['max.com', 'Max'],
  ['hulu.com', 'Hulu'],
  ['paramountplus.com', 'Paramount+'],
  ['peacocktv.com', 'Peacock'],
  ['archive.org', 'Internet Archive (check it is marked public domain)'],
  ['themoviedb.org', 'TMDB where-to-watch page'],
  ['justwatch.com', 'JustWatch'],
];

export interface LinkCheck {
  ok: boolean;
  source: string | null;
  verdict: 'licensed' | 'official-channel' | 'check-channel' | 'unknown' | 'invalid';
  message: string;
}

/**
 * Is a link a licensed source? Known platforms → yes. YouTube → only if the channel is one of your approved official
 * channels (checked by the caller; here we just flag it). Anything else → "not a known licensed source".
 */
export function checkSourceLink(raw: string, officialYoutubeChannels: string[] = []): LinkCheck {
  let u: URL;
  try {
    u = new URL(raw.trim());
    if (!/^https?:$/.test(u.protocol)) throw new Error('protocol');
  } catch {
    return { ok: false, source: null, verdict: 'invalid', message: 'That doesn’t look like a web link.' };
  }
  const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, '');
  if (host === 'youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')) {
    const ch = officialYoutubeChannels.find(c => raw.includes(c));
    if (ch) return { ok: true, source: 'YouTube (official channel)', verdict: 'official-channel', message: 'Official channel you approved — fine to share.' };
    return { ok: false, source: 'YouTube', verdict: 'check-channel', message: 'YouTube link — only share it if it is the film’s official channel (producer, studio or label). Full movies on random channels are usually unlicensed.' };
  }
  const hit = LEGAL_SOURCES.find(([suffix]) => host === suffix || host.endsWith(`.${suffix}`));
  if (hit) return { ok: true, source: hit[1], verdict: 'licensed', message: `${hit[1]} — a licensed source.` };
  return { ok: false, source: null, verdict: 'unknown', message: 'Not a known licensed platform. Don’t share it unless you are sure the site has the rights — free “download” sites for new films are almost always pirated.' };
}
