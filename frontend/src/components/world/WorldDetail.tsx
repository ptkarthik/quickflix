'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, ImagePlus, Loader2, RefreshCw, X } from 'lucide-react';
import { posterUrl } from '@/lib/ott';
import { WorldTitle, countryName, fmtVotes, genreList, langName, lengthLabel, providersOf, worldApi } from '@/lib/world';

const TYPE_LABEL = { stream: 'Subscription', free: 'Free', rent: 'Rent', buy: 'Buy' } as const;

export function WorldDetail({ title, onClose, onChanged, onMakePost }: { title: WorldTitle; onClose: () => void; onChanged: (t: WorldTitle) => void; onMakePost: (t: WorldTitle) => void }) {
  const [t, setT] = useState(title);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Opening a title refreshes stale facts (TMDB) and the IMDb rating (OMDb) in the background.
  useEffect(() => {
    let stop = false;
    worldApi.refresh(title.id).then(r => { if (!stop) { setT(r); onChanged(r); } }, () => null);
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title.id]);

  const run = async (fn: () => Promise<WorldTitle>) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fn();
      setT(r);
      onChanged(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const providers = providersOf(t);
  const backdrop = t.backdropPath ? `https://image.tmdb.org/t/p/w1280${t.backdropPath}` : null;
  const row = (label: string, value: React.ReactNode) => value ? <div className="flex gap-3 text-sm"><span className="w-28 shrink-0 text-slate-500">{label}</span><span className="text-slate-200">{value}</span></div> : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="relative h-48 bg-slate-800">
          {backdrop && <img src={backdrop} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
          <button onClick={onClose} className="absolute top-3 right-3 rounded-full bg-black/60 p-1.5 text-slate-300 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 pb-6 -mt-24 relative flex gap-5">
          {t.posterPath ? <img src={posterUrl(t.posterPath, 'w342') || ''} alt="" className="w-36 h-54 rounded-lg object-cover shadow-xl shrink-0 border border-slate-700" /> : <div className="w-36 h-54 rounded-lg bg-slate-800 shrink-0" />}
          <div className="pt-20 space-y-1 min-w-0">
            <h2 className="text-2xl font-bold text-white">{t.title} {t.year && <span className="text-slate-400 font-normal">({t.year})</span>}</h2>
            {t.originalTitle && t.originalTitle !== t.title && <p className="text-sm text-slate-400">{t.originalTitle}</p>}
            <p className="text-sm text-slate-400">{[t.kind === 'tv' ? 'Series' : 'Movie', langName(t.language), genreList(t, 4).join(', '), lengthLabel(t)].filter(Boolean).join(' • ')}</p>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">IMDb</div>
              <div className="text-xl font-bold text-yellow-300">{t.imdbRating != null ? t.imdbRating.toFixed(1) : '—'}</div>
              <div className="text-[11px] text-slate-500">{t.imdbRating != null ? `${fmtVotes(t.imdbVotes)} votes` : t.imdbId ? 'no IMDb rating yet' : t.tmdbCheckedAt ? 'no IMDb id on TMDB' : 'checking…'}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Rotten Tomatoes</div>
              <div className="text-xl font-bold text-red-300">{t.rtCritics != null ? `${t.rtCritics}%` : '—'}</div>
              <div className="text-[11px] text-slate-500">critics{t.metascore != null ? ` · Metacritic ${t.metascore}` : ''}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">TMDB</div>
              <div className="text-xl font-bold text-sky-300">{t.tmdbRating != null ? t.tmdbRating.toFixed(1) : '—'}</div>
              <div className="text-[11px] text-slate-500">{fmtVotes(t.tmdbVotes)} votes</div>
            </div>
          </div>
          {(() => {
            let ext: Record<string, { label: string; value: string; url?: string | null; via: string }> = {};
            try { ext = JSON.parse(t.extRatings || '{}'); } catch {}
            const list = Object.values(ext);
            return list.length ? (
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {list.map(e => <a key={e.label} href={e.url || undefined} target="_blank" rel="noreferrer" title={`via ${e.via}`} className="rounded bg-slate-800 px-2 py-0.5 text-slate-200">{e.label} <b>{e.value}</b></a>)}
              </div>
            ) : null;
          })()}
          <p className="text-[11px] text-slate-500">Ranked by: <b className="text-slate-300">{t.scoreSource ? `${t.scoreSource} ${t.score?.toFixed(1)}` : 'no rating yet'}</b> (IMDb when it has 50+ votes, otherwise TMDB; “Best rated” also weighs how many people voted).{t.tvStatus ? ` · ${t.tvStatus}` : ''}</p>

          {t.overview && <p className="text-sm leading-relaxed text-slate-300">{t.overview}</p>}

          <div className="space-y-1.5">
            {row(t.kind === 'tv' ? 'Created by' : 'Director', t.people)}
            {row('Country', (t.countries || '').split(',').filter(Boolean).map(countryName).join(', '))}
            {row('First released', t.releaseDate)}
            {row('Seasons', t.kind === 'tv' && t.seasons ? `${t.seasons} (${t.episodes || '?'} episodes)${t.seriesType ? ` · ${t.seriesType}` : ''}` : null)}
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Where to watch in India</h3>
            {providers.length === 0 ? (
              <p className="text-sm text-slate-500">{t.tmdbCheckedAt ? 'Not available to stream in India right now (per TMDB/JustWatch).' : 'Checking…'}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {providers.map(p => (
                  <span key={p.name} className={`rounded-full border px-3 py-1 text-xs ${p.type === 'stream' || p.type === 'free' ? 'border-emerald-600/50 bg-emerald-600/10 text-emerald-200' : 'border-slate-700 text-slate-400'}`}>
                    {p.name} <span className="opacity-60">· {TYPE_LABEL[p.type]}</span>
                  </span>
                ))}
              </div>
            )}
            {t.tmdbCheckedAt && <p className="text-[11px] text-slate-500">Checked {new Date(t.tmdbCheckedAt).toLocaleDateString('en-IN')} · data by TMDB/JustWatch, can change.</p>}
          </div>

          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {t.status !== 'APPROVED' ? (
              <button disabled={busy} onClick={() => run(() => worldApi.update(t.id, { status: 'APPROVED' }))} className="flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold"><Check className="w-3.5 h-3.5" /> Approve for posts</button>
            ) : (
              <button onClick={() => onMakePost(t)} className="flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-semibold"><ImagePlus className="w-3.5 h-3.5" /> Make Instagram post</button>
            )}
            {t.status !== 'REJECTED' && <button disabled={busy} onClick={() => run(() => worldApi.update(t.id, { status: 'REJECTED' }))} className="rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs">Hide (reject)</button>}
            {t.status !== 'PENDING' && <button disabled={busy} onClick={() => run(() => worldApi.update(t.id, { status: 'PENDING' }))} className="rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs">Back to review</button>}
            <button disabled={busy} onClick={() => run(() => worldApi.refresh(t.id, true))} className="flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Re-check now
            </button>
            <a href={`https://www.themoviedb.org/${t.kind}/${t.tmdbId}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs">TMDB <ExternalLink className="w-3 h-3" /></a>
            {t.imdbId && <a href={`https://www.imdb.com/title/${t.imdbId}/`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs">IMDb <ExternalLink className="w-3 h-3" /></a>}
          </div>
        </div>
      </div>
    </div>
  );
}
