'use client';
/* eslint-disable @next/next/no-img-element -- your own photo, exported with html-to-image */
import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Clapperboard, Copy, Download, ImagePlus, Loader2, Plus, X } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import { Story } from '@/lib/trends';
import { THEME_PRESETS, frameBackground, presetById, textureLayers, titleStyle } from '@/lib/themes';
import { THEME_CATEGORIES, THEME_LIBRARY, freshEveryPost, rememberTheme, surpriseTheme } from '@/lib/themeLibrary';
import { InstagramPublish } from '@/components/ott/InstagramPublish';
import { FacebookPhotoPublish } from '@/components/ott/SocialPublish';
import { ReelMaker } from '@/components/ott/ReelMaker';

const W = 1080;
const H = 1350;
const SCALE = 0.42;
const EMOJI: Record<string, string> = {
  Weather: '🌧️', 'Cricket & sports': '🏏', Politics: '🏛️', 'Money & prices': '💰', 'Jobs & education': '🎓', Tech: '📱', 'Travel & transport': '🚇', 'Cinema & OTT': '🎬', 'Crime & law': '⚖️', General: '📰',
};
const TAGS: Record<string, string> = {
  Weather: '#ChennaiRains #Weather', 'Cricket & sports': '#Cricket #Sports', Politics: '#TNPolitics #Politics', 'Money & prices': '#Money #PriceUpdate', 'Jobs & education': '#Jobs #Exams',
  Tech: '#Tech #TechNews', 'Travel & transport': '#ChennaiMetro #Travel', 'Cinema & OTT': '#Kollywood #Cinema', 'Crime & law': '#Law #News', General: '#News',
};
const LABELS = ['TRENDING IN TAMIL NADU', 'TRENDING IN INDIA', 'JUST IN', 'BREAKING', 'NEWS UPDATE', 'DID YOU KNOW?', 'CHENNAI UPDATE', 'தமிழ்நாடு செய்தி'];
const QUESTIONS = ['What do you think? Comment below 👇', 'Good move or bad move? 👇', 'Share this with someone who needs to know 📤', 'Your city affected? Tell us 👇', 'Agree or disagree? 👇', 'உங்கள் கருத்து என்ன? 👇'];
const withTamil = (font: string) => `${font}, var(--font-tamil), "Nirmala UI", sans-serif`;

