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
 * The colour reading is illustrative, not an analysis of the public portrait. The
 * approved full-body captures use Champagne Halo. The server's older close-up
 * fixtures use Rose Veil and must not be substituted into this comparison.
 */

import { buildPaletteFromReading, hexToLab, type AnalyzeResponse, type TryOnPanel, type TryOnResponse } from '@yincol/shared';
import { DEMO_PORTRAIT_URL } from './demoAssets.js';

const DEMO_READING = {
  skin: hexToLab('#e0b492'),
  hair: hexToLab('#3b2a22'),
  eye: hexToLab('#4a3728'),
  eyebrow: hexToLab('#4a352a'),
  lip: hexToLab('#bc7a72'),
};

export const DEMO_GARMENT_IDS = ['rosewater-cardigan', 'sage-linen-shirt'] as const;
export const DEMO_MAKEUP_LOOK_ID = 'champagne-halo';

const captured = (imageUrl: string, alt: string, stage: 'garmentOnly' | 'completeLook' | 'portraitMakeup'): TryOnPanel => ({
  result: { status: 'ready', imageUrl, alt }, provenance: 'captured', stage,
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

  // Dennis approved this exact public source and the two existing full-body captures.
  // The matching portrait makeup was captured separately with the same preset.
  const tryOn: TryOnResponse = {
    mode: 'fixture',
    portrait: { provenance: 'source', result: {
      status: 'ready', imageUrl: DEMO_PORTRAIT_URL, alt: 'Original portrait used for the demo makeup comparison',
    } },
    portraitMadeUp: captured('/fixtures/demo-portrait-champagne-halo.png', 'Original demo portrait with Champagne Halo makeup, clothing unchanged', 'portraitMakeup'),
    demoVideoExample: captured('/fixtures/complete-look-a-result.jpg', 'Earlier red-shirt close-up with Rose Veil makeup', 'completeLook'),
    demoFullBodyVideoExample: captured('/fixtures/ivory-blazer-complete-look-peach-ember-20261002.png', 'Full-body ivory blazer, taupe trousers, and Peach Ember makeup', 'completeLook'),
    garments: {},
    completeLooks: {},
    fullBody: {
      mode: 'fixture',
      garments: {},
      completeLooks: {
        'rosewater-cardigan': captured('/fixtures/demo-full-body-a.png', 'Saved full-body Outfit A with cream trousers and Champagne Halo makeup', 'completeLook'),
        'sage-linen-shirt': captured('/fixtures/demo-full-body-b.png', 'Saved full-body Outfit B with cream trousers and Champagne Halo makeup', 'completeLook'),
      },
    },
  };

  return { analysis, tryOn, garmentIds: [...DEMO_GARMENT_IDS], makeupLookId: DEMO_MAKEUP_LOOK_ID };
}
