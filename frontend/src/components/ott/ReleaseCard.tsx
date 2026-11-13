'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, ExternalLink, ImageIcon, Loader2, Lock, Radio, Save, Search, Trash2, Undo2, X , ImagePlus } from 'lucide-react';
import {
  EVIDENCE_LABEL,
  LANGUAGES,
  OttRelease,
  PLATFORMS,
  PUBLISHABLE,
  TRUST_STYLE,
  TmdbSearchResult,
  fmtDate,
  isCatalogueTitle,
  languageLabel,
  ottApi,
  posterUrl,
} from '@/lib/ott';

type Draft = Pick<OttRelease, 'title' | 'contentType' | 'seasonNumber' | 'dubLanguage' | 'language' | 'platform' | 'releaseDate' | 'notes' | 'tmdbId' | 'posterPath' | 'overview'>;

const toDraft = (r: OttRelease): Draft => ({
  title: r.title,
  contentType: r.contentType,
  seasonNumber: r.seasonNumber,
  dubLanguage: r.dubLanguage,
  language: r.language,
  platform: r.platform,
  releaseDate: r.releaseDate,
  notes: r.notes,
  tmdbId: r.tmdbId,
  posterPath: r.posterPath,
  overview: r.overview,
});

const field = 'w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm focus:border-indigo-500 outline-none';

