/**
 * The shared YouCam unit budget.
 *
 * Two caps, both server-owned: at most `siteDailyUnitCap` units across every visitor on
 * one UTC calendar day, and at most `browserWindowUnitCap` units for one browser in a
 * rolling-ish 24-hour window (a fixed window starting at that browser's first live request
 * — see the note on `browserWindowSeconds` below, not a true sliding log). The browser cap
 * is a fairness heuristic, not a security boundary: a visitor who clears their identity
 * only reshuffles who draws from the same hard site-wide cap, never raises it.
 *
 * `reserve` charges the FULL estimated cost before any provider call is allowed to start —
 * "reserve before you spend", not "spend, then check". `markOutcome` only ever refunds on a
 * DEFINITIVE total failure; a timeout or a partial success keeps the whole reservation
 * charged, because only the aggregate unit estimates below are documented, not a verified
 * per-task cost breakdown. This is deliberately conservative — see docs/api-findings.md.
 *
 * The store this module drives is Redis-shaped (Render's Key Value service is
 * Redis-protocol compatible), but nothing here imports `ioredis` directly: `RedisLike` is
 * the small slice of commands actually used, so the whole algorithm is unit-testable
 * against a plain in-memory fake, and `redisClient.ts` is the one place a real connection
 * gets made.
 */

import { randomUUID } from 'node:crypto';

/** The README's own recorded unit estimates — one place, so the doc and the code agree. */
export const CLOSE_UP_UNITS = 6;
export const FULL_BODY_UNITS = 8;
export const SKIN_ANALYSIS_UNITS = 12;
export const PORTRAIT_MAKEUP_UNITS = 3;
export const VIDEO_UNIT_COST = 10;

export interface EstimateInput {
  readonly hasFullBody: boolean;
  readonly hasSkinAnalysis: boolean;
}

/**
 * The full estimated cost of one generation request, reserved atomically before any
 * provider call. Close-up already includes the portrait-makeup panel added alongside the
 * two garment sequences, matching the README's documented "9 units" close-up estimate
 * (6 + 3).
 */
export function estimateUnits({ hasFullBody, hasSkinAnalysis }: EstimateInput): number {
  return (
    CLOSE_UP_UNITS +
    PORTRAIT_MAKEUP_UNITS +
    (hasFullBody ? FULL_BODY_UNITS : 0) +
    (hasSkinAnalysis ? SKIN_ANALYSIS_UNITS : 0)
  );
}

export interface ReserveParams {
  readonly browserId: string;
  readonly estimatedUnits: number;
  /** A stable hash of the validated request, so an identical resubmission is deflected. */
  readonly idempotencyKey: string;
}

export type ReserveResult =
  | { readonly ok: true; readonly reservationId: string }
  | { readonly ok: false; readonly reason: 'siteCapExceeded' | 'browserCapExceeded' | 'duplicateSubmission' | 'storeUnavailable' };

export type ReservationOutcome =
  /** At least one sub-task produced a usable result. Keep the charge. */
  | 'success'
  /** Every sub-task failed with a definitive, non-ambiguous status. Refund in full. */
  | 'definitiveFailure'
  /** A timeout or an unknown status touched the request somewhere. Keep the charge. */
  | 'ambiguous';

export interface BudgetStore {
  reserve(params: ReserveParams): Promise<ReserveResult>;
  markOutcome(reservationId: string, outcome: ReservationOutcome): Promise<void>;
}

/**
 * The Redis commands this module actually issues, named and shaped exactly as `ioredis`
 * exposes them — a real `Redis` client satisfies this by construction, and tests supply a
 * plain in-memory fake instead of mocking the `ioredis` module or reaching a real server.
 */
export interface RedisLike {
  set(key: string, value: string, mode: 'PX', ttlMs: number, flag: 'NX'): Promise<'OK' | null>;
  incrby(key: string, amount: number): Promise<number>;
  decrby(key: string, amount: number): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
}

export interface BudgetStoreOptions {
  readonly siteDailyUnitCap: number;
  readonly browserWindowUnitCap: number;
}

const KEY_PREFIX = 'yincol:budget:v1';
const LOCK_TTL_MS = 5 * 60_000;
/** Long enough to survive any real request; short enough not to leak keys forever if a
 * caller crashes before calling `markOutcome`. An un-marked reservation simply never gets
 * refunded — conservative, matching "no automatic refunds for ambiguous outcomes". */
const RESERVATION_TTL_MS = 30 * 60_000;
const BROWSER_WINDOW_SECONDS = 24 * 60 * 60;
/** One day plus slack, so a slow request just before UTC midnight still finds its counter. */
const SITE_DAY_SECONDS = 2 * 24 * 60 * 60;

const utcDateString = (at: Date = new Date()): string => at.toISOString().slice(0, 10);

