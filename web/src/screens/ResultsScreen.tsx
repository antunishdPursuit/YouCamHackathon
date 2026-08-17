/**
 * Stage 4 — Results.
 *
 * Palette, generated previews, and the two one-variable-at-a-time comparisons now
 * live together. The user does not have to remember which page contains the next
 * decision, and every image keeps its provider/fixture provenance below the frame.
 */

import type { AnalyzeResponse, TryOnPanel, TryOnResponse } from '@yincol/shared';
import { findMakeupLook } from '@yincol/shared';
import { Button, Chip, Segmented } from '../components/controls.js';
import { PartialResultsNotice } from '../components/StateNotice.js';
import { PhotoSlot } from '../components/PhotoSlot.js';
import { DISPLAY_SLOTS, frameAspectRatio, type DisplaySlotConfig } from '../config/displaySlots.js';
import { SectionHeading, YincolCard } from '../components/ornament.js';
import type { CompareAxis, MakeupChoice } from '../state/session.js';

interface ResultPanel {
  readonly key: string;
  readonly slot: DisplaySlotConfig;
  readonly panel: TryOnPanel | undefined;
  readonly title: string;
  /** One line under the title saying which steps produced this image. */
  readonly subtitle: string;
  readonly chosen: boolean;
  readonly choose: () => void;
}

function garmentSlotLabel(index: number): string {
  if (index === 0) return 'Garment A';
  if (index === 1) return 'Garment B';
  return `Garment ${index + 1}`;
}

/**
 * What a panel is, said only as far as the server's `stage` allows.
 *
 * A panel is described as a complete look ONLY where the server marked it one, which it
 * does only where the makeup task was handed the garment task's result. Everywhere else
 * this stops at "garment preview", including for shipped placeholders — which nothing
 * rendered, and which therefore get no claim at all.
 */
function panelSubtitle(panel: TryOnPanel | undefined, lookName: string): string {
  if (!panel || panel.result.status === 'failed') return 'Not generated';
  if (panel.stage === 'completeLook') return `Garment and ${lookName} makeup`;
  if (panel.stage === 'garmentOnly') return 'Garment only, no makeup';
  return 'Designed stand-in';
}

function PaletteSummary({ analysis }: { analysis: AnalyzeResponse }) {
  const { palette, skin, skinUnavailableReason } = analysis;
  const { derivation } = palette;

  return (
    <YincolCard aria-labelledby="palette-heading" tone="surface" className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionHeading id="palette-heading" className="text-2xl">
            Your colour direction
          </SectionHeading>
          <p className="mt-2 text-sm text-ink-soft">
            Six colours chosen from your portrait by a visible rule.
          </p>
        </div>
        <Chip>{derivation.axes.undertone} · {derivation.axes.depth} · {derivation.axes.contrast} contrast</Chip>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
        {palette.swatches.map((swatch) => (
          <li key={swatch.id} className="overflow-hidden rounded-card border border-gold/40 bg-ground">
            <span aria-hidden="true" className="block h-10" style={{ backgroundColor: swatch.hex }} />
            <span className="block px-2.5 py-2">
              <span className="block text-xs font-semibold leading-tight text-ink">{swatch.name}</span>
              <span className="mt-1 block font-mono text-[10px] uppercase text-ink-soft">{swatch.hex}</span>
            </span>
          </li>
        ))}
      </ul>

      <details className="mt-4 rounded-card border border-gold/40 bg-ground px-3 py-2.5">
        <summary className="cursor-pointer text-sm font-semibold text-ink">How this was chosen</summary>
        <div className="mt-3 space-y-3 text-sm text-ink-soft">
          <ul className="space-y-2">
            {derivation.notes.map((note) => (
              <li key={note} className="flex gap-3">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                {note}
              </li>
            ))}
          </ul>
          <p className="rounded-card border border-gold/30 px-4 py-2.5 text-xs">
            Rule <span className="font-mono text-ink">{derivation.ruleKey}</span> · hue{' '}
            {derivation.rule.hueStart}°–{derivation.rule.hueEnd}° · lightness{' '}
            {derivation.rule.lightnessMin}–{derivation.rule.lightnessMax}
          </p>
        </div>
      </details>

      {skin && skin.signals.length > 0 ? (
        <p className="mt-3 text-xs text-ink-soft">
          Appearance context is shown only to support colour choices; it is not a health or skincare assessment.
        </p>
      ) : null}
      {skinUnavailableReason ? <p className="mt-3 text-sm text-ink-soft">{skinUnavailableReason}</p> : null}
    </YincolCard>
  );
}

