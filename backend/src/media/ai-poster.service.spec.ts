import { AiPosterService } from './ai-poster.service';

const release = { id: 'r1aaaaaaaa', status: 'APPROVED', title: 'Jailer 2', contentType: 'movie', language: 'ta', overview: 'Muthuvel returns.', genres: 'Action,Thriller', posterPath: '/p.jpg' };

function setup(responses: Array<{ status: number; body: any }>) {
  const prisma: any = { ottRelease: { findUnique: async () => release }, cinemaRelease: { findUnique: async () => null } };
  const svc = new AiPosterService(prisma);
  const calls: string[] = [];
  let i = 0;
  svc.fetchImpl = (async (url: string) => {
    calls.push(url);
    if (url.includes('image.tmdb.org')) return { ok: true, headers: new Headers({ 'content-type': 'image/jpeg' }), arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as any;
    const r = responses[Math.min(i++, responses.length - 1)];
    return { ok: r.status === 200, status: r.status, json: async () => r.body } as any;
  }) as any;
  return { svc, calls };
}

describe('AiPosterService', () => {
  const env = { ...process.env };
  beforeEach(() => (process.env.GEMINI_API_KEY = 'k'));
  afterAll(() => (process.env = env));

  it('prompt always forbids text; background mode forbids people', () => {
    const { svc } = setup([]);
    const p1 = svc.buildPrompt(release, 'mass', 'restyle', true);
    expect(p1).toMatch(/NO text/);
    expect(p1).toMatch(/attached official poster/);
    expect(p1).toMatch(/mass-action/);
    const p2 = svc.buildPrompt(release, 'horror', 'background', false);
    expect(p2).toMatch(/NO people, NO faces/);
  });

  it('stops at the first billing/quota error (never keeps paying or retrying)', async () => {
    const { svc, calls } = setup([{ status: 429, body: { error: { message: 'You exceeded your current quota, please check your plan and billing details.' } } }]);
    await expect(svc.generate({ kind: 'ott', id: 'r1', count: 4 })).rejects.toThrow(/billing/);
    expect(calls.filter(c => c.includes('generativelanguage')).length).toBe(1);
  });

  it('refuses titles that are not approved', async () => {
    const { svc } = setup([]);
    (svc as any).prisma.ottRelease.findUnique = async () => ({ ...release, status: 'PENDING' });
    await expect(svc.generate({ kind: 'ott', id: 'r1' })).rejects.toThrow(/Approve/);
  });
});
