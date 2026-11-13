'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, Play, Plus, Scissors, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { Clip } from './TrailerClipEditor';
import type { PostItem } from '@/lib/postDomain';

export interface TrailerTitle { tmdbId?: number | null; kind: 'movie' | 'tv'; title: string; year?: string | number | null; language?: string | null }
interface TrailerVideo { key: string; name: string; type: string; official: boolean; language: string | null }

/* Minimal typing for YouTube's IFrame Player API. */
interface YTPlayer { getCurrentTime(): number; seekTo(s: number, allow: boolean): void; playVideo(): void; pauseVideo(): void; cueVideoById(id: string): void; destroy(): void }
type YTNamespace = { Player: new (el: HTMLElement, o: Record<string, unknown>) => YTPlayer };
declare global { interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void } }

/** What the trailer finder needs from a post title. */
export const trailerTitleOf = (r: PostItem): TrailerTitle => ({
  tmdbId: r.tmdbId ?? null, kind: r.contentType === 'tv' ? 'tv' : 'movie', title: r.title,
  year: r.originalYear || r.releaseDate?.slice(0, 4) || null, language: r.world?.language || r.language || null,
});

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); if (window.YT) resolve(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { apiPromise = null; reject(new Error('Couldn’t load the YouTube player')); };
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const store = (key: string) => `trailerMarks.${key}`;
export function savedMarks(key: string): Clip[] {
  try {
    const v = JSON.parse(localStorage.getItem(store(key)) || '[]');
    return Array.isArray(v) ? v.filter(c => Number.isFinite(c?.start) && Number.isFinite(c?.end)) : [];
  } catch {
    return [];
  }
}
const youtubeId = (s: string) => s.trim().match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/)?.[1] || (/^[\w-]{11}$/.test(s.trim()) ? s.trim() : null);

/**
 * Watch the official trailer in YouTube's own player and mark the moments you want. Nothing is downloaded —
 * the marks are saved (per trailer) and become your clips when you load the trailer file.
 */
