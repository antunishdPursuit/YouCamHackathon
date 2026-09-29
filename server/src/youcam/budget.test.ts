/**
 * The budget algorithm, against a plain in-memory fake of the Redis commands it uses —
 * not a mock of `ioredis`, and no real network or store. `redisClient.ts` is the one place
 * a real connection is made, and it is untested here on purpose: nobody in this codebase
 * has verified a real Render Key Value connection yet.
 */

import { describe, expect, it } from 'vitest';
import { createBudgetStore, createFailClosedBudgetStore, estimateUnits, type RedisLike } from './budget.js';

/** A small, honest simulation of the four command semantics this module relies on. */
class FakeRedis implements RedisLike {
  private readonly values = new Map<string, string>();
  private readonly numbers = new Map<string, number>();
  failNext = false;

  private guard() {
    if (this.failNext) { this.failNext = false; throw new Error('store unavailable'); }
  }

  async set(key: string, value: string, _mode: 'PX', _ttlMs: number, flag: 'NX'): Promise<'OK' | null> {
    this.guard();
    if (flag === 'NX' && this.values.has(key)) return null;
    this.values.set(key, value);
    return 'OK';
  }
  async incrby(key: string, amount: number): Promise<number> {
    this.guard();
    const next = (this.numbers.get(key) ?? 0) + amount;
    this.numbers.set(key, next);
    return next;
  }
  async decrby(key: string, amount: number): Promise<number> {
    this.guard();
    const next = (this.numbers.get(key) ?? 0) - amount;
    this.numbers.set(key, next);
    return next;
  }
  async expire(_key: string, _seconds: number): Promise<number> {
    this.guard();
    return 1;
  }
  async get(key: string): Promise<string | null> {
    this.guard();
    return this.values.get(key) ?? null;
  }
  async del(key: string): Promise<number> {
    this.guard();
    const had = this.values.delete(key);
    this.numbers.delete(key);
    return had ? 1 : 0;
  }
}

const options = { siteDailyUnitCap: 100, browserWindowUnitCap: 40 };

describe('estimateUnits', () => {
  it('matches the README\'s documented estimates', () => {
    expect(estimateUnits({ hasFullBody: false, hasSkinAnalysis: false })).toBe(9);
    expect(estimateUnits({ hasFullBody: true, hasSkinAnalysis: false })).toBe(17);
    expect(estimateUnits({ hasFullBody: false, hasSkinAnalysis: true })).toBe(21);
    expect(estimateUnits({ hasFullBody: true, hasSkinAnalysis: true })).toBe(29);
  });
});

