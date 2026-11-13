import { FeedItem, buildStories, categoryOf, isTamilNadu, parseGoogleNews, parseGoogleTrends, sensitiveOf } from './trends.util';

const it_ = (headline: string, outlet: string, extra: Partial<FeedItem> = {}): FeedItem => ({ headline, outlet, url: `https://x/${outlet}`, date: new Date().toISOString(), feed: 'india', lang: 'en', ...extra });

describe('trends', () => {
  it('reads Google News and Google Trends feeds', () => {
    const gn = `<rss><channel><item><title>CMRL completes tunnelling work for 1-km stretch - The Hindu</title><link>https://news.google.com/x</link><pubDate>Fri, 13 Nov 2026 10:00:00 GMT</pubDate><source url="https://www.thehindu.com">The Hindu</source></item></channel></rss>`;
    expect(parseGoogleNews(gn, 'chennai', 'en')[0]).toMatchObject({ headline: 'CMRL completes tunnelling work for 1-km stretch', outlet: 'The Hindu', feed: 'chennai' });
    const gt = `<rss><channel><item><title>argentina vs uruguay</title><ht:approx_traffic>500+</ht:approx_traffic><pubDate>Fri, 13 Nov 2026 10:00:00 GMT</pubDate>
      <ht:news_item><ht:news_item_title>Argentina vs Uruguay live score</ht:news_item_title><ht:news_item_url>https://a/b</ht:news_item_url><ht:news_item_source>ESPN</ht:news_item_source></ht:news_item></item></channel></rss>`;
    expect(parseGoogleTrends(gt)[0]).toMatchObject({ headline: 'Argentina vs Uruguay live score', outlet: 'ESPN', traffic: 500, trendTerm: 'argentina vs uruguay' });
  });

  it('knows Tamil Nadu, categories and sensitive stories', () => {
    expect(isTamilNadu('Heavy rain lashes Chennai, schools shut', 'en')).toBe(true);
    expect(isTamilNadu('Sensex rises 400 points', 'en')).toBe(false);
    expect(isTamilNadu('16ஆம் தேதி உருவாகிறது புயல்', 'ta')).toBe(true);
    expect(categoryOf('Heavy rain lashes Chennai, orange alert')).toBe('Weather');
    expect(categoryOf('Gold price today in Chennai')).toBe('Money & prices');
    expect(sensitiveOf('Five killed as bus overturns near Salem')).toBe('death / tragedy');
    expect(sensitiveOf('India vs Australia: a thrilling clash')).toBeNull();
    expect(sensitiveOf('Box office war: two big films this Diwali')).toBeNull();
    expect(sensitiveOf('Stock market crash wipes out gains')).toBeNull();
  });

  it('groups the same story across outlets and ranks by coverage', () => {
    const s = buildStories([
      it_('Heavy rain lashes Chennai, schools shut on Friday', 'The Hindu'),
      it_('Chennai rain: schools shut on Friday as heavy rain continues', 'TOI'),
      it_('Heavy rain in Chennai; schools shut tomorrow', 'News18'),
      it_('Sensex rises 400 points on IT stocks', 'Mint'),
    ]);
    expect(s[0]).toMatchObject({ outlets: 3, tamilNadu: true, category: 'Weather', sensitive: null });
    expect(s[1].outlets).toBe(1);
    expect(s[0].score).toBeGreaterThan(s[1].score);
  });
});