export function TrustBadge({ release }: { release: Pick<OttRelease, 'trust' | 'trustReason'> }) {
  const t = TRUST_STYLE[release.trust] || TRUST_STYLE.REPORTED;
  return (
    <span title={`${t.hint}${release.trustReason ? `\n${release.trustReason}` : ''}`} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${t.cls}`}>
      {t.icon} {t.label}
    </span>
  );
}

export function LiveBadge({ release }: { release: Pick<OttRelease, 'liveStatus' | 'livePlatforms' | 'liveFirstSeenAt' | 'liveCheckedAt'> }) {
  if (release.liveStatus === 'LIVE') {
    return (
      <span title={`Checked ${release.liveCheckedAt ? new Date(release.liveCheckedAt).toLocaleString('en-IN') : ''}`} className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-300">
        <Radio className="w-3 h-3" /> Streaming in India: {release.livePlatforms}
        {release.liveFirstSeenAt && <span className="text-emerald-500/80">· seen {fmtDate(release.liveFirstSeenAt.slice(0, 10))}</span>}
      </span>
    );
  }
  if (release.liveStatus === 'NOT_LIVE') {
    return <span className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-[11px] text-slate-400">Not streaming in India yet</span>;
  }
  return null;
}

export function ReleaseCard({
  release,
  onChanged,
  onRemoved,
  selectable,
  selected,
  onToggleSelect,
  onMakePost,
}: {
  release: OttRelease;
  onChanged: (r: OttRelease) => void;
  onRemoved: (id: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Opens this title in the Instagram post editor. */
  onMakePost?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(release));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posterSearch, setPosterSearch] = useState<TmdbSearchResult[] | null>(null);
  const [showEvidence, setShowEvidence] = useState(release.trust === 'CONFLICT');

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(release));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }));

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const save = (status?: OttRelease['status']) => {
    if (status === 'APPROVED' && !PUBLISHABLE.includes(release.trust)) {
      const ok = confirm(
        `"${release.title}" is ${TRUST_STYLE[release.trust].label.toUpperCase()}:\n${release.trustReason || ''}\n\n` +
          'Approve anyway? Only do this if you verified it yourself (e.g. in the platform app).',
      );
      if (!ok) return;
    }
    return run(status || 'save', async () => {
      const updated = await ottApi.update(release.id, { ...draft, ...(status ? { status } : {}) });
      setDraft(toDraft(updated));
      onChanged(updated);
    });
  };

  const findPoster = () =>
    run('poster', async () => {
      setPosterSearch(await ottApi.tmdbSearch(draft.title));
    });

  const pickPoster = (m: TmdbSearchResult) => {
    setDraft(d => ({
      ...d,
      tmdbId: m.tmdbId,
      posterPath: m.posterPath || d.posterPath,
      overview: d.overview || m.overview || null,
      language: d.language || m.originalLanguage || null,
      contentType: m.contentType,
    }));
    setPosterSearch(null);
  };

  const evidence = release.evidence || [];
  const sourceCount = new Set(evidence.filter(e => e.sourceType !== 'TMDB_LIVE').map(e => e.sourceKey)).size;
  const missing = [!draft.platform && 'platform', !draft.releaseDate && 'date', !draft.language && 'language', !draft.posterPath && 'poster'].filter(Boolean);
  const statusColor = release.status === 'APPROVED' ? 'border-emerald-600/40' : release.status === 'REJECTED' ? 'border-red-600/30 opacity-70' : release.trust === 'CONFLICT' ? 'border-red-500/40' : 'border-slate-800';
  const poster = posterUrl(draft.posterPath, 'w342');

  return (
    <div className={`rounded-xl border bg-slate-900/70 p-3 flex gap-3 ${statusColor}`}>
      <div className="flex flex-col items-center gap-2 shrink-0">
        {selectable && <input type="checkbox" checked={!!selected} onChange={onToggleSelect} className="self-start" />}
        <button onClick={findPoster} className="relative w-24 h-36 rounded-md overflow-hidden bg-slate-800 group" title="Find poster on TMDB">
          {poster ? <img src={poster} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 m-auto text-slate-600" />}
          <span className="absolute inset-x-0 bottom-0 bg-black/70 text-[10px] py-1 opacity-0 group-hover:opacity-100">{busy === 'poster' ? 'Searching…' : 'Find poster'}</span>
        </button>
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <TrustBadge release={release} />
          <LiveBadge release={release} />
          {isCatalogueTitle(release) && (
            <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[11px] text-sky-300" title="Older title newly added to a platform — say 'new to …', not 'new release'">
              Catalogue title ({release.originalYear})
            </span>
          )}
          {release.dubLanguage && <span className="rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[11px] text-purple-300">{languageLabel(release.dubLanguage)} dub</span>}
          {release.userLocked && <span className="inline-flex items-center gap-1 text-[11px] text-slate-500" title="You edited platform/date; sources can't overwrite them"><Lock className="w-3 h-3" /> your values</span>}
          <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">{release.origin}</span>
        </div>
        {release.trustReason && <p className={`text-xs ${release.trust === 'CONFLICT' ? 'text-red-300' : 'text-slate-400'}`}>{release.trustReason}</p>}

        <input value={draft.title} onChange={e => set('title', e.target.value)} className={`${field} font-semibold text-base`} />

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <select value={draft.platform || ''} onChange={e => set('platform', e.target.value || null)} className={field}>
            <option value="">Platform?</option>
            {[...new Set([...PLATFORMS, ...(draft.platform ? [draft.platform] : [])])].map(p => <option key={p}>{p}</option>)}
          </select>
          <input type="date" value={draft.releaseDate || ''} onChange={e => set('releaseDate', e.target.value || null)} className={field} />
          <select value={draft.language || ''} onChange={e => set('language', e.target.value || null)} className={field} title="Original language">
            <option value="">Language?</option>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <select value={draft.dubLanguage || ''} onChange={e => set('dubLanguage', e.target.value || null)} className={field} title="Leave as Original unless this entry is a dubbed version">
            <option value="">Original version</option>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label} dub</option>)}
          </select>
          <select value={draft.contentType} onChange={e => set('contentType', e.target.value as 'movie' | 'tv')} className={field}>
            <option value="movie">Movie</option>
            <option value="tv">Series</option>
          </select>
          {draft.contentType === 'tv' ? (
            <input type="number" min={1} max={99} value={draft.seasonNumber ?? ''} placeholder="Season" onChange={e => set('seasonNumber', e.target.value ? Number(e.target.value) : null)} className={field} />
          ) : <div />}
        </div>

        {draft.notes && <p className="text-xs text-amber-400 whitespace-pre-line">{draft.notes}</p>}
        {missing.length > 0 && <p className="text-[11px] text-slate-500">Missing: {missing.join(', ')}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}

        <button onClick={() => setShowEvidence(!showEvidence)} className="flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200">
          {showEvidence ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Evidence: {sourceCount} independent source{sourceCount === 1 ? '' : 's'}, {evidence.length} item{evidence.length === 1 ? '' : 's'}
        </button>
        {showEvidence && (
          <ul className="rounded-md border border-slate-800 bg-slate-950 divide-y divide-slate-800 text-xs">
            {evidence.length === 0 && <li className="p-2 text-slate-500">No evidence recorded.</li>}
            {evidence.map(e => {
              const agreesP = !e.claimedPlatform || e.claimedPlatform === release.platform;
              const agreesD = !e.claimedDate || e.claimedDate === release.releaseDate;
              return (
                <li key={e.id} className="p-2 flex gap-2 items-start">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${e.sourceType === 'OFFICIAL_YOUTUBE' || e.sourceType === 'TMDB_LIVE' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                    {EVIDENCE_LABEL[e.sourceType]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-300 line-clamp-2">{e.text || '—'}</div>
                    <div className="text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                      <span>{e.sourceName}</span>
                      {e.claimedPlatform && <span className={agreesP ? '' : 'text-red-400 font-semibold'}>platform: {e.claimedPlatform}</span>}
                      {e.claimedDate && <span className={agreesD ? '' : 'text-red-400 font-semibold'}>date: {fmtDate(e.claimedDate, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                    </div>
                  </div>
                  {e.sourceUrl && /^https?:/.test(e.sourceUrl) && (
                    <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-indigo-300 hover:text-indigo-200" title="Open source"><ExternalLink className="w-3.5 h-3.5" /></a>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {posterSearch && (
          <div className="rounded-md border border-slate-700 bg-slate-950 p-2">
            <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
              <span>Pick the right TMDB match (sets poster and enables the live-in-India check)</span>
              <button onClick={() => setPosterSearch(null)}><X className="w-3.5 h-3.5" /></button>
            </div>
            {posterSearch.length === 0 ? (
              <p className="text-xs text-slate-500">No TMDB results. Try editing the title.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto">
                {posterSearch.slice(0, 10).map(m => (
                  <button key={`${m.contentType}${m.tmdbId}`} onClick={() => pickPoster(m)} className="shrink-0 w-24 text-left hover:opacity-80">
                    <div className="w-24 h-36 rounded bg-slate-800 overflow-hidden">{m.posterPath && <img src={posterUrl(m.posterPath, 'w342')!} alt="" className="w-full h-full object-cover" />}</div>
                    <div className="text-[10px] mt-1 line-clamp-2">{m.title}</div>
                    <div className="text-[10px] text-slate-500">{m.contentType === 'tv' ? 'Series' : 'Movie'} • {m.originalLanguage} • {m.releaseDate?.slice(0, 4) || '—'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {release.status !== 'APPROVED' && (
            <button onClick={() => save('APPROVED')} disabled={!!busy || !draft.title.trim()}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${PUBLISHABLE.includes(release.trust) ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-700 hover:bg-slate-600'}`}>
              {busy === 'APPROVED' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {PUBLISHABLE.includes(release.trust) ? 'Approve' : 'Approve (I verified it)'}
            </button>
          )}
          {release.status !== 'REJECTED' && (
            <button onClick={() => save('REJECTED')} disabled={!!busy} className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-red-900/60 px-3 py-1.5 text-xs">
              <X className="w-3.5 h-3.5" /> {release.status === 'APPROVED' ? 'Remove from list' : 'Reject'}
            </button>
          )}
          {release.status !== 'PENDING' && (
            <button onClick={() => save('PENDING')} disabled={!!busy} className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs">
              <Undo2 className="w-3.5 h-3.5" /> Back to queue
            </button>
          )}
          {dirty && (
            <button onClick={() => save()} disabled={!!busy} className="flex items-center gap-1 rounded-md bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-semibold">
              <Save className="w-3.5 h-3.5" /> Save edits
            </button>
          )}
          <button onClick={findPoster} disabled={!!busy} className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs">
            <Search className="w-3.5 h-3.5" /> Find poster
          </button>
          {onMakePost && release.status === 'APPROVED' && (
            <button onClick={onMakePost} className="flex items-center gap-1 rounded-md bg-pink-600/80 hover:bg-pink-600 px-3 py-1.5 text-xs font-semibold">
              <ImagePlus className="w-3.5 h-3.5" /> Make post
            </button>
          )}
          <button onClick={() => { if (confirm(`Delete "${release.title}" permanently?`)) run('delete', async () => { await ottApi.remove(release.id); onRemoved(release.id); }); }}
            className="ml-auto p-1.5 text-slate-600 hover:text-red-400" title="Delete permanently">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ManualAddForm({ onCreated }: { onCreated: (r: OttRelease) => void }) {
  const empty = { title: '', platform: '', releaseDate: '', language: '', dubLanguage: '', contentType: 'movie' as 'movie' | 'tv', seasonNumber: '', sourceUrl: '' };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const created = await ottApi.create({
        title: f.title,
        platform: f.platform || null,
        releaseDate: f.releaseDate || null,
        language: f.language || null,
        dubLanguage: f.dubLanguage || null,
        contentType: f.contentType,
        seasonNumber: f.contentType === 'tv' && f.seasonNumber ? Number(f.seasonNumber) : null,
        sourceUrl: f.sourceUrl || null,
      } as Partial<OttRelease> & { sourceUrl: string | null });
      onCreated(created);
      setMsg(
        created.status === 'APPROVED'
          ? { ok: true, text: `Added and approved — ${TRUST_STYLE[created.trust].label}: ${created.trustReason}` }
          : { ok: false, text: `Added to the Review Queue (${TRUST_STYLE[created.trust].label}): ${created.trustReason}` },
      );
      setF(empty);
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 space-y-3">
      <div className="text-sm font-semibold">Add a release you saw announced</div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Title *" className={`${field} col-span-2`} />
        <select value={f.platform} onChange={e => setF({ ...f, platform: e.target.value })} className={field}>
          <option value="">Platform</option>
          {PLATFORMS.map(p => <option key={p}>{p}</option>)}
        </select>
        <input type="date" value={f.releaseDate} onChange={e => setF({ ...f, releaseDate: e.target.value })} className={field} />
        <select value={f.language} onChange={e => setF({ ...f, language: e.target.value })} className={field}>
          <option value="">Original language</option>
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <select value={f.dubLanguage} onChange={e => setF({ ...f, dubLanguage: e.target.value })} className={field}>
          <option value="">Original version</option>
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label} dub</option>)}
        </select>
        <select value={f.contentType} onChange={e => setF({ ...f, contentType: e.target.value as 'movie' | 'tv' })} className={field}>
          <option value="movie">Movie</option>
          <option value="tv">Series</option>
        </select>
        {f.contentType === 'tv' && (
          <input type="number" min={1} value={f.seasonNumber} onChange={e => setF({ ...f, seasonNumber: e.target.value })} placeholder="Season" className={field} />
        )}
        <input value={f.sourceUrl} onChange={e => setF({ ...f, sourceUrl: e.target.value })} placeholder="Announcement link (official X / Instagram / YouTube post) — strongly recommended" className={`${field} col-span-2 md:col-span-4`} />
        <button disabled={busy} className="rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 text-sm font-semibold">
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{msg.text}</p>}
      <p className="text-[11px] text-slate-500">
        Your entry counts as one source. It is approved straight away only if it matches an official announcement, a live listing, or another independent source; otherwise it waits in the Review Queue.
      </p>
    </form>
  );
}
