/**
 * A photograph slot — the only component in the app that renders a photograph.
 *
 * Three rules it exists to enforce:
 *
 *  1. FIXED FRAMING. Always 3:4, always object-cover, always the same. Two panels that
 *     differ in crop or scale are not a comparison.
 *  2. TWO-ZONE COLOUR. The interior is plain cream. No tint, gradient, scrim, glow or
 *     shadow lies across the image. Ornament frames it from outside.
 *  3. AN EMPTY SLOT IS A DESIGNED STATE. Not a broken image, not a grey box — a cream
 *     panel with a gold hairline, a small motif and a quiet caption.
 */

import type { Provenance, TryOnResult } from '@yincol/shared';
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
  className = '',
}: {
  slot: DisplaySlotConfig;
  /** `undefined` means the slot has not been filled yet — the same as a designed empty. */
  result?: TryOnResult;
  provenance?: Provenance;
  className?: string;
}) {
  const isReady = result?.status === 'ready';

  return (
    <figure className={`m-0 ${className}`}>
      <div
        className="relative overflow-hidden rounded-card border border-gold/60 bg-ground"
        style={{ aspectRatio: PHOTO_ASPECT_RATIO }}
      >
        {isReady ? (
          <img
            src={result.imageUrl}
            alt={result.alt}
            className="h-full w-full object-cover"
            style={{ aspectRatio: PHOTO_ASPECT_RATIO }}
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
      {provenance === 'placeholder' && isReady ? (
        <figcaption className="mt-1.5 text-xs text-ink-soft">
          Placeholder image — not an API result.
        </figcaption>
      ) : null}
      {provenance === 'captured' && isReady ? (
        <figcaption className="mt-1.5 text-xs text-ink-soft">
          Pre-captured result from the live API.
        </figcaption>
      ) : null}
    </figure>
  );
}
