/**
 * "Load from link" for trailer Reels: turns share links into direct-download links and refuses links we must not
 * download from (YouTube and social platforms forbid downloading in their terms) or that point inside this network.
 */
import * as net from 'node:net';

export type LinkCheck = { ok: true; url: string; note?: string } | { ok: false; message: string };

const BLOCKED: Array<{ re: RegExp; name: string }> = [
  { re: /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com|googlevideo\.com|ytimg\.com)$/i, name: 'YouTube' },
  { re: /(^|\.)(instagram\.com|cdninstagram\.com|facebook\.com|fb\.watch|fbcdn\.net)$/i, name: 'Instagram / Facebook' },
  { re: /(^|\.)(tiktok\.com|twitter\.com|x\.com|twimg\.com|threads\.net|snapchat\.com|sharechat\.com|mojapp\.in|dailymotion\.com)$/i, name: 'that platform' },
  { re: /(^|\.)(netflix\.com|primevideo\.com|hotstar\.com|jiocinema\.com|zee5\.com|sonyliv\.com|aha\.video|sunnxt\.com)$/i, name: 'a streaming service' },
];

/** Normalise + check a pasted link. Doesn't touch the network. */
export function checkVideoLink(raw: string): LinkCheck {
  let u: URL;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    return { ok: false, message: 'That isn’t a valid link — paste the full address starting with https://' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, message: 'Only http(s) links can be loaded.' };
  if (u.username || u.password) return { ok: false, message: 'Links with a username/password can’t be loaded.' };
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const b = BLOCKED.find(x => x.re.test(host));
  if (b) {
    return {
      ok: false,
      message: `Videos can’t be downloaded from ${b.name} — its terms don’t allow it. Ask the studio / PR team for the trailer file (Drive, WeTransfer, press kit) and paste that link, or choose the file.`,
    };
  }
  if (isPrivateHost(host)) return { ok: false, message: 'That link points to this computer / local network — use a public link.' };

  // Google Drive share link → direct download (confirm=t skips the "can't scan for viruses" page on big files).
  const drive = host === 'drive.google.com' && (u.pathname.match(/\/file\/d\/([\w-]{10,})/)?.[1] || (u.pathname.startsWith('/open') || u.pathname.startsWith('/uc') ? u.searchParams.get('id') : null));
  if (drive) return { ok: true, url: `https://drive.usercontent.google.com/download?id=${drive}&export=download&confirm=t`, note: 'Google Drive' };
  // Dropbox share link → raw file.
  if (/(^|\.)dropbox\.com$/.test(host)) {
    u.searchParams.delete('dl');
    u.searchParams.set('raw', '1');
    return { ok: true, url: u.toString(), note: 'Dropbox' };
  }
  // OneDrive / SharePoint short share links → download.
  if (/(^|\.)(1drv\.ms|onedrive\.live\.com)$/.test(host) || /sharepoint\.com$/.test(host)) {
    if (!u.searchParams.has('download')) u.searchParams.set('download', '1');
    return { ok: true, url: u.toString(), note: 'OneDrive' };
  }
  // archive.org /details/ page → can't know the file; tell the user.
  if (/(^|\.)archive\.org$/.test(host) && u.pathname.startsWith('/details/')) {
    return { ok: false, message: 'That’s the archive.org page — open “DOWNLOAD OPTIONS”, right-click the MPEG4 file and copy its link.' };
  }
  return { ok: true, url: u.toString() };
}

/** localhost, private, link-local, CGNAT and other non-public addresses. */
export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const v = net.isIP(h);
  if (v === 4) {
    const [a, b] = h.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b < 128) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168) || a >= 224;
  }
  if (v === 6) {
    if (h === '::' || h === '::1') return true;
    const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateHost(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb)/.test(h);
  }
  return false;
}

/** Is this a video file? (MP4/MOV ftyp, WebM/MKV EBML, AVI, MPEG-TS, FLV) */
export function looksLikeVideo(head: Buffer): boolean {
  if (head.length < 12) return false;
  if (head.subarray(4, 8).toString('latin1') === 'ftyp') return true;
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return true;
  if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'AVI ') return true;
  if (head[0] === 0x47 && (head.length < 189 || head[188] === 0x47)) return true;
  if (head.subarray(0, 3).toString('latin1') === 'FLV') return true;
  // Some MP4s start with a 'moov'/'mdat'/'free'/'wide' box instead of ftyp.
  return ['moov', 'mdat', 'free', 'wide', 'skip'].includes(head.subarray(4, 8).toString('latin1'));
}

/** File name from Content-Disposition or the URL. */
export function fileNameFrom(disposition: string | null, url: string): string {
  const star = disposition?.match(/filename\*=(?:UTF-8'')?([^;]+)/i)?.[1];
  const plain = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
  let n = '';
  try {
    n = star ? decodeURIComponent(star.trim().replace(/^"|"$/g, '')) : plain || decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
  } catch {
    n = plain || '';
  }
  n = n.replace(/[^\w.\- ()]+/g, '_').slice(0, 120);
  if (!/\.(mp4|mov|m4v|webm|mkv|avi|ts|flv)$/i.test(n)) n = `${n || 'trailer'}.mp4`;
  return n;
}
