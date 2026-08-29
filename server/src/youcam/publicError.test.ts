/**
 * The one rule worth a test: a provider error never reaches a public response.
 *
 * These assert on the shape of what leaks, not on exact copy — the point is that the
 * vendor's body, status and endpoint are absent, whatever sentence replaces them.
 */

import { describe, expect, it } from 'vitest';
import { ImageUploadError } from './imageInput.js';
import { YouCamError } from './taskRunner.js';
import { publicFailureReason } from './publicError.js';

const FALLBACK = 'This preview could not be generated.';

describe('publicFailureReason', () => {
  it('replaces a task error carrying the provider response body', () => {
    // What pollTask actually throws when a task settles as "error".
    const error = new YouCamError(
      'Clothes VTO reported task_status "error": {"error":"src_face_invalid","error_code":"E1004"}',
      { feature: 'clothesVto', stage: 'poll', taskId: 'task_123' },
    );

    const reason = publicFailureReason(error, FALLBACK);

    expect(reason).toBe(FALLBACK);
    expect(reason).not.toContain('src_face_invalid');
    expect(reason).not.toContain('E1004');
    expect(reason).not.toContain('task_123');
  });

  it('replaces a start failure carrying the HTTP status', () => {
    const error = new YouCamError('Makeup VTO failed to start: 401 {"error":"invalid_key"}', {
      feature: 'makeupVto',
      stage: 'start',
      status: 401,
    });

    const reason = publicFailureReason(error, FALLBACK);

    expect(reason).toBe(FALLBACK);
    expect(reason).not.toContain('401');
    expect(reason).not.toContain('invalid_key');
  });

  it('replaces an upload failure', () => {
    const error = new ImageUploadError('File metadata request failed: 403', {
      feature: 'clothesVto',
      stage: 'metadata',
      status: 403,
    });

    expect(publicFailureReason(error, FALLBACK)).toBe(FALLBACK);
  });

  it('keeps a message this codebase wrote for the shopper', () => {
    const error = new Error('Add a garment reference for the sage linen shirt.');

    expect(publicFailureReason(error, FALLBACK)).toBe(
      'Add a garment reference for the sage linen shirt.',
    );
  });

  it('redacts a signed URL that reached one of our own messages', () => {
    const error = new Error('Could not read https://yce-api-01.makeupar.com/x?sig=abc123 just now.');

    const reason = publicFailureReason(error, FALLBACK);

    expect(reason).toContain('[url redacted]');
    expect(reason).not.toContain('sig=abc123');
  });

  it('falls back for a non-Error rejection', () => {
    expect(publicFailureReason('boom', FALLBACK)).toBe(FALLBACK);
    expect(publicFailureReason(undefined, FALLBACK)).toBe(FALLBACK);
    expect(publicFailureReason(new Error(''), FALLBACK)).toBe(FALLBACK);
  });
});
