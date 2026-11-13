'use client';
import React, { useState } from 'react';
import { ExternalLink, Loader2, Megaphone, Newspaper, Quote, RefreshCw, Search, Star } from 'lucide-react';
import { CriticsResult, RatingKey, TitleExtra, extrasApi, shortOutlet } from '@/lib/extras';

const label = (r: { value: number; best: number }) => `${+r.value.toFixed(2)}/${r.best}`;

/**
 * Critics' ratings & one-liners from the web, for this title — only when you click. Tick ratings to show them on the
 * post (each as its own chip, or the average), or use a critic's line as the one-liner. Every item links to its source.
 */
export function CriticsSection({ domain, id, extra, onChange, onUseLine, shown }: {
  /** the ratings currently shown on the post (critics are added / removed from this) */
  shown: RatingKey[];
  domain: 'ott' | 'cinema' | 'world';
  id: string;
  extra: TitleExtra | null;
  onChange: (e: TitleExtra) => void;
  onUseLine: (text: string) => void;
}) {
  const [data, setData] = useState<CriticsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [buzzOpen, setBuzzOpen] = useState(false);

  const find = async (force = false) => {
    setBusy(true);
    setErr(null);
    try { setData(await extrasApi.critics(domain, id, force)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const pick = async (picks: string[], showAverage?: boolean) => {
    setData(d => (d ? { ...d, picks, showAverage: showAverage ?? d.showAverage } : d));
    const any = picks.length > 0 || (showAverage ?? data?.showAverage ?? false);
    const ratingsShown: RatingKey[] = any ? [...new Set<RatingKey>([...shown, 'critics'])] : shown.filter(k => k !== 'critics');
    onChange(await extrasApi.update(domain, id, { criticPicks: picks, ...(showAverage !== undefined ? { criticAverage: showAverage } : {}), ratingsShown }));
  };
  const picks = data?.picks || [];

  return (
    <div className="rounded-lg border border-amber-900/50 bg-amber-950/10 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300"><Newspaper className="w-3.5 h-3.5" /> Critics’ ratings &amp; one-liners</span>
        <button onClick={() => find(!!data)} disabled={busy} className="flex items-center gap-1 rounded bg-amber-700/70 hover:bg-amber-600 disabled:opacity-50 px-2 py-0.5 text-[11px] text-white">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : data ? <RefreshCw className="w-3 h-3" /> : <Search className="w-3 h-3" />} {busy ? 'Searching critics…' : data ? 'Search again' : 'Find critics’ reviews'}
        </button>
      </div>
      {!data && !busy && <p className="text-[11px] text-slate-500">Searches review articles worldwide (Times of India, The Hindu, Indian Express, Variety …) and Wikipedia’s critics section. Ratings only when the critic states one. Takes ~20 s.{extra?.criticChips?.length ? ` On the post now: ${extra.criticChips.join(' • ')}` : ''}</p>}
      {err && <p className="text-[11px] text-amber-400">{err}</p>}
      {data && (
        <>
          {data.average != null ? (
            <label className="flex items-center gap-2 text-xs text-slate-200">
              <input type="checkbox" checked={data.showAverage} onChange={e => pick(picks, e.target.checked)} />
              <Star className="w-3.5 h-3.5 text-amber-400" /> Critics average <b>{data.average}/5</b> from {data.ratedCount} rated review{data.ratedCount === 1 ? '' : 's'} — show “Critics {data.average}/5 ({data.ratedCount})” on the post
            </label>
          ) : <p className="text-[11px] text-slate-500">No critic stated a rating we could read{data.reviews.length ? ' — but their one-liners are below' : ''}.</p>}
          {data.phrases.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              <span className="text-slate-500">Critics keep saying:</span>
              {data.phrases.map(p => <span key={p.text} className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-200">{p.text} <span className="text-slate-500">×{p.count}</span></span>)}
            </div>
          )}
          <ul className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {data.reviews.map(r => (
              <li key={r.id} className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  {r.rating
                    ? <label className="flex items-center gap-1" title="Show this rating on the post"><input type="checkbox" checked={picks.includes(r.id)} onChange={e => pick(e.target.checked ? [...picks, r.id] : picks.filter(x => x !== r.id))} /><span className="rounded bg-amber-500/20 px-1.5 font-semibold text-amber-300">{shortOutlet(r.outlet)} {label(r.rating)}</span></label>
                    : <span className="rounded bg-slate-800 px-1.5 text-slate-300">{shortOutlet(r.outlet)}</span>}
                  <span className="truncate text-[10px] text-slate-500">{[r.critic, r.via === 'wikipedia' ? 'via Wikipedia' : r.date].filter(Boolean).join(' · ')}</span>
                  {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="ml-auto shrink-0 text-sky-400" title="Open the review"><ExternalLink className="w-3 h-3" /></a>}
                </div>
                {r.oneLiner && (
                  <div className="mt-1 flex items-start gap-2">
                    <span className="flex-1 text-slate-200">“{r.oneLiner}”</span>
                    <button onClick={() => onUseLine(`${r.oneLiner} — ${shortOutlet(r.outlet)}`.slice(0, 140))} className="shrink-0 flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[10px]" title="Use as the one-liner on the picture (with the outlet's name)"><Quote className="w-3 h-3" /> Use</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {data.buzz.length > 0 && (
            <div className="text-[11px]">
              <button onClick={() => setBuzzOpen(o => !o)} className="flex items-center gap-1 text-slate-400 hover:text-white"><Megaphone className="w-3 h-3" /> Audience buzz — not critics ({data.buzz.length})</button>
              {buzzOpen && (
                <ul className="mt-1 space-y-0.5">
                  {data.buzz.map(b => <li key={b.headline} className="text-slate-400">{b.headline} <span className="text-slate-600">— {b.outlet}</span>{b.url && <a href={b.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex text-sky-400"><ExternalLink className="w-2.5 h-2.5" /></a>}</li>)}
                </ul>
              )}
            </div>
          )}
          <p className="text-[10px] text-slate-500">Ratings are exactly as each critic states them (their review page or Wikipedia). Tick to show them on the post — each as its own chip. Checked {new Date(data.fetchedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.</p>
        </>
      )}
    </div>
  );
}
