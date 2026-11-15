import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res, StreamableFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as fs from 'node:fs';
import { ReelsService } from './reels.service';

@Controller('reels')
export class ReelsController {
  constructor(private readonly reels: ReelsService) {}

  /** Free music library (Kevin MacLeod, CC BY 4.0). */
  @Get('tracks')
  tracks() {
    return this.reels.tracks();
  }

  /** Play a library track in the browser (downloads & caches it the first time). */
  @Get('tracks/:id/audio')
  async audio(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.reels.trackFile(id);
    res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' });
    return new StreamableFile(fs.createReadStream(file));
  }

  /** GET /reels/trailers?tmdbId=&kind=movie|tv&title=&year=&language= → official trailers (YouTube keys) to watch + mark. */
  @Get('trailers')
  trailers(@Query() q: { tmdbId?: string; kind?: string; title?: string; year?: string; language?: string }) {
    return this.reels.trailers(q);
  }

  /** POST /reels/voiceover (multipart): reel = the Reel MP4, rec = your recording (WebM); options = JSON {split, intro, pip, shape, pos, size, mirror, voiceVolume, bgVolume}. */
  @Post('voiceover')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'reel', maxCount: 1 }, { name: 'rec', maxCount: 1 }], { limits: { fileSize: 300 * 1024 * 1024 } }))
  async voiceover(
    @UploadedFiles() files: { reel?: Express.Multer.File[]; rec?: Express.Multer.File[] },
    @Body('options') options: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    let opts = {};
    try {
      opts = JSON.parse(options || '{}');
    } catch {}
    const reel = files?.reel?.[0];
    const rec = files?.rec?.[0];
    if (!reel || !rec) throw new BadRequestException('Send the Reel and your recording.');
    const r = await this.reels.renderVoiceover({ reel, rec, options: opts });
    res.set({ 'Content-Type': 'video/mp4', 'Content-Disposition': 'attachment; filename="reel-voice.mp4"', 'X-Reel-Seconds': r.seconds.toFixed(1), 'Access-Control-Expose-Headers': 'X-Reel-Seconds' });
    return new StreamableFile(r.mp4);
  }

  /** POST /reels/fetch {url}: download a trailer from a pasted link (not YouTube / social) and send the file to the browser. */
  @Post('fetch')
  async fetchLink(@Body('url') url: string, @Res({ passthrough: true }) res: Response) {
    const f = await this.reels.fetchLink(url);
    res.set({
      'Content-Type': 'video/mp4',
      'Content-Length': String(f.size),
      'X-File-Name': encodeURIComponent(f.name),
      'Access-Control-Expose-Headers': 'X-File-Name, Content-Length',
    });
    const stream = fs.createReadStream(f.path);
    stream.on('close', f.cleanup);
    return new StreamableFile(stream);
  }

  /** POST /reels/trailer/auto (multipart): video = trailer file; options = JSON {count, length, style: action|balanced|story}. Returns suggested clips. */
  @Post('trailer/auto')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'video', maxCount: 1 }], { limits: { fileSize: 600 * 1024 * 1024 } }))
  async trailerAuto(@UploadedFiles() files: { video?: Express.Multer.File[] }, @Body('options') options: string) {
    let opts = {};
    try {
      opts = JSON.parse(options || '{}');
    } catch {}
    const video = files?.video?.[0];
    if (!video) throw new BadRequestException('Choose the trailer video file.');
    return this.reels.autoClips({ video, options: opts });
  }

  /**
   * POST /reels/trailer (multipart): video = the trailer file, optional overlay (transparent 1080×1920 PNG), intro / outro
   * pictures, audio = your music; options = JSON {clips:[{start,end}], framing, audio: trailer|music|mix|none, trackId, …}.
   */
  @Post('trailer')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'video', maxCount: 1 }, { name: 'overlay', maxCount: 1 }, { name: 'intro', maxCount: 1 }, { name: 'outro', maxCount: 1 }, { name: 'signature', maxCount: 1 }, { name: 'audio', maxCount: 1 }], { limits: { fileSize: 600 * 1024 * 1024 } }))
  async trailer(
    @UploadedFiles() files: { video?: Express.Multer.File[]; overlay?: Express.Multer.File[]; intro?: Express.Multer.File[]; outro?: Express.Multer.File[]; signature?: Express.Multer.File[]; audio?: Express.Multer.File[] },
    @Body('options') options: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    let opts = {};
    try {
      opts = JSON.parse(options || '{}');
    } catch {}
    const video = files?.video?.[0];
    if (!video) throw new BadRequestException('Choose the trailer video file.');
    const r = await this.reels.renderTrailer({ video, overlay: files.overlay?.[0]?.buffer, intro: files.intro?.[0]?.buffer, outro: files.outro?.[0]?.buffer, signature: files.signature?.[0]?.buffer, audio: files.audio?.[0] || null, options: opts });
    res.set({
      'Content-Type': 'video/mp4',
      'Content-Disposition': 'attachment; filename="trailer-reel.mp4"',
      'X-Reel-Seconds': r.seconds.toFixed(1),
      'X-Reel-Credit': r.credit ? encodeURIComponent(r.credit) : '',
      'Access-Control-Expose-Headers': 'X-Reel-Seconds, X-Reel-Credit',
    });
    return new StreamableFile(r.mp4);
  }

  /**
   * POST /reels/render (multipart): slides[] = JPEG/PNG images in order, optional audio = your music file,
   * options = JSON {seconds, durations[], transition, motion, trackId, audioStart, volume, fadeOut}. Returns the MP4.
   */
  @Post('render')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'slides', maxCount: 20 }, { name: 'audio', maxCount: 1 }], { limits: { fileSize: 25 * 1024 * 1024 } }))
  async render(
    @UploadedFiles() files: { slides?: Express.Multer.File[]; audio?: Express.Multer.File[] },
    @Body('options') options: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    let opts = {};
    try {
      opts = JSON.parse(options || '{}');
    } catch {}
    const r = await this.reels.render({ slides: (files?.slides || []).map(f => f.buffer), options: opts, audio: files?.audio?.[0] || null });
    res.set({
      'Content-Type': 'video/mp4',
      'Content-Disposition': 'attachment; filename="reel.mp4"',
      'X-Reel-Seconds': r.seconds.toFixed(1),
      'X-Reel-Credit': r.credit ? encodeURIComponent(r.credit) : '',
      'Access-Control-Expose-Headers': 'X-Reel-Seconds, X-Reel-Credit',
    });
    return new StreamableFile(r.mp4);
  }
}
