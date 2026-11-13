'use client';
import React, { useMemo, useState } from 'react';
import { BookOpen, Dices, RotateCcw, Save, Search, Trash2 } from 'lucide-react';
import { CoverText, HEADING_CATS, HeadingCat, HeadingCtx, allHeadings, deleteMyHeading, fillHeading, randomHeading, rememberHeading, saveMyHeading } from '@/lib/headings';

/**
 * The cover's three lines — label, heading, subheading — typed by you, or picked from 200+ ready headlines
 * (🎲 for a fresh one each post). Your own can be saved and reused ({n} adapts to the list size).
 */
export function HeadingPicker({ value, onChange, ctx, onReset, edited }: {
  value: CoverText;
  onChange: (v: CoverText) => void;
  ctx: HeadingCtx;
  /** back to the app's suggestion */
  onReset?: () => void;
  edited?: boolean;
}) {
  const [browse, setBrowse] = useState(false);
  const [cat, setCat] = useState<HeadingCat | 'all'>('all');
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0); // refresh after saving / deleting your own
  const field = 'w-full rounded-md bg-slate-950 border border-slate-700 px-2.5 py-1.5';

  const options = useMemo(() => {
    void tick;
    const needle = q.trim().toLowerCase();
    return allHeadings()
      .filter(t => cat === 'all' || t.cat === cat)
      .map(t => ({ t, text: fillHeading(t, ctx) }))
      .filter((x): x is { t: typeof x.t; text: CoverText } => !!x.text)
      .filter(x => !needle || `${x.text.heading} ${x.text.kicker} ${x.t.cat}`.toLowerCase().includes(needle));
  }, [cat, q, ctx, tick]);

  const roll = () => {
    const r = randomHeading(ctx, cat === 'all' ? null : cat);
    if (!r) return;
    rememberHeading(r.tpl.id);
    onChange(r.text);
  };

  return (
    <div className="space-y-1.5">
      <input value={value.kicker} onChange={e => onChange({ ...value, kicker: e.target.value })} className={`${field} text-xs uppercase tracking-wide`} placeholder="Label (e.g. MOVIE PICKS)" maxLength={40} />
      <input value={value.heading} onChange={e => onChange({ ...value, heading: e.target.value })} className={`${field} text-sm font-semibold`} placeholder="Heading" maxLength={90} />
      <input value={value.sub} onChange={e => onChange({ ...value, sub: e.target.value })} className={`${field} text-xs`} placeholder="Subheading" maxLength={80} />
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <button onClick={roll} className="flex items-center gap-1 rounded-md bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:brightness-110 px-2.5 py-1 font-semibold text-white" title="A headline that fits this post and you haven't used lately"><Dices className="w-3.5 h-3.5" /> New headline</button>
        <button onClick={() => setBrowse(b => !b)} className={`flex items-center gap-1 rounded-md px-2.5 py-1 ${browse ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}><BookOpen className="w-3.5 h-3.5" /> Browse {allHeadings().length}+</button>
        <button onClick={() => { saveMyHeading(value, ctx); setTick(t => t + 1); }} className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-slate-300" title="Save these three lines to “Mine” (the number becomes {n})"><Save className="w-3.5 h-3.5" /> Save as mine</button>
        {edited && onReset && <button onClick={onReset} className="flex items-center gap-1 text-slate-500 hover:text-white"><RotateCcw className="w-3 h-3" /> Suggested</button>}
      </div>
      {browse && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <select value={cat} onChange={e => setCat(e.target.value as HeadingCat | 'all')} className="rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs">
              <option value="all">All</option>
              {HEADING_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex flex-1 items-center gap-1 rounded-md bg-slate-950 border border-slate-700 px-2">
              <Search className="w-3 h-3 text-slate-500" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search: gems, twist, weekend…" className="w-full bg-transparent py-1 text-xs outline-none" />
            </div>
            <span className="text-[10px] text-slate-500">{options.length}</span>
          </div>
          <ul className="max-h-60 overflow-y-auto space-y-0.5 pr-1">
            {options.map(({ t, text }) => (
              <li key={t.id} className="group flex items-center gap-1">
                <button onClick={() => { rememberHeading(t.id); onChange(text); }} className="flex-1 rounded px-2 py-1 text-left hover:bg-slate-800">
                  <span className="block text-xs text-slate-100">{text.heading}</span>
                  <span className="block text-[10px] text-slate-500">{text.kicker} · {text.sub}</span>
                </button>
                {t.cat === 'Mine' && <button onClick={() => { deleteMyHeading(t.id); setTick(x => x + 1); }} className="p-1 text-slate-600 hover:text-red-400" title="Delete"><Trash2 className="w-3 h-3" /></button>}
              </li>
            ))}
            {!options.length && <li className="text-xs text-slate-500 px-2 py-1">{cat === 'Mine' ? 'Type your lines above and press “Save as mine”.' : cat === 'Language' ? 'Pick one language in the filters to see these.' : cat === 'Genre' ? 'Pick one genre in the filters to see these.' : 'Nothing matches.'}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
