import { checkVideoLink, fileNameFrom, isPrivateHost, looksLikeVideo } from './video-link.util';

describe('trailer links', () => {
  it('refuses YouTube, social and streaming links', () => {
    for (const u of [
      'https://www.youtube.com/watch?v=abc',
      'https://youtu.be/abc',
      'https://m.youtube.com/shorts/abc',
      'https://www.instagram.com/reel/xyz/',
      'https://fb.watch/abc',
      'https://x.com/a/status/1',
      'https://www.hotstar.com/in/movies/x',
      'https://rr3---sn-abc.googlevideo.com/videoplayback?x=1',
    ]) {
      const r = checkVideoLink(u);
      expect(r.ok).toBe(false);
    }
    const y = checkVideoLink('https://youtu.be/abc');
    expect(!y.ok && y.message).toContain('YouTube');
  });

  it('refuses local / private addresses and bad links', () => {
    for (const u of ['http://localhost:3000/x.mp4', 'http://127.0.0.1/x.mp4', 'http://192.168.1.5/x.mp4', 'http://10.0.0.1/a', 'http://[::1]/a', 'ftp://x.com/a.mp4', 'not a link', 'https://u:p@x.com/a.mp4']) {
      expect(checkVideoLink(u).ok).toBe(false);
    }
    expect(isPrivateHost('172.20.1.1')).toBe(true);
    expect(isPrivateHost('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateHost('8.8.8.8')).toBe(false);
  });

  it('turns share links into direct downloads', () => {
    expect(checkVideoLink('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing')).toEqual({
      ok: true, url: 'https://drive.usercontent.google.com/download?id=1AbCdEfGhIjKlMnOp&export=download&confirm=t', note: 'Google Drive',
    });
    expect(checkVideoLink('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp')).toMatchObject({ ok: true, note: 'Google Drive' });
    const d = checkVideoLink('https://www.dropbox.com/scl/fi/abc/trailer.mp4?rlkey=k&dl=0');
    expect(d.ok && d.url).toContain('raw=1');
    expect(d.ok && d.url).not.toContain('dl=0');
    expect(checkVideoLink('https://cdn.example.com/press/trailer.mp4')).toEqual({ ok: true, url: 'https://cdn.example.com/press/trailer.mp4' });
    expect(checkVideoLink('https://archive.org/details/some_trailer').ok).toBe(false);
  });

  it('recognises video files and names them', () => {
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(20)]);
    expect(looksLikeVideo(mp4)).toBe(true);
    expect(looksLikeVideo(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(true);
    expect(looksLikeVideo(Buffer.from('<!DOCTYPE html><html><body>Sign in</body></html>'))).toBe(false);
    expect(fileNameFrom('attachment; filename="Jailer 2 Trailer.mp4"', 'https://x/y')).toBe('Jailer 2 Trailer.mp4');
    expect(fileNameFrom(null, 'https://cdn.x.com/a/trailer%20final.mov')).toBe('trailer final.mov');
    expect(fileNameFrom(null, 'https://cdn.x.com/download?id=1')).toBe('download.mp4');
  });
});
