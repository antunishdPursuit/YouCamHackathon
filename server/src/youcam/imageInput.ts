/**
 * Getting an image into the system — step 1 of the pipeline.
 *
 * There are two paths, and the choice between them is deliberate.
 *
 * PATH A — upload. Call the File API for a pre-signed upload URL and a `file_id`, then
 *   PUT the bytes yourself.
 *
 *   ⚠ CRITICAL, and the single easiest way to lose an afternoon: calling the File API
 *   does NOT upload anything. It hands back a URL and an id, and that is all. If you
 *   skip the PUT, nothing fails at that moment — the failure surfaces much later as a
 *   misleading `500 unknowninternalerror` or a `404` on the task, pointing at entirely
 *   the wrong thing.
 *
 * PATH B — public URL. Pass a publicly reachable image URL when starting the task and
 *   skip the upload entirely.
 *
 * ★ WE USE PATH B. Path A is declared below and intentionally left unimplemented, so
 *   the interface exists if we ever need it without anyone half-building it now.
 */

import type { FeatureId } from './config.js';

/** What a task payload needs in order to refer to an image. */
export type ImageReference =
  | { readonly kind: 'publicUrl'; readonly url: string }
  | { readonly kind: 'fileId'; readonly fileId: string };

export interface ImageInputStrategy {
  readonly kind: 'publicUrl' | 'fileId';
  prepare(source: ImageSource, feature: FeatureId): Promise<ImageReference>;
}

export interface ImageSource {
  /** A URL the API itself can reach. Not localhost. */
  readonly publicUrl?: string;
  readonly bytes?: Buffer;
  readonly contentType?: string;
}

/**
 * Path B. The whole implementation, because there is nothing to do: the URL is the
 * reference.
 */
export const publicUrlStrategy: ImageInputStrategy = {
  kind: 'publicUrl',
  async prepare(source) {
    if (!source.publicUrl) {
      throw new Error(
        'Path B needs a publicly reachable image URL. Set YINCOL_PUBLIC_ASSET_BASE_URL ' +
          'to somewhere the API can fetch from — a localhost URL will not work, because ' +
          'the fetch happens on their side, not ours.',
      );
    }
    return { kind: 'publicUrl', url: source.publicUrl };
  },
};

/**
 * Path A. Declared, not implemented.
 *
 * TODO(phase0): verify in API Playground before implementing. Two things are unknown:
 * the File API endpoint appears to be per-feature (e.g. `/s2s/v2.0/file/skin-analysis`),
 * and it is unconfirmed whether one upload is reusable across features. Implementing
 * this without settling both would produce exactly the misleading 500 described above.
 *
 * If you do implement it, the order is: POST to the file endpoint → read the pre-signed
 * URL and `file_id` → PUT the bytes to that URL → only then use the `file_id`.
 */
export const fileUploadStrategy: ImageInputStrategy = {
  kind: 'fileId',
  async prepare() {
    throw new Error(
      'Path A (File API upload) is intentionally not implemented. YINCOL passes public ' +
        'image URLs directly. See imageInput.ts for what implementing it would require.',
    );
  },
};
