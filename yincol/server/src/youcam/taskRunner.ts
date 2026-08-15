/**
 * ONE generic task runner. Not four polling loops.
 *
 * Every Perfect Corp feature follows the same five steps, so this file implements them
 * once and the four features differ only by a config object:
 *
 *   1. get an image into the system  (see imageInput.ts — we use the public-URL path)
 *   2. POST to the feature's task endpoint → receive `task_id`
 *   3. poll GET `{taskPath}/{task_id}` until `task_status` is "success" or "error"
 *   4. read the result — a download URL for image features, JSON for analysis features
 *   5. hand it to the feature's adapter
 *
 * Vendor JSON reaches the adapters and stops there. Nothing above this layer ever sees
 * a `task_status` or a snake_case field.
 */

import {
  POLL_INTERVAL_MS,
  POLL_MAX_ATTEMPTS,
  RATE_LIMIT_BACKOFF_MS,
  RATE_LIMIT_MAX_RETRIES,
  authHeader,
  type FeatureId,
  type YouCamConfig,
} from './config.js';

/** As reported by the API. */
export type TaskStatus = 'running' | 'success' | 'error';

export interface TaskFeature {
  readonly id: FeatureId;
  readonly taskPath: string;
  /** Human label used in logs and in the loading copy. */
  readonly label: string;
}

/** The raw polled payload. Deliberately loose — this is vendor territory. */
export type RawTaskResult = Record<string, unknown>;

export class YouCamError extends Error {
  constructor(
    message: string,
    readonly detail: {
      readonly feature: FeatureId;
      readonly stage: 'start' | 'poll' | 'download';
      readonly status?: number;
      readonly taskId?: string;
    },
  ) {
    super(message);
    this.name = 'YouCamError';
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A fetch that retries on 429 only.
 *
 * Rate limits are 250 requests per 300 seconds. We are nowhere near that, so a fixed
 * backoff with a small retry count is the right amount of machinery — anything more
 * elaborate would be solving a problem we do not have.
 */
async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  feature: FeatureId,
  stage: 'start' | 'poll' | 'download',
): Promise<Response> {
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, init);
    if (response.status !== 429) return response;

    if (attempt === RATE_LIMIT_MAX_RETRIES) {
      throw new YouCamError(`Rate limited by the API after ${attempt + 1} attempts.`, {
        feature,
        stage,
        status: 429,
      });
    }
    // Honour Retry-After when the API sends one; otherwise use our own interval.
    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RATE_LIMIT_BACKOFF_MS);
  }
  // Unreachable: the loop either returns or throws.
  throw new YouCamError('Rate limit retry loop exited unexpectedly.', { feature, stage });
}

/**
 * The API nests its payload differently across features and versions, so read the two
 * or three shapes we have seen rather than insisting on one. Whatever is found gets
 * logged in fixture-capture output so the real shape can be written down for good.
 */
function readStatus(body: RawTaskResult): { status: TaskStatus; taskId?: string } {
  const nested = (body['result'] ?? body['data'] ?? body) as RawTaskResult;
  const rawStatus = (nested['task_status'] ?? body['task_status'] ?? body['status']) as
    | string
    | undefined;
  const taskId = (nested['task_id'] ?? body['task_id'] ?? body['id']) as string | undefined;

  const status: TaskStatus =
    rawStatus === 'success' || rawStatus === 'error' || rawStatus === 'running'
      ? rawStatus
      : 'running';

  return taskId === undefined ? { status } : { status, taskId };
}

// ─────────────────────────────────────────────────────────────
// The five steps
// ─────────────────────────────────────────────────────────────

