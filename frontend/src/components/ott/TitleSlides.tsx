'use client';
/* eslint-disable @next/next/no-img-element -- rasterised by html-to-image */
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, ImagePlus, Loader2, Mic, Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import type { ImageResults, PostItem } from '@/lib/postDomain';
import { PhotoPicker } from './PhotoPicker';
import { TitleExtra, extrasApi } from '@/lib/extras';
import { displayTitle, fmtDate, languageLabel, posterUrl, proxied } from '@/lib/ott';
import { genreList, lengthLabel, streamingIn } from '@/lib/world';
import { PostTheme, frameBackground, textureLayers, titleStyle } from '@/lib/themes';
import { OutroSlide, SLIDE_H, SLIDE_W, SlideBrand } from './OttSlides';

/* 'why' | 'ratings' | 'review' are older kinds — still drawn if saved, no longer offered. */
export type InfoKind = 'story' | 'highlights' | 'take' | 'where' | 'text' | 'end' | 'photo' | 'why' | 'ratings' | 'review';
export interface SlideStyle {
  /** % of normal size */
  headSize: number;
  bodySize: number;
  valign: 'top' | 'middle' | 'bottom';
  align: 'left' | 'center';
  /** px up (−) / down (+) */
  y: number;
  header: boolean;
  bg: 'blur' | 'clear' | 'plain';
  bullet: '▸' | '✓' | '•' | 'none';
  stars: boolean;
  /** picture slides: fill the slide (edges cropped) or show the whole picture (blurred edges) */
  fit: 'fill' | 'fit';
  /** picture slides: how much to darken it (0–80 %) so text stays readable */
  shade: number;
}
export interface InfoSlide { id: string; kind: InfoKind; on: boolean; heading: string; body: string; bullets: string[]; style?: Partial<SlideStyle>; auto?: boolean; /** picture slides */ image?: string; imageLabel?: string }
export interface TitleSlidesState { order: string[]; slides: InfoSlide[]; swipeHint: boolean; pages: boolean }
type Saved = TitleSlidesState;

const DEFAULT_STYLE: SlideStyle = { headSize: 100, bodySize: 100, valign: 'top', align: 'left', y: 0, header: true, bg: 'blur', bullet: '▸', stars: true, fit: 'fill', shade: 0 };
const styleOf = (s: InfoSlide): SlideStyle => ({ ...DEFAULT_STYLE, ...(s.kind === 'why' ? { bullet: '✓' as const } : {}), ...s.style });

export const KIND_LABEL: Record<InfoKind, string> = {
  story: 'The story', highlights: 'Highlights', take: 'My take', where: 'Where to watch', text: 'Your own text', end: 'Follow slide', photo: 'Picture',
  why: 'Why watch', ratings: 'Ratings', review: 'My review',
};
export const OFFERED: InfoKind[] = ['story', 'highlights', 'take', 'where', 'text', 'end'];
/** First time: as few slides as possible — you can always add more. */
const RECOMMENDED: InfoKind[] = ['story', 'highlights', 'take'];
export const MAIN = 'main';
const uid = () => Math.random().toString(36).slice(2, 9);
const key = (domain: string, id: string) => `titleSlides.${domain}.${id}`;

/** Common, unattributed ways people describe a genre — used when no reviews are found. */
const GENRE_LINES: Array<[RegExp, string[]]> = [
  [/thriller|crime|mystery/i, ['Edge-of-the-seat thriller', 'Twists you won’t see coming', 'Tight, gripping screenplay']],
  [/horror/i, ['Genuinely chilling', 'Atmosphere that stays with you', 'Watch it with the lights off']],
  [/action|adventure|war/i, ['Mass moments that land', 'Relentless action', 'Big-screen energy']],
  [/romance/i, ['Heartwarming love story', 'Chemistry that works', 'Music you’ll replay']],
  [/comedy/i, ['Laugh-out-loud fun', 'Light, breezy watch', 'Perfect with friends']],
  [/drama/i, ['Intense, emotional drama', 'Linear story — never boring', 'Performances that hit hard']],
  [/family|animation/i, ['Feel-good family watch', 'Warm and wholesome', 'Fun for all ages']],
  [/science fiction|sci-fi|fantasy/i, ['Mind-bending ideas', 'Stunning visuals', 'A world you get lost in']],
  [/documentary|history/i, ['Eye-opening true story', 'Powerful and honest', 'Stays with you']],
];
/** In the title's own genre order (Drama, Crime → drama lines first). */
const genreLines = (genres?: string | null) => {
  const out: string[] = [];
  for (const g of (genres || '').split(',').map(x => x.trim()).filter(Boolean)) {
    for (const [re, lines] of GENRE_LINES) if (re.test(g)) for (const l of lines) if (!out.includes(l)) out.push(l);
  }
  return out;
};

