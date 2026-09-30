import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDemoLook, DEMO_GARMENT_IDS, DEMO_MAKEUP_LOOK_ID } from './demoLook.js';

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
    expect(demo.tryOn.portrait.provenance).toBe('placeholder');
    expect(demo.tryOn.portraitMadeUp?.provenance).toBe('placeholder');
    expect(demo.tryOn.mode).toBe('fixture');
  });

  it('shows the captured garment and complete-look fixtures for both demo garments', () => {
    const demo = loadDemoLook();
    expect(demo.garmentIds).toEqual([...DEMO_GARMENT_IDS]);
    expect(demo.makeupLookId).toBe(DEMO_MAKEUP_LOOK_ID);
    for (const id of DEMO_GARMENT_IDS) {
      expect(demo.tryOn.garments[id]).toMatchObject({ provenance: 'captured', stage: 'garmentOnly' });
      expect(demo.tryOn.completeLooks[id]).toMatchObject({ provenance: 'captured', stage: 'completeLook' });
    }
  });

  it('produces a valid palette from the shared engine', () => {
    const demo = loadDemoLook();
    expect(demo.analysis.mode).toBe('fixture');
    expect(demo.analysis.palette.swatches).toHaveLength(6);
  });
});
