'use client';
/* eslint-disable @next/next/no-img-element -- rasterised by html-to-image; next/image would break export */
import React, { useLayoutEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, LayoutTemplate, Plus, RotateCcw, Save, Tag, Trash2, Type } from 'lucide-react';
import { proxied } from '@/lib/ott';
import { PostTheme, frameBackground, titleStyle } from '@/lib/themes';
import {
  BLOCK_INFO, BlockColor, BlockPlace, BlockStyle, LookBlock, LookSurface, PLACE_LABEL, PostLook, newTextBlock, useSavedLooks, DEFAULT_ADJUST, SlideAdjust } from '@/lib/postLook';
import { RatingPill, SLIDE_H, SLIDE_W, SlideBrand, Texture } from './OttSlides';
import { META_PART_LABEL, MetaBit, MetaPart } from '@/lib/postMeta';

/** The facts / words available for one title — the look decides which are drawn and where. */
export interface LookContent {
  title: string;
  /** automatic wording for the label (your own wording in the layout wins) */
  kicker?: string;
  /** platform pill / cinema ticket, drawn at the given font size (null = none for this title) */
  badge?: (size: number) => React.ReactNode;
  date?: string;
  prevDate?: string;
  meta?: string;
  /** the details line in parts, so each can be removed */
  metaBits?: MetaBit[];
  chips?: string[];
  stars?: number | null;
  review?: string;
  note?: string;
  oneLiner?: string | null;
}

