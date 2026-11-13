'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Radar, Sparkles } from 'lucide-react';
import { todayIst } from '@/lib/ott';
import { worldApi } from '@/lib/world';
import { ListPreset, PRESET_GROUPS, PresetGroup, listPresets, presetFilter } from '@/lib/worldPresets';

/**
 * "Ready-made lists": one click sets the filters, Top N and heading for a usual recommendation format.
 * Counts show how many titles in the database match, so you can see which lists are ready.
 */
export function PresetGallery({ activeId, n, onN, onPick }: { activeId: string | null; n: number; onN: (n: number) => void; onPick: (p: ListPreset) => void }) {
  const presets = useMemo(() => listPresets(Number(todayIst().slice(0, 4))), []);
  const [group, setGroup] = useState<PresetGroup>('Movie genres');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filling, setFilling] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadCounts = useCallback(() => {
    worldApi.counts(presets.map(presetFilter)).then(c => setCounts(Object.fromEntries(presets.map((p, i) => [p.id, c[i]]))), () => null);
  }, [presets]);
  useEffect(loadCounts, [loadCounts]);

  /** Thin list → pull more matching titles from TMDB (language / genre / years of the preset). */
  const fill = async (p: ListPreset) => {
    setFilling(p.id);
    setMsg(null);
    try {
      const genres = await worldApi.genres(p.kind);
      const firstGenre = (p.filter.genre || '').split(',')[0]?.split('|')[0];
      const genreId = Object.entries(genres).find(([, name]) => name === firstGenre)?.[0];
      await worldApi.scan({
        kind: p.kind,
        language: p.filter.language?.split(',')[0],
        genreId: genreId ? Number(genreId) : undefined,
        yearFrom: p.filter.yearFrom ? Number(p.filter.yearFrom) : undefined,
        yearTo: p.filter.yearTo ? Number(p.filter.yearTo) : undefined,
        minVotes: Math.min(50, Number(p.filter.minVotes || 50)),
        sort: 'vote_count.desc',
        pages: 5,
      });
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const s = await worldApi.scanStatus();
        if (!s.active) {
          setMsg(s.error ? `Scan failed: ${s.error}` : `Added ${s.added} new title(s) from TMDB. IMDb ratings fill in over the next minutes.`);
          break;
        }
      }
      loadCounts();
      onPick(p);
    } finally {
      setFilling(null);
    }
  };

  const shown = presets.filter(p => p.group === group);
  return (
    <section className="space-y-3 rounded-xl border border-indigo-800/60 bg-indigo-950/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-300"><Sparkles className="w-3.5 h-3.5" /> Ready-made lists</h3>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-400 mr-1">Top</span>
          {[3, 5, 8, 10].map(k => (
            <button key={k} onClick={() => onN(k)} className={`w-8 rounded-md py-1 font-semibold ${n === k ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{k}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {PRESET_GROUPS.map(g => (
          <button key={g} onClick={() => setGroup(g)} className={`rounded-full px-2.5 py-1 text-[11px] font-medium border ${group === g ? 'bg-slate-200 border-slate-200 text-slate-900' : 'border-slate-700 text-slate-400 hover:text-white'}`}>{g}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {shown.map(p => {
          const c = counts[p.id];
          const thin = c !== undefined && c < n;
          return (
            <div key={p.id} className={`rounded-md border text-left ${activeId === p.id ? 'border-indigo-500 bg-indigo-600/20' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}>
              <button onClick={() => onPick(p)} className="w-full px-2 py-1.5 text-left">
                <span className="block truncate text-xs font-medium text-slate-100">{p.emoji} {p.label}</span>
                <span className={`block text-[10px] ${thin ? 'text-amber-400' : 'text-slate-500'}`}>
                  {c === undefined ? '…' : `${c.toLocaleString('en-IN')} match`}{p.kind === 'tv' ? ' · series' : ''}
                </span>
              </button>
              {thin && (
                <button disabled={!!filling} onClick={() => fill(p)} className="flex w-full items-center justify-center gap-1 border-t border-slate-800 py-1 text-[10px] text-amber-300 hover:bg-slate-800 disabled:opacity-50">
                  {filling === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radar className="w-3 h-3" />} {filling === p.id ? 'Fetching from TMDB…' : 'Fill from TMDB'}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {msg && <p className="text-[11px] text-emerald-300">{msg}</p>}
      <p className="text-[11px] text-slate-500">Ranked by rating (IMDb when known, else TMDB — labelled on the post) with a minimum number of votes. Pick one, check the titles, then post.</p>
    </section>
  );
}
