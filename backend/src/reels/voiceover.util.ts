/**
 * Your voice (and optionally your face) over a finished Reel: one browser recording (WebM, mic ± webcam) laid over the
 * Reel MP4 — optional talk-to-camera intro, webcam picture-in-picture, voice cleaned up, music/trailer sound ducked under it.
 */
import { FPS, H, W } from './reels.util';

export type CamShape = 'circle' | 'box';
export type CamPos = 'br' | 'bl' | 'tr' | 'tl' | 'bc';
export interface VoiceoverOptions {
  /** seconds of the recording before the Reel started playing (= the intro, or just start-up delay) */
  split: number;
  /** keep that first part as a full-screen talk-to-camera intro */
  intro: boolean;
  /** the recording has a camera track */
  hasCam: boolean;
  /** show the webcam over the Reel */
  pip: { shape: CamShape; pos: CamPos; size: number } | null;
  mirror: boolean;
  voiceVolume: number;
  /** level of the Reel's own sound (music / trailer) while you talk; it also ducks automatically under your voice */
  bgVolume: number;
  /** length of the Reel (from probing it) */
  reelSeconds: number;
  /** the Reel has an audio track */
  reelHasAudio: boolean;
  /** "Hold": at Reel time `at` you paused it and kept talking for `dur` seconds → that frame is held, the Reel gets longer */
  holds?: Hold[];
}
export interface Hold { at: number; dur: number }

/** Sorted, inside the Reel, merged when they're at the same spot. */
export function cleanHolds(raw: unknown, reelSeconds: number): Hold[] {
  const list = (Array.isArray(raw) ? raw : [])
    .map(h => ({ at: Number((h as Hold)?.at), dur: Number((h as Hold)?.dur) }))
    .filter(h => Number.isFinite(h.at) && Number.isFinite(h.dur) && h.dur >= 0.2)
    .map(h => ({ at: Math.max(0.05, Math.min(reelSeconds - 0.05, h.at)), dur: Math.min(60, h.dur) }))
    .sort((a, b) => a.at - b.at);
  const out: Hold[] = [];
  for (const h of list) {
    const last = out[out.length - 1];
    if (last && h.at - last.at < 0.15) last.dur = Math.min(120, last.dur + h.dur);
    else out.push({ ...h });
  }
  return out.slice(0, 30);
}
export const holdSeconds = (holds?: Hold[]) => (holds || []).reduce((a, h) => a + h.dur, 0);

/**
 * The Reel with each hold inserted: the picture freezes on that frame for the hold, the Reel's own sound
 * fades out, pauses and fades back in. → [bv] (and [ba] when the Reel has sound)
 */
export function holdFilters(holds: Hold[], D: number, hasAudio: boolean): string[] {
  const cuts = [0, ...holds.map(h => h.at), D];
  const k = cuts.length - 1;
  const f: string[] = [`[0:v]fps=${FPS},split=${k}${Array.from({ length: k }, (_, i) => `[hs${i}]`).join('')}`];
  for (let i = 0; i < k; i++) {
    const hold = holds[i];
    f.push(`[hs${i}]trim=start=${cuts[i].toFixed(3)}:end=${cuts[i + 1].toFixed(3)},setpts=PTS-STARTPTS${hold ? `,tpad=stop_mode=clone:stop_duration=${hold.dur.toFixed(3)}` : ''},format=yuv420p,setsar=1[hv${i}]`);
  }
  f.push(`${Array.from({ length: k }, (_, i) => `[hv${i}]`).join('')}concat=n=${k}:v=1:a=0[bv]`);
  if (hasAudio) {
    f.push(`[0:a]${NORM_A},asplit=${k}${Array.from({ length: k }, (_, i) => `[ha${i}]`).join('')}`);
    for (let i = 0; i < k; i++) {
      const len = cuts[i + 1] - cuts[i];
      const fade = Math.min(0.3, len / 3);
      const hold = holds[i];
      const fades = [i > 0 ? `afade=t=in:st=0:d=${fade.toFixed(3)}` : '', hold ? `afade=t=out:st=${(len - fade).toFixed(3)}:d=${fade.toFixed(3)}` : ''].filter(Boolean).join(',');
      f.push(`[ha${i}]atrim=start=${cuts[i].toFixed(3)}:end=${cuts[i + 1].toFixed(3)},asetpts=PTS-STARTPTS${fades ? `,${fades}` : ''}${hold ? `,apad=pad_dur=${hold.dur.toFixed(3)}` : ''}[hb${i}]`);
    }
    f.push(`${Array.from({ length: k }, (_, i) => `[hb${i}]`).join('')}concat=n=${k}:v=0:a=1[ba]`);
  }
  return f;
}

const MARGIN_X = 48;
const TOP = 170; // clear of Instagram's top bar
const BOTTOM = 330; // clear of the caption / buttons at the bottom of a Reel

