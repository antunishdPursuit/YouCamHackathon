import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { skinAnalysisRouter } from './skinAnalysis.js';
import { videoRouter } from './video.js';
import { analyzeRouter } from './analyze.js';
import { setBudgetStoreForTests, resetBudgetStoreForTests } from '../youcam/budgetStore.js';
import { createFailClosedBudgetStore } from '../youcam/budget.js';

const localFetch = fetch;
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); resetBudgetStoreForTests(); });
describe('paid routes fail before provider work', () => {
  it.each(['skin-analysis', 'video', 'analyze'])('guards %s', async route => {
    vi.stubEnv('YINCOL_API_KEY', 'test-only');
    vi.stubEnv('YINCOL_FIXTURE_MODE', route === 'analyze' ? 'false' : 'true');
    vi.stubEnv('YINCOL_LIVE_SKIN_ANALYSIS', 'true');
    vi.stubEnv('YINCOL_LIVE_VIDEO', 'true');
    setBudgetStoreForTests(createFailClosedBudgetStore());
    const providerFetch = vi.fn(() => { throw new Error('Unexpected provider call'); });
    vi.stubGlobal('fetch', providerFetch);
    const app = express(); app.use(express.json()); app.use('/api', skinAnalysisRouter, videoRouter, analyzeRouter);
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    try {
      const response = await localFetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/${route}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: { data: 'AAAA', contentType: 'image/png' }, imageUrl: 'data:image/png;base64,AAAA', portraitRef: 'https://example.com/portrait.png' }),
      });
      expect(response.status).toBe(503);
      expect(providerFetch).not.toHaveBeenCalled();
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
