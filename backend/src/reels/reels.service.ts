import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { EFFECTS, Effect, MOTION_STYLES, MUSIC_LIBRARY, MotionStyle, ReelOptions, TRANSITIONS, Transition, clamp, ffmpegArgs, totalSeconds } from './reels.util';
import * as dns from 'node:dns';
import { checkVideoLink, fileNameFrom, isPrivateHost, looksLikeVideo } from './video-link.util';
import { cleanHolds, holdSeconds, CamPos, CamShape, voiceoverArgs } from './voiceover.util';
import { AutoStyle, analysisArgs, parseAnalysis, pickClips } from './auto-cut.util';
import { TrailerAudio, TrailerClip, probeFromStderr, trailerReelArgs, trailerReelSeconds } from './trailer-reel.util';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const FFMPEG: string | null = (() => { try { return require('ffmpeg-static'); } catch { return null; } })();
const MUSIC_DIR = path.join(process.cwd(), 'data', 'music');
const MAX_SECONDS = 90; // Instagram Reels via the API: up to 90 s

export interface RenderInput {
  slides: Buffer[];
  options: { durations?: unknown; seconds?: unknown; transition?: unknown; motion?: unknown; motionStyle?: unknown; effect?: unknown; trackId?: unknown; audioStart?: unknown; volume?: unknown; fadeOut?: unknown };
  audio?: { buffer: Buffer; originalname?: string } | null;
}

/** Makes Instagram Reels (MP4, 1080×1920, H.264 + AAC) from post slides, with optional music. Runs ffmpeg locally — free. */
const pickEffect = (e: unknown): Effect => (EFFECTS.includes(e as Effect) ? (e as Effect) : 'none');
const pickStyle = (m: unknown): MotionStyle => (MOTION_STYLES.includes(m as MotionStyle) ? (m as MotionStyle) : 'in');

@Injectable()
export class ReelsService {
  private readonly logger = new Logger(ReelsService.name);
  private busy = 0;

  tracks() {
    return MUSIC_LIBRARY.map(({ id, title, mood, credit }) => ({ id, title, mood, credit, cached: fs.existsSync(path.join(MUSIC_DIR, `${id}.mp3`)) }));
  }

