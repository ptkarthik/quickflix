'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, GripVertical, Heart, ImagePlus, MessageCircle, MoreHorizontal, Plus, Send, X } from 'lucide-react';
import { OttRelease, displayTitle } from '@/lib/ott';
import { SLIDE_H, SLIDE_W } from './OttSlides';
import { ImageFinder } from './SinglePostEditor';
import type { PostDomain } from '@/lib/postDomain';

export interface SlideView {
  key: string;
  kind: 'cover' | 'title' | 'custom' | 'outro';
  label: string;
  node: React.ReactNode;
}

/** A 1080×1350 slide drawn at a smaller size. */
export function Scaled({ node, scale, innerRef }: { node: React.ReactNode; scale: number; innerRef?: (el: HTMLDivElement | null) => void }) {
  return (
    <div className="overflow-hidden" style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: SLIDE_W, height: SLIDE_H }}>
        <div ref={innerRef}>{node}</div>
      </div>
    </div>
  );
}

// ───────────────────────── reorderable strip ─────────────────────────

export function SlideStrip({
  slides, scale, onMove, onRemove, onPicture, onAdd, slideRef, extra, restore = [],
}: {
  /** Removed standard slides (cover / end slide) you can bring back in one click. */
  restore?: Array<{ label: string; onClick: () => void }>;
  slides: SlideView[];
  scale: number;
  onMove: (from: number, to: number) => void;
  onRemove?: (key: string) => void;
  onPicture?: (key: string) => void;
  onAdd?: () => void;
  /** Export refs (only the main strip renders the nodes that get exported). */
  slideRef?: (i: number, el: HTMLDivElement | null) => void;
  extra?: (s: SlideView) => React.ReactNode;
}) {
  const dragFrom = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const small = scale < 0.15;

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {slides.map((s, i) => (
        <div key={s.key}
          draggable
          onDragStart={e => { dragFrom.current = i; e.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={e => { e.preventDefault(); setOver(i); }}
          onDragLeave={() => setOver(o => (o === i ? null : o))}
          onDrop={e => { e.preventDefault(); if (dragFrom.current !== null && dragFrom.current !== i) onMove(dragFrom.current, i); dragFrom.current = null; setOver(null); }}
          onDragEnd={() => { dragFrom.current = null; setOver(null); }}
          className={`shrink-0 space-y-1.5 rounded-lg p-1 transition-colors ${over === i ? 'bg-indigo-500/30' : ''}`}>
          <div className="relative rounded-md overflow-hidden border border-slate-800 cursor-grab active:cursor-grabbing">
            <Scaled node={s.node} scale={scale} innerRef={slideRef ? el => slideRef(i, el) : undefined} />
            <span className="absolute top-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white flex items-center gap-0.5">
              {!small && <GripVertical className="w-3 h-3" />}{i + 1}
            </span>
            {onRemove && !small && (
              <button onClick={() => onRemove(s.key)} title="Remove slide" className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-slate-300 hover:text-red-400"><X className="w-3 h-3" /></button>
            )}
          </div>
          {!small && (
            <div className="flex items-center gap-1 text-[11px]" style={{ width: SLIDE_W * scale }}>
              <button disabled={i === 0} onClick={() => onMove(i, i - 1)} title="Move left" className="rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 p-1"><ChevronLeft className="w-3 h-3" /></button>
              <button disabled={i === slides.length - 1} onClick={() => onMove(i, i + 1)} title="Move right" className="rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 p-1"><ChevronRight className="w-3 h-3" /></button>
              <span className="flex-1 truncate text-slate-400 px-1" title={s.label}>{s.label}</span>
              {onPicture && (s.kind === 'title' || s.kind === 'custom') && (
                <button onClick={() => onPicture(s.key)} className="rounded bg-slate-800 hover:bg-slate-700 px-1.5 py-1 text-slate-300">Picture</button>
              )}
            </div>
          )}
          {!small && extra?.(s)}
        </div>
      ))}
      {restore.length > 0 && (
        <div className="shrink-0 m-1 flex flex-col justify-center gap-2" style={{ height: SLIDE_H * scale }}>
          {restore.map(r => (
            <button key={r.label} onClick={r.onClick} className="flex items-center gap-1.5 rounded-md border border-dashed border-emerald-700 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300 hover:border-emerald-500 hover:text-white">
              <Plus className="w-3.5 h-3.5" /> Add back: {r.label}
            </button>
          ))}
        </div>
      )}
      {onAdd && (
        <button onClick={onAdd}
          className="shrink-0 m-1 rounded-md border-2 border-dashed border-slate-700 hover:border-indigo-500 text-slate-400 hover:text-white flex flex-col items-center justify-center gap-2 text-sm"
          style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}>
          <Plus className="w-6 h-6" /> Add slide
          <span className="text-[11px] text-slate-500 px-4 text-center">Your thumbnails, AI-made posters, stills…</span>
        </button>
      )}
    </div>
  );
}

