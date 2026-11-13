'use client';
/* eslint-disable @next/next/no-img-element -- the post is rasterised by html-to-image; next/image would break export */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';
import {
  Check, Clapperboard, Copy, Download, ExternalLink, ImageIcon, Link2, Loader2, Plus, RotateCcw, Save, Search, Sparkles, Star, Upload, Wand2,
} from 'lucide-react';
import {
  AiCaptionCopy, addDays, displayTitle, fmtDate, languageLabel, posterUrl, proxied, singleCaption, todayIst,
} from '@/lib/ott';
import { ImageResults, OTT_DOMAIN, PostDomain, PostItem } from '@/lib/postDomain';
import { CINEMA_CTAS, certRuntime, cinemaDateLine, cinemaSingleCaption, languagesLine, recentDateChange } from '@/lib/cinemaCaptions';
import { WORLD_CTAS, metaLine as worldMeta, scoreLabel, worldSingleCaption } from '@/lib/world';
import { PlatformPill, SLIDE_H, SLIDE_W, SlideBrand, TicketBadge } from './OttSlides';
import { LookContent, LookFrame, LookPanel } from './PostLayout';
import { PostLook, usePostLook } from '@/lib/postLook';
import { metaBits } from '@/lib/postMeta';
import { ExtrasPanel } from './ExtrasPanel';
import { TitleExtra, captionWithExtras, extrasApi, ratingChips } from '@/lib/extras';
import { ThemePicker } from './ThemePicker';
import { DEFAULT_CHOICE, PostTheme, ThemeChoice, resolveTheme } from '@/lib/themes';
import { mediaApi, useCustomThemes, usePalettes } from '@/lib/useThemes';
import { InstagramPublish } from './InstagramPublish';
import { ReelMaker } from './ReelMaker';
import { trailerTitleOf } from './YouTubeMarker';
import { FacebookPhotoPublish } from './SocialPublish';
import { AiCaptionBar } from './AiCaptionBar';

const PREVIEW_SCALE = 0.42;

type Layout = 'card' | 'full';
interface Adjust { zoom: number; x: number; y: number; brightness: number; contrast: number; saturate: number; darken: number }
const DEFAULT_ADJUST: Adjust = { zoom: 1, x: 50, y: 50, brightness: 100, contrast: 100, saturate: 100, darken: 35 };

// ───────────────────────── the 1080×1350 post ─────────────────────────

