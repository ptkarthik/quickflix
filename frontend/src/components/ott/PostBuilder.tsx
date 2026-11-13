'use client';
import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { LANGUAGES, OttRelease, addDays, displayTitle, fmtDate, fmtRange, picksCaption, todayIst, weekStart, weeklyCaption } from '@/lib/ott';
import { OTT_DOMAIN } from '@/lib/postDomain';
import { SlideBrand } from './OttSlides';
import { SinglePostEditor } from './SinglePostEditor';
import { CarouselComposer, CustomSlide, newCustomSlide } from './CarouselComposer';
import { HeadingPicker } from './HeadingPicker';

type Mode = 'weekly' | 'picks' | 'single';
const MODE_LABEL: Record<Mode, string> = { single: 'Single title (editor)', weekly: 'This Week on OTT', picks: 'Top Picks' };

/** localStorage-backed state. Builders only mount client-side (after data loads), so lazy reads are safe. */
export function usePersistentState<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = (next: T) => {
    setV(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };
  return [v, set] as const;
}

/** Handle, accent colour, extra hashtags (+ cover / end-slide switches for carousels). Shared by both desks. */
export function BrandSection({
  brand, setBrand, extraTags, setExtraTags, carousel, hideCover, setHideCover, includeOutro, setIncludeOutro,
}: {
  brand: SlideBrand; setBrand: (b: SlideBrand) => void; extraTags: string; setExtraTags: (s: string) => void;
  carousel: boolean; hideCover: boolean; setHideCover: (v: boolean) => void; includeOutro: boolean; setIncludeOutro: (v: boolean) => void;
}) {
  return (
    <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Brand</h3>
      <div className="flex gap-2">
        <input value={brand.handle} onChange={e => setBrand({ ...brand, handle: e.target.value })}
          className="flex-1 rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm" placeholder="@yourhandle" />
        <input type="color" value={brand.accent} onChange={e => setBrand({ ...brand, accent: e.target.value })}
          className="h-10 w-12 rounded-md bg-slate-950 border border-slate-700" title="Accent colour" />
      </div>
      <input value={extraTags} onChange={e => setExtraTags(e.target.value)}
        className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm" placeholder="Your extra hashtags, e.g. #ChennaiMovieBuff" />
      {carousel && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
          <label className="flex items-center gap-2"><input type="checkbox" checked={!hideCover} onChange={e => setHideCover(!e.target.checked)} /> Cover slide</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={includeOutro} onChange={e => setIncludeOutro(e.target.checked)} /> “Follow” end slide</label>
        </div>
      )}
    </section>
  );
}

