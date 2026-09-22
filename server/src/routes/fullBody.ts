/**
 * Full-body generation from this request's uploads. No saved-file fallback.
 * One trousers task feeds two independent top + makeup sequences.
 */
import type { MakeupLook, TryOnPanel, TryOnView } from '@yincol/shared';
import type { YouCamConfig } from '../youcam/config.js';
import { fileUploadStrategy, type ImageSource } from '../youcam/imageInput.js';
import { FEATURES, buildClothesVtoPayload } from '../youcam/features.js';
import { runTask } from '../youcam/taskRunner.js';
import { captureTryOnLive, tryOnFailure } from '../youcam/adapters/tryOn.js';
import { runCompleteLookSequence } from '../youcam/completeLook.js';
import { logFailure, publicFailureReason } from '../youcam/publicError.js';

export interface FullBodyGeneration {
  readonly config: YouCamConfig;
  readonly portrait: ImageSource;
  readonly trousers: ImageSource;
  readonly garmentIds: readonly string[];
  readonly garmentImages: Readonly<Record<string, ImageSource>>;
  readonly look: MakeupLook;
}

const failedPanel = (reason: unknown): TryOnPanel => ({
  result: tryOnFailure(publicFailureReason(reason, 'This full-body preview could not be generated.')),
  provenance: 'live',
});

export async function generateFullBodyLooks(request: FullBodyGeneration): Promise<Omit<TryOnView, 'portrait'>> {
  const { config, portrait, trousers, garmentIds, garmentImages, look } = request;
  const garments: Record<string, TryOnPanel> = {};
  const completeLooks: Record<string, TryOnPanel> = {};
  try {
    const [portraitRef, trousersRef] = await Promise.all([
      fileUploadStrategy.prepare(portrait, 'clothesVto', config),
      fileUploadStrategy.prepare(trousers, 'clothesVto', config),
    ]);
    const { raw } = await runTask(config, FEATURES.clothesVto, {
      ...(buildClothesVtoPayload(portraitRef, trousersRef, 'lower_body') as object),
      change_shoes: false,
    });
    const captured = await captureTryOnLive(raw, 'clothesVto', 'Your full-body portrait with the selected trousers');
    if (captured.status === 'failed') throw new Error('The trousers preview could not be generated.');
    const dressedRef = await fileUploadStrategy.prepare({
      bytes: captured.image.bytes, contentType: captured.image.contentType,
      fileName: 'full-body-trousers.png',
    }, 'clothesVto', config);
    const outcomes = await Promise.allSettled(garmentIds.map(async (id, index) => {
      const top = garmentImages[id];
      if (!top) throw new Error('A top reference is missing.');
      const garment = await fileUploadStrategy.prepare(top, 'clothesVto', config);
      return runCompleteLookSequence({
        config, portrait: dressedRef, garment, garmentCategory: 'upper_body', look,
        garmentName: 'full-body outfit ' + (index === 0 ? 'A' : 'B') + ' with the selected trousers',
      });
    }));
    garmentIds.forEach((id, index) => {
      const outcome = outcomes[index];
      if (outcome?.status === 'fulfilled') {
        garments[id] = outcome.value.garmentOnly;
        completeLooks[id] = outcome.value.completeLook;
      } else {
        logFailure('full-body top sequence', outcome?.reason);
        garments[id] = failedPanel(outcome?.reason);
        completeLooks[id] = failedPanel(outcome?.reason);
      }
    });
  } catch (error) {
    logFailure('full-body trousers sequence', error);
    for (const id of garmentIds) {
      garments[id] = failedPanel(error);
      completeLooks[id] = failedPanel(error);
    }
  }
  return {
    garments, completeLooks, mode: 'live',
  };
}
