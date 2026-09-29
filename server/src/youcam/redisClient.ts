/** Shared bounded Valkey connection. EVAL support is documented; target connection
 * and policy must still be checked by the Render owner before release. */
import Redis from 'ioredis';
import type { RedisLike } from './budget.js';

let client: Redis | undefined;

/** One connection, reused across requests — `ioredis` reconnects on its own. */
export function getRedisConnection(url: string): RedisLike {
  client ??= new Redis(url, {
    // Fail fast rather than queueing requests indefinitely against a store that is down;
    // budget.ts treats any rejection here as `storeUnavailable`, which is the safe default.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    commandTimeout: 5_000,
    connectTimeout: 5_000,
    lazyConnect: false,
  });
  return client;
}
