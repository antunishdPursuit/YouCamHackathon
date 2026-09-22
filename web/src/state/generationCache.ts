/**
 * Session-only cache for completed generation work.
 *
 * Source files stay in memory. The generated response is JSON-safe and may contain
 * data URLs for live previews, so it can be reused after returning to the input screen
 * without uploading the same files or spending the same API credits again.
 */

import type { AnalyzeResponse, TryOnResponse } from '@yincol/shared';
import type { CapturedImage, FullBodyInputs } from './session.js';

/**
 * Version 4 includes the optional full-body portrait and trousers. Switching the
 * server's image features must never reuse results from a different mode.
 */
const STORAGE_KEY = 'yincol:generation-cache:v4';
let memoryCache: CachedGeneration | null = null;

export interface GenerationCacheInput {
  readonly portrait: CapturedImage | null;
  readonly fullBody?: FullBodyInputs;
  readonly garmentInputs: readonly (CapturedImage | null)[];
  readonly makeupLookId: string | null;
  readonly liveSkinAnalysis: boolean;
  readonly liveTryOn: boolean;
}

export interface CachedGeneration {
  readonly key: string;
  readonly savedAt: number;
  readonly analysis: AnalyzeResponse;
  readonly tryOn: TryOnResponse;
}

async function fileFingerprint(file: File): Promise<string | null> {

  if (typeof crypto === 'undefined' || !crypto.subtle) return null;

  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/** Returns null until all provider inputs needed for generation are present. */
export async function generationCacheKey(input: GenerationCacheInput): Promise<string | null> {
  if (
    !input.portrait ||
    input.garmentInputs.length < 2 ||
    !input.garmentInputs[0] ||
    !input.garmentInputs[1] ||
    !input.makeupLookId
  ) {
    return null;
  }

  if (input.fullBody?.enabled && (!input.fullBody.portrait || !input.fullBody.trousers)) return null;
  const fingerprints = await Promise.all([
    fileFingerprint(input.portrait.file),
    fileFingerprint(input.garmentInputs[0].file),
    fileFingerprint(input.garmentInputs[1].file),
    ...(input.fullBody?.enabled ? [
      fileFingerprint(input.fullBody.portrait!.file),
      fileFingerprint(input.fullBody.trousers!.file),
    ] : []),
  ]);

  if (fingerprints.some(fingerprint => fingerprint === null)) return null;
  return JSON.stringify({ version: 4, fullBody: input.fullBody?.enabled === true, makeupLookId: input.makeupLookId, fingerprints,
    liveSkinAnalysis: input.liveSkinAnalysis, liveTryOn: input.liveTryOn });
}

export function readGenerationCache(key: string): CachedGeneration | null {
  if (memoryCache?.key === key) return memoryCache;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const cached = JSON.parse(raw) as CachedGeneration;
    return cached.key === key && cached.analysis && cached.tryOn ? cached : null;
  } catch {
    return null;
  }
}

export function writeGenerationCache(cache: CachedGeneration): boolean {
  memoryCache = cache;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cache, tryOn: { ...cache.tryOn,
      portrait: { provenance: cache.tryOn.portrait?.provenance ?? 'live', result: { status: 'failed', reason: 'Source photos are not saved.' } },
    } }));
    return true;
  } catch {
    // A live response can exceed the browser's sessionStorage quota. The app still
    // still reuses it from memory while this page remains open.
    return false;
  }
}

export function clearGenerationCache(): void {
  memoryCache = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem('yincol:generation-cache:v3');
    sessionStorage.removeItem('yincol:generation-cache:v2');
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

/** Existing completed results can move into browser history without new provider work. */
export function readLatestGenerationCache(): CachedGeneration | null {
  if (memoryCache) return memoryCache;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const cached = raw ? JSON.parse(raw) as CachedGeneration : null;
    return cached?.key && cached.analysis?.palette && cached.tryOn?.completeLooks ? cached : null;
  } catch { return null; }
}