/** Step 2: start a task, get a `task_id`. */
export async function startTask(
  config: YouCamConfig,
  feature: TaskFeature,
  payload: unknown,
): Promise<string> {
  const response = await fetchWithBackoff(
    `${config.baseUrl}${feature.taskPath}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(config.apiKey) },
      body: JSON.stringify(payload),
    },
    feature.id,
    'start',
  );

  const text = await response.text();
  if (!response.ok) {
    throw new YouCamError(`${feature.label} failed to start: ${response.status} ${text}`, {
      feature: feature.id,
      stage: 'start',
      status: response.status,
    });
  }

  const body = JSON.parse(text) as RawTaskResult;
  const { taskId } = readStatus(body);
  if (!taskId) {
    throw new YouCamError(`${feature.label} started but returned no task_id: ${text}`, {
      feature: feature.id,
      stage: 'start',
      status: response.status,
    });
  }
  return taskId;
}

/** Step 3: poll until the task settles. */
export async function pollTask(
  config: YouCamConfig,
  feature: TaskFeature,
  taskId: string,
  onAttempt?: (attempt: number) => void,
): Promise<RawTaskResult> {
  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt += 1) {
    onAttempt?.(attempt);

    const response = await fetchWithBackoff(
      `${config.baseUrl}${feature.taskPath}/${taskId}`,
      { method: 'GET', headers: authHeader(config.apiKey) },
      feature.id,
      'poll',
    );

    const text = await response.text();
    if (!response.ok) {
      throw new YouCamError(`${feature.label} poll failed: ${response.status} ${text}`, {
        feature: feature.id,
        stage: 'poll',
        status: response.status,
        taskId,
      });
    }

    const body = JSON.parse(text) as RawTaskResult;
    const { status } = readStatus(body);

    // Billing note: an `error` task costs nothing, and neither does `running`. Credits
    // burn on success only, so there is no cost reason to bail out of a poll early.
    if (status === 'success') return body;
    if (status === 'error') {
      throw new YouCamError(`${feature.label} reported task_status "error": ${text}`, {
        feature: feature.id,
        stage: 'poll',
        taskId,
      });
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new YouCamError(
    `${feature.label} did not settle within ${POLL_MAX_ATTEMPTS} attempts (~${
      (POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS) / 1000
    }s).`,
    { feature: feature.id, stage: 'poll', taskId },
  );
}

/** Steps 2 + 3 together, which is how callers always want them. */
export async function runTask(
  config: YouCamConfig,
  feature: TaskFeature,
  payload: unknown,
  onAttempt?: (attempt: number) => void,
): Promise<{ taskId: string; raw: RawTaskResult }> {
  const taskId = await startTask(config, feature, payload);
  const raw = await pollTask(config, feature, taskId, onAttempt);
  return { taskId, raw };
}

// ─────────────────────────────────────────────────────────────
// Step 4: reading a result
// ─────────────────────────────────────────────────────────────

/**
 * Pull downloadable image URLs out of a successful result.
 *
 * TODO(phase0): verify in API Playground. The exact field names on success are not
 * confirmed, so this walks the payload for anything that looks like an image URL rather
 * than committing to one shape. The capture script logs the full payload on success so
 * the real shape can be recorded in docs/api-findings.md and this can be tightened.
 */
export function extractResultUrls(raw: RawTaskResult): string[] {
  const found: string[] = [];

  const visit = (node: unknown): void => {
    if (typeof node === 'string') {
      if (/^https?:\/\//.test(node)) found.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        // Only follow keys that could plausibly carry a result URL, so we do not pick up
        // a docs link or an avatar from somewhere else in the payload.
        if (/url|link|download|src|image|path/i.test(key) || typeof value === 'object') {
          visit(value);
        }
      }
    }
  };

  visit(raw['result'] ?? raw['data'] ?? raw);
  return [...new Set(found)];
}

/**
 * Step 5 for image features: download the bytes.
 *
 * Called immediately after success, never later. The URL is good for two hours; the
 * bytes are good forever, and only bytes survive to demo day.
 */
export async function downloadResult(
  url: string,
  feature: FeatureId,
): Promise<{ bytes: Buffer; contentType: string }> {
  const response = await fetchWithBackoff(url, { method: 'GET' }, feature, 'download');
  if (!response.ok) {
    throw new YouCamError(`Result download failed: ${response.status}`, {
      feature,
      stage: 'download',
      status: response.status,
    });
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    bytes: Buffer.from(arrayBuffer),
    contentType: response.headers.get('content-type') ?? 'image/jpeg',
  };
}
