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
  VideoRequest,
  VideoResponse,
} from '@yincol/shared';
import { IMAGE_SPEC } from '@yincol/shared';
import type { CapturedImage, CapturedPortrait, FullBodyInputs } from '../state/session.js';
import { getOrCreateBrowserId } from '../state/browserId.js';

/**
 * Static deployments set the API origin at build time. Keeping the default relative
 * preserves Vite's local proxy and the optional single-process preview.
 */
const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : '/api';

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
    // The browser id is a fairness heuristic for the server's shared unit budget, not a
    // credential — see browserId.ts. Attaching it on every call (not only the paid ones)
    // keeps this one call site the single source of truth for the header's name.
    headers: { 'Content-Type': 'application/json', 'X-Yincol-Browser-Id': getOrCreateBrowserId() },
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
 * Refreshed before each generation, because a server restart can change the mode
 * while a browser tab and its saved results remain open.
 */
export interface RuntimeMode {
  readonly fullBodyTryOn: boolean;
  readonly liveSkinAnalysis: boolean;
  readonly liveTryOn: boolean;
}

let modeRequest: Promise<RuntimeMode> | null = null;

async function readRuntimeMode(signal?: AbortSignal): Promise<RuntimeMode> {
  const response = await fetch(`${API_BASE}/health`, {
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error(`health check failed: ${response.status}`);

  const body = (await response.json()) as Partial<RuntimeMode>;
  // Explicit `=== true`, so a missing or malformed field reads as off rather than truthy.
  return {
    liveSkinAnalysis: body.liveSkinAnalysis === true,
    liveTryOn: body.liveTryOn === true,
    fullBodyTryOn: body.fullBodyTryOn === true,
  };
}

/**
 * Check readiness without converting a failed health check into fixture mode.
 *
 * The app uses this at startup and before consulting cached results. A failed
 * check prevents generation instead of silently choosing demo results.
 */
export async function checkRuntimeHealth(signal?: AbortSignal): Promise<RuntimeMode> {
  const mode = await readRuntimeMode(signal);
  modeRequest = Promise.resolve(mode);
  return mode;
}

export function fetchRuntimeMode(): Promise<RuntimeMode> {
  modeRequest ??= readRuntimeMode().catch(() => {
    modeRequest = null;
    throw new ApiError('We could not confirm the generation mode. Please try again.', 'general');
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
  fullBody,
}: {
  portraitRef: string;
  portrait: CapturedPortrait | null;
  garmentIds: readonly string[];
  garmentInputs: readonly (CapturedImage | null)[];
  makeupLookId: string;
  fullBody?: FullBodyInputs;
}): Promise<TryOnResponse> {
  const { liveTryOn, fullBodyTryOn } = await fetchRuntimeMode();
  if (fullBody?.enabled && (!liveTryOn || !fullBodyTryOn)) {
    throw new ApiError('Full-body generation is unavailable. Turn off the full-body option to continue.', 'general');
  }
  if (fullBody?.enabled && (!fullBody.portrait || !fullBody.trousers)) {
    throw new ApiError('Add a full-body photo and trousers before generating.', 'general');
  }

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
    ...(fullBody?.enabled ? { fullBody: {
      portrait: await fileAsImageInput(fullBody.portrait!.file),
      trousers: await fileAsImageInput(fullBody.trousers!.file),
    } } : {}),
    ...(Object.keys(garmentImages).length > 0 ? { garmentImages } : {}),
  };

  return post<TryOnResponse>('/try-on', body);
}

/**
 * `imageUrl` is the exact `imageUrl` string already on the completed panel (a `data:` URL
 * or a `/fixtures/...` path) — see shared's `VideoRequest` for why nothing is re-derived.
 */
export const requestVideo = (imageUrl: string): Promise<VideoResponse> =>
  post<VideoResponse>('/video', { imageUrl } satisfies VideoRequest);
