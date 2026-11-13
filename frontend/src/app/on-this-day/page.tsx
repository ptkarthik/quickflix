'use client';
/* eslint-disable @next/next/no-img-element -- TMDB thumbnails */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Cake, Check, ChevronLeft, ChevronRight, ExternalLink, Film, Flower2, Loader2, RefreshCw, Star } from 'lucide-react';
import { DayData, DayFilm, DayPerson, fmtDay, loadChecked, onThisDayApi, ordinal, tmdbImg } from '@/lib/onthisday';
import { langName } from '@/lib/world';
import { usePersistentState } from '@/components/ott/PostBuilder';
import type { SlideBrand } from '@/components/ott/OttSlides';
import { DayPostMaker, DaySubject, subjectKey } from '@/components/onthisday/DayPostMaker';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const GROUPS: Array<{ id: string; label: string; test: (lang: string | null, scope?: string) => boolean }> = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'ta', label: 'Tamil', test: l => l === 'ta' },
  { id: 'te', label: 'Telugu', test: l => l === 'te' },
  { id: 'hi', label: 'Hindi', test: l => l === 'hi' },
  { id: 'ml', label: 'Malayalam', test: l => l === 'ml' },
  { id: 'kn', label: 'Kannada', test: l => l === 'kn' },
  { id: 'india', label: 'Other Indian', test: (l, s) => (s ? s === 'india' : ['bn', 'mr', 'pa', 'gu', 'or', 'as'].includes(l || '')) && !['ta', 'te', 'hi', 'ml', 'kn'].includes(l || '') },
  { id: 'world', label: 'World', test: (l, s) => (s ? s === 'world' : !['ta', 'te', 'hi', 'ml', 'kn', 'bn', 'mr', 'pa', 'gu', 'or', 'as'].includes(l || '')) },
];

function Agree({ ok, other }: { ok: boolean | null; other?: string | null }) {
  if (ok === true) return <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400" title="Wikidata and TMDB give the same date"><Check className="w-3 h-3" /> 2 sources agree</span>;
  if (ok === false) return <span className="inline-flex items-center gap-1 text-[11px] text-amber-400" title="Check before posting"><AlertTriangle className="w-3 h-3" /> TMDB says {fmtDay(other)}</span>;
  return <span className="text-[11px] text-slate-500">1 source (Wikidata)</span>;
}