// ───────────────────────── picture picker ─────────────────────────

export function PicturePicker({
  title, releases, initialReleaseId, current, onPick, onReset, onClose, aiTheme, domain,
}: {
  aiTheme?: string;
  domain?: PostDomain;
  title: string;
  releases: OttRelease[];
  initialReleaseId?: string | null;
  current: string | null;
  onPick: (url: string, label: string) => void;
  onReset?: () => void;
  onClose: () => void;
}) {
  const [rid, setRid] = useState<string | null>(initialReleaseId || releases[0]?.id || null);
  const release = releases.find(r => r.id === rid) || null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2"><ImagePlus className="w-5 h-5 text-indigo-400" /> {title}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-400">
          Upload your own thumbnail (including AI posters you made in ChatGPT, Gemini, Canva…), paste a link, or pick from a title’s pictures.
        </p>
        {releases.length > 1 && (
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Pictures of
            <select value={rid || ''} onChange={e => setRid(e.target.value)} className="flex-1 rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm text-white">
              {releases.map(r => <option key={r.id} value={r.id}>{displayTitle(r)}{r.platform ? ` — ${r.platform}` : ''}</option>)}
            </select>
          </label>
        )}
        {release && <ImageFinder key={release.id} release={release} current={current} aiTheme={aiTheme} domain={domain} onPick={(u, l) => { onPick(u, l); onClose(); }} />}
        {onReset && <button onClick={() => { onReset(); onClose(); }} className="text-xs text-slate-400 hover:text-white">Reset to the original poster</button>}
      </div>
    </div>
  );
}

// ───────────────────────── Instagram-style preview ─────────────────────────

const PHONE_W = 375;

