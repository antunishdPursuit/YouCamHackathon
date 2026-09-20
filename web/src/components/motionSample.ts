import type { TryOnPanel, TryOnResponse } from '@yincol/shared';

/** Match the captured source exactly; never animate an unrelated or live result. */
export function motionSampleKind(
  panel: TryOnPanel | undefined,
  mode: TryOnResponse['mode'],
): 'video' | 'still' | undefined {
  if (mode !== 'fixture' || panel?.provenance !== 'captured' ||
      panel.stage !== 'completeLook' || panel.result.status !== 'ready') return undefined;
  if (panel.result.imageUrl === '/fixtures/complete-look-a-result.jpg') return 'video';
  if (panel.result.imageUrl === '/fixtures/complete-look-b-result.jpg') return 'still';
  return undefined;
}

export const GARMENT_A_MOTION_URL = '/fixtures/garment-a-motion-sample.mp4';
