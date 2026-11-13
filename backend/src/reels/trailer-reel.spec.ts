import { probeFromStderr, trailerReelArgs, trailerReelSeconds } from './trailer-reel.util';

describe('trailer reels', () => {
  it('reads duration and streams from ffmpeg output', () => {
    const s = 'Duration: 00:02:31.45, start: 0.0\n  Stream #0:0(und): Video: h264\n  Stream #0:1(und): Audio: aac';
    expect(probeFromStderr(s)).toEqual({ duration: 151.45, hasAudio: true, hasVideo: true });
    expect(probeFromStderr('Duration: 00:00:10.00\n Stream #0:0: Video: h264').hasAudio).toBe(false);
  });

  it('cuts the clips in order, adds intro and mixes music under the trailer sound', () => {
    const o = {
      clips: [{ start: 1, end: 3.5 }, { start: 8, end: 10 }], framing: 'fit' as const, audio: 'mix' as const, hasTrailerAudio: true, trailerVolume: 1,
      music: { path: 'm.mp3', start: 5, volume: 0.3 }, fadeOut: 1, overlay: 'o.png', intro: { path: 'i.jpg', seconds: 2 }, outro: null,
    };
    expect(trailerReelSeconds(o)).toBe(6.5);
    const a = trailerReelArgs('t.mp4', o, 'out.mp4');
    const fc = a[a.indexOf('-filter_complex') + 1];
    // each clip is its own seeked input (keeps memory low on long HD trailers)
    expect(a.slice(0, 20)).toEqual(['-y', '-hide_banner', '-loglevel', 'error', '-threads', '2', '-ss', '1.000', '-t', '2.500', '-i', 't.mp4', '-threads', '2', '-ss', '8.000', '-t', '2.000', '-i', 't.mp4']);
    expect(fc).toContain('[1:v]trim=duration=2.000');
    expect(fc).toContain('[0:a]asetpts');
    expect(fc).toContain('concat=n=2:v=1:a=1[clipv0][clipa]');
    expect(fc).toContain('[clipv0][2:v]overlay=0:0');
    expect(fc).toContain('[inv][ina][clipv][clipa]concat=n=2');
    expect(fc).toContain('amix=inputs=2');
    expect(a).toEqual(expect.arrayContaining(['-stream_loop', '-1', '-ss', '5', '-i', 'm.mp3']));
  });

  it('uses silence for clips when the trailer has no sound', () => {
    const a = trailerReelArgs('t.mp4', { clips: [{ start: 0, end: 2 }], framing: 'fill', audio: 'trailer', hasTrailerAudio: false, trailerVolume: 1, fadeOut: 0 }, 'o.mp4');
    const fc = a[a.indexOf('-filter_complex') + 1];
    expect(fc).not.toContain('[0:a]');
    expect(fc).toContain('anullsrc');
    expect(fc).toContain('crop=1080:1920');
  });
});