  /** Library track on disk (downloaded once from the author's site, then cached). */
  async trackFile(id: string): Promise<string> {
    const t = MUSIC_LIBRARY.find(x => x.id === id);
    if (!t) throw new NotFoundException('Unknown track');
    const file = path.join(MUSIC_DIR, `${t.id}.mp3`);
    if (fs.existsSync(file)) return file;
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
    const res = await fetch(t.url, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new ServiceUnavailableException(`Couldn’t download “${t.title}” (HTTP ${res.status}) — try another track or upload your own.`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 50000) throw new ServiceUnavailableException(`“${t.title}” didn’t download properly — try another track.`);
    fs.writeFileSync(`${file}.part`, buf);
    fs.renameSync(`${file}.part`, file);
    return file;
  }

  async render(input: RenderInput): Promise<{ mp4: Buffer; seconds: number; credit: string | null }> {
    if (!FFMPEG) throw new ServiceUnavailableException('ffmpeg is not installed (npm i ffmpeg-static in backend).');
    const n = input.slides.length;
    if (!n) throw new BadRequestException('No slides to make a Reel from.');
    if (n > 20) throw new BadRequestException('A Reel can have at most 20 slides.');
    const o = input.options || {};
    const transition: Transition = TRANSITIONS.includes(o.transition as Transition) ? (o.transition as Transition) : 'fade';
    const per = clamp(o.seconds, 1.5, 15, n === 1 ? 7 : 3);
    let durations = Array.isArray(o.durations) && o.durations.length === n ? o.durations.map(d => clamp(d, 1.5, 15, per)) : Array(n).fill(per);
    if (transition !== 'none' && n > 1) durations = durations.map(d => Math.max(d, 1.2)); // each slide must outlast its transition
    const seconds = totalSeconds(durations, transition);
    if (seconds > MAX_SECONDS) throw new BadRequestException(`That Reel would be ${Math.round(seconds)} s — Instagram allows ${MAX_SECONDS} s. Use fewer slides or shorter times.`);
    if (this.busy >= 2) throw new ServiceUnavailableException('Two Reels are already being made — try again in a moment.');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
    this.busy++;
    try {
      const slidePaths = input.slides.map((b, i) => {
        if (!(b[0] === 0xff && b[1] === 0xd8) && !(b[0] === 0x89 && b[1] === 0x50)) throw new BadRequestException(`Slide ${i + 1} isn’t a JPEG/PNG image.`);
        const p = path.join(dir, `s${String(i).padStart(2, '0')}.${b[0] === 0xff ? 'jpg' : 'png'}`);
        fs.writeFileSync(p, b);
        return p;
      });
      let audio: ReelOptions['audio'] = null;
      let credit: string | null = null;
      const common = { start: clamp(o.audioStart, 0, 600, 0), volume: clamp(o.volume, 0.05, 2, 1), fadeOut: clamp(o.fadeOut, 0, 5, 1.5) };
      if (input.audio?.buffer?.length) {
        const ext = (path.extname(input.audio.originalname || '').toLowerCase().match(/^\.(mp3|m4a|aac|wav|ogg|opus|flac)$/) || [, 'mp3'])[0] || '.mp3';
        const p = path.join(dir, `music${ext.startsWith('.') ? ext : `.${ext}`}`);
        fs.writeFileSync(p, input.audio.buffer);
        audio = { path: p, ...common };
      } else if (typeof o.trackId === 'string' && o.trackId) {
        audio = { path: await this.trackFile(o.trackId), ...common };
        credit = MUSIC_LIBRARY.find(t => t.id === o.trackId)?.credit || null;
      }
      const out = path.join(dir, 'reel.mp4');
      await this.run(ffmpegArgs(slidePaths, { durations, transition, motion: o.motion !== false && o.motion !== 'false', motionStyle: pickStyle(o.motionStyle), effect: pickEffect(o.effect), audio }, out), Math.max(120000, seconds * 8000));
      const mp4 = fs.readFileSync(out);
      this.logger.log(`[Reels] ${n} slide(s), ${seconds.toFixed(1)} s, ${(mp4.length / 1e6).toFixed(1)} MB${audio ? ' with music' : ''}`);
      return { mp4, seconds, credit };
    } finally {
      this.busy--;
      fs.rm(dir, { recursive: true, force: true }, () => null);
    }
  }

  /** Duration + streams of a media file (ffmpeg -i prints them and exits with an error code — that's expected). */
  private probe(file: string) {
    return new Promise<ReturnType<typeof probeFromStderr>>(resolve => {
      const p = spawn(FFMPEG!, ['-hide_banner', '-i', file], { windowsHide: true });
      let err = '';
      p.stderr.on('data', d => (err += d.toString()));
      p.on('close', () => resolve(probeFromStderr(err)));
      p.on('error', () => resolve({ duration: null, hasAudio: false, hasVideo: false }));
    });
  }

  /**
   * Official trailers / teasers of a title (YouTube keys from TMDB) — for WATCHING in YouTube's own player and marking
   * clip times. Nothing is downloaded from YouTube.
   */
  async trailers(q: { tmdbId?: string; kind?: string; title?: string; year?: string; language?: string }) {
    const key = process.env.TMDB_API_KEY;
    if (!key) throw new ServiceUnavailableException('TMDB_API_KEY is missing');
    const kind = q.kind === 'tv' ? 'tv' : 'movie';
    const get = async (u: string) => {
      const r = await fetch(`https://api.themoviedb.org/3/${u}${u.includes('?') ? '&' : '?'}api_key=${key}`, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new ServiceUnavailableException(`TMDB answered ${r.status}`);
      return r.json() as Promise<any>;
    };
    let id = Number(q.tmdbId) || 0;
    if (!id && q.title) {
      const y = /^\d{4}$/.test(q.year || '') ? `&${kind === 'tv' ? 'first_air_date_year' : 'year'}=${q.year}` : '';
      const found = await get(`search/${kind}?query=${encodeURIComponent(q.title)}${y}`);
      id = found.results?.[0]?.id || 0;
    }
    if (!id) return { tmdbId: null, videos: [] };
    const LANGS: Record<string, string> = { tamil: 'ta', telugu: 'te', malayalam: 'ml', kannada: 'kn', hindi: 'hi', english: 'en', bengali: 'bn', marathi: 'mr', punjabi: 'pa', gujarati: 'gu', korean: 'ko', japanese: 'ja', spanish: 'es', french: 'fr' };
    const rawLang = (q.language || '').trim().toLowerCase();
    const lang = LANGS[rawLang] || (/^[a-z]{2}$/.test(rawLang) ? rawLang : '');
    const body = await get(`${kind}/${id}/videos?include_video_language=en,${lang || 'en'},hi,ta,te,ml,kn,null`);
    const order: Record<string, number> = { Trailer: 0, Teaser: 1, Clip: 2, 'Behind the Scenes': 4, Featurette: 3 };
    const videos = (body.results || [])
      .filter((v: any) => v?.site === 'YouTube' && typeof v.key === 'string' && /^[\w-]{11}$/.test(v.key) && v.type in order)
      .map((v: any) => ({ key: v.key as string, name: String(v.name || v.type), type: String(v.type), official: !!v.official, language: v.iso_639_1 || null, publishedAt: v.published_at || null }))
      .sort((a: any, b: any) => order[a.type] - order[b.type] || Number(b.official) - Number(a.official) || Number(b.language === lang) - Number(a.language === lang) || String(b.publishedAt).localeCompare(String(a.publishedAt)))
      .slice(0, 15);
    return { tmdbId: id, videos };
  }

  /**
   * Fetch a trailer from a link the user pasted (Drive / Dropbox / press-kit / direct file). YouTube & social platforms
   * are refused (their terms forbid downloading). Every redirect hop is re-checked; non-video responses are rejected.
   */
  async fetchLink(raw: string): Promise<{ path: string; name: string; size: number; cleanup: () => void }> {
    const first = checkVideoLink(raw);
    if (!first.ok) throw new BadRequestException(first.message);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlink-'));
    const cleanup = () => fs.rm(dir, { recursive: true, force: true }, () => null);
    const ctrl = new AbortController();
    let idle: NodeJS.Timeout | null = null;
    const bump = () => { if (idle) clearTimeout(idle); idle = setTimeout(() => ctrl.abort(), 60000); };
    const total = setTimeout(() => ctrl.abort(), 15 * 60000);
    try {
      let url = first.url;
      let res: Response | null = null;
      for (let hop = 0; hop < 8; hop++) {
        const u = new URL(url);
        const again = checkVideoLink(url);
        if (!again.ok) throw new BadRequestException(hop ? `That link redirects somewhere we can’t download from. ${again.message}` : again.message);
        const addrs = await dns.promises.lookup(u.hostname, { all: true }).catch((): dns.LookupAddress[] => []);
        if (!addrs.length) throw new BadRequestException(`Couldn’t find the site ${u.hostname}.`);
        if (addrs.some(a => isPrivateHost(a.address))) throw new BadRequestException('That link points to a local / private network address.');
        bump();
        res = await fetch(url, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (CineAI Studio trailer loader)', Accept: 'video/*,application/octet-stream;q=0.9,*/*;q=0.5' } });
        if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
          url = new URL(res.headers.get('location')!, url).toString();
          continue;
        }
        break;
      }
      if (!res || (res.status >= 300 && res.status < 400)) throw new BadRequestException('That link redirects too many times.');
      if (res.status === 401 || res.status === 403) throw new BadRequestException('The file is private — set sharing to “Anyone with the link” and try again.');
      if (res.status === 404) throw new BadRequestException('The file wasn’t found at that link (404).');
      if (!res.ok || !res.body) throw new BadRequestException(`The site answered ${res.status} — couldn’t download.`);
      const len = Number(res.headers.get('content-length') || 0);
      const MAX = 600 * 1024 * 1024;
      if (len > MAX) throw new BadRequestException(`That file is ${(len / 1e6).toFixed(0)} MB — the limit is 600 MB.`);
      const name = fileNameFrom(res.headers.get('content-disposition'), url);
      const file = path.join(dir, `trailer${path.extname(name).toLowerCase() || '.mp4'}`);
      const out = fs.createWriteStream(file);
      let size = 0;
      let head = Buffer.alloc(0);
      const reader = res.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bump();
          const chunk = Buffer.from(value);
          if (head.length < 512) {
            head = Buffer.concat([head, chunk]).subarray(0, 512);
            if (head.length >= 512 || size + chunk.length >= 512) {
              if (!looksLikeVideo(head)) {
                const text = head.toString('utf8').toLowerCase();
                throw new BadRequestException(
                  text.includes('<html') || text.includes('<!doctype')
                    ? 'That link opens a web page, not the video file. Use the file’s direct download link (on Google Drive: Share → “Anyone with the link”).'
                    : 'That link isn’t a video file (MP4 / MOV / WebM).',
                );
              }
            }
          }
          size += chunk.length;
          if (size > MAX) throw new BadRequestException('That file is over 600 MB.');
          if (!out.write(chunk)) await new Promise<void>(r => out.once('drain', () => r()));
        }
      } finally {
        await new Promise<void>(r => out.end(() => r()));
      }
      if (size < 512 && !looksLikeVideo(head)) throw new BadRequestException('That link isn’t a video file.');
      const info = await this.probe(file);
      if (!info.hasVideo || !info.duration) throw new BadRequestException('Downloaded, but it isn’t a video ffmpeg can read.');
      this.logger.log(`[Reels] loaded trailer from link (${new URL(url).hostname}): ${(size / 1e6).toFixed(1)} MB, ${info.duration.toFixed(1)} s`);
      return { path: file, name, size, cleanup };
    } catch (e) {
      cleanup();
      if (e instanceof Error && e.name === 'AbortError') throw new ServiceUnavailableException('The download stalled or took too long.');
      throw e;
    } finally {
      if (idle) clearTimeout(idle);
      clearTimeout(total);
    }
  }

