'use client';
import { ClickToScroll } from '@/components/ott/ClickToScroll';
/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useState } from 'react';
import { HeadingPicker } from '@/components/ott/HeadingPicker';
import { ReadyPosts } from '@/components/ott/ReadyPosts';
import { ArrowDown, ArrowUp, Check, Loader2, RefreshCw, X } from 'lucide-react';
import { posterUrl } from '@/lib/ott';
import { WORLD_DOMAIN, worldPostItem } from '@/lib/postDomain';
import {
  WORLD_CTAS, WorldFacets, WorldFilter, WorldKind, WorldTitle, langName, scoreLabel, streamingIn, suggestHeading, worldApi, worldCtaOf, worldListCaption,
} from '@/lib/world';
import { SlideBrand } from '@/components/ott/OttSlides';
import { SinglePostEditor } from '@/components/ott/SinglePostEditor';
import { CarouselComposer, CustomSlide, newCustomSlide } from '@/components/ott/CarouselComposer';
import { BrandSection, ModeSwitch, usePersistentState } from '@/components/ott/PostBuilder';
import { WorldFilters } from './WorldFilters';
import { PresetGallery } from './PresetGallery';
import { ListPreset, presetFilter } from '@/lib/worldPresets';

type Mode = 'ready' | 'single' | 'bulk';
const MODE_LABEL: Record<Mode, string> = { ready: '⚡ Ready-made', single: 'Single title (editor)', bulk: 'Bulk suggestions (Top N)' };

/**
 * Instagram posts from the World Movies & Series database: one title in the editor, or a ranked
 * "Top N" carousel built from filters. Only approved titles go on a post; facts come from TMDB/OMDb.
 */
