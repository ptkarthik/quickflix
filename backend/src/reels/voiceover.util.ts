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
  const D = o.reelSeconds;
  const introLen = o.intro ? split : 0;
  const total = introLen + D;
  const f: string[] = [];
  const flip = o.mirror ? 'hflip,' : '';

  // voice: the part recorded while the Reel played → cleaned, padded to the Reel's length
  f.push(`[1:a]asplit=2[recA][recB]`);
  f.push(`[recA]atrim=start=${split.toFixed(3)},asetpts=PTS-STARTPTS,${VOICE(o.voiceVolume)},apad,atrim=0:${D.toFixed(3)},asplit=2[voiceMix][voiceKey]`);
  // the Reel's own sound, ducked under the voice
  if (o.reelHasAudio) {
    f.push(`[0:a]${NORM_A},volume=${o.bgVolume.toFixed(2)}[bg]`);
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
    f.push(`[0:v][pip]overlay=${b.x}:${b.y}:eof_action=pass:format=auto,fps=${FPS},format=yuv420p,setsar=1[mainV]`);
    if (!o.intro) f.push(`[camB]nullsink`);
  } else {
    f.push(`[0:v]fps=${FPS},format=yuv420p,setsar=1[mainV]`);
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
