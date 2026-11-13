import { OfficialYoutubeCollector, videoMatchesTitle, videoSegments } from './official-youtube.collector';
import { detectDubLanguage } from './ott-text.util';

describe('OfficialYoutubeCollector.parse (real video titles, Nov 2026)', () => {
  const c = new OfficialYoutubeCollector();
  const published = new Date('2026-11-10T10:00:00Z');
  const parse = (platform: string, title: string, desc = '') => c.parse({ platform, handle: '@x' }, title, desc, 'https://youtu.be/x', published);

  it('extracts title and premiere date from a JioHotstar announcement', () => {
    const v = parse('JioHotstar', 'Hotstar Specials | MR & MRS OFFICE | Streaming from November 18 | JioHotstar');
    expect(v.claimedDate).toBe('2026-11-18');
    expect(v.isReleaseAnnouncement).toBe(true);
    expect(v.segments).toEqual(['MR & MRS OFFICE']);
  });

  it('strips "Tomorrow On JioHotstar" and promo noise', () => {
    expect(parse('JioHotstar', 'Raboye 12 Gantalo | Pushpaka Vimanam Tomorrow On JioHotstar').segments).toContain('Pushpaka Vimanam');
    expect(parse('JioHotstar', 'Pushpaka Vimanam | 1 Day To Go | Hotstar Specials | Streaming From Nov 12 | JioHotstar').segments).toEqual(['Pushpaka Vimanam']);
  });

  it('reads "Prime Video India | November 12" style titles', () => {
    const v = parse('Prime Video', 'Jailer 2 Ultimate SHOWDOWN 🔥 | Rajinikanth | Prime Video India | November 12');
    expect(v.claimedDate).toBe('2026-11-12');
    expect(v.segments).toContain('Jailer 2 Ultimate SHOWDOWN');
  });

  it('ignores air dates on TV-serial episode uploads', () => {
    const v = parse('SonyLIV', 'Episode: 122 | Dr. Srishty Confronts Digvijay | Yaadein | Full Episode | 25 Aug 2026');
    expect(v.claimedDate).toBeUndefined();
    expect(v.isReleaseAnnouncement).toBe(false);
  });

  it('matches titles strictly (no false "official" evidence)', () => {
    const seg = (t: string) => videoSegments(t, published);
    expect(videoMatchesTitle(seg('Jailer 2 Ultimate SHOWDOWN 🔥 | Rajinikanth | Prime Video India | November 12'), 'Jailer 2')).toBe(true);
    expect(videoMatchesTitle(seg('Hotstar Specials | MR & MRS OFFICE | Streaming from November 18 | JioHotstar'), 'Mr & Mrs Office')).toBe(true);
    // Real false positive seen on Sun NXT's channel:
    expect(videoMatchesTitle(seg('When Family Becomes the Greatest Strength | Vedi | Vishal | Poonam Kaur | Sun NXT'), 'The Greatest')).toBe(false);
    // Single-word titles must match a whole segment.
    expect(videoMatchesTitle(seg('Scene Stealer Moments | Best Of 2025 | Netflix India'), 'Scene')).toBe(false);
    expect(videoMatchesTitle(seg('Scene | Official Trailer | Netflix India'), 'Scene')).toBe(true);
  });

  it('detects dub-specific videos', () => {
    expect(parse('Prime Video', 'Jailer 2 | Hindi Trailer | Prime Video India').dubLanguage).toBe('hi');
    expect(detectDubLanguage('Kantara Chapter 1 (Hindi) streaming now')).toBe('hi');
    expect(detectDubLanguage('Now streaming in Hindi, Tamil and Telugu')).toBeUndefined();
  });
});
