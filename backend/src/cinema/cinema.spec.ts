import { computeCinemaTrust, suggestCinemaDate, CinemaClaim } from './cinema-trust.util';
import { extractCinemaTitle, parseCinemaHeadline, parseMonthCell, languagesIn, sameFilmTitle } from './cinema-text.util';

const at = (iso: string) => new Date(iso);
const now = at('2026-11-12T12:00:00Z');
const c = (p: Partial<CinemaClaim>): CinemaClaim => ({ sourceType: 'NEWS', sourceKey: 'news:x', observedAt: at('2026-11-01T00:00:00Z'), ...p });

describe('cinema trust', () => {
  it('official channel → CONFIRMED', () => {
    const ev = [c({ sourceType: 'OFFICIAL_YOUTUBE', sourceKey: 'yt:@LycaProductions', sourceName: 'Lyca Productions', claimedDate: '2026-11-13' })];
    expect(computeCinemaTrust('2026-11-13', ev, now).trust).toBe('CONFIRMED');
  });

  it('TMDB + Wikipedia agree → CORROBORATED; one source → REPORTED', () => {
    const tmdb = c({ sourceType: 'TMDB_THEATRICAL', sourceKey: 'tmdb', claimedDate: '2026-11-13', observedAt: now });
    const wiki = c({ sourceType: 'WIKIPEDIA', sourceKey: 'wikipedia', claimedDate: '2026-11-13', observedAt: now });
    expect(computeCinemaTrust('2026-11-13', [tmdb, wiki], now).trust).toBe('CORROBORATED');
    expect(computeCinemaTrust('2026-11-13', [tmdb], now).trust).toBe('REPORTED');
  });

  it('current sources disagreeing → CONFLICT', () => {
    const tmdb = c({ sourceType: 'TMDB_THEATRICAL', sourceKey: 'tmdb', claimedDate: '2026-11-13', observedAt: now });
    const wiki = c({ sourceType: 'WIKIPEDIA', sourceKey: 'wikipedia', sourceName: 'Wikipedia', claimedDate: '2026-11-20', observedAt: now });
    const r = computeCinemaTrust('2026-11-13', [tmdb, wiki], now);
    expect(r.trust).toBe('CONFLICT');
    expect(r.reason).toContain('Wikipedia');
  });

  it('recent postponement report without a new date → CONFLICT, even if TMDB is stale', () => {
    const tmdb = c({ sourceType: 'TMDB_THEATRICAL', sourceKey: 'tmdb', claimedDate: '2026-11-13', observedAt: now });
    const news = c({ sourceKey: 'news:a', claimedDate: '2026-11-13', observedAt: at('2026-10-20T00:00:00Z') });
    const postponed = c({ sourceKey: 'news:b', sourceName: 'The Hindu', postponed: true, observedAt: at('2026-11-10T00:00:00Z') });
    const r = computeCinemaTrust('2026-11-13', [tmdb, news, postponed], now);
    expect(r.trust).toBe('CONFLICT');
    expect(r.reason).toContain('Postponement');
  });

  it('old postponement news (before the date was re-announced) does not block', () => {
    const postponed = c({ sourceKey: 'news:b', postponed: true, observedAt: at('2026-10-01T00:00:00Z') });
    const official = c({ sourceType: 'OFFICIAL_YOUTUBE', sourceKey: 'yt:@x', claimedDate: '2026-12-04', observedAt: at('2026-10-15T00:00:00Z') });
    expect(computeCinemaTrust('2026-12-04', [postponed, official], now).trust).toBe('CONFIRMED');
  });

  it('a postponement with a new date wins over older claims', () => {
    const oldNews = c({ sourceKey: 'news:a', claimedDate: '2026-11-13', observedAt: at('2026-10-01T00:00:00Z') });
    const moved = c({ sourceKey: 'news:b', claimedDate: '2026-12-25', postponed: true, observedAt: at('2026-11-05T00:00:00Z') });
    const wiki = c({ sourceType: 'WIKIPEDIA', sourceKey: 'wikipedia', claimedDate: '2026-12-25', observedAt: now });
    expect(suggestCinemaDate([oldNews, moved, wiki])).toBe('2026-12-25');
    expect(computeCinemaTrust('2026-12-25', [oldNews, moved, wiki], now).trust).toBe('CORROBORATED');
  });
});

describe('cinema text', () => {
  const pub = at('2026-11-10T00:00:00Z');
  it.each([
    ["'Jana Nayagan' release date locked for January 9", 'Jana Nayagan'],
    ['Ranabaali to release in theatres on December 5', 'Ranabaali'],
    ["Yash's Toxic release postponed again", 'Toxic'],
    ['Coolie release date: Rajinikanth film hits screens worldwide', 'Coolie'],
  ])('title from %s', (h, t) => expect(extractCinemaTitle(h)).toBe(t));

  it('parses claims and skips OTT news', () => {
    expect(parseCinemaHeadline('Ranabaali to release in theatres on December 5', pub)).toEqual({ title: 'Ranabaali', date: '2026-12-05', postponed: false });
    expect(parseCinemaHeadline("Yash's Toxic release postponed again", pub)).toMatchObject({ title: 'Toxic', postponed: true });
    expect(parseCinemaHeadline('Jailer 2 OTT release date: streaming on Prime Video', pub)).toBeUndefined();
  });

  it('reads Wikipedia month cells and language lists', () => {
    expect(parseMonthCell('N O V')).toBe(11);
    expect(parseMonthCell('DEC')).toBe(12);
    expect(languagesIn('Releasing in Tamil, Telugu & Hindi')).toEqual(['ta', 'te', 'hi']);
  });
});

describe('sameFilmTitle (real variants seen across TMDB / Wikipedia)', () => {
  it.each([
    ['DNK', 'DNK: Donga Naa Koduku'],
    ['Itllu Arjuna', 'Itlu Arjuna'],
    ['Om', 'OM: Chapter 1'],
    ['Suryaa', 'Suryaa: Ant Se Aarambh Tak'],
    ['Maya lady', 'Maya Lady'],
  ])('%s = %s', (a, b) => expect(sameFilmTitle(a, b)).toBe(true));
  it.each([
    ['Titanic', 'Titans'],
    ['Pulse', 'Puls Two'],
    ['Bandhu', 'Bandhan'],
    ['Om', 'Omen'],
  ])('%s ≠ %s', (a, b) => expect(sameFilmTitle(a, b)).toBe(false));
});
