import { Injectable, NotFoundException } from '@nestjs/common';
import { TmdbProvider } from './providers/tmdb.provider';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResearchService {
  constructor(
    private readonly tmdbProvider: TmdbProvider,
    private readonly prisma: PrismaService
  ) {}

  async search(projectId: string) {
    const project = await this.prisma.movieProject.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    return this.tmdbProvider.searchMovie(project.title, project.releaseYear ?? undefined);
  }

  async linkAndFetch(projectId: string, tmdbId: string | number) {
    const research = await this.tmdbProvider.getMovieDetails(tmdbId);
    
    // Save to DB
    await this.prisma.movieProject.update({
      where: { id: projectId },
      data: {
        researchFetchedAt: new Date(),
        researchVersion: '1.0'
      }
    });

    return research;
  }
}
