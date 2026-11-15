'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Dices, Palette, RotateCcw, Save, Search, Star, Wand2 } from 'lucide-react';
import {
  ALL_THEMES, CustomTheme, EFFECT_OPTIONS, FONT_OPTIONS, PostTheme, TEXTURE_OPTIONS, THEME_PRESETS, ThemeChoice, frameBackground, presetById, titleStyle,
} from '@/lib/themes';
import {
  THEME_CATEGORIES, THEME_LIBRARY, ThemeCategory, favouriteThemes, freshEveryPost, recentThemes, rememberTheme, setFreshEveryPost, surpriseTheme, toggleFavourite,
} from '@/lib/themeLibrary';

const PHOTO_FILTERS: Array<{ label: string; value: string }> = [
  { label: 'Natural', value: 'none' },
  { label: 'Vivid', value: 'saturate(1.3) contrast(1.08)' },
  { label: 'Cinematic contrast', value: 'contrast(1.15) saturate(0.95)' },
  { label: 'Warm', value: 'sepia(0.15) saturate(1.15)' },
  { label: 'Cool', value: 'saturate(0.9) hue-rotate(-8deg) contrast(1.05)' },
  { label: 'Vintage', value: 'sepia(0.35) contrast(1.05) saturate(0.9)' },
  { label: 'Black & white', value: 'grayscale(1) contrast(1.12)' },
  { label: 'Faded', value: 'contrast(0.9) brightness(1.05) saturate(0.8)' },
];

