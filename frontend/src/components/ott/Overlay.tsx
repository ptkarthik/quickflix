'use client';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Pop-ups render here, on top of the whole page (a portal to <body>):
 * - never painted under a sticky preview column or another panel,
 * - the mouse wheel over them never scrolls the desk behind,
 * - Esc closes only the top-most one (so a picker inside the Reel window closes first).
 *
 * Layers: drawers 70 · pickers & previews 80 · Reel window 90 · posting confirms 110 · recording 120.
 */
const stack: number[] = [];
let nextId = 1;

export function Overlay({ children, onEscape }: { children: React.ReactNode; onEscape?: () => void }) {
  const esc = useRef(onEscape);
  useEffect(() => { esc.current = onEscape; });
  useEffect(() => {
    const id = nextId++;
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || stack[stack.length - 1] !== id || !esc.current) return;
      e.preventDefault();
      esc.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
