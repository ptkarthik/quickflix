'use client';
import React, { useEffect, useState } from 'react';
import { CalendarClock, CheckCheck, ImagePlus, LayoutList, Rows3, Inbox, Loader2, MonitorPlay, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { OttRelease, PUBLISHABLE, RECENT_DAYS, TRUST_STYLE, Trust, addDays, fmtRange, isRecentlyOnOtt, ottApi, todayIst, weekStart } from '@/lib/ott';
import { ManualAddForm, ReleaseCard } from '@/components/ott/ReleaseCard';
import { ReleaseList } from '@/components/ott/ReleaseList';
import { PostBuilder } from '@/components/ott/PostBuilder';

type Tab = 'queue' | 'upcoming' | 'recent' | 'post';
type When = 'ALL' | 'UPCOMING' | 'TBA' | 'RELEASED';

const byDateAsc = (a: OttRelease, b: OttRelease) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999');

/** Groups date-sorted releases by IST week (Mon–Sun); undated ones go last under 'tba'. */
function groupByWeek(items: OttRelease[]): Array<[string, OttRelease[]]> {
  const groups = new Map<string, OttRelease[]>();
  for (const r of items) {
    const key = r.releaseDate ? weekStart(r.releaseDate) : 'tba';
    groups.set(key, [...(groups.get(key) || []), r]);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => (a === 'tba' ? 1 : b === 'tba' ? -1 : a.localeCompare(b)));
}

function QueueSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 pt-2">
      <h2 className={`text-base font-bold border-b border-slate-800 pb-2 ${accent}`}>{title}</h2>
      {children}
    </section>
  );
}

function weekLabel(week: string, today: string): string {
  if (week === 'tba') return 'Date to be announced';
  const thisWeek = weekStart(today);
  const prefix = week === thisWeek ? 'This week' : week === addDays(thisWeek, 7) ? 'Next week' : week === addDays(thisWeek, -7) ? 'Last week' : 'Week of';
  return `${prefix} • ${fmtRange(week, addDays(week, 6))}`;
}

