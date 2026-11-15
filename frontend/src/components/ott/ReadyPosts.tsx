'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Check, CheckCircle2, Loader2, Pencil, RefreshCw, RotateCcw, Search, ShieldCheck, Trash2, X, Zap } from 'lucide-react';
import { AiCaptionCopy, OTT_CTAS, OttRelease, addDays, ottApi, ottCtaOf, picksCaption, posterUrl, todayIst, weekStart, weeklyCaption } from '@/lib/ott';
import { CinemaRelease, cinemaApi } from '@/lib/cinema';
import { CINEMA_CTAS, CinemaPostKind, cinemaDateLine, cinemaListCaption, ctaOf, recentDateChange } from '@/lib/cinemaCaptions';
import { WORLD_CTAS, WorldTitle, scoreLabel, worldApi, worldCtaOf, worldListCaption } from '@/lib/world';
import { CINEMA_DOMAIN, OTT_DOMAIN, PostItem, WORLD_DOMAIN, cinemaPostItem, worldPostItem } from '@/lib/postDomain';
import { DEFAULT_CHOICE, ThemeChoice } from '@/lib/themes';
import { Desk, Dropped, ReadyInput, ReadyPost, ReadyStatus, buildCinema, buildOtt, buildWorld, cinemaMisfit, keepPeriods, ottMisfit, readyApi, usable, worldMisfit } from '@/lib/readyPosts';
import { SlideBrand } from './OttSlides';
import { CarouselComposer, CustomSlide, TitleSlideExtras } from './CarouselComposer';
import { ClickToScroll } from './ClickToScroll';

type Row = Omit<ReadyPost, 'status'> & { status: ReadyStatus };
const DOMAIN = { ott: OTT_DOMAIN, cinema: CINEMA_DOMAIN, world: WORLD_DOMAIN };
const DESK_WORD = { ott: 'OTT', cinema: 'Cinema', world: 'World' };

/**
 * "Ready-made" mode of a desk's post builder: posts the app makes every day from your titles.
 * Open one → everything in the normal carousel editor works (themes, slides, Reel, caption) → Post (with the usual confirm).
 */
