'use client';
import React, { useState } from 'react';
import { Loader2, ShieldCheck, Sparkles, Undo2 } from 'lucide-react';
import { AI_LANGUAGES, AI_TONES, AiCaptionCopy } from '@/lib/ott';

function readPref(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {}
}

/**
 * "Write with AI" for a caption. The AI only supplies the hook, blurb/teasers and closing question;
 * the template keeps every fact (title, platform, date, your rating & review) from verified data.
 */
export function AiCaptionBar({
  request,
  active,
  edited,
  onApply,
  onClear,
  disabled,
}: {
  request: (tone: string, language: string) => Promise<AiCaptionCopy>;
  active: AiCaptionCopy | null;
  /** Caption was hand-edited — confirm before replacing it. */
  edited: boolean;
  onApply: (ai: AiCaptionCopy) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const [tone, setTone] = useState(() => readPref('ott.aiTone', 'hype'));
  const [language, setLanguage] = useState(() => readPref('ott.aiLang', 'en'));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);

  const run = async () => {
    if (edited && !confirm('Replace your edited caption with a new AI version? (Undo AI brings back the template.)')) return;
    setBusy(true);
    setMsg(null);
    try {
      const ai = await request(tone, language);
      onApply(ai);
      setMsg({
        text: `AI lines added (${ai.model}).${ai.dropped ? ` ${ai.dropped} line(s) were removed because they mentioned a platform or date — facts come only from your verified data.` : ''} Edit freely.`,
      });
    } catch (e) {
      setMsg({ text: (e as Error).message, err: true });
    } finally {
      setBusy(false);
    }
  };

  const sel = 'rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs';
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <select value={language} onChange={e => { setLanguage(e.target.value); writePref('ott.aiLang', e.target.value); }} className={sel} title="Caption language">
          {AI_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <select value={tone} onChange={e => { setTone(e.target.value); writePref('ott.aiTone', e.target.value); }} className={sel} title="Tone">
          {AI_TONES.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
        </select>
        <button onClick={run} disabled={busy || disabled}
          className="flex items-center gap-1.5 rounded-md bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {busy ? 'Writing…' : active ? 'Rewrite with AI' : 'Write with AI'}
        </button>
        {active && (
          <button onClick={() => { onClear(); setMsg(null); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
            <Undo2 className="w-3.5 h-3.5" /> Undo AI
          </button>
        )}
        <span className="flex items-center gap-1 text-[11px] text-slate-500" title="AI writes only the hook, short description, teasers and closing question. Title, platform, date and your rating/review always come from your verified data.">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> facts stay verified
        </span>
      </div>
      {msg && <p className={`text-[11px] ${msg.err ? 'text-amber-400' : 'text-violet-300'}`}>{msg.text}</p>}
    </div>
  );
}
