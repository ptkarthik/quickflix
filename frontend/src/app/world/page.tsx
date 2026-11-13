'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Film, ImagePlus, Loader2, Plus, Radar, Search, ShieldCheck, Tv, X } from 'lucide-react';
import { posterUrl } from '@/lib/ott';
import { ScanStatus, TmdbHit, WorldFacets, WorldFilter, WorldKind, WorldLanguage, WorldTitle, countryName, fmtVotes, langName, registerLanguageNames, scoreLabel, streamingIn, worldApi } from '@/lib/world';
import { DataCheck } from '@/components/world/DataCheck';
import { WorldFilters } from '@/components/world/WorldFilters';
import { WorldDetail } from '@/components/world/WorldDetail';
import { WorldPostBuilder } from '@/components/world/WorldPostBuilder';

type Tab = 'movie' | 'tv' | 'post';
const PAGE = 48;

function StatusDot({ s }: { s: WorldTitle['status'] }) {
  return s === 'APPROVED'
    ? <span className="rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">✓ Approved</span>
    : s === 'REJECTED'
      ? <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">Hidden</span>
      : <span className="rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-300">To review</span>;
}

function AddFromTmdb({ kind, onAdded }: { kind: WorldKind; onAdded: (t: WorldTitle) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<TmdbHit[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!open) return <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs"><Plus className="w-3.5 h-3.5" /> Add from TMDB</button>;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-24" onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-bold">Add a {kind === 'tv' ? 'series' : 'movie'} from TMDB</h3><button onClick={() => setOpen(false)}><X className="w-5 h-5 text-slate-400" /></button></div>
        <form className="flex gap-2" onSubmit={async e => { e.preventDefault(); setBusy('search'); setHits(await worldApi.search(q, kind).catch(() => [])); setBusy(null); }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Title…" className="flex-1 rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm" />
          <button className="rounded-md bg-indigo-600 px-3 text-sm flex items-center gap-1">{busy === 'search' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search</button>
        </form>
        <ul className="max-h-96 overflow-y-auto space-y-1">
          {hits?.length === 0 && <li className="text-sm text-slate-500">Nothing found.</li>}
          {hits?.map(h => (
            <li key={`${h.kind}${h.tmdbId}`} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-800">
              {h.posterPath ? <img src={posterUrl(h.posterPath, 'w342') || ''} alt="" className="w-8 h-12 rounded object-cover" /> : <span className="w-8 h-12 rounded bg-slate-800" />}
              <span className="flex-1 min-w-0 text-sm"><span className="block truncate">{h.title} {h.year && <span className="text-slate-500">({h.year})</span>}</span><span className="text-[11px] text-slate-500">{langName(h.language)} · TMDB {h.tmdbRating ?? '—'} ({fmtVotes(h.tmdbVotes)} votes)</span></span>
              {h.inLibrary ? <span className="text-[11px] text-slate-500">In database</span> : (
                <button disabled={!!busy} onClick={async () => { setBusy(String(h.tmdbId)); try { onAdded(await worldApi.add(h.kind, h.tmdbId)); setHits(hs => hs?.map(x => (x === h ? { ...x, inLibrary: 'yes' } : x)) || null); } finally { setBusy(null); } }}
                  className="rounded-md bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-xs font-semibold">{busy === String(h.tmdbId) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add (approved)'}</button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ScanPanel({ kind, filter, onDone }: { kind: WorldKind; filter: WorldFilter; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [genres, setGenres] = useState<Record<string, string>>({});
  const [f, setF] = useState({ genreId: '', pages: '5', minVotes: '100', sort: 'vote_count.desc' });
  const [status, setStatus] = useState<ScanStatus | null>(null);
  useEffect(() => { if (open) worldApi.genres(kind).then(setGenres).catch(() => null); }, [open, kind]);
  useEffect(() => {
    if (!status?.active) return;
    const t = setInterval(async () => {
      const s = await worldApi.scanStatus().catch(() => null);
      if (s) setStatus(s);
      if (s && !s.active) onDone();
    }, 2000);
    return () => clearInterval(t);
  }, [status?.active, onDone]);
  const field = 'rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs';
  if (!open) return <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs"><Radar className="w-3.5 h-3.5" /> Scan TMDB for more</button>;
  return (
    <div className="w-full rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-2">
      <p className="text-xs text-slate-400">
        Pulls {kind === 'tv' ? 'series' : 'movies'} from TMDB into the database (as “to review”) using the language / country / years from your filters
        {filter.language ? ` (${langName(filter.language)})` : ''}{filter.country ? ` (${countryName(filter.country)})` : ''}. 20 titles per page.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={f.genreId} onChange={e => setF({ ...f, genreId: e.target.value })} className={field}><option value="">Any genre</option>{Object.entries(genres).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <select value={f.sort} onChange={e => setF({ ...f, sort: e.target.value })} className={field}><option value="vote_count.desc">Most voted</option><option value="popularity.desc">Trending</option><option value="vote_average.desc">Highest rated</option></select>
        <select value={f.minVotes} onChange={e => setF({ ...f, minVotes: e.target.value })} className={field}>{['20', '100', '500', '2000'].map(v => <option key={v} value={v}>{v}+ votes</option>)}</select>
        <select value={f.pages} onChange={e => setF({ ...f, pages: e.target.value })} className={field}>{['1', '5', '10', '25'].map(v => <option key={v} value={v}>{Number(v) * 20} titles</option>)}</select>
        <button disabled={!!status?.active} onClick={async () => {
          const r = await worldApi.scan({ kind, language: filter.language?.split(',')[0], country: filter.country, genreId: f.genreId ? Number(f.genreId) : undefined, yearFrom: filter.yearFrom ? Number(filter.yearFrom) : undefined, yearTo: filter.yearTo ? Number(filter.yearTo) : undefined, minVotes: Number(f.minVotes), sort: f.sort, pages: Number(f.pages) });
          setStatus(r.scan);
        }} className="flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold">
          {status?.active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />} {status?.active ? `Page ${status.page}/${status.pages}…` : 'Start scan'}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-white">Close</button>
      </div>
      {status && !status.active && <p className="text-xs text-emerald-300">{status.error ? `Scan failed: ${status.error}` : `Done: ${status.seen} seen, ${status.added} new (to review). IMDb ratings and “where to watch” fill in over the next minutes.`}</p>}
    </div>
  );
}

export default function WorldPage() {
  const [tab, setTab] = useState<Tab>('movie');
  const [filters, setFilters] = useState<Record<WorldKind, WorldFilter>>({ movie: { kind: 'movie' }, tv: { kind: 'tv' } });
  const [languages, setLanguages] = useState<WorldLanguage[] | null>(null);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; items: WorldTitle[] } | null>(null);
  const [facets, setFacets] = useState<WorldFacets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<WorldTitle | null>(null);
  const [postTarget, setPostTarget] = useState<WorldTitle | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const kind: WorldKind = tab === 'tv' ? 'tv' : 'movie';
  const filter = filters[kind];
  const setFilter = (f: WorldFilter) => { setFilters(fs => ({ ...fs, [kind]: f })); setPage(0); };

  useEffect(() => {
    let stop = false;
    worldApi.facets(tab === 'post' ? undefined : kind).then(f => { if (!stop) setFacets(f); }, () => null);
    worldApi.languages().then(l => { if (!stop) { registerLanguageNames(l); setLanguages(l); } }, () => null);
    return () => { stop = true; };
  }, [tab, kind, reload]);

  useEffect(() => {
    if (tab === 'post') return;
    let stop = false;
    const t = setTimeout(() => {
      setLoading(true);
      worldApi.list({ ...filter, skip: page * PAGE, take: PAGE }).then(
        d => { if (!stop) { setData(d); setError(null); setLoading(false); } },
        (e: Error) => { if (!stop) { setError(e.message === 'Failed to fetch' ? 'Backend is not reachable. Start it (start.bat) and retry.' : e.message); setLoading(false); } },
      );
    }, 250);
    return () => { stop = true; clearTimeout(t); };
  }, [tab, filter, page, reload]);

  const replace = (t: WorldTitle) => setData(d => (d ? { ...d, items: d.items.map(x => (x.id === t.id ? t : x)) } : d));
  const setStatus = async (t: WorldTitle, status: WorldTitle['status']) => replace(await worldApi.update(t.id, { status }));
  const approveAllMatching = async () => {
    if (!data?.total) return;
    if (!confirm(`Approve all ${data.total.toLocaleString('en-IN')} ${kind === 'tv' ? 'series' : 'movies'} matching these filters for posts?\n\nOnly do this if you trust this set (e.g. high rating + many votes). You can still hide any title later.`)) return;
    const r = await worldApi.bulkStatus({ filter, status: 'APPROVED' });
    setMsg(`Approved ${r.updated.toLocaleString('en-IN')} title(s).`);
    setReload(x => x + 1);
  };
  const onDataChanged = React.useCallback(() => setReload(x => x + 1), []);
  const makePost = (t: WorldTitle) => { setDetail(null); setPostTarget(t); setTab('post'); };

  const tabs: Array<{ key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'movie', label: 'Movies', icon: Film },
    { key: 'tv', label: 'Series', icon: Tv },
    { key: 'post', label: 'Create Instagram Post', icon: ImagePlus },
  ];
  const pages = data ? Math.ceil(data.total / PAGE) : 0;

  return (
    <div className="flex flex-col h-full">
      <header className="p-6 pb-0 border-b border-slate-800 bg-[#0a0a0c] sticky top-0 z-10">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-white">World Movies & Series</h1>
          <p className="text-sm text-slate-400">
            Movies and series from every country. Facts from TMDB, ratings from IMDb (IMDb’s own daily file), Rotten Tomatoes / Metacritic (OMDb) and TMDB — always labelled — and where to watch in India.
            {facets && <> {facets.total.toLocaleString('en-IN')} titles · {facets.approved.toLocaleString('en-IN')} approved for posts.</>}
          </p>
        </div>
        {msg && <div className="mb-3 text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-md px-3 py-2">{msg}</div>}
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setPage(0); if (t.key !== 'post') setPostTarget(null); }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${tab === t.key ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'post' ? (
          <WorldPostBuilder key={postTarget?.id || 'none'} initialSingle={postTarget} facets={facets} />
        ) : (
          <div className="space-y-4">
            <DataCheck onChanged={onDataChanged} />
            <WorldFilters filter={filter} onChange={setFilter} facets={facets} showStatus languages={languages} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-400">{loading ? 'Loading…' : `${(data?.total || 0).toLocaleString('en-IN')} ${kind === 'tv' ? 'series' : 'movies'}`}</span>
              <span className="ml-auto flex flex-wrap gap-2">
                {!!data?.total && filter.status !== 'APPROVED' && (
                  <button onClick={approveAllMatching} className="flex items-center gap-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 text-xs font-semibold"><ShieldCheck className="w-3.5 h-3.5" /> Approve all {data.total.toLocaleString('en-IN')} matching</button>
                )}
                <AddFromTmdb kind={kind} onAdded={t => { setMsg(`Added “${t.title}” (approved).`); setReload(x => x + 1); }} />
              </span>
              <ScanPanel kind={kind} filter={filter} onDone={() => setReload(x => x + 1)} />
            </div>

            {error ? (
              <div className="text-center py-16 space-y-3"><p className="text-amber-400">{error}</p><button onClick={() => setReload(x => x + 1)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm">Retry</button></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 gap-4">
                {data?.items.map(t => (
                  <div key={t.id} className={`group rounded-lg overflow-hidden border bg-slate-900 ${t.status === 'APPROVED' ? 'border-emerald-700/50' : 'border-slate-800'}`}>
                    <button onClick={() => setDetail(t)} className="relative block w-full aspect-[2/3] bg-slate-800">
                      {t.posterPath && <img src={posterUrl(t.posterPath, 'w342') || ''} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
                      <span className="absolute top-1.5 left-1.5"><StatusDot s={t.status} /></span>
                      {t.score != null && (
                        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-yellow-300" title={`${t.scoreSource} · ${fmtVotes(t.scoreVotes)} votes`}>★ {scoreLabel(t)}</span>
                      )}
                    </button>
                    <div className="p-2 space-y-1">
                      <div className="truncate text-sm font-medium" title={t.title}>{t.title}</div>
                      <div className="truncate text-[11px] text-slate-500">{[t.year, langName(t.language), streamingIn(t)[0]].filter(Boolean).join(' · ')}</div>
                      <div className="flex gap-1">
                        {t.status === 'APPROVED' ? (
                          <button onClick={() => makePost(t)} className="flex-1 flex items-center justify-center gap-1 rounded bg-indigo-600/90 hover:bg-indigo-600 py-1 text-[11px] font-semibold"><ImagePlus className="w-3 h-3" /> Post</button>
                        ) : (
                          <button onClick={() => setStatus(t, 'APPROVED')} className="flex-1 flex items-center justify-center gap-1 rounded bg-emerald-700/80 hover:bg-emerald-600 py-1 text-[11px]"><Check className="w-3 h-3" /> Approve</button>
                        )}
                        {t.status !== 'REJECTED' && <button onClick={() => setStatus(t, 'REJECTED')} title="Hide" className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1"><X className="w-3 h-3" /></button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded-md bg-slate-800 disabled:opacity-40 p-2"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm text-slate-400">Page {page + 1} of {pages.toLocaleString('en-IN')}</span>
                <button disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)} className="rounded-md bg-slate-800 disabled:opacity-40 p-2"><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        )}
      </div>
      {detail && <WorldDetail title={detail} onClose={() => setDetail(null)} onChanged={replace} onMakePost={makePost} />}
    </div>
  );
}
