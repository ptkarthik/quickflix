'use client';
import { Overlay } from '@/components/ott/Overlay';
/* eslint-disable @next/next/no-img-element -- export-safe <img> via same-origin proxy */
import React, { useMemo, useRef, useState } from 'react';
import { Check, Clapperboard, Copy, Download, Loader2, X } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import { DayFilm, DayPerson, fmtDay, loadChecked, ordinal, saveChecked, tmdbImg } from '@/lib/onthisday';
import { proxied } from '@/lib/ott';
import { langName } from '@/lib/world';
import { THEME_PRESETS, frameBackground, presetById, textureLayers, titleStyle } from '@/lib/themes';
import { THEME_CATEGORIES, THEME_LIBRARY, freshEveryPost, rememberTheme, surpriseTheme } from '@/lib/themeLibrary';
import { InstagramPublish } from '@/components/ott/InstagramPublish';
import { FacebookPhotoPublish } from '@/components/ott/SocialPublish';
import { ReelMaker } from '@/components/ott/ReelMaker';

export type DaySubject = { type: 'birth' | 'death'; person: DayPerson } | { type: 'film'; film: DayFilm };

const W = 1080;
const H = 1350;
const SCALE = 0.42;
const INDUSTRY: Record<string, string> = { ta: 'Kollywood', te: 'Tollywood', hi: 'Bollywood', ml: 'Mollywood', kn: 'Sandalwood', mr: 'Marathi cinema', bn: 'Bengali cinema', en: 'Hollywood', ko: 'K-drama' };
const tag = (s: string) => s.normalize('NFKD').replace(/[^\w]/g, '');

export const subjectKey = (s: DaySubject) => (s.type === 'film' ? `film:${s.film.id}` : `${s.type}:${s.person.wikidataId}`);

function defaults(s: DaySubject) {
  if (s.type === 'film') {
    const f = s.film;
    return {
      kicker: f.years ? `${f.years} ${f.years === 1 ? 'YEAR' : 'YEARS'} OF` : 'ON THIS DAY',
      title: f.title,
      sub: `${f.kind === 'tv' ? 'First aired' : 'Released'} ${fmtDay(f.releaseDate)}`,
      line: [f.people ? `${f.kind === 'tv' ? 'Created by' : 'Directed by'} ${f.people.split(',')[0]}` : '', f.score ? `★ ${f.score.toFixed(1)} ${f.scoreSource || ''}`.trim() : ''].filter(Boolean).join('  •  '),
    };
  }
  const p = s.person;
  const known = p.knownFor.slice(0, 3).map(k => k.title).join(', ');
  if (s.type === 'birth') {
    return {
      kicker: p.death ? 'BIRTH ANNIVERSARY' : 'HAPPY BIRTHDAY',
      title: p.name,
      sub: p.death ? `Born ${fmtDay(p.birth)} · would have turned ${p.age}` : `Turns ${p.age} today`,
      line: known ? `Known for ${known}` : p.occupations.join(' · '),
    };
  }
  return {
    kicker: 'REMEMBERING',
    title: p.name,
    sub: `${p.birth?.slice(0, 4) || ''} – ${p.death?.slice(0, 4) || ''}`.trim().replace(/^– /, ''),
    line: p.years ? `${ordinal(p.years)} death anniversary${known ? ` · ${known}` : ''}` : known,
  };
}

