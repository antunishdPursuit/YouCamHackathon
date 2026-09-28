import { asyncRoute } from './asyncRoute.js';
import { generateFullBodyLooks } from './fullBody.js';
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
import { logFailure, publicFailureReason } from '../youcam/publicError.js';
import { tryOnFailure } from '../youcam/adapters/tryOn.js';
import { fixtureCompleteLook, fixtureDelay, fixturePortraitMakeup, resolveFixtureImage } from '../fixtures/index.js';
import { runPortraitMakeupSequence } from '../youcam/portraitMakeup.js';
import { rejectImageBytesInFixtureMode } from './fixtureGuard.js';

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

  if (!input.data || input.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.data)) {
    throw new Error('The image payload is not valid base64.');
  }

  const bytes = Buffer.from(input.data, 'base64');
  if (bytes.length === 0) throw new Error('A live preview image is empty.');
  if (bytes.length >= MAX_FILE_BYTES) {
    throw new Error('A live preview image must be smaller than 10 MB.');
  }

  return {
    bytes,
    contentType: input.contentType,
    fileName: (typeof input.fileName === 'string' ? input.fileName.slice(0, 255) : '') || 'image',
  };
}

const imageDataUrl = (image: ParsedLiveImage): string =>
  `data:${image.contentType};base64,${image.bytes.toString('base64')}`;

const failedPanel = (reason: unknown, provenance: Provenance = 'live'): TryOnPanel => ({
  result: tryOnFailure(publicFailureReason(reason, 'This preview could not be generated.')),
  provenance,
});

/** Both panels fail together only when the sequence never started for this garment. */
const failedOutcome = (reason: unknown): CompleteLookOutcome => ({
  garmentOnly: failedPanel(reason),
  completeLook: failedPanel(reason),
});

tryOnRouter.post('/try-on', asyncRoute(async (req, res) => {
  const config = loadConfig();
  const body = req.body as Partial<TryOnRequest> | undefined;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ error: 'A preview request must be a JSON object.' });
    return;
  }
  const garmentIds = body.garmentIds;
  if (!Array.isArray(garmentIds) || garmentIds.length < 1 || garmentIds.length > 2 ||
      garmentIds.some((id: unknown) => typeof id !== 'string' || !findGarment(id)) ||
      new Set(garmentIds).size !== garmentIds.length) {
    res.status(400).json({ error: 'Choose one or two different garments from the available options.' });
    return;
  }
  const makeupLookId = body.makeupLookId;
  const look = typeof makeupLookId === 'string' ? findMakeupLook(makeupLookId) : undefined;
  if (typeof makeupLookId !== 'string' || !look) {
    res.status(400).json({ error: 'Choose a makeup look from the available options.' });
    return;
  }

  if (config.fixtureMode && !config.liveTryOn) {
    // The fixture path generates nothing from the shopper's own pictures, so it has no
    // use for them. Refusing them here is what keeps the privacy promise a property of
    // the deployment rather than of whichever client happens to be calling.
    if (rejectImageBytesInFixtureMode(body, res)) return;

    await fixtureDelay();

    const garments: Record<string, TryOnPanel> = {};
    const completeLooks: Record<string, TryOnPanel> = {};

    garmentIds.forEach((garmentId, index) => {
      const outcome = fixtureCompleteLook({
        garmentId,
        lookId: makeupLookId,
        index,
        garmentName: findGarment(garmentId)?.name ?? garmentId,
        lookName: look?.name ?? 'chosen',
        simulate: config.simulate,
      });
      garments[garmentId] = outcome.garmentOnly;
      completeLooks[garmentId] = outcome.completeLook;
    });

    // Fixture mode never receives the visitor's photograph, so the portrait panel cannot
    // be theirs and must not be described as though it were.
    const portraitImage = resolveFixtureImage(undefined, 'portrait', {
      captured: 'The demo portrait, bare face',
      placeholder: 'Designed stand-in for the portrait',
    });

    const response: TryOnResponse = {
      garments,
      completeLooks,
      portrait: { result: portraitImage.result, provenance: portraitImage.provenance },
      portraitMadeUp: fixturePortraitMakeup(look?.name ?? 'chosen'),
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

  // Validate every optional input before any paid work starts.
  let fullBody: { portrait: ParsedLiveImage; trousers: ParsedLiveImage } | undefined;
  if (body.fullBody !== undefined) {
    try {
      if (!body.fullBody || typeof body.fullBody !== 'object' || Array.isArray(body.fullBody)) {
        throw new Error('Add a full-body photo and a trousers reference.');
      }
      const fullPortrait = parseLiveImage(body.fullBody.portrait);
      const trousers = parseLiveImage(body.fullBody.trousers);
      if (!fullPortrait || !trousers || garmentIds.some(id => !garmentImages[id])) {
        throw new Error('Add a full-body photo, trousers, and both top references.');
      }
      fullBody = { portrait: fullPortrait, trousers };
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Check the full-body inputs.' });
      return;
    }
  }

  const fullBodyPromise = fullBody ? generateFullBodyLooks({
    config, ...fullBody, garmentIds, garmentImages, look,
  }) : undefined;

  // Runs alongside the garment sequences, not blocking or blocked by them — one more
  // independent failure mode, isolated the same way a second garment's failure is.
  const portraitMadeUpPromise = runPortraitMakeupSequence({ config, portrait, look });

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
    // The only path here that is not already a handled panel: an upload or an unexpected
    // throw. The detail stays on the console; the browser gets the sentence.
    if (outcome?.status === 'rejected') logFailure(`try-on sequence · ${garmentId}`, outcome.reason);

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
    portraitMadeUp: await portraitMadeUpPromise,
    mode: 'live',
    ...(fullBodyPromise ? { fullBody: await fullBodyPromise } : {}),
  };
  res.set('Cache-Control', 'private, no-store').json(response);
}));
