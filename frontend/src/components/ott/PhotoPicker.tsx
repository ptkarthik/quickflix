'use client';
/* eslint-disable @next/next/no-img-element -- thumbnails from many hosts, via our proxy */
import React, { useEffect, useRef, useState } from 'react';
import { Overlay } from './Overlay';
import { Check, ImagePlus, Link2, Loader2, Search, Upload, X } from 'lucide-react';
import type { ImageResults } from '@/lib/postDomain';
import { proxied } from '@/lib/ott';

type Pick = { url: string; label: string };

/**
 * Pick pictures of a title to use as slides — several at once. Same sources as the poster finder
 * (TMDB exact match, official trailer stills, web search), plus a pasted link or your own uploads.
 */
export function PhotoPicker({ title, load, multi = true, onSlides = [], slotsLeft, onAdd, onClose }: {
  title: string;
  load: (q?: string) => Promise<ImageResults>;
  multi?: boolean;
  /** pictures already used as slides (shown ticked-off) */
  onSlides?: string[];
  /** how many more slides fit Instagram's limit of 10 (warning only) */
  slotsLeft?: number;
  onAdd: (picks: Pick[]) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<ImageResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'TMDB' | 'OFFICIAL' | 'WEB'>('TMDB');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Pick[]>([]);
  const [pasted, setPasted] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchImages = (query?: string) =>
    load(query).then(
      d => {
        setData(d);
        setQ(d.query);
        setTab(t => (query ? 'WEB' : d.tmdb.length ? t : d.official.length ? 'OFFICIAL' : 'WEB'));
        setLoading(false);
      },
      (e: Error) => { setError(e.message); setLoading(false); },
    );
  useEffect(() => {
    fetchImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (list: Pick[]) => { if (list.length) onAdd(list); onClose(); };
  const toggle = (p: Pick) => {
    if (!multi) return finish([p]);
    setPicked(cur => (cur.some(x => x.url === p.url) ? cur.filter(x => x.url !== p.url) : [...cur, p]));
  };
  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const all = [...files].filter(f => f.type.startsWith('image/'));
    Promise.all(all.map(f => new Promise<Pick>(res => { const r = new FileReader(); r.onload = () => res({ url: String(r.result), label: `Uploaded: ${f.name}` }); r.readAsDataURL(f); })))
      .then(list => (multi ? setPicked(cur => [...cur, ...list]) : finish(list.slice(0, 1))));
  };

  const list = !data ? [] : tab === 'TMDB' ? data.tmdb : tab === 'OFFICIAL' ? data.official : data.web;
  const over = slotsLeft != null && picked.length > slotsLeft;

  return (
    <Overlay onEscape={onClose}>
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900 p-4 gap-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <ImagePlus className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold">{multi ? 'Add pictures as slides' : 'Choose a picture'} <span className="font-normal text-slate-400">· {title}</span></h3>
          <button onClick={onClose} className="ml-auto p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
          {([['TMDB', `Exact match (${data?.tmdb.length ?? 0})`], ['OFFICIAL', `Official trailers (${data?.official.length ?? 0})`], ['WEB', `Web (${data?.web.length ?? 0})`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 py-1.5 rounded-md font-medium ${tab === k ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>{l}</button>
          ))}
        </div>
        {tab === 'WEB' && (
          <form onSubmit={e => { e.preventDefault(); setLoading(true); setError(null); fetchImages(q); }} className="flex gap-2">
            <input value={q} onChange={e => setQ(e.target.value)} className="flex-1 rounded-md bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs" placeholder="Search images… (e.g. title + stills, title + interval scene)" />
            <button className="rounded-md bg-slate-800 hover:bg-slate-700 px-3 text-xs flex items-center gap-1"><Search className="w-3.5 h-3.5" /> Search</button>
          </form>
        )}
        {tab === 'WEB' && <p className="text-[11px] text-slate-500">Web results come from Bing and can include fan-made art — hover a picture to see where it’s from.</p>}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {loading ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
            : error ? <p className="text-xs text-red-400">{error}</p>
              : list.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">{tab === 'WEB' && data?.webError ? data.webError : 'No pictures here — try another tab.'}</p>
                : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {list.map(o => {
                      const n = picked.findIndex(x => x.url === o.url);
                      const used = onSlides.includes(o.url);
                      return (
                        <button key={o.url} onClick={() => toggle({ url: o.url, label: o.label || o.source })} title={[o.label, o.pageUrl].filter(Boolean).join(' — ')}
                          className={`relative rounded-md overflow-hidden border-2 bg-slate-950 ${n >= 0 ? 'border-indigo-500' : 'border-transparent hover:border-slate-500'}`}
                          style={{ aspectRatio: o.kind === 'poster' ? '2/3' : o.kind === 'web' ? '3/4' : '16/9' }}>
                          <img src={proxied(o.thumb) || ''} alt="" loading="lazy" className="w-full h-full object-cover" />
                          {n >= 0 && <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">{n + 1}</span>}
                          {used && n < 0 && <span className="absolute top-1 left-1 rounded bg-emerald-700/90 px-1 text-[9px] text-white">on a slide</span>}
                          {o.width && o.height && <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] text-slate-300">{o.width}×{o.height}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
        </div>
        <div className="flex gap-2">
          <input value={pasted} onChange={e => setPasted(e.target.value)} className="flex-1 rounded-md bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs" placeholder="…or paste an image link (https://…)" />
          <button disabled={!/^https?:\/\//.test(pasted)} onClick={() => { toggle({ url: pasted.trim(), label: 'Pasted link' }); setPasted(''); }}
            className="rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-3 text-xs flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Add</button>
          <button onClick={() => fileRef.current?.click()} className="rounded-md bg-slate-800 hover:bg-slate-700 px-3 text-xs flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Upload</button>
          <input ref={fileRef} type="file" accept="image/*" multiple={multi} className="hidden" onChange={e => onFiles(e.target.files)} />
        </div>
        {multi && (
          <div className="flex items-center gap-2 border-t border-slate-800 pt-3">
            <span className={`text-xs ${over ? 'text-amber-300' : 'text-slate-400'}`}>
              {picked.length ? `${picked.length} picked — each becomes its own slide, in this order.` : 'Click pictures to pick them (click again to un-pick).'}
              {over ? ` Instagram allows 10 slides in one post — only ${slotsLeft} more fit (you can hide others).` : ''}
            </span>
            {picked.length > 0 && <button onClick={() => setPicked([])} className="ml-auto text-xs text-slate-500 hover:text-white">Clear</button>}
            <button disabled={!picked.length} onClick={() => finish(picked)}
              className={`${picked.length ? '' : 'ml-auto'} flex items-center gap-1 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-3 py-1.5 text-sm font-semibold text-white`}>
              <Check className="w-4 h-4" /> Add {picked.length || ''} slide{picked.length === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
    </Overlay>
  );
}
