/**
 * The big theme library: ~40 colour palettes × ~16 design styles (font pairing + texture + title effect + photo
 * filter), combined where they suit each other → 300+ ready themes, so posts and Reels don't all look the same.
 * Deterministic: the same id always gives the same theme (saved choices keep working).
 */
import type { PostTheme, Texture, TitleEffect } from './themes';

const font = (v: string, fallback: string) => `var(${v}), ${fallback}`;
export const LIB_FONTS = {
  anton: font('--font-anton', 'Impact, sans-serif'),
  bebas: font('--font-bebas', 'Impact, sans-serif'),
  oswald: font('--font-oswald', '"Arial Narrow", sans-serif'),
  playfair: font('--font-playfair', 'Georgia, serif'),
  cinzel: font('--font-cinzel', 'Georgia, serif'),
  orbitron: font('--font-orbitron', '"Segoe UI", sans-serif'),
  poppins: font('--font-poppins', '"Segoe UI", sans-serif'),
  righteous: font('--font-righteous', '"Segoe UI", sans-serif'),
  abril: font('--font-abril', 'Georgia, serif'),
  slab: font('--font-alfaslab', 'Georgia, serif'),
  bungee: font('--font-bungee', 'Impact, sans-serif'),
  stencil: font('--font-blackops', 'Impact, sans-serif'),
  monoton: font('--font-monoton', 'Impact, cursive'),
  pacifico: font('--font-pacifico', 'cursive'),
  marker: font('--font-marker', 'cursive'),
  typewriter: font('--font-typewriter', '"Courier New", monospace'),
  teko: font('--font-teko', '"Arial Narrow", sans-serif'),
  russo: font('--font-russo', '"Segoe UI", sans-serif'),
  archivo: font('--font-archivo', 'Impact, sans-serif'),
  dancing: font('--font-dancing', 'cursive'),
};

export type ThemeCategory = 'Cinematic' | 'Neon' | 'Warm & desi' | 'Cool' | 'Vintage' | 'Black & white' | 'Festive';
export const THEME_CATEGORIES: ThemeCategory[] = ['Cinematic', 'Neon', 'Warm & desi', 'Cool', 'Vintage', 'Black & white', 'Festive'];

interface Pal { id: string; name: string; emoji: string; bg: [string, string]; accent: string; text: string; cat: ThemeCategory }
const P = (id: string, name: string, emoji: string, bg0: string, bg1: string, accent: string, text: string, cat: ThemeCategory): Pal => ({ id, name, emoji, bg: [bg0, bg1], accent, text, cat });

