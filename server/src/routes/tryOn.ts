/**
 * POST /api/try-on — the three generated previews plus the bare portrait.
 *
 * `Promise.allSettled` again, and for the same reason: one try-on failing must leave
 * the other three usable. That is an explicit product state, not an accident.
 *
 * Apparel and makeup are requested separately and returned separately. Nothing here
 * composites them, and nothing downstream is given the pieces to.
 */

import { Router } from 'express';
import type { Provenance, TryOnImageInput, TryOnPanel, TryOnRequest, TryOnResponse } from '@yincol/shared';
import { findGarment, findMakeupLook } from '@yincol/shared';
import { loadConfig } from '../youcam/config.js';
import {
  FEATURES,
  buildClothesVtoPayload,
  buildMakeupVtoPayload,
  makeupEffectsForLook,
} from '../youcam/features.js';
import { runTask } from '../youcam/taskRunner.js';
import {
  MAX_FILE_BYTES,
  SUPPORTED_IMAGE_TYPES,
  fileUploadStrategy,
  type ImageSource,
} from '../youcam/imageInput.js';
import { adaptTryOnLive, tryOnFailure } from '../youcam/adapters/tryOn.js';
import {
  capturedGarmentFixture,
  capturedMakeupFixture,
  fixtureDelay,
  resolveFixtureImage,
} from '../fixtures/index.js';

export const tryOnRouter = Router();

const livePanel = (result: TryOnPanel['result']): TryOnPanel => ({ result, provenance: 'live' });

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

async function garmentLive(
  portrait: ParsedLiveImage,
  garmentInput: ParsedLiveImage | undefined,
  garmentId: string,
): Promise<TryOnPanel> {
  const garment = findGarment(garmentId);
  if (!garment) return livePanel(tryOnFailure(`Unknown garment "${garmentId}".`));
  if (!garmentInput) {
    return livePanel(
      tryOnFailure(`Add a garment reference for ${garment.name} before generating live previews.`),
    );
  }

  const config = loadConfig();
  const portraitImage = await fileUploadStrategy.prepare(portrait, 'clothesVto', config);
  const garmentImage = await fileUploadStrategy.prepare(garmentInput, 'clothesVto', config);
  const { raw } = await runTask(
    config,
    FEATURES.clothesVto,
    buildClothesVtoPayload(portraitImage, garmentImage, garment.category),
  );
  return livePanel(
    await adaptTryOnLive(raw, 'clothesVto', `You wearing the ${garment.name.toLowerCase()}`),
  );
}

async function makeupLive(portrait: ParsedLiveImage, lookId: string): Promise<TryOnPanel> {
  const look = findMakeupLook(lookId);
  if (!look) return livePanel(tryOnFailure(`Unknown makeup look "${lookId}".`));

  const config = loadConfig();
  const portraitImage = await fileUploadStrategy.prepare(portrait, 'makeupVto', config);
  const { raw } = await runTask(
    config,
    FEATURES.makeupVto,
    buildMakeupVtoPayload(portraitImage, makeupEffectsForLook(look)),
  );
  return livePanel(
    await adaptTryOnLive(raw, 'makeupVto', `You wearing the ${look.name} makeup look`),
  );
}

const failedPanel = (reason: unknown, provenance: Provenance = 'live'): TryOnPanel => ({
  result: tryOnFailure(
    (reason instanceof Error ? reason.message : 'This preview could not be generated.')
      .replace(/https?:\/\/\S+/g, '[url redacted]'),
  ),
  provenance,
});

tryOnRouter.post('/try-on', async (req, res) => {
  const config = loadConfig();
  const body = req.body as Partial<TryOnRequest>;
  const portraitRef = String(body?.portraitRef ?? '');
  const garmentIds = Array.isArray(body?.garmentIds) ? body.garmentIds.slice(0, 2) : [];
  const makeupLookId = String(body?.makeupLookId ?? '');

  if (config.fixtureMode && !config.liveTryOn) {
    await fixtureDelay();

    const garments: Record<string, TryOnPanel> = {};
    garmentIds.forEach((garmentId, index) => {
      const garment = findGarment(garmentId);

      // One panel failing while the other three stay usable is a first-class state,
      // not an outage. Fail garment B so the asymmetry is visible.
      if (config.simulate === 'partialFailure' && index === 1) {
        garments[garmentId] = {
          result: tryOnFailure('This try-on did not complete. The other previews are unaffected.'),
          provenance: 'placeholder',
        };
        return;
      }
      // Slot A is the first garment chosen, slot B the second — that is all the
      // placeholder key decides, and it only matters for which caption is drawn on it.
      const image = resolveFixtureImage(
        capturedGarmentFixture(garmentId),
        index === 0 ? 'garmentA' : 'garmentB',
        `You wearing the ${garment?.name.toLowerCase() ?? garmentId}`,
      );
      garments[garmentId] = { result: image.result, provenance: image.provenance };
    });

    const look = findMakeupLook(makeupLookId);
    const makeupImage = resolveFixtureImage(
      capturedMakeupFixture(makeupLookId),
      'makeupOn',
      `You wearing the ${look?.name ?? makeupLookId} makeup look`,
    );
    const portraitImage = resolveFixtureImage(undefined, 'portrait', 'Your portrait, bare face');

    const response: TryOnResponse = {
      garments,
      makeup: { result: makeupImage.result, provenance: makeupImage.provenance },
      portrait: { result: portraitImage.result, provenance: portraitImage.provenance },
      mode: 'fixture',
    };
    res.json(response);
    return;
  }

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

  // Live mode. Every panel settles independently.
  const settled = await Promise.allSettled([
    ...garmentIds.map((id) => garmentLive(portrait, garmentImages[id], id)),
    makeupLive(portrait, makeupLookId),
  ]);

  const garments: Record<string, TryOnPanel> = {};
  garmentIds.forEach((id, index) => {
    const outcome = settled[index];
    garments[id] =
      outcome?.status === 'fulfilled' ? outcome.value : failedPanel(outcome?.reason);
  });

  const makeupOutcome = settled[garmentIds.length];
  const response: TryOnResponse = {
    garments,
    makeup:
      makeupOutcome?.status === 'fulfilled' ? makeupOutcome.value : failedPanel(makeupOutcome?.reason),
    portrait: {
      result: { status: 'ready', imageUrl: imageDataUrl(portrait), alt: 'Your portrait, bare face' },
      provenance: 'live',
    },
    mode: 'live',
  };
  res.json(response);
});
