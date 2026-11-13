'use client';
import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { LANGUAGES, PUBLISHABLE, TRUST_STYLE, addDays, fmtDate, fmtRange, todayIst, weekStart } from '@/lib/ott';
import { CinemaRelease, cinemaBucket } from '@/lib/cinema';
import { CINEMA_DOMAIN, PostItem, cinemaPostItem } from '@/lib/postDomain';
import {
  CINEMA_CTAS, CinemaPostKind, cinemaDateLine, cinemaListCaption, ctaOf, monthLabel, recentDateChange,
} from '@/lib/cinemaCaptions';
import { SlideBrand } from '@/components/ott/OttSlides';
import { SinglePostEditor } from '@/components/ott/SinglePostEditor';
import { CarouselComposer, CustomSlide, newCustomSlide } from '@/components/ott/CarouselComposer';
import { BrandSection, ModeSwitch, usePersistentState } from '@/components/ott/PostBuilder';
import { HeadingPicker } from '@/components/ott/HeadingPicker';

type Mode = 'single' | CinemaPostKind;
const MODES: Mode[] = ['single', 'weekly', 'month', 'now', 'postponed', 'picks'];
const MODE_LABEL: Record<Mode, string> = {
  single: 'Single film (editor)',
  weekly: 'This week',
  month: 'This month',
  now: 'Now in cinemas',
  postponed: 'Date changes',
  picks: 'My picks',
};
const DEFAULT_CTA: Record<CinemaPostKind, string> = { weekly: 'book', month: 'excited', now: 'watch', postponed: 'excited', picks: 'watch' };

const dayDate = (d?: string | null) => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' });
const byDate = (a: PostItem, b: PostItem) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999') || a.title.localeCompare(b.title);

/**
 * Instagram posts for cinemas: the same editor, carousel, themes, AI posters, AI captions and one-click posting
 * as OTT — fed only with films you approved in the Cinema Desk.
 */
