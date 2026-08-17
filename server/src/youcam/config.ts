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
export type FeatureId = 'facialColorTone' | 'skinAnalysis' | 'clothesVto' | 'makeupVto';

/**
 * API host.
 *
 * The makeupar host is locally verified for Skin Analysis, Clothes VTO, and Makeup VTO.
 * Facial Color Tone remains unverified.
 * Override with YINCOL_API_BASE_URL rather than editing this line.
 */
export const DEFAULT_API_BASE_URL = 'https://yce-api-01.makeupar.com';

/** VERIFIED: v2.0 takes the API key directly. No RSA, no client_secret — that is v1. */
export const authHeader = (apiKey: string): Record<string, string> => ({
  Authorization: `Bearer ${apiKey}`,
});

// ─────────────────────────────────────────────────────────────
// Task endpoints
// ─────────────────────────────────────────────────────────────

/** LIVE VERIFIED on August 16, 2026 against the current AI Clothes V3 contract. */
export const CLOTHES_VTO_TASK_PATH = '/s2s/v2.0/task/cloth-v3';

/** LIVE VERIFIED on August 16, 2026 against the current AI Makeup VTO contract. */
export const MAKEUP_VTO_TASK_PATH = '/s2s/v2.0/task/makeup-vto';

/** VERIFIED. */
export const SKIN_ANALYSIS_TASK_PATH = '/s2s/v2.0/task/skin-analysis';

/**
 * The feature-cost response identifies this as the current run-task path. The task's
 * input fields, File API path, and response shape still need a live verification before
 * this feature can replace the local palette.
 */
export const FACIAL_COLOR_TONE_TASK_PATH = '/s2s/v2.0/task/skin-tone-analysis';

export const TASK_PATHS: Readonly<Record<FeatureId, string>> = {
  facialColorTone: FACIAL_COLOR_TONE_TASK_PATH,
  skinAnalysis: SKIN_ANALYSIS_TASK_PATH,
  clothesVto: CLOTHES_VTO_TASK_PATH,
  makeupVto: MAKEUP_VTO_TASK_PATH,
};

/** Which of the above have live local evidence. Surfaced in the UI's provenance note. */
export const TASK_PATH_VERIFIED: Readonly<Record<FeatureId, boolean>> = {
  facialColorTone: false,
  skinAnalysis: true,
  clothesVto: true,
  makeupVto: true,
};

/**
 * TODO(phase0): verify in API Playground. The accepted `garment_category` vocabulary is
 * inferred from the documented field name, not confirmed.
 */
export const GARMENT_CATEGORIES = ['upper_body', 'lower_body', 'full_body'] as const;
export type GarmentCategoryValue = (typeof GARMENT_CATEGORIES)[number];

/** VERIFIED in the live v2.0 Skin Analysis test. */
export const SKIN_ANALYSIS_FILE_PATH = '/s2s/v2.0/file/skin-analysis';

/** LIVE VERIFIED on August 16, 2026 against the current AI Clothes V3 contract. */
export const CLOTHES_VTO_FILE_PATH = '/s2s/v2.0/file/cloth-v3';

/** LIVE VERIFIED on August 16, 2026 against the current AI Makeup VTO contract. */
export const MAKEUP_VTO_FILE_PATH = '/s2s/v2.0/file/makeup-vto';

/**
 * File API paths are kept separate from task paths because the vendor's feature slugs are
 * not the same as our internal feature ids. Skin Analysis, Clothes VTO, and Makeup VTO
 * are locally verified; Facial Color Tone remains unverified.
 */
const DOCUMENTED_FILE_PATHS: Partial<Record<FeatureId, string>> = {
  skinAnalysis: SKIN_ANALYSIS_FILE_PATH,
  clothesVto: CLOTHES_VTO_FILE_PATH,
  makeupVto: MAKEUP_VTO_FILE_PATH,
};

export const filePathFor = (feature: FeatureId): string => {
  const path = DOCUMENTED_FILE_PATHS[feature];
  if (!path) {
    throw new Error(`The File API path is not verified for ${feature}.`);
  }
  return path;
};

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

/**
 * Which designed state to force, for demonstrating them without waiting for one to
 * happen naturally.
 *
 * These are not mocks bolted onto the UI — they make the SERVER return exactly what it
 * would return in that situation, so the front end takes the same code path it would
 * take for real. Fixture mode only; live mode ignores it.
 */
export type SimulatedState =
  | 'none'
  | 'noFace'
  /** The garment task fails for garment B; everything else stays usable. */
  | 'partialFailure'
  /** Garment B's garment task succeeds and its makeup step does not — the sequence's own half-failure. */
  | 'completeLookFailure'
  | 'skinUnavailable';

const SIMULATED_STATES: readonly SimulatedState[] = [
  'none',
  'noFace',
  'partialFailure',
  'completeLookFailure',
  'skinUnavailable',
];

export interface YouCamConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  /** Fixture mode is the default. Live mode is opt-in. */
  readonly fixtureMode: boolean;
  /** Explicitly enables live Skin Analysis while the rest of the demo stays on fixtures. */
  readonly liveSkinAnalysis: boolean;
  /** Explicitly enables live Clothes and Makeup VTO while the palette stays on fixtures. */
  readonly liveTryOn: boolean;
  /** Base URL the API can fetch source images from (Path B). Capture script only. */
  readonly publicAssetBaseUrl: string;
  readonly simulate: SimulatedState;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): YouCamConfig {
  // Fixture mode is on unless explicitly turned off. Anything other than the exact
  // string "false" leaves it on — a typo must never silently start spending credits.
  const fixtureMode = (env['YINCOL_FIXTURE_MODE'] ?? 'true').toLowerCase() !== 'false';

  const requested = (env['YINCOL_SIMULATE'] ?? 'none') as SimulatedState;
  const simulate: SimulatedState =
    fixtureMode && SIMULATED_STATES.includes(requested) ? requested : 'none';
  const liveSkinAnalysis =
    !fixtureMode || (env['YINCOL_LIVE_SKIN_ANALYSIS'] ?? '').toLowerCase() === 'true';
  const liveTryOn = !fixtureMode || (env['YINCOL_LIVE_TRY_ON'] ?? '').toLowerCase() === 'true';

  return {
    baseUrl: (env['YINCOL_API_BASE_URL'] ?? DEFAULT_API_BASE_URL).replace(/\/+$/, ''),
    apiKey: env['YINCOL_API_KEY'] ?? '',
    fixtureMode,
    liveSkinAnalysis,
    liveTryOn,
    publicAssetBaseUrl: (env['YINCOL_PUBLIC_ASSET_BASE_URL'] ?? '').replace(/\/+$/, ''),
    simulate,
  };
}
