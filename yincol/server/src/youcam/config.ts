/**
 * Every vendor constant lives here, and nowhere else.
 *
 * The point of this file is that confirming something in the API Playground is a
 * one-line change in one place. If you find yourself typing a path or a field name
 * anywhere else in the codebase, put it here instead.
 *
 * Anything marked TODO(phase0) is a guess. Do not repeat it as fact.
 */

/** Feature identifiers used across the runner, the adapters and the fixture layer. */
export type FeatureId = 'facialColorTone' | 'skinAnalysis' | 'clothesVto' | 'makeupTransfer';

/**
 * API host.
 *
 * TODO(phase0): verify in API Playground. Both `yce-api-01.makeupar.com` and
 * `yce-api-01.perfectcorp.com` appear in Perfect Corp materials. We default to the
 * makeupar host. Override with YINCOL_API_BASE_URL rather than editing this line.
 */
export const DEFAULT_API_BASE_URL = 'https://yce-api-01.makeupar.com';

/** VERIFIED: v2.0 takes the API key directly. No RSA, no client_secret — that is v1. */
export const authHeader = (apiKey: string): Record<string, string> => ({
  Authorization: `Bearer ${apiKey}`,
});

// ─────────────────────────────────────────────────────────────
// Task endpoints
// ─────────────────────────────────────────────────────────────

/** VERIFIED. Payload includes `garment_category` and `change_shoes`. */
export const CLOTHES_VTO_TASK_PATH = '/s2s/v2.0/task/cloth';

/** VERIFIED. Polled at `${path}/{task_id}`. */
export const MAKEUP_TRANSFER_TASK_PATH = '/s2s/v2.0/task/mu-transfer';

/** VERIFIED. */
export const SKIN_ANALYSIS_TASK_PATH = '/s2s/v2.0/task/skin-analysis';

/**
 * TODO(phase0): verify in API Playground. The facial colour tone feature is marketed as
 * detecting skin tone plus eye, eyebrow, lip and hair colours, but its task path is not
 * confirmed anywhere we can cite. This value is inferred by analogy with the three paths
 * above and is the single most likely thing in this file to be wrong.
 */
export const FACIAL_COLOR_TONE_TASK_PATH = '/s2s/v2.0/task/facial-color-tone';

export const TASK_PATHS: Readonly<Record<FeatureId, string>> = {
  facialColorTone: FACIAL_COLOR_TONE_TASK_PATH,
  skinAnalysis: SKIN_ANALYSIS_TASK_PATH,
  clothesVto: CLOTHES_VTO_TASK_PATH,
  makeupTransfer: MAKEUP_TRANSFER_TASK_PATH,
};

/** Which of the above we can actually cite. Surfaced in the UI's provenance note. */
export const TASK_PATH_VERIFIED: Readonly<Record<FeatureId, boolean>> = {
  facialColorTone: false,
  skinAnalysis: true,
  clothesVto: true,
  makeupTransfer: true,
};

/**
 * TODO(phase0): verify in API Playground. The accepted `garment_category` vocabulary is
 * inferred from the documented field name, not confirmed.
 */
export const GARMENT_CATEGORIES = ['upper_body', 'lower_body', 'full_body'] as const;
export type GarmentCategoryValue = (typeof GARMENT_CATEGORIES)[number];

/**
 * File API path, per feature.
 *
 * TODO(phase0): verify in API Playground. It is unknown whether a single upload can be
 * reused across features. Unused while we take Path B (public URL), and kept only so the
 * shape of Path A is written down.
 */
export const filePathFor = (feature: FeatureId): string => `/s2s/v2.0/file/${feature}`;

// ─────────────────────────────────────────────────────────────
// Polling and rate limits — VERIFIED
// ─────────────────────────────────────────────────────────────

/** 2-second interval, ~120 attempts. Results typically return in seconds. */
export const POLL_INTERVAL_MS = 2_000;
export const POLL_MAX_ATTEMPTS = 120;

/**
 * 250 requests per 300 seconds, per IP and per token, ~5 QPS recommended. Our
 * concurrency is far below that, so a simple backoff on 429 is all that is warranted.
 */
export const RATE_LIMIT_BACKOFF_MS = 5_000;
export const RATE_LIMIT_MAX_RETRIES = 3;

/**
 * VERIFIED, and it shapes the fixture design: the download URL returned on success is
 * valid for two hours, while `task_id` persists 30 days. Fixtures therefore store
 * downloaded bytes, never URLs, and the capture script downloads immediately.
 */
export const RESULT_URL_TTL_HOURS = 2;

// ─────────────────────────────────────────────────────────────
// Image specs — VERIFIED. Enforced client-side before we spend a call, so the
// definition lives in shared/ where the browser can reach it too.
// ─────────────────────────────────────────────────────────────

export { IMAGE_SPEC } from '@yincol/shared';

// ─────────────────────────────────────────────────────────────
// Runtime configuration
// ─────────────────────────────────────────────────────────────

export interface YouCamConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  /** Fixture mode is the default. Live mode is opt-in. */
  readonly fixtureMode: boolean;
  /** Base URL the API can fetch source images from (Path B). Capture script only. */
  readonly publicAssetBaseUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): YouCamConfig {
  // Fixture mode is on unless explicitly turned off. Anything other than the exact
  // string "false" leaves it on — a typo must never silently start spending credits.
  const fixtureMode = (env['YINCOL_FIXTURE_MODE'] ?? 'true').toLowerCase() !== 'false';

  return {
    baseUrl: (env['YINCOL_API_BASE_URL'] ?? DEFAULT_API_BASE_URL).replace(/\/+$/, ''),
    apiKey: env['YINCOL_API_KEY'] ?? '',
    fixtureMode,
    publicAssetBaseUrl: (env['YINCOL_PUBLIC_ASSET_BASE_URL'] ?? '').replace(/\/+$/, ''),
  };
}