export function ModeSwitch<M extends string>({ modes, labels, mode, onChange }: { modes: M[]; labels: Record<M, string>; mode: M; onChange: (m: M) => void }) {
  return (
    <div className="flex flex-wrap rounded-lg bg-slate-900 p-1 border border-slate-800 gap-0.5">
      {modes.map(m => (
        <button key={m} onClick={() => onChange(m)}
          className={`flex-1 py-2 px-2 text-sm font-semibold rounded-md whitespace-nowrap ${mode === m ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
          {labels[m]}
        </button>
      ))}
    </div>
  );
}

export function PostBuilder({ approved, initialSingleId, onChanged }: { approved: OttRelease[]; initialSingleId?: string | null; onChanged?: (r: OttRelease) => void }) {
  const [mode, setMode] = useState<Mode>(initialSingleId ? 'single' : 'weekly');
  const [brand, setBrand] = usePersistentState<SlideBrand>('ott.brand', { handle: '@yourhandle', accent: '#FACC15' });
  const [extraTags, setExtraTags] = usePersistentState<string>('ott.extraTags', '');
  const [includeOutro, setIncludeOutro] = usePersistentState<boolean>('ott.outro', true);
  const [hideCover, setHideCover] = useState(false);
  const [customSlides, setCustomSlides] = useState<CustomSlide[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // weekly
  const [from, setFrom] = useState(() => weekStart(todayIst()));
  const to = addDays(from, 6);
  const [langs, setLangs] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  // picks
  const [heading, setHeading] = useState('Top OTT Picks This Weekend');
  const [coverKicker, setCoverKicker] = useState('OTT picks');
  const [coverSub, setCoverSub] = useState<string | null>(null);
  const [pickIds, setPickIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pickFilter, setPickFilter] = useState('');

  const weekItems = useMemo(
    () =>
      approved
        .filter(r => r.releaseDate && r.releaseDate >= from && r.releaseDate <= to)
        .filter(r => langs.length === 0 || (r.language && langs.includes(r.language)))
        .sort((a, b) => (a.releaseDate || '').localeCompare(b.releaseDate || '')),
    [approved, from, to, langs],
  );
  const weeklySelected = weekItems.filter(r => !excluded.has(r.id));
  const picks = pickIds.map(id => approved.find(r => r.id === id)).filter(Boolean) as OttRelease[];
  const items = mode === 'weekly' ? weeklySelected : picks;

  /** From the single-title editor: its finished post becomes a slide. */
  const addFromEditor = (blob: Blob, label: string) => {
    setCustomSlides(cs => [...cs, newCustomSlide(URL.createObjectURL(blob), label, true)]);
    setNotice(`Added “${label}” as a slide — open This Week on OTT or Top Picks to place it.`);
    setTimeout(() => setNotice(null), 5000);
  };

  const togglePick = (id: string) => setPickIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  const movePick = (idx: number, dir: -1 | 1) =>
    setPickIds(ids => {
      const next = [...ids];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return ids;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const pickPool = approved
    .filter(r => !pickFilter || r.title.toLowerCase().includes(pickFilter.toLowerCase()) || (r.platform || '').toLowerCase().includes(pickFilter.toLowerCase()))
    .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));

  const modeSwitch = <ModeSwitch modes={['single', 'weekly', 'picks'] as Mode[]} labels={MODE_LABEL} mode={mode} onChange={setMode} />;
  const brandSection = (
    <BrandSection brand={brand} setBrand={setBrand} extraTags={extraTags} setExtraTags={setExtraTags} carousel={mode !== 'single'}
      hideCover={hideCover} setHideCover={setHideCover} includeOutro={includeOutro} setIncludeOutro={setIncludeOutro} />
  );

  if (mode === 'single') {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(380px,560px)_1fr] gap-5 items-start">
          {modeSwitch}
          {brandSection}
        </div>
        {notice && <p className="text-xs text-emerald-300">{notice}</p>}
        <SinglePostEditor approved={approved} brand={brand} extraTags={extraTags} initialId={initialSingleId} onChanged={onChanged} onAddToCarousel={addFromEditor} />
      </div>
    );
  }

  const controls =
    mode === 'weekly' ? (
      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Week</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setFrom(addDays(from, -7))} className="p-2 rounded-md bg-slate-800 hover:bg-slate-700"><ChevronLeft className="w-4 h-4" /></button>
          <div className="flex-1 text-center text-sm font-semibold">{fmtRange(from, to)}</div>
          <button onClick={() => setFrom(addDays(from, 7))} className="p-2 rounded-md bg-slate-800 hover:bg-slate-700"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGES.filter(l => approved.some(r => r.language === l.code)).map(l => (
            <button key={l.code}
              onClick={() => setLangs(langs.includes(l.code) ? langs.filter(x => x !== l.code) : [...langs, l.code])}
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${langs.includes(l.code) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {l.label}
            </button>
          ))}
          {langs.length > 0 && <button onClick={() => setLangs([])} className="px-2 py-1 text-xs text-slate-500 hover:text-white">All languages</button>}
        </div>
        {weekItems.length === 0 ? (
          <p className="text-sm text-slate-500">No approved releases dated this week. Approve items in the Review Queue or add them manually.</p>
        ) : (
          <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {weekItems.map(r => (
              <li key={r.id}>
                <label className="flex items-center gap-2 text-sm cursor-pointer rounded-md px-2 py-1.5 hover:bg-slate-800">
                  <input type="checkbox" checked={!excluded.has(r.id)}
                    onChange={() => { const n = new Set(excluded); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); setExcluded(n); }} />
                  <span className="flex-1 truncate">{displayTitle(r)}</span>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{r.platform || 'TBA'} • {fmtDate(r.releaseDate)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    ) : (
      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Heading</h3>
        <HeadingPicker
          value={{ kicker: coverKicker, heading, sub: coverSub ?? `${picks.length} titles worth your time` }}
          onChange={v => { setHeading(v.heading); setCoverKicker(v.kicker); setCoverSub(v.sub); }}
          ctx={{ n: picks.length || 3, kind: picks.length && picks.every(p => p.contentType === 'tv') ? 'tv' : picks.length && picks.every(p => p.contentType === 'movie') ? 'movie' : 'mixed', desk: 'ott' }}
          edited={heading !== 'Top OTT Picks This Weekend' || coverKicker !== 'OTT picks' || coverSub !== null}
          onReset={() => { setHeading('Top OTT Picks This Weekend'); setCoverKicker('OTT picks'); setCoverSub(null); }}
        />
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pt-2">Your picks (in order)</h3>
        {picks.length === 0 && <p className="text-sm text-slate-500">Choose titles below.</p>}
        <ol className="space-y-2">
          {picks.map((r, idx) => (
            <li key={r.id} className="rounded-md bg-slate-950 border border-slate-800 p-2 space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold text-indigo-400 w-5">{idx + 1}</span>
                <span className="flex-1 truncate">{displayTitle(r)}</span>
                <button onClick={() => movePick(idx, -1)} className="p-1 text-slate-500 hover:text-white"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => movePick(idx, 1)} className="p-1 text-slate-500 hover:text-white"><ArrowDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => togglePick(r.id)} className="p-1 text-slate-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
              </div>
              <input value={notes[r.id] || ''} onChange={e => setNotes({ ...notes, [r.id]: e.target.value })} maxLength={90}
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs" placeholder="Your one-line reason (optional, shown on slide)" />
            </li>
          ))}
        </ol>
        <input value={pickFilter} onChange={e => setPickFilter(e.target.value)} className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm" placeholder="Search approved titles or platform…" />
        <ul className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {pickPool.map(r => (
            <li key={r.id}>
              <button onClick={() => togglePick(r.id)}
                className={`w-full flex items-center gap-2 text-left text-sm rounded-md px-2 py-1.5 ${pickIds.includes(r.id) ? 'bg-indigo-600/20 text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
                {pickIds.includes(r.id) ? <Check className="w-3.5 h-3.5 text-indigo-400" /> : <span className="w-3.5" />}
                <span className="flex-1 truncate">{displayTitle(r)}</span>
                <span className="text-xs text-slate-500">{r.platform || 'TBA'}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <CarouselComposer
      domain={OTT_DOMAIN}
      items={items}
      pool={approved}
      brand={brand}
      controlsTop={<>{modeSwitch}{brandSection}</>}
      controls={controls}
      cover={mode === 'weekly'
        ? { kicker: 'This week on OTT', heading: 'OTT Releases', subheading: fmtRange(from, to) }
        : { kicker: coverKicker, heading, subheading: coverSub ?? `${items.length} titles worth your time` }}
      outroLine={mode === 'weekly' ? 'Which one are you watching first?' : 'Which one is your pick?'}
      titleExtras={(r, rank) => (mode === 'picks' ? { rank, note: notes[r.id] } : {})}
      includeOutro={includeOutro} setIncludeOutro={setIncludeOutro}
      hideCover={hideCover} setHideCover={setHideCover}
      customSlides={customSlides} setCustomSlides={setCustomSlides}
      captionTemplate={(ordered, ai) =>
        mode === 'weekly' ? weeklyCaption(ordered, from, to, brand.handle, extraTags, ai) : picksCaption(ordered, heading, notes, brand.handle, extraTags, ai)}
      aiRequest={(ordered, tone, language) => OTT_DOMAIN.aiCaption({ kind: mode === 'picks' ? 'picks' : 'weekly', releaseIds: ordered.map(r => r.id), tone, language, heading })}
      captionKey={mode}
      publishKind={mode === 'picks' ? 'picks' : 'weekly'}
      slug={mode === 'weekly' ? `ott-week-${from}` : `ott-picks-${todayIst()}`}
      onRemoveItem={id => (mode === 'weekly' ? setExcluded(ex => new Set(ex).add(id)) : setPickIds(ids => ids.filter(x => x !== id)))}
      emptyHint="Select titles on the left, or add your own slides with “Add slide”."
    />
  );
}
