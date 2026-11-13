import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KNOWN_PLATFORMS, LANGUAGE_LABELS } from './ott-text.util';

/**
 * Optional AI text (free Gemini key). Used only when you click an AI button. AI writes the *creative* parts
 * (hook, blurb, teasers, closing question); every fact on a post (title, platform, date, language, your rating
 * and review) is filled in by the app from verified data — never by the AI.
 */

// Fast first; slower "thinking" models as fallback. Override with OTT_AI_MODEL=model1,model2 in backend/.env.
const DEFAULT_MODELS = ['gemini-3.1-flash-lite-preview', 'gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-3-flash-preview'];

export const CAPTION_LANGUAGES: Record<string, string> = {
  en: 'English',
  tanglish: 'Tanglish (Tamil written in English letters, casual, the way Chennai Instagram writes)',
  ta: 'Tamil (Tamil script)',
  hi: 'Hindi (Devanagari)',
  te: 'Telugu (Telugu script)',
  ml: 'Malayalam (Malayalam script)',
  kn: 'Kannada (Kannada script)',
};
export const CAPTION_TONES: Record<string, string> = {
  hype: 'hype and punchy, high energy, like a movie-update page',
  friendly: 'warm and friendly, like recommending to a friend',
  informative: 'clear and informative, minimal slang',
  witty: 'witty and playful, light humour',
};

export interface CaptionCopyInput {
  /** OTT: single | weekly | picks. Cinema: single | weekly | month | now | postponed | picks. */
  kind: 'single' | 'weekly' | 'picks' | 'month' | 'now' | 'postponed';
  /** Which desk the titles come from (default OTT). */
  domain?: 'ott' | 'cinema' | 'world';
  releaseIds: string[];
  tone?: string;
  language?: string;
  rating?: number | null;
  review?: string;
  heading?: string;
}

export interface CaptionCopy {
  hook: string;
  blurb: string;
  teasers: Record<string, string>;
  closing: string;
  model: string;
  dropped: number;
}

/** The facts the AI is allowed to see, the same for OTT titles and cinema films. */
interface FactRow {
  id: string;
  title: string;
  contentType: string;
  seasonNumber: number | null;
  language: string | null;
  overview: string | null;
  platform: string | null;
}

/** In cinema posts, theatre words are true; streaming platforms never are. */
export const THEATRE = '__theatre__';

const CINEMA_CONTEXT: Record<string, string> = {
  single: 'This is a post about ONE film releasing in (or now playing in) theatres in India.',
  weekly: "This is a carousel of this week's new films in theatres in India.",
  month: "This is a carousel of this month's big theatrical releases in India.",
  now: 'This is a carousel of films now playing in theatres in India.',
  postponed: 'This is an update post: the release of these films in theatres has been moved to a new date. Keep it neutral and factual in mood, no speculation about reasons.',
  picks: 'This is a carousel of recommended films to watch in theatres.',
};

const WORLD_CONTEXT: Record<string, string> = {
  single: 'This is a recommendation post about ONE movie or series (it may be from any country and any year).',
  picks: 'This is a carousel recommending several movies/series (from any country and any year), ranked.',
};

const MONTHS = /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/i;
const DATE_LIKE = /\b\d{1,2}(st|nd|rd|th)?\s*(\/|-|\.)\s*\d{1,2}\b|\b\d{1,2}(st|nd|rd|th)\b|\b(today|tomorrow|tonight|this (friday|saturday|sunday|week(end)?)|next week)\b/i;

/**
 * Drop an AI line that states a fact we didn't give it: a platform other than the verified one, or a date/day.
 * (Dates and platforms on posts must come from verified data only.)
 */
