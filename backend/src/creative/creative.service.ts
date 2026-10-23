import { Injectable } from '@nestjs/common';
import { MovieArtworkService, ArtworkCandidate } from './artwork.service';
import { RatingAggregationService, RatingData } from './rating.service';
import { ArtistReferenceService } from './artist-reference.service';
import { MovieTitleIntelligenceService } from './title-intelligence.service';
import { AiGenerationService } from './ai-generation/ai-generation.service';
import { AiGenerationResult } from './ai-generation/ai-generation.provider';

@Injectable()
export class CreativeStudioService {
  
  constructor(
    private artworkService: MovieArtworkService,
    private ratingService: RatingAggregationService,
    private artistService: ArtistReferenceService,
    private titleService: MovieTitleIntelligenceService,
    private aiGenerationService: AiGenerationService
  ) {}

  async buildCreativeStudioPayload(
    canonicalMovieId: string, 
    tmdbId: string | number, 
    title: string,
    movieData: any = {}, 
    manualRating: number | null = null,
    usedCandidateIds: string[] = [],
    requestedConceptId: string = '',
    forceDeepSearch: boolean = false
  ) {
    
    // 1. DISCOVER ARTWORK
    const artworkPromise = this.artworkService.discoverArtwork(canonicalMovieId, tmdbId, title, movieData, forceDeepSearch);
    
    // 2. DISCOVER ARTIST REFERENCES
    const artistPromise = this.artistService.buildReferencePack(movieData, tmdbId);

    // 3. EXTRACT TITLE DNA / OFFICIAL LOGOS
    const titlePromise = this.titleService.buildTitleProfile(canonicalMovieId, tmdbId, title);

    const [artworkResult, artistReferences, titleProfile] = await Promise.all([
      artworkPromise,
      artistPromise,
      titlePromise
    ]);

    if (artworkResult.status === 'NO_VERIFIED_ARTWORK') {
      return {
        status: 'NO_VERIFIED_ARTWORK',
        movieTitle: title,
        artwork: artworkResult,
        artistReferences,
        titleProfile
      };
    }

    // 4. RATING
    const ratingSources: RatingData[] = [];
    if (movieData && movieData.vote_average) {
       ratingSources.push({
         source: 'TMDB',
         rating: movieData.vote_average,
         maximumRating: 10,
         voteCount: movieData.vote_count || 100,
         timestamp: Date.now(),
         normalized: (movieData.vote_average / 10) * 5
       });
    } else if (movieData && movieData.tmdbVoteAverage) {
       ratingSources.push({
         source: 'TMDB',
         rating: movieData.tmdbVoteAverage,
         maximumRating: 10,
         voteCount: movieData.tmdbVoteCount || 100,
         timestamp: Date.now(),
         normalized: (movieData.tmdbVoteAverage / 10) * 5
       });
    }
    const finalRating = this.ratingService.getRating(manualRating, ratingSources);

    // 5. RELEASE INFORMATION
    const classification = movieData?.classification || 'UNKNOWN';
    const effectiveTheatricalDate = movieData?.theatricalDate;
    const effectiveOttDate = movieData?.ottDate;
    const platform = movieData?.platform;
    
    let releaseText = '';
    if (classification.includes('THEATER')) {
      releaseText = `IN THEATRES\n${effectiveTheatricalDate ? new Date(effectiveTheatricalDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase() : 'COMING SOON'}`;
    } else if (classification.includes('OTT') || classification.includes('STREAMING')) {
      releaseText = `STREAMING ON ${platform ? platform.toUpperCase() : 'OTT'}\n${effectiveOttDate ? new Date(effectiveOttDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase() : 'COMING SOON'}`;
    } else {
      releaseText = 'RELEASE DETAILS AWAITED';
    }

    // 6. RETURN GALLERY FOR USER SELECTION
    return {
       status: 'REQUIRES_ARTWORK_SELECTION',
       movieTitle: title,
       artwork: artworkResult, 
       rating: finalRating,
       releaseText,
       artistReferences,
       titleProfile,
       exportModes: ['1080x1350 (4:5)', '1080x1920 (9:16)']
    };
  }

  private generateConcepts(selectedArtwork: ArtworkCandidate | undefined, generationResult: AiGenerationResult) {
    if (!selectedArtwork) return [];

    return [
      {
         id: `concept_a_cinematic_${selectedArtwork.id}`,
         name: 'CINEMATIC',
         layout: 'dramatic_crop',
         cropTarget: 'top',
         instructions: 'Use cinematic framing, strong contrast, atmospheric background.',
         backgroundImage: generationResult.imageUrl, // ACTUAL GENERATED IMAGE
         sourceType: generationResult.sourceType || 'AI_GENERATED'
      },
      {
         id: `concept_b_minimal_${selectedArtwork.id}`,
         name: 'PREMIUM MINIMAL',
         layout: 'negative_space',
         cropTarget: 'center',
         instructions: 'Use restrained typography, subtle gradients, elegant composition.',
         backgroundImage: generationResult.imageUrl,
         sourceType: generationResult.sourceType || 'AI_GENERATED'
      },
      {
         id: `concept_c_editorial_${selectedArtwork.id}`,
         name: 'EDITORIAL / GENRE',
         layout: 'genre_specific',
         cropTarget: 'center',
         instructions: 'Analyze genre for mood-specific treatments. Vibrant, stylized.',
         backgroundImage: generationResult.imageUrl,
         sourceType: generationResult.sourceType || 'AI_GENERATED'
      }
    ];
  }
}
