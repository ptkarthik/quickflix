import { MUSIC_LIBRARY, ffmpegArgs, totalSeconds } from './reels.util';

describe('reels', () => {
  it('counts transition overlap in the Reel length', () => {
    expect(totalSeconds([3, 3, 3], 'fade')).toBeCloseTo(7.8);
    expect(totalSeconds([3, 3, 3], 'none')).toBe(9);
    expect(totalSeconds([7], 'fade')).toBe(7);
  });

  it('builds a 9:16 H.264/AAC command with crossfades and trimmed music', () => {
    const a = ffmpegArgs(['a.jpg', 'b.jpg'], { durations: [3, 4], transition: 'fade', motion: true, audio: { path: 'm.mp3', start: 12, volume: 0.8, fadeOut: 1.5 } }, 'out.mp4');
    const fc = a[a.indexOf('-filter_complex') + 1];
    expect(fc).toContain('xfade=transition=fade:duration=0.6:offset=2.400');
    expect(fc).toContain('crop=1080:1920');
    expect(fc).toContain('zoompan');
    expect(fc).toContain('atrim=0:6.400');
    expect(a).toEqual(expect.arrayContaining(['-ss', '12', '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p']));
    const silent = ffmpegArgs(['a.jpg'], { durations: [7], transition: 'none', motion: false, audio: null }, 'o.mp4');
    expect(silent.join(' ')).toContain('anullsrc');
  });

  it('every library track carries its licence credit', () => {
    expect(new Set(MUSIC_LIBRARY.map(t => t.id)).size).toBe(MUSIC_LIBRARY.length);
    for (const t of MUSIC_LIBRARY) expect(t.credit).toMatch(/Kevin MacLeod.*CC BY 4\.0/);
  });
});
