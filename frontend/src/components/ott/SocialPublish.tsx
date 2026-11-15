'use client';
import { Overlay } from './Overlay';
/* eslint-disable @next/next/no-img-element -- local blob previews */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Link2, Loader2, Send, Settings2, Unlink, X } from 'lucide-react';

/** Simple brand marks (this lucide version has no brand icons). */
const Facebook = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden><path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v9h4v-9H17l.5-4h-4V8.9c0-.6.3-.9.5-.9z" /></svg>
);
const Youtube = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .6 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .4-4.8 31 31 0 0 0-.4-4.8zM9.8 15.1V8.9l5.6 3.1-5.6 3.1z" /></svg>
);
import { FACEBOOK_SETUP, PublishStatus, SocialPost, YOUTUBE_SETUP, publishApi } from '@/lib/publish';
import { InstagramStatus, ottApi } from '@/lib/ott';

type Result = { ok: boolean; text: string; link?: string | null } | null;

function useStatus() {
  const [status, setStatus] = useState<PublishStatus | null>(null);
  const load = useCallback(() => publishApi.status().then(setStatus, (e: Error) => setStatus({ facebook: { configured: false, missing: [], error: e.message }, youtube: { configured: false, connected: false, missing: [], error: e.message } })), []);
  useEffect(() => {
    load();
    // after "Connect YouTube" in another tab
    const onMsg = (e: MessageEvent) => { if (e.data === 'youtube-connected') load(); };
    window.addEventListener('message', onMsg);
    window.addEventListener('focus', load);
    return () => { window.removeEventListener('message', onMsg); window.removeEventListener('focus', load); };
  }, [load]);
  return [status, load] as const;
}

