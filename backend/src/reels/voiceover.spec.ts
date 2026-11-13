import { pipBox, voiceoverArgs } from './voiceover.util';

const base = { split: 3, intro: true, hasCam: true, pip: { shape: 'circle' as const, pos: 'tr' as const, size: 380 }, mirror: true, voiceVolume: 1, bgVolume: 0.5, reelSeconds: 12.6, reelHasAudio: true };
const fc = (a: string[]) => a[a.indexOf('-filter_complex') + 1];

describe('voice-over + webcam', () => {
  it('keeps the webcam clear of Instagram’s top bar and caption area', () => {
    expect(pipBox({ shape: 'circle', pos: 'tr', size: 380 })).toEqual({ w: 380, h: 380, x: 1080 - 48 - 380, y: 170 });
    expect(pipBox({ shape: 'box', pos: 'bl', size: 300 })).toEqual({ w: 300, h: 400, x: 48, y: 1920 - 330 - 400 });
    expect(pipBox({ shape: 'circle', pos: 'bc', size: 9999 }).w).toBe(560);
  });

  it('intro + circle webcam + voice over ducked music', () => {
    const a = voiceoverArgs('r.mp4', 'rec.webm', base, 'o.mp4');
    const f = fc(a);
    expect(f).toContain('[recA]atrim=start=3.000'); // the voice for the Reel starts when the Reel started
    expect(f).toContain('sidechaincompress'); // music dips under the voice
    expect(f).toContain("a='if(lte(hypot(X-190,Y-190),188),255,0)'"); // round webcam
    expect(f).toContain('overlay=652:170');
    expect(f).toContain('[camB]trim=0:3.000'); // the first 3 s = talk-to-camera intro
    expect(f).toContain('concat=n=2:v=1:a=1');
    expect(f).toContain('hflip');
    expect(a[a.indexOf('-t') + 1]).toBe('15.600');
  });

  it('voice only, no intro, Reel without sound', () => {
    const f = fc(voiceoverArgs('r.mp4', 'rec.webm', { ...base, intro: false, hasCam: false, pip: null, reelHasAudio: false, mirror: false }, 'o.mp4'));
    expect(f).not.toContain('[1:v]');
    expect(f).not.toContain('sidechaincompress');
    expect(f).not.toContain('concat');
    expect(f).toContain('[mainV]null[vout]');
  });
});
