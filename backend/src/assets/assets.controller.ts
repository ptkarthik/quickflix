import { Controller, Post, Param, UseInterceptors, UploadedFile, Body, Get } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { FileInterceptor } from '@nestjs/platform-express';

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

  @Get()
  findAll() {
    return this.assetsService.findAll();
  }
}
