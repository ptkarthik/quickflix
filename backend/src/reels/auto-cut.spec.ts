import { analysisArgs, parseAnalysis, pickClips, TrailerAnalysis } from './auto-cut.util';

describe('trailer auto-cut', () => {
  it('reads shot changes, black parts and loudness from ffmpeg output', () => {
    const err = [
      '[blackdetect @ 0x1] black_start:0 black_end:1.48 black_duration:1.48',
      '[Parsed_showinfo_3 @ 0x2] n:   0 pts:  51200 pts_time:4.0     duration: 512',
      '[Parsed_showinfo_3 @ 0x2] n:   1 pts:  89600 pts_time:7       duration: 512',
      '[Parsed_ametadata_3 @ 0x3] frame:0    pts:0       pts_time:0',
      '[Parsed_ametadata_3 @ 0x3] lavfi.astats.Overall.RMS_level=-inf',
      '[Parsed_ametadata_3 @ 0x3] frame:1    pts:4000    pts_time:0.5',
      '[Parsed_ametadata_3 @ 0x3] lavfi.astats.Overall.RMS_level=-18.25',
    ].join('\n');
    expect(parseAnalysis(err)).toEqual({ cuts: [4, 7], black: [[0, 1.48]], loudness: [{ t: 0, db: -90 }, { t: 0.5, db: -18.25 }] });
  });

  it('skips the audio analysis when the trailer has no sound', () => {
    expect(analysisArgs('t.mp4', false)).toContain('-an');
    expect(analysisArgs('t.mp4', true).join(' ')).toContain('astats');
  });

  // 60 s trailer: a shot every 3 s, loud between 30–40 s, black at 20–23 s.
  const a: TrailerAnalysis = {
    cuts: Array.from({ length: 19 }, (_, i) => (i + 1) * 3),
    black: [[20.5, 23.5]],
    loudness: Array.from({ length: 120 }, (_, i) => ({ t: i * 0.5, db: i * 0.5 >= 30 && i * 0.5 < 40 ? -10 : -30 })),
  };
  const opts = { count: 5, length: 2.5, style: 'balanced' as const, skipStart: 4, skipEnd: 6 };

  it('picks clips inside shots, in story order, away from logos, black frames and the end card', () => {
    const clips = pickClips(a, 60, opts);
    expect(clips).toHaveLength(5);
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      expect(c.start).toBeGreaterThanOrEqual(4);
      expect(c.end).toBeLessThanOrEqual(54);
      expect(c.end - c.start).toBeGreaterThan(0.9);
      expect(c.end - c.start).toBeLessThanOrEqual(2.5);
      expect(c.start >= 23.5 || c.end <= 20.5).toBe(true);
      // never crosses a shot change in balanced style
      expect(a.cuts.some(t => t > c.start && t < c.end)).toBe(false);
      if (i) expect(c.start).toBeGreaterThan(clips[i - 1].end);
    }
    // the loud stretch gets at least one clip
    expect(clips.some(c => c.start >= 30 && c.start < 40)).toBe(true);
    expect(pickClips(a, 60, opts)).toEqual(clips);
  });

  it('falls back to evenly spaced clips when no shot changes are found', () => {
    const clips = pickClips({ cuts: [], black: [], loudness: [] }, 30, { ...opts, count: 4, skipStart: 0, skipEnd: 0 });
    expect(clips.length).toBe(4);
    expect(clips[clips.length - 1].start - clips[0].start).toBeGreaterThan(10);
  });
});
