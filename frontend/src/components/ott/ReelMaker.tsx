'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Clapperboard, Copy, Download, Film, Images, Loader2, Maximize2, Minimize2, Music, Pause, Play, Upload, X } from 'lucide-react';
import { toJpeg, toPng } from 'html-to-image';
import { SignatureCard, SignatureSettings, signatureIndex, useSignature } from './ReelSignature';
import { Clip, TrailerClipEditor } from './TrailerClipEditor';
import type { TrailerTitle } from './YouTubeMarker';
import { API_BASE, apiFetch } from '@/lib/api';
import { VideoPublish } from './SocialPublish';
import { ReelResult as ReelResultT, VoiceCamStudio } from './VoiceCamStudio';

interface Track { id: string; title: string; mood: string; credit: string }
type MusicMode = 'none' | 'library' | 'file';

const TRANSITIONS = [
  { id: 'mixed', label: '✨ Mixed (a different one each time)' },
  { id: 'fade', label: 'Crossfade' },
  { id: 'fadeblack', label: 'Dip to black' },
  { id: 'fadewhite', label: 'Flash (dip to white)' },
  { id: 'dissolve', label: 'Dissolve' },
  { id: 'slideleft', label: 'Slide left' },
  { id: 'slideup', label: 'Slide up' },
  { id: 'smoothleft', label: 'Smooth slide' },
  { id: 'smoothup', label: 'Smooth slide up' },
  { id: 'wipeleft', label: 'Wipe' },
  { id: 'wipeup', label: 'Wipe up' },
  { id: 'circleopen', label: 'Circle reveal' },
  { id: 'circleclose', label: 'Circle close' },
  { id: 'radial', label: 'Clock wipe' },
  { id: 'zoomin', label: 'Zoom in' },
  { id: 'pixelize', label: 'Pixelate' },
  { id: 'hblur', label: 'Blur swipe' },
  { id: 'squeezeh', label: 'Squeeze' },
  { id: 'diagtl', label: 'Diagonal' },
  { id: 'horzopen', label: 'Doors open' },
  { id: 'vertopen', label: 'Split open' },
  { id: 'none', label: 'Cut (no transition)' },
];
const EFFECTS = [
  { id: 'none', label: 'No effect' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'punchy', label: 'Punchy colours' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'vintage', label: 'Vintage film' },
  { id: 'grain', label: 'Film grain' },
  { id: 'vignette', label: 'Vignette' },
  { id: 'bw', label: 'Black & white' },
];
const MOTIONS = [
  { id: 'in', label: 'Zoom in' },
  { id: 'out', label: 'Zoom out' },
  { id: 'alt', label: 'In / out (alternate)' },
  { id: 'pan', label: 'Slow pan' },
];

/**
 * Turns the post (one picture or every carousel slide) into an Instagram Reel: 1080×1920 MP4 with
 * transitions, slow zoom and optional music (your file, or free CC-BY tracks with the credit added to the caption).
 */
