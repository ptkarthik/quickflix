/**
 * Pure helpers for Reels: the free music library and the ffmpeg command line.
 */

export interface MusicTrack {
  id: string;
  title: string;
  mood: string;
  /** what to credit in the caption (Creative Commons BY 4.0 requires it) */
  credit: string;
  url: string;
}

const KM = (title: string, mood: string): MusicTrack => ({
  id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  title,
  mood,
  credit: `Music: “${title}” by Kevin MacLeod (incompetech.com), licensed under CC BY 4.0 — creativecommons.org/licenses/by/4.0`,
  url: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(title)}.mp3`,
});

/** Royalty-free tracks (Kevin MacLeod, CC BY 4.0 — free to use with credit). Moods are a rough guide; preview before use. */
export const MUSIC_LIBRARY: MusicTrack[] = [
  KM('Investigations', 'Thriller / mystery'),
  KM('Hitman', 'Thriller / mystery'),
  KM('Dark Fog', 'Thriller / mystery'),
  KM('Lightless Dawn', 'Thriller / mystery'),
  KM('Volatile Reaction', 'Action / epic'),
  KM('Five Armies', 'Action / epic'),
  KM('Heroic Age', 'Action / epic'),
  KM('Clash Defiant', 'Action / epic'),
  KM('Crusade', 'Action / epic'),
  KM('Achilles', 'Action / epic'),
  KM('Impact Moderato', 'Action / epic'),
  KM('Sneaky Snitch', 'Fun / comedy'),
  KM('Monkeys Spinning Monkeys', 'Fun / comedy'),
  KM('Fluffing a Duck', 'Fun / comedy'),
  KM('Life of Riley', 'Fun / comedy'),
  KM('Carefree', 'Fun / comedy'),
  KM('Easy Lemon', 'Fun / comedy'),
  KM('Hyperfun', 'Fun / comedy'),
  KM('Daily Beetle', 'Fun / comedy'),
  KM('Sneaky Adventure', 'Fun / comedy'),
  KM('Funkorama', 'Funk / groove'),
  KM('Gothamlicious', 'Funk / groove'),
  KM('Cut and Run', 'Funk / groove'),
  KM('Local Forecast - Elevator', 'Funk / groove'),
  KM('Dreamy Flashback', 'Calm / emotional'),
  KM('Enchanted Valley', 'Calm / emotional'),
  KM('Inspired', 'Calm / emotional'),
  KM('Wallpaper', 'Calm / emotional'),
  KM('Overcast', 'Calm / emotional'),
  KM('Unwritten Return', 'Calm / emotional'),
  KM('Rising Tide', 'Calm / emotional'),
  KM('Bit Shift', 'Electronic / retro'),
  KM('Neon Laser Horizon', 'Electronic / retro'),
  KM('Aitech', 'Electronic / retro'),
  KM('Movement Proposition', 'Electronic / retro'),
  KM('Rocket', 'Electronic / retro'),
  KM('Desert City', 'World / folk'),
  KM('Thatched Villagers', 'World / folk'),
  KM('Ancient Rite', 'World / folk'),
];

/** ffmpeg xfade transitions we offer, plus 'mixed' (a different one at every cut) and 'none' (straight cut). */
export const XFADES = [
  'fade', 'fadeblack', 'fadewhite', 'dissolve', 'slideleft', 'slideup', 'smoothleft', 'smoothup', 'wipeleft', 'wipeup',
  'circleopen', 'circleclose', 'radial', 'pixelize', 'zoomin', 'hblur', 'squeezeh', 'diagtl', 'horzopen', 'vertopen',
] as const;
export type Transition = (typeof XFADES)[number] | 'mixed' | 'none';
export const TRANSITIONS: Transition[] = [...XFADES, 'mixed', 'none'];
/** 'mixed' cycles through these (all look good on posters) */
const MIXED: Array<(typeof XFADES)[number]> = ['smoothleft', 'circleopen', 'zoomin', 'slideup', 'fadewhite', 'radial', 'wipeleft', 'dissolve'];
export const transitionAt = (t: Transition, cut: number) => (t === 'mixed' ? MIXED[cut % MIXED.length] : t);

/** Colour / film looks for the whole video. */
export const EFFECTS = ['none', 'cinematic', 'warm', 'cool', 'punchy', 'bw', 'vintage', 'grain', 'vignette'] as const;
export type Effect = (typeof EFFECTS)[number];
export function effectFilter(e: Effect | undefined | null): string | null {
  switch (e) {
    case 'cinematic': return 'eq=contrast=1.08:saturation=1.08:gamma=0.97,vignette=PI/5';
    case 'warm': return 'colorbalance=rs=0.07:gs=0.02:bs=-0.07:rm=0.04:bm=-0.04,eq=saturation=1.1';
    case 'cool': return 'colorbalance=rs=-0.05:bs=0.08:bm=0.04,eq=saturation=1.05';
    case 'punchy': return 'eq=contrast=1.15:saturation=1.3:brightness=0.02';
    case 'bw': return 'hue=s=0,eq=contrast=1.12';
    case 'vintage': return 'curves=preset=vintage,noise=alls=8:allf=t,vignette=PI/4';
    case 'grain': return 'noise=alls=12:allf=t+u';
    case 'vignette': return 'vignette=PI/4';
    default: return null;
  }
}

/** How each picture moves: zoom in, zoom out, alternate, or a slow pan. */
export type MotionStyle = 'in' | 'out' | 'alt' | 'pan';
export const MOTION_STYLES: MotionStyle[] = ['in', 'out', 'alt', 'pan'];

export interface ReelOptions {
  /** seconds each slide is on screen */
  durations: number[];
  transition: Transition;
  /** slow zoom on each picture */
  motion: boolean;
  motionStyle?: MotionStyle;
  effect?: Effect;
  /** music: none, or a file given as an ffmpeg input */
  audio?: { path: string; start: number; volume: number; fadeOut: number } | null;
}

export const FPS = 30;
export const W = 1080;
export const H = 1920;
const T = 0.6; // transition length, seconds

export const clamp = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};

/** Total length of the Reel in seconds (transitions overlap neighbouring slides). */
export function totalSeconds(durations: number[], transition: Transition) {
  const sum = durations.reduce((a, b) => a + b, 0);
  return transition === 'none' || durations.length < 2 ? sum : sum - T * (durations.length - 1);
}

/**
 * ffmpeg arguments: every 4:5 slide is centred on a blurred copy of itself to fill 9:16 (Instagram Reels),
 * with an optional slow zoom, transitions between slides, and music trimmed / faded to the video length.
 * Silent Reels still get a silent audio track (better compatibility).
 */
export function ffmpegArgs(slidePaths: string[], o: ReelOptions, outPath: string): string[] {
  const n = slidePaths.length;
  if (!n) throw new Error('No slides');
  const args: string[] = ['-y', '-hide_banner', '-loglevel', 'error'];
  slidePaths.forEach((p, i) => args.push('-loop', '1', '-framerate', String(FPS), '-t', String(o.durations[i]), '-i', p));
  const total = totalSeconds(o.durations, o.transition);
  const audioIndex = n;
  if (o.audio) args.push('-stream_loop', '-1', '-ss', String(o.audio.start), '-i', o.audio.path);
  else args.push('-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=r=44100:cl=stereo');

  const f: string[] = [];
  for (let i = 0; i < n; i++) {
    const frames = Math.round(o.durations[i] * FPS);
    f.push(`[${i}:v]split=2[bg${i}][fg${i}]`);
    f.push(`[bg${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=40,eq=brightness=-0.18:saturation=1.1[bgb${i}]`);
    const style = o.motionStyle === 'alt' ? (i % 2 ? 'out' : 'in') : o.motionStyle || 'in';
    const zoom =
      style === 'out' ? `z='1.08-0.08*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`
        : style === 'pan' ? `z='1.1':x='(iw-iw/zoom)*(${i % 2 ? '1-' : ''}on/${frames})':y='ih/2-(ih/zoom/2)'`
          : `z='1+0.07*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
    const fg = o.motion
      ? `[fg${i}]scale=2160:2700,zoompan=${zoom}:d=1:s=1080x1350:fps=${FPS}[fgz${i}]`
      : `[fg${i}]scale=1080:1350[fgz${i}]`;
    f.push(fg);
    f.push(`[bgb${i}][fgz${i}]overlay=(W-w)/2:(H-h)/2:shortest=1,fps=${FPS},format=yuv420p,setsar=1,settb=1/${FPS}[v${i}]`);
  }
  const fx = effectFilter(o.effect);
  const VOUT = fx ? 'vraw' : 'vout';
  if (n === 1) f.push(`[v0]null[${VOUT}]`);
  else if (o.transition === 'none') f.push(`${Array.from({ length: n }, (_, i) => `[v${i}]`).join('')}concat=n=${n}:v=1:a=0[${VOUT}]`);
  else {
    let prev = 'v0';
    let offset = 0;
    for (let i = 1; i < n; i++) {
      offset += o.durations[i - 1] - T;
      const out = i === n - 1 ? VOUT : `x${i}`;
      f.push(`[${prev}][v${i}]xfade=transition=${transitionAt(o.transition, i - 1)}:duration=${T}:offset=${offset.toFixed(3)}[${out}]`);
      prev = out;
    }
  }
  if (fx) f.push(`[vraw]${fx},format=yuv420p[vout]`);
  if (o.audio) {
    const fade = Math.min(o.audio.fadeOut, total / 2);
    f.push(`[${audioIndex}:a]atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS,volume=${o.audio.volume.toFixed(2)},afade=t=in:st=0:d=0.4${fade > 0 ? `,afade=t=out:st=${(total - fade).toFixed(3)}:d=${fade.toFixed(2)}` : ''}[aout]`);
  } else f.push(`[${audioIndex}:a]anull[aout]`);

  args.push('-filter_complex', f.join(';'), '-map', '[vout]', '-map', '[aout]');
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-profile:v', 'high', '-level', '4.1');
  args.push('-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-t', total.toFixed(3), '-movflags', '+faststart', outPath);
  return args;
}