  /**
   * Your voice-over (+ webcam) on a finished Reel. `rec` is the browser recording (WebM: mic, optionally camera);
   * `split` = seconds recorded before the Reel started playing (kept as a talk-to-camera intro when `intro`).
   */
  async renderVoiceover(input: {
    reel: { buffer: Buffer };
    rec: { buffer: Buffer; originalname?: string };
    options: { split?: unknown; intro?: unknown; pip?: unknown; shape?: unknown; pos?: unknown; size?: unknown; mirror?: unknown; voiceVolume?: unknown; bgVolume?: unknown; holds?: unknown };
  }): Promise<{ mp4: Buffer; seconds: number }> {
    if (!FFMPEG) throw new ServiceUnavailableException('ffmpeg is not installed (npm i ffmpeg-static in backend).');
    if (this.busy >= 2) throw new ServiceUnavailableException('Two Reels are already being made — try again in a moment.');
    const o = input.options || {};
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vo-'));
    this.busy++;
    try {
      const reel = path.join(dir, 'reel.mp4');
      const rext = path.extname(input.rec.originalname || '').toLowerCase();
      const rec = path.join(dir, `rec${['.webm', '.mp4', '.m4a', '.ogg', '.wav', '.mkv'].includes(rext) ? rext : '.webm'}`);
      fs.writeFileSync(reel, input.reel.buffer);
      fs.writeFileSync(rec, input.rec.buffer);
      const ri = await this.probe(reel);
      const ci = await this.probe(rec);
      if (!ri.hasVideo || !ri.duration) throw new BadRequestException('The Reel video couldn’t be read — make the Reel again.');
      if (!ci.hasAudio) throw new BadRequestException('No sound in the recording — check the microphone and try again.');
      const split = clamp(o.split, 0, 15, 0);
      const intro = o.intro === true || o.intro === 'true';
      const holds = cleanHolds(o.holds, ri.duration);
      const seconds = (intro ? split : 0) + ri.duration + holdSeconds(holds);
      if (seconds > MAX_SECONDS + 15) throw new BadRequestException(`That would be ${Math.round(seconds)} s — keep the intro short.`);
      const shape: CamShape = o.shape === 'box' ? 'box' : 'circle';
      const pos: CamPos = (['br', 'bl', 'tr', 'tl', 'bc'] as const).includes(o.pos as CamPos) ? (o.pos as CamPos) : 'br';
      const wantPip = o.pip === true || o.pip === 'true';
      const out = path.join(dir, 'voiced.mp4');
      await this.run(
        voiceoverArgs(reel, rec, {
          split, intro, hasCam: ci.hasVideo, pip: wantPip && ci.hasVideo ? { shape, pos, size: clamp(o.size, 200, 560, 380) } : null,
          mirror: o.mirror !== false && o.mirror !== 'false', voiceVolume: clamp(o.voiceVolume, 0.2, 3, 1), bgVolume: clamp(o.bgVolume, 0, 1.5, 0.5),
          reelSeconds: ri.duration, reelHasAudio: ri.hasAudio, holds,
        }, out),
        Math.max(240000, seconds * 12000),
      );
      const mp4 = fs.readFileSync(out);
      this.logger.log(`[Reels] voice-over${ci.hasVideo ? ' + webcam' : ''}: ${seconds.toFixed(1)} s, ${(mp4.length / 1e6).toFixed(1)} MB`);
      return { mp4, seconds };
    } finally {
      this.busy--;
      fs.rm(dir, { recursive: true, force: true }, () => null);
    }
  }

