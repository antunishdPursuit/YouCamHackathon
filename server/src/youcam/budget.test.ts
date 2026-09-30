import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUDGET_KEY, DAY_MS, createBudgetStore, createFailClosedBudgetStore, estimateUnits, type RedisLike } from './budget.js';
// Models atomic CAS only. Real EVAL capability/connection is a separate deployment check.
class FakeRedis implements RedisLike {
  raw: string | null = JSON.stringify({ version: 2, readyAt: 0, charges: [], seen: {} });
  fail = false;
  loseReply = false;
  async get(_key: string) { if (this.fail) throw new Error('offline'); return this.raw; }
  async eval(_script: string, _count: number, ...args: string[]) {
    if (this.fail) throw new Error('offline');
    expect(args[0]).toBe(BUDGET_KEY);
    if ((this.raw ?? '') !== args[1]) return 0;
    this.raw = args[2]!;
    if (this.loseReply) throw new Error('reply lost after commit');
    return 1;
  }
}
const options = { siteDailyUnitCap: 100, browserWindowUnitCap: 40 };
const request = (id: string, units = 10, browserId = 'b') => ({ browserId, estimatedUnits: units, idempotencyKey: id });
afterEach(() => vi.useRealTimers());
describe('budget reservations', () => {
  it('retains every charge including ambiguous and definitive failures', async () => {
    const store = createBudgetStore(new FakeRedis(), options);
    const first = await store.reserve(request('a', 40));
    expect(first.ok).toBe(true);
    if (first.ok) await store.markOutcome(first.reservationId, 'definitiveFailure');
    expect(await store.reserve(request('b'))).toEqual({ ok: false, reason: 'browserCapExceeded' });
  });
  it('commits both limits atomically under contention without overshoot or partial charges', async () => {
    const store = createBudgetStore(new FakeRedis(), { ...options, siteDailyUnitCap: 30 });
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => store.reserve(request(String(i), 10, String(i)))));
    expect(results.filter(r => r.ok)).toHaveLength(3);
  });
  it('does not consume site units on browser rejection', async () => {
    const store = createBudgetStore(new FakeRedis(), { siteDailyUnitCap: 20, browserWindowUnitCap: 10 });
    expect((await store.reserve(request('a'))).ok).toBe(true);
    expect((await store.reserve(request('b'))).ok).toBe(false);
    expect((await store.reserve(request('c', 10, 'other'))).ok).toBe(true);
  });
  it('uses a true rolling browser window across UTC midnight and the first request boundary', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-29T12:00:00Z'));
    const store = createBudgetStore(new FakeRedis(), options);
    await store.reserve(request('a', 10));
    vi.setSystemTime(new Date('2026-09-30T11:00:00Z'));
    await store.reserve(request('b', 30));
    vi.setSystemTime(new Date('2026-09-30T12:00:01Z'));
    expect(await store.reserve(request('c', 20))).toEqual({ ok: false, reason: 'browserCapExceeded' });
    expect((await store.reserve(request('d', 10))).ok).toBe(true);
  });
  it('retains duplicate protection after five minutes, API restart and response loss', async () => {
    vi.useFakeTimers(); vi.setSystemTime(10 * DAY_MS);
    const client = new FakeRedis(); client.loseReply = true;
    expect((await createBudgetStore(client, options).reserve(request('same'))).ok).toBe(false);
    client.loseReply = false; vi.setSystemTime(11 * DAY_MS);
    expect(await createBudgetStore(client, options).reserve(request('same'))).toEqual({ ok: false, reason: 'duplicateSubmission' });
  });
  it('pauses for 24 hours after missing state, retains the pause across API restarts and restarts it on repeated loss', async () => {
    vi.useFakeTimers(); vi.setSystemTime(10 * DAY_MS);
    const client = new FakeRedis(); client.raw = null;
    const store = createBudgetStore(client, options);
    expect((await store.reserve(request('a'))).ok).toBe(false);
    vi.setSystemTime(11 * DAY_MS - 1);
    expect((await createBudgetStore(client, options).reserve(request('a'))).ok).toBe(false);
    vi.setSystemTime(11 * DAY_MS);
    expect((await store.reserve(request('a'))).ok).toBe(true);
    client.raw = null;
    expect((await store.reserve(request('b'))).ok).toBe(false);
    expect(JSON.parse(client.raw!).readyAt).toBe(12 * DAY_MS);
  });
  it('fails closed for unavailable/corrupt state and invalid units', async () => {
    const client = new FakeRedis(); client.fail = true;
    expect((await createBudgetStore(client, options).reserve(request('a'))).ok).toBe(false);
    client.fail = false; client.raw = '{}';
    expect((await createBudgetStore(client, options).reserve(request('a'))).ok).toBe(false);
    expect((await createBudgetStore(new FakeRedis(), options).reserve(request('a', -1))).ok).toBe(false);
    expect((await createFailClosedBudgetStore().reserve(request('a'))).ok).toBe(false);
  });
});
it('estimates current pipelines separately from video and skin analysis', () => {
  expect(estimateUnits({ hasFullBody: false, hasSkinAnalysis: false })).toBe(7);
  expect(estimateUnits({ hasFullBody: true, hasSkinAnalysis: false })).toBe(9);
  expect(estimateUnits({ hasFullBody: true, hasSkinAnalysis: true })).toBe(21);
});
