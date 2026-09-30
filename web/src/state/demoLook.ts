/**
 * The saved demo look — a canned comparison shown with zero calls to the API server.
 *
 * Not fixture MODE (which still round-trips through the Express server's /api routes):
 * this module builds the same shape entirely in the browser, from static assets the
 * static site already serves and the shared, pure palette engine. That is the whole point
 * — the demo must work even if the API service is asleep (the free Render tier sleeps
 * after 15 minutes and can take about a minute to wake), so it cannot depend on that
 * service being reachable at all.
 *
 * The colour reading mirrors `server/src/fixtures/index.ts`'s `FIXTURE_COLOR_TONE` and the
 * garment/look ids mirror its `CAPTURE_TARGETS` / `CAPTURED_MAKEUP_LOOK_ID` — duplicated
 * rather than imported, since that file is server-only. If those values change, update the
 * matching ones here.
 */

import { buildPaletteFromReading, hexToLab, type AnalyzeResponse, type TryOnPanel, type TryOnResponse } from '@yincol/shared';

const DEMO_READING = {
  skin: hexToLab('#e0b492'),
  hair: hexToLab('#3b2a22'),
  eye: hexToLab('#4a3728'),
  eyebrow: hexToLab('#4a352a'),
  lip: hexToLab('#bc7a72'),
};

export const DEMO_GARMENT_IDS = ['rosewater-cardigan', 'sage-linen-shirt'] as const;
export const DEMO_MAKEUP_LOOK_ID = 'rose-veil';

const captured = (imageUrl: string, alt: string, stage: 'garmentOnly' | 'completeLook'): TryOnPanel => ({
  result: { status: 'ready', imageUrl, alt }, provenance: 'captured', stage,
});
const placeholder = (imageUrl: string, alt: string): TryOnPanel => ({
  result: { status: 'ready', imageUrl, alt }, provenance: 'placeholder',
});

export interface DemoLook {
  readonly analysis: AnalyzeResponse;
  readonly tryOn: TryOnResponse;
  readonly garmentIds: readonly string[];
  readonly makeupLookId: string;
}

/**
 * Build the demo look. Synchronous and side-effect free: no `fetch`, no `checkRuntimeHealth`
 * — nothing here can wait on, or fail because of, the API server.
 */
export function loadDemoLook(): DemoLook {
  const palette = buildPaletteFromReading(DEMO_READING);
  const analysis: AnalyzeResponse = { palette, mode: 'fixture' };

  // The portrait is never a real captured photo of anyone — same rule fixture mode
  // follows server-side — so it is always the designed placeholder, never "captured".
  const tryOn: TryOnResponse = {
    mode: 'fixture',
    portrait: placeholder('/fixtures/placeholder-portrait.svg', 'Designed stand-in for the portrait'),
    portraitMadeUp: placeholder('/fixtures/placeholder-portrait-makeup.svg', 'Designed stand-in for the portrait with Rose Veil makeup'),
    garments: {
      'rosewater-cardigan': captured('/fixtures/garment-a-result.jpg', 'The demo portrait wearing the rosewater cardigan', 'garmentOnly'),
      'sage-linen-shirt': captured('/fixtures/garment-b-result.jpg', 'The demo portrait wearing the sage linen shirt', 'garmentOnly'),
    },
    completeLooks: {
      'rosewater-cardigan': captured('/fixtures/complete-look-a-result.jpg', 'The demo portrait wearing the rosewater cardigan, with the Rose Veil makeup look', 'completeLook'),
      'sage-linen-shirt': captured('/fixtures/complete-look-b-result.jpg', 'The demo portrait wearing the sage linen shirt, with the Rose Veil makeup look', 'completeLook'),
    },
  };

  return { analysis, tryOn, garmentIds: [...DEMO_GARMENT_IDS], makeupLookId: DEMO_MAKEUP_LOOK_ID };
}