export function safeAiLine(text: unknown, allowedPlatforms: string[], max = 220): string {
  if (typeof text !== 'string') return '';
  let t = text.replace(/#[\p{L}\p{N}_]+/gu, '').replace(/\s+/g, ' ').trim().replace(/^["“']|["”']$/g, '');
  if (!t) return '';
  const allowed = allowedPlatforms.map(p => p.toLowerCase());
  const platformAlias: Array<[RegExp, string]> = [
    ...KNOWN_PLATFORMS.map(p => [new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')}\\b`, 'i'), p.toLowerCase()] as [RegExp, string]),
    [/\b(amazon\s*prime|prime)\b/i, 'prime video'],
    [/\b(hotstar|disney\+?\s*hotstar|jiocinema)\b/i, 'jiohotstar'],
    [/\btheat(er|re)s?\b|\bcinemas?\b|\bbig screen\b/i, '__theatre__'],
  ];
  for (const [re, name] of platformAlias) if (re.test(t) && !allowed.includes(name)) return '';
  if (MONTHS.test(t) || DATE_LIKE.test(t)) return '';
  if (t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return t;
}

@Injectable()
export class OttAiService {
  private readonly logger = new Logger(OttAiService.name);
  fetchImpl: typeof fetch = (...a) => fetch(...a);

  constructor(private readonly prisma: PrismaService) {}

  private models(): string[] {
    const env = process.env.OTT_AI_MODEL?.split(',').map(s => s.trim()).filter(Boolean) || [];
    return [...new Set([...env, ...DEFAULT_MODELS])];
  }

  /** Calls Gemini, falling back across models when one is overloaded/unavailable. */
  async generate(prompt: string, opts: { json?: boolean; maxTokens?: number; temperature?: number } = {}): Promise<{ text: string; model: string }> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new ServiceUnavailableException('AI is off: add a free GEMINI_API_KEY (aistudio.google.com) to backend/.env and restart.');
    const errors: string[] = [];
    for (const model of this.models()) {
      try {
        const res = await this.fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: opts.temperature ?? 0.8,
              maxOutputTokens: opts.maxTokens ?? 1200,
              ...(opts.json ? { responseMimeType: 'application/json' } : {}),
            },
          }),
          signal: AbortSignal.timeout(/lite/.test(model) ? 25000 : 50000),
        });
        const body: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          errors.push(`${model}: ${body?.error?.message?.slice(0, 80) || `HTTP ${res.status}`}`);
          if ([400, 401, 403].includes(res.status) && !/model/i.test(body?.error?.message || '')) break; // key problem — other models won't help
          continue;
        }
        const text: string = (body?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('').trim();
        if (text) return { text, model };
        errors.push(`${model}: empty reply`);
      } catch (err: any) {
        errors.push(`${model}: ${err.name === 'TimeoutError' ? 'timed out' : err.message}`);
      }
    }
    this.logger.warn(`[AI] all models failed: ${errors.join(' | ')}`);
    throw new ServiceUnavailableException(`AI is busy or unavailable right now — try again in a minute. (${errors[0] || 'no model answered'})`);
  }

  private async factRows(ids: string[], domain: 'ott' | 'cinema' | 'world'): Promise<FactRow[]> {
    if (domain === 'world') {
      const titles = await this.prisma.worldTitle.findMany({ where: { id: { in: ids } } });
      return titles.map(t => ({ id: t.id, title: t.year ? `${t.title} (${t.year})` : t.title, contentType: t.kind, seasonNumber: null, language: t.language, overview: t.overview, platform: null }));
    }
    if (domain !== 'cinema') return this.prisma.ottRelease.findMany({ where: { id: { in: ids } } });
    const films = await this.prisma.cinemaRelease.findMany({ where: { id: { in: ids } } });
    return films.map(f => ({ id: f.id, title: f.title, contentType: 'movie', seasonNumber: null, language: f.language, overview: f.overview, platform: null }));
  }

  async captionCopy(input: CaptionCopyInput): Promise<CaptionCopy> {
    const ids = (input.releaseIds || []).slice(0, 20);
    if (!ids.length) throw new BadRequestException('Choose at least one title');
    const cinema = input.domain === 'cinema';
    const world = input.domain === 'world';
    const rows = await this.factRows(ids, input.domain || 'ott');
    const releases = ids.map(id => rows.find(r => r.id === id)).filter(Boolean) as FactRow[];
    if (!releases.length) throw new BadRequestException('Titles not found');

    const lang = CAPTION_LANGUAGES[input.language || 'en'] || CAPTION_LANGUAGES.en;
    const tone = CAPTION_TONES[input.tone || 'hype'] || CAPTION_TONES.hype;
    const facts = releases
      .map((r, i) =>
        [
          `[${i + 1}] ${r.title}${r.contentType === 'tv' ? ` (series${r.seasonNumber ? ` season ${r.seasonNumber}` : ''})` : ' (movie)'}`,
          r.language ? `language: ${LANGUAGE_LABELS[r.language] || r.language}` : '',
          `official synopsis: ${r.overview?.trim() || '(none — do not describe the plot)'}`,
        ]
          .filter(Boolean)
          .join(' | '),
      )
      .join('\n');
    const single = input.kind === 'single';
    const reviewer =
      single && (input.rating != null || input.review?.trim())
        ? `\nThe creator's own verdict (match its mood, never contradict it, do not repeat the number): ${input.rating != null ? `${input.rating}/5. ` : ''}${input.review?.trim() || ''}`
        : '';

    const prompt =
      `You write Instagram captions for an Indian movie/OTT page. Write in ${lang}. Tone: ${tone}.\n` +
      `${world ? `${WORLD_CONTEXT[input.kind] || WORLD_CONTEXT.picks}${input.heading ? ` The post is titled "${input.heading}".` : ''}` : cinema ? `${CINEMA_CONTEXT[input.kind] || CINEMA_CONTEXT.weekly}${input.heading ? ` The post is titled "${input.heading}".` : ''}` : single ? 'This is a post about ONE title.' : input.kind === 'picks' ? `This is a carousel of recommended titles${input.heading ? ` titled "${input.heading}"` : ''}.` : 'This is a carousel of this week\'s OTT releases.'}\n\n` +
      `TITLES:\n${facts}${reviewer}\n\n` +
      `STRICT RULES:\n` +
      `- EVERY line (hook, blurb, each teaser, closing) must be written in ${lang} — translate the synopsis ideas, never copy English sentences.\n` +
      `- Use ONLY the synopsis text above for story details. Never invent cast, crew, plot twists, box office, awards, ratings or quotes.\n` +
      (cinema
        ? `- NEVER mention any streaming/OTT platform, release date, month, day of the week, or "today/tomorrow" — the app adds those facts itself. You MAY say theatres / big screen.\n`
        : `- NEVER mention any streaming platform, theatre, release date, day of the week, or "today/tomorrow" — the app adds those facts itself.\n`) +
      `- No hashtags. At most one emoji per line.\n` +
      `- If a title has no synopsis, its teaser must be about the mood only (e.g. "Perfect weekend family watch") or an empty string.\n\n` +
      `Return JSON only:\n` +
      `{"hook": "attention-grabbing first line, max 90 characters",` +
      (single ? ` "blurb": "2 short sentences about the title from the synopsis${reviewer ? ', in the mood of the creator\'s verdict' : ''}, max 260 characters",` : ` "teasers": {"1": "one-line teaser for title [1], max 80 characters", "2": "…"},`) +
      ` "closing": "one engaging question to the audience, max 90 characters"}`;

    const { text, model } = await this.generate(prompt, { json: true, maxTokens: 1500 });
    let parsed: any;
    try {
      parsed = JSON.parse(text.replace(/^```(json)?\s*|\s*```$/g, ''));
    } catch {
      throw new ServiceUnavailableException('AI returned an unreadable answer — try again.');
    }

    // World posts: the app adds "where to watch" itself, so the AI may not name any platform.
    const allPlatforms = cinema ? [THEATRE] : world ? [] : (releases.map(r => r.platform).filter(Boolean) as string[]);
    let dropped = 0;
    const keep = (t: unknown, platforms: string[], max?: number) => {
      const s = safeAiLine(t, platforms, max);
      if (!s && typeof t === 'string' && t.trim()) dropped++;
      return s;
    };
    const teasers: Record<string, string> = {};
    if (!single) {
      releases.forEach((r, i) => {
        const s = keep(parsed?.teasers?.[String(i + 1)], cinema ? [THEATRE] : world ? [] : r.platform ? [r.platform] : [], 100);
        if (s) teasers[r.id] = s;
      });
    }
    const out: CaptionCopy = {
      hook: keep(parsed?.hook, allPlatforms, 110),
      blurb: single ? keep(parsed?.blurb, allPlatforms, 320) : '',
      teasers,
      closing: keep(parsed?.closing, allPlatforms, 110),
      model,
      dropped,
    };
    if (!out.hook && !out.blurb && !out.closing && !Object.keys(teasers).length) throw new ServiceUnavailableException('AI text didn’t pass the accuracy check — try again.');
    return out;
  }

  /** Optional AI draft of your review text (never the rating). */
  async draftReview(id: string, input: { rating?: number | null; notes?: string; tone?: string }, domain: 'ott' | 'cinema' | 'world' = 'ott') {
    const [r] = await this.factRows([id], domain);
    if (!r) throw new BadRequestException(domain === 'cinema' ? 'Film not found' : 'OTT release not found');
    const facts = [
      `Title: ${r.title}${r.contentType === 'tv' ? ' (series)' : ' (movie)'}`,
      r.language ? `Language: ${LANGUAGE_LABELS[r.language] || r.language}` : '',
      r.overview ? `Official synopsis: ${r.overview}` : '',
      input.rating != null ? `The reviewer's own rating: ${input.rating}/5` : '',
      input.notes?.trim() ? `The reviewer's own notes (use these as the opinion): ${input.notes.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const prompt =
      `Write a short Instagram movie-review blurb (max 280 characters, 2-3 sentences, ${input.tone || 'friendly and punchy'}) for an Indian audience.\n` +
      `Rules: use ONLY the facts below. Do not invent cast, plot twists, box office, awards or quotes. Do not mention streaming platforms or dates.${domain === 'cinema' ? ' This film is in theatres.' : ''} ` +
      `Match the opinion to the reviewer's rating and notes. Do not write the rating number. No hashtags.\n\n${facts}`;
    const { text, model } = await this.generate(prompt, { maxTokens: 600, temperature: 0.7 });
    return { text: text.replace(/^["“]|["”]$/g, '').trim().slice(0, 400), model };
  }
}