describe('createBudgetStore — reservation', () => {
  it('reserves under both caps and charges nothing on a definitive failure', async () => {
    const store = createBudgetStore(new FakeRedis(), options);
    const result = await store.reserve({ browserId: 'b1', estimatedUnits: 9, idempotencyKey: 'req-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    await store.markOutcome(result.reservationId, 'definitiveFailure');
    // A second, identical-cost reservation for a DIFFERENT request should succeed cleanly,
    // proving the refund actually happened rather than merely not erroring.
    const second = await store.reserve({ browserId: 'b1', estimatedUnits: 40, idempotencyKey: 'req-2' });
    expect(second.ok).toBe(true);
  });

  it('keeps the charge on success or an ambiguous outcome', async () => {
    const client = new FakeRedis();
    const store = createBudgetStore(client, { siteDailyUnitCap: 20, browserWindowUnitCap: 20 });
    const first = await store.reserve({ browserId: 'b1', estimatedUnits: 15, idempotencyKey: 'req-1' });
    expect(first.ok).toBe(true);
    if (first.ok) await store.markOutcome(first.reservationId, 'ambiguous');
    // The site cap (20) has 15 already charged and not refunded, so a further 10-unit
    // reservation must be rejected.
    const second = await store.reserve({ browserId: 'b2', estimatedUnits: 10, idempotencyKey: 'req-2' });
    expect(second).toEqual({ ok: false, reason: 'siteCapExceeded' });
  });

  it('rejects and charges nothing once the site cap is exceeded', async () => {
    const store = createBudgetStore(new FakeRedis(), { siteDailyUnitCap: 10, browserWindowUnitCap: 40 });
    const first = await store.reserve({ browserId: 'b1', estimatedUnits: 9, idempotencyKey: 'req-1' });
    expect(first.ok).toBe(true);
    const second = await store.reserve({ browserId: 'b2', estimatedUnits: 9, idempotencyKey: 'req-2' });
    expect(second).toEqual({ ok: false, reason: 'siteCapExceeded' });
    // The rejected reservation must not have left a partial charge behind: a third request
    // for exactly the remaining headroom (1 unit) should still fit under the cap.
    const third = await store.reserve({ browserId: 'b3', estimatedUnits: 1, idempotencyKey: 'req-3' });
    expect(third.ok).toBe(true);
  });

  it('rejects and charges nothing once the browser cap is exceeded, without touching the site cap', async () => {
    const store = createBudgetStore(new FakeRedis(), { siteDailyUnitCap: 100, browserWindowUnitCap: 10 });
    const first = await store.reserve({ browserId: 'b1', estimatedUnits: 9, idempotencyKey: 'req-1' });
    expect(first.ok).toBe(true);
    const second = await store.reserve({ browserId: 'b1', estimatedUnits: 9, idempotencyKey: 'req-2' });
    expect(second).toEqual({ ok: false, reason: 'browserCapExceeded' });
    // A different browser, still well under the site cap, must be unaffected.
    const other = await store.reserve({ browserId: 'b2', estimatedUnits: 9, idempotencyKey: 'req-3' });
    expect(other.ok).toBe(true);
  });

  it('rejects a duplicate submission without charging either counter twice', async () => {
    const store = createBudgetStore(new FakeRedis(), options);
    const first = await store.reserve({ browserId: 'b1', estimatedUnits: 9, idempotencyKey: 'same-request' });
    expect(first.ok).toBe(true);
    const duplicate = await store.reserve({ browserId: 'b1', estimatedUnits: 9, idempotencyKey: 'same-request' });
    expect(duplicate).toEqual({ ok: false, reason: 'duplicateSubmission' });
  });

  it('surfaces a store failure as storeUnavailable rather than throwing', async () => {
    const client = new FakeRedis();
    client.failNext = true;
    const store = createBudgetStore(client, options);
    const result = await store.reserve({ browserId: 'b1', estimatedUnits: 9, idempotencyKey: 'req-1' });
    expect(result).toEqual({ ok: false, reason: 'storeUnavailable' });
  });

  it('an unmarked reservation is simply never refunded', async () => {
    const store = createBudgetStore(new FakeRedis(), { siteDailyUnitCap: 10, browserWindowUnitCap: 40 });
    const first = await store.reserve({ browserId: 'b1', estimatedUnits: 9, idempotencyKey: 'req-1' });
    expect(first.ok).toBe(true);
    // No markOutcome call at all — a crashed or forgotten request.
    const second = await store.reserve({ browserId: 'b2', estimatedUnits: 5, idempotencyKey: 'req-2' });
    expect(second).toEqual({ ok: false, reason: 'siteCapExceeded' });
  });
});

describe('createFailClosedBudgetStore', () => {
  it('never allows a reservation and never throws on markOutcome', async () => {
    const store = createFailClosedBudgetStore();
    const result = await store.reserve({ browserId: 'b1', estimatedUnits: 9, idempotencyKey: 'req-1' });
    expect(result).toEqual({ ok: false, reason: 'storeUnavailable' });
    await expect(store.markOutcome('anything', 'success')).resolves.toBeUndefined();
  });
});

describe('concurrency near the cap boundary', () => {
  it('never lets successful reservations exceed the cap by more than one in-flight request', async () => {
    const store = createBudgetStore(new FakeRedis(), { siteDailyUnitCap: 30, browserWindowUnitCap: 1000 });
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        store.reserve({ browserId: `b${i}`, estimatedUnits: 10, idempotencyKey: `req-${i}` })),
    );
    const okCount = results.filter(r => r.ok).length;
    // Cap is 30, each request is 10 units: at most 3 can succeed if none overshoot, and the
    // plain INCRBY-then-check-then-DECRBY approach (documented as non-atomic under real
    // concurrency) can't let more than a handful transiently overshoot in this fake, which
    // runs each command synchronously in turn.
    expect(okCount).toBeLessThanOrEqual(4);
    expect(okCount).toBeGreaterThanOrEqual(3);
  });
});