const PALETTES: Pal[] = [
  // Cinematic
  P('midnight-gold', 'Midnight Gold', '🌙', '#0b0b14', '#000000', '#E8B04B', '#FFFFFF', 'Cinematic'),
  P('oscar-night', 'Oscar Night', '🏆', '#151006', '#000000', '#D4AF37', '#FFF8E6', 'Cinematic'),
  P('blockbuster', 'Blockbuster Red', '🎬', '#2a0505', '#000000', '#E50914', '#FFFFFF', 'Cinematic'),
  P('steel', 'Steel Blue', '🛡️', '#0a1622', '#02060a', '#5DA9E9', '#EAF4FF', 'Cinematic'),
  P('ember', 'Ember', '🔥', '#1f0a02', '#050100', '#FF7A1A', '#FFF3E8', 'Cinematic'),
  P('emerald-noir', 'Emerald Noir', '💎', '#03140d', '#000000', '#2EE59D', '#E9FFF5', 'Cinematic'),
  // Neon
  P('cyber-pink', 'Cyber Pink', '💗', '#12001a', '#000000', '#FF2BD6', '#FFFFFF', 'Neon'),
  P('electric-lime', 'Electric Lime', '⚡', '#081200', '#000000', '#B6FF00', '#F4FFE0', 'Neon'),
  P('synthwave', 'Synthwave', '🌆', '#1a0533', '#05010d', '#FF5ACD', '#E8D9FF', 'Neon'),
  P('aqua-neon', 'Aqua Neon', '🧊', '#001a1f', '#000000', '#00F0FF', '#E0FDFF', 'Neon'),
  P('laser-red', 'Laser Red', '🔴', '#1a0000', '#000000', '#FF3131', '#FFFFFF', 'Neon'),
  P('ultraviolet', 'Ultraviolet', '🔮', '#0d0221', '#000000', '#9D4EDD', '#F3E8FF', 'Neon'),
  // Warm & desi
  P('saffron', 'Saffron', '🧡', '#2b1200', '#0a0400', '#FF9933', '#FFF5E6', 'Warm & desi'),
  P('marigold', 'Marigold', '🌼', '#2a1800', '#0b0600', '#FFC300', '#FFFBEA', 'Warm & desi'),
  P('kumkum', 'Kumkum', '🔺', '#2b0010', '#0a0004', '#E0115F', '#FFE9F1', 'Warm & desi'),
  P('turmeric', 'Turmeric', '💛', '#241c00', '#080600', '#F4C430', '#FFFFFF', 'Warm & desi'),
  P('masala-chai', 'Masala Chai', '☕', '#24140b', '#0a0603', '#D2955B', '#FBEEDD', 'Warm & desi'),
  P('desert-sunset', 'Desert Sunset', '🌅', '#2e0f1a', '#0b0306', '#FF6B6B', '#FFE6E6', 'Warm & desi'),
  // Cool
  P('ocean-deep', 'Ocean Deep', '🌊', '#021526', '#000814', '#3FA7D6', '#E6F4FF', 'Cool'),
  P('arctic', 'Arctic', '❄️', '#0c1a24', '#03080c', '#BDE0FE', '#FFFFFF', 'Cool'),
  P('teal-noir', 'Teal Noir', '🦚', '#00201f', '#000000', '#2EC4B6', '#E6FFFB', 'Cool'),
  P('monsoon', 'Monsoon', '🌧️', '#0f1b24', '#04080b', '#7FB3D5', '#EEF6FB', 'Cool'),
  P('indigo-night', 'Indigo Night', '🌌', '#0b0f2e', '#02030d', '#6C63FF', '#ECEBFF', 'Cool'),
  P('mint', 'Mint', '🍃', '#062018', '#010806', '#98FFCC', '#F0FFF8', 'Cool'),
  // Vintage
  P('sepia', 'Sepia Classic', '📜', '#2a1f14', '#0d0905', '#C8A165', '#F5EBDC', 'Vintage'),
  P('old-bollywood', 'Old Bollywood', '🎞️', '#2b0d0d', '#0c0303', '#F2C14E', '#FFF1D6', 'Vintage'),
  P('teal-orange', 'Retro Teal & Orange', '🍊', '#082a2a', '#020b0b', '#FF8C42', '#FFF4E8', 'Vintage'),
  P('polaroid', 'Polaroid', '📷', '#1d1b18', '#080706', '#E9C46A', '#F8F1E5', 'Vintage'),
  P('technicolor', 'Technicolor', '🎨', '#1a0a2e', '#06020d', '#F15BB5', '#FFF5D1', 'Vintage'),
  // Black & white
  P('noir', 'Noir', '🖤', '#151515', '#000000', '#FFFFFF', '#FFFFFF', 'Black & white'),
  P('silver-screen', 'Silver Screen', '🥈', '#1c1c1c', '#050505', '#C0C0C0', '#F2F2F2', 'Black & white'),
  P('charcoal-red', 'Charcoal & Red', '🩸', '#141414', '#000000', '#FF3B3B', '#FFFFFF', 'Black & white'),
  P('ink-blue', 'Ink & Blue', '🖋️', '#0e1116', '#000000', '#58A6FF', '#FFFFFF', 'Black & white'),
  // Festive
  P('diwali', 'Diwali Lights', '🪔', '#1f0b00', '#060200', '#FFB703', '#FFF8E1', 'Festive'),
  P('pongal', 'Pongal Harvest', '🌾', '#1e1a00', '#070600', '#9ACD32', '#FFFDE7', 'Festive'),
  P('holi', 'Holi Splash', '🌈', '#1b0026', '#050008', '#FF4FD8', '#FFFFFF', 'Festive'),
  P('christmas', 'Christmas', '🎄', '#04160b', '#000000', '#E63946', '#F1FAEE', 'Festive'),
  P('eid', 'Eid Moon', '🌙', '#07152a', '#01050b', '#E9D8A6', '#FFFFFF', 'Festive'),
  P('onam', 'Onam Gold', '🌸', '#0f1a05', '#040701', '#F6BD60', '#FFF8E7', 'Festive'),
];

