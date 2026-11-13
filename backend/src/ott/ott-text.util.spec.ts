import {
  detectDate,
  detectPlatform,
  extractTitle,
  isDigestHeadline,
  makeDedupeKey,
  normalizePlatform,
  splitSeason,
} from './ott-text.util';

describe('ott-text.util (rule-based headline parsing)', () => {
  const ref = new Date('2026-11-12T00:00:00Z');

  it.each([
    ["'Scene' OTT release date: When and where can we expect Suriya, Nazriya and Naslen's crime thriller", 'Scene'],
    ['Ranabaali OTT Release: When And Where To Watch Vijay Deverakonda, Rashmika Mandanna Film', 'Ranabaali'],
    ["Bandra OTT release: Here's when and where you can watch Dileep's drama", 'Bandra'],
    ['Hanuman Ansh OTT release: Rs 450 crore Neem Karoli Baba biopic gets a streaming date', 'Hanuman Ansh'],
    ["'The End of Oak Street' OTT release: When and where to watch Anne Hathaway's new movie", 'The End of Oak Street'],
    ['Jailer 2 OTT Release: Date, Plot, Cast, When And Where To Watch', 'Jailer 2'],
    ['Kantara Chapter 1 now streaming on Prime Video', 'Kantara Chapter 1'],
    ["Rajinikanth's Coolie to stream on Prime Video from November 21", 'Coolie'],
    // Real Google News headlines that previously produced junk (Nov 2026)
    ["Rajinikanth's 'Jailer 2' now streaming on Prime Video", 'Jailer 2'],
    ['Rajinikanth’s “Jailer 2” to Stream on Prime Video Nov. 12', 'Jailer 2'],
    ['Imtiaz Ali’s series ‘O Saathi Re’ to release on Netflix on Dec 4', 'O Saathi Re'],
    ['Ranabaali Locks OTT Release Date', 'Ranabaali'],
    ['Vijay Deverakonda’s Ranabaali Locks Its OTT Release Date', 'Ranabaali'],
    ['All Pass Tamil Movie Now Streaming on Prime Video – 6 November OTT Releases and Upcoming', 'All Pass'],
    ['Scene Movie OTT Release Date and Platform – When Will Suriya’s Scene directed by Jithu', 'Scene'],
    ['Know Hanuman Ansh OTT release date and platform in India', 'Hanuman Ansh'],
    ['Have you heard? Ranabaali OTT premiere date announced, film to release on Netflix', 'Ranabaali'],
    ['Hanuman Ansh finally gets OTT release date after earning over Rs 450 crore worldwide', 'Hanuman Ansh'],
    ['Student of the Year: After Dark OTT Release Date – Shanaya Kapoor’s Thriller Series', 'Student of the Year: After Dark'],
    ['Now streaming: Dulquer Salmaan’s I’m Game arrives on OTT in five languages', 'I’m Game'],
  ])('extracts title from %s', (headline, expected) => {
    expect(extractTitle(headline)).toBe(expected);
  });

  it.each([
    'Shaji Kumar Passes Away at 57: Mohanlal, Mammootty mourn',
    'Days before OTT release, Rajinikanth reacts to Jailer 2 box office run',
    "Suriya's Scene reportedly bags Rs 88 crore Netflix deal; OTT release date expected in December",
    'Best Picture-nominated thriller Inception starring Cillian Murphy is now streaming on Netflix',
    'Jailer 2: How an Early OTT Release Cost It 100 Cr',
  ])('returns undefined (no guessing) for %s', headline => {
    const t = extractTitle(headline);
    // "Jailer 2: How..." may legitimately yield "Jailer 2"; everything else must be undefined.
    if (headline.startsWith('Jailer 2')) expect(t === undefined || t === 'Jailer 2').toBe(true);
    else expect(t).toBeUndefined();
  });

  it('flags multi-title digest headlines', () => {
    expect(isDigestHeadline('5 Telugu OTT Releases to Watch This Week: Ranabaali to Happy Journey')).toBe(true);
    expect(isDigestHeadline("Friday OTT releases (November 6, 2026): 'Possible Love', 'Haiwaan'")).toBe(true);
    expect(isDigestHeadline('4 Hindi OTT Releases of This Week: Student of the Year')).toBe(true);
    expect(isDigestHeadline('New OTT Release Movies In Malayalam This Week')).toBe(true);
    expect(isDigestHeadline('Ranabaali OTT Release: When And Where To Watch')).toBe(false);
  });

  it('ignores negated and speculative platform mentions', () => {
    expect(detectPlatform("Know Hanuman Ansh OTT release date and platform in India; it's neither Netflix nor Amazon Prime Video")).toBeUndefined();
    expect(detectPlatform('Hanuman Ansh OTT Release: SonyLIV or Netflix? When, Where To Watch')).toBeUndefined();
    expect(detectPlatform('Film skips Netflix, lands on SonyLIV')).toBe('SonyLIV');
  });

  it('picks the platform mentioned first', () => {
    expect(detectPlatform('Ottam Thullal OTT Release on ManoramaMAX From November 6 – Also on Prime Video')).toBe('ManoramaMAX');
  });

  it('detects platforms and normalizes aliases', () => {
    expect(detectPlatform('to stream on Amazon Prime Video from Friday')).toBe('Prime Video');
    expect(detectPlatform('arrives on JioHotstar')).toBe('JioHotstar');
    expect(detectPlatform('Kantara is a huge hit')).toBeUndefined();
    expect(detectPlatform('Telugu film premieres on Aha')).toBe('Aha');
    expect(normalizePlatform('Disney+ Hotstar')).toBe('JioHotstar');
    expect(normalizePlatform('Amazon Prime Video')).toBe('Prime Video');
    expect(normalizePlatform('Zee5')).toBe('ZEE5');
  });

  it('parses explicit dates and infers the year', () => {
    expect(detectDate('streaming from November 21', ref)).toBe('2026-11-21');
    expect(detectDate('streaming from 5th December', ref)).toBe('2026-12-05');
    expect(detectDate('premieres Jan 9', ref)).toBe('2027-01-09');
    expect(detectDate('released on 2 Nov 2026', ref)).toBe('2026-11-02');
    expect(detectDate('no date here', ref)).toBeUndefined();
    expect(detectDate('on 31 November', ref)).toBeUndefined();
  });

  it('splits seasons and builds stable dedupe keys', () => {
    expect(splitSeason('Panchayat Season 4')).toEqual({ base: 'Panchayat', season: 4 });
    expect(splitSeason('Jailer 2')).toEqual({ base: 'Jailer 2' });
    expect(makeDedupeKey('Mr & Mrs Office')).toBe(makeDedupeKey('Mr and Mrs Office'));
    expect(makeDedupeKey('Panchayat', 4)).toBe('panchayat#s4');
    expect(makeDedupeKey('Panchayat', 1)).toBe('panchayat');
  });
});
