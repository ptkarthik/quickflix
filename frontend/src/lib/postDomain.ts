import { apiFetch } from './api';
import { AiCaptionCopy, ImageOption, OttRelease, ottApi } from './ott';
import type { CinemaRelease } from './cinema';
import { cinemaApi } from './cinema';
import type { WorldTitle } from './world';
import { streamingIn, worldApi } from './world';

/**
 * What a post is made of. OTT titles are used as-is; a cinema film is converted to the same shape
 * (movie, no platform) and keeps its theatrical facts in `cinema`, so the editor, carousel, themes,
 * AI posters and publishing work the same for both desks.
 */
export type PostItem = OttRelease & { cinema?: CinemaRelease; world?: WorldTitle };

export type ImageResults = { query: string; tmdb: ImageOption[]; official: ImageOption[]; web: ImageOption[]; webError?: string };

export interface PostDomain {
  kind: 'ott' | 'cinema' | 'world';
  images: (id: string, q?: string) => Promise<ImageResults>;
  /** Saves your rating / review / chosen picture on the title. */
  update: (id: string, patch: { myRating?: number | null; myReview?: string | null; posterPath?: string }) => Promise<PostItem>;
  draftReview: (id: string, body: { rating?: number | null; notes?: string; tone?: string }) => Promise<{ text: string; model: string }>;
  aiCaption: (body: { kind: string; releaseIds: string[]; tone: string; language: string; rating?: number | null; review?: string; heading?: string }) => Promise<AiCaptionCopy>;
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string })?.message || `Request failed (${res.status})`);
  return body as T;
}

export function cinemaPostItem(c: CinemaRelease): PostItem {
  return {
    id: c.id,
    title: c.title,
    contentType: 'movie',
    seasonNumber: null,
    language: c.language,
    platform: null,
    releaseDate: c.releaseDate,
    status: c.status,
    origin: 'MANUAL',
    sourceUrl: null,
    sourceName: null,
    headline: null,
    tmdbId: c.tmdbId,
    posterPath: c.posterPath,
    overview: c.overview,
    genres: c.genres,
    notes: c.notes,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    dubLanguage: null,
    originalYear: null,
    trust: c.trust,
    trustReason: c.trustReason,
    userLocked: c.userLocked,
    liveStatus: 'UNKNOWN',
    livePlatforms: null,
    liveFirstSeenAt: null,
    liveCheckedAt: null,
    myRating: c.myRating,
    myReview: c.myReview,
    cinema: c,
  };
}

/** A World database title as a post item: platform = first service streaming it in India (or none). */
export function worldPostItem(w: WorldTitle): PostItem {
  return {
    id: w.id,
    title: w.title,
    contentType: w.kind,
    seasonNumber: null,
    language: w.language,
    platform: streamingIn(w)[0] || null,
    releaseDate: w.releaseDate,
    status: w.status,
    origin: 'MANUAL',
    sourceUrl: null,
    sourceName: null,
    headline: null,
    tmdbId: w.tmdbId,
    posterPath: w.posterPath,
    overview: w.overview,
    genres: w.genres,
    notes: w.notes,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
    dubLanguage: null,
    originalYear: w.year,
    trust: 'CONFIRMED',
    trustReason: null,
    userLocked: false,
    liveStatus: 'UNKNOWN',
    livePlatforms: null,
    liveFirstSeenAt: null,
    liveCheckedAt: null,
    myRating: w.myRating,
    myReview: w.myReview,
    world: w,
  };
}

export const WORLD_DOMAIN: PostDomain = {
  kind: 'world',
  images: (id, q) => apiFetch(`/world/titles/${id}/images${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(r => json<ImageResults>(r)),
  update: async (id, patch) => worldPostItem(await worldApi.update(id, patch as Partial<WorldTitle>)),
  draftReview: (id, body) =>
    apiFetch(`/world/titles/${id}/draft-review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => json<{ text: string; model: string }>(r)),
  aiCaption: body =>
    apiFetch('/world/ai/caption', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 0).then(r => json<AiCaptionCopy>(r)),
};

export const OTT_DOMAIN: PostDomain = {
  kind: 'ott',
  images: (id, q) => ottApi.images(id, q),
  update: (id, patch) => ottApi.update(id, patch as Partial<OttRelease>),
  draftReview: (id, body) => ottApi.draftReview(id, body),
  aiCaption: body => ottApi.aiCaption(body as Parameters<typeof ottApi.aiCaption>[0]),
};

export const CINEMA_DOMAIN: PostDomain = {
  kind: 'cinema',
  images: (id, q) => apiFetch(`/cinema/releases/${id}/images${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(r => json<ImageResults>(r)),
  update: async (id, patch) => cinemaPostItem(await cinemaApi.update(id, patch as Partial<CinemaRelease>)),
  draftReview: (id, body) =>
    apiFetch(`/cinema/releases/${id}/draft-review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => json<{ text: string; model: string }>(r)),
  /** No automatic retries: an AI call can take a while and a retry would just queue another. */
  aiCaption: body =>
    apiFetch('/cinema/ai/caption', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 0).then(r => json<AiCaptionCopy>(r)),
};
