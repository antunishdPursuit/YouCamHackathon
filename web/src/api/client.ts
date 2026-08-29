/**
 * The only place the front end talks to anything.
 *
 * It speaks the internal contract from `@yincol/shared/domain/api` and nothing else.
 * There is no vendor shape on this side of the wire, and the API key never comes near
 * the browser — that is the entire reason the Express layer exists.
 *
 * It is also the only place that decides whether a photograph leaves the tab. In fixture
 * mode nothing here reads a file: the requests carry fixture references and the picture
 * stays where the shopper put it. That is what the privacy bar promises, so it is
 * enforced at the one door rather than asserted in the copy.
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

/**
 * Which live paths the server has enabled.
 *
 * Read once and remembered, because it cannot change under a running tab — the flags are
 * process-level and a change means a restart.
 */
export interface RuntimeMode {
  readonly liveSkinAnalysis: boolean;
  readonly liveTryOn: boolean;
}

/**
 * What we assume when the server has not told us otherwise.
 *
 * Fail closed, and note which way "closed" points here: the safe default is to send
 * nothing. A failed health check must never be the reason a photograph gets uploaded.
 */
const FIXTURE_ONLY: RuntimeMode = { liveSkinAnalysis: false, liveTryOn: false };

let modeRequest: Promise<RuntimeMode> | null = null;

async function readRuntimeMode(): Promise<RuntimeMode> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) throw new Error(`health check failed: ${response.status}`);

  const body = (await response.json()) as Partial<RuntimeMode>;
  // Explicit `=== true`, so a missing or malformed field reads as off rather than truthy.
  return {
    liveSkinAnalysis: body.liveSkinAnalysis === true,
    liveTryOn: body.liveTryOn === true,
  };
}

export function fetchRuntimeMode(): Promise<RuntimeMode> {
  modeRequest ??= readRuntimeMode().catch(() => {
    // Forget the failure rather than the answer: a blip should not pin the whole session
    // to fixtures, but until it is asked again the answer stays the safe one.
    modeRequest = null;
    return FIXTURE_ONLY;
  });

  return modeRequest;
}

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

/**
 * Asks for the skin appearance reading.
 *
 * Only the live route needs the photograph. In fixture mode the request is a bare one —
 * the file is never read, so there is nothing to send and nothing to leave the tab.
 */
export async function requestSkinAnalysis(
  portrait: CapturedPortrait,
): Promise<SkinAnalysisResponse> {
  const { liveSkinAnalysis } = await fetchRuntimeMode();
  if (!liveSkinAnalysis) return post<SkinAnalysisResponse>('/skin-analysis', {});

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
  const { liveTryOn } = await fetchRuntimeMode();

  // The fixture path generates from shipped results, not from these files. Returning
  // early keeps them unread: no base64, no request body carrying them, nothing to undo.
  if (!liveTryOn) {
    const fixtureBody: TryOnRequest = { portraitRef, garmentIds, makeupLookId };
    return post<TryOnResponse>('/try-on', fixtureBody);
  }

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
