import { PostStats, analyse, formatOf, growthOf, istParts, kindLabel, median, parseInsights } from './growth.util';

const post = (o: Partial<PostStats>): PostStats => ({
  id: Math.random().toString(36), format: 'Reel', caption: '', permalink: null, thumbnail: null, timestamp: '2026-11-13T13:30:00Z', likes: 0, comments: 0,
  reach: null, views: null, shares: null, saves: null, interactions: null, follows: null, profileVisits: null, avgWatchSec: null, kind: null, releaseId: null, ...o,
});

describe('growth analytics', () => {
  it('reads Instagram insights', () => {
    const p = parseInsights([
      { name: 'reach', values: [{ value: 1200 }] },
      { name: 'views', values: [{ value: 3400 }] },
      { name: 'shares', values: [{ value: 25 }] },
      { name: 'saved', values: [{ value: 9 }] },
      { name: 'ig_reels_avg_watch_time', values: [{ value: 4530 }] },
      { name: 'follows', total_value: { value: 3 } },
    ]);
    expect(p).toMatchObject({ reach: 1200, views: 3400, shares: 25, saves: 9, avgWatchSec: 4.5, follows: 3, profileVisits: null });
  });

  it('formats, IST time, labels, median', () => {
    expect([formatOf('REELS', 'VIDEO'), formatOf('FEED', 'CAROUSEL_ALBUM'), formatOf('FEED', 'IMAGE')]).toEqual(['Reel', 'Carousel', 'Photo']);
    expect(istParts('2026-11-13T13:30:00Z')).toEqual({ weekday: 5, hour: 19 }); // Friday 7 PM IST
    expect(kindLabel('world-picks-reel')).toBe('World list (Reel)');
    expect(kindLabel(null)).toBe('Posted outside the app');
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(2.5);
  });

  it('finds what works only when there is enough behind it', () => {
    const posts = [
      ...[900, 1100, 1000].map(r => post({ format: 'Reel', reach: r, likes: 50 })),
      ...[300, 250, 350].map(r => post({ format: 'Carousel', reach: r, likes: 20 })),
    ];
    const a = analyse(posts, true);
    expect(a.byFormat[0]).toMatchObject({ label: 'Reel', posts: 3, median: 1000 });
    expect(a.findings.some(f => f.text.startsWith('Format: “Reel” gets 3.3×') && f.text.includes('than the rest'))).toBe(true);
    expect(a.top[0].reach).toBe(1100);
    // basic mode (no insights) ranks by likes + comments
    expect(analyse(posts, false).unit).toBe('likes + comments');
    // a single post per group → no claim
    expect(analyse([post({ format: 'Reel', reach: 900 }), post({ format: 'Photo', reach: 100 })], true).findings.some(f => f.text.startsWith('Format'))).toBe(false);
  });

  it('follower growth over 7 / 30 days', () => {
    const g = growthOf([{ date: '2026-10-10', followers: 150 }, { date: '2026-11-06', followers: 190 }, { date: '2026-11-13', followers: 204 }]);
    expect(g).toMatchObject({ current: 204, last7: 14, last30: 54 });
  });
});
