/**
 * The portrait-only makeup comparison.
 *
 *   portrait
 *      │
 *      ▼
 *   Makeup VTO ──── makeup applied directly to the portrait, no garment change
 *
 * This is `completeLook.ts`'s step 2 alone, run against the uploaded portrait instead of
 * against a downloaded garment-task result. `makeupVto` is already a verified task path,
 * so this needs no new provider integration — only a different source image and a
 * different, honest `stage` label so the UI never confuses it with a complete look.
 */

import type { LookStage, MakeupLook, TryOnPanel, TryOnResult } from '@yincol/shared';
import type { YouCamConfig } from './config.js';
import { FEATURES, buildMakeupVtoPayload, makeupEffectsForLook } from './features.js';
import { fileUploadStrategy, type ImageSource } from './imageInput.js';
import { runTask } from './taskRunner.js';
import { logFailure, publicFailureReason } from './publicError.js';
import { captureTryOnLive, tryOnFailure } from './adapters/tryOn.js';

export interface PortraitMakeupRequest {
  readonly config: YouCamConfig;
  /**
   * The portrait's raw bytes, not an already-prepared reference. File API upload slots are
   * feature-specific (a `clothesVto` upload cannot be reused for `makeupVto`), so this
   * uploads its own copy — the same reason `completeLook.ts`'s step 2 re-uploads the
   * garment image it just downloaded instead of reusing step 1's reference.
   */
  readonly portrait: ImageSource;
  readonly look: MakeupLook;
}

const PORTRAIT_MAKEUP_STAGE: LookStage = 'portraitMakeup';

const panel = (result: TryOnResult, stage?: LookStage): TryOnPanel =>
  stage ? { result, provenance: 'live', stage } : { result, provenance: 'live' };

/**
 * Run the makeup task on the bare portrait. Never throws: a failure here must not take
 * down the garment comparisons that ran alongside it, so it comes back as a failed panel
 * with a reason the shopper can read, exactly like `runCompleteLookSequence`.
 */
export async function runPortraitMakeupSequence(
  request: PortraitMakeupRequest,
): Promise<TryOnPanel> {
  const { config, portrait, look } = request;

  try {
    const portraitRef = await fileUploadStrategy.prepare(portrait, 'makeupVto', config);
    const { taskId, raw } = await runTask(
      config,
      FEATURES.makeupVto,
      buildMakeupVtoPayload(portraitRef, makeupEffectsForLook(look)),
    );

    const captured = await captureTryOnLive(
      raw,
      'makeupVto',
      `You wearing the ${look.name} makeup, no garment change`,
    );
    console.log(`[yincol] portrait-makeup · task ${taskId} ${captured.status}`);

    if (captured.status === 'failed') return panel(captured.result);
    return panel(captured.result, PORTRAIT_MAKEUP_STAGE);
  } catch (error) {
    logFailure('portrait-makeup', error);
    const reason = publicFailureReason(
      error,
      'The makeup preview on your original portrait could not be generated.',
    );
    return panel(tryOnFailure(reason));
  }
}
