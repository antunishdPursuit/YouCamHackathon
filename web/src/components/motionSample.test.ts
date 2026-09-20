import { describe, expect, it } from 'vitest';
import type { TryOnPanel } from '@yincol/shared';
import { motionSampleKind } from './motionSample.js';

const captured: TryOnPanel = {
  result: { status: 'ready', imageUrl: '/fixtures/complete-look-a-result.jpg', alt: 'Demo result' },
  provenance: 'captured',
  stage: 'completeLook',
};

describe('captured motion source matching', () => {
  it('offers motion only for the captured red-shirt source', () => {
    expect(motionSampleKind(captured, 'fixture')).toBe('video');
  });
  it('keeps the blue-shirt source as a still without photo tilt', () => {
    expect(motionSampleKind({ ...captured, result: { status: 'ready',
      imageUrl: '/fixtures/complete-look-b-result.jpg', alt: 'Blue shirt' } }, 'fixture')).toBe('still');
  });
  it('does not reuse the demo video for a live visitor result', () => {
    expect(motionSampleKind(captured, 'live')).toBeUndefined();
    expect(motionSampleKind({ ...captured, provenance: 'live' }, 'fixture')).toBeUndefined();
  });
  it('does not animate a placeholder or unrelated makeup result', () => {
    expect(motionSampleKind({ ...captured, provenance: 'placeholder' }, 'fixture')).toBeUndefined();
    expect(motionSampleKind({ ...captured, result: { status: 'ready',
      imageUrl: '/fixtures/placeholder-complete-look-a.svg', alt: 'Stand-in' } }, 'fixture')).toBeUndefined();
  });
  it('does not offer motion for incomplete or unavailable results', () => {
    expect(motionSampleKind({ ...captured, stage: 'garmentOnly' }, 'fixture')).toBeUndefined();
    expect(motionSampleKind({ ...captured, result: { status: 'failed', reason: 'Unavailable' } }, 'fixture')).toBeUndefined();
    expect(motionSampleKind(undefined, 'fixture')).toBeUndefined();
  });
});
