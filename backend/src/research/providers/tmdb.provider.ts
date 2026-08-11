import { Injectable, Logger } from '@nestjs/common';
import { MovieResearchProvider, ResearchData } from './research-provider.interface';

@Injectable()
export class TmdbProvider implements MovieResearchProvider {
  private readonly logger = new Logger(TmdbProvider.name);
  private readonly apiKey = process.env.TMDB_API_KEY;
  private readonly baseUrl = 'https://api.themoviedb.org/3';

  async searchMovie(title: string, year?: number): Promise<any[]> {
    if (!this.apiKey) {
      this.logger.warn('TMDB_API_KEY is not set. Returning mock search results.');
      return [
        { id: 'mock-1', title: `${title} (Mock)`, release_date: `${year || 2023}-01-01`, overview: 'Mock synopsis.' }
      ];
    }

    try {
      let url = `${this.baseUrl}/search/movie?api_key=${this.apiKey}&query=${encodeURIComponent(title)}`;
      if (year) {
        url += `&year=${year}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      return data.results || [];
    } catch (err) {
      this.logger.error('Failed to search TMDB', err);
      throw err;
    }
  }

  async getMovieDetails(id: string | number): Promise<ResearchData> {
    if (!this.apiKey) {
       return {
         title: "Mock Title",
         synopsis: "This is a mock synopsis since TMDB API is not configured.",
         releaseDate: "2023-01-01",
         genres: ["Mock Genre"],
         director: "Mock Director",
         cast: ["Actor A", "Actor B"],
         runtime: 120,
         productionInfo: "Mock Studio"
       };
    }

    try {
      const url = `${this.baseUrl}/movie/${id}?api_key=${this.apiKey}&append_to_response=credits`;
      const response = await fetch(url);
      const data = await response.json();

      const director = data.credits?.crew?.find((c: any) => c.job === 'Director')?.name || 'Unknown';
      const cast = data.credits?.cast?.slice(0, 5).map((c: any) => c.name) || [];
      const genres = data.genres?.map((g: any) => g.name) || [];
      const productionInfo = data.production_companies?.map((p: any) => p.name).join(', ') || 'Unknown';

      return {
        title: data.title,
        synopsis: data.overview,
        releaseDate: data.release_date,
        genres,
        director,
        cast,
        runtime: data.runtime || 0,
        productionInfo
      };
    } catch (err) {
      this.logger.error('Failed to get TMDB details', err);
      throw err;
    }
  }
}
