/**
 * Screen 8 — The look card.
 *
 * The artifact the shopper keeps. Wordmark, portrait thumbnail, winning garment,
 * winning makeup, three swatches, a one-line summary, a small provenance note, and a
 * visibly empty row held for hair and accessories.
 *
 * That empty row is deliberate and stays empty. It says what this becomes without
 * pretending it is already there — and it is the honest way to show the shape of the
 * idea to someone deciding whether to back it.
 */

import type { Palette, TryOnResponse } from '@yincol/shared';
import { findGarment, findMakeupLook, scoreGarmentFit } from '@yincol/shared';
import { PearlDivider, Ribbon, SectionHeading, Wordmark } from '../components/ornament.js';
import { Button } from '../components/controls.js';
import { PhotoSlot } from '../components/PhotoSlot.js';
import { DISPLAY_SLOTS } from '../config/displaySlots.js';

export function LookCardScreen({
  tryOn,
  palette,
  garmentWinnerId,
  makeupWinner,
  makeupLookId,
  onStartOver,
  onBack,
}: {
  tryOn: TryOnResponse;
  palette: Palette;
  garmentWinnerId: string | null;
  makeupWinner: 'bare' | 'madeUp' | null;
  makeupLookId: string | null;
  onStartOver: () => void;
  onBack: () => void;
}) {
  const garment = findGarment(garmentWinnerId ?? '');
  const look = makeupLookId ? findMakeupLook(makeupLookId) : undefined;
  const fit = garment ? scoreGarmentFit(garment.dominantHex, palette) : null;

  // Three swatches on the card: the two primaries and the accent — the ones actually
  // worn, rather than the base neutrals.
  const cardSwatches = palette.swatches.filter((swatch) => swatch.role !== 'neutral').slice(0, 3);

  const makeupLabel =
    makeupWinner === 'bare' ? 'Bare face' : (look?.name ?? 'Makeup look');

  const summary = garment
    ? `${garment.name} with ${makeupLabel.toLowerCase()} — ${fit?.matched ?? 0} of ${fit?.total ?? 6} of your colours within ΔE ${fit?.threshold ?? 25}.`
    : 'A look kept from your comparison.';

  /**
   * A non-visual summary of the whole card, for anyone who cannot see it. Screen 8 is
   * the one screen whose entire content is visual, so it is the one that most needs a
   * text equivalent.
   */
  const textSummary = [
    `Your saved look from YINCOL.`,
    garment ? `Garment: ${garment.name}, ${garment.colorName}.` : 'No garment kept.',
    `Makeup: ${makeupLabel}.`,
    `Palette colours on this card: ${cardSwatches.map((s) => `${s.name}, ${s.hex}`).join('; ')}.`,
    fit ? fit.summary : '',
    'Hair and accessories are not part of this look card yet.',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="animate-soft-fade space-y-6">
      <header className="text-center">
        <SectionHeading>The look you kept</SectionHeading>
      </header>

      {/*
        One shimmer sweep when the card is saved — once, not looping. The overflow-hidden
        wrapper keeps the sweep inside the card's own border.
      */}
      <article
        aria-label="Your saved look card"
        className="relative overflow-hidden rounded-card border border-gold/70 bg-surface p-5 shadow-card"
      >
        <span
          aria-hidden="true"
          className="animate-shimmer pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent"
        />

        <div className="flex items-start justify-between gap-3">
          <Wordmark size="sm" />
          <Ribbon label="Kept" />
        </div>

        <div className="mt-4 flex gap-4">
          <div className="w-24 shrink-0">
            <PhotoSlot
              slot={DISPLAY_SLOTS.portrait}
              {...(tryOn.portrait
                ? { result: tryOn.portrait.result, provenance: tryOn.portrait.provenance }
                : {})}
            />
          </div>

          <dl className="flex-1 space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-soft">Garment</dt>
              <dd className="font-display text-xl leading-tight text-ink">
                {garment?.name ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-soft">Makeup</dt>
              <dd className="font-display text-xl leading-tight text-ink">{makeupLabel}</dd>
            </div>
          </dl>
        </div>

        <PearlDivider className="py-3" />

        <ul className="flex justify-between gap-2" aria-label="Three colours from your palette">
          {cardSwatches.map((swatch) => (
            <li key={swatch.id} className="flex flex-1 flex-col items-center gap-1 text-center">
              <span
                aria-hidden="true"
                className="h-10 w-full rounded-lg border border-gold/50"
                style={{ backgroundColor: swatch.hex }}
              />
              <span className="text-xs font-semibold leading-tight text-ink">{swatch.name}</span>
              <span className="font-mono text-[10px] uppercase text-ink-soft">{swatch.hex}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-sm text-ink">{summary}</p>

        {/* Reserved, and visibly so. */}
        <div className="mt-4 rounded-card border border-dashed border-gold/50 px-3 py-4 text-center">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Hair · Accessories</p>
          <p className="mt-1 text-sm text-ink-soft">Reserved for a later fitting.</p>
        </div>

        <p className="mt-4 text-[11px] leading-snug text-ink-soft">
          Apparel and makeup previews were generated separately, from one photograph.
          Colours come from a fixed 27-rule table; the fit threshold is ΔE{' '}
          {fit?.threshold ?? 25}.
        </p>
      </article>

      {/* The whole card, in words. */}
      <p className="sr-only">{textSummary}</p>
      <details className="rounded-card border border-gold/40 bg-ground p-4">
        <summary className="min-h-[44px] cursor-pointer text-sm font-semibold text-ink">
          Read this look card as text
        </summary>
        <p className="mt-2 text-sm text-ink-soft">{textSummary}</p>
      </details>

      <div className="flex flex-col gap-3">
        <Button variant="quiet" onClick={onBack}>
          Back to the comparison
        </Button>
        <Button onClick={onStartOver}>Start a new look</Button>
      </div>
    </div>
  );
}
