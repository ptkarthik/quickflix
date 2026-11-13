'use client';
import { useCallback, useState } from 'react';

/**
 * What's drawn on a post picture, and where — the same model for single posts and carousel title slides
 * on every desk (OTT, Cinema, World). Every element can be switched off, moved, resized or reordered,
 * and you can add your own text / labels.
 */

export type BlockKind = 'kicker' | 'title' | 'badge' | 'date' | 'meta' | 'ratings' | 'stars' | 'review' | 'note' | 'oneLiner' | 'text';
export type BlockPlace = 'picture-top' | 'picture-bottom' | 'below';
export type BlockStyle = 'plain' | 'label' | 'outline' | 'big';
export type BlockColor = 'accent' | 'white' | 'muted';

export interface LookBlock {
  id: string;
  kind: BlockKind;
  on: boolean;
  place: BlockPlace;
  /** % of the normal size */
  size: number;
  /** Your text (custom text; the label's wording — empty = automatic). */
  text?: string;
  style?: BlockStyle;
  color?: BlockColor;
  /** details line: parts you removed (year, language, genre, length, cert, type) */
  hideParts?: string[];
}

export interface PostLook {
  blocks: LookBlock[];
  align: 'center' | 'left';
  /** % of the normal picture size (the picture also shrinks by itself if the text needs room). */
  picture: number;
  handle: boolean;
  page: boolean;
  rank: boolean;
}

/** Per-slide fine-tuning of the picture, the shade over it and the text (carousel title slides). */
export interface SlideAdjust {
  /** picture zoom (1 = normal) */
  zoom: number;
  /** picture focus point, % from left / top */
  x: number;
  y: number;
  /** picture brightness % */
  brightness: number;
  /** shade over the picture: strength % and how far up it reaches % (100 = normal) */
  shade: number;
  shadeHeight: number;
  /** text size % and move up (−) / down (+) in px */
  textScale: number;
  textY: number;
}
export const DEFAULT_ADJUST: SlideAdjust = { zoom: 1, x: 50, y: 50, brightness: 100, shade: 100, shadeHeight: 100, textScale: 100, textY: 0 };

export type LookSurface = 'single' | 'slide';
export type LookDesk = 'ott' | 'cinema' | 'world';

export const BLOCK_INFO: Record<BlockKind, { label: string; hint: string }> = {
  kicker: { label: 'Label', hint: 'e.g. NOW STREAMING / IN CINEMAS / MUST WATCH' },
  title: { label: 'Title', hint: '' },
  badge: { label: 'Platform / ticket badge', hint: 'Netflix pill, cinema ticket' },
  date: { label: 'Date', hint: 'release / streaming date (old date struck through on postponements); World titles show their year in the details line' },
  meta: { label: 'Details line', hint: 'year • language • genre • running time / certificate — tick the parts you want' },
  ratings: { label: 'Ratings', hint: 'IMDb, RT, … — choose which in “One-liner & ratings”' },
  stars: { label: 'My stars', hint: 'your ★ rating' },
  review: { label: 'My review', hint: 'your short review text' },
  note: { label: 'My note', hint: 'the note you type for a title in a list' },
  oneLiner: { label: 'One-liner', hint: 'from “One-liner & ratings”' },
  text: { label: 'Your text', hint: '' },
};

export const PLACE_LABEL: Record<BlockPlace, string> = { 'picture-top': 'On picture · top', 'picture-bottom': 'On picture · bottom', below: 'Below picture' };

let seq = 0;
const bid = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;
const b = (kind: BlockKind, on: boolean, place: BlockPlace = 'below', extra: Partial<LookBlock> = {}): LookBlock => ({ id: kind, kind, on, place, size: 100, ...extra });