export function pipBox(o: { shape: CamShape; pos: CamPos; size: number }) {
  const w = Math.round(Math.max(200, Math.min(560, o.size)) / 2) * 2;
  const h = o.shape === 'circle' ? w : Math.round((w * 4) / 3 / 2) * 2;
  const x = o.pos === 'bl' || o.pos === 'tl' ? MARGIN_X : o.pos === 'bc' ? Math.round((W - w) / 2) : W - MARGIN_X - w;
  const y = o.pos === 'tr' || o.pos === 'tl' ? TOP : H - BOTTOM - h;
  return { w, h, x, y };
}

const VOICE = (vol: number) => `highpass=f=80,afftdn=nf=-25,acompressor=threshold=0.1:ratio=3:attack=10:release=200,loudnorm=I=-16:TP=-1.5:LRA=11,volume=${vol.toFixed(2)},aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo`;
const NORM_A = 'aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo';

export function voiceoverArgs(reelPath: string, recPath: string, o: VoiceoverOptions, outPath: string): string[] {
  const split = Math.max(0, o.split);
  const holds = o.holds || [];
  // with holds the Reel itself gets longer (frozen frames while you talk)
  const D = o.reelSeconds + holdSeconds(holds);
  const V0 = holds.length ? '[bv]' : '[0:v]';
  const A0 = holds.length ? '[ba]' : '[0:a]';
  const introLen = o.intro ? split : 0;
  const total = introLen + D;
  const f: string[] = holds.length ? holdFilters(holds, o.reelSeconds, o.reelHasAudio) : [];
  const flip = o.mirror ? 'hflip,' : '';

  // voice: the part recorded while the Reel played → cleaned, padded to the Reel's length
  f.push(`[1:a]asplit=2[recA][recB]`);
  f.push(`[recA]atrim=start=${split.toFixed(3)},asetpts=PTS-STARTPTS,${VOICE(o.voiceVolume)},apad,atrim=0:${D.toFixed(3)},asplit=2[voiceMix][voiceKey]`);
  // the Reel's own sound, ducked under the voice
  if (o.reelHasAudio) {
    f.push(`${A0}${NORM_A},volume=${o.bgVolume.toFixed(2)}[bg]`);
    f.push(`[bg][voiceKey]sidechaincompress=threshold=0.03:ratio=8:attack=15:release=350[ducked]`);
    f.push(`[ducked][voiceMix]amix=inputs=2:duration=first:normalize=0,atrim=0:${D.toFixed(3)}[mainA]`);
  } else {
    f.push(`[voiceKey]anullsink`);
    f.push(`[voiceMix]anull[mainA]`);
  }

  // picture: the Reel, with your webcam on top
  if (o.hasCam && o.pip) {
    const b = pipBox(o.pip);
    f.push(`[1:v]split=2[camA][camB]`);
    const cam = `[camA]trim=start=${split.toFixed(3)},setpts=PTS-STARTPTS,fps=${FPS},${flip}scale=${b.w}:${b.h}:force_original_aspect_ratio=increase,crop=${b.w}:${b.h}`;
    if (o.pip.shape === 'circle') {
      const r = b.w / 2;
      f.push(`${cam},format=yuva420p,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lte(hypot(X-${r},Y-${r}),${r - 2}),255,0)'[pip]`);
    } else {
      f.push(`${cam},pad=${b.w + 8}:${b.h + 8}:4:4:color=white[pip]`);
    }
    f.push(`${V0}[pip]overlay=${b.x}:${b.y}:eof_action=pass:format=auto,fps=${FPS},format=yuv420p,setsar=1[mainV]`);
    if (!o.intro) f.push(`[camB]nullsink`);
  } else {
    f.push(`${V0}fps=${FPS},format=yuv420p,setsar=1[mainV]`);
  }

  // optional talk-to-camera intro (the first part of the recording, full screen)
  if (o.intro && introLen > 0.3) {
    if (o.hasCam) {
      const src = o.pip ? '[camB]' : '[1:v]';
      f.push(`${src}trim=0:${introLen.toFixed(3)},setpts=PTS-STARTPTS,fps=${FPS},${flip}scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},format=yuv420p,setsar=1[introV]`);
    } else {
      f.push(`color=c=black:s=${W}x${H}:r=${FPS}:d=${introLen.toFixed(3)},format=yuv420p,setsar=1[introV]`);
    }
    f.push(`[recB]atrim=0:${introLen.toFixed(3)},asetpts=PTS-STARTPTS,${VOICE(o.voiceVolume)},apad,atrim=0:${introLen.toFixed(3)}[introA]`);
    f.push(`[introV][introA][mainV][mainA]concat=n=2:v=1:a=1[vout][aout]`);
  } else {
    f.push(`[recB]anullsink`);
    if (o.hasCam && o.pip && o.intro) f.push(`[camB]nullsink`);
    f.push(`[mainV]null[vout]`, `[mainA]anull[aout]`);
  }

  return [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', reelPath,
    '-i', recPath,
    '-filter_complex', f.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-threads', '4', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-profile:v', 'high', '-level', '4.1',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '44100',
    '-t', total.toFixed(3), '-movflags', '+faststart', outPath,
  ];
}
