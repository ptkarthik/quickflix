import { BadRequestException, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import {
  Credit, Event, Scope, WdPerson, indiaDatesQuery, industryOf, isMilestone, knownFor, parseDateParam, parseIndiaDates, parsePeople, peopleQuery, yearsSince,
} from './onthisday.util';

const DIR = path.join(process.cwd(), 'data', 'onthisday');
const STALE_DAYS = 14;
const UA = 'CineAIStudio/1.0 (personal Instagram tool; contact via GitHub)';

export interface Person extends WdPerson {
  event: Event;
  profile: string | null;
  images: string[];
  knownFor: Credit[];
  industry: string | null;
  department: string | null;
  tmdbBirth: string | null;
  tmdbDeath: string | null;
}
interface DayCache { mmdd: string; fetchedAt: string; people: Person[]; errors: string[] }

/** Film people's birthdays / death anniversaries and film anniversaries for any date. Prepared in the background. */
@Injectable()
export class OnThisDayService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OnThisDayService.name);
  private queue: string[] = [];
  private working: string | null = null;
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    // Today + the next week, so you can plan ahead. Re-checked every 6 h (only stale days are refetched).
    const plan = () => {
      for (let i = 0; i < 8; i++) this.enqueue(parseDateParam(new Date(Date.now() + i * 86400000).toISOString().slice(0, 10)).mmdd);
    };
    this.timers.push(setTimeout(plan, 90000), setInterval(plan, 6 * 3600000));
  }
  onModuleDestroy() {
    this.timers.forEach(t => clearTimeout(t));
  }

  private file = (mmdd: string) => path.join(DIR, `${mmdd}.json`);
  private read(mmdd: string): DayCache | null {
    try {
      return JSON.parse(fs.readFileSync(this.file(mmdd), 'utf8'));
    } catch {
      return null;
    }
  }
  private fresh = (c: DayCache | null) => !!c && Date.now() - new Date(c.fetchedAt).getTime() < STALE_DAYS * 86400000;

  private enqueue(mmdd: string, force = false, front = false) {
    if (!force && this.fresh(this.read(mmdd))) return;
    if (this.working === mmdd || this.queue.includes(mmdd)) return;
    if (front) this.queue.unshift(mmdd);
    else this.queue.push(mmdd);
    void this.pump();
  }
  private async pump() {
    if (this.working) return;
    while (this.queue.length) {
      this.working = this.queue.shift()!;
      try {
        await this.prepare(this.working);
      } catch (e) {
        this.logger.warn(`[OnThisDay] ${this.working} failed: ${(e as Error).message}`);
      }
      this.working = null;
    }
  }

  private async sparql(query: string, timeoutMs = 90000): Promise<any> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch('https://query.wikidata.org/sparql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json', 'User-Agent': UA },
        body: new URLSearchParams({ query }).toString(),
        signal: AbortSignal.timeout(timeoutMs),
      }).catch(e => ({ ok: false, status: 0, statusText: String(e?.message || e) }) as any);
      if (res.ok) return res.json();
      if (attempt === 0 && (res.status === 429 || res.status >= 500 || res.status === 0)) {
        await new Promise(r => setTimeout(r, 15000));
        continue;
      }
      throw new Error(`Wikidata ${res.status || ''} ${res.statusText || ''}`.trim());
    }
  }

  private async tmdb(pathQ: string): Promise<any> {
    const key = process.env.TMDB_API_KEY;
    if (!key) return null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(`https://api.themoviedb.org/3/${pathQ}${pathQ.includes('?') ? '&' : '?'}api_key=${key}`, { signal: AbortSignal.timeout(20000) }).catch(() => null);
      if (r?.ok) return r.json();
      if (r && r.status === 404) return null;
      await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
    }
    return null;
  }

  private async enrich(p: WdPerson, event: Event): Promise<Person> {
    let id = p.tmdbId;
    if (!id && p.imdbId) id = (await this.tmdb(`find/${p.imdbId}?external_source=imdb_id`))?.person_results?.[0]?.id || null;
    const t = id ? await this.tmdb(`person/${id}?append_to_response=combined_credits,images`) : null;
    return {
      ...p,
      event,
      tmdbId: id,
      profile: t?.profile_path || null,
      images: (t?.images?.profiles || []).slice(0, 8).map((i: any) => i.file_path),
      knownFor: t ? knownFor(t.combined_credits) : [],
      industry: t ? industryOf(t.combined_credits) : null,
      department: t?.known_for_department || null,
      tmdbBirth: t?.birthday || null,
      tmdbDeath: t?.deathday || null,
    };
  }

  /** Fetch + cache one calendar day (about 2–3 min: four Wikidata queries, then TMDB for each person). */
  private async prepare(mmdd: string) {
    const [month, day] = mmdd.split('-').map(Number);
    const t0 = Date.now();
    const errors: string[] = [];
    const found: Array<{ p: WdPerson; event: Event }> = [];
    const jobs: Array<[Scope, Event]> = [['india', 'birth'], ['india', 'death'], ['world', 'birth'], ['world', 'death']];
    for (const [scope, event] of jobs) {
      try {
        const people = parsePeople(await this.sparql(peopleQuery(month, day, scope, event)), scope);
        for (const p of people) if (!found.some(f => f.p.wikidataId === p.wikidataId && f.event === event)) found.push({ p, event });
      } catch (e) {
        errors.push(`${scope} ${event === 'birth' ? 'birthdays' : 'remembering'}: ${(e as Error).message}`);
      }
    }
    // Keep it focused: best known first, capped per group.
    const keep = [
      ...found.filter(f => f.p.scope === 'india' && f.event === 'birth').slice(0, 40),
      ...found.filter(f => f.p.scope === 'india' && f.event === 'death').slice(0, 20),
      ...found.filter(f => f.p.scope === 'world' && f.event === 'birth').slice(0, 25),
      ...found.filter(f => f.p.scope === 'world' && f.event === 'death').slice(0, 15),
    ];
    const people: Person[] = [];
    for (let i = 0; i < keep.length; i += 3) {
      people.push(...(await Promise.all(keep.slice(i, i + 3).map(f => this.enrich(f.p, f.event)))));
    }
    fs.mkdirSync(DIR, { recursive: true });
    const cache: DayCache = { mmdd, fetchedAt: new Date().toISOString(), people, errors };
    // Don't overwrite a good day with an empty failed one.
    if (people.length || !this.read(mmdd)) fs.writeFileSync(this.file(mmdd), JSON.stringify(cache));
    this.logger.log(`[OnThisDay] ${mmdd}: ${people.length} people in ${Math.round((Date.now() - t0) / 1000)} s${errors.length ? ` (${errors.join('; ')})` : ''}`);
  }

  async get(dateParam?: string) {
    let d: ReturnType<typeof parseDateParam>;
    try {
      d = parseDateParam(dateParam);
    } catch {
      throw new BadRequestException('Date must be YYYY-MM-DD');
    }
    const cache = this.read(d.mmdd);
    if (!this.fresh(cache)) this.enqueue(d.mmdd, false, true);
    const people = (cache?.people || []).map(p => {
      const ref = p.event === 'birth' ? p.birth : p.death;
      const tmdbRef = p.event === 'birth' ? p.tmdbBirth : p.tmdbDeath;
      return {
        ...p,
        years: yearsSince(ref, d.year),
        age: p.event === 'birth' ? yearsSince(p.birth, d.year) : null, // turns N (or "would have turned")
        ageAtDeath: p.birth && p.death ? ageOn(p.birth, p.death) : null,
        sourcesAgree: tmdbRef == null ? null : tmdbRef === ref,
      };
    });
    return {
      date: d.iso,
      ready: !!cache,
      preparing: this.working === d.mmdd || this.queue.includes(d.mmdd),
      fetchedAt: cache?.fetchedAt || null,
      errors: cache?.errors || [],
      birthdays: people.filter(p => p.event === 'birth' && (p.years ?? 0) > 0),
      remembering: people.filter(p => p.event === 'death' && (p.years ?? 0) >= 0),
      films: await this.films(d),
    };
  }

  refresh(dateParam?: string) {
    const d = parseDateParam(dateParam);
    this.enqueue(d.mmdd, true, true);
    return { queued: d.mmdd };
  }

  /** Films / series first released on this day in earlier years (from the World table), best known first. */
  private async films(d: ReturnType<typeof parseDateParam>) {
    const rows = await this.prisma.worldTitle.findMany({
      where: { releaseDate: { endsWith: `-${d.mmdd}` }, year: { lt: d.year } },
      orderBy: [{ scoreVotes: { sort: 'desc', nulls: 'last' } }],
      take: 150,
      select: {
        id: true, kind: true, tmdbId: true, imdbId: true, title: true, year: true, releaseDate: true, language: true, genres: true, posterPath: true,
        backdropPath: true, score: true, scoreSource: true, scoreVotes: true, status: true, people: true, overview: true, imdbType: true,
      },
    });
    const list = rows.filter(r => r.kind === 'tv' || !r.imdbType || r.imdbType === 'movie').map(r => ({ ...r, years: yearsSince(r.releaseDate, d.year) }));
    // Cross-check release dates with Wikidata for the best known films — TMDB's date is sometimes a premiere or another
    // country's date, so the anniversary may really be another day (and India's date may differ).
    const top = list.filter(r => r.imdbId).slice(0, 60);
    let wd = new Map<string, { india: string | null; dates: string[] }>();
    if (top.length) {
      try {
        wd = parseIndiaDates(await this.sparql(indiaDatesQuery(top.map(r => r.imdbId!)), 30000));
      } catch {}
    }
    return list.map(r => {
      const w = r.imdbId ? wd.get(r.imdbId) : undefined;
      const indiaDate = w?.india || null;
      return {
        ...r,
        milestone: isMilestone(r.years),
        indiaDate,
        indiaDiffers: !!indiaDate && indiaDate !== r.releaseDate,
        // null = not checked; false = Wikidata lists release dates but none on this day
        dateConfirmed: w ? w.dates.includes(r.releaseDate || '') : null,
        otherDates: w && !w.dates.includes(r.releaseDate || '') ? w.dates.slice(0, 4) : [],
      };
    });
  }
}

function ageOn(birth: string, on: string) {
  let a = Number(on.slice(0, 4)) - Number(birth.slice(0, 4));
  if (on.slice(5) < birth.slice(5)) a--;
  return a;
}
