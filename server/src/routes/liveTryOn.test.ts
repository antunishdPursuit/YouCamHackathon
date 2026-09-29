import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { TryOnResponse } from '@yincol/shared';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { loadConfig } from '../youcam/config.js';
import { createRequestBodyParser } from '../requestBody.js';
import { createAlwaysAvailableBudgetStore } from '../youcam/budget.js';
import { setBudgetStoreForTests, resetBudgetStoreForTests } from '../youcam/budgetStore.js';
import { tryOnRouter } from './tryOn.js';

const provider = vi.hoisted(() => ({
  prepare: vi.fn(async () => ({ kind: 'fileId', fileId: 'uploaded' })),
  sequence: vi.fn(async (_request: { look: { id: string } }) => ({
    garmentOnly: { result: { status: 'ready', imageUrl: 'data:image/png;base64,AAAA', alt: 'Mock garment' }, provenance: 'live', stage: 'garmentOnly' },
    completeLook: { result: { status: 'ready', imageUrl: 'data:image/png;base64,BBBB', alt: 'Mock complete look' }, provenance: 'live', stage: 'completeLook' },
  })),
  portraitMakeup: vi.fn(async () => ({
    result: { status: 'ready', imageUrl: 'data:image/png;base64,CCCC', alt: 'Mock portrait makeup' },
    provenance: 'live', stage: 'portraitMakeup',
  })),
}));
vi.mock('../youcam/imageInput.js', async original => ({
  ...await original<typeof import('../youcam/imageInput.js')>(),
  fileUploadStrategy: { prepare: provider.prepare },
}));
vi.mock('../youcam/completeLook.js', () => ({ runCompleteLookSequence: provider.sequence }));
vi.mock('../youcam/portraitMakeup.js', () => ({ runPortraitMakeupSequence: provider.portraitMakeup }));

let server: Server | undefined;
beforeEach(() => {
  // These tests are about upload/sequence wiring, not the budget gate — force it open so
  // a live request always gets past it. budget.test.ts covers the gate itself.
  setBudgetStoreForTests(createAlwaysAvailableBudgetStore());
});
afterEach(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(e => e ? reject(e) : resolve()));
  server = undefined;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  resetBudgetStoreForTests();
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
    expect(provider.portraitMakeup).toHaveBeenCalledTimes(1);
    for (const [request] of provider.sequence.mock.calls) {
      expect(request.look.id).toBe('champagne-halo');
    }
    for (const id of body.garmentIds) {
      expect(result.completeLooks[id]).toMatchObject({ provenance: 'live', stage: 'completeLook', result: { status: 'ready' } });
    }
    expect(result.portraitMadeUp).toMatchObject({ provenance: 'live', stage: 'portraitMakeup', result: { status: 'ready' } });
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

describe('the budget gate', () => {
  it('refuses live work when no budget store is configured, without calling the provider', async () => {
    resetBudgetStoreForTests(); // undo this file's default always-available override
    const origin = await start(true);
    const response = await post(origin + '/api/try-on');
    expect(response.status).toBe(503);
    expect(provider.prepare).not.toHaveBeenCalled();
  });

  it('rejects once the site cap is exhausted, without calling the provider', async () => {
    const { createBudgetStore } = await import('../youcam/budget.js');
    setBudgetStoreForTests(createBudgetStore(fakeRedis(), { siteDailyUnitCap: 1, browserWindowUnitCap: 100 }));
    const origin = await start(true);
    const response = await post(origin + '/api/try-on');
    expect(response.status).toBe(429);
    expect(provider.prepare).not.toHaveBeenCalled();
  });

  it('rejects an identical resubmission as a duplicate, calling the provider at most once', async () => {
    const { createBudgetStore } = await import('../youcam/budget.js');
    setBudgetStoreForTests(createBudgetStore(fakeRedis(), { siteDailyUnitCap: 1000, browserWindowUnitCap: 1000 }));
    const origin = await start(true);
    const [first, second] = await Promise.all([post(origin + '/api/try-on'), post(origin + '/api/try-on')]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect(provider.sequence).toHaveBeenCalledTimes(2); // one request's two garments, not four
  });
});

/** A minimal, honest in-memory stand-in for the Redis commands `budget.ts` issues — the
 * same shape `budget.test.ts` exercises in depth; this file only needs it to get a real
 * `createBudgetStore` past its gate for these route-level tests. */
function fakeRedis() {
  const values = new Map<string, string>();
  const numbers = new Map<string, number>();
  return {
    async set(key: string, value: string, _mode: 'PX', _ttl: number, flag: 'NX') {
      if (flag === 'NX' && values.has(key)) return null;
      values.set(key, value);
      return 'OK' as const;
    },
    async incrby(key: string, amount: number) {
      const next = (numbers.get(key) ?? 0) + amount;
      numbers.set(key, next);
      return next;
    },
    async decrby(key: string, amount: number) {
      const next = (numbers.get(key) ?? 0) - amount;
      numbers.set(key, next);
      return next;
    },
    async expire() { return 1; },
    async get(key: string) { return values.get(key) ?? null; },
    async del(key: string) {
      const had = values.delete(key);
      numbers.delete(key);
      return had ? 1 : 0;
    },
  };
}
