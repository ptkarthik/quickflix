/**
 * Post theme engine: every post can look like its film.
 *   auto  → theme picked from the title's TMDB genres (+ keywords for mythology/sports) and tinted with
 *           colours sampled from its own poster — so two action films still look different.
 *   fixed → any preset / your saved theme, with optional tweaks.
 */
import type React from 'react';
import { LIB_FONTS, THEME_LIBRARY, libraryThemeById } from './themeLibrary';

export type Texture = 'none' | 'grain' | 'smoke' | 'scanlines' | 'halftone' | 'lightleak' | 'vignette' | 'sparkle' | 'paper' | 'diagonal' | 'grid' | 'bokeh' | 'filmstrip';
export type TitleEffect = 'none' | 'glow' | 'outline' | 'shadow' | 'neon' | 'retro3d' | 'double';

export interface PostTheme {
  id: string;
  name: string;
  emoji: string;
  bg: [string, string];
  accent: string;
  text: string;
  titleFont: string;
  titleTransform: 'uppercase' | 'none';
  titleTracking: number;
  titleItalic?: boolean;
  bodyFont: string;
  texture: Texture;
  titleEffect: TitleEffect;
  /** CSS filter applied to the background picture. */
  imageFilter: string;
  /** Key for the backend AI art direction. */
  aiTheme: string;
  /** Title size vs normal (fonts differ in width). */
  titleScale?: number;
  /** Library group (Cinematic, Neon, …). */
  category?: string;
}

const F = {
  anton: 'var(--font-anton), Impact, sans-serif',
  bebas: 'var(--font-bebas), Impact, sans-serif',
  oswald: 'var(--font-oswald), "Arial Narrow", sans-serif',
  playfair: 'var(--font-playfair), Georgia, serif',
  cinzel: 'var(--font-cinzel), Georgia, serif',
  creepster: 'var(--font-creepster), Impact, cursive',
  orbitron: 'var(--font-orbitron), "Segoe UI", sans-serif',
  poppins: 'var(--font-poppins), "Segoe UI", sans-serif',
  righteous: 'var(--font-righteous), "Segoe UI", sans-serif',
  geist: 'var(--font-geist-sans), "Segoe UI", system-ui, sans-serif',
};
export const FONT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Anton (bold mass)', value: F.anton },
  { label: 'Bebas Neue (tall)', value: F.bebas },
  { label: 'Oswald (condensed)', value: F.oswald },
  { label: 'Playfair (elegant serif)', value: F.playfair },
  { label: 'Cinzel (epic / mythology)', value: F.cinzel },
  { label: 'Creepster (horror)', value: F.creepster },
  { label: 'Orbitron (sci-fi)', value: F.orbitron },
  { label: 'Righteous (fun)', value: F.righteous },
  { label: 'Poppins (clean)', value: F.poppins },
  { label: 'Geist (default)', value: F.geist },
  { label: 'Abril Fatface (display serif)', value: LIB_FONTS.abril },
  { label: 'Alfa Slab (poster slab)', value: LIB_FONTS.slab },
  { label: 'Bungee (urban block)', value: LIB_FONTS.bungee },
  { label: 'Black Ops (stencil action)', value: LIB_FONTS.stencil },
  { label: 'Monoton (neon retro)', value: LIB_FONTS.monoton },
  { label: 'Pacifico (script)', value: LIB_FONTS.pacifico },
  { label: 'Dancing Script (romance)', value: LIB_FONTS.dancing },
  { label: 'Permanent Marker (handwritten)', value: LIB_FONTS.marker },
  { label: 'Special Elite (typewriter)', value: LIB_FONTS.typewriter },
  { label: 'Teko (sport condensed)', value: LIB_FONTS.teko },
  { label: 'Russo One (techno)', value: LIB_FONTS.russo },
  { label: 'Archivo Black (heavy)', value: LIB_FONTS.archivo },
];
export const TEXTURE_OPTIONS: Texture[] = ['none', 'grain', 'smoke', 'scanlines', 'halftone', 'lightleak', 'vignette', 'sparkle', 'paper', 'diagonal', 'grid', 'bokeh', 'filmstrip'];
export const EFFECT_OPTIONS: TitleEffect[] = ['none', 'glow', 'outline', 'shadow', 'neon', 'retro3d', 'double'];