export function CinemaPostBuilder({ approved, initialSingleId, onChanged }: { approved: CinemaRelease[]; initialSingleId?: string | null; onChanged?: (r: CinemaRelease) => void }) {
  const today = todayIst();
  const films = useMemo(() => approved.map(cinemaPostItem), [approved]);
  const [mode, setMode] = useState<Mode>(initialSingleId ? 'single' : 'weekly');
  // Same brand as the OTT desk — it's the same Instagram account.
  const [brand, setBrand] = usePersistentState<SlideBrand>('ott.brand', { handle: '@yourhandle', accent: '#FACC15' });
  const [extraTags, setExtraTags] = usePersistentState<string>('cinema.extraTags', '');
  const [includeOutro, setIncludeOutro] = usePersistentState<boolean>('cinema.outro', true);
  const [hideCover, setHideCover] = useState(false);
  const [customSlides, setCustomSlides] = useState<CustomSlide[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const [from, setFrom] = useState(() => weekStart(today));
  const to = addDays(from, 6);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [langs, setLangs] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [heading, setHeading] = useState('Must-watch in Cinemas This Weekend');
  const [coverKicker, setCoverKicker] = useState('Our picks');
  const [coverSub, setCoverSub] = useState<string | null>(null);
  const [pickIds, setPickIds] = useState<string[]>([]);
  const [ctas, setCtas] = useState<Record<string, string>>({});
  const kind: CinemaPostKind = mode === 'single' ? 'weekly' : mode;
  const cta = ctas[kind] || DEFAULT_CTA[kind];

  const langOk = (r: PostItem) => !langs.length || (r.language && langs.includes(r.language)) || (r.cinema?.alsoIn || '').split(',').some(l => langs.includes(l));
  const notOnOtt = (r: PostItem) => !(r.cinema?.ottDate && r.cinema.ottDate <= today);

  /** Every film that fits this post type (before you untick any). */
  const candidates = useMemo(() => {
    let list: PostItem[];
    if (kind === 'weekly') list = films.filter(r => r.releaseDate && r.releaseDate >= from && r.releaseDate <= to);
    else if (kind === 'month') list = films.filter(r => r.releaseDate?.startsWith(month) && notOnOtt(r));
    else if (kind === 'now') list = films.filter(r => r.cinema && cinemaBucket(r.cinema, today) === 'now');
    else if (kind === 'postponed') list = films.filter(r => recentDateChange(r.cinema, today));
    else list = films.filter(r => r.cinema && ['now', 'upcoming'].includes(cinemaBucket(r.cinema, today)));
    list = list.filter(langOk).sort(byDate);
    return kind === 'now' ? list.reverse() : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [films, kind, from, to, month, langs, today]);

  const items = kind === 'picks'
    ? (pickIds.map(id => films.find(r => r.id === id)).filter(Boolean) as PostItem[])
    : candidates.filter(r => !excluded.has(r.id));

  const addFromEditor = (blob: Blob, label: string) => {
    setCustomSlides(cs => [...cs, newCustomSlide(URL.createObjectURL(blob), label, true)]);
    setNotice(`Added “${label}” as a slide — open a carousel type (This week, This month…) to place it.`);
    setTimeout(() => setNotice(null), 5000);
  };

  const modeSwitch = <ModeSwitch modes={MODES} labels={MODE_LABEL} mode={mode} onChange={setMode} />;
  const brandSection = (
    <BrandSection brand={brand} setBrand={setBrand} extraTags={extraTags} setExtraTags={setExtraTags} carousel={mode !== 'single'}
      hideCover={hideCover} setHideCover={setHideCover} includeOutro={includeOutro} setIncludeOutro={setIncludeOutro} />
  );

  if (mode === 'single') {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(380px,640px)_1fr] gap-5 items-start">
          {modeSwitch}
          {brandSection}
        </div>
        {notice && <p className="text-xs text-emerald-300">{notice}</p>}
        <SinglePostEditor domain={CINEMA_DOMAIN} approved={films} brand={brand} extraTags={extraTags} initialId={initialSingleId}
          onChanged={r => r.cinema && onChanged?.(r.cinema)} onAddToCarousel={addFromEditor} />
      </div>
    );
  }

  const weakTrust = (r: PostItem) => !PUBLISHABLE.includes(r.trust);
  const filmRow = (r: PostItem, checked: boolean, toggle: () => void) => {
    const ch = recentDateChange(r.cinema, today);
    return (
      <li key={r.id} className="rounded-md hover:bg-slate-800/60 px-2 py-1.5 space-y-1">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={checked} onChange={toggle} />
          <span className="flex-1 truncate" title={r.title}>{r.title}</span>
          {weakTrust(r) && <span title={`${TRUST_STYLE[r.trust].label}: ${r.trustReason || ''}`}><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /></span>}
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {ch ? `${ch.to ? dayDate(ch.to) : 'TBA'} ← ${dayDate(ch.from)}` : dayDate(r.releaseDate)}
          </span>
        </label>
        {checked && (
          <input value={notes[r.id] || ''} onChange={e => setNotes({ ...notes, [r.id]: e.target.value })} maxLength={90}
            className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs" placeholder="Optional one-liner (shown on the slide & in the caption)" />
        )}
      </li>
    );
  };

  const controls = (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      {kind === 'weekly' && (
        <div className="flex items-center gap-2">
          <button onClick={() => setFrom(addDays(from, -7))} className="p-2 rounded-md bg-slate-800 hover:bg-slate-700"><ChevronLeft className="w-4 h-4" /></button>
          <div className="flex-1 text-center text-sm font-semibold">{fmtRange(from, to)}</div>
          <button onClick={() => setFrom(addDays(from, 7))} className="p-2 rounded-md bg-slate-800 hover:bg-slate-700"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
      {kind === 'month' && (
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(addDays(`${month}-01`, -1).slice(0, 7))} className="p-2 rounded-md bg-slate-800 hover:bg-slate-700"><ChevronLeft className="w-4 h-4" /></button>
          <div className="flex-1 text-center text-sm font-semibold">{monthLabel(month)}</div>
          <button onClick={() => setMonth(addDays(`${month}-01`, 32).slice(0, 7))} className="p-2 rounded-md bg-slate-800 hover:bg-slate-700"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}
      {kind === 'now' && <p className="text-xs text-slate-400">Approved films released in the last 5 weeks that aren’t streaming yet.</p>}
      {kind === 'postponed' && <p className="text-xs text-slate-400">Approved films whose release date changed in the last 30 days (from the postponement watcher). The old date is shown struck through.</p>}
      {kind === 'picks' && (
        <>
          <HeadingPicker
            value={{ kicker: coverKicker, heading, sub: coverSub ?? `${items.length} film${items.length === 1 ? '' : 's'} worth the ticket` }}
            onChange={v => { setHeading(v.heading); setCoverKicker(v.kicker); setCoverSub(v.sub); }}
            ctx={{ n: items.length || 3, kind: 'movie', desk: 'cinema' }}
            edited={heading !== 'Must-watch in Cinemas This Weekend' || coverKicker !== 'Our picks' || coverSub !== null}
            onReset={() => { setHeading('Must-watch in Cinemas This Weekend'); setCoverKicker('Our picks'); setCoverSub(null); }}
          />
          <p className="text-xs text-slate-400">Tick films in the order you want them ranked.</p>
        </>
      )}

      <div className="flex flex-wrap gap-1.5">
        {LANGUAGES.filter(l => films.some(r => r.language === l.code)).map(l => (
          <button key={l.code} onClick={() => setLangs(langs.includes(l.code) ? langs.filter(x => x !== l.code) : [...langs, l.code])}
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${langs.includes(l.code) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {l.label}
          </button>
        ))}
        {langs.length > 0 && <button onClick={() => setLangs([])} className="px-2 py-1 text-xs text-slate-500 hover:text-white">All languages</button>}
      </div>

      {candidates.length === 0 ? (
        <p className="text-sm text-slate-500">No approved films for this. Approve films in the Review Queue first{kind === 'weekly' || kind === 'month' ? ', or pick another week/month' : ''}.</p>
      ) : (
        <ul className="space-y-0.5 max-h-96 overflow-y-auto pr-1">
          {candidates.map(r =>
            kind === 'picks'
              ? filmRow(r, pickIds.includes(r.id), () => setPickIds(ids => (ids.includes(r.id) ? ids.filter(x => x !== r.id) : [...ids, r.id])))
              : filmRow(r, !excluded.has(r.id), () => setExcluded(ex => { const n = new Set(ex); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })),
          )}
        </ul>
      )}
      {items.some(weakTrust) && (
        <p className="text-[11px] text-amber-400">⚠ Some ticked films are not Confirmed/Corroborated — double-check their dates before posting.</p>
      )}

      <label className="block space-y-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Ending (caption & last slide)</span>
        <select value={cta} onChange={e => setCtas({ ...ctas, [kind]: e.target.value })} className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-2 text-sm">
          {CINEMA_CTAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
    </section>
  );

  const cover =
    kind === 'weekly' ? { kicker: 'This week in cinemas', heading: 'New in Cinemas', subheading: fmtRange(from, to) }
      : kind === 'month' ? { kicker: 'Coming to cinemas', heading: monthLabel(month).split(' ')[0], subheading: `${items.length} film${items.length === 1 ? "" : "s"} to watch in theatres` }
        : kind === 'now' ? { kicker: 'In theatres now', heading: 'Now Showing', subheading: `${items.length} film${items.length === 1 ? "" : "s"} playing near you` }
          : kind === 'postponed' ? { kicker: 'Release date update', heading: 'Date Changes', subheading: `${items.length} film${items.length === 1 ? '' : 's'} moved` }
            : { kicker: coverKicker, heading, subheading: coverSub ?? `${items.length} film${items.length === 1 ? "" : "s"} worth the ticket` };

  return (
    <div className="space-y-3">
      {notice && <p className="text-xs text-emerald-300">{notice}</p>}
      <CarouselComposer
        domain={CINEMA_DOMAIN}
        items={items}
        pool={films}
        brand={brand}
        controlsTop={<>{modeSwitch}{brandSection}</>}
        controls={controls}
        cover={cover}
        outroLine={ctaOf(cta).outro}
        titleExtras={(r, rank) => {
          const ch = kind === 'postponed' ? recentDateChange(r.cinema, today) : null;
          return {
            rank: kind === 'picks' ? rank : undefined,
            note: notes[r.id] || undefined,
            badge: ch ? (ch.later ? 'POSTPONED' : 'PREPONED') : kind === 'now' ? 'NOW SHOWING' : 'IN CINEMAS',
            dateLine: kind === 'now' ? (r.releaseDate ? `Since ${dayDate(r.releaseDate)}` : 'Now in cinemas') : cinemaDateLine(r, today, kind).replace(/^In cinemas /, ''),
            prevDateLine: ch ? dayDate(ch.from) : undefined,
          };
        }}
        includeOutro={includeOutro} setIncludeOutro={setIncludeOutro}
        hideCover={hideCover} setHideCover={setHideCover}
        customSlides={customSlides} setCustomSlides={setCustomSlides}
        captionTemplate={(ordered, ai) => cinemaListCaption(kind, ordered, { from, to, month, heading, notes, handle: brand.handle, extraTags, cta, today, ai })}
        aiRequest={(ordered, tone, language) => CINEMA_DOMAIN.aiCaption({ kind, releaseIds: ordered.map(r => r.id), tone, language, heading: kind === 'picks' ? heading : undefined })}
        captionKey={kind}
        publishKind={`cinema-${kind}`}
        slug={kind === 'weekly' ? `cinema-week-${from}` : kind === 'month' ? `cinema-${month}` : `cinema-${kind}-${today}`}
        onRemoveItem={id => (kind === 'picks' ? setPickIds(ids => ids.filter(x => x !== id)) : setExcluded(ex => new Set(ex).add(id)))}
        emptyHint="Tick films on the left, or add your own slides with “Add slide”."
      />
    </div>
  );
}
