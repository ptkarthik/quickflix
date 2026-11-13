'use client';
/* eslint-disable @next/next/no-img-element -- local blob previews */
import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Send, Settings2, X } from 'lucide-react';
import { InstagramPost, InstagramStatus, ottApi } from '@/lib/ott';

const SETUP_STEPS = [
  'Make your Instagram account a Professional account (Creator or Business): Instagram app → Settings → Account type and tools.',
  'Go to developers.facebook.com → My Apps → Create app → choose “Other” → type “Business”. Add the “Instagram” product and pick “API setup with Instagram login”.',
  'In “Generate access tokens”, click Add account, log in to your Instagram account, then Generate token. Copy the token and the Instagram user ID shown next to it.',
  'Get a free image-host key at api.imgbb.com (sign up → “Get API key”). Each post image is hosted there for 10 minutes so Instagram can fetch it, then auto-deleted.',
  'Add to backend/.env:\nIG_ACCESS_TOKEN=…\nIG_USER_ID=…\nIMGBB_API_KEY=…\nthen restart the app (start.bat). The token refreshes itself automatically.',
];

export function InstagramPublish({
  renderImages,
  caption,
  kind,
  releaseId,
  disabledReason,
}: {
  /** Renders the post's JPEG(s) at click time. */
  renderImages: () => Promise<Blob[]>;
  caption: string;
  kind: string;
  releaseId?: string;
  disabledReason?: string | null;
}) {
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [confirm, setConfirm] = useState<{ blobs: Blob[]; urls: string[]; requestId: string; earlier: InstagramPost[] } | null>(null);
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; link?: string | null } | null>(null);

  useEffect(() => {
    ottApi.instagramStatus().then(setStatus, (e: Error) => setStatus({ configured: false, missing: [], error: e.message }));
  }, []);

  const close = () => {
    confirm?.urls.forEach(u => URL.revokeObjectURL(u));
    setConfirm(null);
  };

  const prepare = async () => {
    setResult(null);
    setPreparing(true);
    try {
      const [blobs, earlier] = await Promise.all([renderImages(), releaseId ? ottApi.instagramPosts(releaseId).catch(() => []) : Promise.resolve([])]);
      // One id per confirmation: clicking "Post now" again (or a network retry) can never create a second post.
      setConfirm({ blobs, urls: blobs.map(b => URL.createObjectURL(b)), requestId: crypto.randomUUID(), earlier });
    } catch (e) {
      setResult({ ok: false, text: e instanceof Event || !(e as Error)?.message ? 'A picture couldn’t be loaded, so the post couldn’t be made. Pick another picture.' : (e as Error).message });
    } finally {
      setPreparing(false);
    }
  };

  const post = async () => {
    if (!confirm) return;
    setPosting(true);
    try {
      const res = await ottApi.instagramPublish(confirm.blobs, { caption, kind, releaseId, requestId: confirm.requestId });
      setResult({ ok: true, text: 'Posted to Instagram.', link: res.permalink });
      close();
      ottApi.instagramStatus().then(setStatus, () => null);
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    } finally {
      setPosting(false);
    }
  };

  const ready = status?.configured;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={ready ? prepare : () => setShowSetup(s => !s)}
          disabled={preparing || posting || (ready && !!disabledReason)}
          title={disabledReason || undefined}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${ready ? 'bg-gradient-to-r from-pink-600 to-orange-500 hover:brightness-110 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}>
          {preparing ? <Loader2 className="w-4 h-4 animate-spin" /> : ready ? <Send className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
          {preparing ? 'Preparing…' : ready ? 'Post to Instagram' : 'Set up 1-click Instagram posting'}
        </button>
        {status === null ? (
          <span className="text-xs text-slate-500">Checking Instagram…</span>
        ) : ready ? (
          <span className="text-xs text-slate-400">as <b className="text-slate-200">@{status.username}</b> · {status.postedLast24h ?? 0}/{status.dailyLimit ?? 100} posts in 24h</span>
        ) : status.error ? (
          <span className="text-xs text-amber-400">{status.error}</span>
        ) : (
          <span className="text-xs text-slate-500">Not set up yet{status.missing.length ? ` (missing ${status.missing.join(', ')})` : ''}</span>
        )}
      </div>
      {ready && disabledReason && <p className="text-xs text-amber-400">{disabledReason}</p>}

      {result && (
        <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${result.ok ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300' : 'border-red-800/60 bg-red-950/40 text-red-300'}`}>
          {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{result.text}</span>
          {result.link && <a href={result.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline">View post <ExternalLink className="w-3 h-3" /></a>}
        </div>
      )}

      {!ready && showSetup && (
        <div className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs text-slate-300 space-y-2">
          <div className="font-semibold text-slate-100">One-time setup (free, about 10 minutes)</div>
          <ol className="list-decimal pl-5 space-y-1.5">
            {SETUP_STEPS.map(s => <li key={s} className="whitespace-pre-wrap">{s}</li>)}
          </ol>
          <p className="text-slate-500">Personal Instagram accounts can’t be posted to by any app — Instagram only allows it for Creator/Business accounts (switching is free and reversible).</p>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !posting && close()}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Post to @{status?.username} now?</h3>
              <button onClick={close} disabled={posting} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            {confirm.earlier.length > 0 && (
              <p className="flex items-center gap-2 rounded-md bg-amber-950/50 border border-amber-800/60 px-3 py-2 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4" /> You already posted this title {confirm.earlier.length}× (last on {new Date(confirm.earlier[0].createdAt).toLocaleString('en-IN')}).
                {confirm.earlier[0].permalink && <a href={confirm.earlier[0].permalink} target="_blank" rel="noreferrer" className="underline">See it</a>}
              </p>
            )}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {confirm.urls.map((u, i) => <img key={u} src={u} alt={`slide ${i + 1}`} className="h-64 rounded-md border border-slate-700" />)}
            </div>
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-950 border border-slate-800 p-3 text-xs text-slate-300 font-sans">{caption}</pre>
            <p className="text-xs text-slate-500">
              {confirm.blobs.length === 1 ? '1 image' : `Carousel of ${confirm.blobs.length} images`} · goes live publicly right away. You can delete it later from the Instagram app.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={close} disabled={posting} className="rounded-md bg-slate-800 hover:bg-slate-700 px-4 py-2 text-sm">Cancel</button>
              <button onClick={post} disabled={posting}
                className="flex items-center gap-2 rounded-md bg-gradient-to-r from-pink-600 to-orange-500 hover:brightness-110 disabled:opacity-60 px-4 py-2 text-sm font-semibold">
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {posting ? 'Posting… (up to a minute)' : 'Post now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
