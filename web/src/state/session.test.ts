import { describe, expect, it } from 'vitest';
import { initialState, sessionReducer, inputsComplete, type CapturedImage, type SessionState } from './session.js';
const image: CapturedImage = { file: new File(['x'], 'test.png'), previewUrl: 'blob:test', width: 1000, height: 1500 };
const ready: SessionState = { ...initialState, portrait: image, garmentInputs: { a: image, b: image },
  makeupLookId: 'champagne-halo', garmentIds: ['a', 'b'] };
describe('full-body session lifecycle', () => {
  it('requires both new inputs only when full-body is selected', () => {
    expect(inputsComplete(ready)).toBe(true);
    let state = sessionReducer(ready, { type: 'enableFullBody', enabled: true });
    expect(inputsComplete(state)).toBe(false);
    state = sessionReducer(state, { type: 'setFullBodyInput', slot: 'portrait', image });
    expect(inputsComplete(state)).toBe(false);
    state = sessionReducer(state, { type: 'setFullBodyInput', slot: 'trousers', image });
    expect(inputsComplete(state)).toBe(true);
    state = sessionReducer(state, { type: 'setFullBodyInput', slot: 'trousers', image: null });
    expect(inputsComplete(state)).toBe(false);
  });
  it('invalidates the result when any full-body input changes', () => {
    const state = sessionReducer({ ...ready, tryOn: {} as SessionState['tryOn'],
      analysis: {} as SessionState['analysis'] },
      { type: 'setFullBodyInput', slot: 'trousers', image });
    expect(state.tryOn).toBeNull(); expect(state.analysis).toBeNull();
  });
  it('clears both portraits, trousers, and results on deletion or start over', () => {
    const state = { ...ready, fullBody: { enabled: true, portrait: image, trousers: image } };
    for (const type of ['clearPortrait', 'startOver'] as const) {
      const cleared = sessionReducer(state, { type });
      expect(cleared.portrait).toBeNull();
      expect(cleared.fullBody).toEqual(initialState.fullBody);
      expect(cleared.tryOn).toBeNull();
    }
  });
  it('keeps navigation free of generation and preserves uploads', () => {
    const state = { ...ready, fullBody: { enabled: true, portrait: image, trousers: image } };
    const start = sessionReducer(state, { type: 'goTo', step: 'intro' });
    const returned = sessionReducer(start, { type: 'editInputs' });
    expect(returned.fullBody).toBe(state.fullBody);
    expect(returned.busy).toBe(false);
  });

});

it('preserves A/B identity after removing A and replacing B', () => {
  let state = sessionReducer(ready, { type: 'clearGarmentInput', slot: 'a' });
  state = sessionReducer(state, { type: 'setGarmentInput', slot: 'b', image });
  state = sessionReducer(state, { type: 'setGarmentInput', slot: 'a', image });
  expect(state.garmentIds).toEqual(['rosewater-cardigan', 'sage-linen-shirt']);
});


describe('guided comparison navigation', () => {
  const generated = {
    mode: 'live' as const, portrait: { provenance: 'live' as const, result: { status: 'ready' as const, imageUrl: '/test-only', alt: 'Test portrait' } }, garments: {}, completeLooks: {},
    fullBody: { mode: 'live' as const, garments: {}, completeLooks: {} },
  };
  it('opens on the outfits axis and switches on request, without touching the result', () => {
    let state = sessionReducer(ready, { type: 'tryOnReady', tryOn: generated });
    expect(state.axis).toBe('garments');
    expect(state.busy).toBe(false);
    state = sessionReducer(state, { type: 'setAxis', axis: 'makeup' });
    expect(state.axis).toBe('makeup');
    expect(state.tryOn).toBe(generated);
    state = sessionReducer(state, { type: 'setAxis', axis: 'garments' });
    expect(state.axis).toBe('garments');
    expect(state.tryOn).toBe(generated);
  });
});


it('preserves completed work when choosing the selected makeup again, but invalidates a changed choice', () => {
  const generated = { ...ready, analysis: {} as NonNullable<SessionState['analysis']>,
    tryOn: {} as NonNullable<SessionState['tryOn']> };
  expect(sessionReducer(generated, { type: 'chooseMakeup', lookId: ready.makeupLookId! })).toBe(generated);
  const changed = sessionReducer(generated, { type: 'chooseMakeup', lookId: 'rose-veil' });
  expect(changed.tryOn).toBeNull();
  expect(changed.analysis).toBeNull();
});

it('reuses a cached or saved result after analysisStarted without needing to restore anything else', () => {
  // Regression coverage for a fixed bug: analysisStarted used to spread the same
  // "cleared on input change" object real input changes use, so it wiped state that had
  // nothing to do with the inputs. There is no longer any such state (kept choices were
  // removed entirely in a later change), but the ordering this protects — analysisStarted
  // clears only analysis/tryOn/error, never anything a reused result would need restored —
  // remains worth asserting directly, since a future field could reintroduce the same bug.
  const generated = { ...ready, analysis: {} as NonNullable<SessionState['analysis']>,
    tryOn: {} as NonNullable<SessionState['tryOn']> };
  let state = sessionReducer(generated, { type: 'analysisStarted' });
  expect(state.analysis).toBeNull();
  expect(state.tryOn).toBeNull();
  expect(state.garmentInputs).toBe(generated.garmentInputs);
  expect(state.makeupLookId).toBe(generated.makeupLookId);
  state = sessionReducer(state, { type: 'analysisReady', analysis: {} as NonNullable<SessionState['analysis']> });
  state = sessionReducer(state, { type: 'tryOnReady', tryOn: {} as NonNullable<SessionState['tryOn']> });
  expect(state.busy).toBe(false);
});

it('opens saved comparisons without restoring uploads or starting generation', () => {
  const restored = sessionReducer({ ...ready, busy: true, consentGiven: false }, {
    type: 'restoreGeneration', analysis: {} as NonNullable<SessionState['analysis']>,
    tryOn: { fullBody: {} } as NonNullable<SessionState['tryOn']>, garmentIds: ['a', 'b'], makeupLookId: 'rose-veil',
  });
  expect(restored.step).toBe('results');
  expect(restored.fullBody).toEqual({ enabled: true, portrait: null, trousers: null });
  expect(restored.busy).toBe(false);
  expect(restored.consentGiven).toBe(false);
  expect(restored.portrait).toBeNull();
  expect(restored.garmentInputs).toEqual({ a: null, b: null });
  expect(inputsComplete(restored)).toBe(false);
});
