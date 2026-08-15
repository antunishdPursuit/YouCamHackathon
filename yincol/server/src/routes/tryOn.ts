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
import type { Provenance, TryOnPanel, TryOnResponse } from '@yincol/shared';
import { findGarment, findMakeupLook } from '@yincol/shared';
import { loadConfig } from '../youcam/config.js';
import {
  FEATURES,
  buildClothesVtoPayload,
  buildMakeupTransferPayload,
} from '../youcam/features.js';
import { runTask } from '../youcam/taskRunner.js';
import { publicUrlStrategy } from '../youcam/imageInput.js';
import { adaptTryOn, tryOnFailure } from '../youcam/adapters/tryOn.js';
import {
  capturedGarmentFixture,
  capturedMakeupFixture,
  fixtureDelay,
  resolveFixtureImage,
} from '../fixtures/index.js';

export const tryOnRouter = Router();

const livePanel = (result: TryOnPanel['result']): TryOnPanel => ({ result, provenance: 'live' });

async function garmentLive(portraitUrl: string, garmentId: string): Promise<TryOnPanel> {
  const garment = findGarment(garmentId);
  if (!garment) return livePanel(tryOnFailure(`Unknown garment "${garmentId}".`));
  if (!garment.imageUrl) {
    return livePanel(
      tryOnFailure(`No product image is on file for ${garment.name}, so it cannot be tried on.`),
    );
  }

  const config = loadConfig();
  const portrait = await publicUrlStrategy.prepare({ publicUrl: portraitUrl }, 'clothesVto');
  const garmentImage = await publicUrlStrategy.prepare(
    { publicUrl: garment.imageUrl },
    'clothesVto',
  );
  const { raw } = await runTask(
    config,
    FEATURES.clothesVto,
    buildClothesVtoPayload(portrait, garmentImage, garment.category),
  );
  return livePanel(adaptTryOn(raw, `You wearing the ${garment.name.toLowerCase()}`));
}

async function makeupLive(portraitUrl: string, lookId: string): Promise<TryOnPanel> {
  const look = findMakeupLook(lookId);
  if (!look) return livePanel(tryOnFailure(`Unknown makeup look "${lookId}".`));

  const config = loadConfig();
  const portrait = await publicUrlStrategy.prepare({ publicUrl: portraitUrl }, 'makeupTransfer');
  // The reference photograph is the API's only input for this feature. The chips shown
  // in the picker are display metadata and are deliberately not passed here.
  const reference = await publicUrlStrategy.prepare(
    { publicUrl: `${config.publicAssetBaseUrl}/${look.referenceImageUrl}` },
    'makeupTransfer',
  );
  const { raw } = await runTask(
    config,
    FEATURES.makeupTransfer,
    buildMakeupTransferPayload(portrait, reference),
  );
  return livePanel(adaptTryOn(raw, `You wearing the ${look.name} makeup look`));
}

const failedPanel = (reason: unknown, provenance: Provenance = 'live'): TryOnPanel => ({
  result: tryOnFailure(
    reason instanceof Error ? reason.message : 'This preview could not be generated.',
  ),
  provenance,
});

tryOnRouter.post('/try-on', async (req, res) => {
  const config = loadConfig();
  const body = req.body as { portraitRef?: string; garmentIds?: string[]; makeupLookId?: string };
  const portraitRef = String(body?.portraitRef ?? '');
  const garmentIds = Array.isArray(body?.garmentIds) ? body.garmentIds.slice(0, 2) : [];
  const makeupLookId = String(body?.makeupLookId ?? '');

  if (config.fixtureMode) {
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

  // Live mode. Every panel settles independently.
  const settled = await Promise.allSettled([
    ...garmentIds.map((id) => garmentLive(portraitRef, id)),
    makeupLive(portraitRef, makeupLookId),
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
      result: { status: 'ready', imageUrl: portraitRef, alt: 'Your portrait, bare face' },
      provenance: 'live',
    },
    mode: 'live',
  };
  res.json(response);
});
