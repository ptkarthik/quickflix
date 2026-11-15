import { effectFilter, ffmpegArgs, transitionAt } from './reels.util';
import { trailerReelArgs, trailerReelSeconds } from './trailer-reel.util';
import { cleanHolds, holdFilters, holdSeconds, voiceoverArgs } from './voiceover.util';

const fcOf = (a: string[]) => a[a.indexOf('-filter_complex') + 1];

describe('reel extras', () => {
  it('mixed transitions change at every cut; effects add a colour look', () => {
    expect(transitionAt('mixed', 0)).not.toBe(transitionAt('mixed', 1));
    expect(transitionAt('fade', 3)).toBe('fade');
    const fc = fcOf(ffmpegArgs(['a.jpg', 'b.jpg', 'c.jpg'], { durations: [3, 3, 3], transition: 'mixed', motion: true, motionStyle: 'alt', effect: 'warm' }, 'o.mp4'));
    expect(fc).toContain('xfade=transition=smoothleft');
    expect(fc).toContain('xfade=transition=circleopen');
    expect(fc).toContain("z='1.08-0.08*on/"); // second picture zooms out
    expect(fc).toContain(`[vraw]${effectFilter('warm')},format=yuv420p[vout]`);
    expect(effectFilter('none')).toBeNull();
  });

  it('cleans holds: inside the Reel, sorted, merged when at the same spot', () => {
    const h = cleanHolds([{ at: 9, dur: 2 }, { at: 3, dur: 4 }, { at: 3.05, dur: 1 }, { at: 50, dur: 3 }, { at: 1, dur: 0.1 }, 'x'], 15);
    expect(h).toEqual([{ at: 3, dur: 5 }, { at: 9, dur: 2 }, { at: 14.95, dur: 3 }]);
    expect(holdSeconds(h)).toBe(10);
  });

  it('a hold freezes the frame and pauses the Reel sound; the voice-over gets longer', () => {
    const f = holdFilters([{ at: 4, dur: 6 }], 15, true).join(';');
    expect(f).toContain('trim=start=0.000:end=4.000,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=6.000');
    expect(f).toContain('apad=pad_dur=6.000');
    expect(f).toContain('concat=n=2:v=1:a=0[bv]');
    const a = voiceoverArgs('r.mp4', 'v.webm', { split: 0, intro: false, hasCam: false, pip: null, mirror: true, voiceVolume: 1, bgVolume: 0.5, reelSeconds: 15, reelHasAudio: true, holds: [{ at: 4, dur: 6 }] }, 'o.mp4');
    expect(fcOf(a)).toContain('[bv]fps=30');
    expect(fcOf(a)).toContain('[ba]aresample');
    expect(a[a.indexOf('-t') + 1]).toBe('21.000');
  });

  it('trailer reels: signature card at the start or the end', () => {
    const base = { clips: [{ start: 1, end: 3 }], framing: 'fit' as const, audio: 'trailer' as const, hasTrailerAudio: true, trailerVolume: 1, fadeOut: 1 };
    const sig = { path: 's.jpg', seconds: 2.5, at: 'end' as const };
    expect(trailerReelSeconds({ ...base, signature: sig })).toBe(4.5);
    expect(fcOf(trailerReelArgs('t.mp4', { ...base, signature: sig, outro: { path: 'o.jpg', seconds: 3 } }, 'x.mp4'))).toContain('[clipv][clipa][sigv][siga][outv][outa]concat=n=3');
    expect(fcOf(trailerReelArgs('t.mp4', { ...base, signature: { ...sig, at: 'start' } }, 'x.mp4'))).toContain('[sigv][siga][clipv][clipa]concat=n=2');
  });
});
