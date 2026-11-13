import { indiaDatesQuery, industryOf, isMilestone, knownFor, parseDateParam, parseIndiaDates, parsePeople, peopleQuery } from './onthisday.util';

const row = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]));

describe('on this day', () => {
  it('builds day-precise Wikidata queries', () => {
    const q = peopleQuery(11, 13, 'india', 'birth');
    expect(q).toContain('wdt:P27 wd:Q668');
    expect(q).toContain('p:P569/psv:P569 [ wikibase:timeValue ?birth; wikibase:timePrecision 11 ]');
    expect(q).toContain('MONTH(?birth) = 11 && DAY(?birth) = 13');
    const w = peopleQuery(1, 2, 'world', 'death');
    expect(w).not.toContain('Q668');
    expect(w).toContain('MONTH(?death) = 1 && DAY(?death) = 2');
    expect(w).toContain('?sl >= 50');
  });

  it('merges occupation rows per person and skips unlabeled ones', () => {
    const json = { results: { bindings: [
      row({ p: 'http://www.wikidata.org/entity/Q464932', pLabel: 'Juhi Chawla', birth: '1967-11-13T00:00:00Z', occ: 'http://www.wikidata.org/entity/Q33999', tmdb: '35810', imdb: 'nm0004564', sl: '58', article: 'https://en.wikipedia.org/wiki/Juhi_Chawla' }),
      row({ p: 'http://www.wikidata.org/entity/Q464932', pLabel: 'Juhi Chawla', birth: '1967-11-13T00:00:00Z', occ: 'http://www.wikidata.org/entity/Q3282637', sl: '58' }),
      row({ p: 'http://www.wikidata.org/entity/Q99', pLabel: 'Q99', birth: '1990-11-13T00:00:00Z', sl: '90' }),
      row({ p: 'http://www.wikidata.org/entity/Q5', pLabel: 'P. Susheela', birth: '1935-11-13T00:00:00Z', occ: 'http://www.wikidata.org/entity/Q177220', sl: '15' }),
    ] } };
    const people = parsePeople(json, 'india');
    expect(people.map(p => p.name)).toEqual(['Juhi Chawla', 'P. Susheela']);
    expect(people[0]).toMatchObject({ wikidataId: 'Q464932', birth: '1967-11-13', occupations: ['Actor', 'Producer'], tmdbId: 35810, imdbId: 'nm0004564', sitelinks: 58 });
  });

  it('finds India release dates only when the place is India', () => {
    expect(indiaDatesQuery(['tt0111161', 'bad"'])).toContain('VALUES ?imdb { "tt0111161" }');
    const m = parseIndiaDates({ results: { bindings: [
      row({ imdb: 'tt1', date: '1995-01-12T00:00:00Z', place: 'http://www.wikidata.org/entity/Q30' }),
      row({ imdb: 'tt1', date: '1995-03-03T00:00:00Z', place: 'http://www.wikidata.org/entity/Q668' }),
      row({ imdb: 'tt2', date: '2001-05-05T00:00:00Z' }),
    ] } });
    expect(m.get('tt1')).toEqual({ india: '1995-03-03', dates: ['1995-01-12', '1995-03-03'] });
    expect(m.get('tt2')).toEqual({ india: null, dates: ['2001-05-05'] });
  });

  it('picks known-for works by votes, skipping talk shows and guest spots', () => {
    const credits = {
      cast: [
        { id: 1, media_type: 'movie', title: 'Big Hit', release_date: '1995-01-01', vote_count: 900, vote_average: 7.9, original_language: 'ta', character: 'Hero' },
        { id: 2, media_type: 'tv', name: 'Talk Show', first_air_date: '2010-01-01', vote_count: 5000, genre_ids: [10767], episode_count: 40 },
        { id: 3, media_type: 'tv', name: 'Guest Spot', first_air_date: '2012-01-01', vote_count: 3000, episode_count: 1 },
        { id: 4, media_type: 'movie', title: 'Small', release_date: '2001-01-01', vote_count: 10, original_language: 'ta' },
        { id: 5, media_type: 'movie', title: 'No date', vote_count: 9999 },
      ],
      crew: [{ id: 1, media_type: 'movie', title: 'Big Hit', release_date: '1995-01-01', vote_count: 900, job: 'Producer' }],
    };
    const k = knownFor(credits);
    expect(k.map(c => c.title)).toEqual(['Big Hit', 'Small']);
    expect(k[0]).toMatchObject({ year: 1995, rating: 7.9, role: 'Hero' });
    expect(k[1].rating).toBeNull();
    expect(industryOf(credits)).toBe('ta');
  });

  it('dates and milestones', () => {
    expect(parseDateParam('2026-11-13')).toMatchObject({ month: 11, day: 13, year: 2026, mmdd: '11-13' });
    expect(() => parseDateParam('2026-13-01')).toThrow();
    expect([1, 5, 10, 30, 7, 0].map(isMilestone)).toEqual([true, true, true, true, false, false]);
  });
});