export function ReadyPosts({ desk, ott = [], cinema = [], brand, extraTags, controlsTop, onAddedTitles, onApprovedOtt, onApprovedCinema }: {
  desk: Desk;
  /** OTT desk: all its releases (approved + trusted ones waiting for review are used) */
  ott?: OttRelease[];
  /** Cinema desk: all its releases (same rule) */
  cinema?: CinemaRelease[];
  /** titles you approved with "Accept" — the desk updates its lists */
  onApprovedOtt?: (r: OttRelease) => void;
  onApprovedCinema?: (r: CinemaRelease) => void;
  brand: SlideBrand;
  extraTags: string;
  controlsTop: React.ReactNode;
  /** World: titles approved through "Accept" (so the desk's lists can update) */
  onAddedTitles?: (ids: string[]) => void;
}) {
  const today = todayIst();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<'todo' | 'posted'>('todo');
  const [group, setGroup] = useState<string>('All');
  const autoRan = useRef(false);

  const ottById = useMemo(() => new Map(ott.map(r => [r.id, r])), [ott]);
  const cinemaById = useMemo(() => new Map(cinema.map(r => [r.id, r])), [cinema]);

  const load = useCallback(async () => {
    const res = await readyApi.list(desk);
    setRows(res.posts);
    setLastRefresh(res.lastRefresh);
    return res;
  }, [desk]);

  /** Today's refresh: build every post, keep your edits (dropping titles that stopped qualifying), clear old periods. */
  const refresh = useCallback(async (existing?: Row[]) => {
    setBusy(desk === 'world' ? 'Filling the ready-made lists… (about a minute)' : 'Making today’s ready-made posts…');
    setMsg(null);
    try {
      const current = existing ?? (await readyApi.list(desk)).posts;
      let posts: ReadyInput[] = [];
      const drops: Array<{ id: string; itemIds: string[]; dropped: Dropped[] }> = [];
      const at = new Date().toISOString();
      const edited = current.filter(p => p.edited && p.status !== 'POSTED' && p.status !== 'DISMISSED');
      if (desk === 'ott') {
        posts = buildOtt(ott, today);
        for (const p of edited) {
          const bad = p.itemIds.map(id => ({ id, why: ottMisfit(ottById.get(id), p) })).filter(x => x.why);
          if (bad.length) drops.push({ id: p.id, itemIds: p.itemIds.filter(id => !bad.some(b => b.id === id)), dropped: bad.map(b => ({ id: b.id, title: ottById.get(b.id)?.title || p.preview?.find(x => x.id === b.id)?.title || 'A title', why: b.why!, at })) });
        }
      } else if (desk === 'cinema') {
        posts = buildCinema(cinema, today);
        for (const p of edited) {
          const bad = p.itemIds.map(id => ({ id, why: cinemaMisfit(cinemaById.get(id), p, today) })).filter(x => x.why);
          if (bad.length) drops.push({ id: p.id, itemIds: p.itemIds.filter(id => !bad.some(b => b.id === id)), dropped: bad.map(b => ({ id: b.id, title: cinemaById.get(b.id)?.title || p.preview?.find(x => x.id === b.id)?.title || 'A film', why: b.why!, at })) });
        }
      } else {
        const recent = await readyApi.recentlyPosted('world').catch(() => []);
        posts = await buildWorld(today, recent);
        for (const p of edited) {
          const titles = await Promise.all(p.itemIds.map(id => worldApi.get(id).catch(() => undefined)));
          const bad = p.itemIds.map((id, i) => ({ id, why: worldMisfit(titles[i]) })).filter(x => x.why);
          if (bad.length) drops.push({ id: p.id, itemIds: p.itemIds.filter(id => !bad.some(b => b.id === id)), dropped: bad.map(b => ({ id: b.id, title: p.preview?.find(x => x.id === b.id)?.title || 'A title', why: b.why!, at })) });
        }
      }
      const res = await readyApi.sync(desk, { today, posts, drops, keepPeriods: keepPeriods(desk, today) });
      await load();
      const droppedN = drops.reduce((a, d) => a + d.dropped.length, 0);
      setMsg({ text: `Refreshed: ${res.added} new, ${res.refreshed} updated${res.kept ? `, ${res.kept} of yours kept as you left them` : ''}${droppedN ? `, ${droppedN} title${droppedN === 1 ? '' : 's'} dropped from your edited posts (see the card)` : ''}${res.removed ? `, ${res.removed} old removed` : ''}.` });
    } catch (e) {
      setMsg({ text: (e as Error).message, err: true });
    } finally {
      setBusy(null);
    }
  }, [desk, ott, cinema, ottById, cinemaById, today, load]);

  // first visit of the day → refresh automatically (once)
  useEffect(() => {
    let stop = false;
    readyApi.list(desk).then(res => {
      if (stop) return;
      setRows(res.posts);
      setLastRefresh(res.lastRefresh);
      if (autoRan.current) return;
      autoRan.current = true;
      if (res.lastRefresh !== today) refresh(res.posts);
    }, e => setMsg({ text: (e as Error).message, err: true }));
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desk]);

  const patchRow = (r: Row) => setRows(rs => rs?.map(x => (x.id === r.id ? r : x)) || null);
  const dismiss = async (r: Row) => {
    if (!confirm(`Delete “${r.heading}”?\n\nIt won't be made again for this ${r.periodKey === today ? 'day' : 'week'}.`)) return;
    await readyApi.update(r.id, { status: 'DISMISSED' });
    setRows(rs => rs?.filter(x => x.id !== r.id) || null);
    if (openId === r.id) setOpenId(null);
  };

  const open = rows?.find(r => r.id === openId) || null;
  if (open) {
    return (
      <ReadyEditor key={open.id} desk={desk} post={open} ott={ottById} cinema={cinemaById} allOtt={ott} allCinema={cinema} brand={brand} extraTags={extraTags} controlsTop={controlsTop}
        onBack={() => setOpenId(null)} onSaved={patchRow} onDelete={() => dismiss(open)} onApproved={onAddedTitles}
        onApprovedOtt={onApprovedOtt} onApprovedCinema={onApprovedCinema} />
    );
  }

  const todo = (rows || []).filter(r => r.status === 'READY' || r.status === 'NEEDS_OK');
  const posted = (rows || []).filter(r => r.status === 'POSTED').sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''));
  const shown = view === 'posted' ? posted : todo;
  const groups = ['All', ...new Set(todo.map(r => r.group))];
  const list = view === 'posted' || group === 'All' ? shown : shown.filter(r => r.group === group);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(380px,560px)_1fr] gap-5 items-start">
        <div className="space-y-4">{controlsTop}</div>
        <section className="space-y-2 rounded-xl border border-amber-800/50 bg-amber-950/10 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-amber-200"><Zap className="w-4 h-4" /> Ready-made {DESK_WORD[desk]} posts</h3>
          <p className="text-xs text-slate-400">
            {desk === 'world'
              ? 'Every ready-made list filled with the best-rated titles, plus fresh mixes every day. Titles you posted in the last 30 days are skipped.'
              : `Made every day — this week’s releases by language, platform and genre, what’s ${desk === 'ott' ? 'streaming now' : 'in cinemas now'}, what’s coming. Uses your approved titles plus confirmed ones still waiting in your Review Queue. A title that’s rejected or moves out of the week is dropped automatically.`}
            {' '}Posts with titles you haven’t approved say “Needs your OK” — Accept approves them (nothing is approved or posted without your click).
            {' '}Open one to change anything; your edits are kept.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button onClick={() => refresh()} disabled={!!busy} className="flex items-center gap-1.5 rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-3 py-1.5 font-semibold text-black">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh now
            </button>
            <span className="text-slate-500">{busy || (lastRefresh ? `Last refreshed ${lastRefresh === today ? 'today' : lastRefresh}` : 'Not made yet')}</span>
          </div>
          {msg && <p className={`text-xs ${msg.err ? 'text-red-400' : 'text-emerald-300'}`}>{msg.text}</p>}
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-800 text-xs mr-2">
          <button onClick={() => setView('todo')} className={`rounded-md px-3 py-1.5 font-semibold ${view === 'todo' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>To post ({todo.length})</button>
          <button onClick={() => setView('posted')} className={`rounded-md px-3 py-1.5 font-semibold ${view === 'posted' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Posted ({posted.length})</button>
        </div>
        {view === 'todo' && groups.map(g => (
          <button key={g} onClick={() => setGroup(g)} className={`rounded-full px-2.5 py-1 text-xs ${group === g ? 'bg-amber-500 text-black font-semibold' : 'bg-slate-800 text-slate-300 hover:text-white'}`}>
            {g}{g !== 'All' ? ` · ${todo.filter(r => r.group === g).length}` : ''}
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-amber-400" /></div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
          {busy ? busy : view === 'posted' ? 'Nothing posted from here yet.' : desk === 'world' ? 'No ready-made posts yet — press Refresh now.' : `No ready-made posts — approve some ${desk === 'ott' ? 'OTT releases' : 'films'} for this week, then Refresh now.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
          {list.map(r => <ReadyCard key={r.id} r={r} onOpen={() => setOpenId(r.id)} onDelete={() => dismiss(r)} />)}
        </div>
      )}
    </div>
  );
}

function ReadyCard({ r, onOpen, onDelete }: { r: Row; onOpen: () => void; onDelete: () => void }) {
  const pics = (r.preview || []).slice(0, 5);
  return (
    <div className={`group flex flex-col rounded-xl border bg-slate-900/70 p-3 ${r.status === 'NEEDS_OK' ? 'border-amber-700/60' : r.status === 'POSTED' ? 'border-emerald-800/60' : 'border-slate-800 hover:border-slate-600'}`}>
      <button onClick={onOpen} className="text-left space-y-2">
        <div className="flex h-24 gap-1 overflow-hidden rounded-md bg-slate-950">
          {pics.length === 0 && <div className="flex-1" />}
          {pics.map(p => (
            p.poster ? <img key={p.id} src={posterUrl(p.poster, 'w342') || ''} alt="" className="h-full w-16 shrink-0 object-cover" />
              : <div key={p.id} className="flex h-full w-16 shrink-0 items-center justify-center bg-slate-800 p-1 text-center text-[9px] text-slate-400">{p.title}</div>
          ))}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{r.emoji} {r.group}</div>
        <div className="font-bold leading-tight text-slate-100">{r.heading}</div>
        <div className="line-clamp-2 text-[11px] text-slate-400">{(r.preview || []).map(p => p.title).join(' · ') || `${r.itemIds.length} titles`}</div>
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">{r.itemIds.length} title{r.itemIds.length === 1 ? '' : 's'}</span>
        {r.status === 'NEEDS_OK' && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300">Needs your OK</span>}
        {r.status === 'POSTED' && <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300">Posted {r.postedAt ? new Date(r.postedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</span>}
        {r.edited && <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-sky-300">Edited by you</span>}
        {r.dropped.length > 0 && <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-red-300" title={r.dropped.map(d => `${d.title}: ${d.why}`).join('\n')}>{r.dropped.length} dropped</span>}
        <span className="ml-auto flex gap-1 opacity-70 group-hover:opacity-100">
          {r.permalink && <a href={r.permalink} target="_blank" rel="noreferrer" className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-200 hover:bg-slate-700">View</a>}
          <button onClick={onOpen} className="flex items-center gap-1 rounded bg-indigo-600 px-2 py-0.5 font-semibold text-white hover:bg-indigo-500"><Pencil className="w-3 h-3" /> Open</button>
          {r.status !== 'POSTED' && <button onClick={onDelete} title="Delete" className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>}
        </span>
      </div>
    </div>
  );
}

// ───────────────────────── one ready-made post, in the carousel editor ─────────────────────────

const CAPTION_HEAD = /^(🍿 OTT Releases This Week.*|🎬 New in Cinemas This Week.*|🗓 .* in Cinemas|🍿 Now Playing in Cinemas|⚠️ Release Date Updates)$/m;

function ReadyEditor({ desk, post, ott, cinema, allOtt, allCinema, brand, extraTags, controlsTop, onBack, onSaved, onDelete, onApproved, onApprovedOtt, onApprovedCinema }: {
  desk: Desk; post: Row; ott: Map<string, OttRelease>; cinema: Map<string, CinemaRelease>; allOtt: OttRelease[]; allCinema: CinemaRelease[];
  brand: SlideBrand; extraTags: string; controlsTop: React.ReactNode;
  onBack: () => void; onSaved: (r: Row) => void; onDelete: () => void; onApproved?: (ids: string[]) => void;
  onApprovedOtt?: (r: OttRelease) => void; onApprovedCinema?: (r: CinemaRelease) => void;
}) {
  /** approved here (before the desk's lists catch up) */
  const [okHere, setOkHere] = useState<Set<string>>(new Set());
  const today = todayIst();
  const domain = DOMAIN[desk];
  const [ids, setIds] = useState<string[]>(post.itemIds);
  const [kicker, setKicker] = useState(post.kicker);
  const [heading, setHeading] = useState(post.heading);
  const [sub, setSub] = useState(post.subheading);
  const [notes, setNotes] = useState<Record<string, string>>(post.notes || {});
  const [cta, setCta] = useState(post.cta || (desk === 'world' ? 'watched' : desk === 'cinema' ? 'book' : 'auto'));
  const [numbered, setNumbered] = useState(post.numbered ?? true);
  const [theme, setTheme] = useState<ThemeChoice>({ ...DEFAULT_CHOICE, base: post.themeBase || 'auto' });
  const [customSlides, setCustomSlides] = useState<CustomSlide[]>([]);
  const [hideCover, setHideCover] = useState(false);
  const [includeOutro, setIncludeOutro] = useState(true);
  const [status, setStatus] = useState<ReadyStatus>(post.status);
  const [save, setSave] = useState<'saved' | 'saving' | 'error' | null>(null);
  const [world, setWorld] = useState<Map<string, WorldTitle>>(new Map());
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PostItem[]>([]);
  const [busy, setBusy] = useState(false);

  // World titles: load the post's titles
  const idKey = ids.join(',');
  useEffect(() => {
    if (desk !== 'world') return;
    const missing = idKey.split(',').filter(Boolean);
    let stop = false;
    Promise.all(missing.map(id => worldApi.get(id).catch(() => null))).then(list => {
      if (stop) return;
      setWorld(m => { const n = new Map(m); list.forEach(t => t && n.set(t.id, t)); return n; });
    });
    return () => { stop = true; };
  }, [desk, idKey]);

  const itemOf = (id: string): PostItem | null => {
    const ok = <T extends { status: string }>(x: T | undefined) => (x && okHere.has(id) ? { ...x, status: 'APPROVED' } : x);
    if (desk === 'ott') return (ok(ott.get(id)) as PostItem | undefined) || null;
    if (desk === 'cinema') { const c = ok(cinema.get(id)) as CinemaRelease | undefined; return c ? cinemaPostItem(c) : null; }
    return world.get(id) ? worldPostItem(world.get(id)!) : null;
  };
  const items = ids.map(itemOf).filter(Boolean) as PostItem[];
  const loading = desk === 'world' && items.length < ids.length && ids.some(id => !world.has(id));

  // ── save your edits (debounced) ──
  const first = useRef(true);
  const editKey = JSON.stringify({ ids, kicker, heading, sub, notes, cta, numbered, base: theme.base });
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => {
      setSave('saving');
      const preview = ids.map(id => { const it = itemOf(id); const old = post.preview?.find(x => x.id === id); return { id, title: it?.title || old?.title || '', poster: it?.posterPath ?? old?.poster ?? null }; });
      readyApi.update(post.id, { itemIds: ids, preview, kicker, heading, subheading: sub, notes, cta, numbered, themeBase: theme.base })
        .then(r => { onSaved(r as Row); setSave('saved'); }, () => setSave('error'));
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editKey]);

  const move = (i: number, d: -1 | 1) => setIds(xs => { const n = [...xs]; const j = i + d; if (j < 0 || j >= n.length) return xs; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const remove = (id: string) => setIds(xs => xs.filter(x => x !== id));
  const addId = (it: PostItem) => {
    if (it.world) setWorld(m => new Map(m).set(it.world!.id, it.world!));
    setIds(xs => (xs.includes(it.id) ? xs : [...xs, it.id]));
    setQ(''); setHits([]);
  };
  const search = async (text: string) => {
    setQ(text);
    const f = text.trim().toLowerCase();
    if (f.length < 2) { setHits([]); return; }
    if (desk === 'ott') setHits(allOtt.filter(r => usable(r) && r.title.toLowerCase().includes(f)).slice(0, 8) as PostItem[]);
    else if (desk === 'cinema') setHits(allCinema.filter(r => usable(r) && r.title.toLowerCase().includes(f)).slice(0, 8).map(cinemaPostItem));
    else {
      const res = await worldApi.list({ q: text.trim(), take: 8, sort: 'score' }).catch(() => null);
      setHits((res?.items || []).map(worldPostItem));
    }
  };

  const unapproved: Array<{ id: string; title: string; year?: number | null }> = ids
    .map(id => (desk === 'world' ? world.get(id) : itemOf(id)))
    .filter((t): t is NonNullable<typeof t> => !!t && t.status !== 'APPROVED')
    .map(t => ({ id: t.id, title: t.title, year: 'year' in t ? (t.year as number | null) : null }));
  const accept = async () => {
    setBusy(true);
    try {
      if (unapproved.length) {
        const list = unapproved.map(t => t.id);
        if (desk === 'world') {
          await worldApi.bulkStatus({ ids: list, status: 'APPROVED' });
          setWorld(m => { const n = new Map(m); list.forEach(id => { const t = n.get(id); if (t) n.set(id, { ...t, status: 'APPROVED' }); }); return n; });
          onApproved?.(list);
        } else if (desk === 'ott') {
          await ottApi.bulkStatus(list, 'APPROVED');
          list.forEach(id => { const r = ott.get(id); if (r) onApprovedOtt?.({ ...r, status: 'APPROVED' }); });
        } else {
          await cinemaApi.bulkStatus(list, 'APPROVED');
          list.forEach(id => { const r = cinema.get(id); if (r) onApprovedCinema?.({ ...r, status: 'APPROVED' }); });
        }
        setOkHere(s => new Set([...s, ...list]));
      }
      const r = await readyApi.update(post.id, { status: 'READY' });
      setStatus('READY');
      onSaved(r as Row);
    } finally {
      setBusy(false);
    }
  };
  const resetToApp = async () => {
    if (!confirm('Forget your changes? The next refresh puts the app’s version back.')) return;
    const r = await readyApi.reset(post.id);
    onSaved(r as unknown as Row);
  };
  const markPosted = (permalink: string | null) => {
    readyApi.update(post.id, { status: 'POSTED', permalink }).then(r => { setStatus('POSTED'); onSaved(r as Row); }, () => null);
  };

  // ── per style: caption, slide extras, ending ──
  const style = post.style;
  const cinemaKind = (style.startsWith('cinema-') ? style.slice(7) : 'picks') as CinemaPostKind;
  const from = post.windowFrom || weekStart(today);
  const to = post.windowTo || addDays(weekStart(today), 6);
  const ctas: ReadonlyArray<{ id: string; label: string }> = desk === 'world' ? WORLD_CTAS : desk === 'cinema' ? CINEMA_CTAS : OTT_CTAS;
  const outroLine = desk === 'world' ? worldCtaOf(cta).outro : desk === 'cinema' ? ctaOf(cta).outro : cta !== 'auto' ? ottCtaOf(cta).outro : style === 'weekly' ? 'Which one are you watching first?' : 'Which one is your pick?';
  const headLine = (c: string) => post.templateId === 'week-all' && style !== 'cinema-weekly' ? c : c.replace(CAPTION_HEAD, `${post.emoji || '🎬'} ${heading}${sub && style !== 'picks' && style !== 'cinema-picks' ? ` (${sub})` : ''}`);
  const caption = (ordered: PostItem[], ai: AiCaptionCopy | null) => {
    if (desk === 'ott') return style === 'weekly' ? headLine(weeklyCaption(ordered, from, to, brand.handle, extraTags, ai, cta)) : picksCaption(ordered, heading, notes, brand.handle, extraTags, ai, cta);
    if (desk === 'cinema') return headLine(cinemaListCaption(cinemaKind, ordered, { from, to, month: (post.windowFrom || today).slice(0, 7), heading, notes, handle: brand.handle, extraTags, cta, today, ai }));
    return worldListCaption(ordered.map(o => o.world!).filter(Boolean), { heading, notes, numbered, handle: brand.handle, extraTags, cta, ai });
  };
  const titleExtras = (r: PostItem, rank: number): TitleSlideExtras => {
    if (desk === 'world') return { rank: numbered ? rank : undefined, note: notes[r.id] || undefined, ratingText: r.world ? scoreLabel(r.world) : undefined };
    if (desk === 'ott') return numbered ? { rank, note: notes[r.id] } : { note: notes[r.id] || undefined };
    const ch = cinemaKind === 'postponed' ? recentDateChange(r.cinema, today) : null;
    const day = (d?: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }) : '');
    return {
      rank: numbered ? rank : undefined, note: notes[r.id] || undefined,
      badge: ch ? (ch.later ? 'POSTPONED' : 'PREPONED') : cinemaKind === 'now' ? 'NOW SHOWING' : 'IN CINEMAS',
      dateLine: cinemaKind === 'now' ? (r.releaseDate ? `Since ${day(r.releaseDate)}` : 'Now in cinemas') : cinemaDateLine(r, today, cinemaKind).replace(/^In cinemas /, ''),
      prevDateLine: ch ? day(ch.from) : undefined,
    };
  };
  const aiKind = desk === 'ott' ? (style === 'weekly' ? 'weekly' : 'picks') : desk === 'cinema' ? cinemaKind : 'picks';
  const publishKind = desk === 'ott' ? (style === 'weekly' ? 'weekly' : 'picks') : desk === 'cinema' ? `cinema-${cinemaKind}` : 'world-picks';

  const blocked = status === 'NEEDS_OK' ? 'This post has titles you haven’t approved yet — check them and press “Accept” in the panel on the left first.' : null;
  const sel = 'w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm';

  const controls = (
    <>
      <section className="space-y-3 rounded-xl border border-amber-800/50 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-1 text-xs"><ArrowLeft className="w-3.5 h-3.5" /> All ready-made</button>
          <span className="text-[11px] text-slate-500">{post.emoji} {post.group}</span>
          <span className="ml-auto text-[11px] text-slate-500">{save === 'saving' ? 'Saving…' : save === 'saved' ? '✓ Saved' : save === 'error' ? <span className="text-red-400">Not saved</span> : post.edited ? 'Edited by you' : 'Made by the app'}</span>
        </div>
        {status === 'NEEDS_OK' && (
          <div className="space-y-2 rounded-lg border border-amber-700/60 bg-amber-950/30 p-2.5 text-xs text-amber-100">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="w-4 h-4" /> Needs your OK</div>
            <p className="text-amber-200/80">{unapproved.length ? `${unapproved.length} title${unapproved.length === 1 ? '' : 's'} not approved yet: ${unapproved.map(t => `${t.title}${t.year ? ` (${t.year})` : ''}`).join(', ')}. Check them (remove or swap any), then Accept — that approves them and makes the post ready.` : 'Check the titles, then Accept.'}</p>
            <button onClick={accept} disabled={busy || loading} className="flex items-center gap-1.5 rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-50 px-3 py-1.5 font-semibold text-black">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Accept{unapproved.length ? ` & approve ${unapproved.length}` : ''}
            </button>
          </div>
        )}
        {status === 'POSTED' && <p className="flex items-center gap-1.5 text-xs text-emerald-300"><CheckCircle2 className="w-4 h-4" /> Posted{post.permalink ? <> · <a href={post.permalink} target="_blank" rel="noreferrer" className="underline">view</a></> : null}. You can post it again if you like.</p>}
        {post.dropped.length > 0 && (
          <div className="rounded-md border border-red-900/60 bg-red-950/20 p-2 text-[11px] text-red-200">
            <div className="font-semibold">Dropped automatically</div>
            {post.dropped.slice(-6).map((d, i) => <div key={i}>• {d.title} — {d.why}</div>)}
          </div>
        )}
        <div className="grid grid-cols-1 gap-2">
          <label className="text-[11px] text-slate-400">Small line on top<input value={kicker} onChange={e => setKicker(e.target.value)} maxLength={40} className={sel} /></label>
          <label className="text-[11px] text-slate-400">Heading<input value={heading} onChange={e => setHeading(e.target.value)} maxLength={70} className={sel} /></label>
          <label className="text-[11px] text-slate-400">Line under it<input value={sub} onChange={e => setSub(e.target.value)} maxLength={70} className={sel} /></label>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={numbered} onChange={e => setNumbered(e.target.checked)} /> Numbered (1, 2, 3…)</label>
          <label className="flex flex-1 items-center gap-1.5">Ending
            <select value={cta} onChange={e => setCta(e.target.value)} className="flex-1 rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs">
              {ctas.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {post.edited && <button onClick={resetToApp} className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-slate-300"><RotateCcw className="w-3 h-3" /> Back to the app’s version</button>}
          <button onClick={onDelete} className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-slate-300 hover:text-red-400"><Trash2 className="w-3 h-3" /> Delete this post</button>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Titles on this post ({ids.length})</h3>
        {loading && <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading titles…</div>}
        <ClickToScroll maxH="max-h-96" count={ids.length} noun="titles">
          <ol className="space-y-1.5">
            {ids.map((id, i) => {
              const it = itemOf(id);
              const w = world.get(id);
              const title = it?.title || post.preview?.find(x => x.id === id)?.title || 'Title';
              return (
                <li key={id} className="space-y-1 rounded-md border border-slate-800 bg-slate-950 p-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-center font-bold text-indigo-400">{i + 1}</span>
                    {it?.posterPath ? <img src={posterUrl(it.posterPath, 'w342') || ''} alt="" className="h-9 w-6 rounded object-cover" /> : <span className="h-9 w-6 rounded bg-slate-800" />}
                    <span className="flex-1 truncate">{title}{w?.year ? <span className="text-slate-500"> ({w.year})</span> : null}</span>
                    {it && it.status !== 'APPROVED' && <span className="rounded bg-amber-500/20 px-1 text-[10px] text-amber-300">not approved</span>}
                    {!it && !loading && <span className="rounded bg-red-500/20 px-1 text-[10px] text-red-300">unavailable</span>}
                    <button onClick={() => move(i, -1)} className="p-1 text-slate-500 hover:text-white"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => move(i, 1)} className="p-1 text-slate-500 hover:text-white"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(id)} className="p-1 text-slate-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <input value={notes[id] || ''} onChange={e => setNotes({ ...notes, [id]: e.target.value })} maxLength={90}
                    className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs" placeholder="Your one-line reason (optional, shown on the slide)" />
                </li>
              );
            })}
          </ol>
        </ClickToScroll>
        <div className="relative">
          <div className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 px-2">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input value={q} onChange={e => search(e.target.value)} placeholder={desk === 'world' ? 'Add a title — search the database…' : 'Add a title from this desk…'} className="w-full bg-transparent py-1.5 text-sm outline-none" />
          </div>
          {hits.length > 0 && (
            <ul className="mt-1 space-y-0.5 rounded-md border border-slate-700 bg-slate-950 p-1">
              {hits.map(h => (
                <li key={h.id}>
                  <button onClick={() => addId(h)} disabled={ids.includes(h.id)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-slate-800 disabled:opacity-40">
                    {h.posterPath ? <img src={posterUrl(h.posterPath, 'w342') || ''} alt="" className="h-9 w-6 rounded object-cover" /> : <span className="h-9 w-6 rounded bg-slate-800" />}
                    <span className="flex-1 truncate">{h.title}{h.world?.year ? ` (${h.world.year})` : ''}</span>
                    {h.world && <span className="text-[10px] text-slate-500">{scoreLabel(h.world)}{h.world.status !== 'APPROVED' ? ' · not approved' : ''}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );

  const usedIds = new Set(ids);
  const pool: PostItem[] = desk === 'ott' ? (allOtt.filter(r => usable(r) && !usedIds.has(r.id)).slice(0, 40) as PostItem[])
    : desk === 'cinema' ? allCinema.filter(r => usable(r) && !usedIds.has(r.id)).slice(0, 40).map(cinemaPostItem) : [];

  return (
    <CarouselComposer
      domain={domain}
      items={items}
      pool={[...items, ...pool]}
      brand={brand}
      controlsTop={controlsTop}
      controls={controls}
      cover={{ kicker, heading, subheading: sub }}
      outroLine={outroLine}
      titleExtras={titleExtras}
      includeOutro={includeOutro} setIncludeOutro={setIncludeOutro}
      hideCover={hideCover} setHideCover={setHideCover}
      customSlides={customSlides} setCustomSlides={setCustomSlides}
      captionTemplate={caption}
      aiRequest={(ordered, tone, language) => domain.aiCaption({ kind: aiKind, releaseIds: ordered.map(r => r.id), tone, language, heading })}
      captionKey={`${post.id}-${cta}-${numbered}`}
      publishKind={publishKind}
      slug={`ready-${desk}-${post.templateId}-${post.periodKey}`}
      onRemoveItem={remove}
      emptyHint="All titles were removed — add some on the left."
      theme={theme}
      onTheme={setTheme}
      onPosted={markPosted}
      publishBlocked={blocked}
    />
  );
}
