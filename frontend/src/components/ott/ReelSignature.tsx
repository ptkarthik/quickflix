'use client';
/* eslint-disable @next/next/no-img-element -- rasterised by html-to-image */
import React, { useEffect, useRef, useState } from 'react';
import { PenLine, Upload, X } from 'lucide-react';

/** Your signature card — e.g. "Naan ungal Karthik · Follow for more" — dropped into any Reel's timeline. */
export interface Signature {
  on: boolean;
  text: string;
  /** a second line in Tamil (optional) */
  tamil: string;
  showTamil: boolean;
  cta: string;
  photo: string | null;
  style: 'glow' | 'gold' | 'clean';
  /** where in the Reel */
  at: 'start' | 'second' | 'beforeLast' | 'end';
  seconds: number;
}
const DEFAULT: Signature = {
  on: false, text: 'Naan ungal Karthik', tamil: 'நான் உங்கள் கார்த்திக்', showTamil: false, cta: 'Follow for more 🎬',
  photo: null, style: 'glow', at: 'beforeLast', seconds: 2.5,
};
const KEY = 'reelSignature.v1';

export function useSignature(): [Signature, (p: Partial<Signature>) => void] {
  const [sig, setSig] = useState<Signature>(() => {
    try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULT; }
  });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(sig)); } catch { /* photo too big for storage — still used this time */ } }, [sig]);
  return [sig, p => setSig(s => ({ ...s, ...p }))];
}

/** Where the signature goes, for N slides (returns the index to insert at). */
export function signatureIndex(at: Signature['at'], n: number) {
  if (at === 'start') return 0;
  if (at === 'second') return Math.min(1, n);
  if (at === 'beforeLast') return Math.max(0, n - 1);
  return n;
}

const PALETTE = {
  glow: { bg: 'radial-gradient(circle at 50% 38%, ACCENT55 0%, #12091f 45%, #050308 100%)', ink: '#ffffff', glow: 'ACCENT', sub: '#e9d5ff' },
  gold: { bg: 'radial-gradient(circle at 50% 40%, #3a2a0a 0%, #0c0904 55%, #000 100%)', ink: '#f6d77a', glow: '#d4a017', sub: '#f3e3b0' },
  clean: { bg: 'linear-gradient(160deg, #fdfbf7 0%, #f1ece2 100%)', ink: '#1a1a1a', glow: 'transparent', sub: '#444' },
};

/** The card itself, 1080×1350 (same as a slide — the Reel centres it on 9:16). */
export function SignatureCard({ sig, handle, accent = '#a855f7' }: { sig: Signature; handle: string; accent?: string }) {
  const p = PALETTE[sig.style];
  const fill = (s: string) => s.replace(/ACCENT/g, accent);
  const long = sig.text.length > 20;
  return (
    <div style={{ width: 1080, height: 1350, position: 'relative', overflow: 'hidden', background: fill(p.bg), color: p.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34, fontFamily: 'var(--font-poppins), "Segoe UI", sans-serif' }}>
      {sig.style !== 'clean' && <div style={{ position: 'absolute', inset: 40, border: `3px solid ${fill(p.glow)}55`, borderRadius: 48 }} />}
      {sig.photo && (
        <img src={sig.photo} alt="" style={{ width: 300, height: 300, borderRadius: '50%', objectFit: 'cover', border: `10px solid ${sig.style === 'clean' ? accent : fill(p.glow)}`, boxShadow: `0 0 60px ${fill(p.glow)}88` }} />
      )}
      <div style={{ textAlign: 'center', padding: '0 70px' }}>
        <div style={{ fontFamily: 'var(--font-dancing), "Segoe Script", cursive', fontWeight: 700, fontSize: long ? 128 : 156, lineHeight: 1.05, textShadow: sig.style === 'clean' ? 'none' : `0 0 28px ${fill(p.glow)}, 0 0 70px ${fill(p.glow)}88` }}>
          {sig.text}
        </div>
        <svg width="620" height="60" viewBox="0 0 620 60" style={{ display: 'block', margin: '6px auto 0' }}>
          <path d="M10 40 C 160 8, 330 58, 470 26 S 600 18, 612 30" fill="none" stroke={sig.style === 'gold' ? '#f6d77a' : accent} strokeWidth="9" strokeLinecap="round" />
        </svg>
        {sig.showTamil && sig.tamil && <div style={{ fontFamily: 'var(--font-tamil), sans-serif', fontWeight: 700, fontSize: 58, marginTop: 18, color: p.sub }}>{sig.tamil}</div>}
      </div>
      {sig.cta && <div style={{ fontSize: 50, fontWeight: 800, color: p.sub, marginTop: 10 }}>{sig.cta}</div>}
      {handle && (
        <div style={{ fontSize: 46, fontWeight: 800, padding: '16px 44px', borderRadius: 999, background: sig.style === 'clean' ? '#111' : accent, color: sig.style === 'gold' ? '#1a1205' : '#fff', ...(sig.style === 'gold' ? { background: '#f6d77a' } : {}) }}>
          {handle}
        </div>
      )}
      <div style={{ fontSize: 34, fontWeight: 700, opacity: 0.85, letterSpacing: 1 }}>❤ Like · 💬 Comment · 🔁 Share · 📌 Save</div>
    </div>
  );
}

