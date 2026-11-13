import { linksFrom, parseAnilist, parseJikan, parseMdblist, parseTvmaze, parseWikidata, wikidataQuery } from './free-sources';
import { parseBasicsLine, parseRatingLine } from '../world/imdb-dataset.service';
import { rankOf, scoreFields } from '../world/world.util';

const b = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]));

describe('free sources', () => {
  it('reads Wikidata ids, Wikipedia page and only the Tomatometer % (not RT average /10)', () => {
    const body = {
      results: {
        bindings: [
          b({ item: 'http://www.wikidata.org/entity/Q61448040', article: 'https://en.wikipedia.org/wiki/Parasite_(2019_film)', p: 'http://www.wikidata.org/prop/direct/P6127', v: 'parasite-2019', score: '9.4/10', by: 'http://www.wikidata.org/entity/Q105584' }),
          b({ item: 'http://www.wikidata.org/entity/Q61448040', p: 'http://www.wikidata.org/prop/direct/P1258', v: 'm/parasite_2019', score: '99%', by: 'http://www.wikidata.org/entity/Q105584' }),
          b({ item: 'http://www.wikidata.org/entity/Q61448040', score: '97/100', by: 'http://www.wikidata.org/entity/Q150248' }),
        ],
      },
    };
    const wd = parseWikidata(body)!;
    expect(wd.qid).toBe('Q61448040');
    expect(wd.enwiki).toBe('Parasite (2019 film)');
    expect(wd.rt).toBe(99);
    expect(wd.metacritic).toBe(97);
    expect(linksFrom('tt6751668', wd)).toMatchObject({
      imdb: 'https://www.imdb.com/title/tt6751668/',
      letterboxd: 'https://letterboxd.com/film/parasite-2019/',
      rt: 'https://www.rottentomatoes.com/m/parasite_2019',
    });
    expect(parseWikidata({ results: { bindings: [] } })).toBeNull();
    expect(() => wikidataQuery('tt1" } DROP')).toThrow();
  });

  it('parses TVmaze, AniList, Jikan and MDBList without inventing values', () => {
    expect(parseTvmaze({ id: 1, url: 'u', rating: { average: 7.6 }, webChannel: { name: 'Prime Video' }, status: 'Ended' })).toMatchObject({ rating: { value: '7.6/10' }, channel: 'Prime Video' });
    expect(parseTvmaze({ id: 1, rating: { average: null } })?.rating).toBeNull();
    expect(parseAnilist({ data: { Media: { averageScore: 90, popularity: 700000, siteUrl: 's' } } })?.value).toBe('90%');
    expect(parseJikan({ data: { score: 9.1, scored_by: 2000000 } })?.value).toBe('9.10/10');
    expect(parseJikan({ data: { score: null } })).toBeNull();
    const m = parseMdblist({ ratings: [{ source: 'letterboxd', value: 4.6, votes: 900000 }, { source: 'trakt', value: null }, { source: 'popcorn', value: 90 }, { source: 'imdb', value: 8.5 }] });
    expect(m).toEqual({
      letterboxd: { label: 'Letterboxd', value: '4.6/5', votes: 900000, url: null, via: 'MDBList' },
      rtAudience: { label: 'RT Audience', value: '90%', votes: null, url: null, via: 'MDBList' },
    });
  });

  it('reads IMDb ratings file lines', () => {
    expect(parseRatingLine('tconst\taverageRating\tnumVotes')).toBeNull();
    expect(parseRatingLine('tt6473300\t8.4\t95000')).toEqual({ tconst: 'tt6473300', rating: 8.4, votes: 95000 });
    expect(parseRatingLine("tt1'; DROP\t8\t1")).toBeNull();
    expect(parseBasicsLine('tt2779318\ttvEpisode\tThe Day of the Doctor\tThe Day of the Doctor\t0\t2013\t\\N\t77\tAdventure')).toEqual(['tt2779318', 'tvEpisode']);
    expect(parseBasicsLine('tconst\ttitleType\tprimaryTitle')).toBeNull();
  });

  it('ranks by score weighted with votes, so few-vote 9.9s do not top the list', () => {
    const tiny = rankOf(9.9, 5, 'TMDB')!;
    const mirzapur = rankOf(8.4, 95000, 'IMDb')!;
    expect(mirzapur).toBeGreaterThan(tiny);
    expect(rankOf(null, 10, 'IMDb')).toBeNull();
    expect(scoreFields({ imdbRating: 8.4, imdbVotes: 95000 })).toMatchObject({ score: 8.4, scoreSource: 'IMDb' });
  });
});
