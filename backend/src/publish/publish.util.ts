export interface PostedResult {
  externalId: string;
  permalink: string | null;
  postId: string;
}

export const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
/** MP4/MOV: "ftyp" box at byte 4. */
export const isMp4 = (b: Buffer) => b.length > 12 && b.toString('latin1', 4, 8) === 'ftyp';

/** Same requestId → same promise/outcome, so a double click or retry can never post twice. Failures may be retried. */
export class Idempotent {
  private readonly inFlight = new Map<string, Promise<any>>();
  run<T>(requestId: string, fn: () => Promise<T>): Promise<T> {
    if (!requestId || requestId.length > 100) return Promise.reject(new Error('requestId is required'));
    const existing = this.inFlight.get(requestId);
    if (existing) return existing;
    const p = fn();
    this.inFlight.set(requestId, p);
    p.catch(() => this.inFlight.delete(requestId));
    return p;
  }
}

/** YouTube limits: title ≤ 100 chars with no < >, description ≤ 5000, tags ≤ 500 chars total. */
export function youtubeMeta(input: { title: string; description: string; tags?: string[] }) {
  const clean = (s: string) => s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  let title = clean(input.title) || 'New video';
  if (title.length > 100) title = title.slice(0, 99).replace(/\s+\S*$/, '') + '…';
  const description = input.description.replace(/[<>]/g, '').slice(0, 5000);
  const tags: string[] = [];
  let len = 0;
  for (const t of input.tags || []) {
    const tag = t.replace(/^#/, '').replace(/[<>,]/g, '').trim();
    if (!tag || tags.includes(tag) || len + tag.length + 1 > 480) continue;
    tags.push(tag);
    len += tag.length + 1;
  }
  return { title, description, tags };
}

/** Hashtags in a caption → tags. */
export const hashtagsOf = (caption: string) => (caption.match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.slice(1));
