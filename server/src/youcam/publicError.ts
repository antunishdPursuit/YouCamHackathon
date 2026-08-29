/**
 * The last thing a failure passes through before a stranger can read it.
 *
 * `YouCamError` and `ImageUploadError` are written for whoever is running the local
 * smoke test: their messages carry the HTTP status and, on the task paths, the
 * provider's raw response body verbatim. That is exactly what makes a failed live run
 * diagnosable, and exactly what must not appear in an HTTP response — a provider body
 * can name internal endpoints, echo back the fields we sent, and on an auth failure
 * describe the credential it rejected. Even the bare status is a probing signal: it
 * tells an anonymous caller whether the key behind this server is live.
 *
 * So the detail goes one way and the sentence goes the other. `logFailure` writes the
 * full thing to the server console; `publicFailureReason` returns the sentence the
 * caller wrote for a person. Do both at every public failure site.
 *
 * THE RULE. Those two classes are the only places a provider interaction is wrapped, so
 * an error of either class is never published — its message is replaced wholesale by the
 * caller's fallback. Every other error reaching these helpers carries text this codebase
 * authored to be read ("Add a garment reference before generating live previews"), so it
 * passes through. When in doubt the rule errs toward the fallback, which is the correct
 * direction for text going to the public internet.
 */

import { ImageUploadError } from './imageInput.js';
import { YouCamError } from './taskRunner.js';
import { redactUrls } from './redact.js';

/**
 * Signed provider URLs turn up inside error text, and they are credentials of a sort for
 * as long as they live. Stripped from anything published, including our own messages —
 * a backstop, not the main defence, which is the rule above.
 *
 * The rule itself lives in `redact.ts`, because the capture script needs the same one.
 */
const withoutUrls = redactUrls;

/** The two error classes that wrap a call to the provider. Neither is ever published. */
const isProviderError = (error: unknown): error is YouCamError | ImageUploadError =>
  error instanceof YouCamError || error instanceof ImageUploadError;

/**
 * A failure reason safe to put in a response body.
 *
 * @param fallback What the shopper reads when the real reason cannot be shown. Write it
 * as a plain sentence about what did not happen, not about what the provider said.
 */
export function publicFailureReason(error: unknown, fallback: string): string {
  if (isProviderError(error)) return fallback;
  if (!(error instanceof Error) || !error.message) return fallback;
  return withoutUrls(error.message);
}

/**
 * The other half: the detail, kept where a local tester can see it.
 *
 * @param context Where the failure happened, e.g. `'try-on garment upload'`.
 */
export function logFailure(context: string, error: unknown): void {
  if (isProviderError(error)) {
    console.error(`[yincol] ${context} —`, error.message, JSON.stringify(error.detail));
    return;
  }
  console.error(`[yincol] ${context} —`, error instanceof Error ? error.message : error);
}
