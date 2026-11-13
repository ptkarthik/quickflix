import { archiveMinutes, isPublicDomain, isoMinutes, mapArchiveDoc, mapYoutubeVideo, parseChannelRef, pickTrailer, scriptJson } from './watch.util';
import { renderSite } from './site-template';

describe('watch utils', () => {
  it('reads durations', () => {
    expect(isoMinutes('PT2H12M30S')).toBe(133);
    expect(isoMinutes('PT45M')).toBe(45);
    expect(isoMinutes('bad')).toBeNull();
    expect(archiveMinutes('01:12:33')).toBe(73);
    expect(archiveMinutes('72 min')).toBe(72);
    expect(archiveMinutes('4353')).toBe(73);
  });

  it('keeps only full-length public YouTube films watchable in India', () => {
    const base = { id: 'abc', snippet: { title: 'Film (Full Movie)', channelTitle: 'Rajshri', channelId: 'UC1', liveBroadcastContent: 'none' }, status: { privacyStatus: 'public', embeddable: true }, statistics: { viewCount: '1000' } };
    expect(mapYoutubeVideo({ ...base, contentDetails: { duration: 'PT2H10M' } })).toMatchObject({ externalId: 'abc', minutes: 130, embeddable: true });
    expect(mapYoutubeVideo({ ...base, contentDetails: { duration: 'PT12M' } })).toBeNull();
    expect(mapYoutubeVideo({ ...base, contentDetails: { duration: 'PT2H', regionRestriction: { blocked: ['IN'] } } })).toBeNull();
    expect(mapYoutubeVideo({ ...base, contentDetails: { duration: 'PT2H', regionRestriction: { allowed: ['US'] } } })).toBeNull();
  });

  it('accepts only explicit public-domain marks from the Internet Archive', () => {
    expect(isPublicDomain('http://creativecommons.org/licenses/publicdomain/')).toBe(true);
    expect(isPublicDomain('http://creativecommons.org/publicdomain/mark/1.0/')).toBe(true);
    expect(isPublicDomain('http://creativecommons.org/licenses/by-nc/3.0/')).toBe(false);
    expect(mapArchiveDoc({ identifier: 'his_girl_friday', title: 'His Girl Friday', year: '1940', licenseurl: 'http://creativecommons.org/licenses/publicdomain/', downloads: 5 })).toMatchObject({ externalId: 'his_girl_friday', year: 1940 });
    expect(mapArchiveDoc({ identifier: 'x', licenseurl: 'http://creativecommons.org/licenses/by/4.0/' })).toBeNull();
  });

  it('parses channel links and picks the official trailer', () => {
    expect(parseChannelRef('https://www.youtube.com/@rajshri')).toEqual({ handle: '@rajshri' });
    expect(parseChannelRef('https://www.youtube.com/channel/UCim0ZIz8SAQGPvg4mJHG3JA')).toEqual({ id: 'UCim0ZIz8SAQGPvg4mJHG3JA' });
    expect(parseChannelRef('not a link')).toBeNull();
    expect(pickTrailer([{ site: 'YouTube', key: 'fan', type: 'Trailer', official: false }, { site: 'YouTube', key: 'off', type: 'Trailer', official: true }, { site: 'YouTube', key: 'clip', type: 'Clip', official: true }])).toBe('off');
    expect(pickTrailer([{ site: 'Vimeo', key: 'v', type: 'Trailer' }])).toBeNull();
  });

  it('cannot be broken out of the inline data script', () => {
    const html = renderSite({
      brand: { name: 'My <b>Site', tagline: 't', handle: '@me', accent: 'red;}</style><script>' },
      generatedAt: new Date().toISOString(), free: [], trailers: [], classics: [],
      youtube: [{ id: 'x', source: 'youtube', title: '</script><script>alert(1)</script>', channel: 'c', year: null, minutes: 90, thumb: null, description: '', language: null, embeddable: true }],
    });
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('--accent:#FACC15'); // bad colour → default
    expect(html).toContain('My &lt;b&gt;Site');
    expect(scriptJson('a</script>')).toBe('"a\\u003c/script>"');
  });
});
