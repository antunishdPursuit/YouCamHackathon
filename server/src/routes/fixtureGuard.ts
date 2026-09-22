/**
 * The fixture-mode promise, enforced on the server.
 *
 * The privacy bar tells the shopper their photograph stays in the tab. In fixture mode
 * that is now literally true: the browser sends fixture metadata and nothing else. This
 * guard is what makes it a property of the deployment rather than of the client — a stale
 * tab, a replayed request, or a hand-rolled `curl` cannot put image bytes into a process
 * that has promised not to receive any.
 *
 * It rejects rather than ignores. Quietly dropping the bytes would still mean they were
 * uploaded, parsed and held in memory, which is the thing being promised against.
 */

import type { Response } from 'express';
import type { ApiErrorBody } from '@yincol/shared';

/** Fields on the public API that can carry image bytes. */
const IMAGE_FIELDS = ['image', 'portrait', 'garmentImages', 'fullBody'] as const;

/**
 * Whether a request body carries image bytes in any of the shapes the API accepts.
 *
 * Presence is what matters, not validity: an empty `garmentImages` object is not an
 * upload, but a malformed one still means the client tried to send pixels.
 */
export function carriesImageBytes(body: unknown): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const record = body as Record<string, unknown>;
  if (typeof record.portraitRef === 'string' && record.portraitRef.startsWith('data:')) return true;

  return IMAGE_FIELDS.some((field) => {
    const value = record[field];
    if (value === undefined || value === null) return false;
    // `garmentImages: {}` is what a browser with no garment references sends.
    if (field === 'garmentImages' && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return true;
  });
}

/**
 * Refuse a fixture-mode request that carries image bytes.
 *
 * Returns true when it has answered, so a route can `if (rejected) return;` and read as
 * the guard it is.
 */
export function rejectImageBytesInFixtureMode(body: unknown, res: Response): boolean {
  if (!carriesImageBytes(body)) return false;

  const error: ApiErrorBody = {
    code: 'general',
    // Said plainly: this is a client bug or a replayed request, not something a shopper
    // can act on, but it must not read as a provider failure either.
    error: 'This demo runs on fixtures and does not accept uploaded images.',
  };
  res.status(400).json(error);
  return true;
}
