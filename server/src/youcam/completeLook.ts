/**
 * The complete-look sequence.
 *
 *   portrait + garment reference
 *           │
 *           ▼
 *   Clothes VTO ──── result image bytes ────▶ Makeup VTO ────▶ complete look
 *
 * This file exists so the sequencing is a thing you can point at. The browser asks for a
 * complete look; it does not orchestrate one. Everything about the order — which task
 * runs first, what the second one is given, and what happens when either fails — is
 * decided here, on the server, behind the adapter boundary.
 *
 * THE ONE INVARIANT. `stage: 'completeLook'` is set at exactly one place in this
 * codebase: the line below where the makeup task has already been handed the bytes the
 * garment task returned. If that upload did not happen, the panel is not a complete look
 * and must not claim to be one. Every other honesty rule in the app depends on this one
 * staying true, so it is worth re-reading before editing anything here.
 *
 * Each garment runs its own sequence. Nothing in this file knows there is a second
 * garment, which is how one garment's failure stays one garment's failure.
 */

import type { LookStage, MakeupLook, TryOnPanel, TryOnResult } from '@yincol/shared';
import type { GarmentCategoryValue, YouCamConfig } from './config.js';
import { FEATURES, buildClothesVtoPayload, buildMakeupVtoPayload, makeupEffectsForLook } from './features.js';
import { fileUploadStrategy, type ImageReference, type ImageSource } from './imageInput.js';
import { runTask, type RawTaskResult } from './taskRunner.js';
import { captureTryOnLive, tryOnFailure, type TryOnImageBytes } from './adapters/tryOn.js';

/** Both panels a single garment produces. Always both, so the caller cannot forget one. */
export interface CompleteLookOutcome {
  /** The garment task's own output — a garment preview, no makeup applied. */
  readonly garmentOnly: TryOnPanel;
  /** That image after the makeup task rendered the effects onto it. */
  readonly completeLook: TryOnPanel;
}

export interface CompleteLookRequest {
  readonly config: YouCamConfig;
  /**
   * Step 1's inputs, already prepared by the caller.
   *
   * The browser route uploads its tab-held bytes through the File API; the capture script
   * points at published URLs. Which of the two got used is the caller's business — the
   * sequence only needs a reference it can put in a payload. Step 2 has no such freedom:
   * its input is bytes we just downloaded, so it always uploads.
   */
  readonly portrait: ImageReference;
  readonly garment: ImageReference;
  readonly garmentCategory: GarmentCategoryValue;
  readonly look: MakeupLook;
  /** Human label for the garment, used in alt text and in the server log line. */
  readonly garmentName: string;
  /**
   * Called after each step succeeds, before the next one starts.
   *
   * This exists so the fixture-capture script can run the SAME sequence the browser route
   * runs and still write each step's bytes to disk as it goes. Without it the script would
   * need its own copy of the ordering, and two copies of an ordering drift.
   */
  readonly onStep?: (step: CompleteLookStep, detail: CompleteLookStepDetail) => Promise<void> | void;
}

export type CompleteLookStep = 'garment' | 'completeLook';

export interface CompleteLookStepDetail {
  readonly taskId: string;
  readonly raw: RawTaskResult;
  readonly image: TryOnImageBytes;
}

/**
 * A live panel. `stage` describes what the IMAGE is, so a failed panel has no stage —
 * there is no image to describe, and an absent stage is what stops the UI claiming one.
 */
const panel = (result: TryOnResult, stage?: LookStage): TryOnPanel =>
  stage ? { result, provenance: 'live', stage } : { result, provenance: 'live' };

/** A failure both panels can share when step 1 never produced an image. */
const noGarmentImage = (): TryOnPanel =>
  panel(
    tryOnFailure('The garment preview did not come back, so there was nothing to apply makeup to.'),
  );

/**
 * One log line per task, because a local tester needs to see what was actually spent.
 *
 * Credits burn on success only, so a `success` line is the honest signal that an API unit
 * went. Task ids are printed; signed URLs and response bodies are not.
 */
const logStep = (step: string, garmentName: string, detail: string): void => {
  console.log(`[yincol] complete-look ${step} · ${garmentName} · ${detail}`);
};