export const THEME_PRESETS: PostTheme[] = [
  { id: 'brand', name: 'My brand', emoji: '⭐', bg: ['#07070a', '#07070a'], accent: '#FACC15', text: '#ffffff', titleFont: F.geist, titleTransform: 'none', titleTracking: -1.5, bodyFont: F.geist, texture: 'none', titleEffect: 'none', imageFilter: 'none', aiTheme: 'brand' },
  { id: 'mass', name: 'Mass action', emoji: '🔥', bg: ['#1a0600', '#000000'], accent: '#FF6B00', text: '#ffffff', titleFont: F.anton, titleTransform: 'uppercase', titleTracking: 1, bodyFont: F.oswald, texture: 'grain', titleEffect: 'shadow', imageFilter: 'contrast(1.15) saturate(1.2)', aiTheme: 'mass' },
  { id: 'thriller', name: 'Thriller / crime', emoji: '🕵️', bg: ['#04131a', '#000000'], accent: '#22D3EE', text: '#E6F6FA', titleFont: F.bebas, titleTransform: 'uppercase', titleTracking: 4, bodyFont: F.oswald, texture: 'scanlines', titleEffect: 'glow', imageFilter: 'saturate(0.7) contrast(1.15) hue-rotate(-10deg)', aiTheme: 'thriller' },
  { id: 'horror', name: 'Horror', emoji: '👻', bg: ['#050b05', '#000000'], accent: '#7CFC00', text: '#E8F5E1', titleFont: F.creepster, titleTransform: 'uppercase', titleTracking: 3, bodyFont: F.oswald, texture: 'vignette', titleEffect: 'glow', imageFilter: 'saturate(0.45) contrast(1.25) brightness(0.85)', aiTheme: 'horror' },
  { id: 'romance', name: 'Romance', emoji: '💖', bg: ['#3a0d1f', '#12030a'], accent: '#FF7AA8', text: '#FFF1F5', titleFont: F.playfair, titleTransform: 'none', titleTracking: 0, titleItalic: true, bodyFont: F.poppins, texture: 'lightleak', titleEffect: 'glow', imageFilter: 'saturate(1.1) brightness(1.05)', aiTheme: 'romance' },
  { id: 'comedy', name: 'Comedy / fun', emoji: '😂', bg: ['#2b1a00', '#0d0800'], accent: '#FFD60A', text: '#ffffff', titleFont: F.righteous, titleTransform: 'none', titleTracking: 0, bodyFont: F.poppins, texture: 'halftone', titleEffect: 'shadow', imageFilter: 'saturate(1.3) brightness(1.05)', aiTheme: 'comedy' },
  { id: 'family', name: 'Family / feel-good', emoji: '🏡', bg: ['#2a1a0c', '#0e0905'], accent: '#FDBA74', text: '#FFF8F0', titleFont: F.poppins, titleTransform: 'none', titleTracking: -1, bodyFont: F.poppins, texture: 'lightleak', titleEffect: 'none', imageFilter: 'saturate(1.1) sepia(0.12)', aiTheme: 'family' },
  { id: 'drama', name: 'Drama', emoji: '🎭', bg: ['#1a1a1d', '#08080a'], accent: '#E5C07B', text: '#F5F2EA', titleFont: F.playfair, titleTransform: 'none', titleTracking: 0, bodyFont: F.poppins, texture: 'grain', titleEffect: 'none', imageFilter: 'saturate(0.85) contrast(1.05)', aiTheme: 'drama' },
  { id: 'scifi', name: 'Sci-fi / fantasy', emoji: '🚀', bg: ['#0b0326', '#000008'], accent: '#C084FC', text: '#EDE9FE', titleFont: F.orbitron, titleTransform: 'uppercase', titleTracking: 3, bodyFont: F.poppins, texture: 'sparkle', titleEffect: 'glow', imageFilter: 'saturate(1.25) contrast(1.1) hue-rotate(8deg)', aiTheme: 'scifi' },
  { id: 'mythology', name: 'Mythology / devotional', emoji: '🔱', bg: ['#2d0a00', '#0d0300'], accent: '#F5B841', text: '#FFF4D6', titleFont: F.cinzel, titleTransform: 'uppercase', titleTracking: 4, bodyFont: F.playfair, texture: 'lightleak', titleEffect: 'glow', imageFilter: 'saturate(1.15) sepia(0.2) contrast(1.05)', aiTheme: 'mythology' },
  { id: 'animation', name: 'Animation', emoji: '🎨', bg: ['#0a1f3d', '#03091a'], accent: '#38BDF8', text: '#ffffff', titleFont: F.righteous, titleTransform: 'none', titleTracking: 0, bodyFont: F.poppins, texture: 'halftone', titleEffect: 'outline', imageFilter: 'saturate(1.35)', aiTheme: 'animation' },
  { id: 'sports', name: 'Sports', emoji: '🏏', bg: ['#04210f', '#000a04'], accent: '#4ADE80', text: '#ffffff', titleFont: F.anton, titleTransform: 'uppercase', titleTracking: 2, titleItalic: true, bodyFont: F.oswald, texture: 'scanlines', titleEffect: 'shadow', imageFilter: 'contrast(1.15) saturate(1.15)', aiTheme: 'sports' },
  { id: 'documentary', name: 'Documentary / true story', emoji: '📽️', bg: ['#141414', '#050505'], accent: '#F87171', text: '#F4F4F5', titleFont: F.oswald, titleTransform: 'uppercase', titleTracking: 2, bodyFont: F.poppins, texture: 'grain', titleEffect: 'none', imageFilter: 'grayscale(0.35) contrast(1.1)', aiTheme: 'documentary' },
];
export const presetById = (id: string): PostTheme | undefined => THEME_PRESETS.find(t => t.id === id) || libraryThemeById(id);
/** Every ready theme: the 13 classics + the library. */
export const ALL_THEMES: PostTheme[] = [...THEME_PRESETS, ...THEME_LIBRARY];