  /** Suggest clips from a trailer automatically (shot changes + loudness + pace; no AI). */
  async autoClips(input: { video: { buffer: Buffer; originalname?: string }; options: { count?: unknown; length?: unknown; style?: unknown; skipStart?: unknown; skipEnd?: unknown } }) {
    if (!FFMPEG) throw new ServiceUnavailableException('ffmpeg is not installed (npm i ffmpeg-static in backend).');
    if (this.busy >= 2) throw new ServiceUnavailableException('Two Reels are already being made — try again in a moment.');
    const o = input.options || {};
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tauto-'));
    this.busy++;
    try {
      const vext = path.extname(input.video.originalname || '').toLowerCase();
      const trailer = path.join(dir, `trailer${['.mp4', '.mov', '.m4v', '.webm', '.mkv'].includes(vext) ? vext : '.mp4'}`);
      fs.writeFileSync(trailer, input.video.buffer);
      const info = await this.probe(trailer);
      if (!info.hasVideo || !info.duration) throw new BadRequestException('That file isn’t a video ffmpeg can read — try an MP4.');
      const stderr = await this.capture(analysisArgs(trailer, info.hasAudio), Math.max(120000, info.duration * 3000));
      const a = parseAnalysis(stderr);
      const style: AutoStyle = ['action', 'story'].includes(o.style as string) ? (o.style as AutoStyle) : 'balanced';
      const clips = pickClips(a, info.duration, {
        count: clamp(o.count, 1, 12, 6), length: clamp(o.length, 1, 8, 2.5), style,
        skipStart: clamp(o.skipStart, 0, 30, 4), skipEnd: clamp(o.skipEnd, 0, 30, 6),
      });
      this.logger.log(`[Reels] auto-cut: ${a.cuts.length} shot changes, ${a.black.length} black parts → ${clips.length} clip(s)`);
      return { clips, duration: info.duration, shots: a.cuts.length + 1, hasAudio: info.hasAudio };
    } finally {
      this.busy--;
      fs.rm(dir, { recursive: true, force: true }, () => null);
    }
  }