function sentences(text: string | null | undefined, n = 380) {
  const t = (text || '').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > 120 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/** Plain facts we already have — offered as chips (you choose). */
function factsOf(r: PostItem): string[] {
  const w = r.world;
  const out: string[] = [];
  if (w?.people) out.push(`${w.kind === 'tv' ? 'Created by' : 'Directed by'} ${w.people.split(',').slice(0, 2).join(', ')}`);
  const g = w ? genreList(w, 3) : (r.genres || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  if (g.length) out.push(g.join(' • '));
  if (w) { const l = lengthLabel(w); if (l) out.push(l); }
  if (r.language) out.push(`${languageLabel(r.language) || r.language}${w?.year ? ` • ${w.year}` : r.releaseDate ? ` • ${r.releaseDate.slice(0, 4)}` : ''}`);
  return out;
}

/** A slide that is just a picture of the title (still / poster / your own upload) — text on it is optional. */
export function newPhotoSlide(url: string, label = ''): InfoSlide {
  return { id: uid(), kind: 'photo', on: true, heading: '', body: '', bullets: [], image: url, imageLabel: label, style: { header: false, valign: 'bottom', bodySize: 90 } };
}
export function newInfoSlide(kind: InfoKind, r: PostItem, extra: TitleExtra | null, review: string): InfoSlide {
  return defaults(kind, r, extra, review);
}
function defaults(kind: InfoKind, r: PostItem, extra: TitleExtra | null, review: string): InfoSlide {
  const base: InfoSlide = { id: uid(), kind, on: true, heading: KIND_LABEL[kind].toUpperCase(), body: '', bullets: [] };
  const w = r.world;
  if (kind === 'story') return { ...base, heading: 'THE STORY', body: sentences(w?.overview || r.overview || extra?.omdbPlot) };
  if (kind === 'highlights') return { ...base, bullets: genreLines(w?.genres || r.genres).slice(0, 3), auto: true };
  if (kind === 'take') return { ...base, heading: 'MY TAKE', body: review || extra?.oneLiner || '' };
  if (kind === 'where') {
    const where = w ? streamingIn(w).join(' • ') : r.cinema ? `In cinemas${r.releaseDate ? ` from ${fmtDate(r.releaseDate, { day: 'numeric', month: 'long' })}` : ''}` : [r.platform, r.releaseDate ? fmtDate(r.releaseDate, { weekday: 'short', day: 'numeric', month: 'long' }) : ''].filter(Boolean).join(' • ');
    return { ...base, body: where || 'Add where to watch', style: { valign: 'middle' } };
  }
  if (kind === 'end') return { ...base, heading: '', body: 'Save it for your watchlist!' };
  return { ...base, heading: 'YOUR HEADING', body: '' };
}

function load(domain: string, id: string): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(key(domain, id)) || 'null');
    return v && Array.isArray(v.order) && Array.isArray(v.slides) ? v : null;
  } catch {
    return null;
  }
}

/** This title's extra slides (saved in this browser per title). Shared by the editor's slide list and its preview. */
export function useTitleSlides(domainKind: string, id: string) {
  const [state, setState] = useState<Saved>(() => load(domainKind, id) || { order: [MAIN], slides: [], swipeHint: true, pages: false });
  useEffect(() => { try { localStorage.setItem(key(domainKind, id), JSON.stringify(state)); } catch {} }, [state, domainKind, id]);
  const active = state.order.filter(x => x === MAIN || state.slides.find(s => s.id === x)?.on);
  const move = (from: number, to: number) => setState(s => {
    const shown = s.order.filter(x => x === MAIN || s.slides.find(v => v.id === x)?.on);
    if (to < 0 || to >= shown.length) return s;
    const ids = [...shown];
    const [m] = ids.splice(from, 1);
    ids.splice(to, 0, m);
    let k = 0;
    return { ...s, order: s.order.map(x => (shown.includes(x) ? ids[k++] : x)) };
  });
  return { state, setState, active, move };
}

