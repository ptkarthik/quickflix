'use client';
/* eslint-disable @next/next/no-img-element -- Instagram thumbnails */
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Lightbulb, Loader2, RefreshCw, TrendingUp, Users } from 'lucide-react';
import { GrowthData, Group, INSIGHTS_SETUP, PostStats, growthApi } from '@/lib/growth';

const n = (v: number | null | undefined) => (v == null ? '—' : Math.round(v).toLocaleString('en-IN'));
const signed = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toLocaleString('en-IN')}`);
const ACCENT = '#818cf8'; // one series per chart → one hue

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

/** Horizontal bars: one series, median per group; the value is printed, the bar only shows size. */
function Bars({ title, groups, unit, note }: { title: string; groups: Group[]; unit: string; note?: string }) {
  if (!groups.length) return null;
  const max = Math.max(...groups.map(g => g.median), 1);
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-[11px] text-slate-500">Median {unit} per post{note ? ` · ${note}` : ''}</p>
      </div>
      <ul className="space-y-1.5">
        {groups.map(g => (
          <li key={g.label} className="grid grid-cols-[140px_1fr_64px] items-center gap-2 text-xs" title={`${g.label}: median ${n(g.median)} ${unit} over ${g.posts} post(s)`}>
            <span className="truncate text-slate-300">{g.label}</span>
            <span className="h-3 rounded-r bg-slate-800/60">
              <span className="block h-3 rounded-r" style={{ width: `${Math.max(2, (g.median / max) * 100)}%`, background: ACCENT }} />
            </span>
            <span className="text-right tabular-nums text-slate-200">{n(g.median)} <span className="text-slate-500">· {g.posts}</span></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Follower count over time — 2px line, hover shows the day. */
function FollowerLine({ series }: { series: Array<{ date: string; followers: number }> }) {
  const [hover, setHover] = useState<number | null>(null);
  if (series.length < 2) return <p className="text-xs text-slate-500">The follower trend starts showing after the second daily sync (the app saves one count per day).</p>;
  const W = 600, H = 120, P = 8;
  const ys = series.map(s => s.followers);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const x = (i: number) => P + (i / (series.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / Math.max(1, hi - lo)) * (H - 2 * P);
  const d = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.followers).toFixed(1)}`).join(' ');
  const h = hover != null ? series[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" onMouseLeave={() => setHover(null)}
        onMouseMove={e => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const i = Math.round(((e.clientX - r.left) / r.width) * (series.length - 1)); setHover(Math.max(0, Math.min(series.length - 1, i))); }}>
        <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="#334155" strokeWidth={1} />
        <path d={d} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" />
        {hover != null && <><line x1={x(hover)} x2={x(hover)} y1={P} y2={H - P} stroke="#64748b" strokeDasharray="3 3" /><circle cx={x(hover)} cy={y(series[hover].followers)} r={4} fill={ACCENT} stroke="#0f172a" strokeWidth={2} /></>}
      </svg>
      {h && <div className="absolute top-0 right-0 rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs text-slate-200">{h.date}: <b>{n(h.followers)}</b> followers</div>}
      <div className="flex justify-between text-[10px] text-slate-500"><span>{series[0].date}</span><span>{series[series.length - 1].date}</span></div>
    </div>
  );
}

type SortKey = 'timestamp' | 'reach' | 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'avgWatchSec';