function captionFor(s: DaySubject, handle: string, style: number) {
  if (s.type === 'film') {
    const f = s.film;
    const y = f.years || 0;
    const ind = INDUSTRY[f.language || ''] || langName(f.language) || '';
    const lines = [
      [`🎬 ${y} ${y === 1 ? 'year' : 'years'} of ${f.title}!`, `${f.kind === 'tv' ? 'First aired' : 'Released'} on ${fmtDay(f.releaseDate)}.`, f.people ? `${f.kind === 'tv' ? 'Created by' : 'Directed by'} ${f.people.split(',')[0]}.` : '', '', `Where were you when you first watched it? 👇`],
      [`On this day in ${f.year}, ${f.title} hit ${f.kind === 'tv' ? 'screens' : 'theatres'} 🍿`, '', `${y} years later — still on your rewatch list? Rate it 1–10 in the comments!`],
    ][style % 2];
    return [...lines, '', `Follow ${handle} for more`, `#${tag(f.title)} #${y}YearsOf${tag(f.title)} ${ind ? `#${tag(ind)}` : ''} #OnThisDay #Cinema`.replace(/\s+/g, ' ').trim()].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  }
  const p = s.person;
  const known = p.knownFor.slice(0, 3).map(k => `${k.title} (${k.year})`).join(', ');
  const ind = INDUSTRY[p.industry || ''] || '';
  const role = p.occupations[0]?.toLowerCase() || 'artist';
  const lines = s.type === 'birth'
    ? p.death
      ? [`Remembering ${p.name} on their birth anniversary 🙏`, `Born ${fmtDay(p.birth)}.`, known ? `Forever remembered for ${known}.` : '']
      : [
          [`🎂 Happy Birthday, ${p.name}!`, `Turning ${p.age} today.`, known ? `Favourite performance? ${known} — tell us 👇` : 'Drop your wishes 👇'],
          [`Wishing the wonderful ${role} ${p.name} a very happy birthday! 🎉`, known ? `From ${known} — which one is your favourite?` : '', 'Comment your wishes 👇'],
        ][style % 2]
    : [`Remembering ${p.name} 🕯️`, `${fmtDay(p.birth)} – ${fmtDay(p.death)}${p.years ? ` · ${ordinal(p.years)} death anniversary` : ''}.`, known ? `Their work lives on — ${known}.` : ''];
  const tags = s.type === 'birth' && !p.death ? `#HappyBirthday${tag(p.name)} #HBD${tag(p.name)}` : `#Remembering${tag(p.name)} #${tag(p.name)}`;
  return [...lines.filter(Boolean), '', `Follow ${handle} for more`, `${tags} ${ind ? `#${tag(ind)}` : ''} #OnThisDay #Cinema`.replace(/\s+/g, ' ').trim()].join('\n');
}

export function DayPostMaker({ subject, date, handle, onClose }: { subject: DaySubject; date: string; handle: string; onClose: () => void }) {
  const d0 = useMemo(() => defaults(subject), [subject]);
  const [kicker, setKicker] = useState(d0.kicker);
  const [title, setTitle] = useState(d0.title);
  const [sub, setSub] = useState(d0.sub);
  const [line, setLine] = useState(d0.line);
  const [show, setShow] = useState({ kicker: true, sub: true, line: true, handle: true, date: true });
  const images = useMemo(() => {
    if (subject.type === 'film') return [subject.film.backdropPath && tmdbImg(subject.film.backdropPath, 'w780'), subject.film.posterPath && tmdbImg(subject.film.posterPath, 'w780')].filter(Boolean) as string[];
    const p = subject.person;
    return [...p.images.map(i => tmdbImg(i, 'h632')!), ...p.knownFor.flatMap(k => [k.backdrop && tmdbImg(k.backdrop, 'w780'), k.poster && tmdbImg(k.poster, 'w500')]).filter(Boolean) as string[]];
  }, [subject]);
  const [img, setImg] = useState<string | null>(images[0] || null);
  const [layout, setLayout] = useState<'full' | 'split'>(subject.type === 'film' ? 'full' : 'split');
  const [posY, setPosY] = useState(subject.type === 'film' ? 50 : 20);
  const [zoom, setZoom] = useState(1);
  const [bw, setBw] = useState(subject.type === 'death' || (subject.type === 'birth' && !!subject.person.death));
  const [themeId, setThemeId] = useState(() => (freshEveryPost() ? surpriseTheme(subject.type === 'death' ? 'Black & white' : null).id : subject.type === 'film' ? 'brand' : subject.type === 'death' ? 'drama' : 'romance'));
  const theme = presetById(themeId) || THEME_PRESETS[0];
  const [capStyle, setCapStyle] = useState(0);
  const [caption, setCaption] = useState(() => captionFor(subject, handle, 0));
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reel, setReel] = useState(false);
  const key = subjectKey(subject);
  const [checked, setChecked] = useState(() => !!loadChecked()[`${date}|${key}`]);
  const ref = useRef<HTMLDivElement>(null);

  const toggleChecked = (v: boolean) => {
    const all = loadChecked();
    if (v) all[`${date}|${key}`] = new Date().toISOString();
    else delete all[`${date}|${key}`];
    saveChecked(all);
    setChecked(v);
  };

  const render = async (): Promise<Blob> => {
    if (!ref.current) throw new Error('Preview not ready');
    const opts = { width: W, height: H, pixelRatio: 1, includeQueryParams: true, quality: 0.95 };
    await toJpeg(ref.current, opts).catch(() => null);
    return (await fetch(await toJpeg(ref.current, opts))).blob();
  };
  const download = async () => {
    setBusy(true);
    setErr(null);
    try {
      const b = await render();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `${title.replace(/[^\w]+/g, '-').toLowerCase()}-${date}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The picture couldn’t be loaded — pick another one.');
    } finally {
      setBusy(false);
    }
  };

  const tSize = title.length > 26 ? 78 : title.length > 16 ? 96 : 118;
  const imgStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', objectPosition: `50% ${posY}%`, transform: `scale(${zoom})`, transformOrigin: `50% ${posY}%`, filter: bw ? 'grayscale(1) contrast(1.05)' : 'none' };
  const texts = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, textAlign: 'center', alignItems: 'center' }}>
      {show.kicker && kicker && <div style={{ fontFamily: theme.bodyFont, fontSize: 34, letterSpacing: 8, fontWeight: 700, color: theme.accent }}>{kicker}</div>}
      <div style={{ ...titleStyle(theme, tSize), maxWidth: 960 }}>{title}</div>
      {show.sub && sub && <div style={{ fontFamily: theme.bodyFont, fontSize: 40, fontWeight: 600, color: theme.text }}>{sub}</div>}
      {show.line && line && <div style={{ fontFamily: theme.bodyFont, fontSize: 30, color: theme.text, opacity: 0.8, maxWidth: 940, lineHeight: 1.3 }}>{line}</div>}
    </div>
  );
  const footer = (show.handle || show.date) && (
    <div style={{ position: 'absolute', left: 48, right: 48, bottom: 36, display: 'flex', justifyContent: 'space-between', fontFamily: theme.bodyFont, fontSize: 28, fontWeight: 700, color: theme.text, opacity: 0.9 }}>
      <span style={{ color: theme.accent }}>{show.handle ? handle : ''}</span>
      <span>{show.date ? fmtDay(date, false).toUpperCase() : ''}</span>
    </div>
  );

  const sel = 'rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs';
  const field = (label: string, k: keyof typeof show | null, v: string, set: (s: string) => void) => (
    <label className="flex items-center gap-2 text-xs">
      {k ? <input type="checkbox" checked={show[k]} onChange={e => setShow(s => ({ ...s, [k]: e.target.checked }))} /> : <span className="w-[13px]" />}
      <span className="w-16 text-slate-400">{label}</span>
      <input value={v} onChange={e => set(e.target.value)} className={`${sel} flex-1 min-w-0`} />
    </label>
  );
  const disabledReason = checked ? null : 'Tick “I’ve checked the facts” first.';
  const facts = subject.type === 'film'
    ? [`TMDB date: ${fmtDay(subject.film.releaseDate)}`, subject.film.dateConfirmed === true ? '✓ Wikidata lists the same date' : subject.film.dateConfirmed === false ? `⚠ Wikidata lists ${subject.film.otherDates.map(x => fmtDay(x)).join(', ')} — not this day` : 'Not cross-checked', subject.film.indiaDate ? `India release (Wikidata): ${fmtDay(subject.film.indiaDate)}` : '']
    : [`${subject.type === 'birth' ? 'Born' : 'Died'} (Wikidata): ${fmtDay(subject.type === 'birth' ? subject.person.birth : subject.person.death)}`, subject.person.sourcesAgree === true ? '✓ TMDB agrees' : subject.person.sourcesAgree === false ? `⚠ TMDB says ${fmtDay(subject.type === 'birth' ? subject.person.tmdbBirth : subject.person.tmdbDeath)}` : 'TMDB has no date to compare'];

  return (
    <Overlay>
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/70 p-4">
      <div className="w-full max-w-6xl rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">Make a post — {title}</h2>
          <button onClick={onClose} className="ml-auto p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="space-y-3 text-sm">
            <section className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Text on the picture</h3>
              {field('Top line', 'kicker', kicker, setKicker)}
              {field('Name', null, title, setTitle)}
              {field('Line 2', 'sub', sub, setSub)}
              {field('Line 3', 'line', line, setLine)}
              <div className="flex gap-4 pl-[21px] text-xs text-slate-300">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={show.handle} onChange={e => setShow(s => ({ ...s, handle: e.target.checked }))} /> Handle</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={show.date} onChange={e => setShow(s => ({ ...s, date: e.target.checked }))} /> Date</label>
              </div>
            </section>
            <section className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Picture</h3>
              {images.length ? (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {images.map(u => (
                    <button key={u} onClick={() => setImg(u)} className={`shrink-0 rounded-md overflow-hidden border-2 ${img === u ? 'border-indigo-500' : 'border-transparent'}`}>
                      <img src={u} alt="" className="h-20 w-auto object-cover" />
                    </button>
                  ))}
                </div>
              ) : <p className="text-xs text-amber-400">No pictures found on TMDB — the post will use the theme background.</p>}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                <select value={layout} onChange={e => setLayout(e.target.value as 'full' | 'split')} className={sel}><option value="split">Picture top, text below</option><option value="full">Full picture, text on top</option></select>
                <label className="flex items-center gap-1.5">Position <input type="range" min={0} max={100} value={posY} onChange={e => setPosY(+e.target.value)} /></label>
                <label className="flex items-center gap-1.5">Zoom <input type="range" min={1} max={1.8} step={0.05} value={zoom} onChange={e => setZoom(+e.target.value)} /></label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={bw} onChange={e => setBw(e.target.checked)} /> Black &amp; white</label>
                <select value={themeId} onChange={e => { setThemeId(e.target.value); rememberTheme(e.target.value); }} className={sel}>
                  <optgroup label="Classic">{THEME_PRESETS.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}</optgroup>
                  {THEME_CATEGORIES.map(c => (
                  <optgroup key={c} label={c}>{THEME_LIBRARY.filter(t => t.category === c).map(t => <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>)}</optgroup>
                ))}
                </select>
                <button onClick={() => { const t = surpriseTheme(); setThemeId(t.id); rememberTheme(t.id); }} className="rounded-md bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-2 py-1 text-white">🎲 Surprise</button>
              </div>
            </section>
            <section className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Caption</h3>
                <button onClick={() => { const n = capStyle + 1; setCapStyle(n); setCaption(captionFor(subject, handle, n)); }} className="text-xs text-indigo-300 hover:text-white">Another style</button>
                <button onClick={() => { navigator.clipboard.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="ml-auto flex items-center gap-1 text-xs text-slate-300 hover:text-white">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy</button>
              </div>
              <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={7} className="w-full rounded-md bg-slate-950 border border-slate-700 p-2 text-xs text-slate-200" />
            </section>
            <section className="rounded-lg border border-slate-700 bg-slate-950/60 p-2.5 space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Check the facts</h3>
              <ul className="text-xs text-slate-300 space-y-0.5">{facts.filter(Boolean).map(f => <li key={f} className={f.startsWith('⚠') ? 'text-amber-400' : ''}>{f}</li>)}</ul>
              <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={checked} onChange={e => toggleChecked(e.target.checked)} /> I’ve checked the facts (date, age, films)</label>
            </section>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={download} disabled={busy} className="flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-2 text-white">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download JPEG</button>
              <button onClick={() => setReel(true)} disabled={!checked} title={disabledReason || ''} className="flex items-center gap-1.5 rounded-md bg-pink-600 hover:bg-pink-700 disabled:opacity-40 px-3 py-2 text-white"><Clapperboard className="w-4 h-4" /> Make Reel</button>
              <InstagramPublish renderImages={async () => [await render()]} caption={caption} kind={`onthisday-${subject.type}`} releaseId={key} disabledReason={disabledReason} />
              <FacebookPhotoPublish renderImages={async () => [await render()]} caption={caption} kind={`onthisday-${subject.type}`} releaseId={key} disabledReason={disabledReason} />
            </div>
            {err && <p className="text-xs text-amber-400">{err}</p>}
          </div>

          <div className="lg:sticky lg:top-4 self-start" style={{ width: W * SCALE, height: H * SCALE }}>
            <div style={{ transform: `scale(${SCALE})`, transformOrigin: 'top left', width: W, height: H }}>
              <div ref={ref} style={{ width: W, height: H, position: 'relative', overflow: 'hidden', background: frameBackground(theme) }}>
                {layout === 'full' ? (
                  <>
                    {img && <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}><img src={proxied(img)!} alt="" crossOrigin="anonymous" style={imgStyle} /></div>}
                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 30%, ${theme.bg[1]}dd 68%, ${theme.bg[1]} 100%)` }} />
                    <div style={{ position: 'absolute', left: 48, right: 48, bottom: 120 }}>{texts}</div>
                  </>
                ) : (
                  <>
                    {img && <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 860, overflow: 'hidden' }}><img src={proxied(img)!} alt="" crossOrigin="anonymous" style={imgStyle} /></div>}
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 640, height: 220, background: `linear-gradient(180deg, transparent, ${theme.bg[0]})` }} />
                    <div style={{ position: 'absolute', left: 48, right: 48, top: 880, bottom: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{texts}</div>
                  </>
                )}
                {textureLayers(theme).map((s, i) => <div key={i} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...s }} />)}
                {footer}
              </div>
            </div>
          </div>
        </div>
      </div>
      {reel && <ReelMaker renderImages={async () => [await render()]} caption={caption} slideCount={1} title={title} handle={handle} accent={theme.accent} kind={`onthisday-${subject.type}`} releaseId={key} slug={title.replace(/[^\w]+/g, '-').toLowerCase()} onClose={() => setReel(false)} />}
    </div>
    </Overlay>
  );
}
