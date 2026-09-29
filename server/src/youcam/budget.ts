import { randomUUID } from 'node:crypto';

/** The README's own recorded unit estimates — one place, so the doc and the code agree. */
export const CLOSE_UP_UNITS = 6;
export const FULL_BODY_UNITS = 8;
export const SKIN_ANALYSIS_UNITS = 12;
export const PORTRAIT_MAKEUP_UNITS = 1;
export const VIDEO_UNIT_COST = 10;

export interface EstimateInput {
  readonly hasFullBody: boolean;
  readonly hasSkinAnalysis: boolean;
}

/**
 * The full estimated cost of one generation request, reserved atomically before any
 * provider call: full-body outfits plus portrait makeup cost 9 units; the legacy
 * close-up-only path costs 7. Makeup is 1 unit per the provider documentation.
 */
export function estimateUnits({ hasFullBody, hasSkinAnalysis }: EstimateInput): number {
  return (
    (hasFullBody ? FULL_BODY_UNITS : CLOSE_UP_UNITS) +
    PORTRAIT_MAKEUP_UNITS +
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
  /** Recorded by callers if known; this implementation still never refunds automatically. */
  | 'definitiveFailure'
  /** A timeout or an unknown status touched the request somewhere. Keep the charge. */
  | 'ambiguous';

export interface BudgetStore {
  availability?(browserId: string): Promise<{ available: boolean; siteRemaining: number; browserRemaining: number; retryAt?: number }>;
  reserve(params: ReserveParams): Promise<ReserveResult>;
  markOutcome(reservationId: string, outcome: ReservationOutcome): Promise<void>;
}

/**
 * The Redis commands this module actually issues, named and shaped exactly as `ioredis`
 * exposes them — a real `Redis` client satisfies this by construction, and tests supply a
 * plain in-memory fake instead of mocking the `ioredis` module or reaching a real server.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  eval(script: string, numberOfKeys: number, ...args: string[]): Promise<unknown>;
}
export interface BudgetStoreOptions {
  readonly siteDailyUnitCap: number;
  readonly browserWindowUnitCap: number;
}
export const BUDGET_KEY = 'yincol:budget:v2:ledger';
export const DAY_MS = 86_400_000;
/** One atomic compare-and-set commits both caps and duplicate protection together.
 * No TTL: a missing ledger always starts a 24-hour recovery pause, including provisioning.
 * EVAL is supported by Valkey; unsupported/denied commands fail closed. */
export const BUDGET_CAS = "local old = redis.call('GET', KEYS[1]); if (old or '') ~= ARGV[1] then return 0 end; redis.call('SET', KEYS[1], ARGV[2]); return 1";
interface Charge { at: number; browser: string; units: number }
interface Ledger { version: 2; readyAt: number; charges: Charge[]; seen: Record<string, string> }

export function createBudgetStore(client: RedisLike, options: BudgetStoreOptions): BudgetStore {
  return {
    async availability(browserId) {
      const paused = { available: false, siteRemaining: 0, browserRemaining: 0 };
      try {
        const raw = await client.get(BUDGET_KEY);
        const now = Date.now();
        if (raw === null) {
          const empty: Ledger = { version: 2, readyAt: now + DAY_MS, charges: [], seen: {} };
          await client.eval(BUDGET_CAS, 1, BUDGET_KEY, '', JSON.stringify(empty));
          return { ...paused, retryAt: empty.readyAt };
        }
        const ledger = JSON.parse(raw) as Ledger;
        if (ledger.version !== 2 || !Number.isFinite(ledger.readyAt) || !Array.isArray(ledger.charges) ||
          !ledger.seen || typeof ledger.seen !== 'object' || Object.keys(ledger.seen).length >= 20_000) return paused;
        if (now < ledger.readyAt) return { ...paused, retryAt: ledger.readyAt };
        if (ledger.charges.some(c => !Number.isFinite(c.at) || !Number.isSafeInteger(c.units) || c.units <= 0 || typeof c.browser !== 'string')) return paused;
        const recent = ledger.charges.filter(c => c.at > now - DAY_MS);
        const day = Math.floor(now / DAY_MS) * DAY_MS;
        const siteRemaining = Math.max(0, options.siteDailyUnitCap - recent.filter(c => c.at >= day).reduce((n,c) => n+c.units,0));
        const browserRemaining = Math.max(0, options.browserWindowUnitCap - recent.filter(c => c.browser === browserId).reduce((n,c) => n+c.units,0));
        return { available: siteRemaining > 0 && browserRemaining > 0, siteRemaining, browserRemaining };
      } catch { return paused; }
    },
    async reserve({ browserId, estimatedUnits, idempotencyKey }): Promise<ReserveResult> {
      if (!Number.isSafeInteger(estimatedUnits) || estimatedUnits <= 0 ||
          !Number.isSafeInteger(options.siteDailyUnitCap) || options.siteDailyUnitCap <= 0 ||
          !Number.isSafeInteger(options.browserWindowUnitCap) || options.browserWindowUnitCap <= 0) {
        return { ok: false, reason: 'storeUnavailable' };
      }
      try {
        for (let attempt = 0; attempt < 100; attempt++) {
          const raw = await client.get(BUDGET_KEY);
          const now = Date.now();
          if (raw === null) {
            const empty: Ledger = { version: 2, readyAt: now + DAY_MS, charges: [], seen: {} };
            await client.eval(BUDGET_CAS, 1, BUDGET_KEY, '', JSON.stringify(empty));
            return { ok: false, reason: 'storeUnavailable' };
          }
          const ledger = JSON.parse(raw) as Ledger;
          if (ledger.version !== 2 || !Number.isFinite(ledger.readyAt) ||
              !Array.isArray(ledger.charges) || !ledger.seen || typeof ledger.seen !== 'object' ||
              now < ledger.readyAt) return { ok: false, reason: 'storeUnavailable' };
          if (Object.hasOwn(ledger.seen, idempotencyKey)) return { ok: false, reason: 'duplicateSubmission' };
          // Keep hashes, never source media. Pause rather than silently forget unknown work.
          if (Object.keys(ledger.seen).length >= 20_000) return { ok: false, reason: 'storeUnavailable' };
          if (ledger.charges.some(c => !Number.isFinite(c.at) || !Number.isSafeInteger(c.units) || c.units <= 0 || typeof c.browser !== 'string')) {
            return { ok: false, reason: 'storeUnavailable' };
          }
          const charges = ledger.charges.filter(c => c.at > now - DAY_MS);
          const dayStart = Math.floor(now / DAY_MS) * DAY_MS; // Site day: UTC midnight.
          const siteUsed = charges.filter(c => c.at >= dayStart).reduce((sum, c) => sum + c.units, 0);
          const browserUsed = charges.filter(c => c.browser === browserId).reduce((sum, c) => sum + c.units, 0);
          if (siteUsed + estimatedUnits > options.siteDailyUnitCap) return { ok: false, reason: 'siteCapExceeded' };
          if (browserUsed + estimatedUnits > options.browserWindowUnitCap) return { ok: false, reason: 'browserCapExceeded' };
          const reservationId = randomUUID();
          const updated: Ledger = { ...ledger, charges: [...charges, { at: now, browser: browserId, units: estimatedUnits }],
            seen: { ...ledger.seen, [idempotencyKey]: reservationId } };
          if (await client.eval(BUDGET_CAS, 1, BUDGET_KEY, raw, JSON.stringify(updated)) === 1) return { ok: true, reservationId };
        }
      } catch { /* Includes response loss after a committed CAS: never start paid work. */ }
      return { ok: false, reason: 'storeUnavailable' };
    },
    async markOutcome() {
      // No automatic refunds or expiring duplicate locks, including definitive failures.
      // Unknown provider work remains charged and cannot be silently submitted again.
    },
  };
}



export function createFailClosedBudgetStore(): BudgetStore {
  return { async reserve() { return { ok: false, reason: 'storeUnavailable' }; }, async markOutcome() {} };
}
/** Route tests only; never selected by production configuration. */
export function createAlwaysAvailableBudgetStore(): BudgetStore {
  return { async reserve() { return { ok: true, reservationId: randomUUID() }; }, async markOutcome() {} };
}