export default function GrowthPage() {
  const [data, setData] = useState<GrowthData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [sort, setSort] = useState<SortKey>('timestamp');

  useEffect(() => { growthApi.get().then(setData, e => setErr(e.message)); }, []);
  const sync = async () => {
    setSyncing(true);
    setErr(null);
    try { setData(await growthApi.sync()); } catch (e) { setErr((e as Error).message); } finally { setSyncing(false); }
  };

  const full = !!data?.full;
  const posts = useMemo(() => {
    const p = [...(data?.posts || [])];
    return p.sort((a, b) => (sort === 'timestamp' ? b.timestamp.localeCompare(a.timestamp) : ((b[sort] as number) ?? -1) - ((a[sort] as number) ?? -1)));
  }, [data, sort]);
  const a = data?.analysis;
  const cols: Array<[SortKey, string, (p: PostStats) => string]> = [
    ['timestamp', 'Posted', p => new Date(p.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })],
    ...(full ? [['reach', 'Reach', (p: PostStats) => n(p.reach)], ['views', 'Views', (p: PostStats) => n(p.views)]] as Array<[SortKey, string, (p: PostStats) => string]> : []),
    ['likes', 'Likes', p => n(p.likes)],
    ['comments', 'Comments', p => n(p.comments)],
    ...(full ? [['shares', 'Sends', (p: PostStats) => n(p.shares)], ['saves', 'Saves', (p: PostStats) => n(p.saves)], ['avgWatchSec', 'Avg watch', (p: PostStats) => (p.avgWatchSec == null ? '—' : `${p.avgWatchSec}s`)]] as Array<[SortKey, string, (p: PostStats) => string]> : []),
  ];

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><TrendingUp className="w-6 h-6 text-indigo-400" /> Growth & analytics</h1>
          <p className="text-sm text-slate-400">Your real Instagram numbers (read-only), and what they say works for your audience. Synced every 6 hours.</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          {data?.syncedAt && <span>Last sync {new Date(data.syncedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>}
          <button onClick={sync} disabled={syncing} className="flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 text-sm text-white">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sync now
          </button>
        </div>
      </div>
      {err && <p className="text-sm text-amber-400">{err}</p>}
      {!data ? <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p> : !data.configured ? (
        <p className="text-sm text-amber-400">Instagram isn’t connected: add {data.missing?.join(', ')} to backend/.env.</p>
      ) : !data.synced ? (
        <p className="text-sm text-slate-400">No data yet — press <b>Sync now</b>.</p>
      ) : (
        <>
          {data.insightsError && (
            <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-4 space-y-2 text-sm">
              <p className="flex items-center gap-2 font-semibold text-amber-300"><AlertTriangle className="w-4 h-4" /> Basic mode — likes &amp; comments only</p>
              <p className="text-xs text-amber-200/80">{data.insightsError} Reach, views, sends, saves, watch time and follows-from-post need it. It’s free:</p>
              <ol className="list-decimal pl-5 text-xs text-slate-300 space-y-1">{INSIGHTS_SETUP.map(s => <li key={s}>{s}</li>)}</ol>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            <Tile label="Followers" value={n(data.growth.current ?? data.account?.followers)} sub={`7 days ${signed(data.growth.last7)} · 30 days ${signed(data.growth.last30)}`} />
            <Tile label="Posts (last 30 days)" value={n(data.totals?.last30)} sub={`${n(data.totals?.posts)} analysed`} />
            {full && <Tile label="Reach" value={n(data.totals?.reach)} sub="all analysed posts" />}
            {full && <Tile label="Sends" value={n(data.totals?.shares)} sub="biggest signal for new viewers" />}
            {full && <Tile label="Saves" value={n(data.totals?.saves)} />}
            {full && <Tile label="Follows from posts" value={n(data.totals?.follows)} />}
            <Tile label="Likes" value={n(data.totals?.likes)} />
            <Tile label="Comments" value={n(data.totals?.comments)} />
          </div>

          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Users className="w-4 h-4 text-indigo-400" /> Followers over time</h3>
            <FollowerLine series={data.growth.series} />
          </section>

          {a && (
            <>
              <section className="rounded-xl border border-indigo-900/60 bg-indigo-950/30 p-4 space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Lightbulb className="w-4 h-4 text-amber-300" /> What your numbers say</h3>
                {a.findings.length ? (
                  <ul className="space-y-1.5 text-sm text-slate-200">
                    {a.findings.map(f => (
                      <li key={f.text} className="flex items-start gap-2">
                        <span className={`mt-0.5 shrink-0 rounded px-1.5 text-[10px] font-semibold ${f.strength === 'strong' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>{f.strength === 'strong' ? 'CLEAR' : 'EARLY'}</span>
                        {f.text}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-slate-400">No clear pattern yet — keep posting a mix and check back.</p>}
                <p className="text-[11px] text-slate-500">Based on posts from the last 90 days. “Early” = few posts behind it, treat as a hint. Time, day, hashtags and caption length are compared within {a.within ? `${a.within}s` : 'one format'} so formats don’t skew them.</p>
              </section>
              <div className="grid gap-3 lg:grid-cols-2">
                <Bars title="Format" groups={a.byFormat} unit={a.unit} />
                <Bars title="Post type (made in this app)" groups={a.byKind} unit={a.unit} />
                <Bars title="Time of day (IST)" groups={a.byDaypart} unit={a.unit} note={a.within ? `${a.within}s only` : undefined} />
                <Bars title="Day of week" groups={a.byWeekday} unit={a.unit} note={a.within ? `${a.within}s only` : undefined} />
                <Bars title="Hashtags" groups={a.byHashtags} unit={a.unit} note={a.within ? `${a.within}s only` : undefined} />
                <Bars title="Caption length" groups={a.byLength} unit={a.unit} note={a.within ? `${a.within}s only` : undefined} />
              </div>
            </>
          )}

          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Every post</h3>
              <span className="text-[11px] text-slate-500">click a column to sort</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="py-1.5 pr-2 font-medium">Post</th>
                    {cols.map(([k, label]) => <th key={k} className="py-1.5 px-2 text-right font-medium"><button onClick={() => setSort(k)} className={sort === k ? 'text-indigo-300' : 'hover:text-white'}>{label}{sort === k ? ' ↓' : ''}</button></th>)}
                  </tr>
                </thead>
                <tbody>
                  {posts.map(p => (
                    <tr key={p.id} className="border-t border-slate-800/80">
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-2 min-w-[260px]">
                          {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-10 w-8 rounded object-cover shrink-0" /> : <span className="h-10 w-8 rounded bg-slate-800 shrink-0" />}
                          <span className="min-w-0">
                            <span className="block truncate max-w-[320px] text-slate-200">{p.caption.split('\n')[0] || '(no caption)'}</span>
                            <span className="text-[10px] text-slate-500">{p.format}{p.permalink && <> · <a href={p.permalink} target="_blank" rel="noreferrer" className="hover:text-white">open <ExternalLink className="inline w-2.5 h-2.5" /></a></>}</span>
                          </span>
                        </div>
                      </td>
                      {cols.map(([k, , f]) => <td key={k} className="py-1.5 px-2 text-right tabular-nums text-slate-200">{f(p)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {data.facebookLogin && (
            <p className="text-[11px] text-slate-500">Your Instagram token is a Facebook-login token: long-lived ones last about 60 days and aren’t refreshed automatically. If posting or syncing says the token expired, generate a new one the same way (steps above).</p>
          )}
        </>
      )}
    </div>
  );
}