const KEYWORDS: Array<[string, RegExp]> = [
  ['mythology', /\b(god(dess)?|lord (shiva|vishnu|rama?|krishna|hanuman|murugan|ayyappa)|hanuman|krishna|shiva|devotee|deity|divine|mytholog|ramayana|mahabharata|temple|avatar of)\b/i],
  ['sports', /\b(cricket|kabaddi|football|hockey|boxing|boxer|wrestl|athlete|olympic|tournament|coach|stadium|sprinter|marathon)\b/i],
];
const GENRE_MAP: Record<string, string> = {
  action: 'mass', 'action & adventure': 'mass', adventure: 'mass', war: 'mass', 'war & politics': 'drama', western: 'mass',
  crime: 'thriller', thriller: 'thriller', mystery: 'thriller',
  horror: 'horror', romance: 'romance', comedy: 'comedy', family: 'family', kids: 'family',
  drama: 'drama', history: 'drama', music: 'romance', 'tv movie': 'drama', soap: 'drama', reality: 'comedy', talk: 'comedy',
  'science fiction': 'scifi', 'sci-fi & fantasy': 'scifi', fantasy: 'scifi', animation: 'animation', documentary: 'documentary',
};

/** Pick the theme for a title from its genres (TMDB order = relevance) + synopsis keywords. */
export function genreThemeId(genres?: string | null, overview?: string | null): { id: string; why: string } {
  const list = (genres || '').split(',').map(g => g.trim()).filter(Boolean);
  const lower = list.map(g => g.toLowerCase());
  if (lower.includes('horror')) return { id: 'horror', why: 'Horror' };
  for (const [id, re] of KEYWORDS) if (overview && re.test(overview)) return { id, why: id === 'mythology' ? 'mythology in the synopsis' : 'sport in the synopsis' };
  if (lower.includes('animation')) return { id: 'animation', why: 'Animation' };
  if (lower.includes('documentary')) return { id: 'documentary', why: 'Documentary' };
  for (let i = 0; i < lower.length; i++) if (GENRE_MAP[lower[i]]) return { id: GENRE_MAP[lower[i]], why: list[i] };
  return { id: 'brand', why: 'no genre info' };
}

// ───────────────────────── poster colours ─────────────────────────

export interface Palette { vibrant: string; dark: string }
const paletteCache = new Map<string, Promise<Palette | null>>();

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
function hsv(r: number, g: number, b: number) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return { s: mx === 0 ? 0 : (mx - mn) / mx, v: mx / 255 };
}

