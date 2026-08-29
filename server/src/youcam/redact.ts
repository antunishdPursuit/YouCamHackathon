/**
 * One rule for provider URLs, in one place.
 *
 * A successful task returns a presigned S3 link carrying `X-Amz-Credential`,
 * `X-Amz-Signature` and a two-hour expiry. It is not our API key, and it dies on its own,
 * but for those two hours it is a bearer credential for a generated image of someone's
 * face — and a repository keeps whatever is committed to it long after the link stops
 * working.
 *
 * So a signed URL is never written anywhere durable: not into a public response, and not
 * into a recorded response shape. What those records are for is the *shape* — which fields
 * come back, nested how, with what types — and a marker preserves every bit of that.
 */

export const REDACTED_URL = '[url redacted]';

/** Replace any URL inside free text. Used on error messages before they are published. */
export const redactUrls = (text: string): string =>
  text.replace(/https?:\/\/\S+/g, REDACTED_URL);

/**
 * Walk a parsed JSON value and redact every URL it holds, keeping the structure intact.
 *
 * Keys, nesting, array order and non-string values are all preserved, because they are
 * the part worth recording. Only the URL's value goes.
 */
export function redactUrlsDeep<T>(value: T): T {
  if (typeof value === 'string') return redactUrls(value) as unknown as T;
  if (Array.isArray(value)) return value.map((entry) => redactUrlsDeep(entry)) as unknown as T;

  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source)) result[key] = redactUrlsDeep(source[key]);
    return result as unknown as T;
  }

  return value;
}
