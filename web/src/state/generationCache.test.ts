import { describe, expect, it } from 'vitest';
import { generationCacheKey } from './generationCache.js';
import type { CapturedImage } from './session.js';

const input = (name: string): CapturedImage => ({
  file: new File(['image test bytes:' + name], name, { type: 'image/png', lastModified: 1 }),
  previewUrl: 'blob:test', width: 100, height: 100,
});
const images = { portrait: input('portrait.png'), garmentInputs: [input('a.png'), input('b.png')], makeupLookId: 'champagne-halo' };
describe('full-body cache ownership', () => {
  it('separates changed full-body photos, trousers, and opting out', async () => {
    const base = { ...images, liveTryOn: true, liveSkinAnalysis: true };
    const fullBody = { enabled: true, portrait: input('full.png'), trousers: input('pants.png') };
    const keys = await Promise.all([
      { ...base },
      { ...base, fullBody },
      { ...base, fullBody: { ...fullBody, portrait: input('other.png') } },
      { ...base, fullBody: { ...fullBody, trousers: input('other-pants.png') } },
    ].map(generationCacheKey));
    expect(new Set(keys).size).toBe(4);
    expect(await generationCacheKey({ ...base, fullBody })).toBe(keys[1]);
    expect(await generationCacheKey({ ...base, fullBody: { ...fullBody, trousers: null } })).toBeNull();
  });
});
