import { InstagramService } from './instagram.service';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function setup() {
  const rows: any[] = [];
  const prisma: any = {
    instagramPost: {
      findUnique: jest.fn(async ({ where }) => rows.find(r => r.requestId === where.requestId) || null),
      create: jest.fn(async ({ data }) => {
        const row = { id: `post${rows.length + 1}`, ...data };
        rows.push(row);
        return row;
      }),
      count: jest.fn(async () => rows.length),
    },
  };
  const svc = new InstagramService(prisma);
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  let container = 0;
  svc.sleep = async () => {};
  svc.fetchImpl = (async (url: string, init: any = {}) => {
    const method = init.method || 'GET';
    calls.push({ method, url, body: typeof init.body === 'string' ? init.body : undefined });
    const ok = (b: any) => ({ ok: true, status: 200, json: async () => b }) as any;
    if (url.includes('refresh_access_token')) return ok({ access_token: 'refreshed' });
    if (url.includes('api.imgbb.com')) return ok({ data: { url: `https://i.ibb.co/img${calls.length}.jpg` } });
    if (method === 'POST' && url.includes('/media_publish')) return ok({ id: 'MEDIA1' });
    if (method === 'POST' && url.includes('/media')) return ok({ id: `C${++container}` });
    if (url.includes('fields=status_code')) return ok({ status_code: 'FINISHED' });
    if (url.includes('fields=permalink')) return ok({ permalink: 'https://www.instagram.com/p/abc/' });
    if (url.includes('fields=username')) return ok({ username: 'quickflix' });
    return { ok: false, status: 404, json: async () => ({ error: { message: 'unexpected ' + url } }) } as any;
  }) as any;
  return { svc, calls, rows, prisma };
}

describe('InstagramService', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.IG_ACCESS_TOKEN = 'token-abcdefghijklmnop';
    process.env.IG_USER_ID = '1784';
    process.env.IMGBB_API_KEY = 'imgkey';
    process.env.IG_GRAPH_HOST = 'graph.facebook.com'; // skips token refresh file writes in tests
  });
  afterAll(() => {
    process.env = env;
  });

  it('publishes a single image: host → container → wait → publish → permalink', async () => {
    const { svc, calls, rows } = setup();
    const res = await svc.publish({ images: [JPEG], caption: 'Hello #OTT', kind: 'single', releaseId: 'r1', requestId: 'req-1' });
    expect(res).toMatchObject({ mediaId: 'MEDIA1', permalink: 'https://www.instagram.com/p/abc/' });
    const seq = calls.map(c => `${c.method} ${new URL(c.url).hostname}${new URL(c.url).pathname}`);
    expect(seq[0]).toBe('POST api.imgbb.com/1/upload');
    expect(seq[1]).toBe('POST graph.facebook.com/v23.0/1784/media');
    expect(calls[1].body).toContain('image_url=https%3A%2F%2Fi.ibb.co');
    expect(calls[1].body).toContain('caption=Hello+%23OTT');
    expect(seq).toContain('POST graph.facebook.com/v23.0/1784/media_publish');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ releaseId: 'r1', kind: 'single', imageCount: 1 });
    // image uploads expire (10 min) so nothing lingers on the public host
    expect(calls[0].url).toContain('expiration=600');
  });

  it('builds a carousel from several images', async () => {
    const { svc, calls } = setup();
    await svc.publish({ images: [JPEG, JPEG, JPEG], caption: 'week', kind: 'weekly', requestId: 'req-2' });
    const parent = calls.find(c => c.body?.includes('media_type=CAROUSEL'));
    expect(parent?.body).toContain('children=C1%2CC2%2CC3');
    expect(calls.filter(c => c.body?.includes('is_carousel_item=true'))).toHaveLength(3);
  });

  it('never posts twice for the same requestId (concurrent or repeated)', async () => {
    const { svc, calls } = setup();
    const input = { images: [JPEG], caption: 'x', kind: 'single', requestId: 'req-3' };
    const [a, b] = await Promise.all([svc.publish(input), svc.publish(input)]);
    expect(a).toEqual(b);
    const again = await svc.publish(input);
    expect(again.mediaId).toBe('MEDIA1');
    expect(calls.filter(c => c.url.includes('/media_publish'))).toHaveLength(1);
  });

  it('validates before touching any service', async () => {
    const { svc, calls } = setup();
    await expect(svc.publish({ images: [Buffer.from('PNG')], caption: '', kind: 'single', requestId: 'a' })).rejects.toThrow('JPEG');
    await expect(svc.publish({ images: Array(11).fill(JPEG), caption: '', kind: 'weekly', requestId: 'b' })).rejects.toThrow('at most 10');
    await expect(svc.publish({ images: [JPEG], caption: 'x'.repeat(2201), kind: 'single', requestId: 'c' })).rejects.toThrow('2200');
    await expect(svc.publish({ images: [JPEG], caption: Array(31).fill('#t').map((t, i) => t + i).join(' '), kind: 'single', requestId: 'd' })).rejects.toThrow('30');
    expect(calls).toHaveLength(0);
  });

  it('explains what is missing when not configured', async () => {
    delete process.env.IMGBB_API_KEY;
    const { svc } = setup();
    // photos need the image host; Reels don't, so they're still ready
    expect(await svc.status()).toMatchObject({ configured: false, reelReady: true, missing: ['IMGBB_API_KEY'], username: 'quickflix' });
    delete process.env.IG_USER_ID;
    expect(await svc.status()).toEqual({ configured: false, reelReady: false, missing: ['IG_USER_ID', 'IMGBB_API_KEY'] });
    process.env.IG_USER_ID = '1784';
    await expect(svc.publish({ images: [JPEG], caption: '', kind: 'single', requestId: 'e' })).rejects.toThrow('IMGBB_API_KEY');
  });

  it('turns Instagram errors into plain messages', async () => {
    const { svc } = setup();
    svc.fetchImpl = (async (url: string) =>
      url.includes('imgbb')
        ? ({ ok: true, json: async () => ({ data: { url: 'https://i.ibb.co/x.jpg' } }) } as any)
        : ({ ok: false, status: 400, json: async () => ({ error: { message: 'Invalid OAuth access token', code: 190 } }) } as any)) as any;
    await expect(svc.publish({ images: [JPEG], caption: '', kind: 'single', requestId: 'f' })).rejects.toThrow(/token is invalid or expired/);
  });
});
