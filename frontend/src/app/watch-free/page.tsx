'use client';
/* eslint-disable @next/next/no-img-element -- thumbnails from YouTube / Internet Archive */
import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clapperboard, Download, ExternalLink, Film, Landmark, Loader2, MonitorPlay, Plus, Radar, RefreshCw, Search, ShieldCheck, Trash2, Tv, X, PlaySquare as Youtube } from 'lucide-react';
import { ChannelHit, FreeVideo, SiteBrand, WatchChannel, WatchSummary, watchApi } from '@/lib/watch';
import { WorldTitle, scoreLabel, worldApi } from '@/lib/world';
import { posterUrl } from '@/lib/ott';
import { usePersistentState } from '@/components/ott/PostBuilder';

const card = 'rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3';
const field = 'rounded-md bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-sm';
const n = (v?: number | null) => (v ?? 0).toLocaleString('en-IN');

/** Approve / reject queue for full movies (YouTube official channels or Internet Archive public domain). */
function VideoQueue({ source, reloadKey, onChanged }: { source: 'youtube' | 'archive'; reloadKey: number; onChanged: () => void }) {
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [q, setQ] = useState('');
  const [data, setData] = useState<{ total: number; items: FreeVideo[] } | null>(null);
  const load = useCallback(() => watchApi.videos({ source, status, q, take: 48 }).then(setData, () => setData({ total: 0, items: [] })), [source, status, q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load, reloadKey]);
  const set = async (ids: string[], s: FreeVideo['status']) => {
    await watchApi.setStatus(ids, s);
    setData(d => (d ? { total: d.total - ids.length, items: d.items.filter(x => !ids.includes(x.id)) } : d));
    onChanged();
  };
  const link = (v: FreeVideo) => (v.source === 'youtube' ? `https://www.youtube.com/watch?v=${v.externalId}` : `https://archive.org/details/${v.externalId}`);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {(['PENDING', 'APPROVED', 'REJECTED'] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-md px-3 py-1 text-xs ${status === s ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
            {s === 'PENDING' ? 'To review' : s === 'APPROVED' ? 'On the site' : 'Rejected'}
          </button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className={`${field} text-xs w-40`} />
        <span className="text-xs text-slate-500">{data ? `${n(data.total)} films` : 'Loading…'}</span>
        {status === 'PENDING' && !!data?.items.length && (
          <button onClick={() => { if (confirm(`Put all ${data.items.length} shown films on the site?`)) set(data.items.map(x => x.id), 'APPROVED'); }}
            className="ml-auto flex items-center gap-1 rounded-md bg-emerald-700 hover:bg-emerald-600 px-2.5 py-1 text-xs"><ShieldCheck className="w-3.5 h-3.5" /> Approve all shown</button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {data?.items.map(v => (
          <div key={v.id} className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden text-xs">
            <a href={link(v)} target="_blank" rel="noreferrer" className="relative block aspect-video bg-slate-800">
              {v.thumbnail && <img src={v.thumbnail} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
              {v.minutes && <span className="absolute right-1 bottom-1 rounded bg-black/80 px-1">{Math.floor(v.minutes / 60)}h {v.minutes % 60}m</span>}
              {!v.embeddable && <span className="absolute left-1 top-1 rounded bg-amber-600 px-1 text-[10px]">opens on YouTube</span>}
            </a>
            <div className="p-2 space-y-1">
              <div className="line-clamp-2 font-medium text-slate-200" title={v.title}>{v.title}</div>
              <div className="text-slate-500 truncate">{[v.channel, v.year, v.views ? `${n(v.views)} ${v.source === 'youtube' ? 'views' : 'downloads'}` : ''].filter(Boolean).join(' · ')}</div>
              <div className="flex gap-1">
                {v.status !== 'APPROVED' && <button onClick={() => set([v.id], 'APPROVED')} className="flex-1 flex items-center justify-center gap-1 rounded bg-emerald-700/80 hover:bg-emerald-600 py-1"><Check className="w-3 h-3" /> Add</button>}
                {v.status !== 'REJECTED' && <button onClick={() => set([v.id], 'REJECTED')} title="Reject" className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1"><X className="w-3 h-3" /></button>}
                {v.status === 'REJECTED' && <button onClick={() => set([v.id], 'PENDING')} className="flex-1 rounded bg-slate-800 py-1">Back to review</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {data && !data.items.length && <p className="text-xs text-slate-500">Nothing here.</p>}
    </div>
  );
}

function FreeTitles({ onChanged }: { onChanged: () => void }) {
  const [list, setList] = useState<WorldTitle[] | null>(null);
  const [total, setTotal] = useState(0);
  const load = useCallback(() => worldApi.list({ freeIn: 'true', status: 'PENDING', sort: 'score', take: 24 }).then(d => { setList(d.items); setTotal(d.total); }, () => setList([])), []);
  useEffect(() => { load(); }, [load]);
  const approve = async (ids: string[]) => { await worldApi.bulkStatus({ ids, status: 'APPROVED' }); load(); onChanged(); };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>{n(total)} free titles not on the site yet — best rated first. Approving also approves them for posts. (Or use World → tick “Free in India” for full filters.)</span>
        {!!list?.length && <button onClick={() => { if (confirm(`Approve these ${list.length} titles (site + posts)?`)) approve(list.map(x => x.id)); }} className="ml-auto flex items-center gap-1 rounded-md bg-emerald-700 hover:bg-emerald-600 px-2.5 py-1 text-white"><ShieldCheck className="w-3.5 h-3.5" /> Approve these {list.length}</button>}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
        {list?.map(t => {
          let free: string[] = [];
          try { free = JSON.parse(t.providersIn || '[]').filter((p: { type: string }) => p.type === 'free').map((p: { name: string }) => p.name); } catch {}
          return (
            <div key={t.id} className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden text-[11px]">
              <div className="relative aspect-[2/3] bg-slate-800">
                {t.posterPath && <img src={posterUrl(t.posterPath, 'w342') || ''} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
                {t.score != null && <span className="absolute left-1 bottom-1 rounded bg-black/80 px-1 text-yellow-300">★ {scoreLabel(t)}</span>}
              </div>
              <div className="p-1.5 space-y-1">
                <div className="truncate font-medium" title={t.title}>{t.title}</div>
                <div className="truncate text-emerald-400">Free · {free.join(', ')}</div>
                <button onClick={() => approve([t.id])} className="w-full rounded bg-emerald-700/80 hover:bg-emerald-600 py-0.5">Add</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YoutubeChannels({ keySet, onScanned }: { keySet: boolean; onScanned: () => void }) {
  const [channels, setChannels] = useState<WatchChannel[]>([]);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<ChannelHit[] | null>(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scans, setScans] = useState<Record<string, { active: boolean; note?: string }>>({});
  const load = useCallback(() => watchApi.channels().then(setChannels, () => null), []);
  useEffect(() => { load(); }, [load]);
  const anyActive = Object.values(scans).some(s => s.active);
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(async () => {
      const s = await watchApi.scans().catch(() => null);
      if (s) setScans(s);
      if (s && !Object.values(s).some(x => x.active)) { load(); onScanned(); }
    }, 2500);
    return () => clearInterval(t);
  }, [anyActive, load, onScanned]);
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  if (!keySet) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300 space-y-1">
        <div className="font-semibold">Needs a free YouTube Data API key</div>
        <ol className="list-decimal pl-5 space-y-1">
          <li>console.cloud.google.com → a project (the YouTube Shorts one is fine) → APIs &amp; Services → enable “YouTube Data API v3”.</li>
          <li>Credentials → Create credentials → API key. (Optional: restrict it to YouTube Data API v3.)</li>
          <li>Add <code>YT_API_KEY=…</code> to backend/.env and restart the app.</li>
        </ol>
        <p className="text-slate-500">Free quota: 10,000 units/day — a channel search costs ~100, scanning a 1,000-video channel ~40.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Add only channels that legally own the films they upload — e.g. the studio’s or music label’s own channel. Check the subscriber count and that it’s the real one. Then scan: full-length films (60+ min, watchable in India) arrive “to review”.</p>
      <div className="flex flex-wrap gap-2">
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); run(async () => setHits(await watchApi.searchChannels(q))); }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a channel (e.g. Rajshri, Shemaroo)" className={`${field} w-64`} />
          <button disabled={busy} className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-3 text-sm"><Search className="w-4 h-4" /> Search</button>
        </form>
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); run(async () => { await watchApi.addChannel(link); setLink(''); load(); }); }}>
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="…or paste a channel link (youtube.com/@…)" className={`${field} w-72`} />
          <button disabled={busy || !link} className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-3 text-sm"><Plus className="w-4 h-4" /> Add</button>
        </form>
      </div>
      {err && <p className="text-xs text-amber-400">{err}</p>}
      {hits && (
        <ul className="grid sm:grid-cols-2 gap-1.5">
          {hits.map(h => (
            <li key={h.channelId} className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs">
              {h.thumbnail && <img src={h.thumbnail} alt="" className="w-8 h-8 rounded-full" />}
              <span className="flex-1 min-w-0"><b className="block truncate text-slate-200">{h.title}</b><span className="text-slate-500">{h.handle} · {h.subscribers ? `${n(h.subscribers)} subscribers` : 'subscribers hidden'}</span></span>
              <a href={`https://www.youtube.com/channel/${h.channelId}`} target="_blank" rel="noreferrer" className="text-sky-400"><ExternalLink className="w-3.5 h-3.5" /></a>
              {h.added ? <span className="text-slate-500">Added</span> : <button onClick={() => run(async () => { await watchApi.addChannel(h.channelId); setHits(hs => hs?.map(x => (x === h ? { ...x, added: true } : x)) || null); load(); })} className="rounded bg-indigo-600 hover:bg-indigo-700 px-2 py-1 text-white">Add</button>}
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-1.5">
        {channels.map(c => {
          const s = scans[`yt:${c.id}`];
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-800 px-2 py-1.5 text-xs">
              {c.thumbnail && <img src={c.thumbnail} alt="" className="w-7 h-7 rounded-full" />}
              <a href={`https://www.youtube.com/channel/${c.channelId}`} target="_blank" rel="noreferrer" className="font-semibold text-slate-200 hover:underline">{c.title}</a>
              <span className="text-slate-500">{c.subscribers ? `${n(c.subscribers)} subs` : ''}</span>
              <span className="flex-1 text-slate-400">{s?.note || c.lastScanNote || 'Not scanned yet'}</span>
              <button disabled={s?.active} onClick={() => run(async () => { const r = await watchApi.scanChannel(c.id); setScans(x => ({ ...x, [`yt:${c.id}`]: r })); })}
                className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2 py-1">{s?.active ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radar className="w-3 h-3" />} Scan for films</button>
              <button onClick={() => { if (confirm(`Remove ${c.title}? (films already approved stay until you reject them)`)) run(async () => { await watchApi.removeChannel(c.id); load(); }); }} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          );
        })}
        {!channels.length && <li className="text-xs text-slate-500">No channels yet.</li>}
      </ul>
    </div>
  );
}

export default function WatchFreePage() {
  const [ottBrand] = usePersistentState<{ handle: string; accent: string }>('ott.brand', { handle: '@yourhandle', accent: '#FACC15' });
  const [brand, setBrand] = usePersistentState<SiteBrand>('watch.brand', {
    name: 'Naan Ungal Karthik', tagline: 'Movies & series you can watch free — legally', handle: ottBrand.handle, accent: ottBrand.accent,
    instagram: 'https://www.instagram.com/naan_ungal_karthik/', youtube: '', facebook: '',
  });
  const [summary, setSummary] = useState<WatchSummary | null>(null);
  const [reload, setReload] = useState(0);
  const [preview, setPreview] = useState(0);
  const [archiveQ, setArchiveQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const loadSummary = useCallback(() => watchApi.summary().then(setSummary, () => null), []);
  useEffect(() => { loadSummary(); }, [loadSummary, reload]);
  const changed = useCallback(() => { setReload(x => x + 1); }, []);
  const act = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    setMsg(null);
    try { setMsg(await fn()); changed(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };
  const b = (k: keyof SiteBrand, v: string) => setBrand({ ...brand, [k]: v });

  return (
    <div className="flex flex-col h-full">
      <header className="p-6 pb-4 border-b border-slate-800 bg-[#0a0a0c]">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3"><MonitorPlay className="w-7 h-7 text-indigo-400" /> Watch Free site</h1>
        <p className="text-sm text-slate-400 mt-1">
          A free, legal site for your followers: titles free on official apps, full movies from official YouTube channels, public-domain classics, and trailers. Nothing is hosted by you — videos play from the original uploader. Only what you approve appears.
        </p>
        {summary && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {[[Tv, 'Free to stream', summary.free.approved], [Youtube, 'YouTube full movies', summary.youtube.approved], [Landmark, 'Classics', summary.classics.approved], [Clapperboard, 'Trailers', summary.trailers.withTrailer]].map(([Icon, label, v]) => {
              const I = Icon as React.ComponentType<{ className?: string }>;
              return <span key={label as string} className="flex items-center gap-1.5 rounded-full bg-slate-900 border border-slate-800 px-3 py-1"><I className="w-3.5 h-3.5 text-indigo-400" /> {label as string}: <b>{n(v as number)}</b> on site</span>;
            })}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_520px] gap-6">
          <div className="space-y-5 min-w-0">
            {msg && <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">{msg}</div>}

            <section className={card}>
              <h2 className="font-semibold flex items-center gap-2"><Tv className="w-4 h-4 text-emerald-400" /> 1 · Free to stream in India <span className="text-xs font-normal text-slate-500">{summary ? `${n(summary.free.approved)} on site · ${n(summary.free.available)} available` : ''}</span></h2>
              <p className="text-xs text-slate-400">Titles that JustWatch (via TMDB) lists as free with ads in India — JioHotstar, MX Player, Plex, Tubi, ZEE5… The site links to the official app.</p>
              <FreeTitles onChanged={changed} />
            </section>

            <section className={card}>
              <h2 className="font-semibold flex items-center gap-2"><Youtube className="w-4 h-4 text-red-400" /> 2 · Full movies on official YouTube channels <span className="text-xs font-normal text-slate-500">{summary ? `${n(summary.youtube.approved)} on site · ${n(summary.youtube.pending)} to review` : ''}</span></h2>
              <YoutubeChannels keySet={!!summary?.youtube.keySet} onScanned={changed} />
              {summary?.youtube.keySet && <VideoQueue source="youtube" reloadKey={reload} onChanged={loadSummary} />}
            </section>

            <section className={card}>
              <h2 className="font-semibold flex items-center gap-2"><Landmark className="w-4 h-4 text-amber-400" /> 3 · Public-domain classics (Internet Archive) <span className="text-xs font-normal text-slate-500">{summary ? `${n(summary.classics.approved)} on site · ${n(summary.classics.pending)} to review` : ''}</span></h2>
              <p className="text-xs text-slate-400">Only films the Internet Archive marks public domain (feature length). They play in the Archive’s own player.</p>
              <div className="flex flex-wrap gap-2">
                <input value={archiveQ} onChange={e => setArchiveQ(e.target.value)} placeholder="Optional: Chaplin, Hitchcock, noir, Hindi…" className={`${field} w-72`} />
                <button disabled={!!busy} onClick={() => act('archive', async () => { const r = await watchApi.scanArchive({ q: archiveQ, rows: 150 }); return `Internet Archive: ${n(r.total)} public-domain films match; ${n(r.added)} new added to review.`; })}
                  className="flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-sm">{busy === 'archive' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />} Find classics</button>
              </div>
              <VideoQueue source="archive" reloadKey={reload} onChanged={loadSummary} />
            </section>

            <section className={card}>
              <h2 className="font-semibold flex items-center gap-2"><Film className="w-4 h-4 text-sky-400" /> 4 · Trailers & where to watch <span className="text-xs font-normal text-slate-500">{summary ? `${n(summary.trailers.withTrailer)} of ${n(summary.trailers.approved)} approved titles have a trailer` : ''}</span></h2>
              <p className="text-xs text-slate-400">Every approved World title can appear with its official trailer (from TMDB) and where it streams. Approve titles in World Movies & Series.</p>
              <button disabled={!!busy} onClick={() => act('trailers', async () => { const r = await watchApi.refreshTrailers(); return `Checked ${r.checked} titles — found ${r.found} official trailers.`; })}
                className="flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-sm">{busy === 'trailers' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Find official trailers</button>
            </section>
          </div>

          <div className="space-y-4 2xl:sticky 2xl:top-0 2xl:self-start">
            <section className={card}>
              <h2 className="font-semibold">Your site</h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="col-span-2 space-y-1"><span className="text-slate-400">Site name</span><input value={brand.name} onChange={e => b('name', e.target.value)} maxLength={40} className={`${field} w-full`} /></label>
                <label className="col-span-2 space-y-1"><span className="text-slate-400">Tagline</span><input value={brand.tagline} onChange={e => b('tagline', e.target.value)} maxLength={120} className={`${field} w-full`} /></label>
                <label className="space-y-1"><span className="text-slate-400">Handle</span><input value={brand.handle} onChange={e => b('handle', e.target.value)} className={`${field} w-full`} /></label>
                <label className="space-y-1"><span className="text-slate-400">Colour</span><input type="color" value={brand.accent} onChange={e => b('accent', e.target.value)} className="h-8 w-full rounded bg-slate-950 border border-slate-700" /></label>
                <label className="col-span-2 space-y-1"><span className="text-slate-400">Instagram link</span><input value={brand.instagram} onChange={e => b('instagram', e.target.value)} placeholder="https://www.instagram.com/…" className={`${field} w-full`} /></label>
                <label className="space-y-1"><span className="text-slate-400">YouTube link</span><input value={brand.youtube} onChange={e => b('youtube', e.target.value)} placeholder="https://youtube.com/@…" className={`${field} w-full`} /></label>
                <label className="space-y-1"><span className="text-slate-400">Facebook link</span><input value={brand.facebook} onChange={e => b('facebook', e.target.value)} placeholder="https://facebook.com/…" className={`${field} w-full`} /></label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setPreview(x => x + 1)} className="flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-sm"><RefreshCw className="w-4 h-4" /> Refresh preview</button>
                <a href={watchApi.siteUrl(brand)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-sm"><ExternalLink className="w-4 h-4" /> Open full size</a>
                <a href={watchApi.exportUrl(brand)} className="flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white"><Download className="w-4 h-4" /> Download site</a>
              </div>
              <details className="text-xs text-slate-400">
                <summary className="cursor-pointer text-slate-300">Put it online for free</summary>
                <ol className="list-decimal pl-5 mt-2 space-y-1">
                  <li>Click “Download site” and unzip it — you get a folder <code>watch-free-site</code> with one <code>index.html</code>.</li>
                  <li>Open <b>app.netlify.com/drop</b>, sign up free, and drag the folder onto the page. You get a link like <code>your-name.netlify.app</code> (rename it in Site settings).</li>
                  <li>When you approve more titles, download again and drag the new folder onto your site’s “Deploys” page.</li>
                </ol>
                <p className="mt-2">Put the link in your Instagram bio. The site only links to / embeds the official sources, and shows the TMDB credit it requires.</p>
              </details>
            </section>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-black" style={{ height: 720 }}>
              <iframe key={`${preview}-${reload}`} src={watchApi.siteUrl(brand)} title="Site preview" className="w-full h-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