export function WorldPostBuilder({ initialSingle, facets, onChanged }: { initialSingle?: WorldTitle | null; facets: WorldFacets | null; onChanged?: (w: WorldTitle) => void }) {
  const [mode, setMode] = useState<Mode>(initialSingle ? 'single' : 'ready');
  const [brand, setBrand] = usePersistentState<SlideBrand>('ott.brand', { handle: '@yourhandle', accent: '#FACC15' });
  const [extraTags, setExtraTags] = usePersistentState<string>('world.extraTags', '');
  const [includeOutro, setIncludeOutro] = usePersistentState<boolean>('world.outro', true);
  const [hideCover, setHideCover] = useState(false);
  const [customSlides, setCustomSlides] = useState<CustomSlide[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // single: approved titles to pick from (best rated first) + the one you opened
  const [approved, setApproved] = useState<WorldTitle[]>(initialSingle ? [initialSingle] : []);
  useEffect(() => {
    worldApi.list({ status: 'APPROVED', sort: 'score', take: 200 }).then(r =>
      setApproved(prev => [...prev.filter(p => !r.items.some(i => i.id === p.id)), ...r.items]),
    ).catch(() => null);
  }, []);

  // bulk
  const [filter, setFilter] = useState<WorldFilter>({ kind: 'movie', minVotes: '500', sort: 'score' });
  const [results, setResults] = useState<WorldTitle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [picks, setPicks] = useState<WorldTitle[]>([]);
  const [n, setN] = useState(8); // 8 titles + cover + end slide = 10, the posting API limit
  const [headingEdited, setHeadingEdited] = useState<string | null>(null);
  /** The ready-made list you picked (its heading template uses {n}). Cleared when you change filters by hand. */
  const [preset, setPreset] = useState<ListPreset | null>(null);
  const heading = headingEdited ?? (preset ? preset.heading.replace('{n}', String(picks.length || n)) : suggestHeading(filter, picks.length || n));
  /** Your own label / subheading for the cover (null = suggested). */
  const [kickerEdited, setKickerEdited] = useState<string | null>(null);
  const [subEdited, setSubEdited] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [numbered, setNumbered] = useState(true);
  const [cta, setCta] = useState('watched');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const PAGE = 60;
  const loadMore = async () => {
    setMoreBusy(true);
    const r = await worldApi.list({ ...filter, skip: results.length, take: PAGE }).catch(() => null);
    if (r) {
      setResults(prev => [...prev, ...r.items.filter(t => !prev.some(p => p.id === t.id))]);
      setTotal(r.total);
    }
    setMoreBusy(false);
  };

  useEffect(() => {
    if (mode !== 'bulk') return;
    let stop = false;
    const t = setTimeout(() => {
      setLoading(true);
      worldApi.list({ ...filter, take: PAGE }).then(
        r => {
          if (stop) return;
          setResults(r.items);
          setTotal(r.total);
          setLoading(false);
        },
        () => { if (!stop) setLoading(false); },
      );
    }, 300);
    return () => { stop = true; clearTimeout(t); };
  }, [filter, mode]);

  const pickIds = new Set(picks.map(p => p.id));
  const togglePick = (t: WorldTitle) => setPicks(ps => (ps.some(p => p.id === t.id) ? ps.filter(p => p.id !== t.id) : [...ps, t]));
  const movePick = (i: number, d: -1 | 1) => setPicks(ps => { const n2 = [...ps]; const j = i + d; if (j < 0 || j >= n2.length) return ps; [n2[i], n2[j]] = [n2[j], n2[i]]; return n2; });
  const replaceTitle = (t: WorldTitle) => {
    setPicks(ps => ps.map(p => (p.id === t.id ? t : p)));
    setResults(rs => rs.map(r => (r.id === t.id ? t : r)));
    setApproved(as => (t.status === 'APPROVED' ? [...as.filter(a => a.id !== t.id), t] : as.filter(a => a.id !== t.id)));
    onChanged?.(t);
  };

  const approve = async (ids: string[]) => {
    await worldApi.bulkStatus({ ids, status: 'APPROVED' });
    const mark = (t: WorldTitle): WorldTitle => (ids.includes(t.id) ? { ...t, status: 'APPROVED' } : t);
    setResults(rs => rs.map(mark));
    setPicks(ps => ps.map(mark));
  };

  /** "Add top N": the first N results; any not approved yet need your OK first. */
  const addTop = async (list: WorldTitle[] = results, want = n, current: WorldTitle[] = picks) => {
    const have = new Set(current.map(c => c.id));
    const top = list.filter(r => r.status !== 'REJECTED' && !have.has(r.id)).slice(0, Math.max(0, want - current.length));
    if (!top.length) return;
    const pending = top.filter(t => t.status !== 'APPROVED');
    if (pending.length) {
      if (!confirm(`${pending.length} of these ${top.length} aren't approved yet:\n\n${pending.map(p => `• ${p.title}${p.year ? ` (${p.year})` : ''} — ${scoreLabel(p) || 'no rating'}`).join('\n')}\n\nApprove them and add to the post?`)) return;
      await approve(pending.map(p => p.id));
    }
    setPicks(ps => [...ps, ...top.map(t => ({ ...t, status: 'APPROVED' as const }))]);
  };

  /** Re-check facts (TMDB) + IMDb (OMDb) for every pick right before posting. */
  const recheck = async () => {
    for (let i = 0; i < picks.length; i++) {
      setBusy(`Re-checking ${i + 1}/${picks.length}…`);
      try {
        replaceTitle(await worldApi.refresh(picks[i].id, true));
      } catch {}
    }
    setBusy(null);
    setMsg('Ratings and “where to watch” re-checked just now.');
    setTimeout(() => setMsg(null), 4000);
  };

  /** One click on a ready-made list: filters + Top N + heading, then offer its top titles. */
  const pickPreset = async (p: ListPreset) => {
    if (picks.length && !confirm(`Start a new list “${p.heading.replace('{n}', String(p.n))}”? Your current ${picks.length} pick(s) will be cleared.`)) return;
    setPicks([]);
    setNotes({});
    setPreset(p);
    setHeadingEdited(null);
    setN(p.n);
    setFilter(presetFilter(p));
    const r = await worldApi.list({ ...presetFilter(p), take: 60 }).catch(() => null);
    if (r) {
      setResults(r.items);
      setTotal(r.total);
      await addTop(r.items, p.n, []);
    }
  };
  const setFilterByHand = (f: WorldFilter) => { setPreset(null); setFilter(f); };

  const addFromEditor = (blob: Blob, label: string) => {
    setCustomSlides(cs => [...cs, newCustomSlide(URL.createObjectURL(blob), label, true)]);
    setNotice(`Added “${label}” as a slide — open Bulk suggestions to place it.`);
    setTimeout(() => setNotice(null), 5000);
  };

  const items = useMemo(() => picks.filter(p => p.status === 'APPROVED').map(worldPostItem), [picks]);
  const approvedItems = useMemo(() => approved.map(worldPostItem), [approved]);
  const byId = (id: string) => picks.find(p => p.id === id);

  const modeSwitch = <ModeSwitch modes={['ready', 'single', 'bulk'] as Mode[]} labels={MODE_LABEL} mode={mode} onChange={setMode} />;
  const brandSection = (
    <BrandSection brand={brand} setBrand={setBrand} extraTags={extraTags} setExtraTags={setExtraTags} carousel={mode !== 'single'}
      hideCover={hideCover} setHideCover={setHideCover} includeOutro={includeOutro} setIncludeOutro={setIncludeOutro} />
  );

  if (mode === 'ready') return <ReadyPosts desk="world" brand={brand} extraTags={extraTags} controlsTop={<>{modeSwitch}{brandSection}</>} />;

  if (mode === 'single') {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(380px,560px)_1fr] gap-5 items-start">
          {modeSwitch}
          {brandSection}
        </div>
        {notice && <p className="text-xs text-emerald-300">{notice}</p>}
        <SinglePostEditor domain={WORLD_DOMAIN} approved={approvedItems} brand={brand} extraTags={extraTags} initialId={initialSingle?.id}
          onChanged={r => r.world && replaceTitle(r.world)} onAddToCarousel={addFromEditor} />
      </div>
    );
  }

  const kindWordOf = (n: number) => (filter.kind === 'tv' ? 'series' : filter.kind === 'movie' ? (n === 1 ? 'movie' : 'movies') : n === 1 ? 'title' : 'titles');
  const kindWord = kindWordOf(picks.length);
  const coverKicker = kickerEdited ?? (filter.kind === 'tv' ? 'Series picks' : filter.kind === 'movie' ? 'Movie picks' : 'Our picks');
  const coverSub = subEdited ?? `${picks.length} ${kindWord} worth your time`;
  const controls = (
    <>
      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">1 · Find titles {preset && <span className="normal-case font-normal text-indigo-300">— {preset.emoji} {preset.label}</span>}</h3>
        <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
          {([['movie', 'Movies'], ['tv', 'Series'], [undefined, 'Both']] as const).map(([k, label]) => (
            <button key={label} onClick={() => setFilterByHand({ ...filter, kind: k as WorldKind | undefined, genre: undefined })}
              className={`flex-1 py-1.5 rounded-md font-medium ${filter.kind === k ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>{label}</button>
          ))}
        </div>
        <WorldFilters filter={filter} onChange={setFilterByHand} facets={facets} compact />
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">{loading ? 'Searching…' : `${total.toLocaleString('en-IN')} match${total > results.length ? ` · showing ${results.length}` : ''}`}</span>
          <span className="ml-auto text-slate-400">Top</span>
          <input type="number" min={1} max={10} value={n} onChange={e => setN(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className="w-14 rounded-md bg-slate-950 border border-slate-700 px-2 py-1" />
          <button onClick={() => addTop()} disabled={!results.length || picks.length >= n} className="rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-3 py-1.5 font-semibold">Add top {Math.max(0, n - picks.length)}</button>
        </div>
        <ClickToScroll maxH="max-h-80" count={results.length} noun="titles"><ul className="space-y-0.5">
          {results.map(t => (
            <li key={t.id} className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm ${pickIds.has(t.id) ? 'bg-indigo-600/20' : 'hover:bg-slate-800/60'}`}>
              {t.posterPath ? <img src={posterUrl(t.posterPath, 'w342') || ''} alt="" className="w-6 h-9 rounded object-cover shrink-0" /> : <span className="w-6 h-9 rounded bg-slate-800 shrink-0" />}
              <span className="flex-1 min-w-0">
                <span className="block truncate" title={t.title}>{t.title}{t.year ? <span className="text-slate-500"> ({t.year})</span> : null}</span>
                <span className="block truncate text-[11px] text-slate-500">{[scoreLabel(t), langName(t.language), streamingIn(t)[0]].filter(Boolean).join(' • ')}</span>
              </span>
              {t.status === 'APPROVED' ? (
                <button onClick={() => togglePick(t)} className={`shrink-0 rounded-md px-2 py-1 text-[11px] ${pickIds.has(t.id) ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700'}`}>{pickIds.has(t.id) ? 'Added' : 'Add'}</button>
              ) : (
                <button onClick={async () => { await approve([t.id]); togglePick({ ...t, status: 'APPROVED' }); }} title="Approve (you checked it) and add"
                  className="shrink-0 rounded-md bg-emerald-700/80 hover:bg-emerald-600 px-2 py-1 text-[11px]">Approve + add</button>
              )}
            </li>
          ))}
          {!loading && results.length < total && (
            <li>
              <button onClick={loadMore} disabled={moreBusy} className="mt-1 w-full rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 py-1.5 text-xs text-slate-200">
                {moreBusy ? 'Loading…' : `Show ${Math.min(PAGE, total - results.length)} more (${results.length.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')})`}
              </button>
            </li>
          )}
        </ul></ClickToScroll>
        <p className="text-[11px] text-slate-500">Ratings show their source: IMDb (from OMDb) when available, otherwise TMDB. “Where to watch” = streaming in India (TMDB/JustWatch).</p>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">2 · Your post ({picks.length} {kindWord})</h3>
          {picks.length > 0 && (
            <button onClick={recheck} disabled={!!busy} className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px]">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} {busy || 'Re-check facts'}
            </button>
          )}
        </div>
        {msg && <p className="text-[11px] text-emerald-300">{msg}</p>}
        <HeadingPicker
          value={{ kicker: coverKicker, heading, sub: coverSub }}
          onChange={v => { setHeadingEdited(v.heading); setKickerEdited(v.kicker); setSubEdited(v.sub); }}
          ctx={{ n: picks.length || n, kind: filter.kind === 'tv' ? 'tv' : filter.kind === 'movie' ? 'movie' : 'mixed', lang: filter.language && !filter.language.includes(',') ? langName(filter.language) : null, genre: filter.genre && !filter.genre.includes(',') ? filter.genre : null, desk: 'world' }}
          edited={headingEdited !== null || kickerEdited !== null || subEdited !== null}
          onReset={() => { setHeadingEdited(null); setKickerEdited(null); setSubEdited(null); }}
        />
        <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={numbered} onChange={e => setNumbered(e.target.checked)} /> Numbered ranking (1, 2, 3…)</label>
        {picks.length === 0 && <p className="text-sm text-slate-500">Add titles above, or use “Add top {n}”.</p>}
        <ol className="space-y-2">
          {picks.map((t, i) => (
            <li key={t.id} className="rounded-md bg-slate-950 border border-slate-800 p-2 space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold text-indigo-400 w-5">{i + 1}</span>
                <span className="flex-1 truncate">{t.title}</span>
                <span className="text-[11px] text-slate-500">{scoreLabel(t)}</span>
                <button onClick={() => movePick(i, -1)} className="p-1 text-slate-500 hover:text-white"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => movePick(i, 1)} className="p-1 text-slate-500 hover:text-white"><ArrowDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => togglePick(t)} className="p-1 text-slate-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
              </div>
              <input value={notes[t.id] || ''} onChange={e => setNotes({ ...notes, [t.id]: e.target.value })} maxLength={90}
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs" placeholder="Your one-line reason (optional, shown on slide)" />
            </li>
          ))}
        </ol>
        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Ending (caption & last slide)</span>
          <select value={cta} onChange={e => setCta(e.target.value)} className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-2 text-sm">
            {WORLD_CTAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        {picks.length > 0 && <p className="text-[11px] text-slate-500 flex items-center gap-1"><Check className="w-3 h-3" /> All titles on the post are approved by you.</p>}
      </section>
    </>
  );

  return (
    <div className="space-y-3">
      {notice && <p className="text-xs text-emerald-300">{notice}</p>}
      <CarouselComposer
        domain={WORLD_DOMAIN}
        items={items}
        pool={[...items, ...approvedItems.filter(a => !pickIds.has(a.id))]}
        brand={brand}
        controlsTop={<>{modeSwitch}<PresetGallery activeId={preset?.id || null} n={n} onN={setN} onPick={pickPreset} />{brandSection}</>}
        controls={controls}
        cover={{ kicker: coverKicker, heading, subheading: subEdited ?? `${items.length} ${kindWordOf(items.length)} worth your time` }}
        outroLine={worldCtaOf(cta).outro}
        titleExtras={(r, rank) => {
          const w = r.world!;
          return { rank: numbered ? rank : undefined, note: notes[w.id] || undefined, ratingText: scoreLabel(w) };
        }}
        includeOutro={includeOutro} setIncludeOutro={setIncludeOutro}
        hideCover={hideCover} setHideCover={setHideCover}
        customSlides={customSlides} setCustomSlides={setCustomSlides}
        captionTemplate={(ordered, ai) => worldListCaption(ordered.map(o => o.world!).filter(Boolean), { heading, notes, numbered, handle: brand.handle, extraTags, cta, ai })}
        aiRequest={(ordered, tone, language) => WORLD_DOMAIN.aiCaption({ kind: 'picks', releaseIds: ordered.map(r => r.id), tone, language, heading })}
        captionKey="bulk"
        publishKind="world-picks"
        slug={`world-${heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`}
        onRemoveItem={id => { const t = byId(id); if (t) togglePick(t); }}
        emptyHint="Add titles on the left (or “Add top N”), or add your own slides with “Add slide”."
      />
    </div>
  );
}
