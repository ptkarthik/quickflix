'use client';
import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { OttRelease, PUBLISHABLE, TRUST_STYLE, displayTitle, fmtDate, languageLabel, ottApi, platformStyle, posterUrl } from '@/lib/ott';
import { ReleaseCard } from './ReleaseCard';

/** Compact one-line-per-title schedule. Click a row to open the full card (evidence, edits). */
export function ReleaseList({
  items,
  onChanged,
  onRemoved,
  selected,
  onToggleSelect,
}: {
  items: OttRelease[];
  onChanged: (r: OttRelease) => void;
  onRemoved: (id: string) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const setStatus = async (r: OttRelease, status: 'APPROVED' | 'REJECTED') => {
    if (status === 'APPROVED' && !PUBLISHABLE.includes(r.trust)) {
      if (!confirm(`"${r.title}" is ${TRUST_STYLE[r.trust].label.toUpperCase()}:\n${r.trustReason || ''}\n\nApprove only if you verified it yourself.`)) return;
    }
    setBusy(r.id);
    try {
      onChanged(await ottApi.update(r.id, { status }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 divide-y divide-slate-800 overflow-hidden">
      {items.map(r => {
        const t = TRUST_STYLE[r.trust] || TRUST_STYLE.REPORTED;
        const ps = platformStyle(r.platform);
        const isOpen = open === r.id;
        return (
          <div key={r.id + r.updatedAt}>
            <div className={`flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-900/70 ${isOpen ? 'bg-slate-900/70' : ''}`}>
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggleSelect(r.id)} className="shrink-0" />
              <button onClick={() => setOpen(isOpen ? null : r.id)} className="flex flex-1 min-w-0 items-center gap-3 text-left">
                {isOpen ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-500" /> : <ChevronRight className="w-4 h-4 shrink-0 text-slate-500" />}
                <span className="w-24 shrink-0 tabular-nums text-slate-300">{r.releaseDate ? fmtDate(r.releaseDate, { weekday: 'short', day: 'numeric', month: 'short' }) : 'Date TBA'}</span>
                {r.posterPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={posterUrl(r.posterPath, 'w342') || undefined} alt="" className="w-7 h-10 rounded object-cover shrink-0" />
                ) : (
                  <span className="w-7 h-10 rounded bg-slate-800 shrink-0" />
                )}
                <span className="flex-1 min-w-0 truncate font-medium text-white" title={displayTitle(r)}>{displayTitle(r)}</span>
                <span className="hidden md:block w-20 shrink-0 text-xs text-slate-400 truncate">{languageLabel(r.language)}</span>
                <span className="w-24 shrink-0">
                  {r.platform ? (
                    <span className="inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: ps.bg, color: ps.fg }}>{r.platform}</span>
                  ) : (
                    <span className="text-xs text-slate-500">No platform</span>
                  )}
                </span>
                <span className={`hidden sm:inline-block w-28 shrink-0 rounded-full border px-2 py-0.5 text-[11px] text-center ${t.cls}`} title={r.trustReason || t.hint}>
                  {t.icon} {t.label}
                </span>
              </button>
              <div className="flex shrink-0 gap-1">
                <button disabled={busy === r.id} onClick={() => setStatus(r, 'APPROVED')} title="Approve"
                  className="rounded-md bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-50 p-1.5"><Check className="w-3.5 h-3.5" /></button>
                <button disabled={busy === r.id} onClick={() => setStatus(r, 'REJECTED')} title="Reject"
                  className="rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 p-1.5"><X className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            {isOpen && (
              <div className="bg-slate-950 p-3">
                <ReleaseCard release={r} onChanged={onChanged} onRemoved={onRemoved} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
