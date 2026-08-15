/**
 * Screen 7 — Compare.
 *
 * Two axes, one segmented control:
 *   garments — garment A against garment B, with the makeup look LOCKED
 *   makeup   — bare against made-up, with the garment LOCKED
 *
 * The discipline that makes this worth anything: ONLY ONE THING CHANGES between the two
 * panels. The locked variable is named in a chip that stays on screen, both panels use
 * the same slot component at the same size with the same framing and the same cream
 * ground, and each panel carries its own fit line as text rather than relying on the
 * reader to see a colour difference.
 */

import type { Palette, TryOnResponse } from '@yincol/shared';
import { findGarment, findMakeupLook, scoreGarmentFit } from '@yincol/shared';
import { Chip, Segmented, Button } from '../components/controls.js';
import { Ribbon, SectionHeading } from '../components/ornament.js';
import { PhotoSlot } from '../components/PhotoSlot.js';
import { DISPLAY_SLOTS, type DisplaySlotConfig } from '../config/displaySlots.js';
import type { CompareAxis } from '../state/session.js';
import type { TryOnPanel } from '@yincol/shared';

interface ComparePanel {
  readonly key: string;
  readonly slot: DisplaySlotConfig;
  readonly panel: TryOnPanel | undefined;
  readonly title: string;
  /** The panel's own fit line. Always text. */
  readonly fitLine: string;
  readonly chosen: boolean;
  readonly choose: () => void;
  readonly chooseLabel: string;
}

