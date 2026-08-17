/**
 * Fixture mode still has to walk the whole journey, and still has to tell the truth
 * about what it is showing while it does.
 */

import { describe, expect, it } from 'vitest';
import { fixtureCompleteLook } from './index.js';

const base = {
  garmentName: 'Rosewater cardigan',
  lookName: 'Rose Veil',
  simulate: 'none' as const,
};

const garmentA = { ...base, garmentId: 'rosewater-cardigan', index: 0 };
const garmentB = { ...base, garmentId: 'sage-linen-shirt', index: 1 };

describe('fixture-mode complete looks', () => {
  it('fills both panels for both garments with no network', () => {
    for (const request of [garmentA, garmentB]) {
      const outcome = fixtureCompleteLook(request);
      expect(outcome.garmentOnly.result.status).toBe('ready');
      expect(outcome.completeLook.result.status).toBe('ready');
    }
  });

  it('never lets a shipped placeholder claim to be a complete look', () => {
    const outcome = fixtureCompleteLook(garmentA);

    // No capture has been run in this repository, so both resolve to placeholders — and
    // a placeholder gets no stage, because nothing rendered it.
    expect(outcome.completeLook.provenance).toBe('placeholder');
    expect(outcome.completeLook.stage).toBeUndefined();
    expect(outcome.garmentOnly.provenance).toBe('placeholder');
    expect(outcome.garmentOnly.stage).toBeUndefined();
  });

  it('gives the two garments different complete-look panels', () => {
    const a = fixtureCompleteLook(garmentA).completeLook.result;
    const b = fixtureCompleteLook(garmentB).completeLook.result;

    expect(a.status).toBe('ready');
    expect(b.status).toBe('ready');
    if (a.status !== 'ready' || b.status !== 'ready') return;
    // Two panels showing the same picture is not a comparison, even in fixture mode.
    expect(a.imageUrl).not.toBe(b.imageUrl);
  });

  it('fails both of garment B\'s panels under partialFailure, and neither of A\'s', () => {
    const a = fixtureCompleteLook({ ...garmentA, simulate: 'partialFailure' });
    const b = fixtureCompleteLook({ ...garmentB, simulate: 'partialFailure' });

    expect(a.garmentOnly.result.status).toBe('ready');
    expect(a.completeLook.result.status).toBe('ready');
    expect(b.garmentOnly.result.status).toBe('failed');
    expect(b.completeLook.result.status).toBe('failed');
  });

  it('keeps garment B\'s garment preview under completeLookFailure', () => {
    const b = fixtureCompleteLook({ ...garmentB, simulate: 'completeLookFailure' });

    // The half-failure the sequenced path introduces: the garment step landed, the makeup
    // step did not, and the shopper keeps something usable either way.
    expect(b.garmentOnly.result.status).toBe('ready');
    expect(b.completeLook.result.status).toBe('failed');
    if (b.completeLook.result.status !== 'failed') return;
    expect(b.completeLook.result.reason).toContain('garment preview itself is unaffected');
  });

  it('leaves garment A alone under completeLookFailure', () => {
    const a = fixtureCompleteLook({ ...garmentA, simulate: 'completeLookFailure' });

    expect(a.garmentOnly.result.status).toBe('ready');
    expect(a.completeLook.result.status).toBe('ready');
  });
});
