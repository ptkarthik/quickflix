'use client';
import React, { useState } from 'react';
import { AlertTriangle, Check, Copy, ExternalLink, Link2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { LinkCheck, WhereOpts, WhereResult, WhereService, checkedLabel, whereApi } from '@/lib/where';

const COUNTRY: Record<string, string> = { US: 'US', GB: 'UK', CA: 'Canada', AU: 'Australia', SG: 'Singapore', AE: 'UAE' };

function Row({ label, list, tone }: { label: string; list: WhereService[]; tone: string }) {
  if (!list.length) return null;
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>{label}</span>
      <div className="flex flex-wrap gap-1">
        {list.map(s => (
          <span key={s.name} className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-200">
            {s.logo && <img src={s.logo} alt="" className="h-3.5 w-3.5 rounded-sm" />}
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Where to watch this title in India — re-checked live, legal sources only (TMDB/JustWatch + official free uploads you
 * approved). Never suggests other sites; any link you paste is checked against licensed platforms.
 */
export function WhereToWatch({ domain, id, value, onLoaded, opts, setOpts, inCaption, setInCaption, onToSlide }: {
  domain: 'ott' | 'cinema' | 'world';
  id: string;
  value: WhereResult | null;
  onLoaded: (w: WhereResult) => void;
  opts: WhereOpts;
  setOpts: (o: WhereOpts) => void;
  inCaption: boolean;
  setInCaption: (v: boolean) => void;
  onToSlide?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [check, setCheck] = useState<LinkCheck | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async (force: boolean) => {
    setBusy(true);
    setErr(null);
    try { onLoaded(await whereApi.get(domain, id, force)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const runCheck = async () => {
    if (!link.trim()) return;
    setCheck(null);
    try { setCheck(await whereApi.checkLink(link)); } catch (e) { setCheck({ ok: false, source: null, verdict: 'invalid', message: (e as Error).message }); }
  };
  const w = value;

  return (
    <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/10 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-slate-200">Where to watch (India)</span>
        <span className="text-[10px] text-slate-500">{w ? checkedLabel(w.checkedAt) : busy ? 'checking…' : ''}</span>
        <button onClick={() => load(true)} disabled={busy} title="Check again now"
          className="ml-auto inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700 disabled:opacity-50">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Re-check
        </button>
      </div>
      {err && <div className="text-xs text-rose-400">{err}</div>}
      {w?.note && <div className="text-[11px] text-amber-300">{w.note}</div>}

      {w && (
        <div className="space-y-1.5">
          <Row label="Stream" list={w.stream} tone="text-emerald-400" />
          <Row label="Free" list={w.free} tone="text-sky-400" />
          {w.official.map(v => (
            <a key={v.url} href={v.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 pl-[72px] text-[11px] text-sky-300 hover:underline">
              <ExternalLink className="w-3 h-3" /> {v.source === 'archive' ? 'Internet Archive (public domain)' : `YouTube — ${v.channel || 'official channel'}`}
            </a>
          ))}
          <Row label="Rent" list={w.rent} tone="text-amber-400" />
          <Row label="Buy" list={w.buy} tone="text-amber-400" />
          {w.status === 'none' && (
            <div className="flex items-start gap-1.5 rounded bg-slate-900 p-1.5 text-[11px] text-slate-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>
                No licensed source in India right now{w.elsewhere.length ? ` — streams on ${w.elsewhere.slice(0, 3).map(e => `${e.services[0]} (${COUNTRY[e.country] || e.country})`).join(', ')}` : ''}.
                The caption will say so honestly. Don’t point people to download sites.
              </span>
            </div>
          )}
          {w.link && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <a href={w.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:underline">
                <ExternalLink className="w-3 h-3" /> All platforms with links
              </a>
              <button onClick={async () => { await navigator.clipboard.writeText(w.link!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                title="For your story link sticker or bio (captions can’t have clickable links)"
                className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-slate-300 hover:bg-slate-700">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy link for story'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-800 pt-2 text-[11px] text-slate-300">
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={inCaption} onChange={e => setInCaption(e.target.checked)} /> Add to caption</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={!!opts.download} onChange={e => setOpts({ ...opts, download: e.target.checked })} /> Mention offline download</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={!!opts.elsewhere} onChange={e => setOpts({ ...opts, elsewhere: e.target.checked })} /> Say where else it streams</label>
        {onToSlide && w && (
          <button onClick={onToSlide} className="rounded bg-emerald-700/70 px-2 py-0.5 text-white hover:bg-emerald-600">Put on “Where to watch” slide</button>
        )}
      </div>

      <div className="space-y-1 border-t border-slate-800 pt-2">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Link2 className="absolute left-2 top-1.5 w-3.5 h-3.5 text-slate-500" />
            <input value={link} onChange={e => { setLink(e.target.value); setCheck(null); }} onKeyDown={e => e.key === 'Enter' && runCheck()}
              placeholder="Have a link? Paste it to check it’s a licensed source"
              className="w-full rounded bg-slate-950 border border-slate-700 py-1 pl-7 pr-2 text-[11px]" />
          </div>
          <button onClick={runCheck} className="rounded bg-slate-800 px-2 text-[11px] text-slate-200 hover:bg-slate-700">Check</button>
        </div>
        {check && (
          <div className={`flex items-start gap-1 text-[11px] ${check.ok ? 'text-emerald-300' : check.verdict === 'check-channel' ? 'text-amber-300' : 'text-rose-300'}`}>
            {check.ok ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />} {check.message}
          </div>
        )}
      </div>
    </div>
  );
}
