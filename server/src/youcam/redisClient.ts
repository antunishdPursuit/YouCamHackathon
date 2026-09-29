/**
 * The one place a real Redis-protocol connection gets made.
 *
 * `budget.ts` never imports `ioredis` directly — it takes a `RedisLike`, so its algorithm
 * is fully unit-testable against a plain fake. This file is the production wiring, and it
 * is deliberately unverified against Render's actual Key Value service: nobody in this
 * codebase has Render access, so a real connection has never been exercised. Confirm it
 * works, and confirm whether it supports `EVAL`/scripting (see budget.ts's atomicity note),
 * before `YINCOL_KV_URL` is ever set in a real deployment.
 */

import Redis from 'ioredis';
import type { RedisLike } from './budget.js';

let client: Redis | undefined;

/** One connection, reused across requests — `ioredis` reconnects on its own. */
export function getRedisConnection(url: string): RedisLike {
  client ??= new Redis(url, {
    // Fail fast rather than queueing requests indefinitely against a store that is down;
    // budget.ts treats any rejection here as `storeUnavailable`, which is the safe default.
    maxRetriesPerRequest: 1,
    lazyConnect: false,
  });
  return client;
}