export function YouTubeMarker({ titles, clips, onClips }: { titles: TrailerTitle[]; clips: Clip[]; onClips: (c: Clip[]) => void }) {
  const [ti, setTi] = useState(0);
  const [found, setFound] = useState<{ tKey: string; videos: TrailerVideo[]; err?: string } | null>(null);
  const [vkey, setVkey] = useState<string | null>(null);
  const [uiErr, setErr] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const [len, setLen] = useState(3);
  const [markStart, setMarkStart] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const clipsRef = useRef(clips);
  useEffect(() => { clipsRef.current = clips; }, [clips]);
  const t = titles[ti];
  const tKey = t ? JSON.stringify([t.tmdbId, t.kind, t.title, t.year, t.language]) : '';
  const videos = found?.tKey === tKey ? found.videos : null;
  const err = uiErr || (found?.tKey === tKey ? found.err || null : null);

  // Official trailers for the chosen title.
  useEffect(() => {
    if (!tKey) return;
    const [tmdbId, kind, title, year, language] = JSON.parse(tKey) as [number | null, string, string, string | number | null, string | null];
    let live = true;
    const q = new URLSearchParams({ kind, title });
    if (tmdbId) q.set('tmdbId', String(tmdbId));
    if (year) q.set('year', String(year).slice(0, 4));
    if (language) q.set('language', language);
    apiFetch(`/reels/trailers?${q}`, undefined, 1)
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.message || `Failed (${r.status})`); return j; })
      .then(j => {
        if (!live) return;
        setFound({ tKey, videos: j.videos || [] });
        if (j.videos?.[0]) setVkey(k => k ?? j.videos[0].key);
      })
      .catch(e => { if (live) setFound({ tKey, videos: [], err: e instanceof Error ? e.message : 'Couldn’t find trailers' }); });
    return () => { live = false; };
  }, [tKey]);

  // Choosing a trailer: bring back the marks you saved for it (if you haven't marked anything yet).
  const choose = useCallback((key: string) => {
    setVkey(key);
    setMarkStart(null);
  }, []);
  useEffect(() => { if (vkey && !clipsRef.current.length) { const s = savedMarks(vkey); if (s.length) onClips(s); } }, [vkey, onClips]);

  // Remember the marks for this trailer (so they're still there when the file arrives days later).
  useEffect(() => {
    if (!vkey) return;
    try {
      if (clips.length) localStorage.setItem(store(vkey), JSON.stringify(clips));
    } catch {}
  }, [clips, vkey]);

  // YouTube's own player (privacy-enhanced domain).
  useEffect(() => {
    if (!vkey || !holder.current) return;
    if (player.current) { player.current.cueVideoById(vkey); return; }
    let live = true;
    loadYouTubeApi()
      .then(YT => {
        if (!live || !holder.current) return;
        const el = document.createElement('div');
        holder.current.innerHTML = '';
        holder.current.appendChild(el);
        player.current = new YT.Player(el, {
          videoId: vkey, host: 'https://www.youtube-nocookie.com', width: '100%', height: '100%',
          playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
          events: { onReady: () => live && setReady(true) },
        });
      })
      .catch(e => setErr(e instanceof Error ? e.message : 'Couldn’t load the YouTube player'));
    return () => { live = false; };
  }, [vkey]);
  useEffect(() => () => { player.current?.destroy(); player.current = null; }, []);

  const now = () => player.current?.getCurrentTime() ?? 0;
  const add = (c: Clip) => onClips([...clips, { start: +Math.max(0, c.start).toFixed(2), end: +c.end.toFixed(2) }].sort((a, b) => a.start - b.start).slice(0, 12));
  const jump = (c: Clip) => { player.current?.seekTo(c.start, true); player.current?.playVideo(); };
  const sel = 'rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs';
  const current = videos?.find(v => v.key === vkey);

  return (
    <div className="space-y-2 rounded-lg border border-red-900/50 bg-red-950/10 p-2.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-red-500" fill="currentColor" aria-hidden><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.8 15V9l5.2 3-5.2 3Z" /></svg>
        <span className="font-semibold text-slate-200">Watch the official trailer &amp; mark moments</span>
        {titles.length > 1 && (
          <select value={ti} onChange={e => { setTi(Number(e.target.value)); setVkey(null); }} className={sel}>
            {titles.map((x, i) => <option key={i} value={i}>{x.title}</option>)}
          </select>
        )}
      </div>
      {videos == null ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Finding official trailers…</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {videos.length > 0 && (
            <select value={vkey || ''} onChange={e => choose(e.target.value)} className={`${sel} max-w-full flex-1 min-w-0`}>
              {vkey && !current && <option value={vkey}>Pasted video ({vkey})</option>}
              {videos.map(v => <option key={v.key} value={v.key}>{v.official ? '✓ ' : ''}{v.type} · {v.language?.toUpperCase() || '—'} · {v.name}</option>)}
            </select>
          )}
          <input value={paste} onChange={e => setPaste(e.target.value)} placeholder={videos.length ? 'or paste a YouTube link to watch' : 'No trailer found — paste a YouTube link to watch'}
            onKeyDown={e => { if (e.key === 'Enter') { const id = youtubeId(paste); if (id) { choose(id); setPaste(''); } } }} className={`${sel} flex-1 min-w-[12rem]`} />
          <button onClick={() => { const id = youtubeId(paste); if (id) { choose(id); setPaste(''); } else setErr('That isn’t a YouTube video link.'); }} disabled={!paste.trim()} className="rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-2.5 py-1">Watch</button>
        </div>
      )}
      {err && <p className="text-[11px] text-amber-400">{err}</p>}
      {vkey && (
        <>
          <div ref={holder} className="aspect-video w-full overflow-hidden rounded-md bg-black" />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button disabled={!ready} onClick={() => { const s = now(); add({ start: s, end: s + len }); }} className="flex items-center gap-1 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-2.5 py-1.5 text-white"><Plus className="w-3.5 h-3.5" /> Mark clip from here</button>
            <select value={len} onChange={e => setLen(Number(e.target.value))} className={sel} title="Clip length">{[1.5, 2, 3, 4, 5, 6, 8].map(v => <option key={v} value={v}>{v} s</option>)}</select>
            <span className="text-slate-600">or</span>
            {markStart == null
              ? <button disabled={!ready} onClick={() => setMarkStart(now())} className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-2.5 py-1.5"><Scissors className="w-3.5 h-3.5" /> Mark start</button>
              : <button onClick={() => { const e = now(); if (e - markStart >= 0.5) add({ start: markStart, end: e }); setMarkStart(null); }} className="flex items-center gap-1 rounded-md bg-amber-600 hover:bg-amber-700 px-2.5 py-1.5 text-white"><Scissors className="w-3.5 h-3.5" /> Mark end (from {fmt(markStart)})</button>}
            <a href={`https://www.youtube.com/watch?v=${vkey}`} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-slate-400 hover:text-white" title="On YouTube you can also Remix → Cut this trailer into a Short">Open on YouTube <ExternalLink className="w-3 h-3" /></a>
          </div>
          {clips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {clips.map((c, i) => (
                <span key={`${i}-${c.start}`} className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 pl-2 pr-1 py-0.5 text-[11px] text-slate-300">
                  {i + 1}. {fmt(c.start)}–{fmt(c.end)}
                  <button onClick={() => jump(c)} title="Watch this moment" className="p-0.5 hover:text-white"><Play className="w-3 h-3" /></button>
                  <button onClick={() => onClips(clips.filter((_, k) => k !== i))} title="Remove" className="p-0.5 hover:text-red-400"><X className="w-3 h-3" /></button>
                </span>
              ))}
              <button onClick={() => { onClips([]); try { if (vkey) localStorage.removeItem(store(vkey)); } catch {} }} className="text-[11px] text-slate-500 hover:text-white">Clear</button>
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            {clips.length ? `${clips.length} moment(s) marked and saved for this trailer. ` : ''}
            Only watching here — nothing is downloaded. When you load this trailer’s file below, these marks become your clips (they line up if it’s the same cut of the trailer).
          </p>
        </>
      )}
    </div>
  );
}
