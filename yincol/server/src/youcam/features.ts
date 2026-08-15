/**
 * Four feature configs. The runner in taskRunner.ts does the work; these only say
 * where each feature lives and what its start payload looks like.
 */

import {
  TASK_PATHS,
  TASK_PATH_VERIFIED,
  type FeatureId,
  type GarmentCategoryValue,
} from './config.js';
import type { TaskFeature } from './taskRunner.js';
import type { ImageReference } from './imageInput.js';

const feature = (id: FeatureId, label: string): TaskFeature => ({
  id,
  label,
  taskPath: TASK_PATHS[id],
});

export const FEATURES: Readonly<Record<FeatureId, TaskFeature>> = {
  facialColorTone: feature('facialColorTone', 'Facial colour tone'),
  skinAnalysis: feature('skinAnalysis', 'Skin analysis'),
  clothesVto: feature('clothesVto', 'Clothes try-on'),
  makeupTransfer: feature('makeupTransfer', 'Makeup transfer'),
};

export const isTaskPathVerified = (id: FeatureId): boolean => TASK_PATH_VERIFIED[id];

/** Path B puts the image straight in the payload; Path A would send a `file_id`. */
const imageField = (reference: ImageReference): Record<string, string> =>
  reference.kind === 'publicUrl' ? { src_url: reference.url } : { file_id: reference.fileId };

// ─────────────────────────────────────────────────────────────
// Start payloads
// ─────────────────────────────────────────────────────────────

/**
 * TODO(phase0): verify in API Playground. The image field name on a Path B start
 * payload is inferred. If the Playground shows a different key, change `imageField`
 * above — it is the only place the name appears.
 */
export const buildFacialColorTonePayload = (portrait: ImageReference): unknown => ({
  ...imageField(portrait),
});

export const buildSkinAnalysisPayload = (portrait: ImageReference): unknown => ({
  ...imageField(portrait),
});

/** VERIFIED: the cloth payload includes `garment_category` and `change_shoes`. */
export const buildClothesVtoPayload = (
  portrait: ImageReference,
  garment: ImageReference,
  garmentCategory: GarmentCategoryValue,
): unknown => ({
  ...imageField(portrait),
  garment_image: garment.kind === 'publicUrl' ? garment.url : undefined,
  garment_file_id: garment.kind === 'fileId' ? garment.fileId : undefined,
  garment_category: garmentCategory,
  // We are not doing footwear. Declared explicitly so the default is ours, not theirs.
  change_shoes: false,
});

/**
 * VERIFIED as a product constraint: makeup transfer is REFERENCE-IMAGE BASED. It
 * extracts a look from a photo of a made-up face. It does not accept shade values,
 * SKUs, or hex codes, and there is nowhere in this payload to put one.
 */
export const buildMakeupTransferPayload = (
  portrait: ImageReference,
  reference: ImageReference,
): unknown => ({
  ...imageField(portrait),
  reference_image: reference.kind === 'publicUrl' ? reference.url : undefined,
  reference_file_id: reference.kind === 'fileId' ? reference.fileId : undefined,
});