/** Sample the poster (via same-origin proxy) for its most vivid colour and a dark base colour. */
export function posterPalette(url: string | null | undefined): Promise<Palette | null> {
  if (!url || typeof window === 'undefined') return Promise.resolve(null);
  if (!paletteCache.has(url)) {
    paletteCache.set(
      url,
      new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const c = document.createElement('canvas');
            c.width = 40;
            c.height = 60;
            const ctx = c.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.drawImage(img, 0, 0, 40, 60);
            const d = ctx.getImageData(0, 0, 40, 60).data;
            const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
            for (let i = 0; i < d.length; i += 4) {
              const k = `${d[i] >> 5},${d[i + 1] >> 5},${d[i + 2] >> 5}`;
              const e = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
              e.n++; e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2];
              buckets.set(k, e);
            }
            const cols = [...buckets.values()].filter(e => e.n >= 6).map(e => ({ n: e.n, r: e.r / e.n, g: e.g / e.n, b: e.b / e.n }));
            const score = (c: { n: number; r: number; g: number; b: number }) => { const { s, v } = hsv(c.r, c.g, c.b); return s * s * v * Math.log(c.n + 1) * (v > 0.35 ? 1 : 0.2); };
            const vib = [...cols].sort((a, b) => score(b) - score(a))[0];
            const darkC = [...cols].filter(c => hsv(c.r, c.g, c.b).v < 0.35).sort((a, b) => b.n - a.n)[0];
            if (!vib) return resolve(null);
            // keep the accent readable on dark backgrounds
            const { v } = hsv(vib.r, vib.g, vib.b);
            const lift = v < 0.7 ? 0.7 / Math.max(v, 0.01) : 1;
            resolve({
              vibrant: hex(Math.min(255, vib.r * lift), Math.min(255, vib.g * lift), Math.min(255, vib.b * lift)),
              dark: darkC ? hex(darkC.r * 0.6, darkC.g * 0.6, darkC.b * 0.6) : '#050505',
            });
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      }),
    );
  }
  return paletteCache.get(url)!;
}

// ───────────────────────── choice → resolved theme ─────────────────────────

/** What the user picked for a post/slide. base: 'auto' | preset id | 'custom:<id>'. */
export interface ThemeChoice {
  base: string;
  tweaks: Partial<PostTheme>;
  posterColors: boolean;
}
export const DEFAULT_CHOICE: ThemeChoice = { base: 'auto', tweaks: {}, posterColors: true };

export interface CustomTheme extends PostTheme { custom: true }

export function resolveTheme(
  choice: ThemeChoice,
  ctx: { genres?: string | null; overview?: string | null; palette?: Palette | null; brandAccent: string; customThemes?: CustomTheme[] },
): PostTheme & { autoWhy?: string } {
  let base: PostTheme | undefined;
  let autoWhy: string | undefined;
  if (choice.base === 'auto') {
    const g = genreThemeId(ctx.genres, ctx.overview);
    base = presetById(g.id);
    autoWhy = g.why;
  } else if (choice.base.startsWith('custom:')) {
    base = ctx.customThemes?.find(t => t.id === choice.base);
  } else {
    base = presetById(choice.base);
  }
  const t: PostTheme = { ...(base || THEME_PRESETS[0]) };
  if (t.id === 'brand') t.accent = ctx.brandAccent;
  // Library themes keep their own palette (that's their point); poster tint is for Auto + the classic presets.
  if (choice.posterColors && ctx.palette && t.id !== 'brand' && !t.id.startsWith('lib:')) {
    t.accent = ctx.palette.vibrant;
    t.bg = [ctx.palette.dark, t.bg[1]];
  }
  return { ...t, ...choice.tweaks, autoWhy };
}

// ───────────────────────── rendering helpers (inline styles, export-safe) ─────────────────────────

export function titleStyle(t: PostTheme, baseSize: number): React.CSSProperties {
  const size = baseSize * (t.titleScale || 1);
  const fx: React.CSSProperties =
    t.titleEffect === 'neon' ? { textShadow: `0 0 ${size * 0.05}px #fff, 0 0 ${size * 0.18}px ${t.accent}, 0 0 ${size * 0.4}px ${t.accent}, 0 0 ${size * 0.8}px ${t.accent}aa` }
    : t.titleEffect === 'retro3d' ? { textShadow: Array.from({ length: 7 }, (_, i) => `${(i + 1) * size * 0.012}px ${(i + 1) * size * 0.012}px 0 ${i < 4 ? t.accent : '#00000099'}`).join(', ') }
    : t.titleEffect === 'double' ? { textShadow: `${-size * 0.045}px ${size * 0.045}px 0 ${t.accent}, ${size * 0.045}px ${-size * 0.03}px 0 rgba(255,255,255,0.25)` }
    :
    t.titleEffect === 'glow' ? { textShadow: `0 0 ${size * 0.25}px ${t.accent}, 0 0 ${size * 0.6}px ${t.accent}88` }
    : t.titleEffect === 'outline' ? { WebkitTextStroke: `${Math.max(2, size * 0.035)}px ${t.accent}`, paintOrder: 'stroke fill' }
    : t.titleEffect === 'shadow' ? { textShadow: `${size * 0.06}px ${size * 0.06}px 0 ${t.accent}` }
    : {};
  return {
    fontFamily: t.titleFont,
    fontSize: size,
    fontWeight: 900,
    lineHeight: 1.02,
    letterSpacing: t.titleTracking,
    textTransform: t.titleTransform,
    fontStyle: t.titleItalic ? 'italic' : 'normal',
    color: t.text,
    ...fx,
  };
}

