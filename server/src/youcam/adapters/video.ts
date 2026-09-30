/**
 * The video adapter. Same shape as `adapters/tryOn.ts`'s try-on capture, for a video
 * instead of a still: find the result URL, download it behind the server boundary, and
 * report either a `ready` result or a `failed` one — a discriminated union so a caller
 * cannot read `videoUrl` without first proving the result succeeded.
 *
 * Entirely unverified against the real API (see `VIDEO_GENERATOR_TASK_PATH` in config.ts);
 * this exists so the route above it can be built and tested against a mocked provider
 * before any real verification happens.
 */

import type { VideoResult } from '@yincol/shared';
import { extractResultUrls, downloadResult, type RawTaskResult } from '../taskRunner.js';
import type { FeatureId } from '../config.js';

export interface VideoBytes {
  readonly bytes: Buffer;
  readonly contentType: string;
}

export type VideoCapture =
  | { readonly status: 'ready'; readonly result: VideoResult; readonly video: VideoBytes }
  | { readonly status: 'failed'; readonly result: VideoResult };

export async function captureVideoLive(
  raw: RawTaskResult,
  feature: FeatureId,
  alt: string,
): Promise<VideoCapture> {
  const url = extractResultUrls(raw)[0];
  if (!url) {
    return { status: 'failed', result: { status: 'failed', reason: 'The task succeeded but returned no video we could read.' } };
  }

  try {
    const { bytes, contentType } = await downloadResult(url, feature);
    const browserType = contentType.startsWith('video/') ? contentType : 'video/mp4';
    return {
      status: 'ready',
      result: { status: 'ready', videoUrl: `data:${browserType};base64,${bytes.toString('base64')}`, alt },
      video: { bytes, contentType: browserType },
    };
  } catch {
    return { status: 'failed', result: { status: 'failed', reason: 'The task finished, but its video could not be downloaded.' } };
  }
}

export const videoFailure = (reason: string): VideoResult => ({ status: 'failed', reason });