export function ReelMaker({ renderImages, caption, slug, slideCount, onClose, title, kind, releaseId, handle, accent, trailerTitles }: {
  renderImages: () => Promise<Blob[]>;
  caption: string;
  slug: string;
  slideCount: number;
  onClose: () => void;
  /** default YouTube title */
  title: string;
  kind: string;
  releaseId?: string;
  handle?: string;
  accent?: string;
  /** titles whose official trailer can be watched (YouTube player) to mark clip times */
  trailerTitles?: TrailerTitle[];
}) {
  const single = slideCount <= 1;
  // From the post's pictures, or cut from a trailer file
  const [source, setSource] = useState<'post' | 'trailer'>('post');
  const [trailer, setTrailer] = useState<File | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [framing, setFraming] = useState<'fit' | 'fill'>('fit');
  const [sound, setSound] = useState<'trailer' | 'music' | 'mix' | 'none'>('trailer');
  const [trailerVolume, setTrailerVolume] = useState(1);
  const [overlay, setOverlay] = useState(true);
  const [label, setLabel] = useState('Official trailer');
  const [intro, setIntro] = useState(false);
  const [outro, setOutro] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [seconds, setSeconds] = useState(single ? 7 : 3);
  const [transition, setTransition] = useState('fade');
  const [motion, setMotion] = useState(true);
  const [motionStyle, setMotionStyle] = useState('in');
  const [effect, setEffect] = useState('none');
  const [sig, setSig] = useSignature();
  const sigRef = useRef<HTMLDivElement>(null);
  const renderSignature = async () => {
    if (!sig.on || !sigRef.current) return null;
    const url = await toJpeg(sigRef.current, { width: 1080, height: 1350, pixelRatio: 1, quality: 0.95 });
    return (await fetch(url)).blob();
  };
  const [mode, setMode] = useState<MusicMode>('library');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackId, setTrackId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [start, setStart] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [fadeOut, setFadeOut] = useState(1.5);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  /** tucked away: the page is usable again; the Reel keeps making in the background */
  const [mini, setMini] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; url: string; mb: number; seconds: string; credit: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    apiFetch('/reels/tracks').then(r => r.json()).then((t: Track[]) => { setTracks(t); setTrackId(id => id || t[0]?.id || ''); }, () => setErr('Backend not reachable — start it and reopen.'));
  }, []);
  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);
  /** the Reel without your voice, kept while a voiced version exists (switch back / re-record on the clean one) */
  const [plain, setPlain] = useState<ReelResultT | null>(null);
  const [voiced, setVoiced] = useState<ReelResultT | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => { if (result && !urls.current.includes(result.url)) urls.current.push(result.url); }, [result]);
  useEffect(() => () => { urls.current.forEach(u => URL.revokeObjectURL(u)); }, []);

  const previewSrc = mode === 'file' ? fileUrl : mode === 'library' && trackId ? `${API_BASE}/reels/tracks/${trackId}/audio` : null;
  const togglePlay = () => {
    const a = audioRef.current;
    if (!a || !previewSrc) return;
    if (playing) { a.pause(); setPlaying(false); return; }
    a.currentTime = start;
    a.volume = Math.min(1, volume);
    a.play().then(() => setPlaying(true), () => setErr('Couldn’t play this track.'));
  };
  const clipSeconds = clips.reduce((a, c) => a + (c.end - c.start), 0);
  const sigExtra = sig.on ? (source === 'trailer' ? sig.seconds : sig.seconds - (transition === 'none' ? 0 : 0.6)) : 0;
  const total = (source === 'trailer'
    ? clipSeconds + (intro ? 2.5 : 0) + (outro ? 3 : 0)
    : single ? seconds : slideCount * seconds - (transition === 'none' ? 0 : 0.6 * (slideCount - 1))) + sigExtra;
  const usesMusic = source === 'post' ? mode !== 'none' : sound === 'music' || sound === 'mix';
  const track = tracks.find(t => t.id === trackId);
  const credit = result?.credit || '';
  const finalCaption = credit ? `${caption}\n\n🎵 ${credit}` : caption;

  const makeTrailer = async () => {
    if (!trailer || !clips.length) return;
    setBusy('Preparing…');
    const fd = new FormData();
    fd.append('video', trailer, trailer.name);
    if (overlay && overlayRef.current) {
      const png = await toPng(overlayRef.current, { width: 1080, height: 1920, pixelRatio: 1, backgroundColor: 'transparent' });
      fd.append('overlay', await (await fetch(png)).blob(), 'overlay.png');
    }
    if (intro || outro) {
      const pics = await renderImages();
      if (intro && pics[0]) fd.append('intro', pics[0], 'intro.jpg');
      if (outro && pics.length) fd.append('outro', pics[pics.length - 1], 'outro.jpg');
    }
    if ((sound === 'music' || sound === 'mix') && mode === 'file' && file) fd.append('audio', file, file.name);
    const sigBlob = await renderSignature();
    if (sigBlob) fd.append('signature', sigBlob, 'signature.jpg');
    fd.append('options', JSON.stringify({
      clips, framing, audio: sound, trailerVolume, trackId: (sound === 'music' || sound === 'mix') && mode === 'library' ? trackId : undefined,
      audioStart: start, volume: sound === 'mix' ? Math.min(volume, 0.6) : volume, fadeOut, introSeconds: 2.5, outroSeconds: 3,
      signatureSeconds: sig.seconds, signatureAt: sig.at === 'start' || sig.at === 'second' ? 'start' : 'end', effect,
    }));
    setBusy(`Uploading the trailer and cutting ${clips.length} clip(s)… (≈ ${Math.max(15, Math.round(total * 2))} s)`);
    return apiFetch('/reels/trailer', { method: 'POST', body: fd }, 0);
  };

  const make = async () => {
    if (source === 'trailer') {
      setErr(null);
      setResult(null); setPlain(null); setVoiced(null);
      audioRef.current?.pause();
      setPlaying(false);
      try {
        const res = await makeTrailer();
        if (!res) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { message?: string }).message || `Failed (${res.status})`);
        }
        const blob = await res.blob();
        setResult({ blob, url: URL.createObjectURL(blob), mb: blob.size / 1e6, seconds: res.headers.get('X-Reel-Seconds') || total.toFixed(1), credit: decodeURIComponent(res.headers.get('X-Reel-Credit') || '') });
      } catch (e) {
        setErr((e as Error).message === 'Failed to fetch' ? 'Backend not reachable.' : (e as Error).message);
      } finally {
        setBusy(null);
      }
      return;
    }
    setErr(null);
    setResult(null); setPlain(null); setVoiced(null);
    audioRef.current?.pause();
    setPlaying(false);
    try {
      setBusy('Preparing pictures…');
      const blobs = await renderImages();
      if (!blobs.length) throw new Error('No slides to use.');
      const durations = blobs.map(() => seconds);
      const sigBlob = await renderSignature();
      if (sigBlob) {
        const at = signatureIndex(sig.at, blobs.length);
        blobs.splice(at, 0, sigBlob);
        durations.splice(at, 0, sig.seconds);
      }
      const fd = new FormData();
      blobs.forEach((b, i) => fd.append('slides', b, `slide-${i + 1}.jpg`));
      if (mode === 'file' && file) fd.append('audio', file, file.name);
      fd.append('options', JSON.stringify({ seconds, durations, transition, motion, motionStyle, effect, trackId: mode === 'library' ? trackId : undefined, audioStart: start, volume, fadeOut }));
      setBusy(`Making the Reel (${Math.round(total)} s video — about ${Math.max(10, Math.round(blobs.length * 4))} s)…`);
      const res = await apiFetch('/reels/render', { method: 'POST', body: fd }, 0);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || `Failed (${res.status})`);
      }
      const blob = await res.blob();
      setResult({ blob, url: URL.createObjectURL(blob), mb: blob.size / 1e6, seconds: res.headers.get('X-Reel-Seconds') || String(total), credit: decodeURIComponent(res.headers.get('X-Reel-Credit') || '') });
    } catch (e) {
      setErr((e as Error).message === 'Failed to fetch' ? 'Backend not reachable.' : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const sel = 'rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs';
  const moods = [...new Set(tracks.map(t => t.mood))];
  // Closing throws the Reel away — so only the ✕ closes it (with a check), never a stray click outside.
  const close = () => {
    if ((busy || result) && !window.confirm(busy ? 'The Reel is still being made. Close and stop?' : 'Close the Reel maker? Download it first if you want to keep this Reel.')) return;
    onClose();
  };
  // Its own frame on top of everything (not inside the page, so the page's header can't cover it).
  return createPortal(
    <div className={`fixed inset-0 z-[90] flex items-center justify-center p-2 sm:p-4 ${mini ? 'pointer-events-none' : 'bg-black/80'}`}>
      {sig.on && (
        <div style={{ position: 'fixed', left: -30000, top: 0, pointerEvents: 'none' }} aria-hidden>
          <div ref={sigRef}><SignatureCard sig={sig} handle={handle || ''} accent={accent} /></div>
        </div>
      )}
      {mini && (
        <div className="pointer-events-auto fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-pink-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 shadow-2xl">
          {busy ? <Loader2 className="w-4 h-4 animate-spin text-pink-400" /> : <Clapperboard className="w-4 h-4 text-pink-400" />}
          <span>{busy ? `Reel: ${busy}` : result ? 'Reel ready' : 'Reel maker'}</span>
          <button onClick={() => setMini(false)} className="flex items-center gap-1 rounded-full bg-pink-600 hover:bg-pink-700 px-2.5 py-1 font-semibold text-white"><Maximize2 className="w-3 h-3" /> Open</button>
          <button onClick={close} title="Close" className="p-0.5 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}
      {source === 'trailer' && overlay && (
        <div style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }} aria-hidden>
          <div ref={overlayRef} style={{ width: 1080, height: 1920, position: 'relative', background: 'transparent', fontFamily: 'var(--font-geist-sans), "Segoe UI", sans-serif', color: '#fff' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '150px 70px 90px', textAlign: 'center', background: 'linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0) 100%)' }}>
              {label && <div style={{ display: 'inline-block', background: accent || '#FACC15', color: '#000', fontWeight: 900, fontSize: 34, padding: '8px 22px', borderRadius: 10, letterSpacing: 2, textTransform: 'uppercase' }}>{label}</div>}
              <div style={{ fontSize: title.length > 28 ? 64 : 84, fontWeight: 900, lineHeight: 1.05, marginTop: 22, textShadow: '0 4px 18px rgba(0,0,0,0.7)' }}>{title}</div>
            </div>
            {handle && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 260, textAlign: 'center', fontSize: 40, fontWeight: 800, textShadow: '0 3px 12px rgba(0,0,0,0.8)' }}>{handle}</div>}
          </div>
        </div>
      )}
      <div className={`flex h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl ${mini ? 'hidden' : ''}`}>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-5 py-3">
          <h3 className="font-bold flex items-center gap-2"><Clapperboard className="w-5 h-5 text-pink-400" /> Make a Reel <span className="text-xs font-normal text-slate-400">{source === 'trailer' ? `${clips.length} trailer clip(s)` : single ? '1 picture' : `${slideCount} slides`} → 1080×1920 MP4</span></h3>
          <div className="flex items-center gap-1">
            <button onClick={() => setMini(true)} title="Tuck it away and keep working — the Reel keeps making" className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"><Minimize2 className="w-4 h-4" /> Minimise</button>
            <button onClick={close} title="Close" className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
        <div className="grid md:grid-cols-[1fr_280px] gap-5">
          <div className="space-y-4 text-xs text-slate-300">
            <div className="flex gap-1">
              {([['post', Images, single ? 'From the post' : 'From the slides'], ['trailer', Film, 'From a trailer']] as const).map(([k, Icon, l]) => (
                <button key={k} onClick={() => { setSource(k); setResult(null); setPlain(null); setVoiced(null); }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold ${source === k ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}><Icon className="w-3.5 h-3.5" /> {l}</button>
              ))}
            </div>

            {source === 'trailer' && (
              <section className="space-y-3">
                <TrailerClipEditor file={trailer} onFile={setTrailer} clips={clips} onClips={setClips} titles={trailerTitles} />
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5">Framing
                    <select value={framing} onChange={e => setFraming(e.target.value as 'fit' | 'fill')} className={sel}>
                      <option value="fit">Whole frame (blurred top & bottom)</option>
                      <option value="fill">Fill the screen (crops the sides)</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5">Effect
                    <select value={effect} onChange={e => setEffect(e.target.value)} className={sel}>{EFFECTS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
                  </label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={overlay} onChange={e => setOverlay(e.target.checked)} /> Title &amp; handle on top</label>
                  {overlay && <input value={label} onChange={e => setLabel(e.target.value)} maxLength={30} placeholder="Label (e.g. Official trailer)" className={`${sel} w-40`} />}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={intro} onChange={e => setIntro(e.target.checked)} /> Start with the post picture (2.5 s)</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={outro} onChange={e => setOutro(e.target.checked)} /> End with the post picture (3 s)</label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-200">Sound</span>
                  {([['trailer', 'Trailer sound'], ['mix', 'Trailer + music'], ['music', 'Music only'], ['none', 'Silent']] as const).map(([k, l]) => (
                    <button key={k} onClick={() => { setSound(k); if ((k === 'music' || k === 'mix') && mode === 'none') setMode('library'); }}
                      className={`rounded-md px-2.5 py-1 ${sound === k ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{l}</button>
                  ))}
                  {(sound === 'trailer' || sound === 'mix') && (
                    <label className="flex items-center gap-1.5">Trailer volume <input type="range" min={0.1} max={1.5} step={0.05} value={trailerVolume} onChange={e => setTrailerVolume(Number(e.target.value))} /> {Math.round(trailerVolume * 100)}%</label>
                  )}
                  <span className="text-slate-500">≈ {total.toFixed(1)} s{total > 90 ? ' — over 90 s, remove clips' : ''}</span>
                </div>
                <p className="text-[11px] text-amber-300/90">Trailers belong to the studio. Short clips used to promote the film are common, but Instagram / YouTube may still mute or claim a Reel. Credit the film and studio in the caption.</p>
              </section>
            )}

            {source === 'post' && (
            <section className="space-y-2">
              <div className="font-semibold text-slate-200">Video</div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5">{single ? 'Length' : 'Each slide'}
                  <select value={seconds} onChange={e => setSeconds(Number(e.target.value))} className={sel}>
                    {(single ? [5, 7, 10, 12, 15] : [2, 2.5, 3, 4, 5, 6]).map(v => <option key={v} value={v}>{v} s</option>)}
                  </select>
                </label>
                {!single && (
                  <label className="flex items-center gap-1.5">Transition
                    <select value={transition} onChange={e => setTransition(e.target.value)} className={sel}>{TRANSITIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
                  </label>
                )}
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={motion} onChange={e => setMotion(e.target.checked)} /> Movement</label>
                {motion && <select value={motionStyle} onChange={e => setMotionStyle(e.target.value)} className={sel}>{MOTIONS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select>}
                <label className="flex items-center gap-1.5">Effect
                  <select value={effect} onChange={e => setEffect(e.target.value)} className={sel}>{EFFECTS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
                </label>
                <span className="text-slate-500">≈ {total.toFixed(1)} s total{total > 90 ? ' — over Instagram’s 90 s, use fewer slides' : ''}</span>
              </div>
            </section>
            )}

            <SignatureSettings sig={sig} set={setSig} handle={handle || ''} accent={accent} trailer={source === 'trailer'} />

            {(source === 'post' || usesMusic) && (
            <section className="space-y-2">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5"><Music className="w-3.5 h-3.5" /> Music</div>
              <div className="flex gap-1">
                {([['none', 'No music'], ['library', 'Free library'], ['file', 'My music file']] as const).filter(([k]) => source === 'post' || k !== 'none').map(([k, l]) => (
                  <button key={k} onClick={() => { setMode(k); audioRef.current?.pause(); setPlaying(false); }}
                    className={`rounded-md px-3 py-1.5 ${mode === k ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{l}</button>
                ))}
              </div>
              {mode === 'library' && (
                <div className="space-y-1.5">
                  <select value={trackId} onChange={e => { setTrackId(e.target.value); audioRef.current?.pause(); setPlaying(false); }} className={`${sel} w-full`}>
                    {moods.map(m => <optgroup key={m} label={m}>{tracks.filter(t => t.mood === m).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</optgroup>)}
                  </select>
                  <p className="text-[11px] text-slate-500">Royalty-free tracks by Kevin MacLeod (CC BY 4.0) — free to use; the required credit is added to your caption automatically.{track ? ` Mood: ${track.mood}.` : ''}</p>
                </div>
              )}
              {mode === 'file' && (
                <label className="flex items-center gap-2 rounded-md border border-dashed border-slate-700 px-3 py-2 cursor-pointer hover:border-slate-500">
                  <Upload className="w-4 h-4" /> {file ? file.name : 'Choose an MP3 / M4A / WAV you have the rights to use'}
                  <input type="file" accept="audio/*" className="hidden" onChange={e => { setFile(e.target.files?.[0] || null); setPlaying(false); }} />
                </label>
              )}
              {mode !== 'none' && (
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={togglePlay} disabled={!previewSrc} className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-2.5 py-1.5">
                    {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />} {playing ? 'Stop' : 'Listen'}
                  </button>
                  <label className="flex items-center gap-1.5">Start at
                    <input type="number" min={0} max={600} step={1} value={start} onChange={e => setStart(Math.max(0, Number(e.target.value) || 0))} className={`${sel} w-16`} /> s
                  </label>
                  <label className="flex items-center gap-1.5">Volume
                    <input type="range" min={0.1} max={1.5} step={0.05} value={volume} onChange={e => setVolume(Number(e.target.value))} /> {Math.round(volume * 100)}%
                  </label>
                  <label className="flex items-center gap-1.5">Fade out
                    <select value={fadeOut} onChange={e => setFadeOut(Number(e.target.value))} className={sel}>{[0, 1, 1.5, 2, 3].map(v => <option key={v} value={v}>{v ? `${v} s` : 'none'}</option>)}</select>
                  </label>
                  {previewSrc && <audio ref={audioRef} src={previewSrc} onEnded={() => setPlaying(false)} preload="none" />}
                </div>
              )}
              <p className="text-[11px] text-amber-300/90">Film songs / trending audio: make the Reel with no music (or quiet music) and add the song inside the Instagram app — music added there is licensed, while film songs baked into the video usually get the Reel muted or blocked.</p>
            </section>
            )}

            <div className="flex items-center gap-2">
              <button onClick={make} disabled={!!busy || (usesMusic && mode === 'file' && !file) || total > 90 || (source === 'trailer' && (!trailer || !clips.length))}
                className="flex items-center gap-2 rounded-lg bg-pink-600 hover:bg-pink-700 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clapperboard className="w-4 h-4" />} {result ? 'Make again' : 'Make Reel'}
              </button>
              {busy && <span className="text-slate-400">{busy}</span>}
            </div>
            {err && <p className="text-amber-400">{err}</p>}

            {!result && (
              <div className="rounded-lg border border-fuchsia-900/60 bg-fuchsia-950/20 p-2.5 text-[11px] text-fuchsia-200">
                🎙 <b>Voice-over &amp; webcam:</b> make the Reel first — then <b>“Add your voice &amp; face”</b> appears right here. You watch the Reel play
                and record your voice over it (your face in a corner is optional); the music is lowered under your voice automatically.
                Tip: pick <b>No music</b> or quiet music if you’ll talk throughout.
              </div>
            )}

            {result && (
              <VoiceCamStudio base={plain ?? result} onDone={v => { setPlain(p => p ?? result); setVoiced(v); setResult(v); }} />
            )}
            {plain && voiced && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Use:</span>
                <button onClick={() => setResult(voiced)} className={`rounded-md px-2.5 py-1 ${result === voiced ? 'bg-fuchsia-600 text-white' : 'bg-slate-800 text-slate-300'}`}>With my voice</button>
                <button onClick={() => setResult(plain)} className={`rounded-md px-2.5 py-1 ${result === plain ? 'bg-fuchsia-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Without</button>
              </div>
            )}
            {result && (
              <section className="space-y-2">
                <div className="font-semibold text-slate-200">Caption {credit && <span className="font-normal text-slate-500">(music credit added)</span>}</div>
                <textarea readOnly value={finalCaption} rows={6} className="w-full rounded-md bg-slate-950 border border-slate-700 p-2 font-mono text-[11px]" />
                <button onClick={async () => { await navigator.clipboard.writeText(finalCaption); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 font-semibold text-white">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy caption'}
                </button>
              </section>
            )}
          </div>

          <div className="space-y-2">
            <div className="aspect-[9/16] w-full rounded-lg overflow-hidden border border-slate-800 bg-black flex items-center justify-center">
              {result ? <video src={result.url} controls autoPlay playsInline className="w-full h-full" /> : <span className="text-xs text-slate-600 px-6 text-center">{busy ? 'Working…' : 'Your Reel preview appears here — then you can add your voice-over'}</span>}
            </div>
            {result && (
              <a href={result.url} download={`${slug}-reel.mp4`} className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-semibold text-white">
                <Download className="w-4 h-4" /> Download MP4 ({result.mb.toFixed(1)} MB · {result.seconds} s)
              </a>
            )}
            {result && <VideoPublish key={result.url} video={result.blob} caption={finalCaption} defaultTitle={title} kind={kind} releaseId={releaseId} />}
          </div>
        </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