function ResultLine({ r, label }: { r: Result; label: string }) {
  if (!r) return null;
  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${r.ok ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300' : 'border-red-800/60 bg-red-950/40 text-red-300'}`}>
      {r.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
      <span className="flex-1">{r.text}</span>
      {r.link && <a href={r.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline">View on {label} <ExternalLink className="w-3 h-3" /></a>}
    </div>
  );
}

function Setup({ title, steps, note }: { title: string; steps: string[]; note?: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs text-slate-300 space-y-2">
      <div className="font-semibold text-slate-100">{title}</div>
      <ol className="list-decimal pl-5 space-y-1.5">{steps.map(s => <li key={s} className="whitespace-pre-wrap">{s}</li>)}</ol>
      {note && <p className="text-slate-500">{note}</p>}
    </div>
  );
}

function Confirm({ title, children, onCancel, onPost, posting, postLabel, color }: { title: string; children: React.ReactNode; onCancel: () => void; onPost: () => void; posting: boolean; postLabel: string; color: string }) {
  return (
    <Overlay onEscape={() => { if (!posting) onCancel(); }}>
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4" onClick={() => !posting && onCancel()}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onCancel} disabled={posting} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {children}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} disabled={posting} className="rounded-md bg-slate-800 hover:bg-slate-700 px-4 py-2 text-sm">Cancel</button>
          <button onClick={onPost} disabled={posting} className={`flex items-center gap-2 rounded-md ${color} disabled:opacity-60 px-4 py-2 text-sm font-semibold text-white`}>
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {posting ? 'Posting… (can take a minute)' : postLabel}
          </button>
        </div>
      </div>
    </div>
    </Overlay>
  );
}

const Earlier = ({ list, where }: { list: Array<Pick<SocialPost, 'createdAt' | 'permalink'>>; where: string }) =>
  list.length ? (
    <p className="flex items-center gap-2 rounded-md bg-amber-950/50 border border-amber-800/60 px-3 py-2 text-xs text-amber-300">
      <AlertTriangle className="w-4 h-4" /> Already posted to {where} {list.length}× (last {new Date(list[0].createdAt).toLocaleString('en-IN')}).
      {list[0].permalink && <a href={list[0].permalink} target="_blank" rel="noreferrer" className="underline">See it</a>}
    </p>
  ) : null;

/** "Post to Facebook" for the picture post (1 photo, or 2–10 as one multi-photo post) — next to "Post to Instagram". */
export function FacebookPhotoPublish({ renderImages, caption, kind, releaseId, disabledReason }: { renderImages: () => Promise<Blob[]>; caption: string; kind: string; releaseId?: string; disabledReason?: string | null }) {
  const [status] = useStatus();
  const fb = status?.facebook;
  const [showSetup, setShowSetup] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [confirm, setConfirm] = useState<{ blobs: Blob[]; urls: string[]; requestId: string; earlier: SocialPost[] } | null>(null);
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const close = () => { confirm?.urls.forEach(u => URL.revokeObjectURL(u)); setConfirm(null); };
  const tooMany = confirm && confirm.blobs.length > 10;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={fb?.configured ? async () => {
            setResult(null);
            setPreparing(true);
            try {
              const [blobs, earlier] = await Promise.all([renderImages(), releaseId ? publishApi.posts(releaseId, 'facebook').catch(() => []) : Promise.resolve([])]);
              setConfirm({ blobs, urls: blobs.map(b => URL.createObjectURL(b)), requestId: crypto.randomUUID(), earlier });
            } catch (e) {
              setResult({ ok: false, text: (e as Error)?.message || 'A picture couldn’t be loaded.' });
            } finally {
              setPreparing(false);
            }
          } : () => setShowSetup(s => !s)}
          disabled={preparing || posting || (!!fb?.configured && !!disabledReason)}
          title={disabledReason || undefined}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${fb?.configured ? 'bg-[#1877F2] hover:brightness-110 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}>
          {preparing ? <Loader2 className="w-4 h-4 animate-spin" /> : fb?.configured ? <Facebook className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
          {preparing ? 'Preparing…' : fb?.configured ? 'Post to Facebook' : 'Set up Facebook posting'}
        </button>
        {status === null ? <span className="text-xs text-slate-500">Checking Facebook…</span>
          : fb?.configured ? <span className="text-xs text-slate-400">Page <b className="text-slate-200">{fb.name}</b> · {fb.postedLast24h ?? 0} posts in 24h</span>
          : fb?.error ? <span className="text-xs text-amber-400">{fb.error}</span>
          : <span className="text-xs text-slate-500">Not set up yet{fb?.missing.length ? ` (missing ${fb.missing.join(', ')})` : ''}</span>}
      </div>
      <ResultLine r={result} label="Facebook" />
      {!fb?.configured && showSetup && <Setup title="Facebook Page posting — one-time setup (free, ~10 minutes)" steps={FACEBOOK_SETUP} note="Facebook only allows apps to post to Pages, not personal profiles." />}
      {confirm && (
        <Confirm title={`Post to your Facebook Page “${fb?.name}” now?`} onCancel={close} posting={posting} postLabel="Post now" color="bg-[#1877F2] hover:brightness-110"
          onPost={async () => {
            if (tooMany) return;
            setPosting(true);
            try {
              const r = await publishApi.facebookPhotos(confirm.blobs, { caption, kind, releaseId, requestId: confirm.requestId });
              setResult({ ok: true, text: 'Posted to Facebook.', link: r.permalink });
              close();
            } catch (e) {
              setResult({ ok: false, text: (e as Error).message });
            } finally {
              setPosting(false);
            }
          }}>
          <Earlier list={confirm.earlier} where="Facebook" />
          <div className="flex gap-2 overflow-x-auto pb-1">{confirm.urls.map((u, i) => <img key={u} src={u} alt={`photo ${i + 1}`} className="h-56 rounded-md border border-slate-700" />)}</div>
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-950 border border-slate-800 p-3 text-xs text-slate-300 font-sans">{caption}</pre>
          <p className="text-xs text-slate-500">{confirm.blobs.length === 1 ? '1 photo' : `${confirm.blobs.length} photos in one post`} · public on your Page right away. {tooMany && <b className="text-amber-400">Facebook posts here take at most 10 photos — remove some slides.</b>}</p>
        </Confirm>
      )}
    </div>
  );
}

/** Reel → Facebook Reel and/or YouTube Short (inside the Reel maker, after the video is made). */
export function VideoPublish({ video, caption, defaultTitle, kind, releaseId }: { video: Blob; caption: string; defaultTitle: string; kind: string; releaseId?: string }) {
  const [status, reload] = useStatus();
  const fb = status?.facebook;
  const yt = status?.youtube;
  const [ig, setIg] = useState<InstagramStatus | null>(null);
  useEffect(() => { ottApi.instagramStatus().then(setIg, () => setIg(null)); }, []);
  const [shareToFeed, setShareToFeed] = useState(true);
  const [setup, setSetup] = useState<null | 'facebook' | 'youtube'>(null);
  const [confirm, setConfirm] = useState<null | { channel: 'facebook' | 'youtube' | 'instagram'; requestId: string; earlier: Array<Pick<SocialPost, 'createdAt' | 'permalink'>> }>(null);
  const [title, setTitle] = useState(`${defaultTitle} #Shorts`.slice(0, 100));
  const [privacy, setPrivacy] = useState('public');
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<{ facebook: Result; youtube: Result; instagram: Result }>({ facebook: null, youtube: null, instagram: null });
  const open = async (channel: 'facebook' | 'youtube' | 'instagram') => {
    if (channel === 'instagram') {
      const earlier = releaseId ? await ottApi.instagramPosts(releaseId).catch(() => []) : [];
      setConfirm({ channel, requestId: crypto.randomUUID(), earlier: earlier.filter(p => p.kind.includes('reel')) });
      return;
    }
    const earlier = releaseId ? await publishApi.posts(releaseId, channel).catch(() => []) : [];
    setConfirm({ channel, requestId: crypto.randomUUID(), earlier: earlier.filter(p => p.format === (channel === 'facebook' ? 'reel' : 'short')) });
  };
  const btn = 'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50';
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-300">Share this video</div>
      <div className="grid grid-cols-1 gap-2">
        {ig?.reelReady
          ? <button onClick={() => open('instagram')} className={`${btn} bg-gradient-to-r from-fuchsia-600 to-orange-500 hover:brightness-110 text-white`}><Send className="w-4 h-4" /> Post as Instagram Reel</button>
          : <div className="rounded-lg bg-slate-800/60 px-3 py-2 text-[11px] text-slate-400">Instagram Reels: set up Instagram posting (IG_ACCESS_TOKEN + IG_USER_ID) — or download the MP4 and post it from the app.</div>}
        {fb?.configured
          ? <button onClick={() => open('facebook')} className={`${btn} bg-[#1877F2] hover:brightness-110 text-white`}><Facebook className="w-4 h-4" /> Post as Facebook Reel</button>
          : <button onClick={() => setSetup(s => (s === 'facebook' ? null : 'facebook'))} className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200`}><Settings2 className="w-4 h-4" /> Set up Facebook</button>}
        {yt?.connected
          ? <button onClick={() => open('youtube')} className={`${btn} bg-[#FF0000] hover:brightness-110 text-white`}><Youtube className="w-4 h-4" /> Upload as YouTube Short</button>
          : yt?.configured
            ? <a href={publishApi.connectYoutubeUrl()} target="_blank" rel="noreferrer" onClick={() => setTimeout(reload, 4000)} className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200`}><Link2 className="w-4 h-4" /> Connect YouTube</a>
            : <button onClick={() => setSetup(s => (s === 'youtube' ? null : 'youtube'))} className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200`}><Settings2 className="w-4 h-4" /> Set up YouTube</button>}
      </div>
      <div className="text-[11px] text-slate-500 space-y-0.5">
        {fb?.configured && <div>Facebook: <b className="text-slate-300">{fb.name}</b></div>}
        {yt?.connected && <div className="flex items-center gap-1">YouTube: <b className="text-slate-300">{yt.channel}</b> · {yt.postedLast24h ?? 0}/{yt.dailyLimit ?? 6} today <button title="Disconnect YouTube" onClick={async () => { if (window.confirm('Disconnect YouTube?')) { await publishApi.disconnectYoutube(); reload(); } }} className="text-slate-500 hover:text-red-400"><Unlink className="w-3 h-3" /></button></div>}
        {yt?.error && <div className="text-amber-400">{yt.error}</div>}
        {fb?.error && <div className="text-amber-400">{fb.error}</div>}
        {ig?.reelReady && <div>Instagram: <b className="text-slate-300">@{ig.username}</b></div>}
      </div>
      <ResultLine r={result.instagram} label="Instagram" />
      <ResultLine r={result.facebook} label="Facebook" />
      <ResultLine r={result.youtube} label="YouTube" />
      {setup === 'facebook' && <Setup title="Facebook Page posting — one-time setup" steps={FACEBOOK_SETUP} />}
      {setup === 'youtube' && <Setup title="YouTube Shorts — one-time setup (free)" steps={YOUTUBE_SETUP} note="Free quota: about 6 uploads a day." />}

      {confirm && (
        <Confirm
          title={confirm.channel === 'instagram' ? `Post this Reel to @${ig?.username}?` : confirm.channel === 'facebook' ? `Post this Reel to “${fb?.name}”?` : `Upload this Short to “${yt?.channel}”?`}
          onCancel={() => setConfirm(null)} posting={posting}
          postLabel={confirm.channel === 'youtube' ? `Upload (${privacy})` : 'Post Reel now'}
          color={confirm.channel === 'instagram' ? 'bg-gradient-to-r from-fuchsia-600 to-orange-500 hover:brightness-110' : confirm.channel === 'facebook' ? 'bg-[#1877F2] hover:brightness-110' : 'bg-[#FF0000] hover:brightness-110'}
          onPost={async () => {
            setPosting(true);
            const ch = confirm.channel;
            try {
              const r = ch === 'instagram'
                ? await ottApi.instagramReel(video, { caption, kind, releaseId, requestId: confirm.requestId, shareToFeed })
                : ch === 'facebook'
                  ? await publishApi.facebookReel(video, { caption, kind, releaseId, requestId: confirm.requestId })
                  : await publishApi.youtubeShort(video, { title, description: caption, privacy, kind, releaseId, requestId: confirm.requestId });
              setResult(x => ({ ...x, [ch]: { ok: true, text: ch === 'instagram' ? 'Reel posted to Instagram.' : ch === 'facebook' ? 'Reel posted — Facebook may take a few minutes to process it.' : `Short uploaded (${privacy}).`, link: r.permalink } }));
              setConfirm(null);
              reload();
            } catch (e) {
              setResult(x => ({ ...x, [ch]: { ok: false, text: (e as Error).message } }));
            } finally {
              setPosting(false);
            }
          }}>
          <Earlier list={confirm.earlier} where={confirm.channel === 'instagram' ? 'Instagram' : confirm.channel === 'facebook' ? 'Facebook' : 'YouTube'} />
          {confirm.channel === 'instagram' && (
            <label className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={shareToFeed} onChange={e => setShareToFeed(e.target.checked)} /> Also show it in my profile grid (feed)</label>
          )}
          {confirm.channel === 'youtube' && (
            <div className="grid sm:grid-cols-[1fr_160px] gap-2 text-xs">
              <label className="space-y-1"><span className="text-slate-400">Title ({title.length}/100)</span>
                <input value={title} onChange={e => setTitle(e.target.value.slice(0, 100))} className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm" />
              </label>
              <label className="space-y-1"><span className="text-slate-400">Visibility</span>
                <select value={privacy} onChange={e => setPrivacy(e.target.value)} className="w-full rounded-md bg-slate-950 border border-slate-700 px-2 py-1.5 text-sm">
                  <option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option>
                </select>
              </label>
            </div>
          )}
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-950 border border-slate-800 p-3 text-xs text-slate-300 font-sans">{caption}</pre>
          <p className="text-xs text-slate-500">
            {confirm.channel === 'instagram' ? 'Goes live as a Reel right away. Instagram processes the video first — this can take a minute or two; keep this window open.' : confirm.channel === 'facebook' ? 'Goes live as a Reel on your Page.' : 'The caption becomes the description; its hashtags become tags. Uploads from a new Google project stay Private until it passes YouTube’s free API audit.'}
          </p>
        </Confirm>
      )}
    </div>
  );
}
