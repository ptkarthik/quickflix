import type { WorldFilter, WorldKind } from './world';

/**
 * Ready-made recommendation lists — the formats movie pages usually post
 * ("Top 3 crime movies", "Hidden gems", "Best K-dramas", "Best on Netflix India"…).
 * Each is just filters + a heading; ranking is by the labelled rating (IMDb when known, else TMDB),
 * with a minimum number of TMDB votes so obscure titles with a handful of votes don't top the list.
 */
export interface ListPreset {
  id: string;
  group: PresetGroup;
  emoji: string;
  label: string;
  kind: WorldKind;
  n: number;
  /** "{n}" is replaced with the number of titles. */
  heading: string;
  filter: WorldFilter;
}

export type PresetGroup = 'Movie genres' | 'Series' | 'All-time & years' | 'World cinema' | 'Indian cinema' | 'Special picks' | 'Where to watch';
export const PRESET_GROUPS: PresetGroup[] = ['Movie genres', 'Series', 'All-time & years', 'World cinema', 'Indian cinema', 'Special picks', 'Where to watch'];

const MOVIE = { minVotes: '500', minRating: '6.5' };
const SERIES = { minVotes: '150', minRating: '7' };
const INDIAN = { minVotes: '20', minRating: '6.5' };

export function listPresets(year: number): ListPreset[] {
  const m = (id: string, emoji: string, label: string, heading: string, filter: WorldFilter, n = 3): ListPreset => ({ id, group: 'Movie genres', emoji, label, kind: 'movie', n, heading, filter: { ...MOVIE, ...filter } });
  const s = (id: string, emoji: string, label: string, heading: string, filter: WorldFilter, n = 5): ListPreset => ({ id, group: 'Series', emoji, label, kind: 'tv', n, heading, filter: { ...SERIES, ...filter } });
  const p = (group: PresetGroup, kind: WorldKind, id: string, emoji: string, label: string, heading: string, filter: WorldFilter, n = 5): ListPreset => ({ id, group, emoji, label, kind, n, heading, filter });
  return [
    // ── movie genres ──
    m('crime', '🕵️', 'Crime', 'Top {n} Crime Movies', { genre: 'Crime' }),
    m('action', '💥', 'Action', 'Top {n} Action Movies', { genre: 'Action' }),
    m('thriller', '🔪', 'Thriller', 'Top {n} Thriller Movies', { genre: 'Thriller' }),
    m('crime-thriller', '🚔', 'Crime thrillers', 'Top {n} Crime Thrillers', { genre: 'Crime,Thriller' }),
    m('horror', '👻', 'Horror', 'Top {n} Horror Movies', { genre: 'Horror' }),
    m('comedy', '😂', 'Comedy', 'Top {n} Comedy Movies', { genre: 'Comedy' }),
    m('scifi', '🚀', 'Sci-Fi', 'Top {n} Sci-Fi Movies', { genre: 'Science Fiction' }),
    m('mind-bending', '🌀', 'Mind-bending', '{n} Mind-Bending Movies', { genre: 'Science Fiction,Mystery|Thriller' }),
    m('mystery', '🔍', 'Mystery', 'Top {n} Mystery Movies', { genre: 'Mystery' }),
    m('romance', '💖', 'Romance', 'Top {n} Romantic Movies', { genre: 'Romance' }),
    m('animation', '🎨', 'Animation', 'Top {n} Animated Movies', { genre: 'Animation' }),
    m('war', '🎖️', 'War', 'Top {n} War Movies', { genre: 'War' }),
    m('adventure', '🧭', 'Adventure', 'Top {n} Adventure Movies', { genre: 'Adventure' }),
    m('fantasy', '🐉', 'Fantasy', 'Top {n} Fantasy Movies', { genre: 'Fantasy' }),
    m('feel-good', '🌈', 'Feel-good', '{n} Feel-Good Movies', { genre: 'Comedy|Family', excludeGenre: 'Horror,Crime,War,Thriller' }, 5),
    m('family', '👨‍👩‍👧', 'Family night', '{n} Movies for Family Night', { genre: 'Family', excludeGenre: 'Horror' }, 5),
    m('history', '📜', 'True history', '{n} Movies Based on History', { genre: 'History' }, 5),

    // ── series ──
    s('s-crime', '🕵️', 'Crime series', 'Top {n} Crime Series', { genre: 'Crime' }),
    s('s-mystery', '🔍', 'Mystery series', 'Top {n} Mystery Series', { genre: 'Mystery' }),
    s('s-scifi', '🚀', 'Sci-Fi & Fantasy', 'Top {n} Sci-Fi & Fantasy Series', { genre: 'Sci-Fi & Fantasy' }),
    s('s-action', '💥', 'Action series', 'Top {n} Action & Adventure Series', { genre: 'Action & Adventure' }),
    s('s-comedy', '😂', 'Comedy series', 'Top {n} Comedy Series', { genre: 'Comedy' }),
    s('s-drama', '🎭', 'Drama series', 'Top {n} Drama Series', { genre: 'Drama', excludeGenre: 'Animation' }),
    s('s-anime', '🎨', 'Animated series', 'Top {n} Animated Series', { genre: 'Animation' }),
    s('s-kdrama', '🇰🇷', 'K-dramas', 'Top {n} K-Dramas', { language: 'ko' }),
    s('s-binge', '📺', 'Binge in a weekend', '{n} Series You Can Binge in a Weekend', { maxSeasons: '1' }),
    s('s-short', '⏱️', '2 seasons or less', '{n} Short Series Worth Your Time', { maxSeasons: '2' }),

    // ── all-time & by year ──
    p('All-time & years', 'movie', 'goat-movies', '🏆', 'Greatest movies ever', 'Top {n} Movies of All Time', { minVotes: '5000' }, 10),
    p('All-time & years', 'tv', 'goat-series', '🏆', 'Greatest series ever', 'Top {n} Series of All Time', { minVotes: '1500' }, 10),
    p('All-time & years', 'movie', 'this-year', '🆕', `Best of ${year}`, `Best {n} Movies of ${year}`, { yearFrom: String(year), yearTo: String(year), minVotes: '50' }),
    p('All-time & years', 'movie', 'last-year', '📅', `Best of ${year - 1}`, `Best {n} Movies of ${year - 1}`, { yearFrom: String(year - 1), yearTo: String(year - 1), minVotes: '100' }),
    p('All-time & years', 'tv', 'this-year-tv', '🆕', `Series of ${year}`, `Best {n} Series of ${year}`, { yearFrom: String(year), yearTo: String(year), minVotes: '20' }),
    p('All-time & years', 'movie', '2010s', '📀', 'Best of the 2010s', 'Top {n} Movies of the 2010s', { yearFrom: '2010', yearTo: '2019', minVotes: '1000' }),
    p('All-time & years', 'movie', '2000s', '💿', 'Best of the 2000s', 'Top {n} Movies of the 2000s', { yearFrom: '2000', yearTo: '2009', minVotes: '1000' }),
    p('All-time & years', 'movie', '90s', '📼', '90s classics', 'Top {n} 90s Classics', { yearFrom: '1990', yearTo: '1999', minVotes: '1000' }),
    p('All-time & years', 'movie', 'classics', '🎞️', 'Golden-age classics', '{n} Timeless Classics (Before 1980)', { yearTo: '1979', minVotes: '500' }),

    // ── world cinema ──
    p('World cinema', 'movie', 'ko', '🇰🇷', 'Korean movies', 'Top {n} Korean Movies', { language: 'ko', minVotes: '300' }),
    p('World cinema', 'movie', 'ko-thriller', '🇰🇷', 'Korean thrillers', 'Top {n} Korean Thrillers', { language: 'ko', genre: 'Thriller|Crime', minVotes: '200' }),
    p('World cinema', 'movie', 'ja-anime', '🇯🇵', 'Anime movies', 'Top {n} Anime Movies', { language: 'ja', genre: 'Animation', minVotes: '300' }),
    p('World cinema', 'movie', 'ja', '🇯🇵', 'Japanese (live action)', 'Top {n} Japanese Movies', { language: 'ja', excludeGenre: 'Animation', minVotes: '200' }),
    p('World cinema', 'movie', 'es', '🇪🇸', 'Spanish-language', 'Top {n} Spanish-Language Movies', { language: 'es', minVotes: '300' }),
    p('World cinema', 'movie', 'fr', '🇫🇷', 'French', 'Top {n} French Movies', { language: 'fr', minVotes: '300' }),
    p('World cinema', 'movie', 'it', '🇮🇹', 'Italian', 'Top {n} Italian Movies', { language: 'it', minVotes: '300' }),
    p('World cinema', 'movie', 'zh', '🇨🇳', 'Chinese', 'Top {n} Chinese Movies', { language: 'zh,cn', minVotes: '200' }),
    p('World cinema', 'movie', 'de', '🇩🇪', 'German', 'Top {n} German Movies', { language: 'de', minVotes: '200' }),
    p('World cinema', 'movie', 'non-en', '🌍', 'Best non-English', 'Top {n} Non-English Movies', { language: 'ko,ja,fr,es,it,zh,cn,de,pt,ru,sv,fa,da,hi,ta,te,ml,tr', minVotes: '1000' }, 8),

    // ── Indian cinema (thin in the imported data — use “Fill from TMDB”) ──
    p('Indian cinema', 'movie', 'ta', '🎬', 'Tamil', 'Top {n} Tamil Movies', { language: 'ta', ...INDIAN }),
    p('Indian cinema', 'movie', 'ml', '🎬', 'Malayalam', 'Top {n} Malayalam Movies', { language: 'ml', ...INDIAN }),
    p('Indian cinema', 'movie', 'te', '🎬', 'Telugu', 'Top {n} Telugu Movies', { language: 'te', ...INDIAN }),
    p('Indian cinema', 'movie', 'hi', '🎬', 'Hindi', 'Top {n} Hindi Movies', { language: 'hi', ...INDIAN }),
    p('Indian cinema', 'movie', 'kn', '🎬', 'Kannada', 'Top {n} Kannada Movies', { language: 'kn', ...INDIAN }),
    p('Indian cinema', 'movie', 'ml-thriller', '🔪', 'Malayalam thrillers', 'Top {n} Malayalam Thrillers', { language: 'ml', genre: 'Thriller|Crime|Mystery', ...INDIAN }),
    p('Indian cinema', 'movie', 'ta-action', '💥', 'Tamil action', 'Top {n} Tamil Action Movies', { language: 'ta', genre: 'Action', ...INDIAN }),

    // ── special picks ──
    p('Special picks', 'movie', 'hidden-gems', '💎', 'Hidden gems', '{n} Hidden Gems You Probably Missed', { minRating: '7.3', minVotes: '150', maxVotes: '2000' }, 5),
    p('Special picks', 'tv', 'hidden-series', '💎', 'Underrated series', '{n} Underrated Series', { minRating: '7.5', minVotes: '50', maxVotes: '500' }, 5),
    p('Special picks', 'movie', 'short', '⏱️', 'Under 100 minutes', '{n} Great Movies Under 100 Minutes', { maxRuntime: '99', minVotes: '500', minRating: '7' }, 5),
    p('Special picks', 'movie', 'epic', '🏔️', 'Epic (2.5 h+)', '{n} Epic Movies Worth Every Minute', { minRuntime: '150', minVotes: '1000' }, 5),
    p('Special picks', 'movie', 'horror-night', '🕯️', 'Horror night', '{n} Movies for a Horror Night', { genre: 'Horror', minVotes: '300', minRating: '6.8' }, 5),
    p('Special picks', 'movie', 'date-night', '🍷', 'Date night', '{n} Date-Night Movies', { genre: 'Romance', excludeGenre: 'Horror,War', minVotes: '300' }, 5),

    // ── where to watch (India) ──
    p('Where to watch', 'movie', 'netflix', '🔴', 'Netflix India', 'Top {n} Movies on Netflix India', { provider: 'Netflix', minVotes: '300' }),
    p('Where to watch', 'movie', 'prime', '🔵', 'Prime Video', 'Top {n} Movies on Prime Video', { provider: 'Prime Video', minVotes: '300' }),
    p('Where to watch', 'movie', 'jiohotstar', '⭐', 'JioHotstar', 'Top {n} Movies on JioHotstar', { provider: 'JioHotstar', minVotes: '300' }),
    p('Where to watch', 'movie', 'sonyliv', '🟡', 'SonyLIV', 'Top {n} Movies on SonyLIV', { provider: 'SonyLIV', minVotes: '100' }),
    p('Where to watch', 'tv', 'netflix-tv', '🔴', 'Netflix series', 'Top {n} Series on Netflix India', { provider: 'Netflix', minVotes: '150' }),
    p('Where to watch', 'tv', 'prime-tv', '🔵', 'Prime Video series', 'Top {n} Series on Prime Video', { provider: 'Prime Video', minVotes: '100' }),
  ];
}

/** The filter a preset searches with (always ranked best-first). */
export const presetFilter = (p: ListPreset): WorldFilter => ({ ...p.filter, kind: p.kind, sort: 'score' });