export function NewsPostMaker({ story, handle, onClose }: { story: Story; handle: string; onClose: () => void }) {
  const sensitive = !!story.sensitive;
  const outlets = useMemo(() => [...new Set(story.headlines.map(h => h.outlet))], [story]);
  const [label, setLabel] = useState(sensitive ? 'NEWS UPDATE' : story.tamilNadu ? 'TRENDING IN TAMIL NADU' : 'TRENDING IN INDIA');
  const [headline, setHeadline] = useState(story.title);
  const [points, setPoints] = useState<string[]>([]);
  const [source, setSource] = useState(`Source: ${outlets.slice(0, 3).join(', ')}`);
  const [question, setQuestion] = useState(sensitive ? '' : QUESTIONS[0]);
  const [show, setShow] = useState({ label: true, source: true, date: true, question: !sensitive, emoji: !sensitive, handle: true });
  const [photo, setPhoto] = useState<string | null>(null);
  const [themeId, setThemeId] = useState(() => (sensitive ? 'documentary' : freshEveryPost() ? surpriseTheme().id : 'brand'));
  const theme = presetById(themeId) || THEME_PRESETS[0];
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reel, setReel] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const caption = useMemo(() => [
    `${sensitive ? '' : `${EMOJI[story.category] || '📰'} `}${headline}`,
    ...points.filter(Boolean).map(p => `• ${p}`),
    '',
    show.source ? source : '',
    question,
    '',
    `Follow ${handle} for more`,
    `${story.tamilNadu ? '#TamilNadu #Chennai #TamilNews ' : '#India #IndiaNews '}${TAGS[story.category] || '#News'}${sensitive ? '' : ' #Trending'}`,
  ].filter((l, i, a) => l !== '' || (a[i - 1] !== '' && i > 0)).join('\n').trim(), [headline, points, source, question, show.source, handle, story, sensitive]);

  const render = async (): Promise<Blob> => {
    if (!ref.current) throw new Error('Preview not ready');
    const o = { width: W, height: H, pixelRatio: 1, includeQueryParams: true, quality: 0.95 };
    await toJpeg(ref.current, o).catch(() => null);
    return (await fetch(await toJpeg(ref.current, o))).blob();
  };
  const download = async () => {
    setBusy(true);
    setErr(null);
    try {
      const b = await render();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `news-${story.id}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) {
      setErr((e as Error).message || 'Couldn’t make the picture.');
    } finally {
      setBusy(false);
    }
  };

  const hl = headline.length;
  const hSize = hl > 120 ? 58 : hl > 90 ? 66 : hl > 60 ? 78 : 92;
  const sel = 'rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs';
  const disabledReason = checked ? null : 'Tick “I’ve checked the facts” first.';

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/75 p-4">
      <div className="w-full max-w-6xl rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">News post</h2>
          <span className="text-xs text-slate-500">{story.category} · {story.outlets} outlet{story.outlets === 1 ? '' : 's'}</span>
          <button onClick={onClose} className="ml-auto p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {sensitive && (
          <p className="flex items-start gap-2 rounded-md border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0" /> Sensitive story ({story.sensitive}). Real people are affected — keep it factual and respectful: no “viral”/🔥 styling, no jokes, no speculation. Instagram may also limit reach on graphic or tragic content.
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="space-y-3 text-sm">
            <section className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">On the picture</h3>
              <div className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={show.label} onChange={e => setShow(s => ({ ...s, label: e.target.checked }))} />
                <input value={label} onChange={e => setLabel(e.target.value)} className={`${sel} flex-1`} maxLength={40} />
                <select value="" onChange={e => e.target.value && setLabel(e.target.value)} className={sel}><option value="">Labels…</option>{LABELS.map(l => <option key={l} value={l}>{l}</option>)}</select>
              </div>
              <textarea value={headline} onChange={e => setHeadline(e.target.value)} rows={3} maxLength={160} className="w-full rounded-md bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-sm" placeholder="Headline — write it in your own words" />
              <p className="text-[10px] text-slate-500">{hl}/160 · rewriting the headline in your own words (or in Tamil) keeps the post original.</p>
              {points.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-slate-500">•</span>
                  <input value={p} onChange={e => setPoints(ps => ps.map((x, k) => (k === i ? e.target.value : x)))} maxLength={110} className={`${sel} flex-1 text-sm`} placeholder="A key fact" />
                  <button onClick={() => setPoints(ps => ps.filter((_, k) => k !== i))} className="p-1 text-slate-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {points.length < 3 && <button onClick={() => setPoints(ps => [...ps, ''])} className="flex items-center gap-1 text-xs text-indigo-300 hover:text-white"><Plus className="w-3 h-3" /> Add a key point</button>}
              <div className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={show.source} onChange={e => setShow(s => ({ ...s, source: e.target.checked }))} />
                <input value={source} onChange={e => setSource(e.target.value)} className={`${sel} flex-1`} maxLength={80} />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={show.question} onChange={e => setShow(s => ({ ...s, question: e.target.checked }))} />
                <input value={question} onChange={e => setQuestion(e.target.value)} className={`${sel} flex-1`} maxLength={70} placeholder="A question for comments" />
                <select value="" onChange={e => e.target.value && setQuestion(e.target.value)} className={sel}><option value="">Questions…</option>{QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}</select>
              </div>
              <div className="flex flex-wrap gap-4 pl-1 text-xs text-slate-300">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={show.date} onChange={e => setShow(s => ({ ...s, date: e.target.checked }))} /> Date</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={show.emoji} onChange={e => setShow(s => ({ ...s, emoji: e.target.checked }))} /> Big {EMOJI[story.category] || '📰'}</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={show.handle} onChange={e => setShow(s => ({ ...s, handle: e.target.checked }))} /> Handle</label>
              </div>
            </section>
            <section className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">How other outlets put it — click to add as a key point</h3>
              <ul className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
                {story.headlines.map(h => (
                  <li key={h.url + h.text} className="flex items-start gap-2 text-xs">
                    <button disabled={points.length >= 3} onClick={() => setPoints(ps => [...ps, h.text.slice(0, 110)])} className="shrink-0 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 px-1.5 py-0.5 text-[10px]">+ point</button>
                    <span className="flex-1 text-slate-300">{h.text} <a href={h.url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-sky-300">— {h.outlet} ↗</a></span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <select value={themeId} onChange={e => { setThemeId(e.target.value); rememberTheme(e.target.value); }} className={sel}>
                <optgroup label="Classic">{THEME_PRESETS.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}</optgroup>
                {THEME_CATEGORIES.map(c => <optgroup key={c} label={c}>{THEME_LIBRARY.filter(t => t.category === c).map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}</optgroup>)}
              </select>
              {!sensitive && <button onClick={() => { const t = surpriseTheme(); setThemeId(t.id); rememberTheme(t.id); }} className="rounded-md bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-2 py-1 text-white">🎲 Surprise</button>}
              <label className="flex cursor-pointer items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-1" title="Your own photo (news photos belong to their agencies)">
                <ImagePlus className="w-3.5 h-3.5" /> {photo ? 'Change photo' : 'Your photo'}
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { if (photo) URL.revokeObjectURL(photo); setPhoto(URL.createObjectURL(f)); } }} />
              </label>
              {photo && <button onClick={() => { URL.revokeObjectURL(photo); setPhoto(null); }} className="text-slate-500 hover:text-white">Remove photo</button>}
            </section>
            <section className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Caption</h3>
                <button onClick={() => { navigator.clipboard.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="ml-auto flex items-center gap-1 text-xs text-slate-300 hover:text-white">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy</button>
              </div>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-950 border border-slate-700 p-2 text-xs text-slate-200 font-sans">{caption}</pre>
            </section>
            <section className="rounded-lg border border-slate-700 bg-slate-950/60 p-2.5 space-y-1">
              {story.outlets < 2 && <p className="flex items-center gap-1.5 text-xs text-amber-400"><AlertTriangle className="w-3.5 h-3.5" /> Only one outlet reports this so far — open it and check before posting.</p>}
              <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} /> I’ve checked the facts (opened the sources)</label>
            </section>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={download} disabled={busy} className="flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-2 text-white">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download JPEG</button>
              <button onClick={() => setReel(true)} disabled={!checked} title={disabledReason || ''} className="flex items-center gap-1.5 rounded-md bg-pink-600 hover:bg-pink-700 disabled:opacity-40 px-3 py-2 text-white"><Clapperboard className="w-4 h-4" /> Make Reel</button>
              <InstagramPublish renderImages={async () => [await render()]} caption={caption} kind="news" releaseId={`news:${story.id}`} disabledReason={disabledReason} />
              <FacebookPhotoPublish renderImages={async () => [await render()]} caption={caption} kind="news" releaseId={`news:${story.id}`} disabledReason={disabledReason} />
            </div>
            {err && <p className="text-xs text-amber-400">{err}</p>}
          </div>

          <div className="lg:sticky lg:top-4 self-start" style={{ width: W * SCALE, height: H * SCALE }}>
            <div style={{ transform: `scale(${SCALE})`, transformOrigin: 'top left', width: W, height: H }}>
              <div ref={ref} style={{ width: W, height: H, position: 'relative', overflow: 'hidden', background: frameBackground(theme), color: theme.text, fontFamily: withTamil(theme.bodyFont) }}>
                {photo && (
                  <>
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 700, overflow: 'hidden' }}><img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: theme.imageFilter }} /></div>
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 420, height: 300, background: `linear-gradient(180deg, transparent, ${theme.bg[0]})` }} />
                  </>
                )}
                {textureLayers(theme).map((s, i) => <div key={i} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...s }} />)}
                {show.emoji && !photo && <div style={{ position: 'absolute', right: -40, top: -30, fontSize: 420, opacity: 0.12, lineHeight: 1 }}>{EMOJI[story.category] || '📰'}</div>}
                <div style={{ position: 'absolute', left: 72, right: 72, top: photo ? 700 : 150, bottom: 170, display: 'flex', flexDirection: 'column', justifyContent: photo ? 'flex-start' : 'center', gap: 30 }}>
                  {show.label && label && <div style={{ alignSelf: 'flex-start', background: theme.accent, color: '#000', fontWeight: 900, fontSize: 32, letterSpacing: 3, padding: '10px 22px', borderRadius: 10, fontFamily: withTamil(theme.bodyFont) }}>{label}</div>}
                  <div style={{ ...titleStyle(theme, hSize), textTransform: 'none', lineHeight: 1.12, fontFamily: withTamil(theme.titleFont) }}>{headline}</div>
                  {points.filter(Boolean).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {points.filter(Boolean).map((p, i) => (
                        <div key={i} style={{ display: 'flex', gap: 18, fontSize: 36, lineHeight: 1.3, color: theme.text, opacity: 0.92 }}>
                          <span style={{ color: theme.accent, fontWeight: 900 }}>▸</span><span>{p}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {show.question && question && <div style={{ fontSize: 36, fontWeight: 700, color: theme.accent }}>{question}</div>}
                </div>
                <div style={{ position: 'absolute', left: 72, right: 72, bottom: 56, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 26, color: theme.text }}>
                  {show.source && source && <div style={{ opacity: 0.7 }}>{source}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span style={{ color: theme.accent }}>{show.handle ? handle : ''}</span>
                    <span style={{ opacity: 0.85 }}>{show.date ? today : ''}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {reel && <ReelMaker renderImages={async () => [await render()]} caption={caption} slideCount={1} title={headline.slice(0, 90)} handle={handle} accent={theme.accent} kind="news-reel" releaseId={`news:${story.id}`} slug={`news-${story.id}`} onClose={() => setReel(false)} />}
    </div>,
    document.body,
  );
}
