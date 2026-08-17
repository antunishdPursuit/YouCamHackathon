/**
 * Try-on adapters — Clothes VTO and Makeup VTO.
 *
 * Both features return an image, so both adapt the same way: find the result URL, and
 * report either a `ready` result or a `failed` one. The union is the point — a caller
 * cannot read `imageUrl` without first proving the result succeeded.
 *
 * These two never merge. Apparel and makeup previews are generated separately and stay
 * in separate labelled panels; nothing here composites them.
 */

import type { TryOnResult } from '@yincol/shared';
import { extractResultUrls, downloadResult, type RawTaskResult } from '../taskRunner.js';
import type { FeatureId } from '../config.js';

export interface TryOnCapture {
  readonly url: string;
  readonly taskId: string;
}

/**
 * Read the download URL from a successful task.
 *
 * Remember it is good for two hours only. Callers that need the image after that must
 * either have downloaded the bytes already or re-derive a link from the `task_id`.
 */
export function adaptTryOnUrl(raw: RawTaskResult): string | undefined {
  return extractResultUrls(raw)[0];
}

export function adaptTryOn(raw: RawTaskResult, alt: string): TryOnResult {
  const url = adaptTryOnUrl(raw);
  if (!url) {
    return {
      status: 'failed',
      reason: 'The task succeeded but returned no image we could read.',
    };
  }
  return { status: 'ready', imageUrl: url, alt };
}

/**
 * Live browser results are downloaded behind the server boundary immediately. The
 * browser receives a short-lived in-memory data URL rather than a vendor-signed URL
 * that could expire or expose provider-specific response details.
 */
export async function adaptTryOnLive(
  raw: RawTaskResult,
  feature: FeatureId,
  alt: string,
): Promise<TryOnResult> {
  const url = adaptTryOnUrl(raw);
  if (!url) {
    return {
      status: 'failed',
      reason: 'The task succeeded but returned no image we could read.',
    };
  }

  try {
    const { bytes, contentType } = await downloadResult(url, feature);
    const browserType = contentType.startsWith('image/') ? contentType : 'image/jpeg';
    return {
      status: 'ready',
      imageUrl: `data:${browserType};base64,${bytes.toString('base64')}`,
      alt,
    };
  } catch {
    return {
      status: 'failed',
      reason: 'The task finished, but its preview could not be downloaded.',
    };
  }
}

/** A failure that the UI can show without the other three panels caring. */
export const tryOnFailure = (reason: string): TryOnResult => ({ status: 'failed', reason });