/**
 * Run one garment all the way through.
 *
 * Never throws for a task-level failure. A garment that cannot be rendered comes back as
 * two failed panels with a reason the shopper can read, because a rejected promise here
 * would have to be caught somewhere that knows less about what went wrong than we do.
 */
export async function runCompleteLookSequence(
  request: CompleteLookRequest,
): Promise<CompleteLookOutcome> {
  const { config, portrait, garment, garmentCategory, look, garmentName, onStep } = request;

  // ── Step 1: the garment ────────────────────────────────────
  let garmentImage: TryOnImageBytes;
  let garmentPanel: TryOnPanel;
  let garmentStep: CompleteLookStepDetail;

  try {
    const { taskId, raw } = await runTask(
      config,
      FEATURES.clothesVto,
      buildClothesVtoPayload(portrait, garment, garmentCategory),
    );

    const captured = await captureTryOnLive(
      raw,
      'clothesVto',
      `You wearing the ${garmentName.toLowerCase()}`,
    );
    logStep('step 1 clothes', garmentName, `task ${taskId} ${captured.status}`);

    if (captured.status === 'failed') {
      return { garmentOnly: panel(captured.result), completeLook: noGarmentImage() };
    }

    garmentImage = captured.image;
    garmentPanel = panel(captured.result, 'garmentOnly');
    garmentStep = { taskId, raw, image: captured.image };
  } catch (error) {
    const reason = failureReason(error, 'This garment preview could not be generated.');
    logStep('step 1 clothes', garmentName, `failed — ${reason}`);
    return { garmentOnly: panel(tryOnFailure(reason)), completeLook: noGarmentImage() };
  }

  // Outside the try on purpose. A caller's own failure — the capture script failing to
  // write a file, say — is that caller's problem to see, not something to be relabelled
  // as a failed garment task.
  await onStep?.('garment', garmentStep);

  // ── Step 2: the makeup, applied to what step 1 returned ────
  //
  // `garmentImage` is the downloaded Clothes VTO result. Uploading it here is the whole
  // point of the increment: the makeup task's portrait input is the garment result, not
  // the original photograph.
  let completeLookPanel: TryOnPanel;
  let completeLookStep: CompleteLookStepDetail | undefined;

  try {
    const madeUpSource: ImageSource = {
      bytes: garmentImage.bytes,
      contentType: garmentImage.contentType,
      fileName: 'complete-look-source.jpg',
    };
    const madeUpRef = await fileUploadStrategy.prepare(madeUpSource, 'makeupVto', config);

    const { taskId, raw } = await runTask(
      config,
      FEATURES.makeupVto,
      buildMakeupVtoPayload(madeUpRef, makeupEffectsForLook(look)),
    );

    const captured = await captureTryOnLive(
      raw,
      'makeupVto',
      `You wearing the ${garmentName.toLowerCase()} with the ${look.name} makeup look`,
    );
    logStep('step 2 makeup', garmentName, `task ${taskId} ${captured.status}`);

    // The only place `completeLook` is ever set. By here the makeup task has provably
    // received step 1's image — it is what we uploaded a few statements ago — so the
    // stage is earned rather than assumed. A failed capture gets no stage at all.
    if (captured.status === 'ready') {
      completeLookPanel = panel(captured.result, 'completeLook');
      completeLookStep = { taskId, raw, image: captured.image };
    } else {
      completeLookPanel = panel(captured.result);
    }
  } catch (error) {
    const reason = failureReason(
      error,
      'The makeup step could not be applied to this garment preview.',
    );
    logStep('step 2 makeup', garmentName, `failed — ${reason}`);
    // Step 1 survives. The shopper keeps a usable garment preview and is told plainly
    // that only the makeup half is missing.
    return { garmentOnly: garmentPanel, completeLook: panel(tryOnFailure(reason)) };
  }

  if (completeLookStep) await onStep?.('completeLook', completeLookStep);

  return { garmentOnly: garmentPanel, completeLook: completeLookPanel };
}

/** Provider URLs can appear in error text; they are signed, so they never reach the browser. */
function failureReason(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  return (message || fallback).replace(/https?:\/\/\S+/g, '[url redacted]');
}
