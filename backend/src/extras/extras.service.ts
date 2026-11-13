import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CriticsService } from './critics.service';
import { PrismaService } from '../prisma/prisma.service';
import { OttAiService, THEATRE, safeAiLine, CAPTION_LANGUAGES, CAPTION_TONES } from '../ott/ott-ai.service';
import { LANGUAGE_LABELS } from '../ott/ott-text.util';
import { scoreFields } from '../world/world.util';
import { ImdbDatasetService } from '../world/imdb-dataset.service';
import { ExtRatings, linksFrom, parseAnilist, parseJikan, parseMdblist, parseTvmaze, parseWikidata, wikidataQuery } from './free-sources';
import { cleanOneLiner, firstSentence, parseOmdbFull, parseRatingsShown } from './extras.util';

export type ExtraDomain = 'ott' | 'cinema' | 'world';
const DOMAINS: ExtraDomain[] = ['ott', 'cinema', 'world'];
const UA = { 'User-Agent': 'CineAIStudio/1.0 (personal movie page tool; contact: local)', Accept: 'application/json' };

interface TitleMeta {
  title: string;
  kind: 'movie' | 'tv';
  tmdbId: number | null;
  imdbId: string | null;
  year: number | null;
  overview: string | null;
  genres: string | null;
  language: string | null;
}

/**
 * One-liners and ratings for posts, the same on every desk.
 * Web facts come from real sources only: TMDB (tagline), OMDb (IMDb / Rotten Tomatoes / Metacritic, plot, awards)
 * and Wikipedia — found through Wikidata by the title's IMDb id, so it is the right film.
 */
