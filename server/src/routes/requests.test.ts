import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { TryOnResponse } from '@yincol/shared';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tryOnRouter } from './tryOn.js';
import { analyzeRouter } from './analyze.js';
import { skinAnalysisRouter } from './skinAnalysis.js';
import { asyncRoute } from './asyncRoute.js';

vi.mock('../fixtures/index.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../fixtures/index.js')>(),
  fixtureDelay: async () => {},
}));

let server: Server;
let origin: string;
const valid = { garmentIds: ['rosewater-cardigan', 'sage-linen-shirt'], makeupLookId: 'rose-veil' };

beforeAll(async () => {
  vi.stubEnv('YINCOL_API_KEY', '');
  vi.stubEnv('YINCOL_FIXTURE_MODE', 'true');
  vi.stubEnv('YINCOL_LIVE_TRY_ON', 'false');
  vi.stubEnv('YINCOL_LIVE_SKIN_ANALYSIS', 'false');
  vi.stubEnv('YINCOL_SIMULATE', 'none');
  const app = express();
  app.use(express.json());
  app.use('/api', tryOnRouter, analyzeRouter, skinAnalysisRouter);
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/reject', asyncRoute(async () => { throw new Error('private provider detail'); }));
  app.use((_error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: 'Request failed.' });
  });
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  vi.unstubAllEnvs();
});

const post = (route: string, body: unknown) => fetch(origin + '/api/' + route, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('public fixture request boundaries', () => {
  it.each([[1], [null], [{}], [], ['unknown'], ['__proto__'], ['constructor'],
    ['rosewater-cardigan', 'rosewater-cardigan'],
    ['rosewater-cardigan', 'sage-linen-shirt', 'third']])(
    'rejects invalid garment IDs %j and remains available', async (...ids) => {
      // Each table row is an ID array, spread by Vitest into the callback.
      const response = await post('try-on', { ...valid, garmentIds: ids });
      expect(response.status).toBe(400);
      expect((await fetch(origin + '/health')).status).toBe(200);
    },
  );
  it.each([null, 42, {}, 'unknown'])('rejects invalid makeup %j', async makeupLookId => {
    expect((await post('try-on', { ...valid, makeupLookId })).status).toBe(400);
  });
  it('rejects missing and non-object request shapes', async () => {
    expect((await post('try-on', {})).status).toBe(400);
    expect((await post('try-on', [])).status).toBe(400);
  });
  it('still returns both captured complete looks for valid inputs', async () => {
    const response = await post('try-on', valid);
    expect(response.status).toBe(200);
    const result = await response.json() as TryOnResponse;
    expect(result.mode).toBe('fixture');
    expect(Object.keys(result.completeLooks)).toEqual(valid.garmentIds);
    expect(result.completeLooks['rosewater-cardigan']?.result.status).toBe('ready');
  });
  it.each(['analyze', 'skin-analysis', 'try-on'])('%s rejects image payloads', async route => {
    expect((await post(route, { ...valid, image: { data: 'AAAA', contentType: 'image/png' } })).status).toBe(400);
  });
  it('rejects image bytes disguised as a portrait reference', async () => {
    expect((await post('analyze', { portraitRef: 'data:image/png;base64,AAAA' })).status).toBe(400);
  });
  it('forwards async rejections to error middleware without stopping the process', async () => {
    const response = await fetch(origin + '/reject');
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private provider detail');
    expect((await fetch(origin + '/health')).status).toBe(200);
  });
});
