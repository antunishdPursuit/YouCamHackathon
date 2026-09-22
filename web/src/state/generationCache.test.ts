import { afterEach, describe, expect, it, vi } from 'vitest';
import { generationCacheKey, writeGenerationCache, readGenerationCache, clearGenerationCache, type CachedGeneration } from './generationCache.js';
import type { CapturedImage } from './session.js';

const input = (name: string): CapturedImage => ({
  file: new File(['image test bytes:' + name], name, { type: 'image/png', lastModified: 1 }),
  previewUrl: 'blob:test', width: 100, height: 100,
});
const images = { portrait: input('portrait.png'), garmentInputs: [input('a.png'), input('b.png')], makeupLookId: 'champagne-halo' };
describe('generation cache mode boundaries', () => {
  it('never reuses demo or partial-live results for another runtime mode', async () => {
    const keys = await Promise.all([
      { liveTryOn: false, liveSkinAnalysis: false },
      { liveTryOn: true, liveSkinAnalysis: false },
      { liveTryOn: false, liveSkinAnalysis: true },
      { liveTryOn: true, liveSkinAnalysis: true },
    ].map(mode => generationCacheKey({ ...images, ...mode })));
    expect(keys.every(Boolean)).toBe(true);
    expect(new Set(keys).size).toBe(4);
  });
  it('reuses unchanged live inputs but separates the selected makeup look', async () => {
    const request = { ...images, liveTryOn: true, liveSkinAnalysis: true };
    const first = await generationCacheKey(request);
    expect(await generationCacheKey(request)).toBe(first);
    expect(await generationCacheKey({ ...request, makeupLookId: 'rose-veil' })).not.toBe(first);
  });
});

afterEach(() => { clearGenerationCache(); vi.unstubAllGlobals(); });
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
  it('reuses large results in memory if browser storage is full, then erases them on delete', () => {
    vi.stubGlobal('sessionStorage', { setItem: () => { throw new Error('quota'); }, getItem: () => null, removeItem: vi.fn() });
    const result = { key: 'large', savedAt: 1, analysis: {}, tryOn: { fullBody: {} } } as CachedGeneration;
    expect(writeGenerationCache(result)).toBe(false);
    expect(readGenerationCache('large')).toBe(result);
    expect(readGenerationCache('different')).toBeNull();
    clearGenerationCache();
    expect(readGenerationCache('large')).toBeNull();
  });
});