function Tile({ theme, active, label, onClick, sub, fav, onFav }: { theme: PostTheme; active: boolean; label: string; sub?: string; onClick: () => void; fav?: boolean; onFav?: () => void }) {
  return (
    <div className={`relative w-[92px] rounded-lg overflow-hidden border-2 text-left transition ${active ? 'border-indigo-400 ring-2 ring-indigo-500/40' : 'border-slate-800 hover:border-slate-600'}`}>
      <button onClick={onClick} title={sub ? `${label} — ${sub}` : label} className="block w-full text-left">
        <div className="h-[64px] flex flex-col items-center justify-center relative overflow-hidden" style={{ background: frameBackground(theme) }}>
          <span style={{ ...titleStyle(theme, 24), lineHeight: 1, whiteSpace: 'nowrap' }}>Aa</span>
          <span className="absolute bottom-1.5 left-2 right-2 h-1 rounded" style={{ background: theme.accent }} />
        </div>
        <div className="px-1.5 py-1 bg-slate-950">
          <div className="text-[10px] font-semibold text-slate-200 truncate">{theme.emoji} {label}</div>
          {sub && <div className="text-[9px] text-slate-500 truncate">{sub}</div>}
        </div>
      </button>
      {onFav && (
        <button onClick={onFav} title={fav ? 'Remove from favourites' : 'Add to favourites'} className="absolute top-1 right-1 rounded-full bg-black/50 p-0.5">
          <Star className={`w-3 h-3 ${fav ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
        </button>
      )}
    </div>
  );
}

type Group = 'all' | 'fav' | 'recent' | 'classic' | 'mine' | ThemeCategory;

/**
 * Theme gallery (13 classics + 330+ library themes) + customiser. "Auto" picks from the film's genre and tints it with its
 * poster colours; "Surprise me" / "Fresh look every post" keep your feed from looking the same.
 */
export function ThemePicker({
  value, onChange, resolved, customThemes, onSaveCustom, title = 'Theme', note,
}: {
  value: ThemeChoice;
  onChange: (v: ThemeChoice) => void;
  /** The theme as it will render right now (for the Auto tile + customiser defaults). */
  resolved: PostTheme & { autoWhy?: string };
  customThemes: CustomTheme[];
  onSaveCustom: (t: CustomTheme) => void;
  title?: string;
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<Group>('all');
  const [scrollOn, setScrollOn] = useState(false);
  const [q, setQ] = useState('');
  // this browser's favourites / recently used / "fresh every post" (localStorage; empty during server render)
  const [favs, setFavs] = useState<string[]>(() => favouriteThemes());
  const [recent, setRecent] = useState<string[]>(() => recentThemes());
  const [fresh, setFresh] = useState(() => freshEveryPost());
  const autoTheme = value.base === 'auto' ? resolved : null;
  const isLib = value.base.startsWith('lib:');

  const pick = (base: string, tweaks: Partial<PostTheme> = {}) => {
    onChange({ ...value, base, tweaks });
    rememberTheme(base);
    setRecent(recentThemes());
  };
  const surprise = () => {
    const t = surpriseTheme(THEME_CATEGORIES.includes(group as ThemeCategory) ? (group as ThemeCategory) : null);
    // a little extra variety in title size each time
    pick(t.id, { titleScale: +((t.titleScale || 1) * (0.92 + Math.random() * 0.16)).toFixed(2) });
  };

  // "Fresh look every post": a new post (this picker appearing) starts with a theme you haven't used lately
  useEffect(() => {
    if (!freshEveryPost() || (value.base !== 'auto' && value.base !== 'brand')) return;
    const id = setTimeout(surprise, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let base: PostTheme[] =
      group === 'fav' ? favs.map(id => presetById(id) || customThemes.find(c => c.id === id)).filter(Boolean) as PostTheme[]
      : group === 'recent' ? recent.map(id => presetById(id) || customThemes.find(c => c.id === id)).filter(Boolean) as PostTheme[]
      : group === 'classic' ? THEME_PRESETS
      : group === 'mine' ? customThemes
      : group === 'all' ? [...customThemes, ...ALL_THEMES]
      : THEME_LIBRARY.filter(t => t.category === group);
    if (needle) base = base.filter(t => `${t.name} ${t.category || ''}`.toLowerCase().includes(needle));
    return base;
  }, [group, q, favs, recent, customThemes]);

  const tweak = (k: keyof PostTheme, v: unknown) => onChange({ ...value, tweaks: { ...value.tweaks, [k]: v } });
  const sel = 'rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs w-full';
  const groups: Array<[Group, string]> = [['all', `All (${ALL_THEMES.length + customThemes.length})`], ['fav', '★ Favourites'], ['recent', 'Recently used'], ['classic', 'Classic'], ...(customThemes.length ? [['mine', 'My themes'] as [Group, string]] : []), ...THEME_CATEGORIES.map(c => [c, c] as [Group, string])];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> {title}</span>
        <label className={`flex items-center gap-1.5 text-[11px] ${isLib ? 'text-slate-600' : 'text-slate-400'}`} title={isLib ? 'Library themes keep their own colours' : 'Tint the theme with colours sampled from each title’s own poster'}>
          <input type="checkbox" disabled={isLib} checked={value.posterColors && !isLib} onChange={e => onChange({ ...value, posterColors: e.target.checked })} /> Poster colours
        </label>
      </div>
      {note && <p className="text-[11px] text-slate-500">{note}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={surprise} className="flex items-center gap-1 rounded-md bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:brightness-110 px-2.5 py-1 text-xs font-semibold text-white" title="A theme you haven’t used recently"><Dices className="w-3.5 h-3.5" /> Surprise me</button>
        <button onClick={() => pick('auto')} className={`rounded-md px-2.5 py-1 text-xs ${value.base === 'auto' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`} title="By the film's genre">Auto{autoTheme?.autoWhy ? ` · ${autoTheme.autoWhy}` : ''}</button>
        <label className="flex items-center gap-1.5 text-[11px] text-slate-300" title="Every new post starts with a different theme (not one of your last 40)">
          <input type="checkbox" checked={fresh} onChange={e => { setFresh(e.target.checked); setFreshEveryPost(e.target.checked); }} /> Fresh look every post
        </label>
      </div>
      <div className="flex items-center gap-1.5">
        <select value={group} onChange={e => setGroup(e.target.value as Group)} className="rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs">
          {groups.map(([g, l]) => <option key={g} value={g}>{l}</option>)}
        </select>
        <div className="flex flex-1 items-center gap-1 rounded-md bg-slate-950 border border-slate-700 px-2">
          <Search className="w-3 h-3 text-slate-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search: neon, gold, vintage, script…" className="w-full bg-transparent py-1 text-xs outline-none" />
        </div>
        <span className="text-[10px] text-slate-500 shrink-0">{list.length}</span>
      </div>
      {/* The page scrolls past this list; it only scrolls itself once you click into it (so it never traps the mouse wheel). */}
      <div className="relative">
      <div onClick={() => setScrollOn(true)} onMouseLeave={() => setScrollOn(false)}
        className={`flex flex-wrap gap-1.5 max-h-[300px] pr-1 ${scrollOn ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden'}`}>
        {list.map(t => (
          <Tile key={t.id} theme={t} active={value.base === t.id} label={t.name.split(' · ')[0]} sub={t.name.split(' · ')[1] || t.category}
            onClick={() => pick(t.id)} fav={favs.includes(t.id)} onFav={() => setFavs(toggleFavourite(t.id))} />
        ))}
        {!list.length && <p className="text-xs text-slate-500 py-2">{group === 'fav' ? 'Tap ☆ on any theme to keep it here.' : group === 'recent' ? 'Themes you use show up here.' : 'No theme matches.'}</p>}
      </div>
      {!scrollOn && list.length > 9 && (
        <button onClick={() => setScrollOn(true)}
          className="absolute inset-x-0 bottom-0 flex h-10 items-end justify-center bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent pb-1 text-[11px] font-medium text-indigo-300 hover:text-white">
          Click to scroll all {list.length} themes ↓
        </button>
      )}
      </div>
      <p className="text-[11px] text-slate-500">Now: <b className="text-slate-300">{resolved.emoji} {value.base === 'auto' ? `Auto → ${resolved.name}` : resolved.name}</b></p>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200">
        <Wand2 className="w-3 h-3" /> {open ? 'Hide' : 'Customise'} colours, fonts, title size, effects
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-[11px] text-slate-400">
          <label className="space-y-1">Accent<input type="color" value={resolved.accent.slice(0, 7)} onChange={e => tweak('accent', e.target.value)} className="h-7 w-full rounded bg-slate-950 border border-slate-700" /></label>
          <label className="space-y-1">Text<input type="color" value={resolved.text.slice(0, 7)} onChange={e => tweak('text', e.target.value)} className="h-7 w-full rounded bg-slate-950 border border-slate-700" /></label>
          <label className="space-y-1">Background top<input type="color" value={resolved.bg[0].slice(0, 7)} onChange={e => tweak('bg', [e.target.value, resolved.bg[1]])} className="h-7 w-full rounded bg-slate-950 border border-slate-700" /></label>
          <label className="space-y-1">Background bottom<input type="color" value={resolved.bg[1].slice(0, 7)} onChange={e => tweak('bg', [resolved.bg[0], e.target.value])} className="h-7 w-full rounded bg-slate-950 border border-slate-700" /></label>
          <label className="space-y-1">Title font
            <select value={resolved.titleFont} onChange={e => tweak('titleFont', e.target.value)} className={sel}>{FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
          </label>
          <label className="space-y-1">Text font
            <select value={resolved.bodyFont} onChange={e => tweak('bodyFont', e.target.value)} className={sel}>{FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
          </label>
          <label className="space-y-1 col-span-2">Title size · {Math.round((resolved.titleScale || 1) * 100)}%
            <input type="range" min={0.6} max={1.5} step={0.02} value={resolved.titleScale || 1} onChange={e => tweak('titleScale', Number(e.target.value))} className="w-full" />
          </label>
          <label className="space-y-1 col-span-2">Letter spacing · {resolved.titleTracking}
            <input type="range" min={-4} max={12} step={0.5} value={resolved.titleTracking} onChange={e => tweak('titleTracking', Number(e.target.value))} className="w-full" />
          </label>
          <label className="space-y-1">Texture
            <select value={resolved.texture} onChange={e => tweak('texture', e.target.value)} className={sel}>{TEXTURE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select>
          </label>
          <label className="space-y-1">Title effect
            <select value={resolved.titleEffect} onChange={e => tweak('titleEffect', e.target.value)} className={sel}>{EFFECT_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select>
          </label>
          <label className="space-y-1 col-span-2">Photo look
            <select value={PHOTO_FILTERS.some(f => f.value === resolved.imageFilter) ? resolved.imageFilter : ''} onChange={e => e.target.value && tweak('imageFilter', e.target.value)} className={sel}>
              {!PHOTO_FILTERS.some(f => f.value === resolved.imageFilter) && <option value="">Theme’s own</option>}
              {PHOTO_FILTERS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={resolved.titleTransform === 'uppercase'} onChange={e => tweak('titleTransform', e.target.checked ? 'uppercase' : 'none')} /> UPPERCASE</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!resolved.titleItalic} onChange={e => tweak('titleItalic', e.target.checked)} /> Italic</label>
          <div className="col-span-2 flex items-center gap-2 pt-1">
            {Object.keys(value.tweaks).length > 0 && (
              <button onClick={() => onChange({ ...value, tweaks: {} })} className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2 py-1"><RotateCcw className="w-3 h-3" /> Reset tweaks</button>
            )}
            <button
              onClick={() => {
                const name = prompt('Name this theme', `${resolved.name} (mine)`);
                if (!name) return;
                const t: CustomTheme = { ...resolved, id: `custom:${Date.now().toString(36)}`, name: name.slice(0, 30), emoji: '✨', custom: true };
                onSaveCustom(t);
                onChange({ base: t.id, tweaks: {}, posterColors: false });
              }}
              className="flex items-center gap-1 rounded bg-indigo-600 hover:bg-indigo-700 px-2 py-1 text-white"><Save className="w-3 h-3" /> Save as my theme</button>
          </div>
        </div>
      )}
    </div>
  );
}
