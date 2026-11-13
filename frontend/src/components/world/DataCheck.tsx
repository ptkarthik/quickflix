'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, ChevronDown, ChevronUp, Globe2, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { WorldHealth, worldApi } from '@/lib/world';

const n = (v?: number | null) => (v ?? 0).toLocaleString('en-IN');

/** Data check for the World database: gaps, source status, background jobs, and the "every language" fill. */
export function DataCheck({ onChanged }: { onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState<WorldHealth | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [per, setPer] = useState('100');

  const load = useCallback(() => worldApi.health().then(d => { setH(d); setErr(null); }, (e: Error) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const busy = !!(h?.scan.active || h?.enrich.running || h?.imdbFile.sync.running);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => { load(); onChanged(); }, open ? 4000 : 15000);
    return () => clearInterval(t);
  }, [busy, open, load, onChanged]);

  if (!h) return err ? <p className="text-xs text-amber-400">Data check: {err}</p> : null;
  const issues = [
    h.neverChecked && { level: 'fix', text: `${n(h.neverChecked)} titles not yet checked against TMDB (IMDb id, synopsis, where to watch, series type) — filling in now${h.enrich.running ? ` (${n(h.enrich.tmdb)} done this run)` : ''}.` },
    h.checkedNoImdbId && { level: 'info', text: `${n(h.checkedNoImdbId)} titles have no IMDb id on TMDB (mostly small / regional titles) — they show the TMDB rating instead.` },
    h.noImdbRating && { level: 'info', text: `${n(h.noImdbRating)} titles have an IMDb id but no IMDb rating yet (too new / too few votes on IMDb).` },
    h.noOverview && { level: 'info', text: `${n(h.noOverview)} checked titles have no synopsis on TMDB (AI one-liners are disabled for those).` },
    h.noLanguage && { level: 'fix', text: `${n(h.noLanguage)} checked titles have no original language on TMDB.` },
    h.garbled && { level: 'fix', text: `${n(h.garbled)} titles have garbled characters from the old import (e.g. “Jamtara � Sabka…”) — replaced by the TMDB check.` },
    h.notFeature && { level: 'info', text: `${n(h.notFeature)} “movies” are really TV episodes / specials, TV movies, mini-series, shorts or videos by IMDb’s own type — hidden from Movies (“Feature films only”).` },
    h.typed < h.total - h.checkedNoImdbId - 50 && { level: 'info', text: `Title types from IMDb: ${n(h.typed)} of ${n(h.total)} known${h.imdbFile.sync.running ? ' — loading IMDb’s title list now' : ''}.` },
    h.duplicateImdbIds.length && { level: 'info', text: `${h.duplicateImdbIds.length} IMDb ids appear on two TMDB entries (${h.duplicateImdbIds.slice(0, 3).map(d => d.imdbId).join(', ')}…) — TMDB duplicates; hide one if you see both.` },
    h.languagesWithTitles < h.languagesKnown * 0.6 && { level: 'fix', text: `Only ${h.languagesWithTitles} of ${h.languagesKnown} languages have titles — use “Fill every language” below.` },
  ].filter(Boolean) as Array<{ level: 'fix' | 'info'; text: string }>;
  const sweep = h.scan.mode === 'languages' ? h.scan : null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 text-xs">
      <button onClick={() => setOpen(o => !o)} className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-left">
        <span className="flex items-center gap-1.5 font-semibold text-slate-200"><Activity className="w-3.5 h-3.5 text-sky-400" /> Data check</span>
        <span className="text-slate-400">{n(h.movies)} movies · {n(h.series)} series · {h.languagesWithTitles} languages</span>
        <span className="text-slate-400">IMDb ratings: {n(h.total - h.noImdbRating - h.checkedNoImdbId - h.neverChecked)}</span>
        {busy && <span className="flex items-center gap-1 text-sky-300"><Loader2 className="w-3 h-3 animate-spin" />{sweep?.active ? `Scanning languages ${sweep.langDone}/${sweep.langTotal} (${sweep.lang}) · ${n(sweep.added)} new` : h.enrich.running ? `Checking titles with TMDB · ${n(h.neverChecked)} left` : 'Loading IMDb ratings file…'}</span>}
        {!busy && issues.some(i => i.level === 'fix') && <span className="flex items-center gap-1 text-amber-300"><TriangleAlert className="w-3 h-3" /> {issues.filter(i => i.level === 'fix').length} to fix</span>}
        <span className="ml-auto text-slate-500">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>
      {open && (
        <div className="border-t border-slate-800 p-3 space-y-3">
          <ul className="space-y-1">
            {issues.length === 0 && <li className="flex items-center gap-1.5 text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" /> No gaps found.</li>}
            {issues.map((i, k) => <li key={k} className={i.level === 'fix' ? 'text-amber-300' : 'text-slate-400'}>• {i.text}</li>)}
          </ul>

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="rounded-md border border-slate-800 p-2 space-y-1">
              <div className="font-semibold text-slate-300">Free sources</div>
              <div>TMDB (facts, posters, where to watch in India) — {h.sources.tmdb ? <b className="text-emerald-400">on</b> : <b className="text-red-400">key missing</b>}</div>
              <div>IMDb daily ratings file (all IMDb ratings, no limit) — {h.sources.imdbDatasets ? <><b className="text-emerald-400">on</b> · {n(h.imdbFile.rows)} titles{h.imdbFile.date ? ` · ${new Date(h.imdbFile.date).toLocaleDateString('en-IN')}` : ''}</> : 'off'}</div>
              <div>OMDb (Rotten Tomatoes, Metacritic, plot, awards) — {h.sources.omdb ? <><b className="text-emerald-400">on</b> · {n(h.omdbBudgetLeft)} background lookups left today</> : 'key missing'}</div>
              <div>Wikidata + Wikipedia, TVmaze, AniList, MyAnimeList — <b className="text-emerald-400">on</b> (no key; used when you open “One-liner & ratings”)</div>
              <div>MDBList (Letterboxd, Trakt, RT audience) — {h.sources.mdblist ? <b className="text-emerald-400">on</b> : <span className="text-slate-500">optional: free key from mdblist.com → <code>MDBLIST_API_KEY</code> in backend/.env</span>}</div>
              <button onClick={async () => { await worldApi.imdbSync(); setTimeout(load, 1500); }} disabled={h.imdbFile.sync.running}
                className="mt-1 flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-2 py-1"><RefreshCw className="w-3 h-3" /> Re-download IMDb ratings now</button>
            </div>
            <div className="rounded-md border border-slate-800 p-2 space-y-1.5">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5"><Globe2 className="w-3.5 h-3.5" /> Fill every language</div>
              <p className="text-slate-400">Pulls the most-voted movies and series of all {h.languagesKnown} languages TMDB knows, as “to review”. Indian languages go 4× deeper, big world languages 2×. Takes ~15–30 min in the background; details fill in after.</p>
              <div className="flex flex-wrap items-center gap-2">
                <select value={per} onChange={e => setPer(e.target.value)} className="rounded bg-slate-950 border border-slate-700 px-2 py-1">
                  {['40', '100', '200'].map(v => <option key={v} value={v}>Top {v} per language</option>)}
                </select>
                <button disabled={!!h.scan.active} onClick={async () => {
                  if (!confirm(`Scan all ${h.languagesKnown} languages (movies + series, top ${per} each) from TMDB?\nNew titles arrive as “to review” — nothing is approved for posts.`)) return;
                  await worldApi.scanLanguages({ perLanguage: Number(per) });
                  setTimeout(load, 1000);
                }} className="flex items-center gap-1 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-2.5 py-1 font-semibold">
                  {h.scan.active ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe2 className="w-3 h-3" />} {h.scan.active ? 'Scanning…' : 'Fill every language'}
                </button>
              </div>
              {sweep && !sweep.active && sweep.finishedAt && <p className="text-emerald-300">Last run: {n(sweep.seen)} seen, {n(sweep.added)} new{sweep.error ? ` · error: ${sweep.error}` : ''}.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
