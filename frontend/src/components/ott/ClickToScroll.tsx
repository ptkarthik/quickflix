'use client';
import React, { useState } from 'react';

/**
 * A tall list inside the page that doesn't trap the mouse wheel: the page scrolls past it,
 * and it only scrolls itself after you click into it (until the mouse leaves).
 */
export function ClickToScroll({ className = '', maxH, count, noun, children }: {
  className?: string;
  /** e.g. 'max-h-72' */
  maxH: string;
  count: number;
  noun: string;
  children: React.ReactNode;
}) {
  const [on, setOn] = useState(false);
  return (
    <div className="relative">
      <div onClick={() => setOn(true)} onMouseLeave={() => setOn(false)}
        className={`${className} ${maxH} pr-1 ${on ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden'}`}>
        {children}
      </div>
      {!on && count > 9 && (
        <button onClick={() => setOn(true)}
          className="absolute inset-x-0 bottom-0 flex h-10 items-end justify-center bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent pb-1 text-[11px] font-medium text-indigo-300 hover:text-white">
          Click to scroll all {count} {noun} ↓
        </button>
      )}
    </div>
  );
}