export function InstagramPreview({
  slides, handle, accent, caption, onMove, onClose,
}: {
  slides: SlideView[];
  handle: string;
  accent: string;
  caption: string;
  onMove: (from: number, to: number) => void;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [moreCaption, setMoreCaption] = useState(false);
  const [liked, setLiked] = useState(false);
  const swipe = useRef<number | null>(null);
  const n = slides.length;
  const go = (i: number) => setIdx(Math.max(0, Math.min(n - 1, i)));
  const current = Math.min(idx, n - 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIdx(i => Math.min(n - 1, i + 1));
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [n, onClose]);

  const name = handle.replace(/^@/, '') || 'yourhandle';
  const [firstLine, ...rest] = caption.split('\n');
  const scale = PHONE_W / SLIDE_W;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto" onClick={onClose}>
      <div className="flex flex-col xl:flex-row items-center xl:items-start gap-6 max-h-full" onClick={e => e.stopPropagation()}>
        {/* phone */}
        <div className="shrink-0 box-content rounded-[2.5rem] border-[10px] border-neutral-800 bg-black shadow-2xl overflow-hidden" style={{ width: PHONE_W }}>
          <div className="bg-black text-white" style={{ width: PHONE_W }}>
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <div className="rounded-full p-[2px]" style={{ background: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)' }}>
                <div className="w-8 h-8 rounded-full border-2 border-black flex items-center justify-center text-sm font-bold text-black" style={{ background: accent }}>{name[0]?.toUpperCase()}</div>
              </div>
              <div className="flex-1 text-[13px] font-semibold leading-tight">{name}</div>
              <MoreHorizontal className="w-5 h-5" />
            </div>
            {/* carousel */}
            <div className="relative overflow-hidden select-none touch-pan-y" style={{ width: PHONE_W, height: SLIDE_H * scale }}
              onPointerDown={e => { swipe.current = e.clientX; }}
              onPointerUp={e => { if (swipe.current !== null) { const dx = e.clientX - swipe.current; if (dx < -40) go(current + 1); if (dx > 40) go(current - 1); } swipe.current = null; }}
              onDoubleClick={() => setLiked(true)}>
              <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${current * PHONE_W}px)` }}>
                {slides.map(s => <div key={s.key} className="shrink-0"><Scaled node={s.node} scale={scale} /></div>)}
              </div>
              {n > 1 && <span className="absolute top-3 right-3 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium">{current + 1}/{n}</span>}
              {current > 0 && (
                <button onClick={() => go(current - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1 text-black shadow"><ChevronLeft className="w-4 h-4" /></button>
              )}
              {current < n - 1 && (
                <button onClick={() => go(current + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1 text-black shadow"><ChevronRight className="w-4 h-4" /></button>
              )}
            </div>
            {/* actions + dots */}
            <div className="relative flex items-center px-3 pt-2.5 pb-1">
              <div className="flex gap-4">
                <button onClick={() => setLiked(l => !l)}><Heart className={`w-6 h-6 ${liked ? 'fill-red-500 text-red-500' : ''}`} /></button>
                <MessageCircle className="w-6 h-6 -scale-x-100" />
                <Send className="w-6 h-6" />
              </div>
              {n > 1 && (
                <div className="absolute left-1/2 -translate-x-1/2 flex gap-1">
                  {slides.map((s, i) => <button key={s.key} onClick={() => go(i)} className={`rounded-full ${i === current ? 'w-1.5 h-1.5 bg-sky-500' : 'w-1.5 h-1.5 bg-neutral-600'}`} />)}
                </div>
              )}
              <Bookmark className="w-6 h-6 ml-auto" />
            </div>
            <div className="px-3 pb-4 text-[13px] leading-snug space-y-1">
              <div className="font-semibold">{liked ? '1 like' : 'Be the first to like this'}</div>
              <div className="whitespace-pre-wrap">
                <span className="font-semibold">{name}</span> {firstLine}
                {rest.length > 0 && (moreCaption ? <>{'\n'}{rest.join('\n')}</> : <button onClick={() => setMoreCaption(true)} className="text-neutral-400"> … more</button>)}
              </div>
              <div className="text-[11px] text-neutral-500 uppercase tracking-wide">Just now</div>
            </div>
          </div>
        </div>

        {/* arrange */}
        <div className="w-full max-w-md shrink rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Arrange slides</h3>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-xs text-slate-400">Drag to reorder. Click a slide to jump to it. ← → keys swipe, Esc closes.</p>
          <div className="grid grid-cols-4 gap-2">
            {slides.map((s, i) => (
              <ArrangeTile key={s.key} s={s} i={i} active={i === current} onClick={() => go(i)} onMove={(a, b) => { onMove(a, b); if (current === a) setIdx(b); }} />
            ))}
          </div>
          <p className="text-[11px] text-slate-500">{n} slide{n === 1 ? '' : 's'} · Instagram shows the first slide in the feed and the grid.</p>
        </div>
      </div>
    </div>
  );
}

function ArrangeTile({ s, i, active, onClick, onMove }: { s: SlideView; i: number; active: boolean; onClick: () => void; onMove: (from: number, to: number) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div draggable
      onDragStart={e => e.dataTransfer.setData('text/plain', String(i))}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); const from = Number(e.dataTransfer.getData('text/plain')); if (!Number.isNaN(from) && from !== i) onMove(from, i); }}
      onClick={onClick}
      className={`relative cursor-grab rounded-md overflow-hidden border-2 ${active ? 'border-sky-500' : over ? 'border-indigo-400' : 'border-transparent'}`}>
      <Scaled node={s.node} scale={0.08} />
      <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[10px]">{i + 1}</span>
    </div>
  );
}
