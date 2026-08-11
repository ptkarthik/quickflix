import { Controller, Post, Param, Body, Patch } from '@nestjs/common';
import { ContentGeneratorService } from './content-generator.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('projects/:id')
export class AiController {
  constructor(
    private readonly generatorService: ContentGeneratorService,
    private readonly prisma: PrismaService
  ) {}

  @Post('generate')
  async generateAll(@Param('id') id: string) {
    return this.generatorService.generateAll(id);
  }

  @Post('generate/:type')
  async generateSpecific(@Param('id') id: string, @Param('type') type: string) {
    return this.generatorService.generateSpecific(id, type);
  }

  @Patch('content/:type')
  async saveEditedContent(
    @Param('id') id: string,
    @Param('type') type: string,
    @Body() body: any
  ) {
    const uppercaseType = type.toUpperCase();
    return this.prisma.editedContent.upsert({
      where: {
        projectId_type: { projectId: id, type: uppercaseType }
      },
      update: {
        content: JSON.stringify(body.content)
      },
      create: {
        projectId: id,
        type: uppercaseType,
        content: JSON.stringify(body.content)
      }
    });
  }
}
