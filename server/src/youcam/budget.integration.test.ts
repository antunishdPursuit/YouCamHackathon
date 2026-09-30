import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { expect, it } from 'vitest';
import { BUDGET_KEY, createBudgetStore, type RedisLike } from './budget.js';

/** Uses a unique test namespace, never the production budget key. CI supplies Valkey. */
it.skipIf(!process.env['YINCOL_TEST_KV_URL'])('enforces caps with real Valkey EVAL across independent clients and restarts', async () => {
  const url = process.env['YINCOL_TEST_KV_URL']!;
  const clients = [new Redis(url), new Redis(url)];
  const prefix = `yincol:test:${randomUUID()}:`;
  const wrapped = (client: Redis): RedisLike => ({
    get: key => client.get(prefix + key),
    eval: (script, count, key, ...args) => client.eval(script, count, prefix + key, ...args),
  });
  const options = { siteDailyUnitCap: 30, browserWindowUnitCap: 40 };
  try {
    await clients[0]!.set(prefix + BUDGET_KEY, JSON.stringify({ version: 2, readyAt: 0, charges: [], seen: {} }));
    const stores = clients.map(client => createBudgetStore(wrapped(client), options));
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => stores[i % 2]!.reserve({
      browserId: String(i), estimatedUnits: 10, idempotencyKey: String(i),
    })));
    expect(results.filter(r => r.ok)).toHaveLength(3);
    const restarted = createBudgetStore(wrapped(clients[1]!), options);
    expect(await restarted.reserve({ browserId: 'new', estimatedUnits: 1, idempotencyKey: 'new' }))
      .toEqual({ ok: false, reason: 'siteCapExceeded' });
    await clients[0]!.del(prefix + BUDGET_KEY);
    expect(await restarted.reserve({ browserId: 'new', estimatedUnits: 1, idempotencyKey: 'new' }))
      .toEqual({ ok: false, reason: 'storeUnavailable' });
    const recovered = JSON.parse((await clients[0]!.get(prefix + BUDGET_KEY))!);
    expect(recovered.readyAt).toBeGreaterThan(Date.now() + 86_390_000);
  } finally {
    await clients[0]!.del(prefix + BUDGET_KEY);
    await Promise.all(clients.map(client => client.quit()));
  }
}, 20_000);
