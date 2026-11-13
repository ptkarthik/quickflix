import { Body, Controller, Delete, Get, Header, Param, Post, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { WatchService } from './watch.service';
import type { SiteBrand } from './site-template';

/** Build & preview the client "Watch Free" site (legal sources only; you approve every item). */
@Controller('watch')
export class WatchController {
  constructor(private readonly watch: WatchService) {}

  @Get('summary')
  summary() {
    return this.watch.summary();
  }

  @Get('channels')
  channels() {
    return this.watch.channels();
  }
  @Get('channels/search')
  search(@Query('q') q: string) {
    return this.watch.searchChannels(q || '');
  }
  @Post('channels')
  add(@Body() b: { ref: string }) {
    return this.watch.addChannel(b?.ref || '');
  }
  @Delete('channels/:id')
  remove(@Param('id') id: string) {
    return this.watch.removeChannel(id);
  }
  @Post('channels/:id/scan')
  scan(@Param('id') id: string) {
    return this.watch.scanChannel(id);
  }
  @Get('scans')
  scans() {
    return this.watch.scanning;
  }

  @Post('archive/scan')
  archive(@Body() b: { q?: string; rows?: number; page?: number }) {
    return this.watch.scanArchive(b || {});
  }

  @Get('videos')
  videos(@Query() q: { source?: string; status?: string; q?: string; skip?: string; take?: string }) {
    return this.watch.videos(q);
  }
  @Post('videos/status')
  status(@Body() b: { ids: string[]; status: string }) {
    return this.watch.setStatus(b?.ids || [], b?.status);
  }

  @Post('trailers/refresh')
  trailers() {
    return this.watch.refreshTrailers();
  }

  /** Live preview of the client site. ?name=&tagline=&handle=&accent=&instagram=&youtube=&facebook= */
  @Get('site')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; frame-src https://www.youtube-nocookie.com https://archive.org")
  site(@Query() brand: Partial<SiteBrand>) {
    return this.watch.siteHtml(brand);
  }

  /** Download the site as a zip (one index.html) to host anywhere for free. */
  @Get('export')
  async export(@Query() brand: Partial<SiteBrand>, @Res({ passthrough: true }) res: Response) {
    res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="watch-free-site.zip"' });
    return new StreamableFile(await this.watch.exportZip(brand));
  }
}
