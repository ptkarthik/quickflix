import { OttAiService, THEATRE, safeAiLine } from './ott-ai.service';

describe('safeAiLine (AI may never state platforms or dates)', () => {
  it('keeps creative lines', () => {
    expect(safeAiLine('Thalaivar is back and the swag is unreal 🔥', ['Prime Video'])).toBe('Thalaivar is back and the swag is unreal 🔥');
    expect(safeAiLine('Now on Prime Video — don’t miss it', ['Prime Video'])).toBe('Now on Prime Video — don’t miss it');
  });
  it('drops wrong platforms, theatres and any date/day', () => {
    expect(safeAiLine('Streaming on Netflix soon!', ['Prime Video'])).toBe('');
    expect(safeAiLine('Catch it on Hotstar', ['Prime Video'])).toBe('');
    expect(safeAiLine('Running in theatres now', ['Prime Video'])).toBe('');
    expect(safeAiLine('Arrives 21st November', ['Prime Video'])).toBe('');
    expect(safeAiLine('Watch it this Friday', ['Prime Video'])).toBe('');
    expect(safeAiLine('Out tomorrow!', ['Prime Video'])).toBe('');
  });
  it('strips hashtags and quotes', () => {
    expect(safeAiLine('"Pure mass" #Jailer2 #OTT', [])).toBe('Pure mass');
  });
});

describe('OttAiService.generate', () => {
  const env = { ...process.env };
  afterAll(() => (process.env = env));

  it('falls back to the next model when one is overloaded', async () => {
    process.env.GEMINI_API_KEY = 'k';
    delete process.env.OTT_AI_MODEL;
    const svc = new OttAiService({} as any);
    const tried: string[] = [];
    svc.fetchImpl = (async (url: string) => {
      const model = url.match(/models\/([^:]+):/)![1];
      tried.push(model);
      if (tried.length === 1) return { ok: false, status: 503, json: async () => ({ error: { message: 'high demand' } }) } as any;
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'hello' }] } }] }) } as any;
    }) as any;
    const out = await svc.generate('x');
    expect(out.text).toBe('hello');
    expect(tried).toHaveLength(2);
    expect(out.model).toBe(tried[1]);
  });

  it('caption copy: facts never come from AI; bad lines are dropped and counted', async () => {
    process.env.GEMINI_API_KEY = 'k';
    const prisma: any = {
      ottRelease: {
        findMany: async () => [
          { id: 'a', title: 'Jailer 2', contentType: 'movie', seasonNumber: null, language: 'ta', platform: 'Prime Video', overview: 'Muthuvel returns.' },
          { id: 'b', title: 'Playdate', contentType: 'movie', seasonNumber: null, language: 'en', platform: 'Prime Video', overview: null },
        ],
      },
    };
    const svc = new OttAiService(prisma);
    svc.fetchImpl = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ hook: 'Big week for OTT! 🍿', teasers: { '1': 'Muthuvel is back', '2': 'Streaming on Netflix from Friday' }, closing: 'Which one first?' }) }] } }],
        }),
      }) as any) as any;
    const out = await svc.captionCopy({ kind: 'weekly', releaseIds: ['a', 'b'] });
    expect(out.hook).toBe('Big week for OTT! 🍿');
    expect(out.teasers).toEqual({ a: 'Muthuvel is back' });
    expect(out.dropped).toBe(1);
    expect(out.closing).toBe('Which one first?');
  });
});

describe('cinema captions (theatre words OK, OTT platforms and dates never)', () => {
  const env = { ...process.env };
  afterAll(() => (process.env = env));

  it('safeAiLine with THEATRE allowed', () => {
    expect(safeAiLine('Catch it on the big screen 🍿', [THEATRE])).toBe('Catch it on the big screen 🍿');
    expect(safeAiLine('Theatres la mass celebration!', [THEATRE])).toBe('Theatres la mass celebration!');
    expect(safeAiLine('Later streaming on Netflix', [THEATRE])).toBe('');
    expect(safeAiLine('In cinemas this Friday', [THEATRE])).toBe('');
  });

  it('reads cinema films (not OTT rows) and drops OTT-platform teasers', async () => {
    process.env.GEMINI_API_KEY = 'k';
    let prompt = '';
    const prisma: any = {
      ottRelease: { findMany: async () => { throw new Error('should not read OTT rows'); } },
      cinemaRelease: { findMany: async () => [{ id: 'c1', title: 'Makkal Kaavalan', language: 'ta', overview: 'A cop takes on the system.' }, { id: 'c2', title: 'Kara', language: 'ta', overview: null }] },
    };
    const svc = new OttAiService(prisma);
    svc.fetchImpl = (async (_u: string, init: any) => {
      prompt = JSON.parse(init.body).contents[0].parts[0].text;
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ hook: 'Big screen week! 🔥', teasers: { '1': 'Cop vs system on the big screen', '2': 'Soon on Prime Video' }, closing: 'FDFS plans?' }) }] } }] }),
      } as any;
    }) as any;
    const out = await svc.captionCopy({ kind: 'weekly', domain: 'cinema', releaseIds: ['c1', 'c2'], tone: 'hype', language: 'en' });
    expect(prompt).toContain("this week's new films in theatres");
    expect(out.hook).toBe('Big screen week! 🔥');
    expect(out.teasers).toEqual({ c1: 'Cop vs system on the big screen' });
    expect(out.dropped).toBe(1);
  });
});
