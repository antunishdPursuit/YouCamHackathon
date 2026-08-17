/**
 * The complete-look sequence.
 *
 * These tests exist to hold one claim upright: the makeup task receives the garment
 * task's returned image, and the panel only calls itself a complete look when it did.
 * Everything is driven through a stubbed `fetch`, so no credits and no network.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAKEUP_LOOKS } from '@yincol/shared';
import { loadConfig } from './config.js';
import { runCompleteLookSequence } from './completeLook.js';
import type { ImageReference } from './imageInput.js';

const config = loadConfig({
  YINCOL_API_BASE_URL: 'https://yce-api-01.makeupar.com',
  YINCOL_API_KEY: 'test-key',
  YINCOL_FIXTURE_MODE: 'false',
});

const look = MAKEUP_LOOKS[0]!;
const portrait: ImageReference = { kind: 'fileId', fileId: 'portrait-file' };
const garment: ImageReference = { kind: 'fileId', fileId: 'garment-file' };

const GARMENT_BYTES = Buffer.from('garment-result-bytes');
const COMPLETE_BYTES = Buffer.from('complete-look-bytes');

const request = {
  config,
  portrait,
  garment,
  garmentCategory: 'upper_body' as const,
  look,
  garmentName: 'Rosewater cardigan',
};

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200 });

const startedTask = (taskId: string): Response => json({ task_id: taskId });

const succeededTask = (taskId: string, url: string): Response =>
  json({ task_id: taskId, task_status: 'success', result: { data: [{ url }] } });

const imageBody = (bytes: Buffer): Response =>
  new Response(bytes, { status: 200, headers: { 'content-type': 'image/jpeg' } });

/**
 * A stubbed conversation for a fully successful sequence.
 *
 * Ordered deliberately: clothes start, clothes poll, clothes download, makeup upload slot,
 * makeup PUT, makeup start, makeup poll, makeup download. If the implementation reorders
 * the two tasks, the calls no longer line up and the assertions below fail — which is the
 * point of writing them as a fixed script rather than by URL matching.
 */
