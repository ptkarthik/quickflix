import { computeTrust, EvidenceClaim, suggestFacts, TrustInput } from './trust.util';

const today = '2026-11-12';
const base = (over: Partial<TrustInput>): TrustInput => ({
  platform: 'Prime Video',
  releaseDate: '2026-11-20',
  liveStatus: 'UNKNOWN',
  livePlatforms: [],
  evidence: [],
  today,
  ...over,
});
const official = (p?: string, d?: string): EvidenceClaim => ({ sourceType: 'OFFICIAL_YOUTUBE', sourceKey: `official:${p}`, sourceName: p, claimedPlatform: p, claimedDate: d });
const news = (name: string, p?: string, d?: string): EvidenceClaim => ({ sourceType: 'NEWS', sourceKey: `news:${name}`, sourceName: name, claimedPlatform: p, claimedDate: d });
const tmdb = (p?: string, d?: string): EvidenceClaim => ({ sourceType: 'TMDB_RELEASE', sourceKey: 'tmdb', sourceName: 'TMDB', claimedPlatform: p, claimedDate: d });

describe('computeTrust', () => {
  it('official channel with platform and date => CONFIRMED', () => {
    expect(computeTrust(base({ evidence: [official('Prime Video', '2026-11-20')] })).trust).toBe('CONFIRMED');
  });

  it('official wins over a disagreeing news outlet, but notes it', () => {
    const r = computeTrust(base({ evidence: [official('Prime Video', '2026-11-20'), news('NDTV', 'Prime Video', '2026-11-27')] }));
    expect(r.trust).toBe('CONFIRMED');
    expect(r.reason).toMatch(/official wins/);
  });

  it('official channel disagreeing with the listed date => CONFLICT', () => {
    expect(computeTrust(base({ evidence: [official('Prime Video', '2026-11-27')] })).trust).toBe('CONFLICT');
  });

  it('two independent outlets agreeing on platform and date => CORROBORATED', () => {
    const r = computeTrust(base({ evidence: [news('NDTV', 'Prime Video', '2026-11-20'), news('The Hindu', 'Prime Video', '2026-11-20')] }));
    expect(r.trust).toBe('CORROBORATED');
  });

  it('the same outlet twice is still one source => REPORTED', () => {
    const r = computeTrust(base({ evidence: [news('NDTV', 'Prime Video', '2026-11-20'), news('NDTV', 'Prime Video', '2026-11-20')] }));
    expect(r.trust).toBe('REPORTED');
  });

  it('TMDB date + one outlet with platform+date is not enough for the platform', () => {
    const r = computeTrust(base({ evidence: [tmdb(undefined, '2026-11-20'), news('NDTV', 'Prime Video', '2026-11-20')] }));
    expect(r.trust).toBe('REPORTED');
    expect(r.reason).toMatch(/platform \(1\/2/);
  });

  it('outlets disagreeing on the date => CONFLICT', () => {
    const r = computeTrust(base({ evidence: [news('NDTV', 'Prime Video', '2026-11-20'), news('India Today', 'Prime Video', '2026-11-27')] }));
    expect(r.trust).toBe('CONFLICT');
    expect(r.reason).toMatch(/India Today/);
  });

  it('outlets disagreeing on the platform => CONFLICT', () => {
    expect(computeTrust(base({ evidence: [news('A', 'Prime Video', '2026-11-20'), news('B', 'Netflix', '2026-11-20')] })).trust).toBe('CONFLICT');
  });

  it('missing platform or date => REPORTED', () => {
    expect(computeTrust(base({ platform: null })).trust).toBe('REPORTED');
    expect(computeTrust(base({ releaseDate: null })).trust).toBe('REPORTED');
  });

  it('verified streaming in India on the listed platform => CONFIRMED even with weak claims', () => {
    const r = computeTrust(base({ releaseDate: '2026-11-10', liveStatus: 'LIVE', livePlatforms: ['Prime Video'], evidence: [news('A', 'Prime Video', '2026-11-10')] }));
    expect(r.trust).toBe('CONFIRMED');
  });

  it('streaming on a different platform than listed => CONFLICT', () => {
    const r = computeTrust(base({ releaseDate: '2026-11-10', liveStatus: 'LIVE', livePlatforms: ['Netflix'] }));
    expect(r.trust).toBe('CONFLICT');
    expect(r.reason).toMatch(/Netflix/);
  });

  it('well past the date with no streaming listing => REPORTED (not publishable, check the app)', () => {
    const r = computeTrust(base({ releaseDate: '2026-11-05', liveStatus: 'NOT_LIVE', evidence: [official('Prime Video', '2026-11-05')] }));
    expect(r.trust).toBe('REPORTED');
    expect(r.reason).toMatch(/check the Prime Video app/);
  });

  it('just past the date and not yet streaming stays as-is (provider data lags)', () => {
    const r = computeTrust(base({ releaseDate: '2026-11-11', liveStatus: 'NOT_LIVE', evidence: [official('Prime Video', '2026-11-11')] }));
    expect(r.trust).toBe('CONFIRMED');
  });
});

describe('suggestFacts', () => {
  it('prefers official claims', () => {
    expect(suggestFacts([news('A', 'Netflix', '2026-11-20'), news('B', 'Netflix', '2026-11-20'), official('Prime Video', '2026-11-21')], [])).toEqual({ platform: 'Prime Video', date: '2026-11-21' });
  });
  it('falls back to the single live platform, then majority of independent sources', () => {
    expect(suggestFacts([news('A', undefined, '2026-11-20'), news('B', undefined, '2026-11-20'), news('C', undefined, '2026-11-27')], ['JioHotstar'])).toEqual({ platform: 'JioHotstar', date: '2026-11-20' });
  });
});
