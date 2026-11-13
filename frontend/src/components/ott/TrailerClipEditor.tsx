'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Link2, Loader2, Play, Plus, Scissors, Upload, Wand2, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { TrailerTitle, YouTubeMarker } from './YouTubeMarker';

export interface Clip { start: number; end: number }

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

/**
 * Pick moments from a trailer file: play/scrub it, then "Add clip from here" (or mark start/end exactly).
 * Clips are cut and joined in this order.
 */
export function TrailerClipEditor({ file, onFile, clips, onClips, titles = [] }: { file: File | null; onFile: (f: File | null) => void; clips: Clip[]; onClips: (c: Clip[]) => void; titles?: TrailerTitle[] }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [len, setLen] = useState(3);
  const [duration, setDuration] = useState(0);
  const [markStart, setMarkStart] = useState<number | null>(null);
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const stopAt = useRef<number | null>(null);
  const [autoCount, setAutoCount] = useState(6);
  const [autoStyle, setAutoStyle] = useState<'balanced' | 'action' | 'story'>('balanced');
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoNote, setAutoNote] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [linkBusy, setLinkBusy] = useState<string | null>(null);
  const [linkErr, setLinkErr] = useState<string | null>(null);

  /** Load the trailer from a pasted link (Drive / Dropbox / press kit / direct file). The backend refuses YouTube & social links. */
  const loadLink = async () => {
    const u = link.trim();
    if (!u) return;
    setLinkErr(null);
    setLinkBusy('Connecting…');
    try {
      const res = await apiFetch('/reels/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: u }) }, 0);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `Couldn’t load (${res.status})`);
      }
      const totalBytes = Number(res.headers.get('Content-Length') || 0);
      const name = decodeURIComponent(res.headers.get('X-File-Name') || 'trailer.mp4');
      const reader = res.body?.getReader();
      const parts: BlobPart[] = [];
      let got = 0;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value);
          got += value.length;
          setLinkBusy(`Loading ${(got / 1e6).toFixed(1)}${totalBytes ? ` / ${(totalBytes / 1e6).toFixed(1)}` : ''} MB…`);
        }
      } else parts.push(await res.blob());
      onFile(new File(parts, name, { type: 'video/mp4' }));
      setLink('');
    } catch (e) {
      setLinkErr(e instanceof Error ? e.message : 'Couldn’t load that link');
    } finally {
      setLinkBusy(null);
    }
  };

  /** Let the app pick the moments: shot changes + loudness + pace, measured by ffmpeg (no AI). */
  const autoPick = async () => {
    if (!file) return;
    if (clips.length && !window.confirm(`Replace your ${clips.length} clip(s) with automatic picks?`)) return;
    setAutoBusy(true);
    setAutoNote(null);
    try {
      const fd = new FormData();
      fd.append('video', file, file.name);
      fd.append('options', JSON.stringify({ count: autoCount, length: len, style: autoStyle }));
      const res = await apiFetch('/reels/trailer/auto', { method: 'POST', body: fd }, 0);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || `Failed (${res.status})`);
      const picked: Clip[] = j.clips || [];
      onClips(picked);
      setAutoNote(picked.length
        ? `Picked ${picked.length} moment(s) from ${j.shots} shot${j.shots === 1 ? '' : 's'} —skipped the opening logos, black frames and the end card. Preview, reorder or change any of them.`
        : 'Couldn’t find good moments in this video — add clips by hand.');
    } catch (e) {
      setAutoNote(e instanceof Error ? e.message : 'Auto-pick failed');
    } finally {
      setAutoBusy(false);
    }
  };

  const now = () => ref.current?.currentTime ?? 0;
  const add = (c: Clip) => onClips([...clips, { start: Math.max(0, +c.start.toFixed(2)), end: +Math.min(c.end, duration || c.end).toFixed(2) }].slice(0, 12));
  const play = (c: Clip) => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = c.start;
    stopAt.current = c.end;
    v.play().catch(() => null);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= clips.length) return;
    const n = [...clips];
    [n[i], n[j]] = [n[j], n[i]];
    onClips(n);
  };
  const total = clips.reduce((a, c) => a + (c.end - c.start), 0);
  const sel = 'rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs';

  if (!file || !url) {
    return (
      <div className="space-y-2">
      {titles.length > 0 && <YouTubeMarker titles={titles} clips={clips} onClips={onClips} />}
      <label className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-700 px-4 py-8 cursor-pointer hover:border-slate-500 text-center">
        <Upload className="w-6 h-6 text-slate-400" />
        <span className="text-sm text-slate-200">Choose the trailer video (MP4 / MOV / WebM)</span>
        <span className="text-[11px] text-slate-500">Use a trailer file you have (e.g. from the studio’s press kit). It stays on your computer + this app only.</span>
        <input type="file" accept="video/*" className="hidden" onChange={e => onFile(e.target.files?.[0] || null)} />
      </label>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">or paste a link</span>
        <div className="flex flex-1 items-center gap-1.5 rounded-md bg-slate-950 border border-slate-700 px-2 focus-within:border-indigo-500">
          <Link2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <input value={link} onChange={e => { setLink(e.target.value); setLinkErr(null); }} onKeyDown={e => { if (e.key === 'Enter') loadLink(); }}
            disabled={!!linkBusy} placeholder="Google Drive / Dropbox / OneDrive / press-kit or direct .mp4 link"
            className="flex-1 min-w-0 bg-transparent py-1.5 outline-none text-slate-200 placeholder:text-slate-600" />
        </div>
        <button onClick={loadLink} disabled={!link.trim() || !!linkBusy} className="flex items-center gap-1 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 text-white">
          {linkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} {linkBusy ? 'Loading' : 'Load'}
        </button>
      </div>
      {linkBusy && <p className="text-[11px] text-slate-400">{linkBusy}</p>}
      {linkErr && <p className="text-[11px] text-amber-400">{linkErr}</p>}
      <p className="text-[11px] text-slate-500">Drive / Dropbox files must be shared as “Anyone with the link”. YouTube, Instagram and other social links can’t be downloaded (their terms don’t allow it).</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <video ref={ref} src={url} controls playsInline className="w-full rounded-md bg-black max-h-64"
        onLoadedMetadata={e => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={e => { if (stopAt.current != null && e.currentTarget.currentTime >= stopAt.current) { e.currentTarget.pause(); stopAt.current = null; } }} />
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { const t = now(); add({ start: t, end: t + len }); }} className="flex items-center gap-1 rounded-md bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 text-white"><Plus className="w-3.5 h-3.5" /> Add clip from here</button>
        <select value={len} onChange={e => setLen(Number(e.target.value))} className={sel} title="Clip length">{[1.5, 2, 3, 4, 5, 6, 8].map(v => <option key={v} value={v}>{v} s</option>)}</select>
        <span className="text-slate-600">or</span>
        {markStart == null
          ? <button onClick={() => setMarkStart(now())} className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5"><Scissors className="w-3.5 h-3.5" /> Mark start</button>
          : <button onClick={() => { const t = now(); if (t - markStart >= 0.5) add({ start: markStart, end: t }); setMarkStart(null); }} className="flex items-center gap-1 rounded-md bg-amber-600 hover:bg-amber-700 px-2.5 py-1.5 text-white"><Scissors className="w-3.5 h-3.5" /> Mark end (from {fmt(markStart)})</button>}
        <button onClick={() => { onFile(null); onClips([]); }} className="ml-auto text-slate-500 hover:text-white">Change file</button>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-violet-900/60 bg-violet-950/30 px-2 py-1.5">
        <button onClick={autoPick} disabled={autoBusy} className="flex items-center gap-1 rounded-md bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-2.5 py-1.5 text-white">
          {autoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} {autoBusy ? 'Reading the trailer…' : 'Auto-pick clips'}
        </button>
        <select value={autoCount} onChange={e => setAutoCount(Number(e.target.value))} className={sel} title="How many clips">{[3, 4, 5, 6, 8, 10, 12].map(v => <option key={v} value={v}>{v} clips</option>)}</select>
        <select value={autoStyle} onChange={e => setAutoStyle(e.target.value as typeof autoStyle)} className={sel} title="What to look for">
          <option value="balanced">Balanced</option>
          <option value="action">Action (fast cuts, loud)</option>
          <option value="story">Story (longer shots)</option>
        </select>
        <span className="text-[11px] text-slate-500">each ≈ {len} s · no AI — uses shot changes + loudness</span>
      </div>
      {autoNote && <p className="text-[11px] text-violet-300">{autoNote}</p>}
      <ul className="space-y-1">
        {clips.map((c, i) => (
          <li key={`${i}-${c.start}`} className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 px-2 py-1">
            <span className="w-5 text-slate-500">{i + 1}</span>
            <input type="number" step={0.1} min={0} value={c.start} onChange={e => onClips(clips.map((x, k) => (k === i ? { ...x, start: Math.max(0, Number(e.target.value)) } : x)))} className={`${sel} w-20`} title="Start (s)" />
            <span className="text-slate-500">→</span>
            <input type="number" step={0.1} min={0} value={c.end} onChange={e => onClips(clips.map((x, k) => (k === i ? { ...x, end: Number(e.target.value) } : x)))} className={`${sel} w-20`} title="End (s)" />
            <span className="text-slate-400">{(c.end - c.start).toFixed(1)} s</span>
            <button onClick={() => play(c)} title="Preview" className="p-1 text-slate-300 hover:text-white"><Play className="w-3.5 h-3.5" /></button>
            <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-slate-400 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
            <button onClick={() => move(i, 1)} disabled={i === clips.length - 1} className="p-1 text-slate-400 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
            <button onClick={() => onClips(clips.filter((_, k) => k !== i))} className="p-1 text-slate-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-slate-500">{clips.length ? `${clips.length} clip(s) · ${total.toFixed(1)} s of trailer` : 'Play the trailer and add the moments you want (up to 12).'} {duration ? `Trailer: ${fmt(duration)}.` : ''}</p>
    </div>
  );
}
