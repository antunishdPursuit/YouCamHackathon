/**
 * The only place the front end talks to anything.
 *
 * It speaks the internal contract from `@yincol/shared/domain/api` and nothing else.
 * There is no vendor shape on this side of the wire, and the API key never comes near
 * the browser — that is the entire reason the Express layer exists.
 */

import type {
  AnalyzeResponse,
  SkinAnalysisRequest,
  SkinAnalysisResponse,
  TryOnImageInput,
  TryOnRequest,
  TryOnResponse,
} from '@yincol/shared';
import { IMAGE_SPEC } from '@yincol/shared';
import type { CapturedImage, CapturedPortrait } from '../state/session.js';

const API_BASE = '/api';

/**
 * A failure the UI can branch on.
 *
 * `noFace` gets its own screen, because "we could not find a face" needs a different
 * suggestion than "something went wrong" — and because the difference between them
 * should not be inferred from string matching further up.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: 'noFace' | 'general',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as
      | { error?: string; code?: string }
      | null;
    throw new ApiError(
      detail?.error ?? 'We could not reach the studio just now.',
      detail?.code === 'noFace' ? 'noFace' : 'general',
    );
  }

  return (await response.json()) as T;
}

export const requestAnalysis = (portraitRef: string): Promise<AnalyzeResponse> =>
  post<AnalyzeResponse>('/analyze', { portraitRef });

async function fileAsBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

async function fileAsImageInput(file: File): Promise<TryOnImageInput> {
  if (file.size >= IMAGE_SPEC.maxFileBytesExclusive) {
    throw new ApiError('That file is too large. Please choose an image smaller than 10 MB.', 'general');
  }
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
    throw new ApiError('Please choose a JPEG or PNG image for live previews.', 'general');
  }

  return {
    data: await fileAsBase64(file),
    contentType: file.type,
    fileName: file.name || 'image',
  };
}

/** Sends the selected browser file to the dedicated Skin Analysis route. */
export async function requestSkinAnalysis(
  portrait: CapturedPortrait,
): Promise<SkinAnalysisResponse> {
  if (portrait.file.size >= IMAGE_SPEC.maxFileBytesExclusive) {
    throw new ApiError('That file is too large. Please choose an image smaller than 10 MB.', 'general');
  }
  if (portrait.file.type !== 'image/jpeg' && portrait.file.type !== 'image/png') {
    throw new ApiError('Please choose a JPEG or PNG photograph for live analysis.', 'general');
  }

  const body: SkinAnalysisRequest = {
    image: {
      data: await fileAsBase64(portrait.file),
      contentType: portrait.file.type,
      fileName: portrait.file.name || 'portrait',
    },
  };

  return post<SkinAnalysisResponse>('/skin-analysis', body);
}

export async function requestTryOn({
  portraitRef,
  portrait,
  garmentIds,
  garmentInputs,
  makeupLookId,
}: {
  portraitRef: string;
  portrait: CapturedPortrait | null;
  garmentIds: readonly string[];
  garmentInputs: readonly (CapturedImage | null)[];
  makeupLookId: string;
}): Promise<TryOnResponse> {
  const garmentImages: Record<string, TryOnImageInput> = {};
  for (const [index, garmentId] of garmentIds.entries()) {
    const image = garmentInputs[index];
    if (image) garmentImages[garmentId] = await fileAsImageInput(image.file);
  }

  const body: TryOnRequest = {
    portraitRef,
    garmentIds,
    makeupLookId,
    ...(portrait ? { portrait: await fileAsImageInput(portrait.file) } : {}),
    ...(Object.keys(garmentImages).length > 0 ? { garmentImages } : {}),
  };

  return post<TryOnResponse>('/try-on', body);
}
