/**
 * ffmpeg command for a Reel cut from a trailer: chosen clips (in order) → 9:16, optional title overlay (transparent PNG),
 * optional intro / outro picture, and the trailer's sound, music, both mixed, or silence.
 */
import { FPS, H, W } from './reels.util';

export interface TrailerClip { start: number; end: number }
export type TrailerAudio = 'trailer' | 'music' | 'mix' | 'none';
export interface TrailerReelOptions {
  clips: TrailerClip[];
  framing: 'fit' | 'fill';
  audio: TrailerAudio;
  hasTrailerAudio: boolean;
  trailerVolume: number;
  music?: { path: string; start: number; volume: number } | null;
  fadeOut: number;
  overlay?: string | null;
  intro?: { path: string; seconds: number } | null;
  outro?: { path: string; seconds: number } | null;
}

export const trailerReelSeconds = (o: Pick<TrailerReelOptions, 'clips' | 'intro' | 'outro'>) =>
  o.clips.reduce((a, c) => a + (c.end - c.start), 0) + (o.intro?.seconds || 0) + (o.outro?.seconds || 0);

/** Parse "Duration: 00:02:31.45" and whether an audio stream exists, from `ffmpeg -i file` output. */
export function probeFromStderr(stderr: string): { duration: number | null; hasAudio: boolean; hasVideo: boolean } {
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return {
    duration: m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null,
    hasAudio: /Stream #\S+.*Audio:/.test(stderr),
    hasVideo: /Stream #\S+.*Video:/.test(stderr),
  };
}

const NORM_V = `fps=${FPS},format=yuv420p,setsar=1`;
const NORM_A = 'aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo';

export function trailerReelArgs(trailerPath: string, o: TrailerReelOptions, outPath: string): string[] {
  if (!o.clips.length) throw new Error('No clips');
  const total = trailerReelSeconds(o);
  // One input per clip, seeked straight to its start: ffmpeg then decodes only those seconds. (Trimming one shared
  // decode buffered every frame between clips in memory — gigabytes for HD trailers → x264 "malloc failed".)
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  for (const c of o.clips) args.push('-threads', '2', '-ss', c.start.toFixed(3), '-t', (c.end - c.start).toFixed(3), '-i', trailerPath);
  let idx = o.clips.length;
  const overlayIdx = o.overlay ? idx++ : -1;
  if (o.overlay) args.push('-i', o.overlay);
  const introIdx = o.intro ? idx++ : -1;
  if (o.intro) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(o.intro.seconds), '-i', o.intro.path);
  const outroIdx = o.outro ? idx++ : -1;
  if (o.outro) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(o.outro.seconds), '-i', o.outro.path);
  const useMusic = (o.audio === 'music' || o.audio === 'mix') && !!o.music;
  const musicIdx = useMusic ? idx++ : -1;
  if (useMusic) args.push('-stream_loop', '-1', '-ss', String(o.music!.start), '-i', o.music!.path);

  const f: string[] = [];
  const n = o.clips.length;
  const frame =
    o.framing === 'fill'
      ? `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},${NORM_V}`
      : null;
  o.clips.forEach((c, i) => {
    const len = (c.end - c.start).toFixed(3);
    const trim = `trim=duration=${len},setpts=PTS-STARTPTS`;
    if (frame) f.push(`[${i}:v]${trim},${frame}[cv${i}]`);
    else {
      f.push(`[${i}:v]${trim},split=2[b${i}][g${i}]`);
      // background blurred at quarter size, then scaled up — looks the same, a fraction of the memory/CPU
      f.push(`[b${i}]scale=${W / 4}:${H / 4}:force_original_aspect_ratio=increase,crop=${W / 4}:${H / 4},gblur=sigma=10,eq=brightness=-0.25,scale=${W}:${H}[bb${i}]`);
      f.push(`[g${i}]scale=${W}:-2[gg${i}]`);
      f.push(`[bb${i}][gg${i}]overlay=(W-w)/2:(H-h)/2,${NORM_V}[cv${i}]`);
    }
    // apad keeps the sound exactly as long as the picture even if the audio track ends early.
    if (o.hasTrailerAudio) f.push(`[${i}:a]asetpts=PTS-STARTPTS,${NORM_A},apad,atrim=duration=${len}[ca${i}]`);
    else f.push(`anullsrc=r=44100:cl=stereo,atrim=0:${len},${NORM_A}[ca${i}]`);
  });
  f.push(`${o.clips.map((_, i) => `[cv${i}][ca${i}]`).join('')}concat=n=${n}:v=1:a=1[clipv0][clipa]`);
  if (o.overlay) f.push(`[clipv0][${overlayIdx}:v]overlay=0:0:format=auto,${NORM_V}[clipv]`);
  else f.push(`[clipv0]null[clipv]`);

  const still = (inIdx: number, name: string, seconds: number) => {
    f.push(`[${inIdx}:v]split=2[${name}b][${name}f]`);
    f.push(`[${name}b]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=40,eq=brightness=-0.18[${name}bb]`);
    f.push(`[${name}f]scale=${W}:-2[${name}ff]`);
    f.push(`[${name}bb][${name}ff]overlay=(W-w)/2:(H-h)/2:shortest=1,${NORM_V}[${name}v]`);
    f.push(`anullsrc=r=44100:cl=stereo,atrim=0:${seconds},${NORM_A}[${name}a]`);
  };
  const parts: string[] = [];
  if (o.intro) { still(introIdx, 'in', o.intro.seconds); parts.push('[inv][ina]'); }
  parts.push('[clipv][clipa]');
  if (o.outro) { still(outroIdx, 'out', o.outro.seconds); parts.push('[outv][outa]'); }
  if (parts.length > 1) f.push(`${parts.join('')}concat=n=${parts.length}:v=1:a=1[vout][tra]`);
  else { f.push('[clipv]null[vout]'); f.push('[clipa]anull[tra]'); }

  const fade = Math.min(o.fadeOut, total / 2);
  const tail = `atrim=0:${total.toFixed(3)}${fade > 0 ? `,afade=t=out:st=${(total - fade).toFixed(3)}:d=${fade.toFixed(2)}` : ''}`;
  if (o.audio === 'none') f.push(`[tra]volume=0,${tail}[aout]`);
  else if (useMusic && o.audio === 'music') f.push(`[${musicIdx}:a]atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS,volume=${o.music!.volume.toFixed(2)},${NORM_A},${tail}[aout]`);
  else if (useMusic && o.audio === 'mix') {
    f.push(`[${musicIdx}:a]atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS,volume=${o.music!.volume.toFixed(2)},${NORM_A}[mus]`);
    f.push(`[tra]volume=${o.trailerVolume.toFixed(2)}[trv]`);
    f.push(`[trv][mus]amix=inputs=2:duration=first:normalize=0,${tail}[aout]`);
  } else f.push(`[tra]volume=${o.trailerVolume.toFixed(2)},${tail}[aout]`);

  args.push('-filter_complex', f.join(';'), '-map', '[vout]', '-map', '[aout]');
  args.push('-c:v', 'libx264', '-threads', '4', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-profile:v', 'high', '-level', '4.1');
  args.push('-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-t', total.toFixed(3), '-movflags', '+faststart', outPath);
  return args;
}