export function Stars({ rating, size, accent }: { rating: number; size: number; accent: string }) {
  return (
    <div style={{ display: 'inline-flex', gap: size * 0.12, alignItems: 'center' }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.max(0, Math.min(1, rating - i));
        return (
          <span key={i} style={{ position: 'relative', display: 'inline-block', width: size, height: size, lineHeight: `${size}px`, fontSize: size }}>
            <span style={{ position: 'absolute', inset: 0, color: 'rgba(255,255,255,0.25)' }}>★</span>
            <span style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${fill * 100}%`, overflow: 'hidden', color: accent }}>★</span>
          </span>
        );
      })}
    </div>
  );
}

const colorOf = (c: BlockColor | undefined, t: PostTheme) => (c === 'accent' ? t.accent : c === 'muted' ? 'rgba(255,255,255,0.7)' : '#fff');
const INLINE: LookBlock['kind'][] = ['badge', 'date'];

/** One element → its drawing (null when there's nothing to show for this title). */
function drawBlock(bl: LookBlock, c: LookContent, t: PostTheme, onPic: boolean, center: boolean): React.ReactNode {
  const s = (bl.size / 100) * (onPic ? 0.8 : 1);
  const justify = center ? 'center' : 'flex-start';
  switch (bl.kind) {
    case 'kicker': {
      const text = bl.text?.trim() || c.kicker;
      if (!text) return null;
      return <div style={{ display: 'inline-block', background: t.accent, color: '#000', fontWeight: 900, fontSize: 30 * s, padding: `${8 * s}px ${20 * s}px`, borderRadius: 10, letterSpacing: 2, textTransform: 'uppercase', fontFamily: t.bodyFont }}>{text}</div>;
    }
    case 'title': {
      const size = c.title.length > 34 ? 60 : c.title.length > 22 ? 76 : 92;
      return <div style={{ ...titleStyle(t, size * s) }}>{c.title}</div>;
    }
    case 'badge':
      return c.badge?.(32 * s) ?? null;
    case 'date':
      if (!c.date && !c.prevDate) return null;
      return (
        <span style={{ display: 'inline-flex', gap: 16 * s, alignItems: 'baseline', flexWrap: 'wrap', justifyContent: justify }}>
          {c.prevDate && <span style={{ fontSize: 32 * s, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textDecoration: 'line-through', textDecorationThickness: 4 }}>{c.prevDate}</span>}
          {c.date && <span style={{ fontSize: 38 * s, fontWeight: 800, color: t.accent }}>{c.date}</span>}
        </span>
      );
    case 'meta': {
      const text = c.metaBits ? c.metaBits.filter(m => !bl.hideParts?.includes(m.key)).map(m => m.text).join('  •  ') : c.meta;
      return text ? <div style={{ fontSize: 30 * s, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 }}>{text}</div> : null;
    }
    case 'ratings':
      return c.chips?.length ? (
        <div style={{ display: 'flex', gap: 14 * s, flexWrap: 'wrap', justifyContent: justify }}>
          {c.chips.map(x => <RatingPill key={x} text={x} accent={t.accent} size={(c.chips!.length > 3 ? 24 : 30) * s} />)}
        </div>
      ) : null;
    case 'stars':
      return c.stars != null ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 * s, justifyContent: justify }}>
          <Stars rating={c.stars} size={56 * s} accent={t.accent} />
          <span style={{ fontSize: 44 * s, fontWeight: 900 }}>{c.stars}/5</span>
        </div>
      ) : null;
    case 'review':
      return c.review?.trim() ? <div style={{ fontSize: 34 * s, fontWeight: 500, lineHeight: 1.32, color: 'rgba(255,255,255,0.92)', whiteSpace: 'pre-wrap' }}>{c.review.trim()}</div> : null;
    case 'note':
      return c.note?.trim() ? <div style={{ fontSize: 34 * s, fontWeight: 500, lineHeight: 1.3, color: 'rgba(255,255,255,0.9)' }}>{c.note.trim()}</div> : null;
    case 'oneLiner':
      return c.oneLiner ? (
        <div style={{ fontSize: 38 * s, fontWeight: 700, lineHeight: 1.25, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}>
          <span style={{ color: t.accent }}>“</span>{c.oneLiner}<span style={{ color: t.accent }}>”</span>
        </div>
      ) : null;
    case 'text': {
      const text = bl.text?.trim();
      if (!text) return null;
      const col = colorOf(bl.color, t);
      if (bl.style === 'label') return <div style={{ display: 'inline-block', background: col, color: bl.color === 'white' || bl.color === 'accent' ? '#000' : '#fff', fontWeight: 900, fontSize: 30 * s, padding: `${8 * s}px ${20 * s}px`, borderRadius: 10, letterSpacing: 2, textTransform: 'uppercase', fontFamily: t.bodyFont }}>{text}</div>;
      if (bl.style === 'outline') return <div style={{ display: 'inline-block', border: `3px solid ${col}`, color: col, fontWeight: 800, fontSize: 30 * s, padding: `${8 * s}px ${20 * s}px`, borderRadius: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: t.bodyFont }}>{text}</div>;
      if (bl.style === 'big') return <div style={{ ...titleStyle(t, 64 * s), color: col }}>{text}</div>;
      return <div style={{ fontSize: 34 * s, fontWeight: 600, lineHeight: 1.3, color: col, whiteSpace: 'pre-wrap' }}>{text}</div>;
    }
  }
}

/** Blocks for one place, in order; date + badge next to each other share a row. */
function Stack({ blocks, content, theme, onPic, center, gap = 20 }: { blocks: LookBlock[]; content: LookContent; theme: PostTheme; onPic: boolean; center: boolean; gap?: number }) {
  const drawn = blocks.map(bl => ({ bl, node: drawBlock(bl, content, theme, onPic, center) })).filter(x => x.node);
  const rows: Array<{ key: string; inline: boolean; nodes: React.ReactNode[] }> = [];
  for (const d of drawn) {
    const last = rows[rows.length - 1];
    if (INLINE.includes(d.bl.kind) && last?.inline) last.nodes.push(<React.Fragment key={d.bl.id}>{d.node}</React.Fragment>);
    else rows.push({ key: d.bl.id, inline: INLINE.includes(d.bl.kind), nodes: [<React.Fragment key={d.bl.id}>{d.node}</React.Fragment>] });
  }
  if (!rows.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: gap * (onPic ? 0.7 : 1), alignItems: center ? 'center' : 'flex-start', textAlign: center ? 'center' : 'left' }}>
      {rows.map(r => r.inline
        ? <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: center ? 'center' : 'flex-start' }}>{r.nodes}</div>
        : <React.Fragment key={r.key}>{r.nodes}</React.Fragment>)}
    </div>
  );
}

const hasAny = (blocks: LookBlock[], c: LookContent, t: PostTheme) => blocks.some(bl => drawBlock(bl, c, t, false, true));

/**
 * A 1080×1350 post laid out from a PostLook: "card" = framed picture + text below (the picture shrinks
 * by itself when the text needs room), "full" = picture fills the post with text over it.
 */
export function LookFrame({
  look, theme: t, content, picture, layout = 'card', brand, page, rank, darken = 35, cardBase = 780, adjust,
}: {
  /** per-slide fine-tuning (picture zoom / focus / brightness, shade, text size / position) */
  adjust?: SlideAdjust;
  look: PostLook;
  theme: PostTheme;
  content: LookContent;
  /** the picture (already a usable URL) and optional style for it (zoom / pan / filters) */
  picture: { src: string | null; style?: React.CSSProperties };
  /** card = poster in a frame · full = picture fills the slide (cropped) · fit = whole picture, blurred edges */
  layout?: 'card' | 'full' | 'fit';
  brand: SlideBrand;
  page?: string;
  rank?: number;
  darken?: number;
  cardBase?: number;
}) {
  const center = look.align === 'center';
  const on = look.blocks.filter(b => b.on);
  const at = (p: BlockPlace) => on.filter(b => b.place === p);
  const src = proxied(picture.src);
  const adj = adjust || DEFAULT_ADJUST;
  const baseFilter = t.imageFilter && t.imageFilter !== 'none' ? t.imageFilter : '';
  const imgStyle: React.CSSProperties = picture.style || {
    width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${adj.x}% ${adj.y}%`,
    transform: adj.zoom !== 1 ? `scale(${adj.zoom})` : undefined, transformOrigin: `${adj.x}% ${adj.y}%`,
    filter: `${baseFilter}${adj.brightness !== 100 ? ` brightness(${adj.brightness / 100})` : ''}`.trim() || undefined,
  };
  const s = adj.shade / 100;
  const h = adj.shadeHeight / 100;
  const hex = (a: number) => Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
  const textMove = (origin: 'top' | 'bottom'): React.CSSProperties => ({
    transform: `translateY(${adj.textY}px) scale(${adj.textScale / 100})`, transformOrigin: `${origin} ${center ? 'center' : 'left'}`,
  });
  const showFooter = look.handle || (look.page && !!page);
  const footerH = showFooter ? 112 : 56;
  const base = t.bg[1];

  // measure the text under the picture so the picture can make room for it
  const [textEl, setTextEl] = useState<HTMLDivElement | null>(null);
  const [textH, setTextH] = useState(0);
  useLayoutEffect(() => {
    if (!textEl) return;
    const ro = new ResizeObserver(() => setTextH(textEl.offsetHeight)); // fires once right away, then on every change
    ro.observe(textEl);
    return () => ro.disconnect();
  }, [textEl]);

  const footer = showFooter && (
    <div style={{ position: 'absolute', left: 64, right: 64, bottom: 44, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 30, fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: t.bodyFont }}>
      <span>{look.handle ? brand.handle : ''}</span>
      {look.page && page && <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{page}</span>}
    </div>
  );
  const rankBadge = look.rank && rank !== undefined && (
    <div style={{ position: 'absolute', top: 48, left: 56, width: 132, height: 132, borderRadius: 999, background: t.accent, color: '#000', fontSize: 76, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 30px rgba(0,0,0,0.5)', fontFamily: t.titleFont, zIndex: 2 }}>
      {rank}
    </div>
  );
  const frame: React.CSSProperties = { width: SLIDE_W, height: SLIDE_H, position: 'relative', overflow: 'hidden', background: frameBackground(t), color: t.text, fontFamily: t.bodyFont };

  if (layout === 'full' || layout === 'fit') {
    const bottom = [...at('picture-bottom'), ...at('below')];
    const fit = layout === 'fit';
    // "Fit whole": the whole picture sits above the text, so the title never lands on the poster's own lettering
    const picBottom = fit ? footerH + textH + 40 : 0;
    return (
      <div style={frame}>
        {fit && src && <img src={src} alt="" style={{ position: 'absolute', inset: -60, width: SLIDE_W + 120, height: SLIDE_H + 120, objectFit: 'cover', filter: 'blur(40px) brightness(0.45) saturate(1.2)' }} />}
        <div style={{ position: 'absolute', left: 0, right: 0, top: fit ? 40 : 0, bottom: picBottom, overflow: 'hidden' }}>{src && <img src={src} alt="" style={fit ? { ...imgStyle, objectFit: 'contain' } : imgStyle} />}</div>
        {fit
          ? <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: Math.min(SLIDE_H, (picBottom + 160) * h), background: `linear-gradient(180deg, ${base}00 0%, ${base}${hex(0.75 * s)} 35%, ${base}${hex(0.95 * s)} 100%)` }} />
          : <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${base}00 ${100 - 70 * h}%, ${base}${hex((0.45 + darken / 200) * s)} ${100 - 42 * h}%, ${base}${hex(0.97 * s)} ${100 - 12 * h}%)` }} />}
        <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${(darken / 300) * s})` }} />
        {at('picture-top').length > 0 && <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 420, background: 'linear-gradient(180deg, rgba(0,0,0,0.7), rgba(0,0,0,0))' }} />}
        <Texture theme={t} />
        <div style={{ position: 'absolute', left: 64, right: 64, top: rankBadge ? 200 : 64, ...textMove('top') }}>
          <Stack blocks={at('picture-top')} content={content} theme={t} onPic={false} center={center} />
        </div>
        <div ref={setTextEl} style={{ position: 'absolute', left: 64, right: 64, bottom: footerH, ...textMove('bottom') }}>
          <Stack blocks={bottom} content={content} theme={t} onPic={false} center={center} />
        </div>
        {rankBadge}
        {footer}
      </div>
    );
  }

  // card
  const top = 60;
  const room = SLIDE_H - top - footerH;
  const below = at('below');
  const belowShown = hasAny(below, content, t);
  const target = Math.round(cardBase * (look.picture / 100));
  const picH = Math.max(260, Math.min(target, room - (belowShown ? textH + 34 : 0)));
  const picW = Math.round(picH * 0.667);
  const picTop = at('picture-top');
  const picBottom = at('picture-bottom');
  return (
    <div style={frame}>
      {src && <img src={src} alt="" style={{ position: 'absolute', inset: -60, width: SLIDE_W + 120, height: SLIDE_H + 120, objectFit: 'cover', filter: `blur(40px) brightness(${Math.max(0.15, 0.5 - darken / 250)}) saturate(1.2)` }} />}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${base}${hex(0.15 * s)} ${100 - 100 * h}%, ${base}${hex(0.6 * s)} ${100 - 50 * h}%, ${base}${hex(0.97 * s)} ${100 - 22 * h}%)` }} />
      <Texture theme={t} />
      <div style={{ position: 'absolute', top, left: 64, right: 64, bottom: footerH, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34 }}>
        <div style={{ position: 'relative', flex: '0 0 auto', width: picW, height: picH, borderRadius: 26, overflow: 'hidden', boxShadow: `0 40px 80px rgba(0,0,0,0.6), 0 0 0 3px ${t.accent}55`, background: '#1e1e24' }}>
          {src ? <img src={src} alt="" style={imgStyle} /> : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40, ...titleStyle(t, 52), background: `linear-gradient(160deg, ${t.accent}55, #111)` }}>{content.title}</div>
          )}
          {hasAny(picTop, content, t) && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '26px 26px 70px', background: 'linear-gradient(180deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0) 100%)' }}>
              <Stack blocks={picTop} content={content} theme={t} onPic center={center} gap={16} />
            </div>
          )}
          {hasAny(picBottom, content, t) && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '80px 26px 26px', background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 45%, rgba(0,0,0,0.92) 100%)' }}>
              <Stack blocks={picBottom} content={content} theme={t} onPic center={center} gap={16} />
            </div>
          )}
        </div>
        {belowShown && (
          <div ref={setTextEl} style={{ width: '100%', flex: '0 0 auto', ...textMove('top') }}>
            <Stack blocks={below} content={content} theme={t} onPic={false} center={center} />
          </div>
        )}
      </div>
      {rankBadge}
      {footer}
    </div>
  );
}

