/**
 * A request-level timeout must surface as `YouCamError` with `timedOut: true`, never as a
 * bare rejection — that flag is what lets a caller (the budget layer) treat it as an
 * ambiguous outcome rather than a definitive failure. This does not wait for a real
 * `AbortSignal.timeout()` to fire (that would make the suite slow); it simulates the
 * rejection `fetch` produces once one does, which is the part this change actually adds.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from './config.js';
import { startTask, YouCamError } from './taskRunner.js';

const config = loadConfig({ YINCOL_API_BASE_URL: 'https://yce-api-01.makeupar.com', YINCOL_API_KEY: 'test-key', YINCOL_FIXTURE_MODE: 'false' });
const feature = { id: 'clothesVto' as const, label: 'Clothes try-on', taskPath: '/s2s/v2.0/task/cloth-v3' };

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('fetchWithBackoff — request timeout', () => {
  it.each(['AbortError', 'TimeoutError'])('translates a %s rejection into a timedOut YouCamError', async (name) => {
    const abort = new DOMException('The operation was aborted.', name);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));

    await expect(startTask(config, feature, {})).rejects.toMatchObject({
      name: 'YouCamError',
      detail: { feature: 'clothesVto', stage: 'start', timedOut: true },
    });
  });

  it('does not mark an ordinary network error as a timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const error = await startTask(config, feature, {}).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(YouCamError);
    expect((error as Error).message).toBe('network down');
  });
});