  /** Run ffmpeg and return everything it printed (analysis output). */
  private capture(args: string[], timeoutMs: number) {
    return new Promise<string>((resolve, reject) => {
      const p = spawn(FFMPEG!, args, { windowsHide: true });
      const chunks: string[] = [];
      p.stderr.on('data', d => chunks.push(d.toString()));
      const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new ServiceUnavailableException('Reading the trailer took too long.')); }, timeoutMs);
      p.on('error', e => { clearTimeout(timer); reject(e); });
      p.on('close', code => {
        clearTimeout(timer);
        const out = chunks.join('');
        if (code === 0) resolve(out);
        else reject(new ServiceUnavailableException(`Reading the trailer failed: ${out.split(/\r?\n/).filter(Boolean).pop() || code}`));
      });
    });
  }

  /** A Reel cut from a trailer you provide: your clips, 9:16, optional title overlay / intro / outro / music. */
  async renderTrailer(input: {
    video: { buffer: Buffer; originalname?: string };
    overlay?: Buffer | null;
    intro?: Buffer | null;
    outro?: Buffer | null;
    audio?: { buffer: Buffer; originalname?: string } | null;
    signature?: Buffer | null;
    options: { clips?: unknown; framing?: unknown; audio?: unknown; trackId?: unknown; audioStart?: unknown; volume?: unknown; trailerVolume?: unknown; fadeOut?: unknown; introSeconds?: unknown; outroSeconds?: unknown; signatureSeconds?: unknown; signatureAt?: unknown; effect?: unknown };
  }): Promise<{ mp4: Buffer; seconds: number; credit: string | null }> {
    if (!FFMPEG) throw new ServiceUnavailableException('ffmpeg is not installed (npm i ffmpeg-static in backend).');
    const o = input.options || {};
    const rawClips = Array.isArray(o.clips) ? (o.clips as Array<{ start: unknown; end: unknown }>) : [];
    if (!rawClips.length) throw new BadRequestException('Mark at least one clip in the trailer.');
    if (rawClips.length > 12) throw new BadRequestException('Up to 12 clips per Reel.');
    if (this.busy >= 2) throw new ServiceUnavailableException('Two Reels are already being made — try again in a moment.');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'treel-'));
    this.busy++;
    try {
      const vext = path.extname(input.video.originalname || '').toLowerCase();
      const trailer = path.join(dir, `trailer${['.mp4', '.mov', '.m4v', '.webm', '.mkv'].includes(vext) ? vext : '.mp4'}`);
      fs.writeFileSync(trailer, input.video.buffer);
      const info = await this.probe(trailer);
      if (!info.hasVideo || !info.duration) throw new BadRequestException('That file isn’t a video ffmpeg can read — try an MP4.');
      const dur = info.duration;
      const clips: TrailerClip[] = rawClips.map((c, i) => {
        const start = Number(c.start);
        const end = Number(c.end);
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) throw new BadRequestException(`Clip ${i + 1} has a bad start/end.`);
        if (end > dur + 0.05) throw new BadRequestException(`Clip ${i + 1} ends after the trailer (${dur.toFixed(1)} s).`);
        if (end - start < 0.5 || end - start > 20) throw new BadRequestException(`Clip ${i + 1} must be 0.5–20 s long.`);
        return { start, end: Math.min(end, dur) };
      });
      const write = (name: string, b?: Buffer | null) => {
        if (!b?.length) return null;
        const p = path.join(dir, name);
        fs.writeFileSync(p, b);
        return p;
      };
      const overlay = write('overlay.png', input.overlay);
      const introPath = write('intro.jpg', input.intro);
      const outroPath = write('outro.jpg', input.outro);
      const intro = introPath ? { path: introPath, seconds: clamp(o.introSeconds, 1, 8, 2.5) } : null;
      const outro = outroPath ? { path: outroPath, seconds: clamp(o.outroSeconds, 1, 8, 3) } : null;
      const sigPath = write('signature.jpg', input.signature);
      const signature = sigPath ? { path: sigPath, seconds: clamp(o.signatureSeconds, 1, 6, 2.5), at: (o.signatureAt === 'start' ? 'start' : 'end') as 'start' | 'end' } : null;
      const seconds = trailerReelSeconds({ clips, intro, outro, signature });
      if (seconds > MAX_SECONDS) throw new BadRequestException(`That Reel would be ${Math.round(seconds)} s — Instagram allows ${MAX_SECONDS} s.`);
      const audioMode: TrailerAudio = ['trailer', 'music', 'mix', 'none'].includes(o.audio as string) ? (o.audio as TrailerAudio) : 'trailer';
      let music: { path: string; start: number; volume: number } | null = null;
      let credit: string | null = null;
      if (audioMode === 'music' || audioMode === 'mix') {
        const start = clamp(o.audioStart, 0, 600, 0);
        const volume = clamp(o.volume, 0.05, 2, audioMode === 'mix' ? 0.35 : 1);
        if (input.audio?.buffer?.length) {
          const aext = path.extname(input.audio.originalname || '').toLowerCase();
          const p = path.join(dir, `music${['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.opus', '.flac'].includes(aext) ? aext : '.mp3'}`);
          fs.writeFileSync(p, input.audio.buffer);
          music = { path: p, start, volume };
        } else if (typeof o.trackId === 'string' && o.trackId) {
          music = { path: await this.trackFile(o.trackId), start, volume };
          credit = MUSIC_LIBRARY.find(t => t.id === o.trackId)?.credit || null;
        } else throw new BadRequestException('Pick a music track or upload one (or use the trailer’s own sound).');
      }
      const out = path.join(dir, 'reel.mp4');
      await this.run(
        trailerReelArgs(trailer, {
          clips, framing: o.framing === 'fill' ? 'fill' : 'fit', audio: audioMode, hasTrailerAudio: info.hasAudio,
          trailerVolume: clamp(o.trailerVolume, 0, 2, 1), music, fadeOut: clamp(o.fadeOut, 0, 5, 1), overlay, intro, outro, signature, effect: pickEffect(o.effect),
        }, out),
        Math.max(180000, seconds * 10000),
      );
      const mp4 = fs.readFileSync(out);
      this.logger.log(`[Reels] trailer cut: ${clips.length} clip(s), ${seconds.toFixed(1)} s, ${(mp4.length / 1e6).toFixed(1)} MB`);
      return { mp4, seconds, credit };
    } finally {
      this.busy--;
      fs.rm(dir, { recursive: true, force: true }, () => null);
    }
  }

  private run(args: string[], timeoutMs: number) {
    return new Promise<void>((resolve, reject) => {
      const p = spawn(FFMPEG!, args, { windowsHide: true });
      let err = '';
      p.stderr.on('data', d => (err = (err + d.toString()).slice(-4000)));
      const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new ServiceUnavailableException('Making the Reel took too long — try fewer slides or turn off motion.')); }, timeoutMs);
      p.on('error', e => { clearTimeout(timer); reject(e); });
      p.on('close', code => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else {
          this.logger.warn(`[Reels] ffmpeg failed (${code}): ${err.slice(-800)}`);
          reject(new ServiceUnavailableException(/Invalid data|could not find codec|does not contain any stream/i.test(err) ? 'The music file couldn’t be read — try an MP3 or M4A.' : `Making the Reel failed: ${err.split('\n').filter(Boolean).pop() || code}`));
        }
      });
    });
  }
}