export function ResultsScreen({
  analysis,
  tryOn,
  garmentIds,
  makeupLookId,
  axis,
  keptGarmentIds,
  keptMakeupWinners,
  portraitSize,
  onAxisChange,
  onToggleGarment,
  onToggleMakeup,
  onEditInputs,
  onStartOver,
}: {
  analysis: AnalyzeResponse;
  tryOn: TryOnResponse;
  garmentIds: readonly string[];
  makeupLookId: string | null;
  axis: CompareAxis;
  keptGarmentIds: readonly string[];
  keptMakeupWinners: readonly MakeupChoice[];
  /** Pixel size of the portrait the results came from, so full-body frames fit the body. */
  portraitSize?: { readonly width: number; readonly height: number };
  onAxisChange: (axis: CompareAxis) => void;
  onToggleGarment: (garmentId: string) => void;
  onToggleMakeup: (winner: MakeupChoice) => void;
  onEditInputs: () => void;
  onStartOver: () => void;
}) {
  const look = makeupLookId ? findMakeupLook(makeupLookId) : undefined;
  const lookName = look?.name ?? 'the chosen';
  const frame = frameAspectRatio(portraitSize?.width, portraitSize?.height);

  /**
   * Axis 1 — the two complete looks, side by side.
   *
   * Both carry the same makeup, so the garment is the only thing that changes between
   * them. That is the comparison the whole sequence exists to produce.
   */
  const garmentPanels: ResultPanel[] = garmentIds.map((garmentId, index) => ({
    key: garmentId,
    slot: index === 0 ? DISPLAY_SLOTS.completeLookA : DISPLAY_SLOTS.completeLookB,
    panel: tryOn.completeLooks[garmentId],
    title: `${garmentSlotLabel(index)} complete look`,
    subtitle: panelSubtitle(tryOn.completeLooks[garmentId], lookName),
    chosen: keptGarmentIds.includes(garmentId),
    choose: () => onToggleGarment(garmentId),
  }));

  /**
   * Axis 2 — what the makeup step added, on one garment.
   *
   * The garment is held constant and the makeup is the only difference, so this reads as
   * the effect of the second task rather than as two unrelated pictures. Garment A is the
   * anchor; the chip says so.
   */
  const anchorGarmentId = garmentIds[0];
  const makeupPanels: ResultPanel[] = anchorGarmentId
    ? [
        {
          key: 'garmentOnly',
          slot: DISPLAY_SLOTS.garmentA,
          panel: tryOn.garments[anchorGarmentId],
          title: 'Without makeup',
          subtitle: panelSubtitle(tryOn.garments[anchorGarmentId], lookName),
          chosen: keptMakeupWinners.includes('garmentOnly'),
          choose: () => onToggleMakeup('garmentOnly'),
        },
        {
          key: 'completeLook',
          slot: DISPLAY_SLOTS.completeLookA,
          panel: tryOn.completeLooks[anchorGarmentId],
          title: `With ${lookName}`,
          subtitle: panelSubtitle(tryOn.completeLooks[anchorGarmentId], lookName),
          chosen: keptMakeupWinners.includes('completeLook'),
          choose: () => onToggleMakeup('completeLook'),
        },
      ]
    : [];

  const panels = axis === 'garments' ? garmentPanels : makeupPanels;
  const failedLabels = panels
    .filter((entry) => entry.panel?.result.status === 'failed')
    .map((entry) => `the ${entry.title.toLowerCase()} preview`);
  const lockedLabel = axis === 'garments'
    ? `Makeup held: ${look?.name ?? 'none'}`
    : `Garment held: ${garmentIds.length > 0 ? garmentSlotLabel(0) : 'none'}`;

  return (
    <div className="animate-soft-fade space-y-8">
      <header className="text-center">
        <SectionHeading className="text-4xl">Your comparison</SectionHeading>
        <p className="mx-auto mt-3 max-w-reading text-base text-ink-soft">
          Each garment was rendered on your portrait, then the makeup was applied to that
          result. Compare the two complete looks, or see what the makeup step changed, then
          keep any options that work for you.
        </p>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(260px,0.34fr)_minmax(0,1fr)] xl:items-start">
        <PaletteSummary analysis={analysis} />

        <section aria-labelledby="previews-heading" className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <SectionHeading id="previews-heading" className="mr-auto text-3xl">Generated previews</SectionHeading>
          <Segmented
            label="What to compare"
            value={axis}
            onChange={onAxisChange}
            options={[
              { value: 'garments', label: 'Garments', hint: 'compare the two complete looks' },
              { value: 'makeup', label: 'Makeup', hint: 'compare garment A with and without the makeup step' },
            ]}
          />
          <Chip tone="locked">
            <span aria-hidden="true">🔒</span>
            {lockedLabel}
          </Chip>
          {tryOn.mode === 'fixture' ? (
            <span className="rounded-full border border-gold/50 bg-surface px-3 py-1.5 text-sm text-ink-soft">
              Local demo preview · fixture images
            </span>
          ) : null}
          {tryOn.mode === 'live' ? (
            <span className="rounded-full border border-gold/50 bg-surface px-3 py-1.5 text-sm text-ink-soft">
              Live YouCam results · uploaded files
            </span>
          ) : null}
        </div>

        <PartialResultsNotice failedLabels={failedLabels} />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {panels.map((entry) => (
            <article key={entry.key} className="flex flex-col">
              <PhotoSlot
                slot={entry.slot}
                aspectRatio={frame}
                showProvenance={tryOn.mode !== 'fixture'}
                {...(entry.panel
                  ? {
                      result: entry.panel.result,
                      provenance: entry.panel.provenance,
                      ...(entry.panel.stage ? { stage: entry.panel.stage } : {}),
                    }
                  : {})}
              />
              <div className="mt-3 flex flex-col items-center gap-2">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <h3 className="text-base font-semibold text-ink">{entry.title}</h3>
                  <Button
                    variant={entry.chosen ? 'primary' : 'quiet'}
                    aria-pressed={entry.chosen}
                    onClick={entry.choose}
                    className="!px-4 text-sm"
                  >
                    {entry.chosen ? 'Kept' : 'Keep this'}
                    <span className="sr-only"> — {entry.title}</span>
                  </Button>
                </div>
                <p className="text-sm text-ink-soft">{entry.subtitle}</p>
              </div>
            </article>
          ))}
        </div>

        <p aria-live="polite" className="sr-only">
          {axis === 'garments'
            ? `${keptGarmentIds.length} garment option${keptGarmentIds.length === 1 ? '' : 's'} kept.`
            : `${keptMakeupWinners.length} makeup option${keptMakeupWinners.length === 1 ? '' : 's'} kept.`}
        </p>
        </section>
      </div>

      <div className="flex w-full flex-col items-start gap-2 sm:flex-row sm:justify-start">
        <Button variant="quiet" className="w-full sm:w-auto" onClick={onEditInputs}>Back to inputs</Button>
        <Button variant="link" className="w-full sm:w-auto" onClick={onStartOver}>Start a new look</Button>
      </div>
    </div>
  );
}
