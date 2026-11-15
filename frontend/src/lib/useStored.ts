'use client';
import { useState } from 'react';

/**
 * State remembered in this browser (localStorage) — like useState, including updater functions.
 * `keep` trims what is saved (e.g. only per-title choices, not one-off slides).
 * Only for components that mount client-side (the post editors do).
 */
export function useStored<T>(key: string, initial: T, keep?: (v: T) => T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set: React.Dispatch<React.SetStateAction<T>> = next =>
    setV(prev => {
      const val = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      try { localStorage.setItem(key, JSON.stringify(keep ? keep(val) : val)); } catch { /* storage full / blocked — still works this visit */ }
      return val;
    });
  return [v, set] as const;
}

/** Keep only per-title entries ("t:<id>"), newest last, at most `max`. */
export const titleKeysOnly = <V,>(m: Record<string, V>, max = 400): Record<string, V> =>
  Object.fromEntries(Object.entries(m).filter(([k]) => k.startsWith('t:')).slice(-max));