// ───────────────────────── editor panel ─────────────────────────

const SIZES = [60, 75, 90, 100, 115, 130, 150, 175];

/** Switch elements on/off, move them (on the picture / below), resize, reorder, add your own text & labels. */
export function LookPanel({
  look, onChange, onReset, onCopyAll, surface, hide = [], note, kickerInput, metaParts = ['year', 'language', 'genre', 'length', 'cert', 'type'],
}: {
  look: PostLook;
  onChange: (l: PostLook) => void;
  onReset: () => void;
  onCopyAll: () => void;
  surface: LookSurface;
  /** elements that don't apply here (e.g. "My note" on a single post) */
  hide?: LookBlock['kind'][];
  note?: React.ReactNode;
  /** single posts: the label's wording is typed per post */
  kickerInput?: { value: string; onChange: (v: string) => void; placeholder?: string };
  /** which details-line parts exist on this desk */
  metaParts?: MetaPart[];
}) {
  const { saved, save, remove } = useSavedLooks(surface);
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2200); };
  const blocks = look.blocks;
  const set = (id: string, patch: Partial<LookBlock>) => onChange({ ...look, blocks: blocks.map(b => (b.id === id ? { ...b, ...patch } : b)) });
  const move = (id: string, dir: -1 | 1) => {
    const visible = blocks.filter(b => !hide.includes(b.kind));
    const i = visible.findIndex(b => b.id === id);
    const j = i + dir;
    if (j < 0 || j >= visible.length) return;
    const a = blocks.indexOf(visible[i]);
    const c = blocks.indexOf(visible[j]);
    const next = [...blocks];
    [next[a], next[c]] = [next[c], next[a]];
    onChange({ ...look, blocks: next });
  };
  const add = (style: BlockStyle) => onChange({ ...look, blocks: [...blocks, newTextBlock(style)] });
  const sel = 'rounded bg-slate-950 border border-slate-700 px-1.5 py-1 text-[11px]';

  return (
    <div className="space-y-3">
      {note}
      <ul className="space-y-1.5">
        {blocks.filter(b => !hide.includes(b.kind)).map((b, i, arr) => (
          <li key={b.id} className={`rounded-md border px-2 py-1.5 ${b.on ? 'border-slate-700 bg-slate-950/60' : 'border-slate-800 opacity-60'}`}>
            <div className="flex items-center gap-1.5">
              <button onClick={() => set(b.id, { on: !b.on })} title={b.on ? 'Remove from the picture' : 'Show on the picture'} className={`p-1 rounded ${b.on ? 'text-emerald-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800'}`}>
                {b.on ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <span className="text-xs font-medium text-slate-200 mr-auto truncate" title={BLOCK_INFO[b.kind].hint}>{b.kind === 'text' ? (b.style === 'label' || b.style === 'outline' ? 'Your label' : 'Your text') : BLOCK_INFO[b.kind].label}</span>
              <button onClick={() => move(b.id, -1)} disabled={i === 0} title="Move up" className="p-1 text-slate-400 hover:text-white disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
              <button onClick={() => move(b.id, 1)} disabled={i === arr.length - 1} title="Move down" className="p-1 text-slate-400 hover:text-white disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
              {b.kind === 'text' && <button onClick={() => onChange({ ...look, blocks: blocks.filter(x => x.id !== b.id) })} title="Delete" className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
            {b.on && (
              <div className="mt-1 flex gap-1.5 pl-7">
                <select value={b.place} onChange={e => set(b.id, { place: e.target.value as BlockPlace })} className={`${sel} flex-1`} title="Where">
                  {(Object.keys(PLACE_LABEL) as BlockPlace[]).map(p => <option key={p} value={p}>{PLACE_LABEL[p]}</option>)}
                </select>
                <select value={b.size} onChange={e => set(b.id, { size: Number(e.target.value) })} className={sel} title="Size">
                  {[...new Set([...SIZES, b.size])].sort((x, y) => x - y).map(v => <option key={v} value={v}>{v}%</option>)}
                </select>
              </div>
            )}
            {b.on && b.kind === 'meta' && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 pl-7 text-[11px] text-slate-300">
                {(Object.keys(META_PART_LABEL) as MetaPart[]).filter(k => metaParts.includes(k)).map(k => (
                  <label key={k} className="flex items-center gap-1">
                    <input type="checkbox" checked={!b.hideParts?.includes(k)}
                      onChange={e => set(b.id, { hideParts: e.target.checked ? (b.hideParts || []).filter(x => x !== k) : [...(b.hideParts || []), k] })} />
                    {META_PART_LABEL[k]}
                  </label>
                ))}
              </div>
            )}
            {b.on && (b.kind === 'text' || b.kind === 'kicker') && (
              <div className="mt-1.5 flex flex-wrap gap-1.5 pl-7">
                <input value={b.kind === 'kicker' && kickerInput ? kickerInput.value : b.text || ''}
                  onChange={e => (b.kind === 'kicker' && kickerInput ? kickerInput.onChange(e.target.value) : set(b.id, { text: e.target.value }))} maxLength={b.kind === 'kicker' ? 30 : 120}
                  placeholder={b.kind === 'kicker' ? kickerInput?.placeholder || 'Label wording — e.g. MUST WATCH, NEW ON NETFLIX' : 'Text on the picture'}
                  className="flex-1 min-w-[140px] rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs" />
                {b.kind === 'text' && (
                  <>
                    <select value={b.style || 'plain'} onChange={e => set(b.id, { style: e.target.value as BlockStyle })} className={sel} title="Style">
                      <option value="plain">Plain text</option>
                      <option value="big">Big heading</option>
                      <option value="label">Filled label</option>
                      <option value="outline">Outline label</option>
                    </select>
                    <select value={b.color || 'white'} onChange={e => set(b.id, { color: e.target.value as BlockColor })} className={sel} title="Colour">
                      <option value="white">White</option>
                      <option value="accent">Theme colour</option>
                      <option value="muted">Soft grey</option>
                    </select>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => add('plain')} className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs"><Type className="w-3.5 h-3.5" /> Add text</button>
        <button onClick={() => add('label')} className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs"><Tag className="w-3.5 h-3.5" /> Add label / sticker</button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-300">
        <label className="flex items-center gap-1.5">Text align
          <select value={look.align} onChange={e => onChange({ ...look, align: e.target.value as PostLook['align'] })} className={sel}>
            <option value="center">Centre</option><option value="left">Left</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">Picture
          <select value={look.picture} onChange={e => onChange({ ...look, picture: Number(e.target.value) })} className={sel}>
            {[60, 70, 80, 90, 100, 110, 120].map(v => <option key={v} value={v}>{v}%</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={look.handle} onChange={e => onChange({ ...look, handle: e.target.checked })} /> Your @handle</label>
        {surface === 'slide' && <label className="flex items-center gap-1.5"><input type="checkbox" checked={look.page} onChange={e => onChange({ ...look, page: e.target.checked })} /> Page number</label>}
        {surface === 'slide' && <label className="flex items-center gap-1.5"><input type="checkbox" checked={look.rank} onChange={e => onChange({ ...look, rank: e.target.checked })} /> Rank number (numbered lists)</label>}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-800 pt-2.5">
        <LayoutTemplate className="w-3.5 h-3.5 text-slate-500" />
        {saved.length > 0 && (
          <select value="" onChange={e => { const s = saved.find(x => x.name === e.target.value); if (s) { onChange(s.look); flash(`Using “${s.name}”`); } }} className={sel}>
            <option value="">My layouts…</option>
            {saved.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        )}
        <button onClick={() => { const name = prompt('Name this layout (e.g. “Review post”, “Clean poster”):')?.trim(); if (name) { save(name, look); flash(`Saved “${name}” — pick it from “My layouts” on any desk`); } }}
          className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px]"><Save className="w-3 h-3" /> Save layout</button>
        {saved.length > 0 && (
          <select value="" onChange={e => { if (e.target.value && confirm(`Delete layout “${e.target.value}”?`)) remove(e.target.value); }} className={sel} title="Delete a saved layout">
            <option value="">Delete…</option>
            {saved.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        )}
        <button onClick={() => { onCopyAll(); flash('Now used on OTT, Cinema and World'); }} className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px]"><Copy className="w-3 h-3" /> Use on all desks</button>
        <button onClick={() => { if (confirm('Go back to the standard layout?')) onReset(); }} className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px]"><RotateCcw className="w-3 h-3" /> Reset</button>
        {msg && <span className="text-[11px] text-emerald-300">{msg}</span>}
      </div>
      <p className="text-[10px] text-slate-500 flex items-center gap-1"><Plus className="w-3 h-3" /> Your layout is remembered for this desk. Elements with nothing to show for a title (e.g. no date yet) are skipped automatically.</p>
    </div>
  );
}
