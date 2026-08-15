/**
 * Screen 6 — Preview.
 *
 * Apparel and makeup as two labelled panels, with the honesty label between them.
 *
 * NEVER FAKE A COMPOSITE. These are two separate generations of the same face, and
 * showing them as one image would be claiming a result we did not produce. The label
 * is not a disclaimer bolted on — it is the reason the layout is two panels.
 */

import type { Palette, TryOnResponse } from '@yincol/shared';
import { findGarment, findMakeupLook, scoreGarmentFit } from '@yincol/shared';
import { PearlDivider, SectionHeading } from '../components/ornament.js';
import { Button } from '../components/controls.js';
import { PhotoSlot } from '../components/PhotoSlot.js';
import { DISPLAY_SLOTS } from '../config/displaySlots.js';

export function PreviewScreen({
  tryOn,
  palette,
  garmentIds,
  makeupLookId,
  onContinue,
}: {
  tryOn: TryOnResponse;
  palette: Palette;
  garmentIds: readonly string[];
  makeupLookId: string | null;
  onContinue: () => void;
}) {
  const look = makeupLookId ? findMakeupLook(makeupLookId) : undefined;

  return (
    <div className="animate-soft-fade space-y-6">
      <header className="text-center">
        <SectionHeading>Two ways to wear it</SectionHeading>
      </header>

      <section aria-labelledby="apparel-heading">
        <h3 id="apparel-heading" className="font-display text-2xl text-ink">
          Apparel
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {garmentIds.map((garmentId, index) => {
            const garment = findGarment(garmentId);
            const panel = tryOn.garments[garmentId];
            const fit = garment ? scoreGarmentFit(garment.dominantHex, palette) : null;
            const slot = index === 0 ? DISPLAY_SLOTS.garmentA : DISPLAY_SLOTS.garmentB;

            return (
              <div key={garmentId}>
                <PhotoSlot slot={slot} {...(panel ? { result: panel.result, provenance: panel.provenance } : {})} />
                <p className="mt-2 text-sm font-semibold text-ink">{garment?.name ?? garmentId}</p>
                {/* Every fit signal carries text. */}
                {fit ? <p className="text-xs text-ink-soft">{fit.summary}</p> : null}
              </div>
            );
          })}
        </div>
      </section>

      <PearlDivider />

      <section aria-labelledby="makeup-heading">
        <h3 id="makeup-heading" className="font-display text-2xl text-ink">
          Makeup
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <PhotoSlot
              slot={DISPLAY_SLOTS.portrait}
              {...(tryOn.portrait
                ? { result: tryOn.portrait.result, provenance: tryOn.portrait.provenance }
                : {})}
            />
            <p className="mt-2 text-sm font-semibold text-ink">Bare</p>
            <p className="text-xs text-ink-soft">Your photograph, unchanged.</p>
          </div>
          <div>
            <PhotoSlot
              slot={DISPLAY_SLOTS.makeupOn}
              {...(tryOn.makeup
                ? { result: tryOn.makeup.result, provenance: tryOn.makeup.provenance }
                : {})}
            />
            <p className="mt-2 text-sm font-semibold text-ink">{look?.name ?? 'Makeup look'}</p>
            <p className="text-xs text-ink-soft">
              Copied from this look&rsquo;s reference photograph.
            </p>
          </div>
        </div>
      </section>

      <p className="rounded-card border border-gold/50 bg-surface px-4 py-3 text-center text-sm text-ink">
        Apparel and makeup previews are generated separately.
      </p>

      <Button className="w-full" onClick={onContinue}>
        Compare them
      </Button>
    </div>
  );
}
