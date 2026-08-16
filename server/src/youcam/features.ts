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

/** The task API accepts either a public source URL or a File API `file_id`. */
const imageField = (reference: ImageReference): Record<string, string> =>
  reference.kind === 'publicUrl'
    ? { src_file_url: reference.url }
    : { src_file_id: reference.fileId };

// ─────────────────────────────────────────────────────────────
// Start payloads
// ─────────────────────────────────────────────────────────────

/**
 * The source field names are shared by the verified Skin Analysis task and the other
 * task builders. Feature-specific fields remain beside their payload builders.
 */
export const buildFacialColorTonePayload = (portrait: ImageReference): unknown => ({
  ...imageField(portrait),
});

/** VERIFIED in the Skin Analysis API reference. SD actions cannot be mixed with HD. */
export const buildSkinAnalysisPayload = (portrait: ImageReference): unknown => ({
  ...imageField(portrait),
  dst_actions: ['wrinkle', 'pore', 'texture', 'acne'],
  format: 'json',
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
