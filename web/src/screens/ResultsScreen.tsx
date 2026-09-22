/**
 * Stage 4 — Results.
 *
 * Guided outfit and makeup comparisons lead the Results screen. Colour details
 * follow the photos. The user does not have to remember which page contains the next
 * decision, and every image keeps its provider/fixture provenance below the frame.
 */

import { useState } from 'react';
import type { AnalyzeResponse, TryOnPanel, TryOnResponse } from '@yincol/shared';
import { findMakeupLook } from '@yincol/shared';
import { Button, Chip, Segmented } from '../components/controls.js';
import { TiltControls, TiltPreviewNote } from '../components/TiltControls.js';
import { TILT_NONE } from '../components/tiltPreview.js';
import { PartialResultsNotice } from '../components/StateNotice.js';
import { PhotoSlot } from '../components/PhotoSlot.js';
import { MotionPreview } from '../components/MotionPreview.js';
import { motionSampleKind } from '../components/motionSample.js';
import { DISPLAY_SLOTS, frameAspectRatio, type DisplaySlotConfig } from '../config/displaySlots.js';
import { SectionHeading, YincolCard } from '../components/ornament.js';
import type { CompareAxis, MakeupChoice, ResultView } from '../state/session.js';

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
            {analysis.mode === 'fixture' ? 'Example colour palette' : 'Your colour direction'}
          </SectionHeading>
          <p className="mt-2 text-sm text-ink-soft">
            {analysis.mode === 'fixture'
              ? 'Six example colours chosen by the demo’s visible rule.'
              : 'Six colours chosen from your portrait by a visible rule.'}
          </p>
        </div>
        <Chip>{derivation.axes.undertone} · {derivation.axes.depth} · {derivation.axes.contrast} contrast</Chip>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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
          <p>{analysis.mode === 'fixture' ? 'These readings describe the demo subject, not your uploaded portrait.' : null}</p>
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
  tryOn: generation,
  resultView, onResultView, fullBodySize,
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
  resultView: ResultView;
  onResultView: (view: ResultView) => void;
  fullBodySize?: { readonly width: number; readonly height: number };
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
  const fullBody = resultView === 'fullBody' && Boolean(generation.fullBody);
  const tryOn = fullBody ? generation.fullBody! : generation;
  const size = fullBody ? fullBodySize : portraitSize;
  const look = makeupLookId ? findMakeupLook(makeupLookId) : undefined;
  const lookName = look?.name ?? 'the chosen';
  const frame = frameAspectRatio(size?.width, size?.height);

  /**
   * One angle per card, keyed by the card, and nothing shared between them.
   *
   * Two complete looks side by side are a comparison; a single angle driving both would
   * make them a slideshow. Keeping the state here rather than inside the card means an
   * angle survives a re-render without the card having to own it, and a card that is not
   * showing keeps whatever it had rather than silently snapping back.
   */
  const [tiltByCard, setTiltByCard] = useState<Readonly<Record<string, number>>>({});
  const tiltFor = (key: string): number => tiltByCard[key] ?? TILT_NONE;
  const setTiltFor = (key: string, degrees: number): void =>
    setTiltByCard((current) => ({ ...current, [key]: degrees }));

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
    title: tryOn.completeLooks[garmentId]?.stage === 'completeLook'
      ? `${garmentSlotLabel(index)} complete look` : `${garmentSlotLabel(index)} preview`,
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
  // The title is used exactly as the panel above shows it. Lower-casing it to fit the
  // sentence turned "Garment B" into "garment b", which reads as a typo rather than as a
  // reference to the thing the shopper is looking at.
  const failedLabels = panels
    .filter((entry) => entry.panel?.result.status === 'failed')
    .map((entry) => `the ${entry.title}`);
  // Scoped to the Garments axis, where both cards are complete looks. The Makeup axis
  // compares a garment-only preview against a complete look, and tilting one of those two
  // would put a difference between them that is not the makeup step.
  const showsTilt = axis === 'garments' && !fullBody;
  const hasTiltableCard = showsTilt && panels.some(
    (entry) => entry.panel?.result.status === 'ready' && entry.panel.provenance !== 'placeholder' && !motionSampleKind(entry.panel, tryOn.mode),
  );
  const comparisonNote = axis === 'garments'
    ? `Compare the two outfits with the same ${look?.name ?? 'selected'} makeup. Keep any you like.`
    : 'Compare Garment A with and without makeup. Keep either version, or both.';

  return (
    <div className="animate-soft-fade space-y-6">
      <header className="space-y-4">
        <SectionHeading className="text-4xl">Your comparison</SectionHeading>
        <Segmented id="comparison" controls="comparison-panel" label="What to compare"
          value={axis} onChange={onAxisChange}
          options={[
            { value: 'garments', label: 'Compare outfits' },
            { value: 'makeup', label: 'Compare makeup' },
          ]} />
      </header>

      <section id="comparison-panel" role="tabpanel" aria-labelledby={`comparison-${axis}`}
        tabIndex={0} className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-reading text-base text-ink-soft">{comparisonNote}</p>
          {generation.fullBody ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-soft">View</span>
              <Segmented label="Preview view" value={resultView} onChange={onResultView}
                options={[
                  { value: 'closeup', label: 'Close-up', hint: 'your close-up portrait previews' },
                  { value: 'fullBody', label: 'Full body', hint: 'your uploaded full-body photo with both tops and trousers' },
                ]} />
            </div>
          ) : null}
        </div>
        {tryOn.mode === 'fixture' ? (
          <p className="text-sm text-ink-soft">Saved demo results · your photos were not used to generate these previews.</p>
        ) : null}
        <PartialResultsNotice failedLabels={failedLabels} />
        {hasTiltableCard ? <TiltPreviewNote /> : null}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {panels.map((entry) => {
            const motionKind = axis === 'garments' && !fullBody ? motionSampleKind(entry.panel, tryOn.mode) : undefined;
            const canTiltThisCard = showsTilt && !motionKind && entry.panel?.provenance !== 'placeholder' && entry.panel?.result.status === 'ready';
            const titleId = `result-${resultView}-${entry.key}`;
            const actions = (
              <div className="mt-3 flex flex-col items-start gap-2">
                <Button variant={entry.chosen ? 'primary' : 'quiet'}
                  aria-pressed={entry.chosen} disabled={entry.panel?.result.status !== 'ready' || entry.panel.provenance === 'placeholder'} onClick={entry.choose} className="!px-4 text-sm">
                  {entry.chosen ? 'Kept' : 'Keep this'}
                  <span className="sr-only"> — {entry.title}</span>
                </Button>
                {canTiltThisCard ? (
                  <TiltControls degrees={tiltFor(entry.key)}
                    onChange={(degrees) => setTiltFor(entry.key, degrees)} cardLabel={entry.title} />
                ) : null}
              </div>
            );

            return (
              <article key={resultView + entry.key} aria-labelledby={titleId} className="flex min-w-0 flex-col">
                <header className="mb-3 space-y-1">
                  <h3 id={titleId} className="text-base font-semibold">{entry.title}</h3>
                  <p className="text-sm text-ink-soft">{entry.subtitle}</p>
                </header>
                {motionKind === 'video' && entry.panel?.result.status === 'ready' ? (
                  <MotionPreview key={entry.panel.result.imageUrl}
                    imageUrl={entry.panel.result.imageUrl} alt={entry.panel.result.alt}
                    slot={entry.slot} aspectRatio={frame}>{actions}</MotionPreview>
                ) : <>
                  <PhotoSlot slot={entry.slot} aspectRatio={frame}
                    className={fullBody ? "[&>div]:max-h-portrait [&>div]:w-full" : ""}
                    showProvenance={tryOn.mode !== 'fixture' || entry.panel?.provenance === 'placeholder'}
                    {...(canTiltThisCard ? { tiltDegrees: tiltFor(entry.key) } : {})}
                    {...(entry.panel ? {
                      result: entry.panel.result,
                      provenance: entry.panel.provenance,
                      ...(entry.panel.stage ? { stage: entry.panel.stage } : {}),
                    } : {})} />
                  {actions}
                </>}
              </article>
            );
          })}
        </div>
        <p aria-live="polite" className="sr-only">
          {axis === 'garments'
            ? `${keptGarmentIds.length} garment option${keptGarmentIds.length === 1 ? '' : 's'} kept.`
            : `${keptMakeupWinners.length} makeup option${keptMakeupWinners.length === 1 ? '' : 's'} kept.`}
        </p>
      </section>

      <details className="rounded-card border border-gold/40 bg-surface p-4">
        <summary className="cursor-pointer text-base font-semibold">
          {analysis.mode === 'fixture' ? 'Example colour palette' : 'Your colour direction'}
          <span className="ml-2 text-sm font-normal text-ink-soft">View colours and explanation</span>
        </summary>
        <div className="mt-4"><PaletteSummary analysis={analysis} /></div>
      </details>
      <div className="flex w-full flex-col items-start gap-2 sm:flex-row sm:justify-start">
        <Button variant="quiet" className="w-full sm:w-auto" onClick={onEditInputs}>Back to inputs</Button>
        <Button variant="link" className="w-full sm:w-auto" onClick={onStartOver}>Start a new look</Button>
      </div>
    </div>
  );
}
