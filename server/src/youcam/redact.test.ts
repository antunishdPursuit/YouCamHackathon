/**
 * The rule that keeps a presigned link out of anything durable.
 *
 * The captured shape records are committed, so this is what stands between a two-hour
 * bearer credential for a generated face image and a permanent place in the history.
 */

import { describe, expect, it } from 'vitest';
import { REDACTED_URL, redactUrls, redactUrlsDeep } from './redact.js';

/** A real one, shortened: the parts that matter are the credential and the signature. */
const SIGNED_URL =
  'https://yce-us.s3-accelerate.amazonaws.com/ttl30/491/v2/x/abc.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
  '&X-Amz-Expires=7200&X-Amz-Credential=AKIAEXAMPLE%2F20260829%2Fus-west-2%2Fs3%2Faws4_request' +
  '&X-Amz-Signature=7951ee4634ffd591126231ef0d6deffc50a610ae6491161e4edca230907e8688';

describe('redactUrls', () => {
  it('removes the whole signed URL, credential and signature included', () => {
    const redacted = redactUrls(`downloading ${SIGNED_URL} now`);

    expect(redacted).toBe(`downloading ${REDACTED_URL} now`);
    expect(redacted).not.toContain('X-Amz-Signature');
    expect(redacted).not.toContain('AKIAEXAMPLE');
    expect(redacted).not.toContain('amazonaws.com');
  });

  it('leaves text with no URL alone', () => {
    expect(redactUrls('task_status "error"')).toBe('task_status "error"');
  });
});

describe('redactUrlsDeep', () => {
  it('redacts a task result while keeping every field and value around it', () => {
    const raw = {
      status: 200,
      data: {
        error: null,
        results: { url: SIGNED_URL },
        task_status: 'success',
      },
    };

    expect(redactUrlsDeep(raw)).toEqual({
      status: 200,
      data: {
        error: null,
        results: { url: REDACTED_URL },
        task_status: 'success',
      },
    });
  });

  it('reaches URLs nested in arrays, as the skin analysis masks are', () => {
    const raw = {
      results: {
        output: [
          { type: 'texture', ui_score: 77, mask_urls: [SIGNED_URL], url: null },
          { type: 'pore', ui_score: 66, mask_urls: [SIGNED_URL, SIGNED_URL], url: null },
        ],
      },
    };

    const redacted = redactUrlsDeep(raw);

    expect(JSON.stringify(redacted)).not.toContain('X-Amz');
    expect(redacted.results.output[0]?.mask_urls).toEqual([REDACTED_URL]);
    expect(redacted.results.output[1]?.mask_urls).toHaveLength(2);
    // The numbers are the reason the record exists, so they must survive untouched.
    expect(redacted.results.output[0]?.ui_score).toBe(77);
    expect(redacted.results.output[1]?.type).toBe('pore');
  });

  it('passes through the values JSON can hold that are not strings', () => {
    const raw = { n: 1, f: 1.5, t: true, nul: null, empty: {}, list: [] };
    expect(redactUrlsDeep(raw)).toEqual(raw);
  });

  it('does not mutate what it was given', () => {
    const raw = { data: { results: { url: SIGNED_URL } } };
    const redacted = redactUrlsDeep(raw);

    expect(raw.data.results.url).toBe(SIGNED_URL);
    expect(redacted.data.results.url).toBe(REDACTED_URL);
  });
});
