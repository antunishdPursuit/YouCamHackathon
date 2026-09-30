/**
 * The process-lifetime budget store singleton.
 *
 * Routes call `loadConfig()` fresh on every request, following the rest of this codebase's
 * convention — but the Redis connection underneath a `BudgetStore` must not be recreated
 * per request. This caches one store per distinct `kvUrl`, which in practice means one
 * store for the process's whole life (the env var does not change at runtime), while still
 * reading the current caps from config on every call.
 */

import { loadConfig, type YouCamConfig } from './config.js';
import { createBudgetStore, createFailClosedBudgetStore, type BudgetStore } from './budget.js';
import { getRedisConnection } from './redisClient.js';

let cached: { kvUrl: string; store: BudgetStore } | undefined;
/** Set only by `setBudgetStoreForTests`; takes priority over the normal `kvUrl` cache so a
 * test's forced store survives calls made with a config whose `kvUrl` doesn't match it. */
let forced: BudgetStore | undefined;

export function getBudgetStore(config: YouCamConfig = loadConfig()): BudgetStore {
  if (forced) return forced;
  if (cached && cached.kvUrl === config.kvUrl) return cached.store;

  const store = config.kvUrl
    ? createBudgetStore(getRedisConnection(config.kvUrl), {
        siteDailyUnitCap: config.siteDailyUnitCap,
        browserWindowUnitCap: config.browserWindowUnitCap,
      })
    : createFailClosedBudgetStore();

  cached = { kvUrl: config.kvUrl, store };
  return store;
}

/** Test-only: forget the cached and forced store so the next call re-reads config and
 * rebuilds it. */
export function resetBudgetStoreForTests(): void {
  cached = undefined;
  forced = undefined;
}

/** Test-only: force every `getBudgetStore()` call to return this store, regardless of
 * `kvUrl` — for route tests that exercise the live path without a real Redis connection. */
export function setBudgetStoreForTests(store: BudgetStore): void {
  forced = store;
}
