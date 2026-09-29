/**
 * The one place a route asks the shared unit budget for permission before starting paid
 * work, and reports what happened once it's done.
 *
 * Outcome classification is deliberately conservative in this first wiring: a route only
 * ever reports 'success' (something usable came back) or 'ambiguous' (nothing did, for any
 * reason). It never reports 'definitiveFailure', which is the only outcome `budget.ts`
 * refunds — that would need each sequence (completeLook.ts, portraitMakeup.ts, fullBody.ts)
 * to distinguish a clean vendor "error" status from a timeout in its return shape, which
 * none of them currently do. The safe default until that plumbing exists is to keep every
 * uncertain charge rather than risk refunding one that actually succeeded or is still
 * running on the provider's side — exactly the conservatism the budget system asks for.
 */

import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import type { ApiErrorBody } from '@yincol/shared';
import { getBudgetStore } from '../youcam/budgetStore.js';
import type { ReservationOutcome } from '../youcam/budget.js';

const BROWSER_ID_HEADER = 'x-yincol-browser-id';
const MAX_BROWSER_ID_LENGTH = 100;

/** A missing or malformed header falls back to one shared bucket — a fairness heuristic,
 * not a security boundary, so a bad header only ever costs that bucket its own headroom. */
export function browserIdFrom(req: Request): string {
  const raw = req.header(BROWSER_ID_HEADER);
  return raw && raw.length > 0 && raw.length <= MAX_BROWSER_ID_LENGTH ? raw : 'unknown';
}

/** A stable hash of the actual validated bytes/fields, so an identical resubmission
 * (a double click, a retried network request) is deflected without needing a client nonce. */
export function idempotencyKeyFor(parts: readonly (string | Buffer)[]): string {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(part);
  return hash.digest('hex');
}

const REJECTION: Record<'siteCapExceeded' | 'browserCapExceeded' | 'duplicateSubmission' | 'storeUnavailable', { status: number; message: string }> = {
  siteCapExceeded: { status: 429, message: 'Today’s shared demo budget is used up. Please try again tomorrow.' },
  browserCapExceeded: { status: 429, message: 'You’ve used your share of live generations for today. Please try again tomorrow.' },
  duplicateSubmission: { status: 409, message: 'This generation is already in progress.' },
  storeUnavailable: { status: 503, message: 'Live generation is temporarily paused. Saved demos and your browser history remain available.' },
};

/**
 * Reserve the estimated cost before any provider call. On rejection this writes the
 * response itself (an honest, non-vendor-leaking message per reason) and returns
 * `undefined`; the caller must stop and must not touch the provider.
 */
export async function reserveBudget(
  res: Response,
  browserId: string,
  estimatedUnits: number,
  idempotencyKey: string,
): Promise<string | undefined> {
  const result = await getBudgetStore().reserve({ browserId, estimatedUnits, idempotencyKey });
  if (result.ok) return result.reservationId;

  const { status, message } = REJECTION[result.reason];
  const body: ApiErrorBody = { code: 'general', error: message };
  res.status(status).json(body);
  return undefined;
}

export async function settleBudget(reservationId: string, outcome: ReservationOutcome): Promise<void> {
  await getBudgetStore().markOutcome(reservationId, outcome);
}