export function CompareScreen({
  tryOn,
  palette,
  garmentIds,
  makeupLookId,
  axis,
  garmentWinnerId,
  makeupWinner,
  onAxisChange,
  onPickGarment,
  onPickMakeup,
  onContinue,
}: {
  tryOn: TryOnResponse;
  palette: Palette;
  garmentIds: readonly string[];
  makeupLookId: string | null;
  axis: CompareAxis;
  garmentWinnerId: string | null;
  makeupWinner: 'bare' | 'madeUp' | null;
  onAxisChange: (axis: CompareAxis) => void;
  onPickGarment: (garmentId: string) => void;
  onPickMakeup: (winner: 'bare' | 'madeUp') => void;
  onContinue: () => void;
}) {
  const look = makeupLookId ? findMakeupLook(makeupLookId) : undefined;
  // On the makeup axis the garment is held still. Use the garment already declared the
  // winner if there is one, otherwise the first chosen — either way it is named on
  // screen, so the reader always knows what is being held constant.
  const lockedGarment = findGarment(garmentWinnerId ?? garmentIds[0] ?? '');

  const garmentPanels: ComparePanel[] = garmentIds.map((garmentId, index) => {
    const garment = findGarment(garmentId);
    const fit = garment ? scoreGarmentFit(garment.dominantHex, palette) : null;
    return {
      key: garmentId,
      slot: index === 0 ? DISPLAY_SLOTS.garmentA : DISPLAY_SLOTS.garmentB,
      panel: tryOn.garments[garmentId],
      title: garment?.name ?? garmentId,
      fitLine: fit
        ? `${fit.matched} of ${fit.total} palette colours within ΔE ${fit.threshold}.`
        : 'No fit reading for this garment.',
      chosen: garmentWinnerId === garmentId,
      choose: () => onPickGarment(garmentId),
      chooseLabel: `Keep the ${garment?.name.toLowerCase() ?? garmentId}`,
    };
  });

  /**
   * The made-up panel's fit line reads the look's LIP chip against the palette.
   *
   * That chip is hand-authored metadata describing the reference photograph, not
   * anything the API returned — so the line says "reads as", and names the shade, rather
   * than implying the API measured it.
   */
  const lipFit = look ? scoreGarmentFit(look.chips.lip.hex, palette) : null;

  const makeupPanels: ComparePanel[] = [
    {
      key: 'bare',
      slot: DISPLAY_SLOTS.portrait,
      panel: tryOn.portrait,
      title: 'Bare',
      fitLine: 'No makeup — your palette is unchanged.',
      chosen: makeupWinner === 'bare',
      choose: () => onPickMakeup('bare'),
      chooseLabel: 'Keep the bare face',
    },
    {
      key: 'madeUp',
      slot: DISPLAY_SLOTS.makeupOn,
      panel: tryOn.makeup,
      title: look?.name ?? 'Makeup look',
      fitLine: lipFit
        ? `Lip reads as ${look?.chips.lip.name} — ${lipFit.matched} of ${lipFit.total} palette colours within ΔE ${lipFit.threshold}.`
        : 'No fit reading for this look.',
      chosen: makeupWinner === 'madeUp',
      choose: () => onPickMakeup('madeUp'),
      chooseLabel: `Keep the ${look?.name ?? 'makeup'} look`,
    },
  ];

  const panels = axis === 'garments' ? garmentPanels : makeupPanels;
  const lockedLabel =
    axis === 'garments'
      ? `Makeup locked: ${look?.name ?? 'none'}`
      : `Garment locked: ${lockedGarment?.name ?? 'none'}`;

  return (
    <div className="animate-soft-fade space-y-5">
      <header className="text-center">
        <SectionHeading>Two ways to wear it</SectionHeading>
        <p className="mt-2 text-base text-ink-soft">Only one thing changes at a time.</p>
      </header>

      <div className="flex flex-col items-center gap-3">
        <Segmented
          label="What to compare"
          value={axis}
          onChange={(next) => onAxisChange(next)}
          options={[
            { value: 'garments', label: 'Garments', hint: 'compare garment A with garment B' },
            { value: 'makeup', label: 'Makeup', hint: 'compare the bare face with the makeup look' },
          ]}
        />
        {/* The locked variable, persistent and named. */}
        <Chip tone="locked">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 text-ink">
            <path
              d="M 4.5 7 V 5.2 a 3.5 3.5 0 0 1 7 0 V 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <rect x="3.2" y="7" width="9.6" height="6.4" rx="1.4" fill="currentColor" opacity="0.9" />
          </svg>
          {lockedLabel}
        </Chip>
      </div>

      {/*
        Both panels are the same component at the same width inside the same grid, so
        background, size and framing are identical by construction rather than by
        somebody remembering to keep them in step.
      */}
      <div
        key={axis}
        className={`grid grid-cols-2 gap-3 ${
          axis === 'garments' ? 'animate-slide-in-left' : 'animate-slide-in-right'
        }`}
      >
        {panels.map((entry) => (
          <div key={entry.key} className="flex flex-col">
            <PhotoSlot
              slot={entry.slot}
              {...(entry.panel
                ? { result: entry.panel.result, provenance: entry.panel.provenance }
                : {})}
            />
            <p className="mt-2 text-sm font-semibold text-ink">{entry.title}</p>
            <p className="mt-0.5 min-h-[2.5rem] text-xs text-ink-soft">{entry.fitLine}</p>
            <Button
              variant={entry.chosen ? 'primary' : 'quiet'}
              aria-pressed={entry.chosen}
              onClick={entry.choose}
              className="mt-2 w-full !px-3 text-sm"
            >
              {entry.chosen ? 'Kept' : 'Keep this'}
              <span className="sr-only"> — {entry.chooseLabel}</span>
            </Button>
            {entry.chosen ? (
              <span className="mt-2 self-start">
                <Ribbon label="Your pick" />
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <p aria-live="polite" className="text-center text-sm text-ink-soft">
        {garmentWinnerId
          ? `Garment kept: ${findGarment(garmentWinnerId)?.name}.`
          : 'No garment kept yet.'}{' '}
        {makeupWinner
          ? `Makeup kept: ${makeupWinner === 'bare' ? 'bare face' : (look?.name ?? 'the look')}.`
          : 'No makeup choice kept yet.'}
      </p>

      <Button
        className="w-full"
        disabled={!garmentWinnerId || !makeupWinner}
        onClick={onContinue}
      >
        {garmentWinnerId && makeupWinner ? 'Save this look' : 'Keep one from each comparison'}
      </Button>
    </div>
  );
}
