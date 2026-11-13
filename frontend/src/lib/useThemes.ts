'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from './api';
import { CustomTheme, Palette, loadCustomThemes, posterPalette, saveCustomThemes } from './themes';

/** Poster colour palettes, keyed by (proxied) image URL. Loads lazily; missing entries are simply undefined. */
export function usePalettes(urls: Array<string | null | undefined>): Record<string, Palette | null> {
  const [map, setMap] = useState<Record<string, Palette | null>>({});
  const key = [...new Set(urls.filter(Boolean))].sort().join('|');
  useEffect(() => {
    let alive = true;
    for (const u of key ? key.split('|') : []) {
      posterPalette(u).then(p => {
        if (alive) setMap(m => (u in m ? m : { ...m, [u]: p }));
      });
    }
    return () => {
      alive = false;
    };
  }, [key]);
  return map;
}

/** Your saved themes (this browser). */
export function useCustomThemes(): [CustomTheme[], (t: CustomTheme) => void] {
  const [list, setList] = useState<CustomTheme[]>(() => (typeof window === 'undefined' ? [] : loadCustomThemes()));
  const add = (t: CustomTheme) =>
    setList(l => {
      const next = [t, ...l.filter(x => x.id !== t.id)];
      saveCustomThemes(next);
      return next;
    });
  return [list, add];
}

export interface AiPosterResult {
  images: Array<{ url: string; model: string }>;
  prompt: string;
  failed: number;
}

export const mediaApi = {
  /** Paid Gemini image generation — exactly one request, never retried automatically. */
  aiPoster: (body: { kind: 'ott' | 'cinema' | 'world'; id: string; theme?: string; count?: number; mode?: 'restyle' | 'background'; extra?: string }) =>
    apiFetch('/media/ai-poster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 0).then(async r => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { message?: string }).message || `AI poster failed (${r.status})`);
      return j as AiPosterResult;
    }),
};
