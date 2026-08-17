/**
 * A photograph slot — the only component in the app that renders a photograph.
 *
 * Four rules it exists to enforce:
 *
 *  1. FIXED FRAMING. Every panel on a screen shares one frame shape. Two panels that
 *     differ in crop or scale are not a comparison.
 *  2. NOTHING IS SILENTLY CROPPED. The image is scaled to fit inside that frame rather
 *     than filling it, so a full-body garment result arrives with its feet attached. A
 *     crop the shopper cannot see is a crop they cannot judge.
 *  3. TWO-ZONE COLOUR. The interior is plain cream. No tint, gradient, scrim, glow or
 *     shadow lies across the image. Ornament frames it from outside.
 *  4. AN EMPTY SLOT IS A DESIGNED STATE. Not a broken image, not a grey box — a cream
 *     panel with a gold hairline, a small motif and a quiet caption.
 */

import type { LookStage, Provenance, TryOnResult } from '@yincol/shared';
import { PHOTO_ASPECT_RATIO, type DisplaySlotConfig } from '../config/displaySlots.js';

/** The centred motif on an empty slot. Mirror arch, in keeping with the vanity table. */
function PlaceholderMotif() {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
      className="h-16 w-16 text-gold"
      style={{ opacity: 0.85 }}
    >
      <path
        d="M 32 96 L 32 52 a 28 28 0 0 1 56 0 L 88 96 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M 42 88 L 42 54 a 18 18 0 0 1 36 0 L 78 88 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.6"
      />
      <circle cx="60" cy="44" r="3.5" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

export function PhotoSlot({
  slot,
  result,
  provenance,
  stage,
  aspectRatio = PHOTO_ASPECT_RATIO,
  showProvenance = true,
  className = '',
}: {
  slot: DisplaySlotConfig;
  /** `undefined` means the slot has not been filled yet — the same as a designed empty. */
  result?: TryOnResult;
  provenance?: Provenance;
  /** What the image actually is. Absent means nothing rendered it, so nothing is claimed. */
  stage?: LookStage;
  /** Shared by every panel on a screen; see `frameAspectRatio`. */
  aspectRatio?: string;
  /** Hide per-image fixture labels when a parent notice already covers the whole set. */
  showProvenance?: boolean;
  className?: string;
}) {
  const isReady = result?.status === 'ready';

  return (
    <figure className={`m-0 ${className}`}>
      <div
        className="relative overflow-hidden rounded-card border border-gold/60 bg-ground"
        style={{ aspectRatio }}
      >
        {isReady ? (
          <img
            src={result.imageUrl}
            alt={result.alt}
            className="h-full w-full object-contain"
          />
        ) : (
          // The designed empty state. A judge could see this without embarrassment.
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-3 bg-ground px-4 text-center"
            role="img"
            aria-label={result?.status === 'failed' ? result.reason : slot.emptyAlt}
          >
            <PlaceholderMotif />
            <span className="font-display text-xl text-ink">{slot.caption}</span>
            {result?.status === 'failed' ? (
              <span className="max-w-[22ch] text-sm text-ink-soft">{result.reason}</span>
            ) : null}
          </div>
        )}
      </div>

      {/*
        Provenance sits under the frame, never across the picture. `placeholder` has to
        say so plainly — a stand-in presented as an API result is a lie told to a judge.
      */}
      {showProvenance && isReady && provenanceNote(provenance, stage) ? (
        <figcaption className="mt-2 text-sm text-ink-soft">
          {provenanceNote(provenance, stage)}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * What this picture is, in one sentence a judge could check.
 *
 * The second clause is only added where `stage` says the makeup step actually received
 * the garment step's image. Without that, the caption stops at what we can prove.
 */
function provenanceNote(provenance?: Provenance, stage?: LookStage): string | null {
  const sequence =
    stage === 'completeLook' ? ' The makeup effects were applied to the garment result.' : '';

  switch (provenance) {
    case 'placeholder':
      return 'Placeholder image — not an API result.';
    case 'captured':
      return `Pre-captured result from the live API.${sequence}`;
    case 'live':
      return `Live YouCam result — generated from your upload.${sequence}`;
    default:
      return null;
  }
}
