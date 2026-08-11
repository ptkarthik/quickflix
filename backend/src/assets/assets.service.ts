import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  createAsset(data: {
    projectId: string;
    type: string;
    filename: string;
    originalName: string;
    mimeType: string;
    path: string;
    isGenerated?: boolean;
    width?: number;
    height?: number;
    template?: string;
    format?: string;
  }) {
    return this.prisma.movieAsset.create({
      data,
    });
  }

  findByProject(projectId: string) {
    return this.prisma.movieAsset.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });
  }

  findAll() {
    return this.prisma.movieAsset.findMany({
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { title: true } } }
    });
  }
}