const GRAIN_SVG = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/** Texture overlay layers for a 1080×1350 frame. */
export function textureLayers(t: PostTheme): React.CSSProperties[] {
  const a = t.accent;
  switch (t.texture) {
    case 'grain': return [{ backgroundImage: GRAIN_SVG, opacity: 0.18, mixBlendMode: 'overlay' }];
    case 'scanlines': return [{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 6px)' }, { background: `linear-gradient(120deg, ${a}22, transparent 40%)` }];
    case 'halftone': return [{ backgroundImage: `radial-gradient(${a}33 22%, transparent 24%)`, backgroundSize: '26px 26px', opacity: 0.6 }];
    case 'lightleak': return [{ background: `radial-gradient(circle at 12% 8%, ${a}66, transparent 38%), radial-gradient(circle at 92% 30%, #ff6a3d44, transparent 35%)`, mixBlendMode: 'screen' }];
    case 'smoke': return [{ background: 'radial-gradient(ellipse at 30% 70%, rgba(255,255,255,0.10), transparent 45%), radial-gradient(ellipse at 75% 40%, rgba(255,255,255,0.08), transparent 40%)' }];
    case 'vignette': return [{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.85) 100%)' }];
    case 'paper': return [{ background: 'radial-gradient(ellipse at center, rgba(255,240,210,0.06), rgba(0,0,0,0.55) 100%)' }, { backgroundImage: GRAIN_SVG, opacity: 0.22, mixBlendMode: 'overlay' }];
    case 'diagonal': return [{ backgroundImage: `repeating-linear-gradient(135deg, ${a}14 0 3px, transparent 3px 26px)` }];
    case 'grid': return [{ backgroundImage: `linear-gradient(${a}1a 1px, transparent 1px), linear-gradient(90deg, ${a}1a 1px, transparent 1px)`, backgroundSize: '64px 64px' }, { background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)' }];
    case 'bokeh': return [{ background: `radial-gradient(circle at 15% 20%, ${a}40 0 60px, transparent 120px), radial-gradient(circle at 85% 12%, #ffffff26 0 40px, transparent 90px), radial-gradient(circle at 78% 70%, ${a}33 0 80px, transparent 150px), radial-gradient(circle at 25% 85%, #ffffff1f 0 50px, transparent 110px)` }];
    case 'filmstrip': return [
      { background: 'linear-gradient(#000 0 0) top / 100% 58px no-repeat, linear-gradient(#000 0 0) bottom / 100% 58px no-repeat' },
      { backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 26px, transparent 26px 54px), repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 26px, transparent 26px 54px)', backgroundSize: '100% 20px, 100% 20px', backgroundPosition: '0 19px, 0 calc(100% - 19px)', backgroundRepeat: 'no-repeat' },
    ];
    case 'sparkle': return [{ backgroundImage: `radial-gradient(2px 2px at 20% 30%, ${a}, transparent), radial-gradient(2px 2px at 70% 20%, #fff, transparent), radial-gradient(3px 3px at 85% 65%, ${a}, transparent), radial-gradient(2px 2px at 35% 80%, #fff, transparent), radial-gradient(2px 2px at 55% 50%, ${a}cc, transparent)`, backgroundSize: '420px 420px', opacity: 0.8 }];
    default: return [];
  }
}

export const frameBackground = (t: PostTheme) => `linear-gradient(170deg, ${t.bg[0]} 0%, ${t.bg[1]} 100%)`;

// ───────────────────────── saved themes (this browser) ─────────────────────────

const KEY = 'ott.customThemes';
export function loadCustomThemes(): CustomTheme[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}
export function saveCustomThemes(list: CustomTheme[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)));
  } catch {}
}
