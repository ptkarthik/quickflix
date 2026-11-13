'use client';
import React, { useEffect, useState } from 'react';
import { CalendarClock, CheckCheck, Clapperboard, ImagePlus, Inbox, Loader2, Plus, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { LANGUAGES, TRUST_STYLE, Trust, addDays, fmtRange, todayIst, weekStart } from '@/lib/ott';
import { CinemaRelease, NOW_IN_CINEMAS_DAYS, cinemaApi, cinemaBucket } from '@/lib/cinema';
import { CinemaRow } from '@/components/cinema/CinemaRow';
import { CinemaPostBuilder } from '@/components/cinema/CinemaPostBuilder';

type Tab = 'queue' | 'upcoming' | 'now' | 'post';
type When = 'UPCOMING' | 'NOW' | 'TBA' | 'OLDER' | 'ALL';
const TRUST_ORDER: Trust[] = ['CONFLICT', 'CONFIRMED', 'CORROBORATED', 'REPORTED'];

const byDate = (a: CinemaRelease, b: CinemaRelease) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999') || a.title.localeCompare(b.title);

function groupByWeek(items: CinemaRelease[]): Array<[string, CinemaRelease[]]> {
  const m = new Map<string, CinemaRelease[]>();
  for (const r of items) {
    const k = r.releaseDate ? weekStart(r.releaseDate) : 'tba';
    m.set(k, [...(m.get(k) || []), r]);
  }
  return [...m.entries()].sort(([a], [b]) => (a === 'tba' ? 1 : b === 'tba' ? -1 : a.localeCompare(b)));
}
function weekLabel(week: string, today: string) {
  if (week === 'tba') return 'Date to be announced';
  const tw = weekStart(today);
  const p = week === tw ? 'This week' : week === addDays(tw, 7) ? 'Next week' : week === addDays(tw, -7) ? 'Last week' : 'Week of';
  return `${p} • ${fmtRange(week, addDays(week, 6))}`;
}

function ManualAdd({ onCreated }: { onCreated: (r: CinemaRelease) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', releaseDate: '', language: 'ta', sourceUrl: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const field = 'rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm';
  if (!open) return <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs"><Plus className="w-3.5 h-3.5" /> Add a film manually</button>;
  return (
    <form className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
      onSubmit={async e => {
        e.preventDefault();
        try {
          const r = await cinemaApi.create({ title: f.title, releaseDate: f.releaseDate || null, language: f.language, sourceUrl: f.sourceUrl || undefined });
          onCreated(r);
          setMsg(`Added “${r.title}” to the queue (${TRUST_STYLE[r.trust].label}). It gets more evidence on the next collect.`);
          setF({ ...f, title: '', releaseDate: '', sourceUrl: '' });
        } catch (err) {
          setMsg((err as Error).message);
        }
      }}>
      <input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Film title" className={`${field} flex-1 min-w-[180px]`} />
      <input type="date" value={f.releaseDate} onChange={e => setF({ ...f, releaseDate: e.target.value })} className={field} />
      <select value={f.language} onChange={e => setF({ ...f, language: e.target.value })} className={field}>{LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
      <input value={f.sourceUrl} onChange={e => setF({ ...f, sourceUrl: e.target.value })} placeholder="Source link (optional)" className={`${field} flex-1 min-w-[160px]`} />
      <button className="rounded-md bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-semibold">Add</button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400">Close</button>
      {msg && <p className="w-full text-xs text-slate-300">{msg}</p>}
    </form>
  );
}

export default function CinemaDeskPage() {
  const [tab, setTab] = useState<Tab>('queue');
  const [rows, setRows] = useState<CinemaRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [trustFilter, setTrustFilter] = useState<Trust | 'ALL'>('ALL');
  const [whenFilter, setWhenFilter] = useState<When>('UPCOMING');
  const [langFilter, setLangFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showRejected, setShowRejected] = useState(false);
  /** Film opened in the post editor from its row ("Post" button). */
  const [postTarget, setPostTarget] = useState<string | null>(null);
  const makePost = (id: string) => { setPostTarget(id); setTab('post'); };

  const fetchRows = () =>
    cinemaApi.list().then(
      d => { setRows(d); setError(null); },
      (e: Error) => setError(e.message === 'Failed to fetch' ? 'Backend is not reachable. Start it (start.bat) and retry.' : e.message),
    ).finally(() => setLoading(false));
  const load = () => { setLoading(true); return fetchRows(); };
  useEffect(() => { fetchRows(); }, []);

  const today = todayIst();
  const replace = (r: CinemaRelease) => setRows(rs => rs.map(x => (x.id === r.id ? r : x)));
  const removeRow = (id: string) => setRows(rs => rs.filter(x => x.id !== id));
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const langOk = (r: CinemaRelease) => !langFilter.length || (r.language && langFilter.includes(r.language)) || (r.alsoIn || '').split(',').some(l => langFilter.includes(l));
  const pending = rows.filter(r => r.status === 'PENDING');
  const approved = rows.filter(r => r.status === 'APPROVED');
  const rejected = rows.filter(r => r.status === 'REJECTED');
  const pendingConfirmed = pending.filter(r => r.trust === 'CONFIRMED' && r.releaseDate);

  const bucketOf = (r: CinemaRelease): When => {
    const b = cinemaBucket(r, today);
    return b === 'upcoming' ? 'UPCOMING' : b === 'now' ? 'NOW' : b === 'tba' ? 'TBA' : 'OLDER';
  };
  const queueBase = pending.filter(langOk).filter(r => trustFilter === 'ALL' || r.trust === trustFilter);
  const whenCount = (w: When) => (w === 'ALL' ? queueBase.length : queueBase.filter(r => bucketOf(r) === w).length);
  const queue = queueBase.filter(r => whenFilter === 'ALL' || bucketOf(r) === whenFilter).sort((a, b) => (whenFilter === 'NOW' || whenFilter === 'OLDER' ? -byDate(a, b) : byDate(a, b)));

  const upcoming = approved.filter(langOk).filter(r => cinemaBucket(r, today) === 'upcoming' || cinemaBucket(r, today) === 'tba').sort(byDate);
  const nowShowing = approved.filter(langOk).filter(r => cinemaBucket(r, today) === 'now').sort((a, b) => -byDate(a, b));
  const langsPresent = LANGUAGES.filter(l => rows.some(r => r.language === l.code));

  const collect = async () => {
    setCollecting(true);
    setMsg(null);
    try {
      const s = await cinemaApi.collect();
      const t = s.trust || {};
      setMsg(
        `Checked TMDB (${s.tmdb}), Wikipedia (${s.wikipedia}), ${s.youtube} official videos, ${s.news} news items. +${s.created} films, ${s.merged} duplicate(s) merged, ${s.evidenceAdded} new evidence, ${s.dateChanges} date change(s). ` +
          `Now: ✅ ${t.CONFIRMED || 0} · 🟢 ${t.CORROBORATED || 0} · 🟡 ${t.REPORTED || 0} · 🔴 ${t.CONFLICT || 0}` +
          (s.movedBackToReview ? ` · ⚠ ${s.movedBackToReview} approved film(s) moved back to review (date changed / conflict).` : '.'),
      );
      await load();
    } catch (e) {
      setMsg(`Collect failed: ${(e as Error).message}`);
    } finally {
      setCollecting(false);
    }
  };

  const approveConfirmed = async () => {
    if (!confirm(`Approve all ${pendingConfirmed.length} ✅ Confirmed films? Each date is stated by an official production/label/studio channel.`)) return;
    const r = await cinemaApi.approveConfirmed();
    setMsg(`Approved ${r.approved} confirmed film(s).`);
    await load();
  };
  const bulk = async (status: 'APPROVED' | 'REJECTED') => {
    const ids = [...selected];
    if (status === 'APPROVED') {
      const weak = rows.filter(r => ids.includes(r.id) && r.trust !== 'CONFIRMED' && r.trust !== 'CORROBORATED');
      if (weak.length && !confirm(`${weak.length} selected film(s) are not Confirmed/Corroborated. Approve anyway?`)) return;
    }
    await cinemaApi.bulkStatus(ids, status);
    setSelected(new Set());
    await load();
  };

  const list = (items: CinemaRelease[], selectable: boolean) => (
    <div className="rounded-xl border border-slate-800 divide-y divide-slate-800 overflow-hidden">
      {items.map(r => (
        <CinemaRow key={r.id + r.updatedAt} r={r} today={today} onChanged={replace} onRemoved={removeRow} onMakePost={() => makePost(r.id)}
          {...(selectable ? { selected: selected.has(r.id), onToggleSelect: () => toggle(r.id) } : {})} />
      ))}
    </div>
  );
  const weekly = (items: CinemaRelease[], selectable: boolean, newestFirst = false) => {
    const groups = groupByWeek(items);
    return (newestFirst ? groups.reverse() : groups).map(([w, its]) => (
      <section key={w} className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{weekLabel(w, today)} <span className="text-slate-600">({its.length})</span></h3>
        {list(its, selectable)}
      </section>
    ));
  };

  const tabs: Array<{ key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }> = [
    { key: 'queue', label: 'Review Queue', icon: Inbox, count: pending.length },
    { key: 'upcoming', label: 'Upcoming in Cinemas', icon: CalendarClock, count: upcoming.length },
    { key: 'now', label: 'Now in Cinemas', icon: Clapperboard, count: nowShowing.length },
    { key: 'post', label: 'Create Instagram Post', icon: ImagePlus },
  ];
  const chip = (active: boolean) => `rounded-full px-3 py-1 text-xs font-medium border ${active ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 text-slate-400 hover:text-white'}`;

  return (
    <div className="flex flex-col h-full">
      <header className="p-6 pb-0 border-b border-slate-800 bg-[#0a0a0c] sticky top-0 z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-3xl font-bold text-white">Cinema Desk</h1>
            <p className="text-sm text-slate-400">India theatrical releases, cross-checked across TMDB, Wikipedia film lists, official production-house channels and news. Only films you approve are shown or posted.</p>
          </div>
          <button onClick={collect} disabled={collecting} className="flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-4 py-2 text-sm font-semibold whitespace-nowrap">
            {collecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {collecting ? 'Collecting & verifying… (~1–2 min)' : 'Collect & re-verify'}
          </button>
        </div>
        {msg && <div className="mb-3 text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-md px-3 py-2">{msg}</div>}
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); if (t.key !== 'post') setPostTarget(null); }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${tab === t.key ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
              {!!t.count && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.key === 'queue' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>{t.count}</span>}
            </button>
          ))}
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
        ) : (
          <div className={`space-y-4 ${tab === 'post' ? '' : 'max-w-6xl'}`}>
            {tab !== 'post' && langsPresent.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500 mr-1">Language:</span>
                {langsPresent.map(l => (
                  <button key={l.code} onClick={() => setLangFilter(f => (f.includes(l.code) ? f.filter(x => x !== l.code) : [...f, l.code]))} className={chip(langFilter.includes(l.code))}>{l.label}</button>
                ))}
                {langFilter.length > 0 && <button onClick={() => setLangFilter([])} className="text-xs text-slate-500 hover:text-white ml-1">All</button>}
              </div>
            )}

            {tab === 'queue' && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {(['ALL', ...TRUST_ORDER] as const).map(t => (
                    <button key={t} onClick={() => setTrustFilter(t)} className={chip(trustFilter === t)}>
                      {t === 'ALL' ? 'All' : `${TRUST_STYLE[t].icon} ${TRUST_STYLE[t].label}`} ({t === 'ALL' ? pending.filter(langOk).length : pending.filter(langOk).filter(r => r.trust === t).length})
                    </button>
                  ))}
                  {pendingConfirmed.length > 0 && (
                    <button onClick={approveConfirmed} className="ml-auto flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" /> Approve all ✅ Confirmed ({pendingConfirmed.length})
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500 mr-1">When:</span>
                  {([['UPCOMING', '🗓 Coming up'], ['NOW', '🎬 Released (last 5 weeks)'], ['TBA', 'Date not announced'], ['OLDER', 'Older'], ['ALL', 'All']] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setWhenFilter(k)} className={`rounded-full px-3 py-1 text-xs font-medium border ${whenFilter === k ? 'bg-slate-200 border-slate-200 text-slate-900' : 'border-slate-700 text-slate-400 hover:text-white'}`}>
                      {label} ({whenCount(k)})
                    </button>
                  ))}
                  <span className="ml-auto"><ManualAdd onCreated={r => setRows(rs => [r, ...rs])} /></span>
                </div>
                {selected.size > 0 && (
                  <div className="flex gap-2">
                    <button onClick={() => bulk('APPROVED')} className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold"><CheckCheck className="w-3.5 h-3.5" /> Approve {selected.size}</button>
                    <button onClick={() => bulk('REJECTED')} className="flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1.5 text-xs"><XCircle className="w-3.5 h-3.5" /> Reject {selected.size}</button>
                  </div>
                )}
                {queue.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center text-slate-500">Nothing here. Click “Collect & re-verify”, or change the filters.</div>
                ) : (
                  weekly(queue, true, whenFilter === 'NOW' || whenFilter === 'OLDER')
                )}
                {rejected.length > 0 && (
                  <div className="pt-2">
                    <button onClick={() => setShowRejected(!showRejected)} className="text-xs text-slate-500 hover:text-slate-300">{showRejected ? 'Hide' : 'Show'} {rejected.length} rejected</button>
                    {showRejected && <div className="mt-2">{list(rejected, false)}</div>}
                  </div>
                )}
              </>
            )}

            {tab === 'upcoming' && (upcoming.length === 0
              ? <p className="text-sm text-slate-500">No approved upcoming films yet — approve them in the Review Queue (try “Approve all ✅ Confirmed”).</p>
              : weekly(upcoming, false))}

            {tab === 'now' && (
              <>
                <p className="text-xs text-slate-400">Approved films released in the last {NOW_IN_CINEMAS_DAYS} days that aren’t streaming yet. Films that reach OTT drop off automatically.</p>
                {nowShowing.length === 0 ? <p className="text-sm text-slate-500">Nothing approved here yet.</p> : weekly(nowShowing, false, true)}
              </>
            )}

            {tab === 'post' && (
              approved.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center space-y-2">
                  <p className="text-slate-300 font-semibold">No approved films yet.</p>
                  <p className="text-sm text-slate-500">Posts only ever use films you approved. Approve the films you trust in the Review Queue (try “Approve all ✅ Confirmed”), then come back.</p>
                </div>
              ) : (
                <CinemaPostBuilder key={postTarget || 'none'} approved={approved} initialSingleId={postTarget} onChanged={replace} />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