function stubHappyPath() {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(startedTask('clothes-1'))
    .mockResolvedValueOnce(succeededTask('clothes-1', 'https://results.example/garment.jpg'))
    .mockResolvedValueOnce(imageBody(GARMENT_BYTES))
    .mockResolvedValueOnce(
      json({
        data: {
          files: [
            {
              file_id: 'made-up-source-file',
              requests: [
                { method: 'PUT', url: 'https://uploads.example/made-up', headers: {} },
              ],
            },
          ],
        },
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 200 }))
    .mockResolvedValueOnce(startedTask('makeup-1'))
    .mockResolvedValueOnce(succeededTask('makeup-1', 'https://results.example/complete.jpg'))
    .mockResolvedValueOnce(imageBody(COMPLETE_BYTES));

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

type FetchCall = Parameters<typeof fetch>;

const bodyOf = (call: FetchCall | undefined): Record<string, unknown> =>
  JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the complete-look sequence', () => {
  it('sends the garment result into the makeup task, in that order', async () => {
    const fetchMock = stubHappyPath();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const outcome = await runCompleteLookSequence(request);

    // Step 1 goes to the clothes task with both references.
    const [clothesUrl] = fetchMock.mock.calls[0]!;
    expect(clothesUrl).toBe('https://yce-api-01.makeupar.com/s2s/v2.0/task/cloth-v3');
    expect(bodyOf(fetchMock.mock.calls[0])).toMatchObject({
      src_file_id: 'portrait-file',
      ref_file_id: 'garment-file',
      garment_category: 'upper_body',
    });

    // The bytes uploaded between the two tasks are the ones the clothes task returned.
    const [uploadUrl, uploadInit] = fetchMock.mock.calls[4]!;
    expect(uploadUrl).toBe('https://uploads.example/made-up');
    expect(uploadInit?.body).toEqual(GARMENT_BYTES);

    // Step 2 goes to the makeup task, using the file id that upload produced — NOT the
    // original portrait. This assertion is the whole increment in one line.
    const [makeupUrl] = fetchMock.mock.calls[5]!;
    expect(makeupUrl).toBe('https://yce-api-01.makeupar.com/s2s/v2.0/task/makeup-vto');
    const makeupBody = bodyOf(fetchMock.mock.calls[5]);
    expect(makeupBody['src_file_id']).toBe('made-up-source-file');
    expect(makeupBody['src_file_id']).not.toBe('portrait-file');
    expect(makeupBody['effects']).toBeInstanceOf(Array);

    expect(outcome.garmentOnly.result.status).toBe('ready');
    expect(outcome.completeLook.result.status).toBe('ready');
  });

  it('marks the second image a complete look and the first one not', async () => {
    stubHappyPath();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const outcome = await runCompleteLookSequence(request);

    expect(outcome.garmentOnly.stage).toBe('garmentOnly');
    expect(outcome.completeLook.stage).toBe('completeLook');
    expect(outcome.garmentOnly.provenance).toBe('live');
    expect(outcome.completeLook.provenance).toBe('live');
  });

  it('returns each image to the browser as data, never as a provider URL', async () => {
    stubHappyPath();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const outcome = await runCompleteLookSequence(request);

    for (const panel of [outcome.garmentOnly, outcome.completeLook]) {
      expect(panel.result.status).toBe('ready');
      if (panel.result.status !== 'ready') return;
      expect(panel.result.imageUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
      expect(panel.result.imageUrl).not.toContain('results.example');
    }
  });

  it('hands each step to onStep with the bytes that step produced', async () => {
    stubHappyPath();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const steps: Array<{ step: string; bytes: Buffer }> = [];
    await runCompleteLookSequence({
      ...request,
      onStep: (step, detail) => {
        steps.push({ step, bytes: detail.image.bytes });
      },
    });

    expect(steps.map((entry) => entry.step)).toEqual(['garment', 'completeLook']);
    expect(steps[0]!.bytes).toEqual(GARMENT_BYTES);
    expect(steps[1]!.bytes).toEqual(COMPLETE_BYTES);
  });

  it('keeps the garment preview when only the makeup step fails', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(startedTask('clothes-1'))
      .mockResolvedValueOnce(succeededTask('clothes-1', 'https://results.example/garment.jpg'))
      .mockResolvedValueOnce(imageBody(GARMENT_BYTES))
      // The upload slot for the makeup step is refused.
      .mockResolvedValue(new Response('nope', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const outcome = await runCompleteLookSequence(request);

    expect(outcome.garmentOnly.result.status).toBe('ready');
    expect(outcome.garmentOnly.stage).toBe('garmentOnly');
    expect(outcome.completeLook.result.status).toBe('failed');
    // No stage on a failed panel: nothing rendered it, so nothing may be claimed of it.
    expect(outcome.completeLook.stage).toBeUndefined();
  });

  it('fails both panels, without starting the makeup task, when the garment task fails', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(startedTask('clothes-1'))
      .mockResolvedValueOnce(json({ task_id: 'clothes-1', task_status: 'error' }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const outcome = await runCompleteLookSequence(request);

    expect(outcome.garmentOnly.result.status).toBe('failed');
    expect(outcome.completeLook.result.status).toBe('failed');
    expect(outcome.completeLook.stage).toBeUndefined();
    // Two calls only: start and poll. Nothing was spent on a makeup task that had no
    // image to work from.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never lets a signed provider URL reach the browser in a failure reason', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(startedTask('clothes-1'))
      .mockResolvedValueOnce(
        json({
          task_id: 'clothes-1',
          task_status: 'error',
          detail: 'https://results.example/signed?token=secret',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const outcome = await runCompleteLookSequence(request);

    expect(outcome.garmentOnly.result.status).toBe('failed');
    if (outcome.garmentOnly.result.status !== 'failed') return;
    expect(outcome.garmentOnly.result.reason).not.toContain('token=secret');
    expect(outcome.garmentOnly.result.reason).toContain('[url redacted]');
  });
});
