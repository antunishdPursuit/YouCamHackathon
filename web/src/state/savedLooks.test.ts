import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TryOnPanel, TryOnResponse } from '@yincol/shared';
import type { CachedGeneration } from './generationCache.js';
import { prepareSavedLook, openSavedLook, hasUsablePreviews, readSavedLook, normalizeMotion, savedImageIdFor } from './savedLooks.js';

const panel = (imageUrl: string): TryOnPanel => ({ provenance: 'live', stage: 'completeLook', result: { status: 'ready', imageUrl, alt: 'Outfit preview' } });
const result: TryOnResponse = { mode: 'live', portrait: panel('data:image/png;base64,cHJpdmF0ZQ=='),
  portraitMadeUp: { ...panel('data:image/png;base64,bWFkZVVw'), stage: 'portraitMakeup' },
  garments: { a: { ...panel('data:image/png;base64,aW1hZ2U='), stage: 'garmentOnly' } },
  completeLooks: { a: panel('data:image/png;base64,aW1hZ2U=') },
  fullBody: { mode: 'live', garments: {}, completeLooks: { a: panel('data:image/png;base64,ZnVsbA=='),
    b: { provenance: 'live', result: { status: 'failed', reason: 'Top B failed.' } } } } };
const cache = { key: 'test-key', savedAt: 100, analysis: { mode: 'fixture' }, tryOn: result } as CachedGeneration;
const settings = { garmentIds: ['a', 'b'], makeupLookId: 'rose-veil', fullBodySize: { width: 900, height: 1600 } };

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('saved media boundaries', () => {
  it('stores output bytes once, omits source portraits, and preserves partial failures and framing', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(new Blob(['output bytes'], { type: 'image/png' }))));
    vi.stubGlobal('fetch', fetcher);
    const saved = await prepareSavedLook(cache, settings);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.flat()).not.toContain('data:image/png;base64,cHJpdmF0ZQ==');
    expect(saved.tryOn.portrait.result.status).toBe('failed');
    expect(saved.tryOn.portraitMadeUp?.stage).toBe('portraitMakeup');
    expect(saved.media.every(media => media.blob instanceof Blob)).toBe(true);
    expect(saved.tryOn.fullBody?.completeLooks.b?.result).toEqual({ status: 'failed', reason: 'Top B failed.' });
    expect(saved.fullBodySize).toEqual(settings.fullBodySize);
    const opened = openSavedLook(saved);
    expect(opened.tryOn.completeLooks.a?.result).toMatchObject({ status: 'ready', imageUrl: expect.stringMatching(/^blob:/) });
    expect(opened.tryOn.portraitMadeUp?.result).toMatchObject({ status: 'ready', imageUrl: expect.stringMatching(/^blob:/) });
    expect(opened.tryOn.fullBody?.completeLooks.a?.provenance).toBe('live');
    expect(opened.videoByImage).toEqual({});
    const revoked = vi.spyOn(URL, 'revokeObjectURL');
    opened.dispose();
    expect(revoked).toHaveBeenCalledTimes(3);
  });
  it('saves the matching demo video with its image and restores their relationship', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(new Blob(['captured bytes'], { type: url.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg' })))));
    const captured = { ...panel('/fixtures/complete-look-a-result.jpg'), provenance: 'captured' as const };
    const saved = await prepareSavedLook({ ...cache, tryOn: { mode: 'fixture', portrait: captured, garments: {}, completeLooks: { a: captured } } }, settings);
    expect(saved.media.map(media => media.kind)).toEqual(['image', 'video']);
    // Actual PR #13 schema: one object, rather than the new array.
    (saved as unknown as { motion: unknown }).motion = saved.motion[0];
    const opened = openSavedLook(saved);
    const image = opened.tryOn.completeLooks.a?.result;
    if (image?.status !== 'ready') throw new Error('Missing restored image');
    expect(opened.videoByImage[image.imageUrl]).toMatch(/^blob:/);
    opened.dispose();
  });
  it('normalizes absent, legacy and current relationships without dropping valid media', () => {
    const pair = { imageId: 'image-1', videoId: 'motion-sample' };
    expect(normalizeMotion(undefined)).toEqual([]);
    expect(normalizeMotion(pair)).toEqual([pair]);
    expect(normalizeMotion([pair])).toEqual([pair]);
    expect(normalizeMotion([null, {}, pair])).toEqual([pair]);
  });
  it('resolves fresh result image IDs using the same ordering and deduplication as saving', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(new Blob(['bytes'], { type: 'image/png' })))));
    const saved = await prepareSavedLook(cache, settings);
    const id = savedImageIdFor(cache.tryOn, 'data:image/png;base64,aW1hZ2U=');
    expect(saved.tryOn.completeLooks.a?.result).toMatchObject({ imageUrl: `saved:${id}` });
    expect(savedImageIdFor(cache.tryOn, 'data:image/png;base64,cHJpdmF0ZQ==')).toBeUndefined();
  });
  it('does not fetch signed provider URLs or claim a failed media save succeeded', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(prepareSavedLook({ ...cache, tryOn: { ...result, fullBody: undefined, portraitMadeUp: undefined, garments: {}, completeLooks: { a: panel('https://provider.example/photo?secret=test') } } }, settings)).rejects.toThrow('safely');
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(new Response('unavailable', { status: 503 }));
    await expect(prepareSavedLook(cache, settings)).rejects.toThrow('downloaded');
  });
  it('keeps usable partial results and distinguishes placeholders from completed outputs', () => {
    expect(hasUsablePreviews(result)).toBe(true);
    const placeholder = { ...panel('/fixtures/placeholder.svg'), provenance: 'placeholder' as const };
    expect(hasUsablePreviews({ mode: 'fixture', portrait: placeholder, garments: {}, completeLooks: { a: placeholder } })).toBe(false);
  });
  it('reports unavailable IndexedDB instead of treating a failed lookup as a cache miss', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(readSavedLook('anything')).rejects.toThrow('storage is unavailable');
  });
});
