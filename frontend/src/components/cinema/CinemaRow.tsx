'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, ExternalLink, ImagePlus, Lock, Save, Trash2, Tv, X } from 'lucide-react';
import { LANGUAGES, PUBLISHABLE, TRUST_STYLE, addDays, posterUrl } from '@/lib/ott';
import { CINEMA_EVIDENCE_LABEL, CinemaRelease, cinemaApi, cinemaLanguages, dateHistory, fmtCinemaDate, relativeDay } from '@/lib/cinema';

const field = 'w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm focus:border-indigo-500 outline-none';

export function CinemaTrustBadge({ r }: { r: Pick<CinemaRelease, 'trust' | 'trustReason'> }) {
  const t = TRUST_STYLE[r.trust] || TRUST_STYLE.REPORTED;
  return (
    <span title={`${t.hint}${r.trustReason ? `\n${r.trustReason}` : ''}`} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${t.cls}`}>
      {t.icon} {t.label}
    </span>
  );
}

/** "⚠ Date changed: was Fri, 13 Nov" — the postponement watcher's flag. */
export function DateChangedBadge({ r, today }: { r: CinemaRelease; today: string }) {
  if (!r.previousDate || !r.releaseDate || r.previousDate === r.releaseDate) return null;
  // Show for 3 weeks after the change.
  const recent = !!r.dateChangedAt && r.dateChangedAt.slice(0, 10) >= addDays(today, -21);
  if (!recent) return null;
  const later = r.releaseDate > r.previousDate;
  return (
    <span title={`Changed ${r.dateChangedAt ? new Date(r.dateChangedAt).toLocaleString('en-IN') : ''}`}
      className="inline-flex items-center gap-1 rounded-full border border-orange-500/50 bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-300 whitespace-nowrap">
      <AlertTriangle className="w-3 h-3" /> {later ? 'Postponed' : 'Preponed'} · was {fmtCinemaDate(r.previousDate).replace(/, \d{4}$/, '')}
    </span>
  );
}

export function CinemaRow({
  r, today, selected, onToggleSelect, onChanged, onRemoved, onMakePost,
}: {
  r: CinemaRelease;
  today: string;
  selected?: boolean;
  onToggleSelect?: () => void;
  onChanged: (r: CinemaRelease) => void;
  onRemoved: (id: string) => void;
  /** Approved films: open this film in the Instagram post editor. */
  onMakePost?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: r.title, releaseDate: r.releaseDate || '', language: r.language || '', certificate: r.certificate || '', notes: r.notes || '' });
  const dirty = draft.title !== r.title || draft.releaseDate !== (r.releaseDate || '') || draft.language !== (r.language || '') || draft.certificate !== (r.certificate || '') || draft.notes !== (r.notes || '');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const setStatus = (status: 'APPROVED' | 'REJECTED' | 'PENDING') => {
    if (status === 'APPROVED' && !PUBLISHABLE.includes(r.trust)) {
      if (!confirm(`"${r.title}" is ${TRUST_STYLE[r.trust].label.toUpperCase()}:\n${r.trustReason || ''}\n\nApprove only if you verified the date yourself.`)) return;
    }
    run(async () => onChanged(await cinemaApi.update(r.id, { status })));
  };
  const save = () =>
    run(async () =>
      onChanged(await cinemaApi.update(r.id, {
        title: draft.title, releaseDate: draft.releaseDate || null, language: draft.language || null, certificate: draft.certificate || null, notes: draft.notes || null,
      })),
    );

  const langs = cinemaLanguages(r);
  const poster = posterUrl(r.posterPath, 'w342');
  const history = dateHistory(r);

  return (
    <div className={`${open ? 'bg-slate-900/80' : ''}`}>
      <div className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-900/70">
        {onToggleSelect && <input type="checkbox" checked={!!selected} onChange={onToggleSelect} className="shrink-0" />}
        <button onClick={() => setOpen(!open)} className="flex flex-1 min-w-0 items-center gap-3 text-left">
          {open ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-500" /> : <ChevronRight className="w-4 h-4 shrink-0 text-slate-500" />}
          <span className="w-28 shrink-0 tabular-nums">
            <span className="block text-slate-200">{r.releaseDate ? fmtCinemaDate(r.releaseDate).replace(/, \d{4}$/, '') : 'Date TBA'}</span>
            {r.releaseDate && <span className="block text-[10px] text-slate-500">{relativeDay(r.releaseDate, today)}</span>}
          </span>
          {poster ? <img src={poster} alt="" className="w-7 h-10 rounded object-cover shrink-0" /> : <span className="w-7 h-10 rounded bg-slate-800 shrink-0" />}
          <span className="flex-1 min-w-0">
            <span className="block truncate font-medium text-white" title={r.title}>
              {r.title}
              {r.userLocked && <Lock className="inline w-3 h-3 ml-1.5 text-slate-500" />}
            </span>
            <span className="block truncate text-[11px] text-slate-500">
              {langs.join(' · ') || 'Language ?'}{r.certificate ? ` · ${r.certificate}` : ''}{r.production ? ` · ${r.production}` : ''}
            </span>
          </span>
          <span className="hidden lg:flex items-center gap-1.5 shrink-0">
            <DateChangedBadge r={r} today={today} />
            {r.ottDate && r.ottDate <= today && <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[11px] text-purple-300"><Tv className="w-3 h-3" /> On OTT</span>}
          </span>
          <span className="w-32 shrink-0 flex justify-end"><CinemaTrustBadge r={r} /></span>
        </button>
        {r.status === 'PENDING' ? (
          <div className="flex shrink-0 gap-1">
            <button disabled={busy} onClick={() => setStatus('APPROVED')} title="Approve" className="rounded-md bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-50 p-1.5"><Check className="w-3.5 h-3.5" /></button>
            <button disabled={busy} onClick={() => setStatus('REJECTED')} title="Reject (not a cinema release / wrong)" className="rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 p-1.5"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <>
          {onMakePost && r.status === 'APPROVED' && (
            <button onClick={onMakePost} title="Make an Instagram post for this film" className="shrink-0 flex items-center gap-1 rounded-md bg-indigo-600/90 hover:bg-indigo-600 px-2 py-1 text-[11px] font-semibold">
              <ImagePlus className="w-3.5 h-3.5" /> Post
            </button>
          )}
          <button disabled={busy} onClick={() => setStatus('PENDING')} className="shrink-0 rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px] text-slate-300">
            {r.status === 'APPROVED' ? 'Unapprove' : 'Restore'}
          </button>
          </>
        )}
      </div>

      {open && (
        <div className="px-4 pb-4 pt-1 ml-8 space-y-3 text-sm">
          <p className={`text-xs ${r.trust === 'CONFLICT' ? 'text-red-300' : 'text-slate-400'}`}>{r.trustReason}</p>
          {r.notes && <p className="text-xs text-amber-300 whitespace-pre-wrap">{r.notes}</p>}

          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-2">
            <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className={field} />
            <input type="date" value={draft.releaseDate} onChange={e => setDraft({ ...draft, releaseDate: e.target.value })} className={field} title="India cinema release date (editing locks it)" />
            <select value={draft.language} onChange={e => setDraft({ ...draft, language: e.target.value })} className={field}>
              <option value="">Language?</option>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              {draft.language && !LANGUAGES.some(l => l.code === draft.language) && <option value={draft.language}>{draft.language.toUpperCase()}</option>}
            </select>
            <input value={draft.certificate} onChange={e => setDraft({ ...draft, certificate: e.target.value })} className={field} placeholder="Certificate (U / UA / A)" />
          </div>
          <textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} rows={2} className={field} placeholder="Notes" />

          {history.length > 0 && (
            <div className="text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Date history:</span>{' '}
              {history.map((h, i) => <span key={i}>{i > 0 && ' → '}{fmtCinemaDate(h.date)} <span className="text-slate-600">({h.by}, {new Date(h.at).toLocaleDateString('en-IN')})</span></span>)}
            </div>
          )}

          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-300">Evidence ({new Set((r.evidence || []).map(e => e.sourceKey)).size} independent sources)</div>
            {(r.evidence || []).map(e => {
              const disagrees = e.claimedDate && r.releaseDate && e.claimedDate !== r.releaseDate;
              return (
                <div key={e.id} className={`flex items-start gap-2 text-xs ${disagrees || e.postponed ? 'text-red-300' : 'text-slate-400'}`}>
                  <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{CINEMA_EVIDENCE_LABEL[e.sourceType]}</span>
                  <span className="flex-1 min-w-0">
                    <b className="text-slate-300">{e.sourceName || e.sourceKey}</b>
                    {e.claimedDate ? ` → ${fmtCinemaDate(e.claimedDate)}` : ''}
                    {e.postponed ? ' · reports POSTPONEMENT' : ''}
                    {e.text ? <span className="text-slate-500"> — {e.text}</span> : null}
                  </span>
                  {e.sourceUrl && /^https?:/.test(e.sourceUrl) && (
                    <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="shrink-0 text-indigo-300 hover:text-indigo-200"><ExternalLink className="w-3.5 h-3.5" /></a>
                  )}
                </div>
              );
            })}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center gap-2">
            {dirty && (
              <button disabled={busy} onClick={save} className="flex items-center gap-1 rounded-md bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-semibold"><Save className="w-3.5 h-3.5" /> Save edits</button>
            )}
            {r.tmdbId && (
              <a href={`https://www.themoviedb.org/movie/${r.tmdbId}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs">TMDB <ExternalLink className="w-3 h-3" /></a>
            )}
            <a href={`https://www.google.com/search?q=${encodeURIComponent(`${r.title} ${langs[0] || ''} movie release date`)}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs">Check on Google <ExternalLink className="w-3 h-3" /></a>
            <button onClick={() => { if (confirm(`Delete "${r.title}" permanently?`)) run(async () => { await cinemaApi.remove(r.id); onRemoved(r.id); }); }}
              className="ml-auto p-1.5 text-slate-600 hover:text-red-400" title="Delete permanently"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
