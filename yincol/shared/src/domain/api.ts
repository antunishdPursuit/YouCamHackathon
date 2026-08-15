/**
 * The contract between `web/` and `server/`.
 *
 * These are internal shapes on both sides of the wire. No vendor field names appear
 * here, and none ever should — the server's adapters are what stand between this file
 * and Perfect Corp's JSON.
 */

import type { Palette, SkinAppearance, TryOnResult } from './types.js';

/** Where an image on screen came from. Rendered as the provenance note. */
export type Provenance =
  /** A real API result, captured earlier and committed as bytes. */
  | 'captured'
  /** A designed stand-in shipped with the repo. Never presented as an API result. */
  | 'placeholder'
  /** Generated live during this session. */
  | 'live';

export interface AnalyzeRequest {
  /** Public URL of the portrait, or a fixture key in fixture mode. */
  readonly portraitRef: string;
}

/**
 * Analysis runs through `Promise.allSettled`, so skin analysis failing cannot take the
 * palette down with it. The palette is required; `skin` is optional context that may
 * legitimately be absent.
 */
export interface AnalyzeResponse {
  readonly palette: Palette;
  readonly skin?: SkinAppearance;
  /** Present when skin analysis failed — shown quietly, never as an error banner. */
  readonly skinUnavailableReason?: string;
  readonly mode: 'fixture' | 'live';
}

export interface TryOnRequest {
  readonly portraitRef: string;
  readonly garmentIds: readonly string[];
  readonly makeupLookId: string;
}

export interface TryOnPanel {
  readonly result: TryOnResult;
  readonly provenance: Provenance;
}

export interface TryOnResponse {
  /** Keyed by garment id. */
  readonly garments: Readonly<Record<string, TryOnPanel>>;
  readonly makeup: TryOnPanel;
  readonly portrait: TryOnPanel;
  readonly mode: 'fixture' | 'live';
}

export interface ApiErrorBody {
  readonly error: string;
  readonly detail?: string;
}