export function defaultLook(surface: LookSurface): PostLook {
  if (surface === 'single') {
    return {
      align: 'center', picture: 100, handle: true, page: false, rank: false,
      blocks: [
        b('oneLiner', true, 'picture-bottom'),
        b('kicker', true),
        b('title', true),
        b('badge', true),
        b('date', true),
        b('meta', true),
        b('ratings', true),
        b('stars', true),
        b('review', true),
        b('note', false),
      ],
    };
  }
  return {
    align: 'center', picture: 100, handle: true, page: true, rank: true,
    blocks: [
      b('oneLiner', true, 'picture-bottom'),
      b('kicker', false),
      b('title', true),
      b('badge', true),
      b('date', true),
      b('ratings', true),
      b('note', true),
      b('meta', true),
      b('stars', false),
      b('review', false),
    ],
  };
}

export const newTextBlock = (style: BlockStyle = 'plain'): LookBlock => ({
  id: bid(), kind: 'text', on: true, place: style === 'label' ? 'picture-top' : 'below', size: 100, text: style === 'label' ? 'MUST WATCH' : 'Your text', style, color: style === 'label' ? 'accent' : 'white',
});

/** Older saved looks get any element added later (switched off), so nothing silently disappears. */
export function normalizeLook(raw: unknown, surface: LookSurface): PostLook {
  const def = defaultLook(surface);
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as PostLook).blocks)) return def;
  const r = raw as PostLook;
  const blocks = r.blocks.filter(x => x && BLOCK_INFO[x.kind]).map(x => ({ ...x, size: Math.max(50, Math.min(180, Number(x.size) || 100)) }));
  for (const d of def.blocks) if (!blocks.some(x => x.kind === d.kind)) blocks.push({ ...d, on: false });
  return {
    blocks,
    align: r.align === 'left' ? 'left' : 'center',
    picture: Math.max(50, Math.min(120, Number(r.picture) || 100)),
    handle: r.handle !== false,
    page: r.page !== false,
    rank: r.rank !== false,
  };
}

const keyOf = (desk: LookDesk, surface: LookSurface) => `postLook.${desk}.${surface}`;
const SAVED_KEY = 'postLook.saved';
export interface SavedLook { name: string; surface: LookSurface; look: PostLook }

const read = <T,>(k: string): T | null => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

/** The layout for one desk + surface, remembered in this browser. */
export function usePostLook(desk: LookDesk, surface: LookSurface) {
  const [look, setLookState] = useState<PostLook>(() => (typeof window === 'undefined' ? defaultLook(surface) : normalizeLook(read(keyOf(desk, surface)), surface)));
  const [seen, setSeen] = useState(`${desk}.${surface}`);
  if (seen !== `${desk}.${surface}`) {
    setSeen(`${desk}.${surface}`);
    setLookState(normalizeLook(read(keyOf(desk, surface)), surface));
  }
  const setLook = useCallback((next: PostLook) => {
    setLookState(next);
    write(keyOf(desk, surface), next);
  }, [desk, surface]);
  const reset = useCallback(() => setLook(defaultLook(surface)), [setLook, surface]);
  /** Copy this layout to the same kind of post on the other desks. */
  const copyToAllDesks = useCallback(() => {
    for (const d of ['ott', 'cinema', 'world'] as LookDesk[]) write(keyOf(d, surface), look);
  }, [look, surface]);
  return { look, setLook, reset, copyToAllDesks };
}

/** Named layouts you saved — usable on any desk. */
export function useSavedLooks(surface: LookSurface) {
  const [all, setAll] = useState<SavedLook[]>(() => (typeof window === 'undefined' ? [] : read<SavedLook[]>(SAVED_KEY) || []));
  const save = (name: string, look: PostLook) => {
    const next = [{ name, surface, look }, ...all.filter(s => !(s.name === name && s.surface === surface))].slice(0, 30);
    setAll(next);
    write(SAVED_KEY, next);
  };
  const remove = (name: string) => {
    const next = all.filter(s => !(s.name === name && s.surface === surface));
    setAll(next);
    write(SAVED_KEY, next);
  };
  return { saved: all.filter(s => s.surface === surface), save, remove };
}
