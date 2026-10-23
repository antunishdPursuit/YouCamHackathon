import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDemoLook, DEMO_GARMENT_IDS, DEMO_MAKEUP_LOOK_ID } from './demoLook.js';
import { DEMO_PORTRAIT_URL } from './demoAssets.js';

afterEach(() => { vi.unstubAllGlobals(); });

describe('the saved demo look', () => {
  it('builds without any network call', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    loadDemoLook();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('never claims the portrait is a captured or live result', () => {
    const demo = loadDemoLook();
    expect(demo.tryOn.portrait.provenance).toBe('source');
    expect(demo.tryOn.portrait.result).toMatchObject({ imageUrl: DEMO_PORTRAIT_URL });
    expect(demo.tryOn.portraitMadeUp).toMatchObject({ provenance: 'captured', stage: 'portraitMakeup',
      result: { status: 'ready', imageUrl: '/fixtures/demo-portrait-champagne-halo.png' } });
    expect(demo.tryOn.mode).toBe('fixture');
  });

  it('uses the approved full-body captures with their actual makeup and no relabelled Rose Veil results', () => {
    const demo = loadDemoLook();
    expect(demo.garmentIds).toEqual([...DEMO_GARMENT_IDS]);
    expect(demo.makeupLookId).toBe(DEMO_MAKEUP_LOOK_ID);
    expect(demo.makeupLookId).toBe('champagne-halo');
    expect(demo.tryOn.completeLooks).toEqual({});
    for (const id of DEMO_GARMENT_IDS) {
      expect(demo.tryOn.fullBody?.completeLooks[id]).toMatchObject({ provenance: 'captured', stage: 'completeLook' });
    }
    expect(demo.tryOn.demoFullBodyVideoExample).toMatchObject({ provenance: 'captured', stage: 'completeLook',
      result: { status: 'ready', imageUrl: '/fixtures/ivory-blazer-complete-look-peach-ember-20261002.png' } });
  });

  it('produces a valid palette from the shared engine', () => {
    const demo = loadDemoLook();
    expect(demo.analysis.mode).toBe('fixture');
    expect(demo.analysis.palette.swatches).toHaveLength(6);
  });
});
