/**
 * The 2.5D preview controls for one result card.
 *
 * One card, one set of controls, one angle. There is deliberately no shared state
 * between cards and no carousel: the two complete looks are a comparison, and a control
 * that moved both at once would be a slideshow instead.
 *
 * Nothing here animates on its own. The preview is stopped until someone presses a
 * control, so there is no motion on the results screen that a shopper did not ask for.
 */

import { Button } from './controls.js';
import {
  TILT_NONE,
  canTilt,
  isTilted,
  nextTilt,
  tiltStatus,
  type TiltDirection,
} from './tiltPreview.js';

/** A small arrow, mirrored for the other direction. Decorative; the label carries meaning. */
function TiltIcon({ direction }: { direction: TiltDirection }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      className="h-4 w-4"
      style={{ transform: direction === -1 ? 'scaleX(-1)' : undefined }}
    >
      <path
        d="M 5 3 L 11 8 L 5 13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TiltControls({
  degrees,
  onChange,
  cardLabel,
}: {
  degrees: number;
  onChange: (degrees: number) => void;
  /** Which card this belongs to, so each control has a distinct accessible name. */
  cardLabel: string;
}) {
  const tilted = isTilted(degrees);

  return (
    <div
      role="group"
      aria-label={`2.5D preview — ${cardLabel}`}
      className="flex flex-wrap items-center justify-center gap-2"
    >
      <span className="text-sm text-ink-soft">2.5D preview</span>

      <Button
        variant="quiet"
        className="!px-3 !py-2 text-sm"
        onClick={() => onChange(nextTilt(degrees, -1))}
        disabled={!canTilt(degrees, -1)}
        aria-label={`Tilt left — ${cardLabel}`}
      >
        <TiltIcon direction={-1} />
        <span aria-hidden="true">Left</span>
      </Button>

      <Button
        variant="quiet"
        className="!px-3 !py-2 text-sm"
        onClick={() => onChange(TILT_NONE)}
        disabled={!tilted}
        aria-label={`Reset the 2.5D preview — ${cardLabel}`}
      >
        <span aria-hidden="true">Reset</span>
      </Button>

      <Button
        variant="quiet"
        className="!px-3 !py-2 text-sm"
        onClick={() => onChange(nextTilt(degrees, 1))}
        disabled={!canTilt(degrees, 1)}
        aria-label={`Tilt right — ${cardLabel}`}
      >
        <span aria-hidden="true">Right</span>
        <TiltIcon direction={1} />
      </Button>

      {/*
        The angle in words, for anyone who cannot see the card move. Polite rather than
        assertive: it is a description of a preview, not something to interrupt for.
      */}
      <span aria-live="polite" className="sr-only">
        {`${cardLabel}: ${tiltStatus(degrees)}`}
      </span>
    </div>
  );
}

/**
 * The standing explanation of what the tilt is.
 *
 * Sits with the controls rather than inside each card, because it is one claim about the
 * feature and repeating it per card would make it read as a claim about each image.
 */
export function TiltPreviewNote() {
  return (
    <p className="text-center text-xs text-ink-soft sm:text-left">
      2.5D preview tilts the captured result image. It is a visual effect on one
      photograph, not a 3D model, and it does not show side or rear views.
    </p>
  );
}
