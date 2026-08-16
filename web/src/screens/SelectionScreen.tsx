/**
 * Screen 3 — Selection.
 *
 * Eight garments and five makeup looks. Pick two garments and one look. The "2 of 2
 * chosen" state is stated in words, not implied by how many things happen to be tinted.
 */

import { GARMENTS, MAKEUP_LOOKS } from '@yincol/shared';
import { PearlDivider, Ribbon, SectionHeading } from '../components/ornament.js';
import { Button } from '../components/controls.js';

/**
 * An illustrated garment card.
 *
 * Deliberately an illustration rather than a photograph: we do not have product shots,
 * and a drawn shape tinted with the garment's real dominant colour cannot be mistaken
 * for one. The colour is the honest part, and it is the part that matters for fit.
 */
function GarmentIllustration({ hex, name }: { hex: string; name: string }) {
  return (
    <svg
      viewBox="0 0 100 120"
      role="img"
      aria-label={`Illustration of the ${name.toLowerCase()}`}
      className="h-full w-full"
    >
      <rect width="100" height="120" fill="#FFFDF9" />
      <path
        d="M 30 22 L 18 30 L 12 52 L 24 58 L 24 104 L 76 104 L 76 58 L 88 52 L 82 30 L 70 22 L 60 30 Q 50 38 40 30 Z"
        fill={hex}
        stroke="#C6A15B"
        strokeWidth="0.8"
      />
      <path d="M 40 30 Q 50 38 60 30" fill="none" stroke="#C6A15B" strokeWidth="0.8" opacity="0.7" />
    </svg>
  );
}

export function SelectionScreen({
  garmentIds,
  makeupLookId,
  onToggleGarment,
  onChooseMakeup,
  onContinue,
}: {
  garmentIds: readonly string[];
  makeupLookId: string | null;
  onToggleGarment: (id: string) => void;
  onChooseMakeup: (id: string) => void;
  onContinue: () => void;
}) {
  const ready = garmentIds.length === 2 && makeupLookId !== null;

  return (
    <div className="animate-soft-fade space-y-6">
      <header className="text-center">
        <SectionHeading>Two to compare</SectionHeading>
        <p className="mt-2 text-base text-ink-soft">
          Choose two garments and one makeup look.
        </p>
      </header>

      {/* Count stated in words. A tally nobody has to infer from tinting. */}
      <p
        aria-live="polite"
        className="rounded-full border border-gold/50 bg-surface px-4 py-2 text-center text-sm font-semibold text-ink"
      >
        {garmentIds.length} of 2 garments chosen
        {makeupLookId ? ' · makeup look chosen' : ' · no makeup look yet'}
      </p>

      <section aria-labelledby="garments-heading">
        <h3 id="garments-heading" className="font-display text-2xl text-ink">
          The rail
        </h3>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {GARMENTS.map((garment) => {
            const chosen = garmentIds.includes(garment.id);
            const position = garmentIds.indexOf(garment.id);
            return (
              <li key={garment.id}>
                <button
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => onToggleGarment(garment.id)}
                  className={`flex w-full flex-col overflow-hidden rounded-card border bg-ground text-left transition-shadow duration-200 ${
                    chosen ? 'border-gold shadow-emboss' : 'border-gold/40'
                  }`}
                >
                  <span className="block aspect-[5/6] w-full bg-ground">
                    <GarmentIllustration hex={garment.dominantHex} name={garment.name} />
                  </span>
                  <span className="flex min-h-[44px] flex-col justify-center gap-1 px-3 py-2">
                    <span className="text-sm font-semibold leading-snug text-ink">
                      {garment.name}
                    </span>
                    <span className="text-xs text-ink-soft">{garment.colorName}</span>
                    {/* Selection carries text, never colour alone. */}
                    {chosen ? <Ribbon label={position === 0 ? 'Chosen — A' : 'Chosen — B'} /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <PearlDivider />

      <section aria-labelledby="makeup-heading">
        <h3 id="makeup-heading" className="font-display text-2xl text-ink">
          The looks
        </h3>
        {/*
          These three dots describe the reference photograph the API will copy the look
          from. They are display metadata written by hand, not values sent anywhere —
          this feature takes a face, never a shade code.
        */}
        <p className="mt-1 text-sm text-ink-soft">
          Each look is copied from a reference photograph. The dots show roughly how its
          lip, cheek and eye read.
        </p>
        <ul className="mt-3 space-y-3">
          {MAKEUP_LOOKS.map((look) => {
            const chosen = look.id === makeupLookId;
            return (
              <li key={look.id}>
                <button
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => onChooseMakeup(look.id)}
                  className={`flex w-full items-start gap-3 rounded-card border bg-ground p-3 text-left transition-shadow duration-200 ${
                    chosen ? 'border-gold shadow-emboss' : 'border-gold/40'
                  }`}
                >
                  <span className="flex shrink-0 flex-col gap-1.5 pt-0.5">
                    {(['lip', 'cheek', 'eye'] as const).map((zone) => (
                      <span key={zone} className="flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="h-4 w-4 rounded-full border border-gold/50"
                          style={{ backgroundColor: look.chips[zone].hex }}
                        />
                        <span className="text-[11px] text-ink-soft">
                          {zone} · {look.chips[zone].name}
                        </span>
                      </span>
                    ))}
                  </span>
                  <span className="flex-1">
                    <span className="block font-display text-xl text-ink">{look.name}</span>
                    <span className="block text-sm text-ink-soft">{look.description}</span>
                    {chosen ? (
                      <span className="mt-2 inline-block">
                        <Ribbon label="Chosen" />
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <Button className="w-full" disabled={!ready} onClick={onContinue}>
        {ready ? 'Read my colours' : 'Choose two garments and one look'}
      </Button>
    </div>
  );
}
