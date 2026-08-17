/**
 * The four photographs the UI can render, declared in ONE config object.
 *
 * Everything downstream reads from here: the generated preview panels and both results
 * comparison axes. When a slot is empty it renders the ornamental placeholder rather
 * than a broken image.
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
  makeupOn: {
    id: 'makeupOn',
    caption: 'Makeup look',
    emptyAlt: 'Makeup preview slot, no photograph yet',
  },
};

export const DISPLAY_SLOT_ORDER: readonly DisplaySlotId[] = [
  'portrait',
  'garmentA',
  'garmentB',
  'makeupOn',
];

/**
 * Every photograph renders at 3:4 with object-fit: cover.
 *
 * This is not a stylistic preference. Two images side by side that differ in crop or
 * scale are not a comparison — the eye reads the framing difference as a difference in
 * the garment. One constant, used everywhere, is the only way to guarantee it.
 */
export const PHOTO_ASPECT_RATIO = '3 / 4';
