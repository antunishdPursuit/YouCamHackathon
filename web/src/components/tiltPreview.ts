/**
 * The 2.5D tilt preview — all of its arithmetic, and none of its markup.
 *
 * WHAT THIS IS, said precisely, because the whole feature lives or dies on the claim:
 * one captured image, rotated a little in CSS. There is no second camera angle, no depth
 * map, no reconstruction. Tilting it far enough to look like a turn would be a lie the
 * picture cannot back up, which is why the bound is small and lives here as a constant
 * rather than as a magic number in a style attribute.
 *
 * Framework-free on purpose: the bounds, the stepping and the wording are the parts worth
 * testing, and keeping them out of the component means they can be tested without a DOM.
 */

/**
 * The furthest the image may tilt, in degrees, in either direction.
 *
 * Twelve is the top of the range the issue approved. Past roughly this much, a flat
 * photograph stops reading as "the same picture, angled" and starts reading as a claim
 * about a view we do not have.
 */
export const TILT_MAX_DEGREES = 12;

/** One press of a tilt control. Two presses reach the bound, which keeps it explorable. */
export const TILT_STEP_DEGREES = 6;

/** The resting state: no transform at all, identical to the untilted card. */
export const TILT_NONE = 0;

export type TiltDirection = -1 | 1;

/**
 * Hold an angle inside the approved bound.
 *
 * Non-finite input resolves to the resting state rather than propagating `NaN` into a
 * style attribute, where it would silently disable the transform instead of failing.
 */
export function clampTilt(degrees: number): number {
  if (!Number.isFinite(degrees)) return TILT_NONE;
  return Math.max(-TILT_MAX_DEGREES, Math.min(TILT_MAX_DEGREES, Math.round(degrees)));
}

/** One step in a direction, bounded. At the bound, pressing again is a no-op. */
export const nextTilt = (current: number, direction: TiltDirection): number =>
  clampTilt(clampTilt(current) + direction * TILT_STEP_DEGREES);

/** Whether the card is showing anything other than its normal presentation. */
export const isTilted = (degrees: number): boolean => clampTilt(degrees) !== TILT_NONE;

/**
 * The CSS transform for an angle.
 *
 * At rest this is `none`, not `rotateY(0deg)`: a resting card should not sit in a 3D
 * rendering context it has no use for, and `none` keeps it pixel-identical to a card
 * that never had the control.
 */
export function tiltTransform(degrees: number): string {
  const angle = clampTilt(degrees);
  if (angle === TILT_NONE) return 'none';
  return `perspective(1200px) rotateY(${angle}deg)`;
}

/**
 * What to announce when the angle changes.
 *
 * Describes the transform, never a viewpoint. "Tilted 6 degrees left" is a statement
 * about what was done to the image; "left view" would be a statement about a photograph
 * that does not exist. The distinction is the entire honesty requirement of this feature.
 */
export function tiltStatus(degrees: number): string {
  const angle = clampTilt(degrees);
  if (angle === TILT_NONE) return 'Flat — no tilt applied';
  return `Tilted ${Math.abs(angle)} degrees ${angle < 0 ? 'left' : 'right'}`;
}

/** Whether a control that steps in this direction has anywhere left to go. */
export const canTilt = (degrees: number, direction: TiltDirection): boolean =>
  nextTilt(degrees, direction) !== clampTilt(degrees);

/**
 * The standing note shown beside the controls.
 *
 * A string rather than JSX so the claim itself can be tested. It has to hold for every
 * card the control can appear on, and those differ in provenance: the two Rose Veil
 * complete looks are captured API results, every other look falls back to a designed
 * placeholder, and live mode produces a third kind. Naming any one of them here would
 * describe the other two wrongly — and in fixture mode the per-image provenance caption
 * is hidden, so nothing on screen would correct it.
 *
 * So it claims only what is true of all three: there is an image on the card, and this
 * tilts it.
 */
export const TILT_PREVIEW_NOTE =
  '2.5D preview tilts the image shown on a ready card. It is a visual effect, not a ' +
  '3D model, and it does not add side or rear views.';
