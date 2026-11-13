'use client';
import React, { useEffect, useState } from 'react';
import { ExternalLink, Globe, Loader2, PenLine, RefreshCw, Sparkles, X } from 'lucide-react';
import { AI_LANGUAGES, AI_TONES } from '@/lib/ott';
import type { PostItem } from '@/lib/postDomain';
import { CriticsSection } from './CriticsSection';
import { LINK_LABELS, ONE_LINER_SOURCE_LABEL, RATING_OPTIONS, RatingKey, TitleExtra, extrasApi, knownRatings, linksOf, shownKeys } from '@/lib/extras';

/** Always listed (greyed when unknown); the other sources appear only when found for this title. */
const CORE: RatingKey[] = ['imdb', 'rt', 'metacritic', 'tmdb', 'my'];

/**
 * One-liner (drawn on the picture) + which ratings to show, for one title on any desk.
 * Options: your own words · from the web (TMDB tagline, IMDb plot, awards, Wikipedia) · AI from the synopsis.
 */
export function ExtrasPanel({ domain, item, extra, onChange, myRating }: { domain: 'ott' | 'cinema' | 'world'; item: PostItem; extra: TitleExtra | null; onChange: (e: TitleExtra) => void; myRating?: number | null }) {
  const [draft, setDraft] = useState(extra?.oneLiner || '');
  const [looking, setLooking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ai, setAi] = useState<{ busy: boolean; options: string[]; lang: string; tone: string }>({ busy: false, options: [], lang: 'en', tone: 'hype' });
  const [custom, setCustom] = useState({ label: extra?.customRatingLabel || '', value: extra?.customRatingValue || '' });

  const save = async (patch: Parameters<typeof extrasApi.update>[2]) => {
    setErr(null);
    try {
      onChange(await extrasApi.update(domain, item.id, patch));
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const lookup = async (force = false) => {
    setLooking(true);
    setErr(null);
    try {
      onChange(await extrasApi.lookup(domain, item.id, force));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLooking(false);
    }
  };
  // First time this title is opened: look up the web lines & ratings automatically (cached for 14 days).
  const [autoLooking, setAutoLooking] = useState(!extra?.webCheckedAt);
  useEffect(() => {
    if (extra?.webCheckedAt) return;
    let stop = false;
    extrasApi.lookup(domain, item.id).then(
      e => { if (!stop) { onChange(e); setAutoLooking(false); } },
      (e: Error) => { if (!stop) { setErr(e.message); setAutoLooking(false); } },
    );
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const use = (text: string, source: string) => {
    setDraft(text);
    save({ oneLiner: text, oneLinerSource: source });
  };
  const writeAi = async () => {
    setAi(a => ({ ...a, busy: true }));
    setErr(null);
    try {
      const r = await extrasApi.ai(domain, item.id, { language: ai.lang, tone: ai.tone });
      setAi(a => ({ ...a, busy: false, options: r.options }));
    } catch (e) {
      setAi(a => ({ ...a, busy: false }));
      setErr((e as Error).message);
    }
  };

  const known = knownRatings(item, extra, myRating);
  const links = linksOf(extra);
  const shown = shownKeys(item, extra);
  const toggleRating = (k: RatingKey) => save({ ratingsShown: shown.includes(k) ? shown.filter(x => x !== k) : [...shown, k] });

  const web: Array<{ source: string; label: string; text: string; link?: string | null }> = [
    extra?.tagline ? { source: 'tagline', label: 'Official tagline', text: extra.tagline } : null,
    extra?.omdbPlot ? { source: 'plot', label: 'IMDb plot', text: extra.omdbPlot } : null,
    extra?.awards ? { source: 'awards', label: 'Awards', text: extra.awards } : null,
    extra?.wikiSentence ? { source: 'wikipedia', label: 'Wikipedia', text: extra.wikiSentence, link: extra.wikiUrl } : null,
  ].filter(Boolean) as Array<{ source: string; label: string; text: string; link?: string | null }>;

  const sel = 'rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-[11px]';
  return (
    <div className="space-y-4">
      {/* ── one-liner ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">One-liner <span className="font-normal text-slate-500">(shown on the picture)</span></span>
          {extra?.oneLiner && <span className="text-[10px] text-slate-500">{ONE_LINER_SOURCE_LABEL[extra.oneLinerSource || 'manual'] || extra.oneLinerSource}</span>}
        </div>
        <div className="flex gap-2">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} maxLength={140}
            onBlur={() => { if (draft.trim() !== (extra?.oneLiner || '')) save({ oneLiner: draft.trim() || null, oneLinerSource: 'manual' }); }}
            className="flex-1 rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm" placeholder="Type your own one-liner, or pick one below…" />
          {draft && <button title="Remove one-liner" onClick={() => { setDraft(''); save({ oneLiner: null }); }} className="self-start p-1.5 text-slate-500 hover:text-red-400"><X className="w-4 h-4" /></button>}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500"><PenLine className="w-3 h-3" /> {draft.length}/140 · saved when you click away</div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-300"><Globe className="w-3.5 h-3.5" /> From the web</span>
            <button onClick={() => lookup(true)} disabled={looking} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white">
              {looking || autoLooking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} {looking || autoLooking ? 'Looking up…' : 'Look up again'}
            </button>
          </div>
          {web.length === 0 && !looking && <p className="text-[11px] text-slate-500">{extra?.webCheckedAt ? 'No tagline / plot / Wikipedia line found for this title.' : '…'}</p>}
          {web.map(w => (
            <div key={w.source} className="flex items-start gap-2 text-xs">
              <span className="w-20 shrink-0 text-[10px] text-slate-500 pt-0.5">{w.label}</span>
              <span className="flex-1 text-slate-200">{w.text}{w.link && <a href={w.link} target="_blank" rel="noreferrer" className="ml-1 inline-flex text-sky-400"><ExternalLink className="w-3 h-3" /></a>}</span>
              <button onClick={() => use(w.text.slice(0, 140), w.source)} className="shrink-0 rounded bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[10px]">Use</button>
            </div>
          ))}
          {extra?.webNote && <p className="text-[10px] text-amber-400/90">{extra.webNote}</p>}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-300 mr-auto"><Sparkles className="w-3.5 h-3.5" /> AI (from the official synopsis)</span>
            <select value={ai.lang} onChange={e => setAi(a => ({ ...a, lang: e.target.value }))} className={sel}>{AI_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
            <select value={ai.tone} onChange={e => setAi(a => ({ ...a, tone: e.target.value }))} className={sel}>{AI_TONES.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}</select>
            <button onClick={writeAi} disabled={ai.busy} className="flex items-center gap-1 rounded-md bg-violet-600/80 hover:bg-violet-600 disabled:opacity-50 px-2 py-1 text-[11px] font-medium">
              {ai.busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} {ai.options.length ? 'Write again' : 'Write 3 options'}
            </button>
          </div>
          {ai.options.map((o, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="flex-1 text-slate-200">{o}</span>
              <button onClick={() => use(o, 'ai')} className="shrink-0 rounded bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[10px]">Use</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── critics (on your click) ── */}
      <CriticsSection domain={domain} id={item.id} extra={extra} onChange={onChange} onUseLine={t => use(t, 'critic')} shown={shown} />

      {/* ── ratings ── */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-300">Ratings on the post</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {RATING_OPTIONS.filter(o => o.key !== 'custom' && (CORE.includes(o.key) || known[o.key])).map(o => {
            const k = known[o.key];
            return (
              <label key={o.key} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${k ? 'border-slate-700 cursor-pointer' : 'border-slate-800 opacity-50'}`}>
                <input type="checkbox" disabled={!k} checked={!!k && shown.includes(o.key)} onChange={() => toggleRating(o.key)} />
                <span className="flex-1">{o.label}</span>
                <span className="text-slate-400">{k ? k.detail : o.key === 'my' ? 'rate it first' : 'not found'}</span>
              </label>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <label className="flex items-center gap-1.5"><input type="checkbox" disabled={!known.custom} checked={!!known.custom && shown.includes('custom')} onChange={() => toggleRating('custom')} /> Other rating you looked up:</label>
          <input value={custom.label} onChange={e => setCustom({ ...custom, label: e.target.value })} placeholder="Source, e.g. Letterboxd" maxLength={30} className={`${sel} w-32`} />
          <input value={custom.value} onChange={e => setCustom({ ...custom, value: e.target.value })} placeholder="e.g. 4.6/5" maxLength={20} className={`${sel} w-20`} />
          <button onClick={async () => { await save({ customRatingLabel: custom.label || null, customRatingValue: custom.value || null, ratingsShown: custom.label && custom.value ? [...new Set([...shown, 'custom' as RatingKey])] : shown.filter(x => x !== 'custom') }); }}
            className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px]">Save</button>
        </div>
        {Object.keys(links).length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-500">Check it yourself:</span>
            {Object.entries(links).map(([k, url]) => (
              <a key={k} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 rounded bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 text-sky-300">{LINK_LABELS[k] || k}<ExternalLink className="w-2.5 h-2.5" /></a>
            ))}
          </div>
        )}
        <p className="text-[10px] text-slate-500">IMDb from IMDb’s daily ratings file; RT / Metacritic from OMDb (or Wikidata); TVmaze, AniList, MyAnimeList, Letterboxd &amp; Trakt (MDBList key) only when found by the title’s IMDb id. Each shows its source on the post.</p>
      </div>
      {err && <p className="text-[11px] text-amber-400">{err}</p>}
    </div>
  );
}
