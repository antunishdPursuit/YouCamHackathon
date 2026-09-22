import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CapturedImage } from '../state/session.js';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules(); });
const image: CapturedImage = {
  file: new File(['private image bytes'], 'portrait.png', { type: 'image/png' }),
  previewUrl: 'blob:test', width: 100, height: 100,
};
const input = {
  portraitRef: 'fixture:portrait', portrait: image,
  garmentIds: ['rosewater-cardigan'], garmentInputs: [image], makeupLookId: 'champagne-halo',
};

describe('generation mode selection', () => {
  it('stops before posting when the runtime mode cannot be confirmed', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const { requestTryOn } = await import('./client.js');
    await expect(requestTryOn(input)).rejects.toThrow('confirm the generation mode');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/health');
  });
  it('sends fixture metadata without reading selected files in demo mode', async () => {
    const readFile = vi.spyOn(image.file, 'arrayBuffer');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ liveTryOn: false, liveSkinAnalysis: false })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ mode: 'fixture' })));
    vi.stubGlobal('fetch', fetchMock);
    const { requestTryOn } = await import('./client.js');
    await requestTryOn(input);
    expect(readFile).not.toHaveBeenCalled();
    const sent = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(sent).toEqual({ portraitRef: 'fixture:portrait', garmentIds: input.garmentIds, makeupLookId: 'champagne-halo' });
  });
  it('uploads selected images and the chosen look when live generation is enabled', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ liveTryOn: true, liveSkinAnalysis: false })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ mode: 'live' })));
    vi.stubGlobal('fetch', fetchMock);
    const { requestTryOn } = await import('./client.js');
    await requestTryOn(input);
    const sent = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(sent.makeupLookId).toBe('champagne-halo');
    expect(atob(sent.portrait.data)).toBe('private image bytes');
    expect(sent.garmentImages['rosewater-cardigan'].data).toBe(sent.portrait.data);
  });
});

describe('full-body generation request', () => {
  const fullBody = { enabled: true, portrait: image, trousers: {
    ...image, file: new File(['trouser bytes'], 'trousers.png', { type: 'image/png' }),
  } };
  it('sends the actual full-body portrait and trousers with the existing tops and makeup', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ liveTryOn: true, fullBodyTryOn: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ mode: 'live' })));
    vi.stubGlobal('fetch', fetchMock);
    const { requestTryOn } = await import('./client.js');
    await requestTryOn({ ...input, fullBody });
    const sent = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(atob(sent.fullBody.portrait.data)).toBe('private image bytes');
    expect(atob(sent.fullBody.trousers.data)).toBe('trouser bytes');
    expect(sent.makeupLookId).toBe('champagne-halo');
  });
  it.each([{ liveTryOn: false, fullBodyTryOn: false }, { liveTryOn: true, fullBodyTryOn: false }])
  ('refuses unsupported full-body requests before reading or uploading files', async mode => {
    const readFile = vi.spyOn(image.file, 'arrayBuffer');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(mode)));
    vi.stubGlobal('fetch', fetchMock);
    const { requestTryOn } = await import('./client.js');
    await expect(requestTryOn({ ...input, fullBody })).rejects.toThrow('unavailable');
    expect(readFile).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('rejects missing trousers before any upload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ liveTryOn: true, fullBodyTryOn: true })));
    vi.stubGlobal('fetch', fetchMock);
    const { requestTryOn } = await import('./client.js');
    await expect(requestTryOn({ ...input, fullBody: { ...fullBody, trousers: null } })).rejects.toThrow('Add a full-body');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
