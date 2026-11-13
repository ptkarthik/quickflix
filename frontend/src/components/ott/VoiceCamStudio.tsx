'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Headphones, Loader2, Mic, Play, RotateCcw, Square, Wand2, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type Shape = 'circle' | 'box';
type Pos = 'tr' | 'tl' | 'br' | 'bl' | 'bc';
export interface ReelResult { blob: Blob; url: string; mb: number; seconds: string; credit: string }

// Same placement maths as the backend (1080×1920 Reel): keeps the webcam clear of Instagram's top bar & caption area.
const RW = 1080, RH = 1920, MX = 48, TOP = 170, BOTTOM = 330;
function pipBox(shape: Shape, pos: Pos, size: number) {
  const w = size;
  const h = shape === 'circle' ? w : Math.round((w * 4) / 3);
  const x = pos === 'bl' || pos === 'tl' ? MX : pos === 'bc' ? Math.round((RW - w) / 2) : RW - MX - w;
  const y = pos === 'tr' || pos === 'tl' ? TOP : RH - BOTTOM - h;
  return { w, h, x, y };
}
const POS_LABEL: Record<Pos, string> = { tr: 'Top right', tl: 'Top left', br: 'Bottom right', bl: 'Bottom left', bc: 'Bottom centre' };

/**
 * Record your voice (and webcam) while the finished Reel plays — exactly the preview you see — then the backend lays it
 * over the Reel: optional talk-to-camera intro, webcam bubble, voice cleaned up, music ducked under your voice.
 */
