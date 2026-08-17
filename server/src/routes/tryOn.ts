/**
 * POST /api/try-on — two garment previews, two complete looks, and the portrait.
 *
 * Each selected garment runs its own sequence: the garment task first, then the makeup
 * task applied to what the garment task returned. The sequencing itself lives in
 * `youcam/completeLook.ts`; this route decides which garments to run and settles them
 * independently.
 *
 * `Promise.allSettled`, not `Promise.all`, and for the usual reason: one garment failing
 * must leave the other one usable. That is an explicit product state, not an accident.
 */

import { Router } from 'express';
import type {
  Provenance,
  TryOnImageInput,
  TryOnPanel,
  TryOnRequest,
  TryOnResponse,
} from '@yincol/shared';
import { findGarment, findMakeupLook } from '@yincol/shared';
import { loadConfig } from '../youcam/config.js';
import { runCompleteLookSequence, type CompleteLookOutcome } from '../youcam/completeLook.js';
import {
  MAX_FILE_BYTES,
  SUPPORTED_IMAGE_TYPES,
  fileUploadStrategy,
  type ImageSource,
} from '../youcam/imageInput.js';
import { tryOnFailure } from '../youcam/adapters/tryOn.js';
import { fixtureCompleteLook, fixtureDelay, resolveFixtureImage } from '../fixtures/index.js';

export const tryOnRouter = Router();

interface ParsedLiveImage extends ImageSource {
  readonly bytes: Buffer;
  readonly contentType: string;
  readonly fileName: string;
}

function parseLiveImage(value: unknown): ParsedLiveImage | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Partial<TryOnImageInput>;
  if (typeof input.data !== 'string' || typeof input.contentType !== 'string') {
    throw new Error('A live preview image is incomplete.');
  }
  if (!SUPPORTED_IMAGE_TYPES.has(input.contentType)) {
    throw new Error('Live previews accept JPEG or PNG images only.');
  }

  const bytes = Buffer.from(input.data, 'base64');
  if (bytes.length === 0) throw new Error('A live preview image is empty.');
  if (bytes.length >= MAX_FILE_BYTES) {
    throw new Error('A live preview image must be smaller than 10 MB.');
  }

  return {
    bytes,
    contentType: input.contentType,
    fileName: typeof input.fileName === 'string' && input.fileName ? input.fileName : 'image',
  };
}

const imageDataUrl = (image: ParsedLiveImage): string =>
  `data:${image.contentType};base64,${image.bytes.toString('base64')}`;

const failedPanel = (reason: unknown, provenance: Provenance = 'live'): TryOnPanel => ({
  result: tryOnFailure(
    (reason instanceof Error ? reason.message : 'This preview could not be generated.')
      .replace(/https?:\/\/\S+/g, '[url redacted]'),
  ),
  provenance,
});

/** Both panels fail together only when the sequence never started for this garment. */
const failedOutcome = (reason: unknown): CompleteLookOutcome => ({
  garmentOnly: failedPanel(reason),
  completeLook: failedPanel(reason),
});

tryOnRouter.post('/try-on', async (req, res) => {
  const config = loadConfig();
  const body = req.body as Partial<TryOnRequest>;
  const garmentIds = Array.isArray(body?.garmentIds) ? body.garmentIds.slice(0, 2) : [];
  const makeupLookId = String(body?.makeupLookId ?? '');
  const look = findMakeupLook(makeupLookId);

  if (config.fixtureMode && !config.liveTryOn) {
    await fixtureDelay();

    const garments: Record<string, TryOnPanel> = {};
    const completeLooks: Record<string, TryOnPanel> = {};

    garmentIds.forEach((garmentId, index) => {
      const outcome = fixtureCompleteLook({
        garmentId,
        index,
        garmentName: findGarment(garmentId)?.name ?? garmentId,
        lookName: look?.name ?? 'chosen',
        simulate: config.simulate,
      });
      garments[garmentId] = outcome.garmentOnly;
      completeLooks[garmentId] = outcome.completeLook;
    });

    const portraitImage = resolveFixtureImage(undefined, 'portrait', 'Your portrait, bare face');

    const response: TryOnResponse = {
      garments,
      completeLooks,
      portrait: { result: portraitImage.result, provenance: portraitImage.provenance },
      mode: 'fixture',
    };
    res.json(response);
    return;
  }

  // ── Live ─────────────────────────────────────────────────────
  let portrait: ParsedLiveImage;
  try {
    const parsed = parseLiveImage(body.portrait);
    if (!parsed) throw new Error('Add a portrait before generating live previews.');
    portrait = parsed;
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'A valid portrait is required.',
    });
    return;
  }

  const garmentImages: Record<string, ParsedLiveImage> = {};
  try {
    const rawImages = body.garmentImages ?? {};
    for (const garmentId of garmentIds) {
      const image = parseLiveImage(rawImages[garmentId]);
      if (image) garmentImages[garmentId] = image;
    }
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'A valid garment reference is required.',
    });
    return;
  }

  if (!look) {
    res.status(400).json({ error: 'Choose a makeup look before generating live previews.' });
    return;
  }

  // Each garment runs the full sequence on its own. Nothing is shared between them, so
  // one garment's failure cannot reach the other's result.
  const settled = await Promise.allSettled(
    garmentIds.map(async (garmentId): Promise<CompleteLookOutcome> => {
      const garment = findGarment(garmentId);
      if (!garment) return failedOutcome(new Error(`Unknown garment "${garmentId}".`));

      const garmentInput = garmentImages[garmentId];
      if (!garmentInput) {
        return failedOutcome(
          new Error(
            `Add a garment reference for ${garment.name} before generating live previews.`,
          ),
        );
      }

      // Uploaded here rather than once outside the loop: an upload failure then belongs
      // to one garment and settles as that garment's failure, leaving the other alone.
      const [portraitRef, garmentRef] = await Promise.all([
        fileUploadStrategy.prepare(portrait, 'clothesVto', config),
        fileUploadStrategy.prepare(garmentInput, 'clothesVto', config),
      ]);

      return runCompleteLookSequence({
        config,
        portrait: portraitRef,
        garment: garmentRef,
        garmentCategory: garment.category,
        look,
        garmentName: garment.name,
      });
    }),
  );

  const garments: Record<string, TryOnPanel> = {};
  const completeLooks: Record<string, TryOnPanel> = {};

  garmentIds.forEach((garmentId, index) => {
    const outcome = settled[index];
    const resolved =
      outcome?.status === 'fulfilled' ? outcome.value : failedOutcome(outcome?.reason);
    garments[garmentId] = resolved.garmentOnly;
    completeLooks[garmentId] = resolved.completeLook;
  });

  const response: TryOnResponse = {
    garments,
    completeLooks,
    portrait: {
      result: { status: 'ready', imageUrl: imageDataUrl(portrait), alt: 'Your portrait, bare face' },
      provenance: 'live',
    },
    mode: 'live',
  };
  res.json(response);
});
