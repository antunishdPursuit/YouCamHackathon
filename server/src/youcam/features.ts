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
import type { MakeupLook } from '@yincol/shared';
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
  makeupVto: feature('makeupVto', 'Makeup virtual try-on'),
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
  dst_actions: ['wrinkle', 'pore', 'texture', 'acne', 'skin_type'],
  format: 'json',
});

/** DOCUMENTED: AI Clothes V3 uses a reference file or template for the garment. */
export const buildClothesVtoPayload = (
  portrait: ImageReference,
  garment: ImageReference,
  garmentCategory: GarmentCategoryValue,
): unknown => ({
  ...imageField(portrait),
  ...(garment.kind === 'publicUrl'
    ? { ref_file_url: garment.url }
    : { ref_file_id: garment.fileId }),
  garment_category: garmentCategory,
});

/** The documented effect object is intentionally kept behind the server boundary. */
export type MakeupEffect = Readonly<{
  category: string;
  readonly [key: string]: unknown;
}>;

/** DOCUMENTED: AI Makeup VTO takes an effects array and an effect-schema version. */
export const buildMakeupVtoPayload = (
  portrait: ImageReference,
  effects: readonly MakeupEffect[],
): unknown => ({
  ...imageField(portrait),
  effects,
  version: '1.0',
});

/**
 * Convert the app's chosen look into the documented Makeup VTO effects shape. The
 * browser still receives only the app-level look and chips; vendor fields stay here.
 */
export const makeupEffectsForLook = (
  look: Pick<MakeupLook, 'chips'>,
): readonly MakeupEffect[] => [
  {
    category: 'skin_smooth',
    skinSmoothStrength: 50,
    skinSmoothColorIntensity: 50,
  },
  {
    category: 'blush',
    pattern: { name: '2colors1' },
    palettes: [
      { color: look.chips.cheek.hex, texture: 'matte', colorIntensity: 60 },
      { color: look.chips.cheek.hex, texture: 'satin', colorIntensity: 45, glowStrength: 25 },
    ],
  },
  {
    category: 'lip_color',
    shape: { name: 'plump' },
    style: { type: 'full' },
    palettes: [
      {
        color: look.chips.lip.hex,
        texture: 'gloss',
        colorIntensity: 75,
        gloss: 50,
        transparencyIntensity: 50,
      },
    ],
  },
];