interface ReservationRecord {
  readonly browserId: string;
  readonly units: number;
  readonly siteKey: string;
  readonly browserKey: string;
}

/**
 * The real algorithm, against any `RedisLike` client.
 *
 * Atomicity note (an open decision — see the PR description): this uses plain
 * `INCRBY`/`DECRBY`, not a Lua script, because Render Key Value's support for `EVAL` is not
 * confirmed. Two requests racing at the exact cap boundary can transiently push a counter a
 * little over the cap before the losing one rolls itself back — bounded by the number of
 * concurrent requests, self-correcting, and acceptable at this traffic scale, but not the
 * single round-trip a Lua script would give. Swap in a scripted version once scripting
 * support is confirmed, behind this same `BudgetStore` interface.
 */
export function createBudgetStore(client: RedisLike, options: BudgetStoreOptions): BudgetStore {
  const { siteDailyUnitCap, browserWindowUnitCap } = options;

  async function chargeCounter(key: string, units: number, cap: number, ttlSeconds: number): Promise<boolean> {
    const total = await client.incrby(key, units);
    if (total === units) await client.expire(key, ttlSeconds);
    if (total > cap) {
      await client.decrby(key, units);
      return false;
    }
    return true;
  }

  return {
    async reserve({ browserId, estimatedUnits, idempotencyKey }): Promise<ReserveResult> {
      const reservationId = randomUUID();
      const lockKey = `${KEY_PREFIX}:lock:${idempotencyKey}`;

      let locked: 'OK' | null;
      try {
        locked = await client.set(lockKey, reservationId, 'PX', LOCK_TTL_MS, 'NX');
      } catch {
        return { ok: false, reason: 'storeUnavailable' };
      }
      if (locked !== 'OK') return { ok: false, reason: 'duplicateSubmission' };

      const siteKey = `${KEY_PREFIX}:site:day:${utcDateString()}`;
      const browserKey = `${KEY_PREFIX}:browser:${browserId}:window`;

      try {
        const siteOk = await chargeCounter(siteKey, estimatedUnits, siteDailyUnitCap, SITE_DAY_SECONDS);
        if (!siteOk) {
          await client.del(lockKey);
          return { ok: false, reason: 'siteCapExceeded' };
        }

        const browserOk = await chargeCounter(browserKey, estimatedUnits, browserWindowUnitCap, BROWSER_WINDOW_SECONDS);
        if (!browserOk) {
          await client.decrby(siteKey, estimatedUnits);
          await client.del(lockKey);
          return { ok: false, reason: 'browserCapExceeded' };
        }

        const record: ReservationRecord = { browserId, units: estimatedUnits, siteKey, browserKey };
        await client.set(`${KEY_PREFIX}:reservation:${reservationId}`, JSON.stringify(record), 'PX', RESERVATION_TTL_MS, 'NX');
        return { ok: true, reservationId };
      } catch {
        // Whatever succeeded above is left in place rather than guessed at — an unreachable
        // store partway through is exactly the case the caller's `storeUnavailable` pause
        // exists for, and it must not additionally risk decrementing a counter it never
        // successfully incremented.
        return { ok: false, reason: 'storeUnavailable' };
      }
    },

    async markOutcome(reservationId, outcome): Promise<void> {
      const recordKey = `${KEY_PREFIX}:reservation:${reservationId}`;
      try {
        const raw = await client.get(recordKey);
        if (!raw) return;
        const record = JSON.parse(raw) as ReservationRecord;
        if (outcome === 'definitiveFailure') {
          await client.decrby(record.siteKey, record.units);
          await client.decrby(record.browserKey, record.units);
        }
        await client.del(recordKey);
      } catch {
        // A store outage here means the reservation simply expires on its own TTL and is
        // never refunded — the conservative direction, matching "no automatic refunds for
        // ambiguous outcomes".
      }
    },
  };
}

/**
 * Used whenever `YINCOL_KV_URL` is unset: every reservation fails closed with
 * `storeUnavailable`, exactly like the API key's absence already fails every live route
 * closed. No live, budget-gated work can ever run without a real store configured.
 */
export function createFailClosedBudgetStore(): BudgetStore {
  return {
    async reserve() {
      return { ok: false, reason: 'storeUnavailable' };
    },
    async markOutcome() {
      /* Nothing was ever reserved. */
    },
  };
}

/**
 * Test-only convenience: every reservation succeeds, nothing is ever tracked. For route
 * tests that need to get past the budget gate to exercise what happens after it, without
 * asserting anything about the budget algorithm itself — that's `budget.test.ts`'s job,
 * against a real in-memory fake `RedisLike`.
 */
export function createAlwaysAvailableBudgetStore(): BudgetStore {
  return {
    async reserve() {
      return { ok: true, reservationId: randomUUID() };
    },
    async markOutcome() {
      /* Not tracked. */
    },
  };
}
