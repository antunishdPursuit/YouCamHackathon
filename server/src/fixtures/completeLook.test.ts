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
    // The invariant is the pairing, not which side of it this repository happens to be on.
    // `stage` describes a sequence that actually ran, so a captured fixture carries one and
    // a placeholder must not — whether or not a capture has been committed. Asserting
    // "both are placeholders" instead would only restate the current contents of
    // web/public/fixtures/, and did: it broke the moment the real captures landed.
    for (const request of [garmentA, garmentB]) {
      const outcome = fixtureCompleteLook(request);

      for (const panel of [outcome.completeLook, outcome.garmentOnly]) {
        if (panel.provenance === 'placeholder') {
          expect(panel.stage).toBeUndefined();
        } else {
          expect(panel.provenance).toBe('captured');
          expect(panel.stage).toBeDefined();
        }
      }
    }
  });

  it('describes the captured panels as the steps that produced them', () => {
    const outcome = fixtureCompleteLook(garmentA);

    // Only meaningful once a capture exists; before that there is nothing to describe.
    if (outcome.completeLook.provenance === 'captured') {
      expect(outcome.completeLook.stage).toBe('completeLook');
    }
    if (outcome.garmentOnly.provenance === 'captured') {
      expect(outcome.garmentOnly.stage).toBe('garmentOnly');
    }
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