export default function OttDeskPage() {
  const [tab, setTab] = useState<Tab>('queue');
  const [rows, setRows] = useState<OttRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [collectMsg, setCollectMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showRejected, setShowRejected] = useState(false);
  const [trustFilter, setTrustFilter] = useState<Trust | 'ALL'>('ALL');
  const [whenFilter, setWhenFilter] = useState<When>('ALL');
  const [view, setView] = useState<'list' | 'cards'>('list');
  const [postTarget, setPostTarget] = useState<string | null>(null);
  const makePost = (id: string) => { setPostTarget(id); setTab('post'); };

  const fetchRows = () =>
    ottApi.list({}).then(
      data => {
        setRows(data);
        setError(null);
      },
      (e: Error) => setError(e.message === 'Failed to fetch' ? 'Backend is not reachable. Start it and retry.' : e.message),
    ).finally(() => setLoading(false));

  const load = () => {
    setLoading(true);
    return fetchRows();
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const today = todayIst();
  const pending = rows.filter(r => r.status === 'PENDING');
  const rejected = rows.filter(r => r.status === 'REJECTED');
  const approved = rows.filter(r => r.status === 'APPROVED');
  const recent = approved.filter(r => isRecentlyOnOtt(r, today)).sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));
  const upcoming = approved
    .filter(r => !recent.includes(r) && (!r.releaseDate || r.releaseDate > today || (r.releaseDate === today && r.liveStatus !== 'LIVE')))
    .sort(byDateAsc);
  const pendingConfirmed = pending.filter(r => r.trust === 'CONFIRMED' && r.platform);
  const trustOrder: Trust[] = ['CONFLICT', 'CONFIRMED', 'CORROBORATED', 'REPORTED'];
  const trustFiltered = pending.filter(r => trustFilter === 'ALL' || r.trust === trustFilter);
  // Review queue is date-first: what's coming (soonest first), then undated, then already out (newest first).
  const queueUpcoming = trustFiltered.filter(r => r.releaseDate && r.releaseDate >= today).sort(byDateAsc);
  const queueTba = trustFiltered.filter(r => !r.releaseDate);
  const queueReleased = trustFiltered.filter(r => r.releaseDate && r.releaseDate < today).sort((a, b) => b.releaseDate!.localeCompare(a.releaseDate!));
  const whenCounts = { ALL: trustFiltered.length, UPCOMING: queueUpcoming.length, TBA: queueTba.length, RELEASED: queueReleased.length };
  const queueEmpty =
    (whenFilter === 'ALL' && trustFiltered.length === 0) ||
    (whenFilter === 'UPCOMING' && queueUpcoming.length === 0) ||
    (whenFilter === 'TBA' && queueTba.length === 0) ||
    (whenFilter === 'RELEASED' && queueReleased.length === 0);

  const upcomingByWeek = groupByWeek(upcoming);

  const replace = (r: OttRelease) => setRows(rs => rs.map(x => (x.id === r.id ? r : x)));
  const removeRow = (id: string) => setRows(rs => rs.filter(x => x.id !== id));
  const renderQueueCard = (r: OttRelease) => (
    <ReleaseCard key={r.id + r.updatedAt} release={r} onChanged={replace} onRemoved={removeRow} selectable selected={selected.has(r.id)}
      onToggleSelect={() => toggleSelect(r.id)} />
  );
  const toggleSelect = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const renderItems = (items: OttRelease[]) =>
    view === 'list'
      ? <ReleaseList items={items} onChanged={replace} onRemoved={removeRow} selected={selected} onToggleSelect={toggleSelect} />
      : items.map(renderQueueCard);

  const collect = async () => {
    setCollecting(true);
    setCollectMsg(null);
    try {
      const s = await ottApi.collect();
      const t = s.trust || {};
      setCollectMsg(
        `Checked ${s.official.videos} official videos, ${s.tmdb.claims} TMDB India releases, ${s.news.headlinesSeen} news headlines; ` +
          `verified ${s.live.live}/${s.live.checked} titles live in India. ${s.created} new titles, ${s.evidenceAdded} new evidence. ` +
          `Now: ✅ ${t.CONFIRMED || 0} · 🟢 ${t.CORROBORATED || 0} · 🟡 ${t.REPORTED || 0} · 🔴 ${t.CONFLICT || 0}` +
          (s.movedBackToReview ? ` · ⚠ ${s.movedBackToReview} approved item(s) moved back to review because their facts changed.` : '.'),
      );
      await load();
    } catch (e) {
      setCollectMsg(`Collect failed: ${(e as Error).message}`);
    } finally {
      setCollecting(false);
    }
  };

  const approveConfirmed = async () => {
    if (!confirm(`Approve all ${pendingConfirmed.length} ✅ Confirmed items? Each is backed by an official platform channel or a verified live listing in India.`)) return;
    const res = await ottApi.approveConfirmed();
    setCollectMsg(`Approved ${res.approved} confirmed item(s).`);
    await load();
  };

  const bulk = async (status: 'APPROVED' | 'REJECTED') => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (status === 'APPROVED') {
      const weak = rows.filter(r => ids.includes(r.id) && !PUBLISHABLE.includes(r.trust));
      if (weak.length && !confirm(`${weak.length} selected item(s) are not Confirmed/Corroborated. Approve anyway?`)) return;
    }
    await ottApi.bulkStatus(ids, status);
    setSelected(new Set());
    await load();
  };

  const tabs: Array<{ key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }> = [
    { key: 'queue', label: 'Review Queue', icon: Inbox, count: pending.length },
    { key: 'upcoming', label: 'Upcoming on OTT', icon: CalendarClock, count: upcoming.length },
    { key: 'recent', label: 'Recently on OTT', icon: MonitorPlay, count: recent.length },
    { key: 'post', label: 'Create Instagram Post', icon: ImagePlus },
  ];

  return (
    <div className="flex flex-col h-full">
      <header className="p-6 pb-0 border-b border-slate-800 bg-[#0a0a0c] sticky top-0 z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-3xl font-bold text-white">OTT Desk</h1>
            <p className="text-sm text-slate-400">
              Every fact carries its evidence. Only ✅ Confirmed / 🟢 Corroborated items are publishable, and only after you approve them.
            </p>
          </div>
          <button onClick={collect} disabled={collecting} className="flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-4 py-2 text-sm font-semibold">
            {collecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {collecting ? 'Collecting & verifying… (~1 min)' : 'Collect & re-verify'}
          </button>
        </div>
        {collectMsg && <div className="mb-3 text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-md px-3 py-2">{collectMsg}</div>}
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${tab === t.key ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                <Icon className="w-4 h-4" /> {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.key === 'queue' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>{t.count}</span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
        ) : error ? (
          <div className="max-w-md mx-auto text-center py-16 space-y-3">
            <p className="text-amber-400">{error}</p>
            <button onClick={load} className="rounded-md bg-indigo-600 px-4 py-2 text-sm">Retry</button>
          </div>
        ) : tab === 'queue' ? (
          <div className="space-y-4 max-w-5xl">
            <div className="flex flex-wrap items-center gap-2">
              {(['ALL', ...trustOrder] as const).map(t => {
                const n = t === 'ALL' ? pending.length : pending.filter(r => r.trust === t).length;
                return (
                  <button key={t} onClick={() => setTrustFilter(t)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border ${trustFilter === t ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 text-slate-400 hover:text-white'}`}>
                    {t === 'ALL' ? 'All' : `${TRUST_STYLE[t].icon} ${TRUST_STYLE[t].label}`} ({n})
                  </button>
                );
              })}
              {pendingConfirmed.length > 0 && (
                <button onClick={approveConfirmed} className="ml-auto flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Approve all ✅ Confirmed ({pendingConfirmed.length})
                </button>
              )}
            </div>
            {selected.size > 0 && (
              <div className="flex gap-2">
                <button onClick={() => bulk('APPROVED')} className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold"><CheckCheck className="w-3.5 h-3.5" /> Approve {selected.size}</button>
                <button onClick={() => bulk('REJECTED')} className="flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1.5 text-xs"><XCircle className="w-3.5 h-3.5" /> Reject {selected.size}</button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 mr-1">When:</span>
              {([
                ['ALL', 'All dates'],
                ['UPCOMING', '🗓 Coming up'],
                ['TBA', 'Date not announced'],
                ['RELEASED', 'Already out'],
              ] as const).map(([k, label]) => (
                <button key={k} onClick={() => setWhenFilter(k)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${whenFilter === k ? 'bg-slate-200 border-slate-200 text-slate-900' : 'border-slate-700 text-slate-400 hover:text-white'}`}>
                  {label} ({whenCounts[k]})
                </button>
              ))}
              <div className="ml-auto flex rounded-md border border-slate-700 overflow-hidden text-xs">
                <button onClick={() => setView('list')} className={`flex items-center gap-1 px-2.5 py-1 ${view === 'list' ? 'bg-slate-200 text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                  <LayoutList className="w-3.5 h-3.5" /> List
                </button>
                <button onClick={() => setView('cards')} className={`flex items-center gap-1 px-2.5 py-1 ${view === 'cards' ? 'bg-slate-200 text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                  <Rows3 className="w-3.5 h-3.5" /> Cards
                </button>
              </div>
            </div>
            {queueEmpty ? (
              <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center text-slate-500">Nothing here. Click “Collect & re-verify”, or add a release from the Upcoming tab.</div>
            ) : (
              <>
                {(whenFilter === 'ALL' || whenFilter === 'UPCOMING') && queueUpcoming.length > 0 && (
                  <QueueSection title={`Coming up (${queueUpcoming.length}) — soonest first`} accent="text-emerald-300">
                    {groupByWeek(queueUpcoming).map(([week, items]) => (
                      <div key={week} className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{weekLabel(week, today)}</h3>
                        {renderItems(items)}
                      </div>
                    ))}
                  </QueueSection>
                )}
                {(whenFilter === 'ALL' || whenFilter === 'TBA') && queueTba.length > 0 && (
                  <QueueSection title={`Date not announced (${queueTba.length})`} accent="text-amber-300">
                    {renderItems(queueTba)}
                  </QueueSection>
                )}
                {(whenFilter === 'ALL' || whenFilter === 'RELEASED') && queueReleased.length > 0 && (
                  <QueueSection title={`Already out (${queueReleased.length}) — newest first`} accent="text-slate-300">
                    {groupByWeek(queueReleased).reverse().map(([week, items]) => (
                      <div key={week} className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{weekLabel(week, today)}</h3>
                        {renderItems(items)}
                      </div>
                    ))}
                  </QueueSection>
                )}
              </>
            )}
            {rejected.length > 0 && (
              <div className="pt-4">
                <button onClick={() => setShowRejected(!showRejected)} className="text-xs text-slate-500 hover:text-slate-300">{showRejected ? 'Hide' : 'Show'} {rejected.length} rejected</button>
                {showRejected && <div className="space-y-3 mt-3">{rejected.map(r => <ReleaseCard key={r.id + r.updatedAt} release={r} onChanged={replace} onRemoved={removeRow} />)}</div>}
              </div>
            )}
          </div>
        ) : tab === 'upcoming' ? (
          <div className="space-y-6 max-w-5xl">
            <ManualAddForm onCreated={r => setRows(rs => [r, ...rs.filter(x => x.id !== r.id)])} />
            {upcomingByWeek.length === 0 && <p className="text-slate-500 text-sm">No approved upcoming releases yet.</p>}
            {upcomingByWeek.map(([week, items]) => (
              <section key={week} className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">{weekLabel(week, today)}</h2>
                {items.map(r => <ReleaseCard key={r.id + r.updatedAt} release={r} onChanged={replace} onRemoved={removeRow} onMakePost={() => makePost(r.id)} />)}
              </section>
            ))}
          </div>
        ) : tab === 'recent' ? (
          <div className="space-y-3 max-w-5xl">
            <p className="text-sm text-slate-400">
              Approved titles that arrived on OTT in the last {RECENT_DAYS} days. “Streaming in India” means the title is listed as streaming in India right now; “Catalogue title” means an older film newly added to the platform (say “new to Netflix”, not “new release”).
            </p>
            {recent.length === 0 && <p className="text-slate-500 text-sm">Nothing here yet — approve items in the Review Queue (try “Approve all ✅ Confirmed”).</p>}
            {recent.map(r => <ReleaseCard key={r.id + r.updatedAt} release={r} onChanged={replace} onRemoved={removeRow} onMakePost={() => makePost(r.id)} />)}
          </div>
        ) : (
          <PostBuilder key={postTarget || 'none'} approved={approved} all={rows} initialSingleId={postTarget} onChanged={replace} />
        )}
      </div>
    </div>
  );
}
