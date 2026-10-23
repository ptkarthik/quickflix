import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as https from 'https';

export interface OmdbMovieMetadata {
  imdbId?: string;
  title?: string;
  year?: number;
  releasedDate?: string; // Formatted YYYY-MM-DD
  boxOffice?: string;
  imdbRating?: string;
  genre?: string[];
  director?: string;
  actors?: string[];
  isValid: boolean;
}

@Injectable()
export class OmdbProvider {
  private readonly logger = new Logger(OmdbProvider.name);
  private readonly apiKey = process.env.OMDB_API_KEY || 'acdaf73';
  private readonly baseUrl = 'https://www.omdbapi.com';

  private readonly http = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    timeout: 5000
  });

  /**
   * Search movie by title and optional year to retrieve IMDb ID and release evidence
   */
  async getByTitle(title: string, year?: number): Promise<OmdbMovieMetadata> {
    if (!this.apiKey) {
      return { isValid: false };
    }

    try {
      const url = `${this.baseUrl}/?apikey=${this.apiKey}&t=${encodeURIComponent(title)}${year ? `&y=${year}` : ''}`;
      const res = await this.http.get(url);

      if (res.data && res.data.Response === 'True') {
        return this.normalizeOmdbResponse(res.data);
      }
    } catch (err: any) {
      this.logger.debug(`OMDb lookup failed for "${title}": ${err.message}`);
    }

    return { isValid: false };
  }

  /**
   * Fetch movie details by IMDb ID (e.g. tt1234567)
   */
  async getByImdbId(imdbId: string): Promise<OmdbMovieMetadata> {
    if (!this.apiKey || !imdbId) {
      return { isValid: false };
    }

    try {
      const url = `${this.baseUrl}/?apikey=${this.apiKey}&i=${encodeURIComponent(imdbId)}`;
      const res = await this.http.get(url);

      if (res.data && res.data.Response === 'True') {
        return this.normalizeOmdbResponse(res.data);
      }
    } catch (err: any) {
      this.logger.debug(`OMDb lookup by IMDb ID failed for "${imdbId}": ${err.message}`);
    }

    return { isValid: false };
  }

  private normalizeOmdbResponse(data: any): OmdbMovieMetadata {
    let releasedDate: string | undefined = undefined;
    if (data.Released && data.Released !== 'N/A') {
      try {
        const d = new Date(data.Released);
        if (!isNaN(d.getTime())) {
          releasedDate = d.toISOString().split('T')[0];
        }
      } catch {
        // Leave undefined
      }
    }

    const yearNum = data.Year ? parseInt(data.Year.replace(/\D/g, ''), 10) : undefined;

    return {
      imdbId: data.imdbID,
      title: data.Title,
      year: yearNum,
      releasedDate,
      boxOffice: data.BoxOffice !== 'N/A' ? data.BoxOffice : undefined,
      imdbRating: data.imdbRating !== 'N/A' ? data.imdbRating : undefined,
      genre: data.Genre ? data.Genre.split(',').map((g: string) => g.trim()) : [],
      director: data.Director !== 'N/A' ? data.Director : undefined,
      actors: data.Actors ? data.Actors.split(',').map((a: string) => a.trim()) : [],
      isValid: true
    };
  }
}
