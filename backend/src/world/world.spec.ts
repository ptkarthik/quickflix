import { chooseScore, indiaProviders, mapTmdbDetails, mapTmdbListItem, normalizeProvider, parseOmdb } from './world.util';
import { WorldService } from './world.service';

describe('World database — accuracy rules', () => {
  it('never labels TMDB as IMDb; uses IMDb only with enough votes', () => {
    expect(chooseScore({ tmdbRating: 7.9, tmdbVotes: 3000 })).toEqual({ score: 7.9, scoreSource: 'TMDB', scoreVotes: 3000 });
    expect(chooseScore({ imdbRating: 8.4, imdbVotes: 250000, tmdbRating: 7.9, tmdbVotes: 3000 })).toEqual({ score: 8.4, scoreSource: 'IMDb', scoreVotes: 250000 });
    // 12 IMDb votes is not a real rating → TMDB (more votes) wins
    expect(chooseScore({ imdbRating: 9.8, imdbVotes: 12, tmdbRating: 6.5, tmdbVotes: 400 }).scoreSource).toBe('TMDB');
    expect(chooseScore({})).toEqual({ score: null, scoreSource: null, scoreVotes: null });
  });

  it('parses OMDb, treating N/A as unknown (not zero)', () => {
    expect(parseOmdb({ Response: 'True', imdbRating: '8.4', imdbVotes: '1,234,567', Ratings: [{ Source: 'Rotten Tomatoes', Value: '93%' }] })).toEqual({ imdbRating: 8.4, imdbVotes: 1234567, rtCritics: 93 });
    expect(parseOmdb({ Response: 'True', imdbRating: 'N/A', imdbVotes: 'N/A', Ratings: [] })).toEqual({ imdbRating: null, imdbVotes: null, rtCritics: null });
    expect(parseOmdb({ Response: 'False', Error: 'Incorrect IMDb ID.' })).toBeNull();
  });

  it('India providers: streaming first, normalized names, no duplicates, other countries ignored', () => {
    const wp = {
      results: {
        US: { flatrate: [{ provider_name: 'Hulu' }] },
        IN: {
          flatrate: [{ provider_name: 'Amazon Prime Video' }, { provider_name: 'Netflix Standard with Ads' }],
          ads: [{ provider_name: 'Amazon Prime Video with Ads' }],
          rent: [{ provider_name: 'Apple TV' }],
        },
      },
    };
    expect(indiaProviders(wp)).toEqual([
      { name: 'Prime Video', type: 'stream' },
      { name: 'Netflix', type: 'stream' },
      { name: 'Apple TV+', type: 'rent' },
    ]);
    expect(indiaProviders({ results: {} })).toEqual([]);
    expect(normalizeProvider('Disney Plus Hotstar')).toBe('JioHotstar');
  });

  it('maps TMDB details for movies and series', () => {
    const m = mapTmdbDetails('movie', {
      title: 'Parasite', original_title: '기생충', release_date: '2019-05-30', original_language: 'ko', origin_country: ['KR'],
      genres: [{ name: 'Comedy' }, { name: 'Thriller' }], overview: ' A poor family… ', poster_path: '/p.jpg', runtime: 133,
      vote_average: 8.51, vote_count: 19000, imdb_id: 'tt6751668', credits: { crew: [{ job: 'Director', name: 'Bong Joon Ho' }] },
      'watch/providers': { results: { IN: { flatrate: [{ provider_name: 'Prime Video' }] } } },
    });
    expect(m).toMatchObject({ title: 'Parasite', year: 2019, language: 'ko', countries: 'KR', genres: 'Comedy,Thriller', overview: 'A poor family…', runtime: 133, tmdbRating: 8.5, imdbId: 'tt6751668', people: 'Bong Joon Ho' });
    expect(JSON.parse(m.providersIn!)).toEqual([{ name: 'Prime Video', type: 'stream' }]);

    const t = mapTmdbDetails('tv', { name: 'Kingdom', first_air_date: '2019-01-25', number_of_seasons: 2, number_of_episodes: 12, type: 'Scripted', created_by: [{ name: 'Kim Eun-hee' }], external_ids: { imdb_id: 'tt6611916' }, vote_average: 0, vote_count: 0 });
    expect(t).toMatchObject({ title: 'Kingdom', year: 2019, seasons: 2, episodes: 12, seriesType: 'Scripted', people: 'Kim Eun-hee', imdbId: 'tt6611916', tmdbRating: null });
  });

  it('maps discover items with genre names', () => {
    expect(mapTmdbListItem('movie', { title: 'X', release_date: '', genre_ids: [53, 999], vote_average: 7, vote_count: 10 }, { 53: 'Thriller' })).toMatchObject({ year: null, releaseDate: null, genres: 'Thriller', tmdbRating: 7 });
  });
});

describe('WorldService.refreshOmdb', () => {
  const env = { ...process.env };
  afterAll(() => (process.env = env));

  it('stores real IMDb rating and switches the score source', async () => {
    process.env.OMDB_API_KEY = 'k';
    let saved: any = null;
    const row = { id: 'w1', imdbId: 'tt1', tmdbRating: 7.1, tmdbVotes: 900, imdbRating: null, imdbVotes: null };
    const prisma: any = { worldTitle: { findUnique: async () => row, count: async () => 0, update: async ({ data }: any) => (saved = data) } };
    const svc = new WorldService(prisma, { get: async () => null } as any);
    svc.fetchImpl = (async () => ({ ok: true, status: 200, json: async () => ({ Response: 'True', imdbRating: '7.8', imdbVotes: '45,000', Ratings: [] }) })) as any;
    expect(await svc.refreshOmdb('w1')).toBe('ok');
    expect(saved).toMatchObject({ imdbRating: 7.8, imdbVotes: 45000, score: 7.8, scoreSource: 'IMDb' });
  });

  it('stops for the day when OMDb says the limit is reached', async () => {
    process.env.OMDB_API_KEY = 'k';
    const prisma: any = { worldTitle: { findUnique: async () => ({ id: 'w1', imdbId: 'tt1' }), count: async () => 0, update: async () => null } };
    const svc = new WorldService(prisma, { get: async () => null } as any);
    svc.fetchImpl = (async () => ({ ok: false, status: 401, json: async () => ({ Response: 'False', Error: 'Request limit reached!' }) })) as any;
    expect(await svc.refreshOmdb('w1')).toBe('limit');
    expect(await svc.omdbBudgetLeft()).toBe(0);
  });
});