@Injectable()
export class ExtrasService {
  private readonly logger = new Logger(ExtrasService.name);
  fetchImpl: typeof fetch = (...a) => fetch(...a);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: OttAiService,
    private readonly imdbFile: ImdbDatasetService, private readonly critics: CriticsService) {}

  private domain(d: string): ExtraDomain {
    if (!DOMAINS.includes(d as ExtraDomain)) throw new BadRequestException('domain must be ott, cinema or world');
    return d as ExtraDomain;
  }

  private async meta(domain: ExtraDomain, id: string): Promise<TitleMeta> {
    if (domain === 'ott') {
      const r = await this.prisma.ottRelease.findUnique({ where: { id } });
      if (!r) throw new NotFoundException('Title not found');
      return { title: r.title, kind: r.contentType === 'tv' ? 'tv' : 'movie', tmdbId: r.tmdbId, imdbId: null, year: r.originalYear || (r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : null), overview: r.overview, genres: r.genres, language: r.language };
    }
    if (domain === 'cinema') {
      const r = await this.prisma.cinemaRelease.findUnique({ where: { id } });
      if (!r) throw new NotFoundException('Film not found');
      return { title: r.title, kind: 'movie', tmdbId: r.tmdbId, imdbId: null, year: r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : null, overview: r.overview, genres: r.genres, language: r.language };
    }
    const w = await this.prisma.worldTitle.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Title not found');
    return { title: w.title, kind: w.kind === 'tv' ? 'tv' : 'movie', tmdbId: w.tmdbId, imdbId: w.imdbId, year: w.year, overview: w.overview, genres: w.genres, language: w.language };
  }

  async get(domainIn: string, id: string) {
    const domain = this.domain(domainIn);
    const row = await this.prisma.titleExtra.findUnique({ where: { domain_refId: { domain, refId: id } } });
    return { ...(row || { domain, refId: id, oneLiner: null, oneLinerSource: null, ratingsShown: null }), criticChips: this.critics.chips(domain, id) };
  }

  /** Critics' ratings + one-liners from the web for this title (on your click; cached 3 days). */
  async criticReviews(domainIn: string, id: string, force = false) {
    const domain = this.domain(domainIn);
    const m = await this.meta(domain, id);
    const row = await this.prisma.titleExtra.findUnique({ where: { domain_refId: { domain, refId: id } } });
    return this.critics.get(domain, id, { title: m.title, year: m.year, kind: m.kind, language: m.language || null, wikiTitle: row?.wikiTitle || null }, force);
  }

  async batch(domainIn: string, ids: string[]) {
    const domain = this.domain(domainIn);
    const rows = await this.prisma.titleExtra.findMany({ where: { domain, refId: { in: (ids || []).slice(0, 100) } } });
    return Object.fromEntries(rows.map(r => [r.refId, { ...r, criticChips: this.critics.chips(domain, r.refId) }]));
  }

  async update(domainIn: string, id: string, body: { oneLiner?: string | null; oneLinerSource?: string | null; ratingsShown?: unknown; customRatingLabel?: string | null; customRatingValue?: string | null; criticPicks?: string[]; criticAverage?: boolean }) {
    const domain = this.domain(domainIn);
    await this.meta(domain, id); // must exist
    // critics you ticked (the panel sends the matching ratingsShown itself)
    if (body.criticPicks !== undefined || body.criticAverage !== undefined) {
      this.critics.setPicks(domain, id, Array.isArray(body.criticPicks) ? body.criticPicks.map(String) : undefined, body.criticAverage);
    }
    const data: Record<string, unknown> = {};
    if (body.oneLiner !== undefined) {
      data.oneLiner = cleanOneLiner(body.oneLiner);
      data.oneLinerSource = data.oneLiner ? cleanOneLiner(body.oneLinerSource, 20) || 'manual' : null;
    }
    if (body.ratingsShown !== undefined) {
      const keys = parseRatingsShown(body.ratingsShown);
      data.ratingsShown = keys ? JSON.stringify(keys) : null;
    }
    if (body.customRatingLabel !== undefined) data.customRatingLabel = cleanOneLiner(body.customRatingLabel, 30);
    if (body.customRatingValue !== undefined) data.customRatingValue = cleanOneLiner(body.customRatingValue, 20);
    const saved = await this.prisma.titleExtra.upsert({ where: { domain_refId: { domain, refId: id } }, create: { domain, refId: id, ...data }, update: data });
    return { ...saved, criticChips: this.critics.chips(domain, id) };
  }

  // ───────────────────────── web lookup ─────────────────────────

  /** GET JSON with one retry on network errors (APIs occasionally drop a connection). */
  private async getJson(url: string, headers: Record<string, string> = UA, init: { method?: string; body?: string; timeout?: number } = {}) {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await this.fetchImpl(url, { headers, method: init.method, body: init.body, signal: AbortSignal.timeout(init.timeout || 15000) });
        const body: any = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, body };
      } catch (e) {
        if (attempt >= 1) throw e;
        await new Promise(r => setTimeout(r, 1200));
      }
    }
  }

  /** Wikipedia page for an IMDb id (Wikidata property P345) → first sentence + link. */
  async wikipediaByImdb(imdbId: string): Promise<{ title: string; url: string; sentence: string | null } | null> {
    const s = await this.getJson(`https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`haswbstatement:P345=${imdbId}`)}&srlimit=1&format=json`);
    const qid = s.body?.query?.search?.[0]?.title;
    if (!qid) return null;
    const e = await this.getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks&sitefilter=enwiki&format=json`);
    const title = e.body?.entities?.[qid]?.sitelinks?.enwiki?.title;
    if (!title) return null;
    const sum = await this.getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
    if (!sum.ok) return null;
    return { title, url: sum.body?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`, sentence: firstSentence(sum.body?.extract) };
  }

  /** Fetch tagline (TMDB), ratings/plot/awards (OMDb) and Wikipedia's first sentence. Cached for 14 days unless forced. */
  async lookup(domainIn: string, id: string, force = false) {
    const domain = this.domain(domainIn);
    const m = await this.meta(domain, id);
    const existing = await this.prisma.titleExtra.findUnique({ where: { domain_refId: { domain, refId: id } } });
    const incomplete = !!existing?.webNote && /limit/i.test(existing.webNote); // OMDb was out of quota last time → try again
    if (!force && !incomplete && existing?.webCheckedAt && Date.now() - existing.webCheckedAt.getTime() < 14 * 86400000) return existing;

    const data: Record<string, unknown> = { webCheckedAt: new Date() };
    const notes: string[] = [];
    let imdbId = m.imdbId;

    const key = process.env.TMDB_API_KEY;
    if (m.tmdbId && key) {
      try {
        const t = await this.getJson(`https://api.themoviedb.org/3/${m.kind}/${m.tmdbId}?api_key=${key}&append_to_response=external_ids`, {});
        if (t.ok) {
          data.tagline = cleanOneLiner(t.body?.tagline, 200);
          imdbId = imdbId || t.body?.imdb_id || t.body?.external_ids?.imdb_id || null;
          if (t.body?.vote_count > 0) {
            data.tmdbRating = Math.round(t.body.vote_average * 10) / 10;
            data.tmdbVotes = t.body.vote_count;
          }
        }
      } catch (e: any) {
        notes.push(`TMDB: ${e.message}`);
      }
    } else if (!m.tmdbId) {
      notes.push('Not linked to TMDB — link it (Find poster) to look up ratings and one-liners.');
    }
    data.imdbId = imdbId;

    if (imdbId && process.env.OMDB_API_KEY) {
      try {
        const o = await this.getJson(`https://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&i=${encodeURIComponent(imdbId)}&plot=short`, {});
        if (/limit/i.test(o.body?.Error || '')) notes.push('OMDb daily limit reached — Rotten Tomatoes / Metacritic / plot / awards from OMDb will be fetched tomorrow (IMDb rating is unaffected).');
        const r = parseOmdbFull(o.body);
        if (r) Object.assign(data, { imdbRating: r.imdbRating, imdbVotes: r.imdbVotes, rtCritics: r.rtCritics, metascore: r.metascore, omdbPlot: r.plot, awards: r.awards });
      } catch (e: any) {
        notes.push(`OMDb: ${e.message}`);
      }
    } else if (!imdbId) {
      notes.push('No IMDb id yet (common for upcoming titles) — IMDb, Rotten Tomatoes, Metacritic and Wikipedia aren’t available.');
    }

    const ext: ExtRatings = {};
    if (imdbId) {
      // IMDb's own daily ratings file: fresher than OMDb and never out of quota
      const ir = await this.imdbFile.get(imdbId).catch(() => null);
      if (ir) Object.assign(data, { imdbRating: ir.rating, imdbVotes: ir.votes });

      let wd: ReturnType<typeof parseWikidata> = null;
      try {
        const q = await this.getJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(wikidataQuery(imdbId))}`, { ...UA, Accept: 'application/sparql-results+json' });
        wd = q.ok ? parseWikidata(q.body) : null;
      } catch (e: any) {
        notes.push(`Wikidata: ${e.message}`);
      }
      data.wikidataId = wd?.qid || null;
      data.links = JSON.stringify(linksFrom(imdbId, wd));
      // RT / Metacritic from Wikidata only when OMDb didn't give one (labelled "via Wikidata")
      if (wd?.rt != null && data.rtCritics == null) ext.rt = { label: 'Rotten Tomatoes', value: `${wd.rt}%`, via: 'Wikidata', url: wd.ids.rt ? `https://www.rottentomatoes.com/${wd.ids.rt}` : null };
      if (wd?.metacritic != null && data.metascore == null) ext.metacritic = { label: 'Metacritic', value: `${wd.metacritic}/100`, via: 'Wikidata', url: wd.ids.metacritic ? `https://www.metacritic.com/${wd.ids.metacritic}` : null };

      if (wd?.enwiki) {
        try {
          const title = wd.enwiki;
          const sum = await this.getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
          if (sum.ok) Object.assign(data, { wikiTitle: title, wikiUrl: sum.body?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`, wikiSentence: firstSentence(sum.body?.extract) });
        } catch (e: any) {
          notes.push(`Wikipedia: ${e.message}`);
        }
      }

      const jobs: Array<Promise<void>> = [];
      if (m.kind === 'tv') {
        jobs.push(
          this.getJson(`https://api.tvmaze.com/lookup/shows?imdb=${encodeURIComponent(imdbId)}`, UA, { timeout: 10000 }).then(r => {
            const t = r.ok ? parseTvmaze(r.body) : null;
            if (t?.rating) ext.tvmaze = { ...t.rating, label: t.channel ? `TVmaze (${t.channel})` : 'TVmaze' };
          }, () => undefined),
        );
      }
      const anilistId = wd?.ids.anilist;
      if (anilistId && /^\d+$/.test(anilistId)) {
        jobs.push(
          this.getJson('https://graphql.anilist.co', { 'Content-Type': 'application/json', Accept: 'application/json' }, {
            method: 'POST', timeout: 10000,
            body: JSON.stringify({ query: `{Media(id:${anilistId},type:ANIME){averageScore popularity siteUrl}}` }),
          }).then(r => {
            const a = r.ok ? parseAnilist(r.body) : null;
            if (a) ext.anilist = a;
          }, () => undefined),
        );
      }
      const malId = wd?.ids.mal;
      if (malId && /^\d+$/.test(malId)) {
        jobs.push(
          this.getJson(`https://api.jikan.moe/v4/anime/${malId}`, UA, { timeout: 8000 }).then(r => {
            const j = r.ok ? parseJikan(r.body) : null;
            if (j) ext.mal = j;
          }, () => undefined),
        );
      }
      if (process.env.MDBLIST_API_KEY) {
        jobs.push(
          this.getJson(`https://mdblist.com/api/?apikey=${process.env.MDBLIST_API_KEY}&i=${encodeURIComponent(imdbId)}`, UA, { timeout: 12000 }).then(r => {
            if (r.body?.response === false || r.body?.error) notes.push(`MDBList: ${r.body.error || 'no data'}`);
            for (const [k, v] of Object.entries(parseMdblist(r.body))) if (!ext[k]) ext[k] = v;
          }, () => undefined),
        );
      }
      await Promise.all(jobs);
    }
    data.extRatings = Object.keys(ext).length ? JSON.stringify(ext) : null;
    data.webNote = notes.join(' ') || null;

    // keep the World database's own rating columns in step
    if (domain === 'world') {
      const w = await this.prisma.worldTitle.findUnique({ where: { id } });
      if (w) {
        const next = {
          imdbRating: (data.imdbRating as number | null | undefined) ?? w.imdbRating,
          imdbVotes: (data.imdbVotes as number | null | undefined) ?? w.imdbVotes,
          rtCritics: (data.rtCritics as number | null | undefined) ?? w.rtCritics,
          metascore: (data.metascore as number | null | undefined) ?? w.metascore,
        };
        await this.prisma.worldTitle.update({
          where: { id },
          data: { ...next, imdbId: imdbId || w.imdbId, extRatings: (data.extRatings as string | null) ?? w.extRatings, ...(data.omdbPlot !== undefined ? { omdbCheckedAt: new Date() } : {}), ...scoreFields({ ...w, ...next }) },
        });
      }
    }
    const saved = await this.prisma.titleExtra.upsert({ where: { domain_refId: { domain, refId: id } }, create: { domain, refId: id, ...data }, update: data });
    return { ...saved, criticChips: this.critics.chips(domain, id) };
  }

  // ───────────────────────── AI one-liners ─────────────────────────

  /** Three short AI one-liners from the official synopsis. Never facts (no dates, platforms, ratings, cast). */
  async aiOneLiners(domainIn: string, id: string, input: { language?: string; tone?: string }) {
    const domain = this.domain(domainIn);
    const m = await this.meta(domain, id);
    if (!m.overview?.trim()) throw new BadRequestException('This title has no official synopsis yet, so AI can’t write a one-liner without guessing. Write your own or use a web line.');
    const lang = CAPTION_LANGUAGES[input.language || 'en'] || CAPTION_LANGUAGES.en;
    const tone = CAPTION_TONES[input.tone || 'hype'] || CAPTION_TONES.hype;
    const prompt =
      `Write 3 different one-liners for an Instagram movie/series post (they appear over the poster). Write in ${lang}. Tone: ${tone}.\n` +
      `Title: ${m.title}${m.year ? ` (${m.year})` : ''} — ${m.kind === 'tv' ? 'series' : 'movie'}${m.language ? `, ${LANGUAGE_LABELS[m.language] || m.language}` : ''}${m.genres ? `, ${m.genres}` : ''}\n` +
      `Official synopsis: ${m.overview.trim()}\n\n` +
      `RULES: each max 90 characters; use ONLY the synopsis for story details; no spoilers; never mention cast, crew, awards, box office, ratings, ` +
      `streaming platforms, release dates or days; no hashtags; at most one emoji each. Return JSON only: {"options": ["…", "…", "…"]}`;
    const { text, model } = await this.ai.generate(prompt, { json: true, maxTokens: 600, temperature: 0.9 });
    let parsed: any;
    try {
      parsed = JSON.parse(text.replace(/^```(json)?\s*|\s*```$/g, ''));
    } catch {
      throw new ServiceUnavailableException('AI returned an unreadable answer — try again.');
    }
    const allowed = domain === 'cinema' ? [THEATRE] : [];
    const options = (Array.isArray(parsed?.options) ? parsed.options : []).map((o: unknown) => safeAiLine(o, allowed, 110)).filter(Boolean).slice(0, 3);
    if (!options.length) throw new ServiceUnavailableException('AI lines didn’t pass the accuracy check — try again.');
    return { options, model };
  }
}
