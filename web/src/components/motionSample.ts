import type { TryOnPanel, TryOnResponse } from '@yincol/shared';

export const ROSE_VEIL_MOTION_URL = '/fixtures/garment-a-motion-sample.mp4';
export const IVORY_BLAZER_MOTION_URL = '/fixtures/ivory-blazer-complete-look-peach-ember-20261002.mp4';

/** Each saved demo clip is tied to the exact result image sent to YouCam. */
export function motionSampleUrl(panel: TryOnPanel | undefined, mode: TryOnResponse['mode']): string | undefined {
  if (mode !== 'fixture' || panel?.provenance !== 'captured' ||
      panel.stage !== 'completeLook' || panel.result.status !== 'ready') return undefined;
  if (panel.result.imageUrl === '/fixtures/complete-look-a-result.jpg') return ROSE_VEIL_MOTION_URL;
  if (panel.result.imageUrl === '/fixtures/ivory-blazer-complete-look-peach-ember-20261002.png') return IVORY_BLAZER_MOTION_URL;
  return undefined;
}

/** Match the captured source exactly; never animate an unrelated or live result. */
export function motionSampleKind(
  panel: TryOnPanel | undefined,
  mode: TryOnResponse['mode'],
): 'video' | 'still' | undefined {
  if (mode !== 'fixture' || panel?.provenance !== 'captured' ||
      panel.stage !== 'completeLook' || panel.result.status !== 'ready') return undefined;
  if (motionSampleUrl(panel, mode)) return 'video';
  if (panel.result.imageUrl === '/fixtures/complete-look-b-result.jpg') return 'still';
  return undefined;
}
