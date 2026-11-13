import { buildImageQuery, parseBingImages } from './ott-media.service';

describe('ott-media helpers', () => {
  it('builds an exact-title web query from verified attributes', () => {
    expect(
      buildImageQuery({ title: 'Mr & Mrs Office', contentType: 'tv', seasonNumber: null, language: 'ta', platform: 'JioHotstar', originalYear: null, releaseDate: '2026-11-18' }),
    ).toBe('"Mr & Mrs Office" series 2026 Tamil JioHotstar poster');
    expect(buildImageQuery({ title: 'Panchayat', contentType: 'tv', seasonNumber: 4, language: 'hi', platform: 'Prime Video', originalYear: 2020 })).toBe(
      '"Panchayat" season 4 2020 Hindi Prime Video poster',
    );
    expect(buildImageQuery({ title: 'Jailer 2', contentType: 'movie' })).toBe('"Jailer 2" movie poster');
  });

  it('parses Bing image tiles and drops expiring Facebook links', () => {
    const tile = (m: object) => `<a class="iusc" m='${JSON.stringify(m).replace(/'/g, '&#39;')}'></a>`;
    const html =
      tile({ murl: 'https://img10.hotstar.com/a.jpg', turl: 'https://tse1.mm.bing.net/th?id=1', purl: 'https://www.hotstar.com/in/shows/x', t: 'Mr & Mrs Office' }) +
      tile({ murl: 'https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=1', turl: 'https://tse1.mm.bing.net/th?id=2' }) +
      tile({ murl: 'https://img10.hotstar.com/a.jpg', turl: 'dup' }) +
      '<a class="iusc" m="not json"></a>';
    const out = parseBingImages(html);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ url: 'https://img10.hotstar.com/a.jpg', thumb: 'https://tse1.mm.bing.net/th?id=1', source: 'WEB', label: 'hotstar.com — Mr & Mrs Office' });
  });
});
