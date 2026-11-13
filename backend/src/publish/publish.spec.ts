import { FacebookService } from './facebook.service';
import { YoutubeService } from './youtube.service';
import { Idempotent, hashtagsOf, isMp4, youtubeMeta } from './publish.util';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(16)]);
const ok = (body: any, headers: Record<string, string> = {}) => ({ ok: true, status: 200, json: async () => body, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } });

function prismaMock() {
  const rows: any[] = [];
  return {
    rows,
    socialPost: {
      findUnique: async ({ where }: any) => rows.find(r => r.requestId === where.requestId) || null,
      create: async ({ data }: any) => { const r = { id: `p${rows.length + 1}`, ...data }; rows.push(r); return r; },
      count: async () => rows.length,
    },
  };
}

describe('publish utils', () => {
  it('keeps YouTube titles/tags inside the limits', () => {
    const m = youtubeMeta({ title: `<b>${'x'.repeat(150)}</b>`, description: 'hi <there>', tags: ['#Kollywood', 'Kollywood', 'OTT'] });
    expect(m.title.length).toBeLessThanOrEqual(100);
    expect(m.title).not.toMatch(/[<>]/);
    expect(m.description).toBe('hi there');
    expect(m.tags).toEqual(['Kollywood', 'OTT']);
    expect(hashtagsOf('Watch #Jailer2 on #PrimeVideo')).toEqual(['Jailer2', 'PrimeVideo']);
    expect(isMp4(MP4)).toBe(true);
    expect(isMp4(JPEG)).toBe(false);
  });

  it('never runs the same request twice', async () => {
    const once = new Idempotent();
    let n = 0;
    const f = () => new Promise<number>(r => setTimeout(() => r(++n), 10));
    const [a, b] = await Promise.all([once.run('x', f), once.run('x', f)]);
    expect([a, b, n]).toEqual([1, 1, 1]);
  });
});

describe('FacebookService', () => {
  const env = { ...process.env };
  afterEach(() => (process.env = { ...env }));

  it('posts several photos as one Page post (unpublished uploads + attached_media)', async () => {
    process.env.FB_PAGE_ID = '123';
    process.env.FB_PAGE_TOKEN = 'tok';
    const prisma = prismaMock();
    const svc = new FacebookService(prisma as any);
    const calls: string[] = [];
    svc.fetchImpl = (async (url: string, init: any) => {
      calls.push(`${init?.method || 'GET'} ${url.split('?')[0].replace('https://graph.facebook.com/v23.0/', '')}`);
      if (url.includes('/photos')) return ok({ id: `ph${calls.length}` });
      if (url.includes('/feed')) {
        const fields = Object.fromEntries((init.body as FormData).entries());
        expect(fields['attached_media[1]']).toBe(JSON.stringify({ media_fbid: 'ph2' }));
        return ok({ id: '123_999' });
      }
      return ok({ permalink_url: 'https://facebook.com/123/posts/999' });
    }) as any;
    const r = await svc.photos({ images: [JPEG, JPEG], caption: 'Hi', kind: 'weekly', requestId: 'r1' });
    expect(calls).toEqual(['POST 123/photos', 'POST 123/photos', 'POST 123/feed', 'GET 123_999']);
    expect(r.permalink).toBe('https://facebook.com/123/posts/999');
    // same requestId again → no new post
    await svc.photos({ images: [JPEG, JPEG], caption: 'Hi', kind: 'weekly', requestId: 'r1' });
    expect(prisma.rows).toHaveLength(1);
  });

  it('says what is missing instead of posting', async () => {
    delete process.env.FB_PAGE_ID;
    delete process.env.FB_PAGE_TOKEN;
    const svc = new FacebookService(prismaMock() as any);
    expect(await svc.status()).toEqual({ configured: false, missing: ['FB_PAGE_ID', 'FB_PAGE_TOKEN'] });
    await expect(svc.photos({ images: [JPEG], caption: '', kind: 'single', requestId: 'r2' })).rejects.toThrow('FB_PAGE_ID');
  });
});

describe('YoutubeService', () => {
  it('needs the OAuth client before it can connect', () => {
    const env = { ...process.env };
    delete process.env.YT_CLIENT_ID;
    delete process.env.YT_CLIENT_SECRET;
    const svc = new YoutubeService(prismaMock() as any);
    expect(() => svc.connectUrl()).toThrow('YT_CLIENT_ID');
    process.env.YT_CLIENT_ID = 'cid';
    process.env.YT_CLIENT_SECRET = 'sec';
    const url = new URL(svc.connectUrl());
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('scope')).toContain('youtube.upload');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/publish/youtube/callback');
    process.env = env;
  });

  it('rejects a callback with an unknown state', async () => {
    const svc = new YoutubeService(prismaMock() as any);
    await expect(svc.callback('code', 'nope')).rejects.toThrow('expired');
  });
});
