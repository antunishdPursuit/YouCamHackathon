/**
 * Try-on adapters — Clothes VTO and Makeup VTO.
 *
 * Both features return an image, so both adapt the same way: find the result URL, and
 * report either a `ready` result or a `failed` one. The union is the point — a caller
 * cannot read `imageUrl` without first proving the result succeeded.
 *
 * Nothing here composites anything. When a complete look is built, the makeup task is
 * handed the garment task's returned image and renders it again — that is a second
 * provider render, not two pictures pasted together. The distinction matters: we may
 * show one image containing both because the provider produced one image containing
 * both, and never because we merged two.
 */

import type { TryOnResult } from '@yincol/shared';
import { extractResultUrls, downloadResult, type RawTaskResult } from '../taskRunner.js';
import type { FeatureId } from '../config.js';

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

/** Downloaded result bytes, kept so a second task can be given the first task's image. */
export interface TryOnImageBytes {
  readonly bytes: Buffer;
  readonly contentType: string;
}

/**
 * A downloaded live result: the browser-safe form and the bytes behind it.
 *
 * Both come from a SINGLE download. The sequenced complete-look path needs the bytes to
 * feed the makeup task, and the browser needs a data URL; deriving both here means the
 * result is never fetched twice, which matters because the vendor's download URL is good
 * for two hours and we are spending someone's bandwidth either way.
 */
export type TryOnCapture =
  | { readonly status: 'ready'; readonly result: TryOnResult; readonly image: TryOnImageBytes }
  | { readonly status: 'failed'; readonly result: TryOnResult };

/**
 * Live browser results are downloaded behind the server boundary immediately. The
 * browser receives a short-lived in-memory data URL rather than a vendor-signed URL
 * that could expire or expose provider-specific response details.
 */
export async function captureTryOnLive(
  raw: RawTaskResult,
  feature: FeatureId,
  alt: string,
): Promise<TryOnCapture> {
  const url = adaptTryOnUrl(raw);
  if (!url) {
    return {
      status: 'failed',
      result: {
        status: 'failed',
        reason: 'The task succeeded but returned no image we could read.',
      },
    };
  }

  try {
    const { bytes, contentType } = await downloadResult(url, feature);
    const browserType = contentType.startsWith('image/') ? contentType : 'image/jpeg';
    return {
      status: 'ready',
      result: {
        status: 'ready',
        imageUrl: `data:${browserType};base64,${bytes.toString('base64')}`,
        alt,
      },
      image: { bytes, contentType: browserType },
    };
  } catch {
    return {
      status: 'failed',
      result: {
        status: 'failed',
        reason: 'The task finished, but its preview could not be downloaded.',
      },
    };
  }
}

/** The browser-facing half of {@link captureTryOnLive}, for callers that need no bytes. */
export async function adaptTryOnLive(
  raw: RawTaskResult,
  feature: FeatureId,
  alt: string,
): Promise<TryOnResult> {
  return (await captureTryOnLive(raw, feature, alt)).result;
}

/** A failure that the UI can show without the other three panels caring. */
export const tryOnFailure = (reason: string): TryOnResult => ({ status: 'failed', reason });
