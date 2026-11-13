import { cleanOneLiner, firstSentence, parseOmdbFull, parseRatingsShown } from './extras.util';
import { ExtrasService } from './extras.service';

describe('extras util', () => {
  it('parses OMDb ratings, plot and awards; N/A is unknown', () => {
    expect(parseOmdbFull({ Response: 'True', imdbRating: '8.5', imdbVotes: '1,200,817', Metascore: '96', Plot: 'Greed and class discrimination…', Awards: 'Won 4 Oscars. 310 wins total', Ratings: [{ Source: 'Rotten Tomatoes', Value: '99%' }] }))
      .toEqual({ imdbRating: 8.5, imdbVotes: 1200817, rtCritics: 99, metascore: 96, plot: 'Greed and class discrimination…', awards: 'Won 4 Oscars. 310 wins total' });
    expect(parseOmdbFull({ Response: 'True', imdbRating: 'N/A', Metascore: 'N/A', Plot: 'N/A', Awards: 'N/A' })).toMatchObject({ imdbRating: null, metascore: null, plot: null, awards: null });
    expect(parseOmdbFull({ Response: 'False' })).toBeNull();
  });

  it('first Wikipedia sentence without brackets', () => {
    expect(firstSentence('Parasite (Korean: 기생충; RR: Gisaengchung) is a 2019 South Korean black comedy thriller film directed by Bong Joon Ho. It stars Song Kang-ho.'))
      .toBe('Parasite is a 2019 South Korean black comedy thriller film directed by Bong Joon Ho.');
    expect(firstSentence(null)).toBeNull();
  });

  it('cleans one-liners and rating keys', () => {
    expect(cleanOneLiner('  hello   world ')).toBe('hello world');
    expect(cleanOneLiner('')).toBeNull();
    expect(parseRatingsShown(['imdb', 'rt', 'bogus', 'imdb'])).toEqual(['imdb', 'rt']);
    expect(parseRatingsShown('["tmdb"]')).toEqual(['tmdb']);
  });
});

describe('ExtrasService.aiOneLiners', () => {
  it('refuses without a synopsis and drops lines with dates/platforms', async () => {
    const prisma: any = { cinemaRelease: { findUnique: async () => ({ title: 'X', tmdbId: 1, releaseDate: '2026-12-04', overview: null }) } };
    const svc = new ExtrasService(prisma, {} as any, { get: async () => null } as any, {} as any);
    await expect(svc.aiOneLiners('cinema', 'c1', {})).rejects.toThrow(/synopsis/);

    prisma.cinemaRelease.findUnique = async () => ({ title: 'X', tmdbId: 1, releaseDate: '2026-12-04', overview: 'A cop fights the system.', genres: 'Action', language: 'ta' });
    const ai: any = { generate: async () => ({ model: 'm', text: JSON.stringify({ options: ['One cop. One system. 🔥', 'Streaming on Netflix soon', 'In theatres this Friday', 'Watch it on the big screen'] }) }) };
    const svc2 = new ExtrasService(prisma, ai, { get: async () => null } as any, {} as any);
    const r = await svc2.aiOneLiners('cinema', 'c1', {});
    expect(r.options).toEqual(['One cop. One system. 🔥', 'Watch it on the big screen']);
  });
});
