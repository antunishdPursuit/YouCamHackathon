/**
 * The portrait-only makeup sequence.
 *
 * Holds one claim upright: this uploads its own copy of the portrait for `makeupVto`
 * (a `clothesVto` upload slot cannot be reused), runs the makeup task directly on it, and
 * never throws — a failure comes back as a failed panel with no stage, exactly like
 * `completeLook.ts`'s failure paths. Driven through a stubbed `fetch`, so no credits and
 * no network.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAKEUP_LOOKS } from '@yincol/shared';
import { loadConfig } from './config.js';
import { runPortraitMakeupSequence } from './portraitMakeup.js';
import type { ImageSource } from './imageInput.js';

const config = loadConfig({
  YINCOL_API_BASE_URL: 'https://yce-api-01.makeupar.com',
  YINCOL_API_KEY: 'test-key',
  YINCOL_FIXTURE_MODE: 'false',
});

const look = MAKEUP_LOOKS[0]!;
const portrait: ImageSource = {
  bytes: Buffer.from('portrait-bytes'),
  contentType: 'image/png',
  fileName: 'portrait.png',
};

const MADE_UP_BYTES = Buffer.from('portrait-makeup-bytes');

const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });
const uploadSlot = (fileId: string, url: string): Response =>
  json({ data: { files: [{ file_id: fileId, requests: [{ method: 'PUT', url, headers: {} }] }] } });
const startedTask = (taskId: string): Response => json({ task_id: taskId });
const succeededTask = (taskId: string, url: string): Response =>
  json({ task_id: taskId, task_status: 'success', result: { data: [{ url }] } });
const imageBody = (bytes: Buffer): Response =>
  new Response(bytes, { status: 200, headers: { 'content-type': 'image/jpeg' } });

type FetchCall = Parameters<typeof fetch>;
const bodyOf = (call: FetchCall | undefined): Record<string, unknown> =>
  JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the portrait-makeup sequence', () => {
  it('uploads its own copy of the portrait and runs makeup directly on it', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(uploadSlot('portrait-makeup-file', 'https://uploads.example/portrait-makeup'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(startedTask('makeup-portrait-1'))
      .mockResolvedValueOnce(succeededTask('makeup-portrait-1', 'https://results.example/portrait-makeup.jpg'))
      .mockResolvedValueOnce(imageBody(MADE_UP_BYTES));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const panel = await runPortraitMakeupSequence({ config, portrait, look });

    const [uploadUrl, uploadInit] = fetchMock.mock.calls[1]!;
    expect(uploadUrl).toBe('https://uploads.example/portrait-makeup');
    expect(uploadInit?.body).toEqual(portrait.bytes);

    const [makeupUrl] = fetchMock.mock.calls[2]!;
    expect(makeupUrl).toBe('https://yce-api-01.makeupar.com/s2s/v2.0/task/makeup-vto');
    const makeupBody = bodyOf(fetchMock.mock.calls[2]);
    expect(makeupBody['src_file_id']).toBe('portrait-makeup-file');
    expect(makeupBody['effects']).toBeInstanceOf(Array);

    expect(panel.stage).toBe('portraitMakeup');
    expect(panel.provenance).toBe('live');
    expect(panel.result.status).toBe('ready');
    if (panel.result.status !== 'ready') return;
    expect(panel.result.imageUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(panel.result.imageUrl).not.toContain('results.example');
  });

  it('never throws — a failed makeup task comes back as a failed panel with no stage', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(uploadSlot('portrait-makeup-file', 'https://uploads.example/portrait-makeup'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(startedTask('makeup-portrait-1'))
      .mockResolvedValueOnce(json({ task_id: 'makeup-portrait-1', task_status: 'error' }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const panel = await runPortraitMakeupSequence({ config, portrait, look });

    expect(panel.result.status).toBe('failed');
    expect(panel.stage).toBeUndefined();
  });

  it('publishes none of the provider response when the upload slot is refused', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('nope', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const panel = await runPortraitMakeupSequence({ config, portrait, look });

    expect(panel.result.status).toBe('failed');
    if (panel.result.status !== 'failed') return;
    expect(panel.result.reason).toBe('The makeup preview on your original portrait could not be generated.');
    expect(consoleError).toHaveBeenCalled();
  });
});
