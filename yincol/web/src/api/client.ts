/**
 * The only place the front end talks to anything.
 *
 * It speaks the internal contract from `@yincol/shared/domain/api` and nothing else.
 * There is no vendor shape on this side of the wire, and the API key never comes near
 * the browser — that is the entire reason the Express layer exists.
 */

import type { AnalyzeResponse, TryOnResponse } from '@yincol/shared';

const API_BASE = '/api';

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? 'We could not reach the studio just now.');
  }

  return (await response.json()) as T;
}

export const requestAnalysis = (portraitRef: string): Promise<AnalyzeResponse> =>
  post<AnalyzeResponse>('/analyze', { portraitRef });

export const requestTryOn = (
  portraitRef: string,
  garmentIds: readonly string[],
  makeupLookId: string,
): Promise<TryOnResponse> =>
  post<TryOnResponse>('/try-on', { portraitRef, garmentIds, makeupLookId });
