/**
 * The limiter's job is to stay out of the way and then not budge.
 *
 * These drive it with a fake clock, because a limiter tested with real time is either
 * slow or flaky and usually both.
 */

import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createRateLimiter } from './rateLimit.js';

function fakeResponse() {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    headers,
  };
  return res;
}

/** Drive one request through the limiter and report whether it was allowed. */
function call(limiter: ReturnType<typeof createRateLimiter>, ip: string) {
  const res = fakeResponse();
  const next = vi.fn();
  limiter({ ip } as Request, res as unknown as Response, next as unknown as NextFunction);
  return { res, allowed: next.mock.calls.length === 1 };
}

describe('createRateLimiter', () => {
  it('allows requests up to the limit and refuses the one after', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 3, now: () => 0 });

    expect(call(limiter, '10.0.0.1').allowed).toBe(true);
    expect(call(limiter, '10.0.0.1').allowed).toBe(true);
    expect(call(limiter, '10.0.0.1').allowed).toBe(true);

    const refused = call(limiter, '10.0.0.1');
    expect(refused.allowed).toBe(false);
    expect(refused.res.statusCode).toBe(429);
  });

  it('counts each address separately', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => 0 });

    expect(call(limiter, '10.0.0.1').allowed).toBe(true);
    expect(call(limiter, '10.0.0.1').allowed).toBe(false);
    // A second visitor is unaffected by the first one's spending.
    expect(call(limiter, '10.0.0.2').allowed).toBe(true);
  });

  it('lets a refused address back in once the window passes', () => {
    let clock = 0;
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => clock });

    expect(call(limiter, '10.0.0.1').allowed).toBe(true);
    expect(call(limiter, '10.0.0.1').allowed).toBe(false);

    clock = 1001;
    expect(call(limiter, '10.0.0.1').allowed).toBe(true);
  });

  it('never leaks a provider detail or an address in the refusal', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 0, now: () => 0 });
    const { res } = call(limiter, '10.0.0.1');

    expect(res.body).toEqual({
      code: 'general',
      error: 'This demo is busy just now. Please wait a moment and try again.',
    });
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.1');
  });

  it('reports the remaining budget and when it resets', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, now: () => 0 });

    const first = call(limiter, '10.0.0.1');
    expect(first.res.headers['RateLimit-Limit']).toBe('2');
    expect(first.res.headers['RateLimit-Remaining']).toBe('1');
    expect(first.res.headers['RateLimit-Reset']).toBe('60');

    call(limiter, '10.0.0.1');
    const refused = call(limiter, '10.0.0.1');
    expect(refused.res.headers['RateLimit-Remaining']).toBe('0');
    expect(refused.res.headers['Retry-After']).toBe('60');
  });

  it('falls back to a single key when the address is unknown', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => 0 });
    const next = vi.fn();

    limiter({} as Request, fakeResponse() as unknown as Response, next as unknown as NextFunction);
    limiter({} as Request, fakeResponse() as unknown as Response, next as unknown as NextFunction);

    // Second one refused: an unidentifiable caller must not get an unlimited budget.
    expect(next).toHaveBeenCalledTimes(1);
  });
});
