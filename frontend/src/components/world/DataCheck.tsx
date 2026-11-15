'use client';
import { ClickToScroll } from '@/components/ott/ClickToScroll';
import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, ChevronDown, ChevronUp, Globe2, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { CoverageRow, WorldHealth, langName, worldApi } from '@/lib/world';

const n = (v?: number | null) => (v ?? 0).toLocaleString('en-IN');

/** Second source: IMDb's own full title list. Adds what TMDB discover missed — matched by IMDb id, so never a duplicate. */
function ImdbCrossCheck({ scanning, duplicates, onStarted }: { scanning: boolean; duplicates: number; onStarted: () => void }) {
  const [votes, setVotes] = useState('1000');
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="rounded-md border border-slate-800 p-2 space-y-1.5">
      <div className="font-semibold text-slate-300 flex items-center gap-1.5"><Globe2 className="w-3.5 h-3.5" /> Second source — IMDb’s full title list</div>
      <p className="text-slate-400">Checks every IMDb movie and series with enough votes against your database. Anything missing is matched to TMDB by its IMDb id and added as “to review”. Titles already here (same IMDb id or TMDB id) are skipped, so nothing is added twice.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={votes} onChange={e => setVotes(e.target.value)} className="rounded bg-slate-950 border border-slate-700 px-2 py-1">
          {[['5000', '5,000+ IMDb votes (famous)'], ['1000', '1,000+ IMDb votes (well-known)'], ['500', '500+ IMDb votes (deeper)']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button disabled={scanning} onClick={async () => {
          if (!confirm('Cross-check with IMDb’s full list now? New titles arrive as “to review”. Runs in the background.')) return;
          await worldApi.imdbCrossCheck(Number(votes));
          onStarted();
        }} className="flex items-center gap-1 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-2.5 py-1 font-semibold">
          {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe2 className="w-3 h-3" />} {scanning ? 'Another job is running…' : 'Cross-check with IMDb'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={duplicates ? 'text-amber-300' : 'text-emerald-400'}>{duplicates ? `${duplicates} title${duplicates === 1 ? '' : 's'} stored twice (same IMDb title)` : 'No duplicates (same IMDb title stored twice).'}</span>
        {duplicates > 0 && <button onClick={async () => { const r = await worldApi.dedupe(); setMsg(`${r.hidden} duplicate${r.hidden === 1 ? '' : 's'} hidden — approved titles were kept.`); onStarted(); }} className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1">Hide duplicates</button>}
        {msg && <span className="text-emerald-300">{msg}</span>}
      </div>
    </div>
  );
}

/** Is every well-known title here? Per language: TMDB titles with 50+ votes vs held in the app. */
function Coverage({ scanning, onFill }: { scanning: boolean; onFill: () => void }) {
  const [kind, setKind] = useState<'movie' | 'tv'>('movie');
  const [rows, setRows] = useState<CoverageRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  const check = async (fresh = false) => {
    setBusy(true);
    try { setRows(await worldApi.coverage(kind, 50, fresh)); } catch { setRows([]); } finally { setBusy(false); }
  };
  const under = (rows || []).filter(r => r.percent < 98);
  const missing = under.reduce((a, r) => a + (r.tmdb - r.ours), 0);
  return (
    <div className="rounded-md border border-slate-800 p-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-300 flex items-center gap-1.5"><Globe2 className="w-3.5 h-3.5" /> Coverage — is every well-known title here?</span>
        <div className="flex rounded bg-slate-950 p-0.5">
          {(['movie', 'tv'] as const).map(k => <button key={k} onClick={() => { setKind(k); setRows(null); }} className={`px-2 py-0.5 rounded ${kind === k ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{k === 'movie' ? 'Movies' : 'Series'}</button>)}
        </div>
        <button onClick={() => check(!!rows)} disabled={busy} className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-2 py-1">{busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} {busy ? 'Checking ~1 min…' : rows ? 'Check again' : 'Check coverage'}</button>
      </div>
      <p className="text-slate-500">“Well-known” = 50+ votes on TMDB. Languages, not countries: Chinese films are under Chinese — Mandarin / Cantonese, Iranian films under Persian (Iran).</p>
      {rows && (
        <>
          <p className={under.length ? 'text-amber-300' : 'text-emerald-300'}>
            {under.length ? `${under.length} language${under.length === 1 ? '' : 's'} below 98% — about ${missing.toLocaleString('en-IN')} well-known ${kind === 'movie' ? 'movies' : 'series'} missing.` : `All ${rows.length} languages are 98–100% covered.`}
          </p>
          <ClickToScroll maxH="max-h-56" count={(all ? rows.length : Math.min(15, rows.length))} noun="languages"><div className="">
            <table className="w-full">
              <thead><tr className="text-left text-slate-500"><th className="py-0.5 font-medium">Language</th><th className="text-right font-medium">On TMDB</th><th className="text-right font-medium">Here</th><th className="text-right font-medium">Coverage</th></tr></thead>
              <tbody>
                {(all ? rows : rows.slice(0, 15)).map(r => (
                  <tr key={r.code} className="border-t border-slate-800/70">
                    <td className="py-0.5 text-slate-300">{langName(r.code) || r.name}</td>
                    <td className="text-right tabular-nums">{r.tmdb.toLocaleString('en-IN')}</td>
                    <td className="text-right tabular-nums">{r.ours.toLocaleString('en-IN')}</td>
                    <td className={`text-right tabular-nums font-semibold ${r.percent >= 98 ? 'text-emerald-400' : r.percent >= 70 ? 'text-amber-300' : 'text-red-400'}`}>{r.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></ClickToScroll>
          {rows.length > 15 && <button onClick={() => setAll(a => !a)} className="text-slate-400 hover:text-white">{all ? 'Show fewer' : `Show all ${rows.length} languages`}</button>}
        </>
      )}
      <button disabled={scanning} onClick={onFill} className="flex items-center gap-1 rounded bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-2.5 py-1 font-semibold">
        {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe2 className="w-3 h-3" />} {scanning ? 'Filling…' : 'Fill the gaps (movies + series)'}
      </button>
    </div>
  );
}

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
            <ImdbCrossCheck scanning={!!h.scan.active} duplicates={h.duplicateImdbIds?.length || 0} onStarted={() => setTimeout(load, 1000)} />
            <Coverage scanning={!!h.scan.active} onFill={async () => {
              if (!confirm('Scan every language that is below 98% until all its well-known movies and series are in? New titles arrive as “to review” — nothing is approved for posts. Takes 30–60 min in the background.')) return;
              await worldApi.fillCoverage({ kinds: ['movie', 'tv'], minVotes: 50 });
              setTimeout(load, 1000);
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
