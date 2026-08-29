/**
 * A fixed-window rate limiter, in memory, with no dependency behind it.
 *
 * The public demo spends no credits, so this is not protecting a budget — it is
 * protecting a single small process that answers every request with a deliberate
 * multi-second delay. Without a limit, one client holding open a few hundred generations
 * is enough to make the demo unavailable to everyone else, and that costs nothing to
 * attempt.
 *
 * Deliberately not `express-rate-limit`: this is thirty lines, it needs no store, and a
 * closeout whose whole point is a clean dependency audit should not add a package to get
 * them.
 *
 * KNOWN LIMIT. In-memory state is per process. Two instances behind a load balancer each
 * enforce their own window, so the effective limit is the stated one times the instance
 * count. The deployment shape is one process (see the README), and if that ever changes
 * this needs a shared store or the platform's own edge limiter.
 */

import type { NextFunction, Request, Response } from 'express';
import type { ApiErrorBody } from '@yincol/shared';

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  readonly windowMs: number;
  /** Requests allowed per key per window. */
  readonly max: number;
  /** Injectable clock, so the tests do not sleep. */
  readonly now?: () => number;
}

interface Window {
  count: number;
  /** When this window expires, in the same units as `now()`. */
  resetAt: number;
}

/**
 * Above this many tracked keys, expired windows are swept before adding another.
 *
 * A sweep is O(keys), so it must not run per request; a timer would be tidier but would
 * also have to be unref'd to let the process exit, and this keeps the whole thing
 * synchronous and testable.
 */
const SWEEP_THRESHOLD = 10_000;

export function createRateLimiter({ windowMs, max, now = Date.now }: RateLimitOptions) {
  const windows = new Map<string, Window>();

  function sweep(at: number): void {
    for (const [key, window] of windows) {
      if (window.resetAt <= at) windows.delete(key);
    }
  }

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const at = now();
    // `req.ip` honours `trust proxy`, which index.ts sets only when the deployment says
    // it sits behind one. Untrusted, a forwarded header would let anyone pick their key.
    const key = req.ip ?? 'unknown';

    if (windows.size > SWEEP_THRESHOLD) sweep(at);

    const existing = windows.get(key);
    const window =
      existing && existing.resetAt > at ? existing : { count: 0, resetAt: at + windowMs };
    window.count += 1;
    windows.set(key, window);

    const remaining = Math.max(0, max - window.count);
    const resetSeconds = Math.max(1, Math.ceil((window.resetAt - at) / 1000));
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (window.count > max) {
      res.setHeader('Retry-After', String(resetSeconds));
      const error: ApiErrorBody = {
        code: 'general',
        error: 'This demo is busy just now. Please wait a moment and try again.',
      };
      res.status(429).json(error);
      return;
    }

    next();
  };
}
