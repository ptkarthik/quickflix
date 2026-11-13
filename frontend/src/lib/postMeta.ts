import { languageLabel } from './ott';
import type { PostItem } from './postDomain';
import { certRuntime, languagesLine } from './cinemaCaptions';
import { genreList, langName, lengthLabel } from './world';

/** The pieces of a title's details line — each can be kept or removed on the picture. */
export type MetaPart = 'year' | 'language' | 'genre' | 'length' | 'cert' | 'type';
export interface MetaBit { key: MetaPart; text: string }
export const META_PART_LABEL: Record<MetaPart, string> = { year: 'Year', language: 'Language', genre: 'Genre', length: 'Running time / seasons', cert: 'Certificate', type: 'Movie / Series' };

export function metaBits(item: PostItem): MetaBit[] {
  const out: MetaBit[] = [];
  const add = (key: MetaPart, text?: string | number | null) => { if (text) out.push({ key, text: String(text) }); };
  const w = item.world;
  if (w) {
    add('year', w.year);
    add('language', langName(w.language));
    add('genre', genreList(w).join(', '));
    add('length', lengthLabel(w));
    return out;
  }
  const c = item.cinema;
  if (c) {
    add('language', languagesLine(item));
    add('cert', c.certificate);
    add('length', certRuntime({ ...item, cinema: { ...c, certificate: null } } as PostItem));
    return out;
  }
  add('language', languageLabel(item.language));
  add('type', item.contentType === 'tv' ? (item.seasonNumber && item.seasonNumber > 1 ? `Series • S${item.seasonNumber}` : 'Series') : 'Movie');
  return out;
}
