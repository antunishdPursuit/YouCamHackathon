// Exercise the implemented route with a stubbed, explicitly verified provider only.
vi.mock('../youcam/config.js', async (original) => {
  const actual = await original<typeof import('../youcam/config.js')>();
  return { ...actual, TASK_PATH_VERIFIED: { ...actual.TASK_PATH_VERIFIED, video: true } };
});
/**
 * POST /api/video, both branches. The live branch is exercised entirely against mocked
 * `fileUploadStrategy`/`taskRunner`/`adapters/video` — the real provider call is never
 * reachable from tests, the same as it is not reachable in production (see video.ts's
 * header comment on why `fileUploadStrategy.prepare(..., 'video', ...)` fails closed).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { VideoResponse } from '@yincol/shared';
import { createAlwaysAvailableBudgetStore, createBudgetStore } from '../youcam/budget.js';
import { setBudgetStoreForTests, resetBudgetStoreForTests } from '../youcam/budgetStore.js';
import { videoRouter } from './video.js';

const provider = vi.hoisted(() => ({
  prepare: vi.fn(async () => ({ kind: 'fileId', fileId: 'uploaded' })),
  run: vi.fn(async () => ({ taskId: 'test-task', raw: {} })),
  capture: vi.fn(async () => ({
    status: 'ready', result: { status: 'ready', videoUrl: 'data:video/mp4;base64,AAAA', alt: 'Mock clip' },
    video: { bytes: Buffer.from('x'), contentType: 'video/mp4' },
  })),
}));
vi.mock('../youcam/imageInput.js', async original => ({
  ...await original<typeof import('../youcam/imageInput.js')>(),
  fileUploadStrategy: { prepare: provider.prepare },
}));
vi.mock('../youcam/taskRunner.js', async original => ({
  ...await original<typeof import('../youcam/taskRunner.js')>(), runTask: provider.run,
}));
vi.mock('../youcam/adapters/video.js', async original => ({
  ...await original<typeof import('../youcam/adapters/video.js')>(), captureVideoLive: provider.capture,
}));

let server: Server | undefined;
beforeEach(() => {
  setBudgetStoreForTests(createAlwaysAvailableBudgetStore());
});
afterEach(async () => {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  server = undefined;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  resetBudgetStoreForTests();
});

async function start() {
  const app = express();
  app.use(express.json());
  app.use('/api', videoRouter);
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  return 'http://127.0.0.1:' + (server!.address() as AddressInfo).port;
}
const post = (origin: string, body: unknown) => fetch(origin + '/api/video', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('fixture / disabled mode', () => {
  it('returns the shipped sample for the exact image it was captured against', async () => {
    vi.stubEnv('YINCOL_FIXTURE_MODE', 'true');
    const origin = await start();
    const response = await post(origin, { imageUrl: '/fixtures/complete-look-a-result.jpg' });
    expect(response.status).toBe(200);
    const body = await response.json() as VideoResponse;
    expect(body.mode).toBe('fixture');
    expect(body.video.result).toEqual({ status: 'ready', videoUrl: '/fixtures/garment-a-motion-sample.mp4', alt: 'Saved five-second motion sample' });
    expect(body.video.provenance).toBe('captured');
  });

  it('never fabricates a clip for any other image', async () => {
    vi.stubEnv('YINCOL_FIXTURE_MODE', 'true');
    const origin = await start();
    for (const imageUrl of ['/fixtures/complete-look-b-result.jpg', 'data:image/png;base64,AAAA', '/fixtures/garment-a-result.jpg']) {
      const response = await post(origin, { imageUrl });
      expect(response.status).toBe(200);
      const body = await response.json() as VideoResponse;
      expect(body.video.result.status).toBe('failed');
    }
  });

  it('rejects a request with no image chosen', async () => {
    vi.stubEnv('YINCOL_FIXTURE_MODE', 'true');
    const origin = await start();
    expect((await post(origin, {})).status).toBe(400);
  });
});

describe('live mode (mocked provider only)', () => {
  async function startLive() {
    vi.stubEnv('YINCOL_FIXTURE_MODE', 'false');
    vi.stubEnv('YINCOL_API_KEY', 'test-key');
    vi.stubEnv('YINCOL_LIVE_VIDEO', 'true');
    return start();
  }

  it('calls the mocked provider once for a valid live image and reports success', async () => {
    const origin = await startLive();
    const response = await post(origin, { imageUrl: 'data:image/png;base64,AAAA' });
    expect(response.status).toBe(200);
    const body = await response.json() as VideoResponse;
    expect(body.mode).toBe('live');
    expect(body.video.result.status).toBe('ready');
    expect(provider.prepare).toHaveBeenCalledTimes(1);
    expect(provider.run).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed image without calling the provider', async () => {
    const origin = await startLive();
    const response = await post(origin, { imageUrl: '/fixtures/complete-look-a-result.jpg' });
    expect(response.status).toBe(400);
    expect(provider.prepare).not.toHaveBeenCalled();
  });

  it('does not call the provider when the budget is exhausted', async () => {
    setBudgetStoreForTests(createBudgetStore(fakeRedis(), { siteDailyUnitCap: 1, browserWindowUnitCap: 100 }));
    const origin = await startLive();
    const response = await post(origin, { imageUrl: 'data:image/png;base64,AAAA' });
    expect(response.status).toBe(429);
    expect(provider.prepare).not.toHaveBeenCalled();
  });
});

function fakeRedis() {
  let raw: string | null = JSON.stringify({ version: 2, readyAt: 0, charges: [], seen: {} });
  return {
    async get() { return raw; },
    async eval(_script: string, _count: number, ...args: string[]) {
      if ((raw ?? '') !== args[1]) return 0;
      raw = args[2]!; return 1;
    },
  };
}