export function VoiceCamStudio({ base, onDone }: { base: ReelResult; onDone: (r: ReelResult) => void }) {
  const [cam, setCam] = useState(true);
  const [shape, setShape] = useState<Shape>('circle');
  const [pos, setPos] = useState<Pos>('tr');
  const [size, setSize] = useState(340);
  const [intro, setIntro] = useState(3);
  const [mirror, setMirror] = useState(true);
  const [playSound, setPlaySound] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(1);
  const [bgVolume, setBgVolume] = useState(0.5);
  const [phase, setPhase] = useState<'idle' | 'ready' | 'countdown' | 'intro' | 'reel'>('idle');
  const [count, setCount] = useState(0);
  const [rec, setRec] = useState<{ blob: Blob; url: string; split: number; hasCam: boolean; seconds: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [liveCam, setLiveCam] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tRec = useRef(0);
  const tPlay = useRef<number | null>(null);
  const camEl = useRef<HTMLVideoElement | null>(null);
  const reelEl = useRef<HTMLVideoElement | null>(null);
  const timers = useRef<number[]>([]);
  const discard = useRef(false);

  const stopTracks = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; };
  const clearTimers = () => { timers.current.forEach(t => clearTimeout(t)); timers.current = []; };
  useEffect(() => () => { clearTimers(); stopTracks(); }, []);
  useEffect(() => () => { if (rec) URL.revokeObjectURL(rec.url); }, [rec]);

  const attachCam = (el: HTMLVideoElement | null) => {
    camEl.current = el;
    if (el && stream.current && el.srcObject !== stream.current) {
      el.srcObject = stream.current;
      el.play().catch(() => null);
    }
  };

  const open = async () => {
    setErr(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: cam ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      setLiveCam(stream.current.getVideoTracks().length > 0);
      setPhase('ready');
    } catch (e) {
      setErr((e as Error).name === 'NotAllowedError' ? 'The browser blocked the microphone / camera — allow it (the icon in the address bar) and try again.' : `Couldn’t start the ${cam ? 'camera / microphone' : 'microphone'}: ${(e as Error).message}`);
    }
  };
  const close = () => { clearTimers(); if (recorder.current?.state === 'recording') recorder.current.stop(); stopTracks(); setPhase('idle'); };

  const finish = () => { if (recorder.current?.state === 'recording') recorder.current.stop(); };

  const start = () => {
    if (!stream.current) return;
    setCount(3);
    setPhase('countdown');
    const tick = (n: number) => {
      if (n === 0) return begin();
      setCount(n);
      timers.current.push(window.setTimeout(() => tick(n - 1), 1000));
    };
    tick(3);
  };

  const begin = () => {
    const s = stream.current!;
    const hasCam = s.getVideoTracks().length > 0;
    const mime = (hasCam ? ['video/webm;codecs=vp8,opus', 'video/webm'] : ['audio/webm;codecs=opus', 'audio/webm']).find(m => MediaRecorder.isTypeSupported(m)) || '';
    chunks.current = [];
    tPlay.current = null;
    const r = new MediaRecorder(s, mime ? { mimeType: mime, videoBitsPerSecond: 2_500_000 } : undefined);
    recorder.current = r;
    r.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
    r.onstart = () => {
      tRec.current = performance.now();
      if (intro > 0) {
        setPhase('intro');
        setCount(intro);
        for (let i = 1; i <= intro; i++) timers.current.push(window.setTimeout(() => setCount(intro - i), i * 1000));
        timers.current.push(window.setTimeout(playReel, intro * 1000));
      } else playReel();
    };
    r.onstop = () => {
      clearTimers();
      if (discard.current) { discard.current = false; reelEl.current?.pause(); stopTracks(); setPhase('idle'); return; }
      const blob = new Blob(chunks.current, { type: mime || 'video/webm' });
      const split = Math.max(0, ((tPlay.current ?? tRec.current) - tRec.current) / 1000);
      setRec(prev => { if (prev) URL.revokeObjectURL(prev.url); return { blob, url: URL.createObjectURL(blob), split, hasCam, seconds: (performance.now() - tRec.current) / 1000 }; });
      reelEl.current?.pause();
      stopTracks();
      setPhase('idle');
    };
    r.start(500);
  };

  const playReel = () => {
    setPhase('reel');
    const v = reelEl.current;
    if (!v) return;
    v.currentTime = 0;
    v.onplaying = () => { if (tPlay.current == null) tPlay.current = performance.now(); };
    v.onended = () => timers.current.push(window.setTimeout(finish, 250));
    v.play().catch(() => setErr('The Reel couldn’t play — click Stop and try again.'));
  };

  const make = async () => {
    if (!rec) return;
    setBusy('Adding your voice' + (rec.hasCam ? ' and webcam' : '') + ' to the Reel…');
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('reel', base.blob, 'reel.mp4');
      fd.append('rec', rec.blob, rec.blob.type.includes('audio') ? 'rec.webm' : 'rec.webm');
      fd.append('options', JSON.stringify({ split: rec.split, intro: intro > 0, pip: rec.hasCam, shape, pos, size, mirror, voiceVolume, bgVolume }));
      const res = await apiFetch('/reels/voiceover', { method: 'POST', body: fd }, 0);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `Failed (${res.status})`);
      const blob = await res.blob();
      onDone({ blob, url: URL.createObjectURL(blob), mb: blob.size / 1e6, seconds: res.headers.get('X-Reel-Seconds') || '', credit: base.credit });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const sel = 'rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-xs';
  const live = phase !== 'idle';
  const b = pipBox(shape, pos, size);
  const STAGE_H = typeof window !== 'undefined' ? Math.min(window.innerHeight - 140, 760) : 700;
  const k = STAGE_H / RH;

  return (
    <section className="space-y-2 rounded-lg border border-fuchsia-900/60 bg-fuchsia-950/20 p-3">
      <div className="flex items-center gap-2 font-semibold text-slate-100"><Mic className="w-4 h-4 text-fuchsia-400" /> Add your voice &amp; face</div>
      <p className="text-[11px] text-slate-400">The Reel plays while you talk — your timing matches what you see. Your own voice / face makes the post original (Instagram recommends original content far more).</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-300">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={cam} onChange={e => { setCam(e.target.checked); if (!e.target.checked) setIntro(0); }} /> <Camera className="w-3.5 h-3.5" /> Webcam</label>
        <label className="flex items-center gap-1.5">Talk-to-camera intro
          <select value={intro} onChange={e => setIntro(Number(e.target.value))} className={sel}>
            <option value={0}>None</option>{[3, 5, 8].map(s => <option key={s} value={s}>{s} s{cam ? '' : ' (voice only)'}</option>)}
          </select>
        </label>
        {cam && (
          <>
            <select value={shape} onChange={e => setShape(e.target.value as Shape)} className={sel}><option value="circle">Circle</option><option value="box">Box</option></select>
            <select value={pos} onChange={e => setPos(e.target.value as Pos)} className={sel}>{(Object.keys(POS_LABEL) as Pos[]).map(p => <option key={p} value={p}>{POS_LABEL[p]}</option>)}</select>
            <label className="flex items-center gap-1.5">Size <input type="range" min={220} max={520} step={20} value={size} onChange={e => setSize(Number(e.target.value))} /></label>
            <label className="flex items-center gap-1.5" title="Like a selfie camera"><input type="checkbox" checked={mirror} onChange={e => setMirror(e.target.checked)} /> Mirror</label>
          </>
        )}
        <label className="flex items-center gap-1.5" title="Use headphones, or the speaker sound gets into your mic"><input type="checkbox" checked={playSound} onChange={e => setPlaySound(e.target.checked)} /> <Headphones className="w-3.5 h-3.5" /> Hear the Reel while recording</label>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button onClick={open} disabled={live || !!busy} className="flex items-center gap-1.5 rounded-md bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 px-3 py-1.5 font-semibold text-white">
          <Mic className="w-3.5 h-3.5" /> {rec ? 'Record again' : 'Record'}
        </button>
        {rec && !busy && (
          <>
            <span className="text-emerald-300">Recorded {rec.seconds.toFixed(1)} s{rec.hasCam ? ' with webcam' : ''}</span>
            <audio src={rec.url} controls className="h-7" />
          </>
        )}
      </div>
      {rec && (
        <div className="space-y-2 rounded-md border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-300">
          <label className="flex items-center gap-2">Your voice <input type="range" min={0.4} max={2} step={0.1} value={voiceVolume} onChange={e => setVoiceVolume(Number(e.target.value))} /> {Math.round(voiceVolume * 100)}%</label>
          <label className="flex items-center gap-2">Music / trailer sound <input type="range" min={0} max={1.2} step={0.05} value={bgVolume} onChange={e => setBgVolume(Number(e.target.value))} /> {Math.round(bgVolume * 100)}% <span className="text-slate-500">(also dips automatically when you talk)</span></label>
          <button onClick={make} disabled={!!busy} className="flex items-center gap-1.5 rounded-md bg-pink-600 hover:bg-pink-700 disabled:opacity-50 px-3 py-1.5 font-semibold text-white">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} {busy || 'Make Reel with my voice'}
          </button>
        </div>
      )}
      {err && <p className="text-xs text-amber-400">{err}</p>}

      {live && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-black/90 p-4">
          <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-black" style={{ width: (RW * STAGE_H) / RH, height: STAGE_H }}>
            <video ref={reelEl} src={base.url} muted={!playSound} playsInline className="absolute inset-0 h-full w-full object-cover" />
            {liveCam ? (
              <video ref={attachCam} muted playsInline autoPlay
                className={`absolute object-cover ${shape === 'circle' && phase !== 'intro' ? 'rounded-full' : ''} ${phase === 'intro' ? '' : 'border-4 border-white/90'}`}
                style={phase === 'intro' || (phase !== 'reel' && intro > 0)
                  ? { inset: 0, width: '100%', height: '100%', transform: mirror ? 'scaleX(-1)' : undefined }
                  : { left: b.x * k, top: b.y * k, width: b.w * k, height: b.h * k, transform: mirror ? 'scaleX(-1)' : undefined }} />
            ) : null}
            {phase === 'ready' && <div className="absolute inset-x-0 bottom-6 text-center text-sm text-white/90">{intro > 0 ? `First ${intro} s: talk to the camera. Then the Reel plays — keep talking.` : 'The Reel will play — talk over it.'}</div>}
            {phase === 'countdown' && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-8xl font-black text-white">{count}</div>}
            {phase === 'intro' && <div className="absolute left-4 top-4 rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">● INTRO {count}s</div>}
            {phase === 'reel' && <div className="absolute left-4 top-4 rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">● REC</div>}
          </div>
          <div className="flex items-center gap-2">
            {phase === 'ready' && <button onClick={start} className="flex items-center gap-1.5 rounded-full bg-red-600 hover:bg-red-700 px-5 py-2 font-semibold text-white"><Play className="w-4 h-4" /> Start recording</button>}
            {(phase === 'intro' || phase === 'reel') && <button onClick={finish} className="flex items-center gap-1.5 rounded-full bg-slate-200 px-5 py-2 font-semibold text-slate-900"><Square className="w-4 h-4" /> Stop</button>}
            {phase !== 'reel' && phase !== 'intro' && <button onClick={close} className="flex items-center gap-1.5 rounded-full bg-slate-800 px-4 py-2 text-slate-200"><X className="w-4 h-4" /> Cancel</button>}
            {(phase === 'intro' || phase === 'reel') && <button onClick={() => { discard.current = true; clearTimers(); close(); }} className="flex items-center gap-1.5 rounded-full bg-slate-800 px-4 py-2 text-slate-200"><RotateCcw className="w-4 h-4" /> Discard</button>}
          </div>
          {playSound && <p className="text-xs text-amber-300">Wear headphones — otherwise the Reel’s sound is recorded through your mic.</p>}
        </div>,
        document.body,
      )}
    </section>
  );
}