function PostCanvas({
  release, image, adjust, layout, look, kicker, rating, review, brand, today, theme, oneLiner, chips = [],
}: {
  release: PostItem; image: string | null; adjust: Adjust; layout: Layout; look: PostLook; kicker: string;
  rating: number | null; review: string; brand: SlideBrand; today: string; theme: PostTheme;
  oneLiner?: string | null; chips?: string[];
}) {
  const t = theme;
  const upcoming = !!release.releaseDate && release.releaseDate > today;
  const filter = `brightness(${adjust.brightness}%) contrast(${adjust.contrast}%) saturate(${adjust.saturate}%)${t.imageFilter !== 'none' ? ` ${t.imageFilter}` : ''}`;
  const imgStyle: React.CSSProperties = {
    width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${adjust.x}% ${adjust.y}%`,
    transform: `scale(${adjust.zoom})`, transformOrigin: `${adjust.x}% ${adjust.y}%`, filter,
  };
  const when = release.releaseDate ? fmtDate(release.releaseDate, { weekday: 'short', day: 'numeric', month: 'short' }) : 'Date TBA';
  const cinema = !!release.cinema;
  const world = release.world;
  // World: the year is part of the details line and the score is a rating chip — each can be removed on its own
  const date = world
    ? ''
    : cinema
    ? cinemaDateLine(release, today, recentDateChange(release.cinema, today) ? 'postponed' : 'single').replace(/^In cinemas /, '').replace(/^Now in cinemas$/, release.releaseDate ? `Since ${when}` : '')
    : upcoming ? `From ${when}` : release.releaseDate ? `Streaming now` : '';
  const meta = world
    ? worldMeta(world)
    : cinema
    ? [languagesLine(release), certRuntime(release)].filter(Boolean).join(' • ')
    : [languageLabel(release.language), release.contentType === 'tv' ? 'Series' : 'Movie'].filter(Boolean).join(' • ');
  const content: LookContent = {
    title: displayTitle(release),
    kicker,
    badge: cinema
      ? size => <TicketBadge accent={t.accent} size={size} text={recentDateChange(release.cinema, today) ? 'NEW DATE' : upcoming || !release.releaseDate ? 'IN CINEMAS' : 'NOW SHOWING'} />
      : world && !release.platform ? undefined : size => <PlatformPill platform={release.platform} size={size} />,
    date: date || undefined,
    meta: meta || undefined,
    metaBits: metaBits(release),
    chips: world && !chips.length && scoreLabel(world) ? [scoreLabel(world)] : chips,
    stars: rating,
    review,
    oneLiner,
  };
  // the label's wording is typed per post here, so the layout's own label text doesn't override it
  const lookForPost = { ...look, blocks: look.blocks.map(b => (b.kind === 'kicker' ? { ...b, text: '' } : b)) };
  return <LookFrame look={lookForPost} theme={t} content={content} picture={{ src: image, style: imgStyle }} layout={layout} brand={brand} darken={adjust.darken} />;
}

// ───────────────────────── image finder ─────────────────────────

/** ✨ AI poster panel: paid Gemini generations from the real poster + genre theme. */
function AiPosterPanel({ release, kind, aiTheme, current, onPick }: { release: { id: string; status: string; title: string }; kind: 'ott' | 'cinema' | 'world'; aiTheme: string; current: string | null; onPick: (url: string, label: string) => void }) {
  const [mode, setMode] = useState<'restyle' | 'background'>('restyle');
  const [count, setCount] = useState(2);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [results, setResults] = useState<Array<{ url: string; model: string }>>([]);

  const run = async () => {
    if (!confirm(`Generate ${count} AI poster${count > 1 ? 's' : ''} for “${release.title}”?\n\nThis uses paid Gemini image generation (about ₹3–4 per image, billed to your Google account).`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await mediaApi.aiPoster({ kind, id: release.id, theme: aiTheme, count, mode, extra });
      setResults(prev => [...r.images, ...prev]);
      setMsg({ text: `${r.images.length} poster(s) made${r.failed ? `, ${r.failed} failed` : ''}. Click one to use it. Tag the post with Instagram’s “AI info” label when sharing.` });
    } catch (e) {
      setMsg({ text: (e as Error).message, err: true });
    } finally {
      setBusy(false);
    }
  };

  const sel = 'rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs';
  return (
    <div className="space-y-2">
      {release.status !== 'APPROVED' ? (
        <p className="text-xs text-amber-400">Approve this title first — AI posters are only made for approved titles.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <select value={mode} onChange={e => setMode(e.target.value as 'restyle' | 'background')} className={sel}>
              <option value="restyle">Restyle the real poster</option>
              <option value="background">Background art (no people)</option>
            </select>
            <select value={count} onChange={e => setCount(Number(e.target.value))} className={sel}>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} image{n > 1 ? 's' : ''}</option>)}
            </select>
            <button onClick={run} disabled={busy} className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:brightness-110 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} {busy ? 'Generating… (~20–60s)' : 'Generate AI poster'}
            </button>
          </div>
          <input value={extra} onChange={e => setExtra(e.target.value)} maxLength={300} className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs" placeholder="Optional direction, e.g. “rain-soaked night street, hero walking away”" />
          <p className="text-[11px] text-slate-500">Style follows the post theme (<b className="text-slate-400">{aiTheme}</b>). No text is drawn by AI — the title/date are added by your theme. ~₹3–4 per image.</p>
        </>
      )}
      {msg && <p className={`text-[11px] ${msg.err ? 'text-amber-400' : 'text-violet-300'}`}>{msg.text}</p>}
      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
          {results.map(o => (
            <button key={o.url} onClick={() => onPick(o.url, `AI poster (${o.model})`)} title={o.model}
              className={`relative rounded-md overflow-hidden border-2 bg-slate-900 ${current === o.url ? 'border-indigo-500' : 'border-transparent hover:border-slate-500'}`} style={{ aspectRatio: '4/5' }}>
              <img src={proxied(o.url) || ''} alt="" className="w-full h-full object-cover" />
              <span className="absolute top-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] text-violet-200">AI</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ImageFinder({
  release, current, onPick, aiTheme = 'brand', domain = OTT_DOMAIN,
}: {
  release: PostItem;
  current: string | null;
  onPick: (url: string, label: string) => void;
  aiTheme?: string;
  domain?: PostDomain;
}) {
  const kind = domain.kind;
  const [data, setData] = useState<ImageResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'TMDB' | 'OFFICIAL' | 'WEB' | 'AI'>('TMDB');
  const [pasted, setPasted] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchImages = (query?: string) =>
    domain.images(release.id, query).then(
      d => {
        setData(d);
        setQ(d.query);
        setTab(t => (query ? 'WEB' : t === 'AI' || d.tmdb.length ? t : d.official.length ? 'OFFICIAL' : 'WEB'));
        setLoading(false);
      },
      (e: Error) => {
        setError(e.message);
        setLoading(false);
      },
    );
  const search = (query?: string) => {
    setLoading(true);
    setError(null);
    return fetchImages(query);
  };

  // Search as soon as a title is chosen (the component is keyed by release id; loading starts true).
  useEffect(() => {
    fetchImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = !data || tab === 'AI' ? [] : tab === 'TMDB' ? data.tmdb : tab === 'OFFICIAL' ? data.official : data.web;
  const onFile = (f?: File) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onPick(String(reader.result), `Uploaded: ${f.name}`);
    reader.readAsDataURL(f);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
        {([
          ['TMDB', `Exact match (${data?.tmdb.length ?? 0})`],
          ['OFFICIAL', `Official trailers (${data?.official.length ?? 0})`],
          ['WEB', `Web (${data?.web.length ?? 0})`],
          ['AI', '✨ AI'],
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 py-1.5 rounded-md font-medium ${tab === k ? (k === 'AI' ? 'bg-violet-600 text-white' : 'bg-indigo-600 text-white') : 'text-slate-400 hover:text-white'}`}>{label}</button>
        ))}
      </div>
      {tab === 'AI' && <AiPosterPanel release={release} kind={kind} aiTheme={aiTheme} current={current} onPick={onPick} />}
      {tab === 'WEB' && (
        <form onSubmit={e => { e.preventDefault(); search(q); }} className="flex gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} className="flex-1 rounded-md bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs" placeholder="Search images…" />
          <button className="rounded-md bg-slate-800 hover:bg-slate-700 px-3 text-xs flex items-center gap-1"><Search className="w-3.5 h-3.5" /> Search</button>
        </form>
      )}
      {tab === 'TMDB' && !release.tmdbId && <p className="text-xs text-amber-400">This title isn&apos;t linked to TMDB{kind === 'ott' ? ' — use “Find poster” on its card to link it' : ''}. Try Official trailers or Web.</p>}
      {tab === 'WEB' && <p className="text-[11px] text-slate-500">Web results are from Bing and may include fan-made art — check the source (hover a picture) before using one.</p>}
      {tab === 'AI' ? null : loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
      ) : error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : list.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">{tab === 'WEB' && data?.webError ? data.webError : 'No images here — try another tab.'}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
          {list.map(o => (
            <button key={o.url} onClick={() => onPick(o.url, o.label || o.source)} title={o.label}
              className={`relative rounded-md overflow-hidden border-2 bg-slate-900 ${current === o.url ? 'border-indigo-500' : 'border-transparent hover:border-slate-500'}`}
              style={{ aspectRatio: o.kind === 'poster' ? '2/3' : o.kind === 'web' ? '3/4' : '16/9' }}>
              <img src={proxied(o.thumb) || ''} alt="" loading="lazy" className="w-full h-full object-cover" />
              {o.width && o.height && <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] text-slate-300">{o.width}×{o.height}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={pasted} onChange={e => setPasted(e.target.value)} className="flex-1 rounded-md bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs" placeholder="…or paste an image link (https://…)" />
        <button disabled={!/^https?:\/\//.test(pasted)} onClick={() => { onPick(pasted.trim(), 'Pasted link'); setPasted(''); }}
          className="rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-3 text-xs flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Use</button>
        <button onClick={() => fileRef.current?.click()} className="rounded-md bg-slate-800 hover:bg-slate-700 px-3 text-xs flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Upload</button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
      </div>
    </div>
  );
}

// ───────────────────────── editor ─────────────────────────

function Slider({ label, value, min, max, step = 1, onChange, suffix = '' }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="grid grid-cols-[90px_1fr_44px] items-center gap-2 text-xs text-slate-400">
      {label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
      <span className="text-right tabular-nums text-slate-300">{value}{suffix}</span>
    </label>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Default call to action for a cinema post: tickets when it's close / out, hype when it's far away. */
function defaultCta(release: PostItem, today: string) {
  if (!release.releaseDate || recentDateChange(release.cinema, today)) return 'excited';
  if (release.releaseDate <= today) return release.myRating != null ? 'review' : 'book';
  return release.releaseDate <= addDays(today, 7) ? 'book' : 'excited';
}

function Editor({ release, brand, extraTags, onChanged, onAddToCarousel, domain }: { release: PostItem; brand: SlideBrand; extraTags: string; onChanged?: (r: PostItem) => void; onAddToCarousel?: (blob: Blob, label: string) => void; domain: PostDomain }) {
  const today = todayIst();
  const upcoming = !!release.releaseDate && release.releaseDate > today;
  const cinema = domain.kind === 'cinema';
  const world = domain.kind === 'world' ? release.world : undefined;
  const [cta, setCta] = useState<string>(() => (world ? 'watched' : defaultCta(release, today)));
  const [image, setImage] = useState<string | null>(posterUrl(release.posterPath, 'w780'));
  const [imageLabel, setImageLabel] = useState(release.posterPath ? 'Current poster' : '');
  const [adjust, setAdjust] = useState<Adjust>(DEFAULT_ADJUST);
  const [layout, setLayout] = useState<Layout>('card');
  // Theme: Auto = from genre + this picture's colours; or any preset / your saved theme.
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(DEFAULT_CHOICE);
  const [customThemes, addCustomTheme] = useCustomThemes();
  const palettes = usePalettes([proxied(image)]);
  const theme = resolveTheme(themeChoice, { genres: release.genres, overview: release.overview, palette: palettes[proxied(image) || ''] ?? null, brandAccent: brand.accent, customThemes });
  // What's on the picture: your layout for single posts on this desk (remembered), + this post's label wording.
  const { look, setLook, reset: resetLook, copyToAllDesks } = usePostLook(domain.kind, 'single');
  const [kicker, setKicker] = useState(() =>
    look.blocks.find(b => b.kind === 'kicker')?.text?.trim() ||
    (world ? (world.kind === 'tv' ? 'Binge-worthy' : 'Must watch') : cinema ? (recentDateChange(release.cinema, today) ? 'Release date update' : upcoming || !release.releaseDate ? 'Coming to cinemas' : 'Now in cinemas') : upcoming ? 'Coming to OTT' : 'Now streaming'));
  const starsOn = look.blocks.some(b => b.kind === 'stars' && b.on);
  const [rating, setRating] = useState<number | null>(release.myRating);
  const [review, setReview] = useState(release.myReview || '');
  const [prevReview, setPrevReview] = useState<string | null>(null);
  const [ai, setAi] = useState<{ busy: boolean; msg?: string; err?: boolean }>({ busy: false });
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exported, setExported] = useState<{ url: string; name: string; kb: number } | null>(null);
  const [imageStatusFull, setImageStatus] = useState<{ url: string | null; state: 'checking' | 'ok' | 'error' }>({ url: image, state: 'checking' });
  const imageStatus = imageStatusFull.url === image ? imageStatusFull.state : 'checking';
  const [copied, setCopied] = useState(false);
  const [reelOpen, setReelOpen] = useState(false);
  const [editedCaption, setEditedCaption] = useState<string | null>(null);
  const postRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ax: number; ay: number } | null>(null);

  const [aiCopy, setAiCopy] = useState<AiCaptionCopy | null>(null);
  // One-liner + ratings for this title (shared with carousels on every desk).
  const [extra, setExtra] = useState<TitleExtra | null>(null);
  const [extraLoaded, setExtraLoaded] = useState(false);
  useEffect(() => {
    extrasApi.get(domain.kind, release.id).then(e => { setExtra(e); setExtraLoaded(true); }, () => setExtraLoaded(true));
  }, [domain.kind, release.id]);
  const chips = ratingChips(release, extra, rating);
  const baseTemplate = world
    ? worldSingleCaption(world, { rating, review, handle: brand.handle, extraTags, cta, ai: aiCopy })
    : cinema
    ? cinemaSingleCaption(release, { rating, review, handle: brand.handle, extraTags, today, cta, ai: aiCopy })
    : singleCaption(release, { rating, review, handle: brand.handle, extraTags, today, ai: aiCopy });
  const template = captionWithExtras(baseTemplate, extra?.oneLiner, chips.filter(c => !c.startsWith('My ★')));
  const caption = editedCaption ?? template;
  const dirty = rating !== release.myRating || review.trim() !== (release.myReview || '');
  const set = <K extends keyof Adjust>(k: K, v: Adjust[K]) => setAdjust(a => ({ ...a, [k]: v }));

  // Check every picture loads through our proxy before it reaches the post — some sites block it.
  const checkImage = (url: string | null) => {
    if (!url) return;
    const probe = new Image();
    probe.onload = () => setImageStatus(s => (s.url === url ? { url, state: 'ok' } : s));
    probe.onerror = () => setImageStatus(s => (s.url === url ? { url, state: 'error' } : s));
    probe.src = proxied(url) || '';
  };
  const pickImage = (url: string, label: string) => {
    setImage(url);
    setImageLabel(label);
    setImageStatus({ url, state: 'checking' });
    checkImage(url);
    setExportError(null);
    setAdjust(a => ({ ...a, zoom: 1, x: 50, y: 50 }));
  };
  useEffect(() => {
    checkImage(image); // the starting poster
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveVerdict = async () => {
    try {
      const updated = await domain.update(release.id, { myRating: rating, myReview: review.trim() || null });
      onChanged?.(updated);
      setSaveMsg('Saved');
    } catch (e) {
      setSaveMsg((e as Error).message);
    }
    setTimeout(() => setSaveMsg(null), 2000);
  };

  const useAsPoster = async () => {
    if (!image || image.startsWith('data:')) return;
    try {
      const updated = await domain.update(release.id, { posterPath: image });
      onChanged?.(updated);
      setSaveMsg('This image is now the title’s poster everywhere');
    } catch (e) {
      setSaveMsg((e as Error).message);
    }
    setTimeout(() => setSaveMsg(null), 2500);
  };

  const draftWithAi = async () => {
    setAi({ busy: true });
    try {
      const res = await domain.draftReview(release.id, { rating, notes: review });
      setPrevReview(review);
      setReview(res.text);
      setAi({ busy: false, msg: 'AI draft inserted — edit it so it sounds like you. Undo brings your text back.' });
    } catch (e) {
      setAi({ busy: false, msg: (e as Error).message, err: true });
    }
  };

  /** The finished 1080×1350 JPEG — shared by Download and Post to Instagram. */
  const renderBlob = async (): Promise<Blob> => {
    if (!postRef.current) throw new Error('Preview not ready');
    const opts = { width: SLIDE_W, height: SLIDE_H, pixelRatio: 1, includeQueryParams: true, quality: 0.95 };
    await toJpeg(postRef.current, opts).catch(() => null); // warm-up: first render sometimes drops images
    const dataUrl = await toJpeg(postRef.current, opts);
    return (await fetch(dataUrl)).blob();
  };

  const addToCarousel = async () => {
    setExporting(true);
    setExportError(null);
    try {
      onAddToCarousel?.(await renderBlob(), displayTitle(release));
    } catch (e) {
      setExportError(e instanceof Event || !(e as Error)?.message ? 'A picture on the post couldn’t be loaded. Pick another picture.' : (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const exportJpeg = async () => {
    if (!postRef.current) return;
    if (imageStatus === 'error') {
      setExportError('The selected picture can’t be loaded (its website blocks it). Pick another picture, or download it yourself and use Upload.');
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      // A blob link is more reliable than a long data: URL, and stays on screen as a manual "Save" fallback.
      const blob = await renderBlob();
      if (exported) URL.revokeObjectURL(exported.url);
      const file = { url: URL.createObjectURL(blob), name: `${release.title.replace(/[^\w]+/g, '-').toLowerCase()}-post.jpg`, kb: Math.round(blob.size / 1024) };
      setExported(file);
      const a = document.createElement('a');
      a.href = file.url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      // html-to-image rejects with a DOM Event when an <img> fails to load.
      setExportError(
        e instanceof Event || !(e as Error)?.message
          ? 'A picture on the post couldn’t be loaded, so the JPEG couldn’t be made. Pick another picture (or Upload one) and try again.'
          : `Export failed: ${(e as Error).message}`,
      );
    } finally {
      setExporting(false);
    }
  };

  const copyCaption = async () => {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Drag the picture inside the preview to reposition it.
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, ax: adjust.x, ay: adjust.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const k = 100 / (SLIDE_W * PREVIEW_SCALE * 0.6 * adjust.zoom);
    const nx = Math.max(0, Math.min(100, drag.current.ax - (e.clientX - drag.current.x) * k));
    const ny = Math.max(0, Math.min(100, drag.current.ay - (e.clientY - drag.current.y) * k));
    setAdjust(a => ({ ...a, x: Math.round(nx), y: Math.round(ny) }));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(360px,440px)_1fr] gap-6">
      <div className="space-y-4">
        <Section title="1 · Picture" right={imageLabel ? <span className="text-[11px] text-slate-500 truncate max-w-[220px]" title={imageLabel}>{imageLabel}</span> : undefined}>
          {!image && <p className="text-xs text-amber-400">This title has no picture yet — pick one below.</p>}
          <ImageFinder release={release} current={image} onPick={pickImage} aiTheme={theme.aiTheme} domain={domain} />
          {image && !image.startsWith('data:') && image !== posterUrl(release.posterPath, 'w780') && (
            <button onClick={useAsPoster} className="text-xs text-indigo-300 hover:text-indigo-200">Use this picture as the title’s poster everywhere (lists, carousels)</button>
          )}
        </Section>

        <Section title="2 · Theme">
          <ThemePicker value={themeChoice} onChange={setThemeChoice} resolved={theme} customThemes={customThemes} onSaveCustom={addCustomTheme} title="Look of this post"
            note={release.genres ? `Genres: ${release.genres}` : "No genres on file — Auto uses your brand look."} />
        </Section>

        <Section title="3 · Edit picture" right={<button onClick={() => setAdjust(DEFAULT_ADJUST)} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-white"><RotateCcw className="w-3 h-3" /> Reset</button>}>
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            {([['card', 'Poster card'], ['full', 'Full picture']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setLayout(k)} className={`flex-1 py-1.5 rounded-md font-medium ${layout === k ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>{label}</button>
            ))}
          </div>
          <Slider label="Zoom" value={adjust.zoom} min={1} max={3} step={0.05} onChange={v => set('zoom', v)} suffix="×" />
          <Slider label="Move left/right" value={adjust.x} min={0} max={100} onChange={v => set('x', v)} suffix="%" />
          <Slider label="Move up/down" value={adjust.y} min={0} max={100} onChange={v => set('y', v)} suffix="%" />
          <Slider label="Brightness" value={adjust.brightness} min={50} max={150} onChange={v => set('brightness', v)} suffix="%" />
          <Slider label="Contrast" value={adjust.contrast} min={50} max={150} onChange={v => set('contrast', v)} suffix="%" />
          <Slider label="Colour" value={adjust.saturate} min={0} max={200} onChange={v => set('saturate', v)} suffix="%" />
          <Slider label="Darken" value={adjust.darken} min={0} max={100} onChange={v => set('darken', v)} suffix="%" />
          <p className="text-[11px] text-slate-500">Tip: drag the picture in the preview to reposition it.</p>
        </Section>

        <Section title="4 · Your rating & review"
          right={dirty ? <button onClick={saveVerdict} className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px]"><Save className="w-3 h-3" /> Save to title</button>
            : saveMsg ? <span className="text-[11px] text-emerald-400">{saveMsg}</span> : undefined}>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(n => {
              const fill = rating == null ? 0 : Math.max(0, Math.min(1, rating - (n - 1)));
              return (
                <span key={n} className="relative w-8 h-8">
                  <Star className="absolute inset-0 w-8 h-8 text-slate-600" />
                  <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}><Star className="w-8 h-8 fill-yellow-400 text-yellow-400" /></span>
                  {/* left half = n-0.5, right half = n */}
                  <button aria-label={`${n - 0.5} stars`} onClick={() => setRating(n - 0.5)} className="absolute left-0 top-0 w-1/2 h-full" />
                  <button aria-label={`${n} stars`} onClick={() => setRating(n)} className="absolute right-0 top-0 w-1/2 h-full" />
                </span>
              );
            })}
            <span className="ml-2 text-sm font-semibold tabular-nums">{rating != null ? `${rating}/5` : 'No rating'}</span>
            {rating != null && <button onClick={() => setRating(null)} className="ml-2 text-[11px] text-slate-500 hover:text-white">clear</button>}
          </div>
          <textarea value={review} onChange={e => setReview(e.target.value)} rows={4} maxLength={400}
            className="w-full rounded-md bg-slate-950 border border-slate-700 p-3 text-sm leading-relaxed" placeholder="Your short review (shown on the post and in the caption)…" />
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={draftWithAi} disabled={ai.busy}
              className="flex items-center gap-1.5 rounded-md bg-violet-600/80 hover:bg-violet-600 disabled:opacity-50 px-3 py-1.5 text-xs font-medium"
              title="Optional. Uses your rating and whatever you typed as notes. Never changes your rating.">
              {ai.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI draft from my notes
            </button>
            {prevReview !== null && (
              <button onClick={() => { setReview(prevReview); setPrevReview(null); setAi({ busy: false }); }} className="text-xs text-slate-400 hover:text-white">Undo AI</button>
            )}
            <span className="ml-auto text-[11px] text-slate-500">{review.length}/400</span>
          </div>
          {ai.msg && <p className={`text-[11px] ${ai.err ? 'text-amber-400' : 'text-violet-300'}`}>{ai.msg}</p>}
        </Section>

        <Section title="5 · One-liner & ratings">
          {extraLoaded
            ? <ExtrasPanel domain={domain.kind} item={release} extra={extra} onChange={setExtra} myRating={rating} />
            : <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-indigo-400" /></div>}
        </Section>

        <Section title="6 · What’s on the picture">
          <LookPanel look={look} onChange={setLook} onReset={resetLook} onCopyAll={copyToAllDesks} surface="single" hide={['note']}
            metaParts={world ? ['year', 'language', 'genre', 'length'] : cinema ? ['language', 'cert', 'length'] : ['language', 'type']}
            kickerInput={{ value: kicker, onChange: setKicker, placeholder: world ? 'e.g. Must watch, Hidden gem, My Review' : cinema ? 'e.g. Coming to cinemas, FDFS, My Review' : 'e.g. Coming to OTT, My Review' }}
            note={<p className="text-[11px] text-slate-500">Show / hide (👁), move onto the picture or below it, resize, reorder, or add your own text and labels. Drag the picture to reposition it.</p>} />
        </Section>
      </div>

      {/* preview stays on screen while you scroll the controls */}
      <div className="space-y-4 min-w-0 xl:sticky xl:top-0 xl:self-start xl:max-h-[calc(100vh-11rem)] xl:overflow-y-auto xl:pr-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-400">1080×1350 · Instagram feed (4:5)</div>
          <div className="flex gap-2">
          {onAddToCarousel && (
            <button onClick={addToCarousel} disabled={exporting || imageStatus === 'error'}
              className="flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-4 py-2 text-sm font-semibold">
              <Plus className="w-4 h-4" /> Add to carousel
            </button>
          )}
          <button onClick={() => setReelOpen(true)} disabled={exporting || imageStatus === 'error'} title="Turn this post into an Instagram Reel (video, optional music)"
            className="flex items-center gap-2 rounded-lg bg-pink-600 hover:bg-pink-700 disabled:opacity-50 px-4 py-2 text-sm font-semibold">
            <Clapperboard className="w-4 h-4" /> Make Reel
          </button>
          <button onClick={exportJpeg} disabled={exporting}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 text-sm font-semibold">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {exporting ? 'Making JPEG…' : 'Download JPEG'}
          </button>
          </div>
        </div>
        {reelOpen && <ReelMaker renderImages={async () => [await renderBlob()]} caption={caption} slideCount={1} title={displayTitle(release)} handle={brand.handle} accent={theme.accent} kind={world ? 'world-single' : cinema ? 'cinema-single' : 'single'} releaseId={release.id} trailerTitles={[trailerTitleOf(release)]} slug={release.title.replace(/[^\w]+/g, '-').toLowerCase()} onClose={() => setReelOpen(false)} />}
        <InstagramPublish
          renderImages={async () => [await renderBlob()]}
          caption={caption}
          kind={world ? 'world-single' : cinema ? 'cinema-single' : 'single'}
          releaseId={release.id}
          disabledReason={
            image && imageStatus === 'error' ? 'The selected picture can’t be loaded — pick another one first.' :
            caption.length > 2200 ? 'Caption is longer than 2200 characters.' : null
          }
        />
        <FacebookPhotoPublish
          renderImages={async () => [await renderBlob()]}
          caption={caption}
          kind={world ? 'world-single' : cinema ? 'cinema-single' : 'single'}
          releaseId={release.id}
          disabledReason={
            image && imageStatus === 'error' ? 'The selected picture can’t be loaded — pick another one first.' :
            caption.length > 2200 ? 'Caption is longer than 2200 characters.' : null
          }
        />
        {image && imageStatus === 'error' && (
          <p className="text-xs text-red-400">This picture can’t be loaded — its website blocks it. Pick another picture, or save it yourself and use Upload.</p>
        )}
        {exportError && <p className="text-xs text-red-400">{exportError}</p>}
        {exported && !exporting && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-700/50 bg-emerald-950/30 p-2.5 text-xs">
            <img src={exported.url} alt="" className="w-12 h-15 rounded object-cover shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="text-emerald-300 font-semibold">JPEG ready — {exported.name} ({exported.kb} KB)</div>
              <div className="text-slate-400">
                Didn’t see a download? Click{' '}
                <a href={exported.url} download={exported.name} className="text-emerald-300 underline">Save image</a>
                {' '}or{' '}
                <a href={exported.url} target="_blank" rel="noreferrer" className="text-emerald-300 underline">open it</a>
                {' '}and right-click → Save. If Chrome shows a blocked-download icon at the right of the address bar, click it and choose “Always allow”.
              </div>
            </div>
          </div>
        )}
        <div className="rounded-lg overflow-hidden border border-slate-800 cursor-grab active:cursor-grabbing select-none touch-none"
          style={{ width: SLIDE_W * PREVIEW_SCALE, height: SLIDE_H * PREVIEW_SCALE }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
          <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
            <div ref={postRef}>
              <PostCanvas release={release} image={image} adjust={adjust} layout={layout} look={look} kicker={kicker} rating={rating} review={review} brand={brand} today={today} theme={theme} oneLiner={extra?.oneLiner} chips={chips.filter(c => !(c.startsWith('My ★') && starsOn && rating != null))} />
            </div>
          </div>
        </div>

        <Section title="Caption (template — edit freely)"
          right={
            <div className="flex gap-2">
              {editedCaption !== null && (
                <button onClick={() => { setEditedCaption(null); setAiCopy(null); }} className="flex items-center gap-1.5 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs"><RotateCcw className="w-3.5 h-3.5" /> Reset</button>
              )}
              <button onClick={copyCaption} className="flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy caption'}
              </button>
            </div>
          }>
          {(cinema || world) && (
            <label className="flex items-center gap-2 text-xs text-slate-400">
              Ending
              <select value={cta} onChange={e => { setCta(e.target.value); setEditedCaption(null); }} className="flex-1 rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white">
                {(world ? WORLD_CTAS : CINEMA_CTAS).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
          )}
          <AiCaptionBar
            active={aiCopy}
            edited={editedCaption !== null}
            request={(tone, language) => domain.aiCaption({ kind: 'single', releaseIds: [release.id], tone, language, rating, review })}
            onApply={ai => { setAiCopy(ai); setEditedCaption(null); }}
            onClear={() => { setAiCopy(null); setEditedCaption(null); }}
          />
          <textarea value={caption} onChange={e => setEditedCaption(e.target.value)} rows={11}
            className="w-full rounded-md bg-slate-950 border border-slate-700 p-3 text-sm font-mono leading-relaxed" />
          <div className="text-xs text-slate-500">{caption.length}/2200 characters • {(caption.match(/#\w+/g) || []).length}/30 hashtags</div>
        </Section>
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <ExternalLink className="w-3.5 h-3.5" /> Post with one click above, or download the JPEG + copy the caption and post from your phone.
        </p>
      </div>
    </div>
  );
}

// ───────────────────────── title picker + editor ─────────────────────────

export function SinglePostEditor({
  approved, brand, extraTags, initialId, onChanged, onAddToCarousel, domain = OTT_DOMAIN,
}: {
  approved: PostItem[]; brand: SlideBrand; extraTags: string; initialId?: string | null; onChanged?: (r: PostItem) => void;
  onAddToCarousel?: (blob: Blob, label: string) => void;
  domain?: PostDomain;
}) {
  const cinema = domain.kind === 'cinema';
  const isWorld = domain.kind === 'world';
  const whereOf = (r: PostItem) => (r.world ? [r.world.year, scoreLabel(r.world)].filter(Boolean).join(' • ') : cinema ? languagesLine(r).split(' • ')[0] || 'Film' : r.platform || 'TBA');
  const today = todayIst();
  const [id, setId] = useState<string | null>(initialId ?? null);
  const [filter, setFilter] = useState('');

  // Upcoming first (soonest), then already streaming (newest), then undated.
  const options = useMemo(() => {
    const f = filter.toLowerCase();
    const match = (r: PostItem) => !f || r.title.toLowerCase().includes(f) || (r.platform || '').toLowerCase().includes(f) || languageLabel(r.language).toLowerCase().includes(f);
    const up = approved.filter(r => r.releaseDate && r.releaseDate >= today && match(r)).sort((a, b) => a.releaseDate!.localeCompare(b.releaseDate!));
    const out = approved.filter(r => r.releaseDate && r.releaseDate < today && match(r)).sort((a, b) => b.releaseDate!.localeCompare(a.releaseDate!));
    const tba = approved.filter(r => !r.releaseDate && match(r));
    return { up, out, tba };
  }, [approved, filter, today]);

  const release = approved.find(r => r.id === id) || null;

  const row = (r: PostItem) => (
    <button key={r.id} onClick={() => setId(r.id)}
      className={`w-full flex items-center gap-2 text-left text-sm rounded-md px-2 py-1.5 ${r.id === id ? 'bg-indigo-600/25 text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
      {r.posterPath ? <img src={posterUrl(r.posterPath, 'w342') || ''} alt="" className="w-6 h-9 rounded object-cover shrink-0" /> : <span className="w-6 h-9 rounded bg-slate-800 shrink-0 flex items-center justify-center"><ImageIcon className="w-3 h-3 text-slate-500" /></span>}
      <span className="flex-1 truncate">{displayTitle(r)}</span>
      <span className="text-[11px] text-slate-500 whitespace-nowrap">{whereOf(r)} • {fmtDate(r.releaseDate)}</span>
    </button>
  );

  return (
    <div className="space-y-5">
      <Section title="Choose a title" right={release ? <button onClick={() => setId(null)} className="text-[11px] text-slate-400 hover:text-white">Change</button> : undefined}>
        {release ? (
          <div className="flex items-center gap-3 text-sm">
            <Wand2 className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold">{displayTitle(release)}</span>
            <span className="text-slate-400">{cinema ? whereOf(release) : release.platform || 'Platform TBA'} • {fmtDate(release.releaseDate, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </div>
        ) : approved.length === 0 ? (
          <p className="text-sm text-slate-500">No approved {cinema ? 'films' : 'titles'} yet — approve some in the Review Queue first.</p>
        ) : (
          <>
            <input value={filter} onChange={e => setFilter(e.target.value)} className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm" placeholder={isWorld ? 'Search approved movies & series…' : cinema ? 'Search approved films or language…' : 'Search approved titles or platform…'} />
            <div className="max-h-96 overflow-y-auto pr-1 space-y-3">
              {options.up.length > 0 && <div><div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 px-2 pb-1">Coming up</div>{options.up.slice(0, 150).map(row)}</div>}
              {options.out.length > 0 && <div><div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 pb-1">{cinema ? 'Already released' : 'Already streaming'}</div>{options.out.slice(0, 150).map(row)}</div>}
              {options.tba.length > 0 && <div><div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 px-2 pb-1">Date not announced</div>{options.tba.slice(0, 150).map(row)}</div>}
            </div>
          </>
        )}
      </Section>
      {release && <Editor key={release.id} release={release} brand={brand} extraTags={extraTags} onChanged={onChanged} onAddToCarousel={onAddToCarousel} domain={domain} />}
    </div>
  );
}
