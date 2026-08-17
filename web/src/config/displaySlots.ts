/**
 * The photographs the UI can render, declared in ONE config object.
 *
 * Everything downstream reads from here: the generated preview panels and both results
 * comparison axes. When a slot is empty it renders the ornamental placeholder rather
 * than a broken image.
 *
 * `garmentA`/`garmentB` hold the garment-only previews and `completeLookA`/`completeLookB`
 * hold the same garments after the makeup step ran on them. They are separate slots
 * because telling those two apart is the comparison the Results screen is for.
 */

import type { DisplaySlotId } from '@yincol/shared';

export interface DisplaySlotConfig {
  readonly id: DisplaySlotId;
  /** Caption drawn on the placeholder, and used as the panel's visible label. */
  readonly caption: string;
  /** Alt text when the slot is empty. */
  readonly emptyAlt: string;
}

export const DISPLAY_SLOTS: Readonly<Record<DisplaySlotId, DisplaySlotConfig>> = {
  portrait: {
    id: 'portrait',
    caption: 'Portrait',
    emptyAlt: 'Portrait slot, no photograph yet',
  },
  garmentA: {
    id: 'garmentA',
    caption: 'Garment A',
    emptyAlt: 'First garment preview slot, no photograph yet',
  },
  garmentB: {
    id: 'garmentB',
    caption: 'Garment B',
    emptyAlt: 'Second garment preview slot, no photograph yet',
  },
  completeLookA: {
    id: 'completeLookA',
    caption: 'Complete look A',
    emptyAlt: 'First complete-look slot, no photograph yet',
  },
  completeLookB: {
    id: 'completeLookB',
    caption: 'Complete look B',
    emptyAlt: 'Second complete-look slot, no photograph yet',
  },
};

export const DISPLAY_SLOT_ORDER: readonly DisplaySlotId[] = [
  'portrait',
  'garmentA',
  'garmentB',
  'completeLookA',
  'completeLookB',
];

/**
 * The default frame shape, used until a portrait says otherwise.
 *
 * Two images side by side that differ in crop or scale are not a comparison — the eye
 * reads the framing difference as a difference in the garment. So every panel on a screen
 * shares one frame shape. That part is not a stylistic preference.
 *
 * What changed with the complete-look path is what goes IN the frame. The garment task
 * returns a full-body image, and a fixed 3:4 frame with `object-fit: cover` would quietly
 * cut the legs off it — the shopper would never know a crop had happened, which is the
 * failure mode worth avoiding. Panels now scale the whole image to fit (`object-contain`)
 * and take their shape from the portrait the results were generated from, so a full-body
 * portrait produces full-body frames and nothing is cut off in either case.
 */
export const PHOTO_ASPECT_RATIO = '3 / 4';

/**
 * How far a frame may be stretched to follow its portrait.
 *
 * A phone photograph can be 9:16; without a floor the panels would grow tall enough that
 * two of them no longer fit side by side. Wider than square is clamped for the same
 * reason in the other direction.
 */
const NARROWEST_FRAME = 0.5; // 1:2
const WIDEST_FRAME = 1; // square

/**
 * The frame shape for a set of panels, derived from the portrait they came from.
 *
 * Returns the default when there are no usable dimensions, which is the fixture case —
 * the shipped placeholders are drawn at 3:4.
 */
export function frameAspectRatio(width?: number, height?: number): string {
  if (!width || !height || width <= 0 || height <= 0) return PHOTO_ASPECT_RATIO;

  const ratio = Math.min(WIDEST_FRAME, Math.max(NARROWEST_FRAME, width / height));
  return `${ratio} / 1`;
}
