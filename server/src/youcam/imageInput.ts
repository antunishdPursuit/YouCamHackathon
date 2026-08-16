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
 * ★ Existing capture and try-on callers still use PATH B. PATH A is implemented below for
 *   the verified Skin Analysis file flow; browser wiring is the next increment.
 */

import { authHeader, filePathFor, type FeatureId, type YouCamConfig } from './config.js';

/** What a task payload needs in order to refer to an image. */
export type ImageReference =
  | { readonly kind: 'publicUrl'; readonly url: string }
  | { readonly kind: 'fileId'; readonly fileId: string };

export interface ImageInputStrategy {
  readonly kind: 'publicUrl' | 'fileId';
  prepare(
    source: ImageSource,
    feature: FeatureId,
    config?: YouCamConfig,
  ): Promise<ImageReference>;
}

export interface ImageSource {
  /** A URL the API itself can reach. Not localhost. */
  readonly publicUrl?: string;
  readonly bytes?: Buffer;
  readonly contentType?: string;
  readonly fileName?: string;
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
 * The API rejects files at or above 10 MB. Keep this guard here so the server never creates
 * an upload slot for a file that cannot be accepted.
 */
export const MAX_FILE_BYTES = 10_000_000;
export const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

export class ImageUploadError extends Error {
  constructor(
    message: string,
    readonly detail: {
      readonly feature: FeatureId;
      readonly stage: 'metadata' | 'upload';
      readonly status?: number;
    },
  ) {
    super(message);
    this.name = 'ImageUploadError';
  }
}

interface UploadRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
}

interface FileUploadInfo {
  readonly fileId: string;
  readonly request: UploadRequest;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function readUploadInfo(body: unknown, feature: FeatureId): FileUploadInfo {
  if (!isRecord(body)) {
    throw new ImageUploadError('The File API returned an invalid response.', {
      feature,
      stage: 'metadata',
    });
  }

  const data = isRecord(body.data) ? body.data : body;
  const files = Array.isArray(data.files) ? data.files : [];
  const firstFile = isRecord(files[0]) ? files[0] : undefined;
  const requests = firstFile && Array.isArray(firstFile.requests) ? firstFile.requests : [];
  const firstRequest = isRecord(requests[0]) ? requests[0] : undefined;
  const fileId = firstFile && typeof firstFile.file_id === 'string' ? firstFile.file_id : '';
  const method = firstRequest && typeof firstRequest.method === 'string' ? firstRequest.method : '';
  const url = firstRequest && typeof firstRequest.url === 'string' ? firstRequest.url : '';
  const rawHeaders = firstRequest && isRecord(firstRequest.headers) ? firstRequest.headers : {};
  const headers = Object.fromEntries(
    Object.entries(rawHeaders).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value]] : [],
    ),
  );

  if (!fileId || !url || method.toUpperCase() !== 'PUT') {
    throw new ImageUploadError('The File API returned incomplete upload details.', {
      feature,
      stage: 'metadata',
    });
  }

  return { fileId, request: { method: method.toUpperCase(), url, headers } };
}

async function readJson(response: Response, feature: FeatureId): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ImageUploadError('The File API returned invalid JSON.', {
      feature,
      stage: 'metadata',
      status: response.status,
    });
  }
}

/**
 * Path A. Create an upload slot, PUT the bytes to the signed URL, then return the file id.
 * The signed upload request must not receive the API authorization header.
 */
export async function uploadFile(
  config: YouCamConfig,
  source: ImageSource,
  feature: FeatureId,
): Promise<ImageReference> {
  const bytes = source.bytes;
  const contentType = source.contentType ?? '';
  const fileName = source.fileName ?? 'portrait';

  if (!bytes || bytes.length === 0) {
    throw new ImageUploadError('An image file is required for live analysis.', {
      feature,
      stage: 'metadata',
    });
  }
  if (!SUPPORTED_IMAGE_TYPES.has(contentType)) {
    throw new ImageUploadError('Only image files can be sent for live analysis.', {
      feature,
      stage: 'metadata',
    });
  }
  if (bytes.length >= MAX_FILE_BYTES) {
    throw new ImageUploadError('The image must be smaller than 10 MB.', {
      feature,
      stage: 'metadata',
    });
  }

  const response = await fetch(`${config.baseUrl}${filePathFor(feature)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(config.apiKey) },
    body: JSON.stringify({
      files: [{ content_type: contentType, file_name: fileName, file_size: bytes.length }],
    }),
  });

  if (!response.ok) {
    throw new ImageUploadError(`File metadata request failed: ${response.status}`, {
      feature,
      stage: 'metadata',
      status: response.status,
    });
  }

  const uploadInfo = readUploadInfo(await readJson(response, feature), feature);
  const uploadResponse = await fetch(uploadInfo.request.url, {
    method: uploadInfo.request.method,
    headers: uploadInfo.request.headers,
    body: bytes,
  });

  if (!uploadResponse.ok) {
    throw new ImageUploadError(`Image upload failed: ${uploadResponse.status}`, {
      feature,
      stage: 'upload',
      status: uploadResponse.status,
    });
  }

  return { kind: 'fileId', fileId: uploadInfo.fileId };
}

export const fileUploadStrategy: ImageInputStrategy = {
  kind: 'fileId',
  async prepare(source, feature, config) {
    if (!config) {
      throw new ImageUploadError('A YouCam configuration is required for file upload.', {
        feature,
        stage: 'metadata',
      });
    }
    return uploadFile(config, source, feature);
  },
};
