import { checkSourceLink, cleanServiceName, parseWhere, whereStatus } from './where.util';

describe('where to watch', () => {
  const resp = {
    results: {
      IN: {
        link: 'https://www.themoviedb.org/movie/1/watch?locale=IN',
        flatrate: [{ provider_name: 'Netflix', logo_path: '/n.jpg', display_priority: 1 }, { provider_name: 'Netflix basic with Ads', display_priority: 2 }],
        ads: [{ provider_name: 'MX Player', display_priority: 3 }],
        rent: [{ provider_name: 'Apple TV', display_priority: 1 }],
        buy: [{ provider_name: 'Apple TV', display_priority: 1 }, { provider_name: 'Google Play Movies', display_priority: 2 }],
      },
      US: { flatrate: [{ provider_name: 'Hulu' }] },
    },
  };

  it('groups India availability and drops duplicate names', () => {
    const w = parseWhere(resp);
    expect(w.stream.map(s => s.name)).toEqual(['Netflix']);
    expect(w.stream[0].logo).toContain('/n.jpg');
    expect(w.free.map(s => s.name)).toEqual(['MX Player']);
    expect(w.rent.map(s => s.name)).toEqual(['Apple TV']);
    expect(w.buy.map(s => s.name)).toEqual(['Google Play Movies']);
    expect(w.link).toContain('locale=IN');
    expect(w.elsewhere).toEqual([]); // only looked up when nothing in India
    expect(whereStatus({ ...w, official: [] })).toBe('stream');
  });

  it('says where else it streams when not in India', () => {
    const w = parseWhere({ results: { US: resp.results.US } });
    expect(w.stream).toEqual([]);
    expect(w.elsewhere).toEqual([{ country: 'US', services: ['Hulu'] }]);
    expect(whereStatus({ ...w, official: [] })).toBe('none');
    expect(whereStatus({ ...w, official: [{ source: 'archive', title: 'x', channel: null, url: 'u' }] })).toBe('free');
  });

  it('cleans service names', () => {
    expect(cleanServiceName('Amazon Prime Video')).toBe('Prime Video');
    expect(cleanServiceName('Lionsgate Play Amazon Channel')).toBe('Lionsgate Play');
  });

  it('checks links: licensed / youtube / unknown', () => {
    expect(checkSourceLink('https://www.netflix.com/title/123').verdict).toBe('licensed');
    expect(checkSourceLink('https://www.primevideo.com/detail/x').source).toBe('Prime Video');
    expect(checkSourceLink('https://www.youtube.com/watch?v=abc123').verdict).toBe('check-channel');
    expect(checkSourceLink('https://www.youtube.com/@RajshriTamil/videos', ['@RajshriTamil']).verdict).toBe('official-channel');
    expect(checkSourceLink('https://some-movies-download.example/film').verdict).toBe('unknown');
    expect(checkSourceLink('https://evilnetflix.com/x').verdict).toBe('unknown');
    expect(checkSourceLink('not a link').verdict).toBe('invalid');
  });
});
