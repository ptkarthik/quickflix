import { aboutTitle, commonPhrases, isBuzz, isCriticReview, parseBingNews, parseWikiCritics, ratingFromJsonLd, ratingInText, ratingLabel, shortOutlet, verdictOf } from './critics.util';

describe('critics', () => {
  it('reads Bing News items with the real article link', () => {
    const xml = `<rss><channel><item><title>Jailer 2 Movie Review: Rajinikanth, Nelson deliver a satisfying sequel</title>
      <link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;url=https%3a%2f%2ftimesofindia.indiatimes.com%2fx%2fmoviereview%2f1.cms&amp;c=1</link>
      <description>Rating: 3/5 …</description><pubDate>Thu, 13 Nov 2026 06:00:00 GMT</pubDate><News:Source>The Times of India</News:Source></item></channel></rss>`;
    expect(parseBingNews(xml)).toEqual([{ headline: 'Jailer 2 Movie Review: Rajinikanth, Nelson deliver a satisfying sequel', url: 'https://timesofindia.indiatimes.com/x/moviereview/1.cms', outlet: 'The Times of India', date: '2026-11-13', description: 'Rating: 3/5 …' }]);
  });

  it('matches the title, not its sequel', () => {
    expect(aboutTitle('Jailer movie review: Rajinikanth rocks', 'Jailer')).toBe(true);
    expect(aboutTitle('Jailer 2 movie review: a sequel', 'Jailer')).toBe(false);
    expect(aboutTitle('Jailer 2 movie review: a sequel', 'Jailer 2')).toBe(true);
    expect(aboutTitle('Kaantha review', 'Kantha')).toBe(false);
  });

  it('separates critics from fan buzz', () => {
    expect(isCriticReview('Jailer 2 Movie Review: satisfying sequel')).toBe(true);
    expect(isCriticReview('Jailer 2 X review: fans hail film')).toBe(false);
    expect(isBuzz('Jailer 2 movie review, release live updates')).toBe(true);
    expect(isBuzz("'Jailer 2' movie Twitter review: industry hit")).toBe(true);
  });

  it('only uses ratings the source states', () => {
    expect(ratingInText('Rating: 3.5/5')).toEqual({ value: 3.5, best: 5 });
    expect(ratingInText('gave it 7 out of 10')).toEqual({ value: 7, best: 10 });
    expect(ratingInText('★★★½')).toEqual({ value: 3.5, best: 5 });
    expect(ratingInText('a star-studded actioner')).toBeNull();
    expect(ratingInText('3.5 stars')).toEqual({ value: 3.5, best: 5 });
    expect(ratingInText('7/5 nonsense')).toBeNull();
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Review","reviewRating":{"@type":"Rating","ratingValue":"3.0","bestRating":"5"},"author":[{"@type":"Person","name":"Logesh Balachandran"}],"publisher":{"name":"Times Of India"},"description":"Rajinikanth is in top form."}</script>`;
    expect(ratingFromJsonLd(html)).toEqual({ rating: { value: 3, best: 5 }, critic: 'Logesh Balachandran', outlet: 'Times Of India', description: 'Rajinikanth is in top form.' });
  });

  it('turns headlines into one-liners', () => {
    expect(verdictOf('Jailer 2 Movie Review: Rajinikanth is the showstopper in a whistle-worthy mass entertainer', 'Jailer 2')).toBe('Rajinikanth is the showstopper in a whistle-worthy mass entertainer');
    expect(verdictOf('Jailer 2 Review: A Fun First Half, A Predictable Second Half', 'Jailer 2')).toBe('A Fun First Half, A Predictable Second Half');
  });

  it('reads critics from Wikipedia "Critical response"', () => {
    const wt = `M. Suganth of ''[[The Times of India]]'' gave the film 3.5 out of 5 stars and wrote, "A stylish entertainer that works."<ref>x</ref> Baradwaj Rangan of ''Film Companion'' called it a mixed bag. Sowmya Rajendran of ''[[The News Minute]]'' rated it 3/5.`;
    const r = parseWikiCritics(wt);
    expect(r.map(x => [x.outlet, x.critic, x.rating, x.oneLiner])).toEqual([
      ['The Times of India', 'M. Suganth', { value: 3.5, best: 5 }, 'A stylish entertainer that works.'],
      ['The News Minute', 'Sowmya Rajendran', { value: 3, best: 5 }, null],
    ]);
  });

  it('phrases several critics used, short outlet names, labels', () => {
    const p = commonPhrases(['A whistle-worthy mass entertainer', 'Pure mass entertainer with swag', 'The first half works', 'Fun first half'], 'Jailer 2');
    expect(p.map(x => x.text)).toEqual(expect.arrayContaining(['mass entertainer', 'first half']));
    expect(shortOutlet('The Times of India')).toBe('TOI');
    expect([ratingLabel({ value: 3.5, best: 5 }), ratingLabel({ value: 3.75, best: 5 }), ratingLabel({ value: 3, best: 5 })]).toEqual(['3.5/5', '3.75/5', '3/5']);
  });
});

describe('critics — other scales', () => {
  it('reads four-star ratings', () => {
    expect(ratingInText('gave it three and a half — 3.5 stars out of four')).toEqual({ value: 3.5, best: 4 });
    expect(ratingInText('rated it 3 out of 4')).toEqual({ value: 3, best: 4 });
  });
});

describe('critics — wrong matches', () => {
  it('drops stage productions and articles far from the release', () => {
    const { isStage, nearRelease } = require('./critics.util');
    expect(isStage('Review: The Shawshank Redemption at Leeds Grand Theatre')).toBe(true);
    expect(isStage('The Shawshank Redemption stage play review')).toBe(true);
    expect(isStage('Jailer 2 review: a mass entertainer, now in theatres')).toBe(false);
    expect(nearRelease('2026-05-20', 1994)).toBe(false);
    expect(nearRelease('2026-11-13', 2026)).toBe(true);
    expect(nearRelease(null, 1994)).toBe(true);
  });
});
