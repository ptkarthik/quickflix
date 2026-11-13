import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LANGUAGE_LABELS } from '../ott/ott-text.util';

/**
 * ✨ AI poster: new artwork made from the title's REAL poster/backdrop (as reference) + its genre and official synopsis.
 * Gemini image models — needs billing on the Gemini key (free keys have zero image quota). Every call is a paid
 * generation, so it only ever runs when you click the button, and the count is capped.
 */

const DEFAULT_MODELS = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image'];
const OUT_DIR = path.join(process.cwd(), 'uploads', 'ai-posters');

/** Visual direction per theme (kept in sync with the frontend theme ids). */
export const THEME_ART_DIRECTION: Record<string, string> = {
  mass: 'larger-than-life Indian mass-action style, dramatic low angle, sparks, smoke and fire, bold orange and black grading',
  thriller: 'tense neo-noir thriller mood, cold teal and steel-blue grading, hard shadows, rain and neon reflections',
  horror: 'eerie horror atmosphere, desaturated sickly green and deep black, fog, harsh rim light, unsettling negative space',
  romance: 'dreamy romantic mood, warm golden-hour light, soft bokeh, blush pink and peach tones',
  comedy: 'bright fun comedy energy, saturated sunny yellows and pops of colour, playful lively composition',
  family: 'warm feel-good family drama, soft natural light, cosy earthy tones, heartfelt and inviting',
  drama: 'grounded emotional drama, muted cinematic palette, intimate framing, gentle film grain',
  scifi: 'futuristic sci-fi / fantasy spectacle, neon cyan and magenta glow, volumetric light, epic scale',
  mythology: 'epic mythological devotional grandeur, divine golden light, temple silhouettes, saffron and deep maroon',
  animation: 'vibrant stylised animated-film look, clean shapes, rich saturated colours',
  sports: 'high-energy sports drama, stadium floodlights, motion blur, sweat and grit, triumphant mood',
  documentary: 'authentic documentary realism, natural light, restrained palette, photojournalistic framing',
  brand: 'premium cinematic key art, rich contrast, polished studio lighting',
};

export interface AiPosterInput {
  kind: 'ott' | 'cinema' | 'world';
  id: string;
  theme?: string;
  count?: number;
  /** restyle = new artwork based on the real poster; background = scenery/mood only (no people). */
  mode?: 'restyle' | 'background';
  extra?: string;
}

@Injectable()
export class AiPosterService {
  private readonly logger = new Logger(AiPosterService.name);
  fetchImpl: typeof fetch = (...a) => fetch(...a);

  constructor(private readonly prisma: PrismaService) {}

  private models() {
    const env = process.env.AI_IMAGE_MODEL?.split(',').map(s => s.trim()).filter(Boolean) || [];
    return [...new Set([...env, ...DEFAULT_MODELS])];
  }

