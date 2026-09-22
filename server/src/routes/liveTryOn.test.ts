import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { TryOnResponse } from '@yincol/shared';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { loadConfig } from '../youcam/config.js';
import { createRequestBodyParser } from '../requestBody.js';
import { tryOnRouter } from './tryOn.js';

const provider = vi.hoisted(() => ({
  prepare: vi.fn(async () => ({ kind: 'fileId', fileId: 'uploaded' })),
  sequence: vi.fn(async (_request: { look: { id: string } }) => ({
    garmentOnly: { result: { status: 'ready', imageUrl: 'data:image/png;base64,AAAA', alt: 'Mock garment' }, provenance: 'live', stage: 'garmentOnly' },
    completeLook: { result: { status: 'ready', imageUrl: 'data:image/png;base64,BBBB', alt: 'Mock complete look' }, provenance: 'live', stage: 'completeLook' },
  })),
}));
vi.mock('../youcam/imageInput.js', async original => ({
  ...await original<typeof import('../youcam/imageInput.js')>(),
  fileUploadStrategy: { prepare: provider.prepare },
}));
vi.mock('../youcam/completeLook.js', () => ({ runCompleteLookSequence: provider.sequence }));

let server: Server | undefined;
afterEach(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(e => e ? reject(e) : resolve()));
  server = undefined;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
async function start(liveTryOn: boolean, liveSkinAnalysis = false, key = 'test-key') {
  vi.stubEnv('YINCOL_FIXTURE_MODE', 'true');
  vi.stubEnv('YINCOL_API_KEY', key);
  vi.stubEnv('YINCOL_LIVE_TRY_ON', String(liveTryOn));
  vi.stubEnv('YINCOL_LIVE_SKIN_ANALYSIS', String(liveSkinAnalysis));
  const app = express();
  app.use(createRequestBodyParser(loadConfig()));
  app.use('/api', tryOnRouter);
  app.post('/size-check', (_req, res) => res.sendStatus(204));
  app.use((err: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({ error: 'Request refused.' });
  });
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  return 'http://127.0.0.1:' + (server!.address() as AddressInfo).port;
}
const image = { data: Buffer.alloc(40_000, 1).toString('base64'), contentType: 'image/png' };
const body = {
  portraitRef: 'fixture:portrait', portrait: image,
  garmentIds: ['rosewater-cardigan', 'sage-linen-shirt'],
  garmentImages: { 'rosewater-cardigan': image, 'sage-linen-shirt': image },
  makeupLookId: 'champagne-halo',
};
const post = (url: string) => fetch(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
describe('live uploads while palette mode remains fixture', () => {
  it('accepts image-sized uploads and sends the selected non-demo look to both sequences', async () => {
    const origin = await start(true);
    const response = await post(origin + '/api/try-on');
    expect(response.status).toBe(200);
    const result = await response.json() as TryOnResponse;
    expect(result.mode).toBe('live');
    expect(provider.prepare).toHaveBeenCalledTimes(4);
    expect(provider.sequence).toHaveBeenCalledTimes(2);
    for (const [request] of provider.sequence.mock.calls) {
      expect(request.look.id).toBe('champagne-halo');
    }
    for (const id of body.garmentIds) {
      expect(result.completeLooks[id]).toMatchObject({ provenance: 'live', stage: 'completeLook', result: { status: 'ready' } });
    }
  });
  it('keeps the small request limit in fixture-only mode', async () => {
    const origin = await start(false);
    expect((await post(origin + '/api/try-on')).status).toBe(413);
    expect(provider.prepare).not.toHaveBeenCalled();
  });
  it('allows image-sized bodies when only live skin analysis is enabled', async () => {
    const origin = await start(false, true);
    expect((await post(origin + '/size-check')).status).toBe(204);
    expect(provider.prepare).not.toHaveBeenCalled();
  });
  it('does not open uploads when live flags have no API key', async () => {
    const origin = await start(true, true, '');
    expect((await post(origin + '/api/try-on')).status).toBe(413);
    expect(provider.prepare).not.toHaveBeenCalled();
  });
});
