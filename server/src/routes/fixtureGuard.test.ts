/**
 * The promise being tested: in fixture mode, image bytes do not get in.
 *
 * The cases that matter are the ones a real client produces — an empty `garmentImages`
 * from a shopper who uploaded nothing must pass, while anything actually carrying pixels
 * must not.
 */

import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { carriesImageBytes, rejectImageBytesInFixtureMode } from './fixtureGuard.js';

const IMAGE = { data: 'AAAA', contentType: 'image/jpeg', fileName: 'portrait.jpg' };

describe('carriesImageBytes', () => {
  it('passes a fixture-mode try-on body', () => {
    expect(
      carriesImageBytes({
        portraitRef: 'fixture:portrait',
        garmentIds: ['garment-a', 'garment-b'],
        makeupLookId: 'rose-veil',
      }),
    ).toBe(false);
  });

  it('passes an empty garment map, which is what an upload-free session sends', () => {
    expect(carriesImageBytes({ garmentIds: [], garmentImages: {} })).toBe(false);
  });

  it.each([
    ['a skin-analysis portrait', { image: IMAGE }],
    ['a try-on portrait', { portraitRef: 'fixture:portrait', portrait: IMAGE }],
    ['a garment reference', { garmentImages: { 'garment-a': IMAGE } }],
  ])('catches %s', (_label, body) => {
    expect(carriesImageBytes(body)).toBe(true);
  });

  it('catches a malformed upload too, since the attempt is the thing', () => {
    expect(carriesImageBytes({ portrait: 'not-an-object' })).toBe(true);
    expect(carriesImageBytes({ garmentImages: { 'garment-a': null } })).toBe(true);
  });

  it('treats an absent or explicitly empty field as no upload', () => {
    expect(carriesImageBytes({ portrait: undefined, image: null })).toBe(false);
  });

  it('handles bodies that are not objects at all', () => {
    for (const body of [undefined, null, 'string', 42, []]) {
      expect(carriesImageBytes(body)).toBe(false);
    }
  });
});

describe('rejectImageBytesInFixtureMode', () => {
  function fakeResponse() {
    const res = {
      statusCode: 200,
      body: undefined as unknown,
      status: vi.fn((code: number) => {
        res.statusCode = code;
        return res;
      }),
      json: vi.fn((payload: unknown) => {
        res.body = payload;
        return res;
      }),
    };
    return res;
  }

  it('answers 400 and reports that it handled the request', () => {
    const res = fakeResponse();

    const handled = rejectImageBytesInFixtureMode({ portrait: IMAGE }, res as unknown as Response);

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      code: 'general',
      error: 'This demo runs on fixtures and does not accept uploaded images.',
    });
  });

  it('stays silent for a clean body', () => {
    const res = fakeResponse();

    const handled = rejectImageBytesInFixtureMode(
      { portraitRef: 'fixture:portrait' },
      res as unknown as Response,
    );

    expect(handled).toBe(false);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
