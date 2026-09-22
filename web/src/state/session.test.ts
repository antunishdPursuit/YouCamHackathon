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
  it('invalidates both result views when any full-body input changes', () => {
    const state = sessionReducer({ ...ready, tryOn: {} as SessionState['tryOn'],
      analysis: {} as SessionState['analysis'], keptGarmentIds: ['a'], fullBodyKeptGarmentIds: ['b'] },
      { type: 'setFullBodyInput', slot: 'trousers', image });
    expect(state.tryOn).toBeNull(); expect(state.analysis).toBeNull();
    expect(state.keptGarmentIds).toEqual([]); expect(state.fullBodyKeptGarmentIds).toEqual([]);
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
  it('opens generated outfits in full body and uses close-up when that view is absent', () => {
    const full = sessionReducer(ready, { type: 'tryOnReady', tryOn: generated });
    expect(full.axis).toBe('garments'); expect(full.resultView).toBe('fullBody');
    const { fullBody: _unused, ...closeOnly } = generated;
    const close = sessionReducer(full, { type: 'tryOnReady', tryOn: closeOnly });
    expect(close.axis).toBe('garments'); expect(close.resultView).toBe('closeup');
  });
  it('uses task defaults on tab changes, permits view overrides, and preserves kept choices', () => {
    let state = sessionReducer(ready, { type: 'tryOnReady', tryOn: generated });
    state = sessionReducer(state, { type: 'toggleGarmentKept', garmentId: 'a' });
    state = sessionReducer(state, { type: 'setAxis', axis: 'makeup' });
    expect(state.resultView).toBe('closeup');
    state = sessionReducer(state, { type: 'toggleMakeupKept', winner: 'completeLook' });
    state = sessionReducer(state, { type: 'setResultView', view: 'fullBody' });
    expect(state.axis).toBe('makeup'); expect(state.resultView).toBe('fullBody');
    state = sessionReducer(state, { type: 'toggleMakeupKept', winner: 'garmentOnly' });
    state = sessionReducer(state, { type: 'setAxis', axis: 'garments' });
    expect(state.resultView).toBe('fullBody');
    expect(state.fullBodyKeptGarmentIds).toEqual(['a']);
    expect(state.keptMakeupWinners).toEqual(['completeLook']);
    expect(state.fullBodyKeptMakeupWinners).toEqual(['garmentOnly']);
    expect(state.tryOn).toBe(generated);
    expect(state.busy).toBe(false);
    state = sessionReducer(state, { type: 'setAxis', axis: 'makeup' });
    expect(state.resultView).toBe('closeup');
    expect(state.keptMakeupWinners).toEqual(['completeLook']);
  });
  it('does not expose a missing full-body view when navigating or overriding', () => {
    const { fullBody: _unused, ...closeOnly } = generated;
    let state = sessionReducer(ready, { type: 'tryOnReady', tryOn: closeOnly });
    state = sessionReducer(state, { type: 'setAxis', axis: 'makeup' });
    state = sessionReducer(state, { type: 'setAxis', axis: 'garments' });
    state = sessionReducer(state, { type: 'setResultView', view: 'fullBody' });
    expect(state.resultView).toBe('closeup');
    expect(state.tryOn).toBe(closeOnly);
  });
});