interface Style {
  id: string;
  name: string;
  title: string;
  body: string;
  transform: 'uppercase' | 'none';
  tracking: number;
  italic?: boolean;
  texture: Texture;
  effect: TitleEffect;
  /** title size vs normal — some fonts are wide (Monoton, Bungee), some tall (Bebas, Teko) */
  scale: number;
  filter?: string;
  cats: ThemeCategory[] | 'all';
}
const F = LIB_FONTS;
const STYLES: Style[] = [
  { id: 'mass', scale: 1.05, name: 'Mass', title: F.anton, body: F.oswald, transform: 'uppercase', tracking: 1, texture: 'grain', effect: 'shadow', cats: ['Cinematic', 'Warm & desi', 'Black & white', 'Festive'] },
  { id: 'tall', scale: 1.12, name: 'Tall Cinema', title: F.bebas, body: F.oswald, transform: 'uppercase', tracking: 4, texture: 'vignette', effect: 'none', cats: ['Cinematic', 'Neon', 'Cool', 'Vintage', 'Black & white'] },
  { id: 'elegant', scale: 0.95, name: 'Elegant', title: F.playfair, body: F.poppins, transform: 'none', tracking: 0, italic: true, texture: 'grain', effect: 'none', cats: ['Cinematic', 'Cool', 'Vintage', 'Black & white'] },
  { id: 'epic', scale: 0.88, name: 'Epic', title: F.cinzel, body: F.playfair, transform: 'uppercase', tracking: 4, texture: 'smoke', effect: 'glow', cats: ['Cinematic', 'Warm & desi', 'Black & white', 'Festive'] },
  { id: 'neon-sign', scale: 0.78, name: 'Neon Sign', title: F.monoton, body: F.poppins, transform: 'uppercase', tracking: 2, texture: 'scanlines', effect: 'neon', filter: 'saturate(1.3) contrast(1.1)', cats: ['Neon', 'Cool', 'Festive'] },
  { id: 'retro-pop', scale: 0.8, name: 'Retro Pop', title: F.bungee, body: F.poppins, transform: 'uppercase', tracking: 0, texture: 'halftone', effect: 'retro3d', cats: ['Neon', 'Warm & desi', 'Vintage', 'Festive'] },
  { id: 'slab', scale: 0.92, name: 'Slab Poster', title: F.slab, body: F.oswald, transform: 'none', tracking: 0, texture: 'paper', effect: 'double', cats: ['Cinematic', 'Warm & desi', 'Vintage', 'Festive'] },
  { id: 'typewriter', scale: 0.86, name: 'Typewriter', title: F.typewriter, body: F.typewriter, transform: 'none', tracking: 0, texture: 'paper', effect: 'none', filter: 'sepia(0.25) contrast(1.05)', cats: ['Cool', 'Vintage', 'Black & white'] },
  { id: 'marker', scale: 0.95, name: 'Marker', title: F.marker, body: F.poppins, transform: 'none', tracking: 0, texture: 'grain', effect: 'shadow', cats: ['Neon', 'Warm & desi', 'Vintage', 'Festive'] },
  { id: 'script', scale: 0.9, name: 'Script', title: F.pacifico, body: F.poppins, transform: 'none', tracking: 0, texture: 'lightleak', effect: 'glow', cats: ['Neon', 'Warm & desi', 'Vintage', 'Festive'] },
  { id: 'techno', scale: 0.78, name: 'Techno', title: F.orbitron, body: F.russo, transform: 'uppercase', tracking: 3, texture: 'grid', effect: 'glow', cats: ['Neon', 'Cool'] },
  { id: 'stencil', scale: 0.92, name: 'Stencil Action', title: F.stencil, body: F.teko, transform: 'uppercase', tracking: 2, texture: 'diagonal', effect: 'outline', cats: ['Cinematic', 'Neon', 'Black & white'] },
  { id: 'heavy', scale: 0.9, name: 'Heavy', title: F.archivo, body: F.poppins, transform: 'uppercase', tracking: -1, texture: 'none', effect: 'double', cats: ['Cinematic', 'Neon', 'Cool', 'Black & white'] },
  { id: 'filmstrip', scale: 0.98, name: 'Film Strip', title: F.abril, body: F.poppins, transform: 'none', tracking: 0, texture: 'filmstrip', effect: 'shadow', cats: ['Cinematic', 'Cool', 'Vintage', 'Black & white', 'Festive'] },
  { id: 'sport', scale: 1.2, name: 'Sport', title: F.teko, body: F.teko, transform: 'uppercase', tracking: 2, italic: true, texture: 'diagonal', effect: 'outline', cats: ['Warm & desi', 'Cool'] },
  { id: 'romance', scale: 1.05, name: 'Romance', title: F.dancing, body: F.poppins, transform: 'none', tracking: 0, texture: 'bokeh', effect: 'glow', cats: ['Warm & desi', 'Cool', 'Festive'] },
  { id: 'fun', scale: 0.95, name: 'Fun', title: F.righteous, body: F.poppins, transform: 'none', tracking: 0, texture: 'sparkle', effect: 'shadow', cats: ['Neon', 'Festive'] },
];