/** Settings row in the Reel maker: checkbox, where, how long, and an editor for the card. */
export function SignatureSettings({ sig, set, handle, accent, trailer }: { sig: Signature; set: (p: Partial<Signature>) => void; handle: string; accent?: string; trailer: boolean }) {
  const [edit, setEdit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sel = 'rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs';
  const S = 0.2;
  const onPhoto = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      // keep it small enough to remember between visits
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        const k = Math.min(1, 480 / Math.max(img.width, img.height));
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        set({ photo: c.toDataURL('image/jpeg', 0.85) });
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(f);
  };
  return (
    <section className="space-y-2 rounded-lg border border-violet-900/60 bg-violet-950/20 p-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-300">
        <label className="flex items-center gap-1.5 font-semibold text-slate-100"><input type="checkbox" checked={sig.on} onChange={e => set({ on: e.target.checked })} /> <PenLine className="w-3.5 h-3.5 text-violet-300" /> My signature</label>
        <span className="text-slate-500">“{sig.text}” · {sig.cta}</span>
        {sig.on && (
          <>
            <select value={trailer ? (sig.at === 'start' || sig.at === 'second' ? 'start' : 'end') : sig.at} onChange={e => set({ at: e.target.value as Signature['at'] })} className={sel}>
              {trailer
                ? <><option value="start">At the start</option><option value="end">At the end</option></>
                : <><option value="start">At the start</option><option value="second">After the first slide</option><option value="beforeLast">Before the last slide</option><option value="end">At the very end</option></>}
            </select>
            <select value={sig.seconds} onChange={e => set({ seconds: Number(e.target.value) })} className={sel}>{[1.5, 2, 2.5, 3, 4].map(s => <option key={s} value={s}>{s} s</option>)}</select>
          </>
        )}
        <button onClick={() => setEdit(v => !v)} className="ml-auto rounded bg-slate-800 px-2 py-0.5 text-slate-200 hover:bg-slate-700">{edit ? 'Done' : 'Edit signature'}</button>
      </div>
      {edit && (
        <div className="flex gap-3">
          <div className="shrink-0 overflow-hidden rounded-md border border-slate-700" style={{ width: 1080 * S, height: 1350 * S }}>
            <div style={{ transform: `scale(${S})`, transformOrigin: 'top left' }}><SignatureCard sig={sig} handle={handle} accent={accent} /></div>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5 text-xs text-slate-300">
            <input value={sig.text} onChange={e => set({ text: e.target.value })} maxLength={32} placeholder="Your signature line" className={`${sel} w-full`} />
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={sig.showTamil} onChange={e => set({ showTamil: e.target.checked })} /> Tamil line</label>
            {sig.showTamil && <input value={sig.tamil} onChange={e => set({ tamil: e.target.value })} maxLength={40} className={`${sel} w-full`} />}
            <input value={sig.cta} onChange={e => set({ cta: e.target.value })} maxLength={40} placeholder="e.g. Follow for more 🎬" className={`${sel} w-full`} />
            <div className="flex flex-wrap items-center gap-1">
              {(['glow', 'gold', 'clean'] as const).map(s => (
                <button key={s} onClick={() => set({ style: s })} className={`rounded px-2 py-0.5 ${sig.style === s ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{s === 'glow' ? 'Neon glow' : s === 'gold' ? 'Gold' : 'Clean white'}</button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 hover:bg-slate-700"><Upload className="w-3 h-3" /> {sig.photo ? 'Change photo' : 'Add my photo'}</button>
              {sig.photo && <button onClick={() => set({ photo: null })} className="flex items-center gap-0.5 text-slate-500 hover:text-red-400"><X className="w-3 h-3" /> Remove</button>}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => onPhoto(e.target.files?.[0])} />
            </div>
            <p className="text-[11px] text-slate-500">Saved — every Reel on every desk can use it. Your handle comes from the Brand box.</p>
          </div>
        </div>
      )}
    </section>
  );
}
