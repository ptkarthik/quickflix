import { Controller, Post, Param, UseInterceptors, UploadedFile, Body, Get, Query, Res } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { FileInterceptor } from '@nestjs/platform-express';
import axios from 'axios';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post(':projectId')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @Param('projectId') projectId: string,
    @Body('type') type: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.assetsService.createAsset({
      projectId,
      type: type || 'other',
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      path: `uploads/${projectId}/${file.filename}`,
    });
  }

  @Post(':projectId/generated')
  @UseInterceptors(FileInterceptor('file'))
  uploadGenerated(
    @Param('projectId') projectId: string,
    @Body('type') type: string,
    @Body('template') template: string,
    @Body('format') format: string,
    @Body('width') width: string,
    @Body('height') height: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.assetsService.createAsset({
      projectId,
      type: type || 'GENERATED_CREATIVE',
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      path: `uploads/${projectId}/${file.filename}`,
      isGenerated: true,
      template,
      format,
      width: width ? parseInt(width, 10) : undefined,
      height: height ? parseInt(height, 10) : undefined
    });
  }

  @Get('project/:projectId')
  findByProject(@Param('projectId') projectId: string) {
    return this.assetsService.findByProject(projectId);
  }

  @Get('proxy')
  async proxyImage(@Query('url') url: string, @Res() res: any) {
    if (!url) return res.status(400).send('Missing url parameter');
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      });
      res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(Buffer.from(response.data));
    } catch (err: any) {
      return res.status(500).send(`Proxy error: ${err.message}`);
    }
  }

  @Get()
  findAll() {
    return this.assetsService.findAll();
  }
}
