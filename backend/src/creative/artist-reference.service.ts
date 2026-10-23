import { Injectable, Logger } from '@nestjs/common';
import { TmdbProvider } from '../research/providers/tmdb.provider';

export interface ArtistReferenceImage {
  url: string;
  sourceUrl: string;
  sourceType: 'official' | 'tmdb' | 'archive' | 'web' | 'unknown';
  retrievalStatus: 'SUCCESS' | 'FAILED' | 'PENDING';
  validationStatus: 'SOURCE_VERIFIED' | 'UNVERIFIED' | 'REJECTED';
  suppliedToModel: boolean;
  confidence: number;
}

export interface ArtistReference {
  role: string;
  name: string;
  references: ArtistReferenceImage[];
  referenceCount: number;
  retrievalStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'NO_DATA';
}

export interface ArtistReferencePack {
  artists: ArtistReference[];
  totalReferences: number;
  packStatus: 'SOURCE_VERIFIED' | 'PARTIAL' | 'FAILED' | 'NO_DATA';
}

@Injectable()
export class ArtistReferenceService {
  private readonly logger = new Logger(ArtistReferenceService.name);

  constructor(private tmdbProvider: TmdbProvider) {}

  async buildReferencePack(movieData: any, tmdbId?: string | number): Promise<ArtistReferencePack> {
    this.logger.log(`Building Artist Reference Pack for: ${movieData.title || 'Unknown'} (ID: ${tmdbId || movieData.id})`);
    
    const pack: ArtistReferencePack = { 
      artists: [], 
      totalReferences: 0,
      packStatus: 'NO_DATA'
    };

    let castList: any[] = [];
    
    try {
      const targetId = tmdbId || movieData.id;
      if (targetId) {
        const tmdbDetails = await this.tmdbProvider.getMovieDetails(targetId);
        castList = tmdbDetails.cast || [];
      }
    } catch (err) {
      this.logger.warn(`Failed to fetch TMDB credits: ${err.message}`);
    }

    if (castList.length === 0 && movieData.cast) {
       castList = movieData.cast;
    }

    const roles = ['Hero 1', 'Hero 2', 'Supporting'];
    let verifiedCount = 0;

    for (let i = 0; i < Math.min(castList.length, 3); i++) {
       const actorName = typeof castList[i] === 'string' ? castList[i] : (castList[i].name || `Actor ${i+1}`);
       const profilePath = typeof castList[i] === 'object' ? castList[i].profile_path : null;
       
       const references: ArtistReferenceImage[] = [];
       
       if (profilePath) {
          references.push({
            url: `https://image.tmdb.org/t/p/original${profilePath}`,
            sourceUrl: `https://themoviedb.org/person`,
            sourceType: 'tmdb',
            retrievalStatus: 'SUCCESS',
            validationStatus: 'SOURCE_VERIFIED',
            suppliedToModel: true,
            confidence: 95
          });
       } else {
          this.logger.warn(`No validated profile image found for actor: ${actorName}`);
       }

       const hasRefs = references.length > 0;
       if (hasRefs) verifiedCount++;

       pack.artists.push({
         role: roles[i] || `Supporting ${i}`,
         name: actorName,
         references,
         referenceCount: references.length,
         retrievalStatus: hasRefs ? 'SUCCESS' : 'NO_DATA'
       });
       pack.totalReferences += references.length;
    }

    if (pack.artists.length > 0 && verifiedCount === pack.artists.length) {
       pack.packStatus = 'SOURCE_VERIFIED';
    } else if (pack.artists.length > 0 && verifiedCount > 0) {
       pack.packStatus = 'PARTIAL';
    } else {
       pack.packStatus = 'FAILED';
    }

    return pack;
  }
}
