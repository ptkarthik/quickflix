import { Injectable } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createProjectDto: CreateProjectDto) {
    return this.prisma.movieProject.create({
      data: createProjectDto as any,
    });
  }

  findAll() {
    return this.prisma.movieProject.findMany({
      orderBy: { createdAt: 'desc' },
      include: { assets: true },
    });
  }

  findOne(id: string) {
    return this.prisma.movieProject.findUnique({
      where: { id },
      include: { assets: true, generatedContent: true, editedContent: true },
    });
  }

  update(id: string, updateProjectDto: UpdateProjectDto) {
    return this.prisma.movieProject.update({
      where: { id },
      data: updateProjectDto as any,
    });
  }

  remove(id: string) {
    return this.prisma.movieProject.delete({
      where: { id },
    });
  }
}
