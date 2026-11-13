/**
 * Automatic clip picking for trailer Reels — no AI, just signal analysis done by ffmpeg:
 *  - shot changes (scene detection) → clips start on a fresh shot and don't jump mid-clip,
 *  - black frames → never picked,
 *  - loudness every 0.5 s → louder moments (music hits, punch lines, action) score higher,
 *  - cut density → fast-cut action stretches score higher in "action" style,
 *  - studio logos at the start / release-date card at the end are skipped.
 * Picks are spread across the trailer and returned in story order. The user can still edit every clip.
 */
import type { TrailerClip } from './trailer-reel.util';

export interface TrailerAnalysis {
  cuts: number[];
  black: Array<[number, number]>;
  loudness: Array<{ t: number; db: number }>;
}

export type AutoStyle = 'action' | 'balanced' | 'story';
export interface AutoCutOptions {
  count: number;
  length: number;
  style: AutoStyle;
  skipStart: number;
  skipEnd: number;
}

const SCENE = 0.3;
const WINDOW = 0.5;

/** One ffmpeg pass: scene changes + black frames on a small copy of the picture, loudness of the sound every 0.5 s. */
export function analysisArgs(input: string, hasAudio: boolean): string[] {
  const args = ['-hide_banner', '-nostats', '-i', input, '-vf', `scale=320:-2,blackdetect=d=0.15:pix_th=0.10,select='gt(scene,${SCENE})',showinfo`];
  if (hasAudio) args.push('-af', `aresample=8000,asetnsamples=n=${8000 * WINDOW}:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level`);
  else args.push('-an');
  args.push('-f', 'null', '-');
  return args;
}

export function parseAnalysis(stderr: string): TrailerAnalysis {
  const cuts: number[] = [];
  const black: Array<[number, number]> = [];
  const loudness: Array<{ t: number; db: number }> = [];
  let pending: number | null = null;
  for (const line of stderr.split(/\r?\n/)) {
    if (line.includes('Parsed_showinfo')) {
      const m = line.match(/pts_time:\s*(-?[\d.]+)/);
      if (m) cuts.push(+m[1]);
    } else if (line.includes('black_start')) {
      const m = line.match(/black_start:\s*([\d.]+)\s+black_end:\s*([\d.]+)/);
      if (m) black.push([+m[1], +m[2]]);
    } else if (line.includes('Parsed_ametadata')) {
      const t = line.match(/pts_time:\s*(-?[\d.]+)/);
      if (t) pending = +t[1];
      const v = line.match(/RMS_level=(-?[\d.]+|-?inf|nan)/i);
      if (v && pending != null) {
        const db = Number(v[1]);
        loudness.push({ t: pending, db: Number.isFinite(db) ? Math.max(db, -90) : -90 });
        pending = null;
      }
    }
  }
  return { cuts: [...new Set(cuts.filter(c => c > 0).map(c => +c.toFixed(2)))].sort((a, b) => a - b), black, loudness };
}

const overlaps = (a: number, b: number, c: number, d: number) => a < d && c < b;

/** Choose clips from the analysis. Pure + deterministic, so the same trailer always gives the same picks. */
export function pickClips(a: TrailerAnalysis, duration: number, o: AutoCutOptions): TrailerClip[] {
  const count = Math.max(1, Math.min(12, Math.round(o.count)));
  const len = Math.max(1, Math.min(8, o.length));
  const lo = Math.min(o.skipStart, duration * 0.2);
  const hi = Math.max(lo + len, duration - Math.min(o.skipEnd, duration * 0.2));
  const minLen = Math.min(1, len);

  // Shots between scene changes.
  const bounds = [0, ...a.cuts.filter(c => c < duration), duration];
  type Cand = { start: number; end: number; score: number };
  const cands: Cand[] = [];
  const isBlack = (s: number, e: number) => a.black.some(([bs, be]) => Math.min(e, be) - Math.max(s, bs) > 0.04);
  const loudAt = (s: number, e: number) => {
    const w = a.loudness.filter(p => p.t + WINDOW > s && p.t < e);
    return w.length ? w.reduce((x, p) => x + p.db, 0) / w.length : null;
  };
  for (let i = 0; i < bounds.length - 1; i++) {
    const shotS = Math.max(bounds[i], lo);
    const shotE = Math.min(bounds[i + 1], hi);
    if (shotE - shotS < minLen) continue;
    // A long shot can give several clips; a short one gives one clip (may run into the next shot if it's very short).
    for (let s = shotS + 0.08; s + minLen <= shotE; s += Math.max(len, 2)) {
      let e = Math.min(s + len, shotE - 0.04);
      if (o.style === 'action' && e - s < len) e = Math.min(s + len, hi);
      if (e - s < minLen || isBlack(s, e)) continue;
      cands.push({ start: +s.toFixed(2), end: +e.toFixed(2), score: 0 });
    }
  }
  // Trailer with almost no shot changes detected → evenly spaced windows.
  if (cands.length < count) {
    const span = hi - lo;
    for (let k = 0; k < count * 3; k++) {
      const s = lo + (span - len) * ((k + 0.5) / (count * 3));
      if (s >= lo && s + len <= hi && !isBlack(s, s + len) && !cands.some(c => overlaps(c.start, c.end, s, s + len))) cands.push({ start: +s.toFixed(2), end: +(s + len).toFixed(2), score: 0 });
    }
  }
  if (!cands.length) return [];

  // Score: loudness (normalised to this trailer), cuts nearby (pace), and how much of the wanted length the clip fills.
  const louds = cands.map(c => loudAt(c.start, c.end));
  const known = louds.filter((x): x is number => x != null);
  const lMin = known.length ? Math.min(...known) : 0;
  const lMax = known.length ? Math.max(...known) : 0;
  const pace = cands.map(c => a.cuts.filter(t => t > c.start - 3 && t < c.end + 3).length);
  const pMax = Math.max(1, ...pace);
  const w = o.style === 'action' ? { loud: 0.45, pace: 0.4, fill: 0.15 } : o.style === 'story' ? { loud: 0.35, pace: 0, fill: 0.65 } : { loud: 0.5, pace: 0.2, fill: 0.3 };
  cands.forEach((c, i) => {
    const l = louds[i] == null || lMax === lMin ? 0.5 : (louds[i]! - lMin) / (lMax - lMin);
    c.score = w.loud * l + w.pace * (pace[i] / pMax) + w.fill * Math.min(1, (c.end - c.start) / len);
  });

  // Best first, but keep picks apart so they cover the whole trailer.
  const gap = Math.max(len * 0.5, ((hi - lo) / count) * 0.45);
  const picked: Cand[] = [];
  for (const c of [...cands].sort((x, y) => y.score - x.score || x.start - y.start)) {
    if (picked.length >= count) break;
    if (picked.some(p => Math.abs(p.start - c.start) < gap || overlaps(p.start, p.end, c.start, c.end))) continue;
    picked.push(c);
  }
  // Not enough far-apart picks (short trailer) → relax the gap.
  for (const c of [...cands].sort((x, y) => y.score - x.score)) {
    if (picked.length >= count) break;
    if (!picked.some(p => overlaps(p.start, p.end, c.start, c.end))) picked.push(c);
  }
  return picked.sort((x, y) => x.start - y.start).map(({ start, end }) => ({ start, end }));
}
