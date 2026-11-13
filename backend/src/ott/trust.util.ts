/**
 * Trust rules for OTT release facts (platform + date for one release in India).
 *
 *   CONFIRMED     – the platform's own official channel states this platform and date, or
 *                   (on/after the date) the title is verified streaming in India on this platform.
 *   CORROBORATED  – at least 2 independent sources state the platform AND at least 2 state the date,
 *                   and no source contradicts either.
 *   REPORTED      – anything weaker (single source, missing platform or date).
 *   CONFLICT      – sources disagree, an official source disagrees, or it is streaming on a different
 *                   platform, or it is well past the date and still not streaming in India.
 *
 * Only CONFIRMED / CORROBORATED should ever be shown to the audience (after human approval).
 */

export type Trust = 'CONFIRMED' | 'CORROBORATED' | 'REPORTED' | 'CONFLICT';
export type LiveStatus = 'LIVE' | 'NOT_LIVE' | 'UNKNOWN';
export type EvidenceType = 'OFFICIAL_YOUTUBE' | 'TMDB_RELEASE' | 'TMDB_LIVE' | 'NEWS' | 'MANUAL';

export interface EvidenceClaim {
  sourceType: EvidenceType;
  sourceKey: string; // independence key: two claims with the same key count as one source
  sourceName?: string | null;
  claimedPlatform?: string | null;
  claimedDate?: string | null;
}

export interface TrustInput {
  platform?: string | null;
  releaseDate?: string | null;
  liveStatus: LiveStatus;
  livePlatforms: string[];
  evidence: EvidenceClaim[];
  today: string; // YYYY-MM-DD (IST)
  /** Days after the release date before "still not streaming" becomes a conflict (watch-provider data lags ~1-2 days). */
  liveGraceDays?: number;
}

export interface TrustResult {
  trust: Trust;
  reason: string;
}

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const fmt = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });

export function computeTrust(input: TrustInput): TrustResult {
  const { platform: P, releaseDate: D, today } = input;
  const grace = input.liveGraceDays ?? 3;
  const claims = input.evidence.filter(e => e.sourceType !== 'TMDB_LIVE');

  // 1) Live availability is the strongest proof once the date has arrived.
  if (input.liveStatus === 'LIVE' && input.livePlatforms.length > 0) {
    if (P && input.livePlatforms.includes(P)) {
      return { trust: 'CONFIRMED', reason: `Verified streaming in India on ${P}.` };
    }
    if (P && D && D <= today) {
      return { trust: 'CONFLICT', reason: `Listed as ${P}, but it is actually streaming in India on ${input.livePlatforms.join(', ')}.` };
    }
  }

  if (!P) return { trust: 'REPORTED', reason: 'Platform not known yet.' };
  if (!D) return { trust: 'REPORTED', reason: 'Release date not known yet.' };

  // 2) Per-source support / contradiction (one vote per independent source).
  const bySource = new Map<string, { supportsP: boolean; supportsD: boolean; contraP?: string; contraD?: string; official: boolean; name: string }>();
  for (const e of claims) {
    const s = bySource.get(e.sourceKey) || { supportsP: false, supportsD: false, official: e.sourceType === 'OFFICIAL_YOUTUBE', name: e.sourceName || e.sourceKey };
    if (e.claimedPlatform) {
      if (e.claimedPlatform === P) s.supportsP = true;
      else s.contraP = e.claimedPlatform;
    }
    if (e.claimedDate) {
      if (e.claimedDate === D) s.supportsD = true;
      else s.contraD = e.claimedDate;
    }
    bySource.set(e.sourceKey, s);
  }
  const sources = Array.from(bySource.values());
  // A source that ever stated the right value is not counted as contradicting it (e.g. older + newer article).
  const contradicting = sources.filter(s => (s.contraP && !s.supportsP) || (s.contraD && !s.supportsD));

  const official = sources.filter(s => s.official);
  const officialFull = official.find(s => s.supportsP && s.supportsD);
  const officialContra = official.find(s => (s.contraD && !s.supportsD) || (s.contraP && !s.supportsP));

  let result: TrustResult;
  if (officialContra) {
    const what = officialContra.contraD && !officialContra.supportsD ? `date ${fmt(officialContra.contraD)}` : `platform ${officialContra.contraP}`;
    result = { trust: 'CONFLICT', reason: `Official ${officialContra.name} says ${what}.` };
  } else if (officialFull) {
    const others = contradicting.filter(s => !s.official).length;
    result = {
      trust: 'CONFIRMED',
      reason: `Announced by official ${officialFull.name} channel.` + (others ? ` (${others} other source${others > 1 ? 's' : ''} reported something different; official wins.)` : ''),
    };
  } else if (contradicting.length > 0) {
    const c = contradicting[0];
    const what = c.contraD && !c.supportsD ? `date ${fmt(c.contraD)}` : `platform ${c.contraP}`;
    result = { trust: 'CONFLICT', reason: `${c.name} reports ${what}.` };
  } else {
    const pVotes = sources.filter(s => s.supportsP).length;
    const dVotes = sources.filter(s => s.supportsD).length;
    if (pVotes >= 2 && dVotes >= 2) {
      result = { trust: 'CORROBORATED', reason: `${Math.min(pVotes, dVotes)}+ independent sources agree on ${P} and ${fmt(D)}.` };
    } else {
      const need: string[] = [];
      if (pVotes < 2) need.push(`platform (${pVotes}/2 sources)`);
      if (dVotes < 2) need.push(`date (${dVotes}/2 sources)`);
      result = { trust: 'REPORTED', reason: `Needs another independent source for ${need.join(' and ')}.` };
    }
  }

  // 3) Past the date but no streaming listing in India. Listings (JustWatch) are thin for some regional
  //    platforms (Aha, Sun NXT, ETV Win…), so absence is not proof of a delay — but it is no longer
  //    publishable without a human checking the platform app.
  if (input.liveStatus === 'NOT_LIVE' && D <= addDays(today, -grace) && result.trust !== 'CONFLICT') {
    return {
      trust: 'REPORTED',
      reason: `Release date ${fmt(D)} has passed but no ${P} listing found in India yet — check the ${P} app (could be delayed, or the listing is missing).`,
    };
  }
  return result;
}

/**
 * Best platform/date suggested by the evidence (used to fill fields that a human hasn't locked).
 * Official > live > most independent votes.
 */
export function suggestFacts(evidence: EvidenceClaim[], livePlatforms: string[]): { platform?: string; date?: string } {
  const pick = (field: 'claimedPlatform' | 'claimedDate'): string | undefined => {
    const official = evidence.find(e => e.sourceType === 'OFFICIAL_YOUTUBE' && e[field]);
    if (official) return official[field]!;
    if (field === 'claimedPlatform' && livePlatforms.length === 1) return livePlatforms[0];
    const votes = new Map<string, Set<string>>();
    for (const e of evidence) {
      if (e.sourceType === 'TMDB_LIVE' || !e[field]) continue;
      const v = e[field]!;
      votes.set(v, (votes.get(v) || new Set()).add(e.sourceKey));
    }
    let best: string | undefined;
    let bestN = 0;
    for (const [v, s] of votes) if (s.size > bestN) { best = v; bestN = s.size; }
    return best;
  };
  return { platform: pick('claimedPlatform'), date: pick('claimedDate') };
}