const CAT_FILTER: Record<ThemeCategory, string> = {
  Cinematic: 'contrast(1.05)',
  Neon: 'saturate(1.25) contrast(1.08)',
  'Warm & desi': 'saturate(1.1)',
  Cool: 'saturate(0.95) contrast(1.05)',
  Vintage: 'sepia(0.35) contrast(1.05) saturate(0.9)',
  'Black & white': 'grayscale(1) contrast(1.12)',
  Festive: 'saturate(1.15)',
};
const CAT_AI: Record<ThemeCategory, string> = {
  Cinematic: 'drama', Neon: 'scifi', 'Warm & desi': 'mass', Cool: 'thriller', Vintage: 'drama', 'Black & white': 'thriller', Festive: 'family',
};

export type LibraryTheme = PostTheme & { category: ThemeCategory };

export const THEME_LIBRARY: LibraryTheme[] = PALETTES.flatMap(p =>
  STYLES.filter(s => s.cats === 'all' || s.cats.includes(p.cat)).map(s => ({
    id: `lib:${p.id}:${s.id}`,
    name: `${p.name} · ${s.name}`,
    emoji: p.emoji,
    bg: p.bg,
    accent: p.accent,
    text: p.text,
    titleFont: s.title,
    titleTransform: s.transform,
    titleTracking: s.tracking,
    titleItalic: s.italic,
    titleScale: s.scale,
    bodyFont: s.body,
    texture: s.texture,
    titleEffect: s.effect,
    imageFilter: p.cat === 'Black & white' || p.cat === 'Vintage' ? CAT_FILTER[p.cat] : s.filter || CAT_FILTER[p.cat],
    aiTheme: CAT_AI[p.cat],
    category: p.cat,
  })),
);

export const libraryThemeById = (id: string) => (id.startsWith('lib:') ? THEME_LIBRARY.find(t => t.id === id) : undefined);

// ───────────────────────── variety helpers (this browser) ─────────────────────────

const RECENT = 'themes.recent';
const FAV = 'themes.fav';
const FRESH = 'themes.fresh';
const read = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

export const recentThemes = () => read<string[]>(RECENT, []);
export function rememberTheme(id: string) {
  if (!id || id === 'auto') return;
  write(RECENT, [id, ...recentThemes().filter(x => x !== id)].slice(0, 60));
}
export const favouriteThemes = () => read<string[]>(FAV, []);
export function toggleFavourite(id: string) {
  const f = favouriteThemes();
  const next = f.includes(id) ? f.filter(x => x !== id) : [id, ...f];
  write(FAV, next);
  return next;
}
export const freshEveryPost = () => read<boolean>(FRESH, false);
export const setFreshEveryPost = (v: boolean) => write(FRESH, v);

/** A random library theme you haven't used recently (optionally from one category). */
export function surpriseTheme(category?: ThemeCategory | null): LibraryTheme {
  const recent = new Set(recentThemes().slice(0, 40));
  const pool = THEME_LIBRARY.filter(t => (!category || t.category === category));
  const fresh = pool.filter(t => !recent.has(t.id));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(Math.random() * from.length)];
}
