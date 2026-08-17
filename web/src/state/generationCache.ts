/**
 * Session-only cache for completed generation work.
 *
 * Source files stay in memory. The generated response is JSON-safe and may contain
 * data URLs for live previews, so it can be reused after returning to the input screen
 * without uploading the same files or spending the same API credits again.
 */

import type { AnalyzeResponse, TryOnResponse } from '@yincol/shared';
import type { CapturedImage } from './session.js';

const STORAGE_KEY = 'yincol:generation-cache:v1';

export interface GenerationCacheInput {
  readonly portrait: CapturedImage | null;
  readonly garmentInputs: readonly (CapturedImage | null)[];
  readonly makeupLookId: string | null;
}

export interface CachedGeneration {
  readonly key: string;
  readonly savedAt: number;
  readonly analysis: AnalyzeResponse;
  readonly tryOn: TryOnResponse;
}

async function fileFingerprint(file: File): Promise<string> {
  const fallback = `${file.name}:${file.size}:${file.lastModified}`;

  if (typeof crypto === 'undefined' || !crypto.subtle) return fallback;

  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return fallback;
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

  const fingerprints = await Promise.all([
    fileFingerprint(input.portrait.file),
    fileFingerprint(input.garmentInputs[0].file),
    fileFingerprint(input.garmentInputs[1].file),
  ]);

  return JSON.stringify({ version: 1, makeupLookId: input.makeupLookId, fingerprints });
}

export function readGenerationCache(key: string): CachedGeneration | null {
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
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    return true;
  } catch {
    // A live response can exceed the browser's sessionStorage quota. The app still
    // works; it simply cannot reuse that response after the current React state resets.
    return false;
  }
}

export function clearGenerationCache(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
