/** Pure helpers for the Watch Free site (parsing YouTube / Internet Archive data, building the site data). */

/** ISO-8601 duration ("PT1H52M10S") → minutes (rounded). */
export function isoMinutes(iso?: string | null): number | null {
  const m = (iso || '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, d, h, mi, s] = m.map(x => Number(x || 0));
  const total = d * 1440 + h * 60 + mi + s / 60;
  return total > 0 ? Math.round(total) : null;
}

/** Internet Archive runtime ("01:12:33", "72 min", "1h 12m", "4353") → minutes. */
export function archiveMinutes(r?: string | string[] | null): number | null {
  const v = (Array.isArray(r) ? r[0] : r || '').trim();
  if (!v) return null;
  let m = v.match(/^(\d{1,2}):(\d{2}):(\d{2})/);
  if (m) return Math.round(+m[1] * 60 + +m[2] + +m[3] / 60);
  m = v.match(/^(\d{1,3}):(\d{2})$/);
  if (m) return Math.round(+m[1] + +m[2] / 60);
  m = v.match(/(\d+)\s*h(?:ours?|rs?)?\s*(\d+)?/i);
  if (m) return +m[1] * 60 + (m[2] ? +m[2] : 0);
  m = v.match(/^(\d+)\s*(?:min|mins|minutes|m)\b/i);
  if (m) return +m[1];
  if (/^\d+$/.test(v)) return +v > 400 ? Math.round(+v / 60) : +v; // bare seconds or minutes
  return null;
}

/** Only the explicit public-domain marks count (not "no known copyright" guesses). */
export const isPublicDomain = (license?: string | null) => /creativecommons\.org\/(publicdomain\/(mark|zero)|licenses\/publicdomain)/i.test(license || '');

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** An Internet Archive search doc → FreeVideo fields (null when it isn't marked public domain). */
export function mapArchiveDoc(d: any) {
  const license = String(first(d?.licenseurl) || '');
  if (!d?.identifier || !isPublicDomain(license)) return null;
  const year = Number(String(first(d.year) || first(d.date) || '').slice(0, 4));
  return {
    source: 'archive',
    externalId: String(d.identifier),
    title: String(first(d.title) || d.identifier).slice(0, 200),
    channel: 'Internet Archive',
    year: year > 1880 && year < 2100 ? year : null,
    minutes: archiveMinutes(first(d.runtime)),
    thumbnail: `https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,
    description: d.description ? stripHtml(String(first(d.description))).slice(0, 600) : null,
    language: first(d.language) ? String(first(d.language)).slice(0, 40) : null,
    license,
    embeddable: true,
    views: typeof d.downloads === 'number' ? d.downloads : null,
  };
}

/** A YouTube videos.list item → FreeVideo fields, or null if it isn't a full-length film we may show in India. */
export function mapYoutubeVideo(v: any, minMinutes = 60) {
  const minutes = isoMinutes(v?.contentDetails?.duration);
  if (!v?.id || !minutes || minutes < minMinutes) return null;
  if (v.snippet?.liveBroadcastContent && v.snippet.liveBroadcastContent !== 'none') return null;
  if (v.status?.privacyStatus && v.status.privacyStatus !== 'public') return null;
  const rr = v.contentDetails?.regionRestriction;
  if (rr?.blocked?.includes('IN') || (rr?.allowed && !rr.allowed.includes('IN'))) return null; // not watchable in India
  const th = v.snippet?.thumbnails || {};
  return {
    source: 'youtube',
    externalId: String(v.id),
    title: String(v.snippet?.title || '').slice(0, 200),
    channel: v.snippet?.channelTitle || null,
    channelId: v.snippet?.channelId || null,
    year: null as number | null,
    minutes,
    thumbnail: (th.maxres || th.high || th.medium || th.default)?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
    description: v.snippet?.description ? String(v.snippet.description).slice(0, 600) : null,
    language: v.snippet?.defaultAudioLanguage || v.snippet?.defaultLanguage || null,
    embeddable: v.status?.embeddable !== false,
    views: v.statistics?.viewCount ? Number(v.statistics.viewCount) : null,
    publishedAt: v.snippet?.publishedAt || null,
  };
}

/** "https://www.youtube.com/@RajshriFilms", "@x", ".../channel/UC…" → what to look up. */
export function parseChannelRef(input: string): { id?: string; handle?: string } | null {
  const s = input.trim();
  let m = s.match(/(UC[A-Za-z0-9_-]{22})/);
  if (m) return { id: m[1] };
  m = s.match(/(?:youtube\.com\/)?(@[A-Za-z0-9._-]{2,100})/);
  if (m) return { handle: m[1] };
  return null;
}

/** Best official trailer from TMDB /videos (YouTube, official, Trailer > Teaser, newest). */
export function pickTrailer(results: any[], lang?: string | null): string | null {
  const vids = (results || []).filter(v => v?.site === 'YouTube' && v.key && ['Trailer', 'Teaser'].includes(v.type));
  if (!vids.length) return null;
  const score = (v: any) => (v.official ? 4 : 0) + (v.type === 'Trailer' ? 2 : 0) + (lang && v.iso_639_1 === lang ? 1 : 0);
  return vids.sort((a, b) => score(b) - score(a) || String(b.published_at || '').localeCompare(String(a.published_at || '')))[0].key;
}

/** Make JSON safe to drop inside a <script> tag. */
export const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