/** Draw one extra slide (full size, 1080×1350). */
export function TitleSlideNode({ slide, release, rating, image, theme, brand, page = '' }: {
  slide: InfoSlide; release: PostItem; extra?: TitleExtra | null; rating: number | null; image: string | null; theme: PostTheme; brand: SlideBrand; page?: string;
}) {
  return slide.kind === 'end'
    ? <OutroSlide brand={brand} line={slide.body || 'Save it for your watchlist!'} theme={theme} />
    : <InfoSlideView slide={slide} release={release} rating={rating} image={image} theme={theme} brand={brand} page={page} />;
}

export interface TitleSlidesApi {
  render: (renderMain: () => Promise<Blob>, reel?: boolean) => Promise<Blob[]>;
  count: number;
  swipeHint: boolean;
}

/**
 * Optional extra slides about ONE title. First time: Story · Highlights · My take (as few as possible). Every slide can be
 * shown/hidden, edited, restyled (sizes, position, alignment, background), moved or deleted; more can be added.
 */
export function TitleSlides({ domainKind, release, extra, rating, review, image, theme, brand, apiRef, state, setState, loadImages }: {
  /** pictures of this title (TMDB / official trailers / web) — to add as slides */
  loadImages?: (q?: string) => Promise<ImageResults>;
  domainKind: 'ott' | 'cinema' | 'world';
  state: TitleSlidesState;
  setState: React.Dispatch<React.SetStateAction<TitleSlidesState>>;
  release: PostItem;
  extra: TitleExtra | null;
  rating: number | null;
  review: string;
  image: string | null;
  theme: PostTheme;
  brand: SlideBrand;
  apiRef: React.MutableRefObject<TitleSlidesApi | null>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [reel, setReel] = useState(false);
  const [reviewLines, setReviewLines] = useState<string[] | null>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const active = state.order.filter(id => id === MAIN || state.slides.find(s => s.id === id)?.on);
  const extraCount = active.length - 1;
  const update = (id: string, patch: Partial<InfoSlide>) => setState(s => ({ ...s, slides: s.slides.map(x => (x.id === id ? { ...x, ...patch, auto: patch.auto ?? (patch.bullets ? false : x.auto) } : x)) }));
  const restyle = (id: string, patch: Partial<SlideStyle>) => setState(s => ({ ...s, slides: s.slides.map(x => (x.id === id ? { ...x, style: { ...x.style, ...patch } } : x)) }));

  /** What reviewers commonly say (from the critics search) → the Highlights slide, without names. */
  const findHighlights = async () => {
    try {
      const r = await extrasApi.critics(domainKind, release.id);
      const lines = (r.highlights || []).map(h => h.text);
      setReviewLines(lines);
      if (lines.length) setState(s => ({ ...s, slides: s.slides.map(x => (x.kind === 'highlights' && x.auto ? { ...x, bullets: lines.slice(0, 3), auto: false } : x)) }));
    } catch {
      setReviewLines([]);
    }
  };

  const add = (kinds: InfoKind[]) => {
    const made = kinds.map(k => defaults(k, release, extra, review));
    setState(s => ({ ...s, slides: [...s.slides, ...made], order: [...s.order, ...made.map(m => m.id)] }));
    if (kinds.includes('highlights') && reviewLines == null) void findHighlights();
  };
  const addPhotos = (picks: Array<{ url: string; label: string }>) => {
    const made = picks.map(p => newPhotoSlide(p.url, p.label));
    setState(s => ({ ...s, slides: [...s.slides, ...made], order: [...s.order, ...made.map(m => m.id)] }));
  };
  const photoPicker = picking && loadImages && (
    <PhotoPicker title={displayTitle(release)} load={loadImages} onSlides={state.slides.filter(x => x.kind === 'photo').map(x => x.image || '')}
      slotsLeft={Math.max(0, 10 - active.length)} onAdd={addPhotos} onClose={() => setPicking(false)} />
  );
  const remove = (id: string) => setState(s => ({ ...s, slides: s.slides.filter(x => x.id !== id), order: s.order.filter(x => x !== id) }));
  const move = (id: string, d: -1 | 1) => setState(s => {
    const o = [...s.order];
    const i = o.indexOf(id);
    const j = i + d;
    if (i < 0 || j < 0 || j >= o.length) return s;
    [o[i], o[j]] = [o[j], o[i]];
    return { ...s, order: o };
  });

  useEffect(() => {
    apiRef.current = {
      count: extraCount,
      swipeHint: state.swipeHint,
      render: async (renderMain, asReel = false) => {
        if (asReel) {
          setReel(true);
          await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 200))));
        }
        try {
          const opts = { width: SLIDE_W, height: SLIDE_H, pixelRatio: 1, includeQueryParams: true, quality: 0.95 };
          const out: Blob[] = [];
          for (const id of active) {
            if (id === MAIN) { out.push(await renderMain()); continue; }
            const node = refs.current[id];
            if (!node) continue;
            await toJpeg(node, opts).catch(() => null);
            out.push(await (await fetch(await toJpeg(node, opts))).blob());
          }
          return out;
        } finally {
          if (asReel) setReel(false);
        }
      },
    };
  });

  const pageOf = (id: string) => (state.pages && !reel ? `${active.indexOf(id) + 1}/${active.length}` : '');
  const S = 0.13;

  return (
    <div className="space-y-3">
      {state.slides.length === 0 ? (
        <div className="space-y-2 rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-400">
          <p>Make this a short carousel: the title picture (“swipe to know more →”), then <b>The story</b>, <b>Highlights</b> (what reviewers commonly say) and <b>My take</b>. Everything is optional — edit, restyle, move, hide or delete any slide, or add more.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => add(RECOMMENDED)} className="flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 font-semibold text-white"><Sparkles className="w-3.5 h-3.5" /> Add Story · Highlights · My take</button>
            {loadImages && <button onClick={() => setPicking(true)} className="flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 font-semibold text-slate-200"><ImagePlus className="w-3.5 h-3.5" /> Add pictures as slides</button>}
          </div>
          {photoPicker}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={state.swipeHint} onChange={e => setState(s => ({ ...s, swipeHint: e.target.checked }))} /> “Swipe to know more →” on the title picture</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={state.pages} onChange={e => setState(s => ({ ...s, pages: e.target.checked }))} /> Page numbers</label>
            <button onClick={() => { if (window.confirm('Remove all extra slides for this title?')) setState({ order: [MAIN], slides: [], swipeHint: true, pages: false }); }} className="ml-auto flex items-center gap-1 text-slate-500 hover:text-red-400"><RotateCcw className="w-3 h-3" /> Remove all</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {state.order.map((id, i) => {
              const s = state.slides.find(x => x.id === id);
              const on = id === MAIN || !!s?.on;
              return (
                <div key={id} className={`shrink-0 space-y-1 ${on ? '' : 'opacity-40'}`} style={{ width: SLIDE_W * S }}>
                  <div className={`relative overflow-hidden rounded-md border ${editing === id ? 'border-indigo-500' : 'border-slate-800'}`} style={{ width: SLIDE_W * S, height: SLIDE_H * S }}>
                    {id === MAIN ? (
                      <div className="flex h-full items-center justify-center bg-slate-800 p-2 text-center text-[10px] text-slate-300">Title picture</div>
                    ) : s && (
                      <button onClick={() => setEditing(e => (e === id ? null : id))} className="block text-left">
                        <div style={{ transform: `scale(${S})`, transformOrigin: 'top left', width: SLIDE_W, height: SLIDE_H }}>
                          <div ref={el => { refs.current[id] = el; }}>
                            <TitleSlideNode slide={s} release={release} rating={rating} image={image} theme={theme} brand={brand} page={pageOf(id)} />
                          </div>
                        </div>
                      </button>
                    )}
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] text-white">{i + 1}</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-[10px]">
                    <button onClick={() => move(id, -1)} disabled={i === 0} className="p-0.5 text-slate-400 disabled:opacity-30" title="Move left"><ArrowLeft className="w-3 h-3" /></button>
                    <button onClick={() => move(id, 1)} disabled={i === state.order.length - 1} className="p-0.5 text-slate-400 disabled:opacity-30" title="Move right"><ArrowRight className="w-3 h-3" /></button>
                    {s && <button onClick={() => update(id, { on: !s.on })} className="p-0.5 text-slate-400" title={s.on ? 'Hide this slide' : 'Show this slide'}>{s.on ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}</button>}
                    {s && <button onClick={() => { remove(id); if (editing === id) setEditing(null); }} className="ml-auto p-0.5 text-slate-500 hover:text-red-400" title="Delete"><Trash2 className="w-3 h-3" /></button>}
                  </div>
                  <div className="truncate text-[10px] text-slate-500">{id === MAIN ? 'Title picture' : KIND_LABEL[s!.kind]}</div>
                </div>
              );
            })}
          </div>

          {editing && (() => {
            const s = state.slides.find(x => x.id === editing);
            return s ? <InfoSlideEditor key={s.id} slide={s} release={release} rating={rating} domainKind={domainKind} loadImages={loadImages} onUpdate={p => update(s.id, p)} onRestyle={p => restyle(s.id, p)} onClose={() => setEditing(null)} /> : null;
          })()}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500">Add a slide:</span>
            {OFFERED.map(k => <button key={k} onClick={() => add([k])} className="rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-1 text-slate-300">+ {KIND_LABEL[k]}</button>)}
            {loadImages && <button onClick={() => setPicking(true)} className="flex items-center gap-1 rounded-md bg-indigo-700/60 hover:bg-indigo-600 px-2 py-1 text-white"><ImagePlus className="w-3 h-3" /> + Pictures</button>}
          </div>
          {photoPicker}
          <p className="text-[11px] text-slate-500">Click a slide to edit its text and look · ◀ ▶ move (the title picture too) · 👁 hide · 🗑 delete. Saved for this title. Instagram allows up to 10 slides.</p>
        </>
      )}
    </div>
  );
}

