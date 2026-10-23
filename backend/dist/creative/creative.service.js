"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreativeStudioService = void 0;
const common_1 = require("@nestjs/common");
const artwork_service_1 = require("./artwork.service");
const rating_service_1 = require("./rating.service");
const artist_reference_service_1 = require("./artist-reference.service");
const title_intelligence_service_1 = require("./title-intelligence.service");
const ai_generation_service_1 = require("./ai-generation/ai-generation.service");
let CreativeStudioService = class CreativeStudioService {
    artworkService;
    ratingService;
    artistService;
    titleService;
    aiGenerationService;
    constructor(artworkService, ratingService, artistService, titleService, aiGenerationService) {
        this.artworkService = artworkService;
        this.ratingService = ratingService;
        this.artistService = artistService;
        this.titleService = titleService;
        this.aiGenerationService = aiGenerationService;
    }
    async buildCreativeStudioPayload(canonicalMovieId, tmdbId, title, movieData = {}, manualRating = null, usedCandidateIds = [], requestedConceptId = '', forceDeepSearch = false) {
        const artworkPromise = this.artworkService.discoverArtwork(canonicalMovieId, tmdbId, title, movieData, forceDeepSearch);
        const artistPromise = this.artistService.buildReferencePack(movieData, tmdbId);
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
        const ratingSources = [];
        if (movieData && movieData.vote_average) {
            ratingSources.push({
                source: 'TMDB',
                rating: movieData.vote_average,
                maximumRating: 10,
                voteCount: movieData.vote_count || 100,
                timestamp: Date.now(),
                normalized: (movieData.vote_average / 10) * 5
            });
        }
        else if (movieData && movieData.tmdbVoteAverage) {
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
        const classification = movieData?.classification || 'UNKNOWN';
        const effectiveTheatricalDate = movieData?.theatricalDate;
        const effectiveOttDate = movieData?.ottDate;
        const platform = movieData?.platform;
        let releaseText = '';
        if (classification.includes('THEATER')) {
            releaseText = `IN THEATRES\n${effectiveTheatricalDate ? new Date(effectiveTheatricalDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase() : 'COMING SOON'}`;
        }
        else if (classification.includes('OTT') || classification.includes('STREAMING')) {
            releaseText = `STREAMING ON ${platform ? platform.toUpperCase() : 'OTT'}\n${effectiveOttDate ? new Date(effectiveOttDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase() : 'COMING SOON'}`;
        }
        else {
            releaseText = 'RELEASE DETAILS AWAITED';
        }
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
    generateConcepts(selectedArtwork, generationResult) {
        if (!selectedArtwork)
            return [];
        return [
            {
                id: `concept_a_cinematic_${selectedArtwork.id}`,
                name: 'CINEMATIC',
                layout: 'dramatic_crop',
                cropTarget: 'top',
                instructions: 'Use cinematic framing, strong contrast, atmospheric background.',
                backgroundImage: generationResult.imageUrl,
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
};
exports.CreativeStudioService = CreativeStudioService;
exports.CreativeStudioService = CreativeStudioService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [artwork_service_1.MovieArtworkService,
        rating_service_1.RatingAggregationService,
        artist_reference_service_1.ArtistReferenceService,
        title_intelligence_service_1.MovieTitleIntelligenceService,
        ai_generation_service_1.AiGenerationService])
], CreativeStudioService);
//# sourceMappingURL=creative.service.js.map