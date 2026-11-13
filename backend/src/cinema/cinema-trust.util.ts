/**
 * Trust for a theatrical release date in India, from independent evidence.
 *
 *   CONFIRMED     an official production-house / label / studio channel states this date (latest official word)
 *   CORROBORATED  2+ independent sources (TMDB, Wikipedia, different news outlets, …) agree, none current disagrees
 *   REPORTED      one source, or no date yet
 *   CONFLICT      a current source disagrees, or a postponement was reported after the date was announced
 *
 * Postponements: each source's LATEST claim is what counts, and any claim older than a later
 * postponement report is ignored — so an old "Nov 13" doesn't fight the new date forever.
 */

export type CinemaTrust = 'CONFIRMED' | 'CORROBORATED' | 'REPORTED' | 'CONFLICT';
export type CinemaEvidenceType = 'TMDB_THEATRICAL' | 'WIKIPEDIA' | 'OFFICIAL_YOUTUBE' | 'NEWS' | 'MANUAL';

export interface CinemaClaim {
  sourceType: CinemaEvidenceType;
  sourceKey: string;
  sourceName?: string | null;
  claimedDate?: string | null;
  postponed?: boolean;
  observedAt: Date;
}

/** Sources that describe the *current* state (re-read every collect), vs point-in-time news. */
const CURRENT_STATE: CinemaEvidenceType[] = ['TMDB_THEATRICAL', 'WIKIPEDIA', 'OFFICIAL_YOUTUBE', 'MANUAL'];

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Each source's latest dated claim, dropping claims made before a later postponement report. */
export function effectiveClaims(evidence: CinemaClaim[]): CinemaClaim[] {
  const lastPostpone = Math.max(0, ...evidence.filter(e => e.postponed).map(e => e.observedAt.getTime()));
  const latest = new Map<string, CinemaClaim>();
  for (const e of evidence) {
    if (!e.claimedDate) continue;
    // A claim that pre-dates a postponement report only stays valid if it's a current-state source re-read since.
    if (e.observedAt.getTime() < lastPostpone && !e.postponed) continue;
    const prev = latest.get(e.sourceKey);
    if (!prev || e.observedAt > prev.observedAt) latest.set(e.sourceKey, e);
  }
  return [...latest.values()];
}

/** Best date: latest official claim, else the date most independent sources agree on (ties → most recent). */
export function suggestCinemaDate(evidence: CinemaClaim[]): string | undefined {
  const claims = effectiveClaims(evidence);
  const official = claims.filter(c => c.sourceType === 'OFFICIAL_YOUTUBE' || c.sourceType === 'MANUAL').sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());
  if (official[0]?.claimedDate) return official[0].claimedDate;
  const votes = new Map<string, { n: number; last: number }>();
  for (const c of claims) {
    const v = votes.get(c.claimedDate!) || { n: 0, last: 0 };
    votes.set(c.claimedDate!, { n: v.n + 1, last: Math.max(v.last, c.observedAt.getTime()) });
  }
  return [...votes.entries()].sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last)[0]?.[0];
}

const POSTPONE_WINDOW_MS = 21 * 86400000;

export function computeCinemaTrust(date: string | null | undefined, evidence: CinemaClaim[], now = new Date()): { trust: CinemaTrust; reason: string } {
  if (!date) return { trust: 'REPORTED', reason: 'No release date yet.' };
  const claims = effectiveClaims(evidence);
  const supporting = claims.filter(c => c.claimedDate === date);
  const contradicting = claims.filter(c => c.claimedDate !== date && CURRENT_STATE.includes(c.sourceType));
  const names = (cs: CinemaClaim[]) => [...new Set(cs.map(c => c.sourceName || c.sourceKey))].join(', ');

  // A recent "postponed" report (without a new date) beats this date unless the date was announced after it.
  // TMDB/Wikipedia re-reads don't count as announcements — they can simply be stale.
  const lastAnnounce = Math.max(0, ...supporting.filter(c => c.sourceType === 'OFFICIAL_YOUTUBE' || c.sourceType === 'NEWS' || c.sourceType === 'MANUAL').map(c => c.observedAt.getTime()));
  const laterPostpone = evidence.filter(
    e => e.postponed && !e.claimedDate && e.observedAt.getTime() > lastAnnounce && now.getTime() - e.observedAt.getTime() < POSTPONE_WINDOW_MS,
  );
  if (laterPostpone.length) {
    return { trust: 'CONFLICT', reason: `Postponement reported by ${names(laterPostpone)} after ${fmt(date)} was announced — check the new date.` };
  }
  if (contradicting.length) {
    const other = [...new Set(contradicting.map(c => c.claimedDate))].map(d => fmt(d!)).join(' / ');
    return { trust: 'CONFLICT', reason: `${names(contradicting)} say${contradicting.length === 1 ? 's' : ''} ${other}, not ${fmt(date)}.` };
  }
  const official = supporting.find(c => c.sourceType === 'OFFICIAL_YOUTUBE');
  if (official) return { trust: 'CONFIRMED', reason: `Official channel ${official.sourceName || official.sourceKey} says ${fmt(date)}.` };
  const manual = supporting.find(c => c.sourceType === 'MANUAL');
  const independent = new Set(supporting.map(c => c.sourceKey)).size;
  if (independent >= 2) return { trust: 'CORROBORATED', reason: `${independent} independent sources agree on ${fmt(date)}: ${names(supporting)}.` };
  if (manual) return { trust: 'REPORTED', reason: `Entered by you — no independent source yet for ${fmt(date)}.` };
  return { trust: 'REPORTED', reason: supporting.length ? `Only ${names(supporting)} says ${fmt(date)}.` : `No source supports ${fmt(date)}.` };
}