/** Edit one info slide: heading, text / points (with reviewer & genre ideas) and its look. Used by single posts and bulk carousels. */
export function InfoSlideEditor({ slide: s, release, rating, domainKind, onUpdate, onRestyle, onClose, loadImages }: {
  loadImages?: (q?: string) => Promise<ImageResults>;
  slide: InfoSlide;
  release: PostItem;
  rating: number | null;
  domainKind: 'ott' | 'cinema' | 'world';
  onUpdate: (patch: Partial<InfoSlide>) => void;
  onRestyle: (patch: Partial<SlideStyle>) => void;
  onClose: () => void;
}) {
  const [reviewLines, setReviewLines] = useState<string[] | null>(null);
  const [looking, setLooking] = useState(false);
  const [changing, setChanging] = useState(false);
  const findHighlights = async () => {
    setLooking(true);
    try {
      const r = await extrasApi.critics(domainKind, release.id);
      const lines = (r.highlights || []).map(h => h.text);
      setReviewLines(lines);
      if (lines.length && s.auto) onUpdate({ bullets: lines.slice(0, 3), auto: false });
    } catch {
      setReviewLines([]);
    } finally {
      setLooking(false);
    }
  };
  // a new Highlights slide fills itself with what reviewers commonly say (no names)
  useEffect(() => {
    if (s.kind !== 'highlights' || !s.auto) return;
    const t = setTimeout(findHighlights, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const update = (_id: string, patch: Partial<InfoSlide>) => onUpdate(patch);
  const restyle = (_id: string, patch: Partial<SlideStyle>) => onRestyle(patch);
  const sel = 'rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs';
  const seg = (on: boolean) => `px-2 py-0.5 rounded ${on ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`;
  const facts = factsOf(release);
  const genreIdeas = genreLines(release.world?.genres || release.genres);
  const st = styleOf(s);
  const hasBullets = s.kind === 'highlights' || s.kind === 'why' || s.kind === 'text';
  const hasBody = s.kind !== 'highlights' && s.kind !== 'why';
  const ideas = [...(reviewLines || []), ...genreIdeas, ...facts].filter((f, k, a) => a.indexOf(f) === k && !s.bullets.includes(f));
  return (
              <div className="space-y-2.5 rounded-lg border border-indigo-900/60 bg-indigo-950/20 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200">{KIND_LABEL[s.kind]}</span>
                  <button onClick={onClose} className="ml-auto p-0.5 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                {s.kind === 'photo' && (
                  <div className="flex items-center gap-2">
                    {s.image && <img src={proxied(s.image) || ''} alt="" className="h-14 w-11 rounded object-cover" />}
                    <span className="min-w-0 flex-1 truncate text-[11px] text-slate-400">{s.imageLabel || 'Picture'} · text on it is optional</span>
                    {loadImages && <button onClick={() => setChanging(true)} className="rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-1 text-slate-200">Change picture</button>}
                    {changing && loadImages && <PhotoPicker title={displayTitle(release)} load={loadImages} multi={false} onAdd={p => onUpdate({ image: p[0].url, imageLabel: p[0].label })} onClose={() => setChanging(false)} />}
                  </div>
                )}
                {s.kind !== 'end' && <input value={s.heading} onChange={e => update(s.id, { heading: e.target.value })} maxLength={40} className={`${sel} w-full`} placeholder="Heading (leave empty to hide)" />}
                {hasBody && (
                  <textarea value={s.body} onChange={e => update(s.id, { body: e.target.value })} rows={s.kind === 'story' || s.kind === 'take' || s.kind === 'text' ? 5 : s.kind === 'photo' ? 3 : 2} maxLength={700}
                    className="w-full rounded-md bg-slate-950 border border-slate-700 p-2" placeholder={s.kind === 'take' ? 'Your own view of the film — in your words (or Tamil / Tanglish)' : s.kind === 'end' ? 'Line on the follow slide' : s.kind === 'photo' ? 'Optional text on the picture (a dialogue, a fact, “Interval block 🔥” …)' : 'Text'} />
                )}
                {s.kind === 'take' && <p className="flex items-center gap-1 text-[11px] text-fuchsia-300"><Mic className="w-3 h-3" /> Want to say it instead? Use <b>Make Reel → Add your voice &amp; face</b> — your voice plays over these slides.</p>}
                {hasBullets && (
                  <div className="space-y-1">
                    {s.bullets.map((b, k) => (
                      <div key={k} className="flex items-center gap-1.5">
                        <span className="text-slate-500">•</span>
                        <input value={b} onChange={e => update(s.id, { bullets: s.bullets.map((x, n) => (n === k ? e.target.value : x)) })} maxLength={120} className={`${sel} flex-1`} />
                        <button onClick={() => update(s.id, { bullets: s.bullets.filter((_, n) => n !== k) })} className="p-0.5 text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                    {s.bullets.length < 6 && <button onClick={() => update(s.id, { bullets: [...s.bullets, ''] })} className="flex items-center gap-1 text-indigo-300 hover:text-white"><Plus className="w-3 h-3" /> Add a point</button>}
                    {s.kind === 'highlights' && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {looking ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Reading what reviewers say…</span>
                          : reviewLines == null ? <button onClick={findHighlights} className="text-sky-300 hover:text-white">Find what reviewers say</button>
                            : <span>{reviewLines.length ? `${reviewLines.length} lines reviewers commonly use (no names)` : 'No reviews found — using common lines for the genre.'}</span>}
                      </div>
                    )}
                    {ideas.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        <span className="text-slate-500">Ideas:</span>
                        {ideas.slice(0, 14).map(f => (
                          <button key={f} disabled={s.bullets.length >= 6} onClick={() => update(s.id, { bullets: [...s.bullets, f] })} className="rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 px-2 py-0.5 text-slate-300">{f}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {s.kind !== 'end' && (
                  <div className="space-y-1.5 rounded-md border border-slate-800 bg-slate-950/50 p-2">
                    <div className="font-semibold text-slate-400">Look of this slide</div>
                    <label className="grid grid-cols-[84px_1fr_40px] items-center gap-2">Heading size<input type="range" min={50} max={160} step={5} value={st.headSize} onChange={e => restyle(s.id, { headSize: +e.target.value })} /><span className="text-right">{st.headSize}%</span></label>
                    <label className="grid grid-cols-[84px_1fr_40px] items-center gap-2">Text size<input type="range" min={50} max={170} step={5} value={st.bodySize} onChange={e => restyle(s.id, { bodySize: +e.target.value })} /><span className="text-right">{st.bodySize}%</span></label>
                    <label className="grid grid-cols-[84px_1fr_40px] items-center gap-2">Move up/down<input type="range" min={-300} max={300} step={10} value={st.y} onChange={e => restyle(s.id, { y: +e.target.value })} /><span className="text-right">{st.y}</span></label>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="w-[84px]">Position</span>
                      {(['top', 'middle', 'bottom'] as const).map(v => <button key={v} onClick={() => restyle(s.id, { valign: v })} className={seg(st.valign === v)}>{v}</button>)}
                      <span className="ml-2">Align</span>
                      {(['left', 'center'] as const).map(v => <button key={v} onClick={() => restyle(s.id, { align: v })} className={seg(st.align === v)}>{v}</button>)}
                    </div>
                    {s.kind === 'photo' ? (
                      <>
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="w-[84px]">Picture</span>
                          {([['fill', 'Fill the slide'], ['fit', 'Whole picture']] as const).map(([v, l]) => <button key={v} onClick={() => restyle(s.id, { fit: v })} className={seg(st.fit === v)}>{l}</button>)}
                        </div>
                        <label className="grid grid-cols-[84px_1fr_40px] items-center gap-2">Darken<input type="range" min={0} max={80} step={5} value={st.shade} onChange={e => restyle(s.id, { shade: +e.target.value })} /><span className="text-right">{st.shade}%</span></label>
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="w-[84px]">Background</span>
                        {([['blur', 'Blurred picture'], ['clear', 'Clear picture'], ['plain', 'Plain theme']] as const).map(([v, l]) => <button key={v} onClick={() => restyle(s.id, { bg: v })} className={seg(st.bg === v)}>{l}</button>)}
                      </div>
                    )}
                    {hasBullets && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="w-[84px]">Bullets</span>
                        {(['▸', '✓', '•', 'none'] as const).map(v => <button key={v} onClick={() => restyle(s.id, { bullet: v })} className={seg(st.bullet === v)}>{v}</button>)}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-1.5"><input type="checkbox" checked={st.header} onChange={e => restyle(s.id, { header: e.target.checked })} /> Title &amp; poster at the top</label>
                      {(s.kind === 'take' || s.kind === 'review') && <label className="flex items-center gap-1.5"><input type="checkbox" checked={st.stars} onChange={e => restyle(s.id, { stars: e.target.checked })} /> My stars{rating == null ? ' (rate it in section 4)' : ''}</label>}
                      <button onClick={() => update(s.id, { style: {} })} className="ml-auto text-slate-500 hover:text-white">Reset look</button>
                    </div>
                  </div>
                )}
              </div>
  );
}

/** One info slide (1080×1350). Everything on it follows the slide's own look settings. */
function InfoSlideView({ slide, release, rating, image, theme: t, brand, page }: {
  slide: InfoSlide; release: PostItem; rating: number | null; image: string | null; theme: PostTheme; brand: SlideBrand; page: string;
}) {
  const st = styleOf(slide);
  const photo = slide.kind === 'photo';
  const pic = proxied((photo && slide.image) || image || posterUrl(release.posterPath, 'w780'));
  const thumb = proxied(posterUrl(release.posterPath, 'w342') || image);
  const text = slide.body.trim();
  const bullets = slide.bullets.filter(b => b.trim());
  const k = st.bodySize / 100;
  const auto = (n: number) => (n > 500 ? 34 : n > 380 ? 38 : n > 260 ? 44 : n > 150 ? 50 : 56);
  const year = release.world?.year || (release.releaseDate ? release.releaseDate.slice(0, 4) : '');
  const center = st.align === 'center';
  const top = st.header ? 270 : 110;
  const showStars = (slide.kind === 'take' || slide.kind === 'review') && st.stars && rating != null;
  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, position: 'relative', overflow: 'hidden', background: photo ? '#000' : frameBackground(t), color: photo ? '#fff' : t.text, textShadow: photo ? '0 2px 14px rgba(0,0,0,0.7)' : undefined, fontFamily: `${t.bodyFont}, var(--font-tamil)` }}>
      {photo && pic && (
        <>
          {st.fit === 'fit' && <img src={pic} alt="" style={{ position: 'absolute', inset: -60, width: SLIDE_W + 120, height: SLIDE_H + 120, objectFit: 'cover', filter: 'blur(40px) brightness(0.45)' }} />}
          <img src={pic} alt="" style={{ position: 'absolute', inset: 0, width: SLIDE_W, height: SLIDE_H, objectFit: st.fit === 'fit' ? 'contain' : 'cover' }} />
          {(st.shade > 0 || text || slide.heading) && (
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(0,0,0,${st.shade / 200}) 0%, rgba(0,0,0,${st.shade / 100}) 45%, rgba(0,0,0,${Math.min(0.85, st.shade / 100 + (text || slide.heading ? 0.45 : 0.15))}) 100%)` }} />
          )}
        </>
      )}
      {!photo && pic && st.bg === 'blur' && <img src={pic} alt="" style={{ position: 'absolute', inset: -60, width: SLIDE_W + 120, height: SLIDE_H + 120, objectFit: 'cover', filter: 'blur(36px) brightness(0.32) saturate(1.2)' }} />}
      {!photo && pic && st.bg === 'clear' && <img src={pic} alt="" style={{ position: 'absolute', inset: 0, width: SLIDE_W, height: SLIDE_H, objectFit: 'cover', filter: 'brightness(0.42)' }} />}
      {!photo && st.bg !== 'plain' && <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${t.bg[0]}88, ${t.bg[1]}dd)` }} />}
      {!photo && textureLayers(t).map((s, i) => <div key={i} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...s }} />)}
      {st.header && (
        <div style={{ position: 'absolute', left: 72, right: 72, top: 64, display: 'flex', alignItems: 'center', gap: 24, justifyContent: center ? 'center' : 'flex-start' }}>
          {thumb && <img src={thumb} alt="" style={{ width: 92, height: 138, objectFit: 'cover', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ ...titleStyle(t, 44), lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 760 }}>{displayTitle(release)}</div>
            {year && <div style={{ fontSize: 26, opacity: 0.7, marginTop: 6 }}>{year}</div>}
          </div>
        </div>
      )}
      <div style={{
        position: 'absolute', left: 72, right: 72, top, bottom: 140, display: 'flex', flexDirection: 'column', gap: 34,
        justifyContent: st.valign === 'middle' ? 'center' : st.valign === 'bottom' ? 'flex-end' : 'flex-start',
        alignItems: center ? 'center' : 'flex-start', textAlign: center ? 'center' : 'left', transform: st.y ? `translateY(${st.y}px)` : undefined,
      }}>
        {slide.heading && (
          <div>
            <div style={{ ...titleStyle(t, 72 * (st.headSize / 100)), lineHeight: 1.02 }}>{slide.heading}</div>
            <div style={{ width: 120, height: 8, borderRadius: 4, background: t.accent, marginTop: 22, marginLeft: center ? 'auto' : 0, marginRight: center ? 'auto' : 0 }} />
          </div>
        )}
        {showStars && <div style={{ fontSize: 64 * k, color: t.accent, letterSpacing: 6 }}>{'★'.repeat(Math.floor(rating!))}{rating! % 1 ? '½' : ''} <span style={{ fontSize: 44 * k, color: t.text }}>{rating}/5</span></div>}
        {text && <div style={{ fontSize: (slide.kind === 'where' ? 52 : auto(text.length)) * k, lineHeight: 1.38, fontWeight: slide.kind === 'where' ? 800 : 500, opacity: 0.95, whiteSpace: 'pre-wrap' }}>{text}</div>}
        {bullets.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 * k, alignItems: center ? 'center' : 'stretch' }}>
            {bullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 22, fontSize: (bullets.length > 4 ? 40 : 48) * k, lineHeight: 1.3, fontWeight: 600 }}>
                {st.bullet !== 'none' && <span style={{ color: t.accent, fontWeight: 900 }}>{st.bullet}</span>}<span>{b}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', left: 72, right: 72, bottom: 56, display: 'flex', justifyContent: 'space-between', fontSize: 30, fontWeight: 700 }}>
        <span style={{ color: t.accent }}>{brand.handle}</span>
        <span style={{ opacity: 0.6 }}>{page}</span>
      </div>
    </div>
  );
}