function PersonCard({ p, checked, onMake }: { p: DayPerson; checked: boolean; onMake: () => void }) {
  const img = tmdbImg(p.profile, 'w185');
  const birthLine = p.event === 'birth'
    ? p.death ? `Born ${p.birth?.slice(0, 4)} · would have turned ${p.age} · died ${p.death.slice(0, 4)}` : `Turns ${p.age} · born ${fmtDay(p.birth)}`
    : `${p.years ? `${ordinal(p.years)} death anniversary` : 'Died today'} · ${fmtDay(p.death)}${p.ageAtDeath != null ? ` (aged ${p.ageAtDeath})` : ''}`;
  return (
    <div className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="h-28 w-20 shrink-0 overflow-hidden rounded-md bg-slate-800">{img ? <img src={img} alt="" className={`h-full w-full object-cover ${p.event === 'death' ? 'grayscale' : ''}`} /> : <div className="flex h-full items-center justify-center text-2xl text-slate-600">{p.name[0]}</div>}</div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-white leading-tight">{p.name}</div>
            <div className="text-xs text-slate-400">{[p.occupations.join(' · '), p.industry ? langName(p.industry) : null].filter(Boolean).join(' — ')}</div>
          </div>
          {checked && <span className="ml-auto shrink-0 rounded-full bg-emerald-900/50 px-2 py-0.5 text-[10px] text-emerald-300">Checked</span>}
        </div>
        <div className="text-sm text-slate-200">{birthLine}</div>
        <Agree ok={p.sourcesAgree} other={p.event === 'birth' ? p.tmdbBirth : p.tmdbDeath} />
        {p.knownFor.length > 0 && <div className="text-xs text-slate-400 line-clamp-2">Known for: {p.knownFor.slice(0, 4).map(k => `${k.title} (${k.year})`).join(', ')}</div>}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
          <button onClick={onMake} className="rounded-md bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 text-xs text-white">Make post</button>
          {p.wikipedia && <a href={p.wikipedia} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white">Wikipedia <ExternalLink className="inline w-3 h-3" /></a>}
          <a href={`https://www.wikidata.org/wiki/${p.wikidataId}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white">Wikidata</a>
          {p.tmdbId && <a href={`https://www.themoviedb.org/person/${p.tmdbId}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white">TMDB</a>}
          {p.imdbId && <a href={`https://www.imdb.com/name/${p.imdbId}/`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white">IMDb</a>}
        </div>
      </div>
    </div>
  );
}

function FilmCard({ f, checked, onMake }: { f: DayFilm; checked: boolean; onMake: () => void }) {
  const img = tmdbImg(f.posterPath, 'w185');
  return (
    <div className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="h-28 w-20 shrink-0 overflow-hidden rounded-md bg-slate-800">{img && <img src={img} alt="" className="h-full w-full object-cover" />}</div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-white leading-tight">{f.title} <span className="font-normal text-slate-400">({f.year})</span></div>
            <div className="text-xs text-slate-400">{[f.kind === 'tv' ? 'Series' : 'Film', langName(f.language), f.score ? `★ ${f.score.toFixed(1)} ${f.scoreSource || ''}` : null, f.scoreVotes ? `${f.scoreVotes.toLocaleString('en-IN')} votes` : null].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
            {f.milestone && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">{f.years} years</span>}
            {checked && <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-[10px] text-emerald-300">Checked</span>}
          </div>
        </div>
        <div className="text-sm text-slate-200">{f.years} {f.years === 1 ? 'year' : 'years'} · {f.kind === 'tv' ? 'first aired' : 'released'} {fmtDay(f.releaseDate)}</div>
        {f.dateConfirmed === true && <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400"><Check className="w-3 h-3" /> Wikidata has the same date</span>}
        {f.dateConfirmed === false && <span className="inline-flex items-center gap-1 text-[11px] text-amber-400"><AlertTriangle className="w-3 h-3" /> Wikidata lists {f.otherDates.map(x => fmtDay(x)).join(', ')}</span>}
        {f.indiaDiffers && <div className="text-[11px] text-amber-400">India release (Wikidata): {fmtDay(f.indiaDate)}</div>}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
          <button onClick={onMake} className="rounded-md bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 text-xs text-white">Make post</button>
          <a href={`https://www.themoviedb.org/${f.kind}/${f.tmdbId}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white">TMDB <ExternalLink className="inline w-3 h-3" /></a>
          {f.imdbId && <a href={`https://www.imdb.com/title/${f.imdbId}/releaseinfo/`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white">IMDb release dates</a>}
        </div>
      </div>
    </div>
  );
}

export default function OnThisDayPage() {
  const [date, setDate] = useState(todayIso);
  const [data, setData] = useState<DayData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = usePersistentState<'birthdays' | 'remembering' | 'films'>('onthisday.tab', 'birthdays');
  const [group, setGroup] = usePersistentState('onthisday.group', 'all');
  const [milestones, setMilestones] = usePersistentState('onthisday.milestones', false);
  const [brand] = usePersistentState<SlideBrand>('ott.brand', { handle: '@yourhandle', accent: '#FACC15' });
  const [subject, setSubject] = useState<DaySubject | null>(null);
  const [checked, setChecked] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => onThisDayApi.get(date).then(d => { setData(d); setErr(null); setChecked(loadChecked()); return d; }, e => { setErr(e.message); return null; }), [date]);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const d = await load();
      if (live && d && (!d.ready || d.preparing)) timer = setTimeout(tick, 8000);
    };
    tick();
    return () => { live = false; clearTimeout(timer); };
  }, [load]);

  const g = GROUPS.find(x => x.id === group) || GROUPS[0];
  const people = useMemo(() => (data ? (tab === 'remembering' ? data.remembering : data.birthdays) : []).filter(p => g.test(p.industry, group === 'world' || group === 'india' ? p.scope : undefined)), [data, tab, g, group]);
  const films = useMemo(() => (data?.films || []).filter(f => g.test(f.language) && (!milestones || f.milestone)), [data, g, milestones]);
  const isChecked = (s: DaySubject) => !!checked[`${date}|${subjectKey(s)}`];
  const tabs = [
    { id: 'birthdays' as const, label: 'Birthdays', icon: Cake, n: data?.birthdays.length },
    { id: 'remembering' as const, label: 'Remembering', icon: Flower2, n: data?.remembering.length },
    { id: 'films' as const, label: 'Film & series anniversaries', icon: Film, n: data?.films.length },
  ];

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><CalendarDays className="w-6 h-6 text-indigo-400" /> On this day</h1>
          <p className="text-sm text-slate-400">Birthdays, remembrance days and film anniversaries — from Wikidata + TMDB, with the dates cross-checked. Plan ahead: pick any date.</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setDate(d => shift(d, -1))} className="rounded-md bg-slate-800 hover:bg-slate-700 p-2"><ChevronLeft className="w-4 h-4" /></button>
          <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} className="rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm" />
          <button onClick={() => setDate(d => shift(d, 1))} className="rounded-md bg-slate-800 hover:bg-slate-700 p-2"><ChevronRight className="w-4 h-4" /></button>
          {date !== todayIso() && <button onClick={() => setDate(todayIso())} className="rounded-md bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-sm">Today</button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="text-base font-semibold text-white">{fmtDay(date, false)}</span>
        {data?.fetchedAt && <span>· people checked {new Date(data.fetchedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
        <button disabled={refreshing || data?.preparing} onClick={async () => { setRefreshing(true); await onThisDayApi.refresh(date).catch(() => null); setRefreshing(false); load(); }} className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-2 py-1"><RefreshCw className="w-3 h-3" /> Fetch again</button>
        {data?.errors.map(e => <span key={e} className="text-amber-400">⚠ {e}</span>)}
      </div>
      {err && <p className="text-sm text-amber-400">{err}</p>}
      {data && (!data.ready || data.preparing) && (
        <div className="flex items-center gap-2 rounded-lg border border-indigo-900 bg-indigo-950/40 px-3 py-2 text-sm text-indigo-200">
          <Loader2 className="w-4 h-4 animate-spin" /> {data.ready ? 'Updating' : 'Preparing'} birthdays &amp; remembrance days for {fmtDay(date, false)} from Wikidata + TMDB — about 2–3 minutes (films below are ready now). The next 7 days are prepared automatically.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${tab === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label} {t.n != null && <span className="rounded-full bg-black/30 px-1.5 text-xs">{t.n}</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {GROUPS.map(x => <button key={x.id} onClick={() => setGroup(x.id)} className={`rounded-full px-2.5 py-1 text-xs ${group === x.id ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{x.label}</button>)}
        {tab === 'films' && <label className="ml-2 flex items-center gap-1.5 text-xs text-slate-300"><input type="checkbox" checked={milestones} onChange={e => setMilestones(e.target.checked)} /> <Star className="w-3 h-3 text-amber-400" /> Milestones only (1, 5, 10, 15 … years)</label>}
      </div>

      {!data ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
      ) : tab === 'films' ? (
        films.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{films.map(f => <FilmCard key={f.id} f={f} checked={isChecked({ type: 'film', film: f })} onMake={() => setSubject({ type: 'film', film: f })} />)}</div>
          : <p className="text-sm text-slate-500">No {milestones ? 'milestone ' : ''}anniversaries in your World titles for this filter.</p>
      ) : people.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{people.map(p => { const s: DaySubject = { type: p.event, person: p }; return <PersonCard key={p.wikidataId + p.event} p={p} checked={isChecked(s)} onMake={() => setSubject(s)} />; })}</div>
      ) : (
        <p className="text-sm text-slate-500">{data.ready ? 'Nobody for this filter on this date.' : 'Still preparing…'}</p>
      )}
      <p className="text-[11px] text-slate-500">People: Wikidata (only day-exact dates), photos &amp; films: TMDB. Film dates: TMDB first release, cross-checked with Wikidata for the best-known titles. Tick “I’ve checked the facts” in the post maker before posting.</p>

      {subject && <DayPostMaker key={subjectKey(subject)} subject={subject} date={date} handle={brand.handle} onClose={() => { setSubject(null); setChecked(loadChecked()); }} />}
    </div>
  );
}
