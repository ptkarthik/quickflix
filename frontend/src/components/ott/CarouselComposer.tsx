'use client';
import { createPortal } from 'react-dom';
import React, { useEffect, useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';
import { Check, ChevronDown, Clapperboard, ChevronUp, Copy, Download, Eye, LayoutTemplate, Loader2, MessageSquareQuote, RotateCcw, X, SlidersHorizontal } from 'lucide-react';
import { usePostLook, DEFAULT_ADJUST, PostLook, SlideAdjust } from '@/lib/postLook';
import { LookPanel } from './PostLayout';
import { ExtrasMap, TitleExtra, extrasApi, ratingChips, withOneLiners } from '@/lib/extras';
import { ExtrasPanel } from './ExtrasPanel';
import { AiCaptionCopy, displayTitle, posterUrl, proxiedPoster } from '@/lib/ott';
import type { PostDomain, PostItem } from '@/lib/postDomain';
import { CoverSlide, ImageSlide, OutroSlide, SLIDE_H, SLIDE_W, SlideBrand, TitleSlide } from './OttSlides';
import { InstagramPublish } from './InstagramPublish';
import { ReelMaker } from './ReelMaker';
import { trailerTitleOf } from './YouTubeMarker';
import { FacebookPhotoPublish } from './SocialPublish';
import { InstagramPreview, PicturePicker, SlideStrip, SlideView } from './CarouselTools';
import { AiCaptionBar } from './AiCaptionBar';
import { ThemePicker } from './ThemePicker';
import { DEFAULT_CHOICE, PostTheme, THEME_PRESETS, ThemeChoice, resolveTheme } from '@/lib/themes';
import { THEME_CATEGORIES, THEME_LIBRARY } from '@/lib/themeLibrary';
import { useCustomThemes, usePalettes } from '@/lib/useThemes';

/** Your own slide: uploaded thumbnail / AI poster / web picture / a post made in the editor. */
export interface CustomSlide {
  id: string;
  src: string;
  label: string;
  fit: 'cover' | 'contain';
  text: string;
  /** Finished design (from the editor) — shown exactly, without the handle/page footer. */
  bare: boolean;
}

export const newCustomSlide = (src: string, label: string, bare = false): CustomSlide => ({ id: crypto.randomUUID(), src, label, fit: 'cover', text: '', bare });

/** Keep your arrangement; new slides go before the end slide, a re-enabled cover goes first. */
function mergeOrder(order: string[], all: string[]): string[] {
  const valid = new Set(all);
  const out = order.filter(k => valid.has(k));
  for (const k of all) {
    if (out.includes(k)) continue;
    const outro = out.indexOf('outro');
    if (k === 'cover') out.unshift(k);
    else if (k !== 'outro' && outro >= 0) out.splice(outro, 0, k);
    else out.push(k);
  }
  return out;
}

const MAX_SLIDES = 20; // Instagram carousel limit (app)
const API_MAX_SLIDES = 10; // Instagram posting API carousel limit
const PREVIEW_SCALE = 0.26;

export interface TitleSlideExtras {
  rank?: number;
  note?: string;
  dateLine?: string;
  prevDateLine?: string;
  badge?: string;
  metaLine?: string;
  ratingText?: string;
}

/**
 * The carousel half of a post: slide strip (drag to arrange, change pictures, add your own slides),
 * per-slide themes, Instagram preview, JPEG download, one-click posting and the caption.
 * The desk (OTT / cinema) supplies the titles, the wording and the caption template.
 */
export function CarouselComposer({
  domain, items, pool, brand, controlsTop, controls, cover, outroLine, titleExtras,
  includeOutro, setIncludeOutro, hideCover, setHideCover, customSlides, setCustomSlides,
  captionTemplate, aiRequest, captionKey, publishKind, slug, onRemoveItem, emptyHint,
}: {
  domain: PostDomain;
  /** Titles on this post (in selection order). */
  items: PostItem[];
  /** Titles whose pictures can be used for your own slides. */
  pool: PostItem[];
  brand: SlideBrand;
  controlsTop: React.ReactNode;
  controls: React.ReactNode;
  cover: { kicker: string; heading: string; subheading: string };
  outroLine: string;
  titleExtras: (r: PostItem, rank: number) => TitleSlideExtras;
  includeOutro: boolean;
  setIncludeOutro: (v: boolean) => void;
  hideCover: boolean;
  setHideCover: (v: boolean) => void;
  customSlides: CustomSlide[];
  setCustomSlides: React.Dispatch<React.SetStateAction<CustomSlide[]>>;
  /** Caption from the template, given the titles in your slide order and the optional AI lines. */
  captionTemplate: (ordered: PostItem[], ai: AiCaptionCopy | null) => string;
  aiRequest: (ordered: PostItem[], tone: string, language: string) => Promise<AiCaptionCopy>;
  /** When this changes (e.g. you switch post type), the caption goes back to the template. */
  captionKey: string;
  publishKind: string;
  slug: string;
  onRemoveItem: (id: string) => void;
  emptyHint: string;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, { url: string; label: string }>>({});
  const [picker, setPicker] = useState<null | { kind: 'title'; releaseId: string } | { kind: 'custom'; id: string } | { kind: 'new' }>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(DEFAULT_CHOICE);
  /** Per-slide theme override: slide key → theme base id ('auto' | preset | custom). */
  const [slideThemes, setSlideThemes] = useState<Record<string, string>>({});
  /** Per-slide picture fit for title slides: poster card (default) / fill the slide / fit the whole picture. */
  const [slideFit, setSlideFit] = useState<Record<string, 'card' | 'full' | 'fit'>>({});
  /** Per-slide fine-tuning + optional own layout (what's shown / where) for one slide. */
  const [slideAdjust, setSlideAdjust] = useState<Record<string, SlideAdjust>>({});
  const [slideLooks, setSlideLooks] = useState<Record<string, PostLook>>({});
  const [adjustFor, setAdjustFor] = useState<string | null>(null);
  const setAdj = (key: string, patch: Partial<SlideAdjust>) => setSlideAdjust(m => ({ ...m, [key]: { ...(m[key] || DEFAULT_ADJUST), ...patch } }));
  const [customThemes, addCustomTheme] = useCustomThemes();
  // One-liners & ratings per title (shared with the single editor on every desk)
  const [extras, setExtras] = useState<ExtrasMap>({});
  const [extrasFor, setExtrasFor] = useState<string | null>(null);
  const itemIds = items.map(r => r.id).join(',');
  useEffect(() => {
    if (!itemIds) return;
    let stop = false;
    extrasApi.batch(domain.kind, itemIds.split(',')).then(m => { if (!stop) setExtras(prev => ({ ...prev, ...m })); }, () => null);
    return () => { stop = true; };
  }, [domain.kind, itemIds]);
  const setExtra = (e: TitleExtra) => setExtras(m => ({ ...m, [e.refId]: e }));
  // What's on each title slide (your layout for this desk's carousels, remembered)
  const { look, setLook, reset: resetLook, copyToAllDesks } = usePostLook(domain.kind, 'slide');
  const [lookOpen, setLookOpen] = useState(false);
  const [reelOpen, setReelOpen] = useState(false);
  /** true only while the Reel's pictures are being drawn */
  const [reelMode, setReelMode] = useState(false);
  /** Page numbers on slides: titles only (matches the rank badges), all slides, or none — remembered. */
  const [pageMode, setPageMode] = useState<'titles' | 'all' | 'off'>(() => {
    try {
      const v = localStorage.getItem('carousel.pageMode');
      return v === 'all' || v === 'off' ? v : 'titles';
    } catch {
      return 'titles';
    }
  });
  const changePageMode = (m: 'titles' | 'all' | 'off') => {
    setPageMode(m);
    try { localStorage.setItem('carousel.pageMode', m); } catch {}
  };

  const allKeys = [
    ...(hideCover ? [] : ['cover']),
    ...items.map(r => `t:${r.id}`),
    ...customSlides.map(c => `c:${c.id}`),
    ...(includeOutro ? ['outro'] : []),
  ];
  const keys = mergeOrder(order, allKeys);
  // Titles in the order you arranged them — drives ranks, the cover and the caption.
  const slideItems = keys.filter(k => k.startsWith('t:')).map(k => items.find(r => `t:${r.id}` === k)).filter(Boolean) as PostItem[];
  const withPicture = (r: PostItem): PostItem => (overrides[r.id] ? { ...r, posterPath: overrides[r.id].url } : r);

  const moveSlide = (from: number, to: number) => {
    if (to < 0 || to >= keys.length || from === to) return;
    const next = [...keys];
    const [k] = next.splice(from, 1);
    next.splice(to, 0, k);
    setOrder(next);
  };
  const removeSlide = (key: string) => {
    if (key === 'cover') setHideCover(true);
    else if (key === 'outro') setIncludeOutro(false);
    else if (key.startsWith('c:')) setCustomSlides(cs => cs.filter(c => `c:${c.id}` !== key));
    else if (key.startsWith('t:')) onRemoveItem(key.slice(2));
  };
  const updateCustom = (id: string, patch: Partial<CustomSlide>) => setCustomSlides(cs => cs.map(c => (c.id === id ? { ...c, ...patch } : c)));
  const addCustom = (src: string, label: string) => setCustomSlides(cs => [...cs, newCustomSlide(src, label)]);

  // Caption follows the template until you edit it; "Reset to template" goes back to following it.
  const [aiCopy, setAiCopy] = useState<AiCaptionCopy | null>(null);
  const [editedCaption, setEditedCaption] = useState<string | null>(null);
  const [seenKey, setSeenKey] = useState(captionKey);
  if (seenKey !== captionKey) {
    setSeenKey(captionKey);
    setEditedCaption(null);
    setAiCopy(null);
  }
  // Your chosen one-liners become each title's line in the caption (your own note on the post still wins).
  const template = captionTemplate(slideItems, withOneLiners(aiCopy, extras));
  const caption = editedCaption ?? template;
  const captionEdited = editedCaption !== null;

  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [exporting, setExporting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const totalSlides = keys.length;

  // ── themes: Auto = every title slide follows its own film (genre + poster colours); cover/end follow the first film ──
  const posterOf = (r: PostItem) => proxiedPoster(withPicture(r).posterPath, 'w500');
  const palettes = usePalettes(slideItems.map(posterOf));
  const themeForItem = (r: PostItem | undefined, choice: ThemeChoice) =>
    resolveTheme(choice, { genres: r?.genres, overview: r?.overview, palette: r ? palettes[posterOf(r) || ''] ?? null : null, brandAccent: brand.accent, customThemes });
  const leadItem = slideItems[0];
  const themeOf = (key: string): PostTheme => {
    const own = slideThemes[key];
    const choice = own ? { ...themeChoice, base: own } : themeChoice;
    const r = key.startsWith('t:') ? slideItems.find(x => `t:${x.id}` === key) : leadItem;
    return themeForItem(r, choice);
  };
  const postTheme = themeForItem(leadItem, themeChoice);

  // Reels reuse these slides, but "Swipe for all N →", page numbers (2/5) and "swipe" wording are carousel-only.
  const noSwipe = (s: string) => s.replace(/^\s*swipe (for|through)\s*(all\s*)?/i, '').replace(/\s*→\s*$/, '').replace(/\bin \d+ slides\b/i, '').trim();
  const slideViews: SlideView[] = keys.map((k, i) => {
    // Worked out from the current order every render, so moving / adding / removing slides renumbers at once.
    const titleKeys = keys.filter(x => x.startsWith('t:'));
    const page = reelMode || pageMode === 'off' ? ''
      : pageMode === 'all' ? `${i + 1}/${keys.length}`
      : k.startsWith('t:') ? `${titleKeys.indexOf(k) + 1}/${titleKeys.length}` : '';
    const theme = themeOf(k);
    if (k === 'cover') {
      return {
        key: k, kind: 'cover', label: 'Cover',
        node: <CoverSlide kicker={reelMode ? noSwipe(cover.kicker) : cover.kicker} heading={reelMode ? noSwipe(cover.heading) || cover.heading : cover.heading} subheading={reelMode && /^swipe/i.test(cover.subheading) ? '' : cover.subheading} items={slideItems.map(withPicture)} brand={brand} total={slideItems.length} theme={theme} swipe={!reelMode} />,
      };
    }
    if (k === 'outro') return { key: k, kind: 'outro', label: 'Follow slide', node: <OutroSlide brand={brand} line={outroLine} theme={theme} /> };
    if (k.startsWith('c:')) {
      const c = customSlides.find(x => `c:${x.id}` === k)!;
      return { key: k, kind: 'custom', label: c.label, node: <ImageSlide src={c.src} fit={c.fit} text={c.text} brand={brand} page={page} bare={c.bare} theme={theme} /> };
    }
    const r = slideItems.find(x => `t:${x.id}` === k)!;
    const props = titleExtras(r, slideItems.indexOf(r) + 1);
    const chips = ratingChips(r, extras[r.id]);
    return {
      key: k, kind: 'title', label: displayTitle(r),
      node: <TitleSlide item={withPicture(r)} brand={brand} page={page} theme={theme} {...props} oneLiner={extras[r.id]?.oneLiner} ratingChips={chips.length ? chips : undefined} look={slideLooks[k] || look} layout={slideFit[k] || 'card'} adjust={slideAdjust[k]} />,
    };
  });

  const renderOpts = { width: SLIDE_W, height: SLIDE_H, pixelRatio: 1, includeQueryParams: true };
  /** All slides as JPEG blobs, in order (for one-click posting). */
  const renderAll = async (): Promise<Blob[]> => {
    const nodes = slideRefs.current.slice(0, totalSlides).filter(Boolean) as HTMLDivElement[];
    if (nodes[0]) await toJpeg(nodes[0], renderOpts).catch(() => null); // warm-up
    const out: Blob[] = [];
    for (const n of nodes) out.push(await (await fetch(await toJpeg(n, { ...renderOpts, quality: 0.95 }))).blob());
    return out;
  };

  /** The slides for a Reel: same design, without the carousel-only swipe hint and page numbers. */
  const renderForReel = async (): Promise<Blob[]> => {
    setReelMode(true);
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250))));
    try {
      return await renderAll();
    } finally {
      setReelMode(false);
    }
  };

  const exportAll = async () => {
    setExporting('Preparing…');
    try {
      const nodes = slideRefs.current.slice(0, totalSlides).filter(Boolean) as HTMLDivElement[];
      // includeQueryParams is essential: every poster goes through /api/proxy-image?url=…, and by default
      // html-to-image caches by URL *without* the query string — which put one film's poster on every slide.
      if (nodes[0]) await toJpeg(nodes[0], renderOpts).catch(() => null); // warm-up: first render sometimes drops images
      for (let i = 0; i < nodes.length; i++) {
        setExporting(`Exporting ${i + 1}/${nodes.length}…`);
        const dataUrl = await toJpeg(nodes[i], { ...renderOpts, quality: 0.95 });
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${slug}-${String(i + 1).padStart(2, '0')}.jpg`;
        a.click();
        await new Promise(r => setTimeout(r, 350)); // let the browser handle each download
      }
      setExporting(null);
    } catch (err) {
      setExporting(null);
      alert(`Export failed: ${(err as Error)?.message || err}`);
    }
  };

  const copyCaption = async () => {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
      {/* ── controls ── */}
      <div className="space-y-5">
        {controlsTop}
        <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <ThemePicker value={themeChoice} onChange={setThemeChoice} resolved={postTheme} customThemes={customThemes} onSaveCustom={addCustomTheme} title="Theme"
            note={themeChoice.base === 'auto' ? 'Auto: each title slide follows its own film (genre + poster colours); cover & end slide follow the first film. Override any slide below it.' : 'One theme for every slide — override any slide below it.'} />
        </section>
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <button onClick={() => setLookOpen(o => !o)} className="w-full flex items-center justify-between text-left">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><LayoutTemplate className="w-4 h-4" /> What’s on each title slide</span>
            {lookOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>
          {lookOpen && (
            <LookPanel look={look} onChange={setLook} onReset={resetLook} onCopyAll={copyToAllDesks} surface="slide"
              note={<p className="text-[11px] text-slate-500">Applies to every title slide in this carousel (and future ones on this desk). Show / hide (👁), move onto the picture or below it, resize, reorder, add your own text or labels.</p>} />
          )}
        </section>
        {controls}
        {totalSlides > MAX_SLIDES && <p className="text-xs text-amber-400">Instagram allows {MAX_SLIDES} slides; you have {totalSlides}. Remove some before posting.</p>}
      </div>

      {/* ── preview + export ── */}
      {/* slides stay on screen while you scroll the controls */}
      <div className="space-y-5 min-w-0 xl:sticky xl:top-0 xl:self-start xl:max-h-[calc(100vh-11rem)] xl:overflow-y-auto xl:pr-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-400">{totalSlides} slides • 1080×1350 (Instagram feed 4:5)</div>
          <div className="flex gap-2">
            <button onClick={() => setPreviewOpen(true)} disabled={totalSlides === 0}
              className="flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-4 py-2 text-sm font-semibold">
              <Eye className="w-4 h-4" /> Preview on Instagram
            </button>
            <button onClick={() => setReelOpen(true)} disabled={!!exporting || totalSlides === 0} title="Turn these slides into an Instagram Reel (video, optional music)"
              className="flex items-center gap-2 rounded-lg bg-pink-600 hover:bg-pink-700 disabled:opacity-50 px-4 py-2 text-sm font-semibold">
              <Clapperboard className="w-4 h-4" /> Make Reel
            </button>
            <button onClick={exportAll} disabled={!!exporting || totalSlides === 0}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 text-sm font-semibold">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting || `Download ${totalSlides} JPEGs`}
            </button>
          </div>
        </div>
        {totalSlides > 0 && (
          <div className="space-y-2">
          <InstagramPublish
            renderImages={renderAll}
            caption={caption}
            kind={publishKind}
            disabledReason={
              totalSlides > API_MAX_SLIDES
                ? `Instagram's posting API allows ${API_MAX_SLIDES} slides per carousel; this one has ${totalSlides}. Untick some titles (or the end slide), or download and post from your phone.`
                : caption.length > 2200 ? 'Caption is longer than 2200 characters.' : null
            }
          />
          <FacebookPhotoPublish
            renderImages={renderAll}
            caption={caption}
            kind={publishKind}
            disabledReason={
              totalSlides > API_MAX_SLIDES
                ? `Facebook posts here take up to ${API_MAX_SLIDES} photos; this one has ${totalSlides}. Untick some titles (or the end slide).`
                : caption.length > 2200 ? 'Caption is longer than 2200 characters.' : null
            }
          />
          </div>
        )}

        {slideItems.length === 0 && customSlides.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">{emptyHint}</div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1 text-xs text-slate-500">Drag slides (or use ◀ ▶) to arrange them. “Picture” changes a slide’s image for this post only.</p>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">Page numbers
            <select value={pageMode} onChange={e => changePageMode(e.target.value as 'titles' | 'all' | 'off')} className="rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs text-slate-200">
              <option value="titles">Titles only (1/{slideItems.length || 'n'}) — matches ranks</option>
              <option value="all">All slides ({keys.length ? `2/${keys.length}` : '2/n'})</option>
              <option value="off">Off</option>
            </select>
          </label>
        </div>
        <SlideStrip
          restore={[
            ...(hideCover ? [{ label: 'cover slide', onClick: () => setHideCover(false) }] : []),
            ...(!includeOutro ? [{ label: '“Follow” end slide', onClick: () => setIncludeOutro(true) }] : []),
          ]}
          slides={slideViews}
          scale={PREVIEW_SCALE}
          onMove={moveSlide}
          onRemove={removeSlide}
          onAdd={() => setPicker({ kind: 'new' })}
          onPicture={key => setPicker(key.startsWith('t:') ? { kind: 'title', releaseId: key.slice(2) } : { kind: 'custom', id: key.slice(2) })}
          slideRef={(i, el) => { slideRefs.current[i] = el; }}
          extra={s => {
            const themeSelect = (
              <select value={slideThemes[s.key] || ''} title="Theme for this slide"
                onChange={e => setSlideThemes(m => { const n = { ...m }; if (e.target.value) n[s.key] = e.target.value; else delete n[s.key]; return n; })}
                className="w-full rounded bg-slate-950 border border-slate-700 px-1.5 py-1 text-[11px]" style={{ width: SLIDE_W * PREVIEW_SCALE }}>
                <option value="">🎨 Post theme ({themeOf(s.key).name})</option>
                <option value="auto">Auto (this film&apos;s genre)</option>
                <optgroup label="Classic">{THEME_PRESETS.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}</optgroup>
                {customThemes.length > 0 && <optgroup label="My themes">{customThemes.map(t => <option key={t.id} value={t.id}>✨ {t.name}</option>)}</optgroup>}
                {THEME_CATEGORIES.map(c => (
                  <optgroup key={c} label={c}>{THEME_LIBRARY.filter(t => t.category === c).map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}</optgroup>
                ))}
              </select>
            );
            if (s.kind === 'title') {
              const id = s.key.slice(2);
              const e = extras[id];
              return (
                <div className="space-y-1" style={{ width: SLIDE_W * PREVIEW_SCALE }}>
                  {themeSelect}
                  <div className="flex gap-1 text-[11px]">
                    {([['card', 'Poster'], ['full', 'Fill'], ['fit', 'Fit whole']] as const).map(([f, label]) => (
                      <button key={f} onClick={() => setSlideFit(m => ({ ...m, [s.key]: f }))}
                        title={f === 'card' ? 'Poster in a frame' : f === 'full' ? 'Picture fills the whole slide (edges cropped)' : 'Whole picture, nothing cropped (blurred edges)'}
                        className={`flex-1 rounded px-1.5 py-0.5 ${(slideFit[s.key] || 'card') === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{label}</button>
                    ))}
                  </div>
                  <button onClick={() => setAdjustFor(a => (a === s.key ? null : s.key))}
                    className={`w-full flex items-center justify-center gap-1 rounded px-1.5 py-1 text-[11px] ${adjustFor === s.key ? 'bg-indigo-600 text-white' : slideAdjust[s.key] || slideLooks[s.key] ? 'bg-amber-700/40 text-amber-100' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                    <SlidersHorizontal className="w-3 h-3" /> {slideAdjust[s.key] || slideLooks[s.key] ? 'Adjusted — edit' : 'Adjust this slide'}
                  </button>
                  <button onClick={() => setExtrasFor(id)} title={e?.oneLiner || 'Add a one-liner and choose ratings'}
                    className={`w-full flex items-center justify-center gap-1 rounded px-1.5 py-1 text-[11px] ${e?.oneLiner ? 'bg-sky-700/40 text-sky-100' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                    <MessageSquareQuote className="w-3 h-3" /> {e?.oneLiner ? 'Edit one-liner & ratings' : 'One-liner & ratings'}
                  </button>
                </div>
              );
            }
            if (s.kind !== 'custom') return themeSelect;
            const c = customSlides.find(x => `c:${x.id}` === s.key);
            if (!c) return themeSelect;
            return (
              <div className="space-y-1 text-[11px]" style={{ width: SLIDE_W * PREVIEW_SCALE }}>
                {themeSelect}
                <div className="flex gap-1">
                  {(['cover', 'contain'] as const).map(f => (
                    <button key={f} onClick={() => updateCustom(c.id, { fit: f })}
                      className={`flex-1 rounded px-1.5 py-0.5 ${c.fit === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{f === 'cover' ? 'Fill' : 'Fit whole'}</button>
                  ))}
                </div>
                <input value={c.text} onChange={e => updateCustom(c.id, { text: e.target.value })} maxLength={60}
                  className="w-full rounded bg-slate-950 border border-slate-700 px-1.5 py-1" placeholder="Text on slide (optional)" />
                <label className="flex items-center gap-1 text-slate-400"><input type="checkbox" checked={!c.bare} onChange={e => updateCustom(c.id, { bare: !e.target.checked })} /> Show handle & page</label>
              </div>
            );
          }}
        />

        {adjustFor && (() => {
          const view = slideViews.find(v => v.key === adjustFor);
          if (!view) return null;
          const a = slideAdjust[adjustFor] || DEFAULT_ADJUST;
          const fit = slideFit[adjustFor] || 'card';
          const titleKeys = slideViews.filter(v => v.kind === 'title').map(v => v.key);
          const slider = (label: string, k: keyof SlideAdjust, min: number, max: number, step: number, fmt: (v: number) => string) => (
            <label className="grid grid-cols-[92px_1fr_44px] items-center gap-2 text-xs">
              <span className="text-slate-400">{label}</span>
              <input type="range" min={min} max={max} step={step} value={a[k]} onChange={e => setAdj(adjustFor, { [k]: Number(e.target.value) })} />
              <span className="text-right text-slate-300 tabular-nums">{fmt(a[k])}</span>
            </label>
          );
          const PS = 0.3;
          // Portal to <body>: inside the sticky preview column the drawer was painted under it (clicks missed "Done").
          return createPortal(
            <div className="fixed right-0 top-0 bottom-0 z-[70] w-full max-w-[440px] overflow-y-auto border-l border-slate-700 bg-slate-900/95 backdrop-blur p-4 space-y-3 shadow-2xl">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                <h3 className="flex-1 truncate font-bold text-sm">{view.label}</h3>
                <button onClick={() => setAdjustFor(null)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="mx-auto overflow-hidden rounded-md border border-slate-700" style={{ width: SLIDE_W * PS, height: SLIDE_H * PS }}>
                <div style={{ transform: `scale(${PS})`, transformOrigin: 'top left', width: SLIDE_W, height: SLIDE_H }}>{view.node}</div>
              </div>
              <section className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Picture</h4>
                <div className="flex gap-1 text-xs">
                  {([['card', 'Poster'], ['full', 'Fill'], ['fit', 'Fit whole']] as const).map(([f, label]) => (
                    <button key={f} onClick={() => setSlideFit(m => ({ ...m, [adjustFor]: f }))} className={`flex-1 rounded px-2 py-1 ${fit === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{label}</button>
                  ))}
                </div>
                {slider('Zoom', 'zoom', 0.5, 2.5, 0.05, v => `${Math.round(v * 100)}%`)}
                {slider('Left ↔ right', 'x', 0, 100, 1, v => `${v}%`)}
                {slider('Up ↕ down', 'y', 0, 100, 1, v => `${v}%`)}
                {slider('Brightness', 'brightness', 40, 160, 5, v => `${v}%`)}
              </section>
              <section className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Shade behind the text</h4>
                {slider('Strength', 'shade', 0, 200, 5, v => `${v}%`)}
                {slider('Reaches up', 'shadeHeight', 30, 160, 5, v => `${v}%`)}
              </section>
              <section className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Text</h4>
                {slider('Size', 'textScale', 50, 160, 5, v => `${v}%`)}
                {slider('Up ↕ down', 'textY', -500, 200, 5, v => `${v > 0 ? '+' : ''}${v}`)}
              </section>
              <section className="space-y-2 rounded-lg border border-slate-800 p-2.5">
                <label className="flex items-center gap-2 text-xs text-slate-200">
                  <input type="checkbox" checked={!!slideLooks[adjustFor]} onChange={e => setSlideLooks(m => { const n = { ...m }; if (e.target.checked) n[adjustFor] = JSON.parse(JSON.stringify(look)); else delete n[adjustFor]; return n; })} />
                  Own layout for this slide (show / hide / move / resize each item)
                </label>
                {slideLooks[adjustFor] && (
                  <LookPanel look={slideLooks[adjustFor]} onChange={l => setSlideLooks(m => ({ ...m, [adjustFor]: l }))} onReset={() => setSlideLooks(m => ({ ...m, [adjustFor]: JSON.parse(JSON.stringify(look)) }))} onCopyAll={() => setSlideLooks(m => { const n = { ...m }; for (const k of titleKeys) n[k] = JSON.parse(JSON.stringify(m[adjustFor])); return n; })} surface="slide"
                    note={<p className="text-[11px] text-slate-500">Only this slide. “Use on all desks” here copies this layout to every title slide in this carousel.</p>} />
                )}
              </section>
              <div className="flex flex-wrap gap-2 text-xs">
                <button onClick={() => { setSlideAdjust(m => { const n = { ...m }; for (const k of titleKeys) n[k] = { ...a }; return n; }); setSlideFit(m => { const n = { ...m }; for (const k of titleKeys) n[k] = fit; return n; }); }} className="rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5">Same for all title slides</button>
                <button onClick={() => { setSlideAdjust(m => { const n = { ...m }; delete n[adjustFor]; return n; }); setSlideLooks(m => { const n = { ...m }; delete n[adjustFor]; return n; }); setSlideFit(m => { const n = { ...m }; delete n[adjustFor]; return n; }); }} className="rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5">Reset this slide</button>
                <button onClick={() => setAdjustFor(null)} className="ml-auto rounded-md bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 font-semibold text-white">Done</button>
              </div>
            </div>,
            document.body,
          );
        })()}
        {extrasFor && (() => {
          const r = items.find(x => x.id === extrasFor);
          if (!r) return null;
          return createPortal(
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setExtrasFor(null)}>
              <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2"><MessageSquareQuote className="w-5 h-5 text-sky-400" /> {displayTitle(r)}</h3>
                  <button onClick={() => setExtrasFor(null)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <ExtrasPanel key={r.id} domain={domain.kind} item={r} extra={extras[r.id] || null} onChange={setExtra} />
                <div className="flex justify-end"><button onClick={() => setExtrasFor(null)} className="rounded-md bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 text-sm font-semibold">Done</button></div>
              </div>
            </div>,
            document.body,
          );
        })()}
        {reelOpen && <ReelMaker renderImages={renderForReel} caption={caption} slideCount={totalSlides} slug={slug} title={cover.heading} handle={brand.handle} accent={postTheme.accent} kind={`${publishKind}-reel`} trailerTitles={items.map(trailerTitleOf)} onClose={() => setReelOpen(false)} />}
        {previewOpen && (
          <InstagramPreview slides={slideViews} handle={brand.handle} accent={brand.accent} caption={caption} onMove={moveSlide} onClose={() => setPreviewOpen(false)} />
        )}
        {picker && (() => {
          const ordered = [...slideItems, ...pool.filter(r => !slideItems.includes(r))];
          if (picker.kind === 'title') {
            const r = pool.find(x => x.id === picker.releaseId) || items.find(x => x.id === picker.releaseId);
            if (!r) return null;
            return (
              <PicturePicker title={`Picture for “${displayTitle(r)}”`} releases={[r]} initialReleaseId={r.id} aiTheme={themeOf(`t:${r.id}`).aiTheme} domain={domain}
                current={overrides[r.id]?.url || posterUrl(r.posterPath, 'w780')}
                onPick={(url, label) => setOverrides(o => ({ ...o, [r.id]: { url, label } }))}
                onReset={overrides[r.id] ? () => setOverrides(o => { const n = { ...o }; delete n[r.id]; return n; }) : undefined}
                onClose={() => setPicker(null)} />
            );
          }
          if (picker.kind === 'custom') {
            const c = customSlides.find(x => x.id === picker.id);
            return (
              <PicturePicker title="Change slide picture" releases={ordered} current={c?.src || null} aiTheme={postTheme.aiTheme} domain={domain}
                onPick={(url, label) => updateCustom(picker.id, { src: url, label })} onClose={() => setPicker(null)} />
            );
          }
          return (
            <PicturePicker title="Add a slide" releases={ordered} current={null} aiTheme={postTheme.aiTheme} domain={domain}
              onPick={(url, label) => addCustom(url, label)} onClose={() => setPicker(null)} />
          );
        })()}

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Caption (template — edit freely)</h3>
            <div className="flex gap-2">
              {captionEdited && (
                <button onClick={() => { setEditedCaption(null); setAiCopy(null); }} className="flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs">
                  <RotateCcw className="w-3.5 h-3.5" /> Reset to template
                </button>
              )}
              <button onClick={copyCaption} className="flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy caption'}
              </button>
            </div>
          </div>
          <AiCaptionBar
            disabled={slideItems.length === 0}
            active={aiCopy}
            edited={captionEdited}
            request={(tone, language) => aiRequest(slideItems, tone, language)}
            onApply={ai => { setAiCopy(ai); setEditedCaption(null); }}
            onClear={() => { setAiCopy(null); setEditedCaption(null); }}
          />
          <textarea value={caption} onChange={e => setEditedCaption(e.target.value)} rows={14}
            className="w-full rounded-md bg-slate-950 border border-slate-700 p-3 text-sm font-mono leading-relaxed" />
          <div className="text-xs text-slate-500">{caption.length}/2200 characters • {(caption.match(/#\w+/g) || []).length}/30 hashtags</div>
        </section>

        {slideItems.some(r => !r.posterPath) && (
          <p className="text-xs text-amber-400">
            Some titles have no poster ({slideItems.filter(r => !r.posterPath).map(r => r.title).join(', ')}). Use “Picture” on the slide to pick one.
          </p>
        )}
      </div>
    </div>
  );
}
