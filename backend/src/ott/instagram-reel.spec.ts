import { InstagramService } from './instagram.service';

const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(64)]);

function setup(opts: { resumableFails?: boolean } = {}) {
  const rows: any[] = [];
  const prisma: any = {
    instagramPost: {
      findUnique: jest.fn(async ({ where }) => rows.find(r => r.requestId === where.requestId) || null),
      create: jest.fn(async ({ data }) => {
        const row = { id: `post${rows.length + 1}`, ...data };
        rows.push(row);
        return row;
      }),
    },
  };
  const svc = new InstagramService(prisma);
  const calls: Array<{ method: string; url: string; body?: any; headers?: any }> = [];
  svc.sleep = async () => {};
  svc.fetchImpl = (async (url: string, init: any = {}) => {
    const method = init.method || 'GET';
    calls.push({ method, url, body: init.body, headers: init.headers });
    const ok = (b: any) => ({ ok: true, status: 200, json: async () => b, text: async () => String(b) }) as any;
    if (url.startsWith('https://rupload.facebook.com/')) {
      return opts.resumableFails ? ({ ok: false, status: 400, json: async () => ({ debug_info: { message: 'unsupported' } }) } as any) : ok({ success: true });
    }
    if (url.includes('litterbox.catbox.moe')) return { ok: true, status: 200, text: async () => 'https://litter.catbox.moe/abc123.mp4\n' } as any;
    if (method === 'POST' && url.includes('/media_publish')) return ok({ id: 'MEDIA9' });
    if (method === 'POST' && url.includes('/media')) return ok({ id: 'C1' });
    if (url.includes('fields=status_code')) return ok({ status_code: 'FINISHED' });
    if (url.includes('fields=permalink')) return ok({ permalink: 'https://www.instagram.com/reel/xyz/' });
    return { ok: false, status: 404, json: async () => ({ error: { message: 'unexpected ' + url } }) } as any;
  }) as any;
  return { svc, calls, rows };
}

describe('Instagram Reels', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.IG_ACCESS_TOKEN = 'token-abcdefghijklmnop';
    process.env.IG_USER_ID = '1784';
    delete process.env.IMGBB_API_KEY; // Reels don't need it
    process.env.IG_GRAPH_HOST = 'graph.facebook.com';
  });
  afterAll(() => {
    process.env = env;
  });

  it('uploads the MP4 straight to Meta (resumable), waits, publishes', async () => {
    const { svc, calls, rows } = setup();
    const r = await svc.publishReel({ video: MP4, caption: 'Trailer cut #Jailer2', kind: 'single-reel', releaseId: 'r1', requestId: 'q1' });
    expect(r).toMatchObject({ mediaId: 'MEDIA9', permalink: 'https://www.instagram.com/reel/xyz/' });
    const create = calls[0];
    expect(create.url).toContain('graph.facebook.com/v23.0/1784/media');
    expect(create.body).toContain('media_type=REELS');
    expect(create.body).toContain('upload_type=resumable');
    expect(create.body).toContain('share_to_feed=true');
    const up = calls[1];
    expect(up.url).toBe('https://rupload.facebook.com/ig-api-upload/v23.0/C1');
    expect(up.headers).toMatchObject({ Authorization: 'OAuth token-abcdefghijklmnop', offset: '0', file_size: String(MP4.length) });
    expect(calls.some(c => c.url.includes('litterbox'))).toBe(false);
    expect(rows[0]).toMatchObject({ kind: 'single-reel', releaseId: 'r1', mediaId: 'MEDIA9' });
  });

  it('falls back to a 1-hour temporary link when the direct upload is refused', async () => {
    const { svc, calls } = setup({ resumableFails: true });
    await svc.publishReel({ video: MP4, caption: 'x', kind: 'world', requestId: 'q2', shareToFeed: false });
    const host = calls.find(c => c.url.includes('litterbox'));
    expect(host).toBeTruthy();
    expect((host!.body as FormData).get('time')).toBe('1h');
    const second = calls.filter(c => c.method === 'POST' && /\/1784\/media$/.test(new URL(c.url).pathname))[1];
    expect(second.body).toContain('video_url=https%3A%2F%2Flitter.catbox.moe%2Fabc123.mp4');
    expect(second.body).toContain('share_to_feed=false');
  });

  it('never posts the same Reel twice and checks the file', async () => {
    const { svc, calls } = setup();
    const a = svc.publishReel({ video: MP4, caption: 'x', kind: 'reel', requestId: 'same' });
    const b = svc.publishReel({ video: MP4, caption: 'x', kind: 'reel', requestId: 'same' });
    expect(await a).toEqual(await b);
    await svc.publishReel({ video: MP4, caption: 'x', kind: 'reel', requestId: 'same' });
    expect(calls.filter(c => c.url.includes('/media_publish'))).toHaveLength(1);
    await expect(svc.publishReel({ video: Buffer.from('not a video at all'), caption: 'x', kind: 'reel', requestId: 'bad' })).rejects.toThrow('MP4');
    await expect(svc.publishReel({ video: MP4, caption: '#a '.repeat(31), kind: 'reel', requestId: 'tags' })).rejects.toThrow('30');
  });

  it('only needs the token + account id', () => {
    const { svc } = setup();
    expect(svc.reelMissing()).toEqual([]);
    expect(svc.missing()).toContain('IMGBB_API_KEY');
  });
});