  private async reference(posterPath: string | null): Promise<{ mime: string; data: string } | null> {
    if (!posterPath) return null;
    const url = /^https?:\/\//.test(posterPath) ? posterPath : `https://image.tmdb.org/t/p/w780${posterPath}`;
    try {
      const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 6 * 1024 * 1024) return null;
      return { mime: res.headers.get('content-type')?.split(';')[0] || 'image/jpeg', data: buf.toString('base64') };
    } catch {
      return null;
    }
  }

  buildPrompt(r: { title: string; contentType?: string; language?: string | null; overview?: string | null; genres?: string | null }, theme: string, mode: 'restyle' | 'background', hasRef: boolean, extra?: string) {
    const direction = THEME_ART_DIRECTION[theme] || THEME_ART_DIRECTION.brand;
    const about = [
      `${r.contentType === 'tv' ? 'Series' : 'Film'}: "${r.title}"${r.language ? ` (${LANGUAGE_LABELS[r.language] || r.language})` : ''}`,
      r.genres ? `Genres: ${r.genres}` : '',
      r.overview ? `Official synopsis: ${r.overview.slice(0, 600)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const task =
      mode === 'background'
        ? `Create atmospheric background key art that evokes this title's world and mood. Scenery, environment and props only — NO people, NO faces.`
        : hasRef
          ? `Create a fresh, premium social-media poster artwork inspired by the attached official poster: keep its characters as they appear there and its overall identity, but give it a new composition and the art direction below.`
          : `Create premium poster key art for this title. Do not depict any real, identifiable person.`;
    return [
      task,
      `Art direction: ${direction}.`,
      about,
      extra?.trim() ? `Extra direction from the creator: ${extra.trim().slice(0, 300)}` : '',
      `Format: vertical 4:5 portrait composition with calm space in the lower third for a title to be added later.`,
      `ABSOLUTELY NO text, letters, numbers, titles, logos, watermarks or credits anywhere in the image.`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  async generate(input: AiPosterInput): Promise<{ images: Array<{ url: string; model: string }>; prompt: string; failed: number }> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new ServiceUnavailableException('AI posters need a GEMINI_API_KEY with billing enabled in backend/.env.');
    const count = Math.max(1, Math.min(4, Number(input.count) || 2));
    const mode = input.mode === 'background' ? 'background' : 'restyle';
    const r: any =
      input.kind === 'cinema'
        ? await this.prisma.cinemaRelease.findUnique({ where: { id: input.id } })
        : input.kind === 'ott'
          ? await this.prisma.ottRelease.findUnique({ where: { id: input.id } })
          : input.kind === 'world'
            ? await this.prisma.worldTitle.findUnique({ where: { id: input.id } })
            : null;
    if (!r) throw new NotFoundException('Title not found');
    if (r.status !== 'APPROVED') throw new BadRequestException('Approve the title first — AI posters are only made for approved titles.');

    const ref = mode === 'restyle' ? await this.reference(r.posterPath) : null;
    const prompt = this.buildPrompt(r, input.theme || 'brand', mode, !!ref, input.extra);
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const images: Array<{ url: string; model: string }> = [];
    let lastError = '';
    let failed = 0;
    for (let i = 0; i < count; i++) {
      const out = await this.one(key, prompt, ref, i);
      if ('error' in out) {
        failed++;
        lastError = out.error;
        if (out.fatal) break; // billing/quota/key problem: don't keep trying (and don't keep paying)
        continue;
      }
      const file = `${input.kind}-${input.id.slice(0, 8)}-${randomUUID().slice(0, 8)}.${out.ext}`;
      fs.writeFileSync(path.join(OUT_DIR, file), out.buf);
      images.push({ url: `${process.env.PUBLIC_BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`}/uploads/ai-posters/${file}`, model: out.model });
    }
    this.logger.log(`[AI poster] ${r.title}: ${images.length}/${count} image(s)${lastError ? ` — last error: ${lastError}` : ''}`);
    if (!images.length) throw new ServiceUnavailableException(lastError || 'AI image generation failed — try again.');
    return { images, prompt, failed };
  }

  private async one(key: string, prompt: string, ref: { mime: string; data: string } | null, variant: number): Promise<{ buf: Buffer; ext: string; model: string } | { error: string; fatal: boolean }> {
    let lastError = 'no model answered';
    for (const model of this.models()) {
      try {
        const res = await this.fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [...(ref ? [{ inline_data: { mime_type: ref.mime, data: ref.data } }] : []), { text: `${prompt}\n\n(Variation ${variant + 1}: choose a distinct composition.)` }] }],
            generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '4:5' } },
          }),
          signal: AbortSignal.timeout(120000),
        });
        const body: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg: string = body?.error?.message || `HTTP ${res.status}`;
          if (res.status === 429 && /quota|billing|plan/i.test(msg)) {
            return { error: 'AI posters need billing on your Gemini key — free keys get zero image quota. Turn it on at aistudio.google.com → your API key → Set up billing, then try again.', fatal: true };
          }
          if (res.status === 400 && /api key/i.test(msg)) return { error: `Gemini key problem: ${msg}`, fatal: true };
          lastError = `${model}: ${msg.slice(0, 120)}`;
          continue; // model unavailable/overloaded → next model
        }
        const part = (body?.candidates?.[0]?.content?.parts || []).find((p: any) => p.inlineData || p.inline_data);
        const d = part?.inlineData || part?.inline_data;
        if (!d?.data) {
          const reason = body?.candidates?.[0]?.finishReason || body?.promptFeedback?.blockReason;
          lastError = `${model}: no image returned${reason ? ` (${reason})` : ''}`;
          continue;
        }
        const mime: string = d.mimeType || d.mime_type || 'image/png';
        return { buf: Buffer.from(d.data, 'base64'), ext: mime.includes('jpeg') ? 'jpg' : 'png', model };
      } catch (err: any) {
        lastError = `${model}: ${err.name === 'TimeoutError' ? 'timed out' : err.message}`;
      }
    }
    return { error: lastError, fatal: false };
  }
}
