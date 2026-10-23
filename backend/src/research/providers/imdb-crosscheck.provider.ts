import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as https from 'https';

export interface ImdbMatchResult {
  imdbId?: string;
  title?: string;
  year?: number;
  entityType?: string;
  matched: boolean;
}

@Injectable()
export class ImdbCrosscheckProvider {
  private readonly logger = new Logger(ImdbCrosscheckProvider.name);

  private readonly http = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    timeout: 5000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });

  /**
   * Search IMDb suggestions to find matching canonical title, year, and tt-ID
   */
  async findMatch(title: string, year?: number): Promise<ImdbMatchResult> {
    const cleanTitle = title.trim();
    if (!cleanTitle) return { matched: false };

    const firstChar = cleanTitle.charAt(0).toLowerCase();
    if (!firstChar.match(/[a-z0-9]/)) return { matched: false };

    try {
      const url = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(cleanTitle)}.json`;
      const res = await this.http.get(url);

      if (res.data?.d && Array.isArray(res.data.d)) {
        for (const hit of res.data.d) {
          const qid = (hit.qid || '').toLowerCase();
          const q = (hit.q || '').toLowerCase();

          // Reject non-film entities
          if (qid === 'person' || qid === 'videogame' || qid === 'podcastseries') continue;

          // Check if candidate matches title closely
          const hitTitle = (hit.l || '').toLowerCase();
          const targetTitle = cleanTitle.toLowerCase();

          const isDirectMatch = hitTitle === targetTitle || hitTitle.includes(targetTitle) || targetTitle.includes(hitTitle);
          const isYearMatch = year ? (hit.y && Math.abs(hit.y - year) <= 1) : true;

          if (isDirectMatch && isYearMatch && hit.id && hit.id.startsWith('tt')) {
            return {
              imdbId: hit.id,
              title: hit.l,
              year: hit.y,
              entityType: hit.qid || hit.q,
              matched: true
            };
          }
        }
      }
    } catch (err: any) {
      this.logger.debug(`IMDb suggestion query failed for "${title}": ${err.message}`);
    }

    return { matched: false };
  }
}
