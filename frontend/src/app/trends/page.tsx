'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Flame, Loader2, Newspaper, RefreshCw } from 'lucide-react';
import { Story, TrendsData, ago, trendsApi } from '@/lib/trends';
import { usePersistentState } from '@/components/ott/PostBuilder';
import type { SlideBrand } from '@/components/ott/OttSlides';
import { NewsPostMaker } from '@/components/trends/NewsPostMaker';

const SCOPES: Array<[string, string]> = [['tn', 'Tamil Nadu'], ['india', 'India'], ['all', 'Everything']];

function StoryCard({ s, onMake }: { s: Story; onMake: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${s.outlets >= 3 ? 'bg-emerald-900/60 text-emerald-300' : s.outlets === 2 ? 'bg-sky-900/50 text-sky-300' : 'bg-slate-800 text-slate-400'}`}>
          {s.outlets} outlet{s.outlets === 1 ? '' : 's'}{s.outlets === 1 ? ' — check it' : ''}
        </span>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">{s.category}</span>
        {s.tamilNadu && <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-amber-300">Tamil Nadu</span>}
        {s.trend && <span className="flex items-center gap-0.5 rounded-full bg-rose-900/40 px-2 py-0.5 text-rose-300"><Flame className="w-3 h-3" /> {s.trend.traffic.toLocaleString('en-IN')}+ searches</span>}
        {s.sensitive && <span className="flex items-center gap-0.5 rounded-full bg-amber-950 px-2 py-0.5 text-amber-400"><AlertTriangle className="w-3 h-3" /> {s.sensitive}</span>}
        <span className="ml-auto text-slate-500">{ago(s.latest)}</span>
      </div>
      <div className="font-semibold text-white leading-snug">{s.title}</div>
      <div className="flex items-center gap-2 text-xs">
        <button onClick={onMake} className="rounded-md bg-indigo-600 hover:bg-indigo-700 px-3 py-1 text-white">Make post</button>
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 text-slate-400 hover:text-white">{open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} {s.headlines.length} headline{s.headlines.length === 1 ? '' : 's'}</button>
      </div>
      {open && (
        <ul className="space-y-1 border-t border-slate-800 pt-2">
          {s.headlines.map(h => (
            <li key={h.url + h.text} className="text-xs text-slate-300">
              {h.text} <a href={h.url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-sky-300">— {h.outlet} ↗</a> <span className="text-slate-600">{ago(h.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TrendsPage() {
  const [scope, setScope] = usePersistentState('trends.scope', 'tn');
  const [category, setCategory] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [data, setData] = useState<TrendsData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [story, setStory] = useState<Story | null>(null);
  const [brand] = usePersistentState<SlideBrand>('ott.brand', { handle: '@yourhandle', accent: '#FACC15' });

  const load = useCallback(() => trendsApi.list({ scope, category, sensitive }).then(d => { setData(d); setErr(null); }, e => setErr(e.message)), [scope, category, sensitive]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Flame className="w-6 h-6 text-rose-400" /> Trending now</h1>
          <p className="text-sm text-slate-400">What Tamil Nadu &amp; India are talking about — grouped from Google News (English + Tamil), Chennai local news and Google Trends. More outlets = more confirmed. Refreshed every 30 minutes.</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          {data && <span>Updated {ago(data.fetchedAt)}</span>}
          <button disabled={refreshing} onClick={async () => { setRefreshing(true); await trendsApi.refresh().catch(() => null); setRefreshing(false); load(); }}
            className="flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-3 py-1.5 text-sm text-white">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SCOPES.map(([k, l]) => <button key={k} onClick={() => setScope(k)} className={`rounded-lg px-3 py-1.5 text-sm ${scope === k ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{l}</button>)}
        <select value={category} onChange={e => setCategory(e.target.value)} className="rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm">
          <option value="">All topics</option>
          {data?.categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-400" title="Deaths, accidents, crime, communal topics — hidden by default">
          <input type="checkbox" checked={sensitive} onChange={e => setSensitive(e.target.checked)} /> Show sensitive stories{data?.hiddenSensitive ? ` (${data.hiddenSensitive} hidden)` : ''}
        </label>
      </div>
      {err && <p className="text-sm text-amber-400">{err}</p>}
      {data?.errors.length ? <p className="text-xs text-amber-400">Some feeds didn’t load: {data.errors.join('; ')}</p> : null}

      {!data ? <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
        : data.stories.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.stories.map(s => <StoryCard key={s.id} s={s} onMake={() => setStory(s)} />)}</div>
          : <p className="flex items-center gap-2 text-sm text-slate-500"><Newspaper className="w-4 h-4" /> Nothing here right now — try another topic or Refresh.</p>}
      <p className="text-[11px] text-slate-500">Headlines and links belong to the outlets. Posts use your own words + a source credit; use your own photos (news photos are copyrighted). Always open the sources before posting.</p>
      {story && <NewsPostMaker key={story.id} story={story} handle={brand.handle} onClose={() => setStory(null)} />}
    </div>
  );
}
