/**
 * Stage 4 — Results.
 *
 * Guided outfit and makeup comparisons lead the Results screen. Colour details
 * follow the photos. The user does not have to remember which page contains the next
 * decision, and every image keeps its provider/fixture provenance below the frame.
 *
 * There is no user-toggled Close-up/Full-body view any more: full-body results, when
 * present, render as an additional labelled section under Compare outfits rather than
 * replacing the close-up panels. Compare makeup shows the original portrait against that
 * same portrait with makeup applied, clothing unchanged — full-body has no equivalent of
 * this, since there is no bare full-body portrait to anchor it to.
 */

import { useState } from 'react';
import type { AnalyzeResponse, TryOnPanel, TryOnResponse } from '@yincol/shared';
import { findMakeupLook } from '@yincol/shared';
import { Button, Segmented, Chip } from '../components/controls.js';
import { TiltControls, TiltPreviewNote } from '../components/TiltControls.js';
import { TILT_NONE } from '../components/tiltPreview.js';
import { PartialResultsNotice } from '../components/StateNotice.js';
import { PhotoSlot } from '../components/PhotoSlot.js';
import { MotionPreview } from '../components/MotionPreview.js';
import { motionSampleKind } from '../components/motionSample.js';
import { DISPLAY_SLOTS, frameAspectRatio, type DisplaySlotConfig } from '../config/displaySlots.js';
import { SectionHeading, YincolCard } from '../components/ornament.js';
import type { CompareAxis } from '../state/session.js';

interface ResultPanel {
  readonly key: string;
  readonly slot: DisplaySlotConfig;
  readonly panel: TryOnPanel | undefined;
  readonly title: string;
  /** One line under the title saying which steps produced this image. */
  readonly subtitle: string;
}

interface ResultSection {
  readonly key: string;
  /** Absent for the only section on an axis; present when full-body adds a second one. */
  readonly heading?: string;
  readonly panels: readonly ResultPanel[];
  readonly frame: string;
  readonly fullBody: boolean;
  readonly showsTilt: boolean;
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
  if (panel.stage === 'portraitMakeup') return `${lookName} makeup, no garment change`;
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
  fullBodySize,
  garmentIds,
  makeupLookId,
  axis,
  portraitSize,
  onAxisChange,
  onEditInputs,
  onStartOver,
  videoByImage = {},
  motionKindByImage = {},
}: {
  analysis: AnalyzeResponse;
  tryOn: TryOnResponse;
  fullBodySize?: { readonly width: number; readonly height: number };
  garmentIds: readonly string[];
  makeupLookId: string | null;
  axis: CompareAxis;
  /** Pixel size of the portrait the results came from, so full-body frames fit the body. */
  portraitSize?: { readonly width: number; readonly height: number };
  onAxisChange: (axis: CompareAxis) => void;
  onEditInputs: () => void;
  onStartOver: () => void;
  videoByImage?: Readonly<Record<string, string>>;
  motionKindByImage?: Readonly<Record<string, 'video' | 'still'>>;
}) {
  const look = makeupLookId ? findMakeupLook(makeupLookId) : undefined;
  const lookName = look?.name ?? 'the chosen';
  const closeUpFrame = frameAspectRatio(portraitSize?.width, portraitSize?.height);
  const fullBodyFrame = frameAspectRatio(fullBodySize?.width, fullBodySize?.height);
  const motionForPanel = (panel: TryOnPanel | undefined, mode: TryOnResponse['mode']) =>
    panel?.result.status === 'ready' ? motionKindByImage[panel.result.imageUrl] ?? motionSampleKind(panel, mode) : undefined;

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

  const outfitPanels = (view: { readonly completeLooks: Readonly<Record<string, TryOnPanel>> }, label: string): ResultPanel[] =>
    garmentIds.map((garmentId, index) => ({
      key: `${label}-${garmentId}`,
      slot: index === 0 ? DISPLAY_SLOTS.completeLookA : DISPLAY_SLOTS.completeLookB,
      panel: view.completeLooks[garmentId],
      title: view.completeLooks[garmentId]?.stage === 'completeLook'
        ? `${garmentSlotLabel(index)} complete look` : `${garmentSlotLabel(index)} preview`,
      subtitle: panelSubtitle(view.completeLooks[garmentId], lookName),
    }));

  /**
   * Axis 1 — the two outfits, side by side. Close-up always renders; full body adds a
   * second, separately labelled section when the request generated one — it is additional
   * data, not an alternate view of the same section.
   */
  const sections: ResultSection[] = axis === 'garments'
    ? [
        {
          key: 'closeup',
          ...(generation.fullBody ? { heading: 'Close-up' } : {}),
          panels: outfitPanels(generation, 'closeup'),
          frame: closeUpFrame,
          fullBody: false,
          showsTilt: true,
        },
        ...(generation.fullBody ? [{
          key: 'fullBody',
          heading: 'Full body — shared trousers and makeup',
          panels: outfitPanels(generation.fullBody, 'fullBody'),
          frame: fullBodyFrame,
          fullBody: true,
          showsTilt: false,
        }] : []),
      ]
    : [
        {
          key: 'makeup',
          panels: [
            {
              key: 'portrait',
              slot: DISPLAY_SLOTS.portrait,
              panel: generation.portrait,
              title: 'Original portrait',
              subtitle: panelSubtitle(generation.portrait, lookName),
            },
            {
              key: 'portraitMadeUp',
              slot: DISPLAY_SLOTS.portraitMadeUp,
              panel: generation.portraitMadeUp,
              title: `With ${lookName} makeup`,
              subtitle: panelSubtitle(generation.portraitMadeUp, lookName),
            },
          ],
          frame: closeUpFrame,
          fullBody: false,
          showsTilt: false,
        },
      ];

  const allPanels = sections.flatMap((section) => section.panels);
  const failedLabels = allPanels
    .filter((entry) => entry.panel?.result.status === 'failed')
    .map((entry) => `the ${entry.title}`);

  const comparisonNote = axis === 'garments'
    ? `Compare the two outfits with the same ${look?.name ?? 'selected'} makeup.`
    : `Compare your original portrait against the same portrait with ${look?.name ?? 'the chosen'} makeup, clothing unchanged.`;

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
        tabIndex={0} className="min-w-0 space-y-8">
        <p className="max-w-reading text-base text-ink-soft">{comparisonNote}</p>
        {generation.mode === 'fixture' ? (
          <p className="text-sm text-ink-soft">Saved demo results · your photos were not used to generate these previews.</p>
        ) : null}
        <PartialResultsNotice failedLabels={failedLabels} />

        {sections.map((section) => {
          const hasTiltableCard = section.showsTilt && section.panels.some(
            (entry) => entry.panel?.result.status === 'ready' && entry.panel.provenance !== 'placeholder' &&
              !motionForPanel(entry.panel, generation.mode),
          );
          return (
            <div key={section.key} className="space-y-4">
              {section.heading ? <h3 className="text-lg font-semibold text-ink">{section.heading}</h3> : null}
              {hasTiltableCard ? <TiltPreviewNote /> : null}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {section.panels.map((entry) => {
                  const savedVideo = entry.panel?.result.status === 'ready' ? videoByImage[entry.panel.result.imageUrl] : undefined;
                  const motionKind = section.showsTilt ? (savedVideo ? 'video' : motionForPanel(entry.panel, generation.mode)) : undefined;
                  const canTiltThisCard = section.showsTilt && !motionKind && entry.panel?.provenance !== 'placeholder' && entry.panel?.result.status === 'ready';
                  const titleId = `result-${section.key}-${entry.key}`;
                  const actions = (
                    <div className="mt-3 flex flex-col items-start gap-2">
                      <Button variant="quiet" disabled className="!px-4 text-sm">
                        Video — coming soon
                      </Button>
                      {canTiltThisCard ? (
                        <TiltControls degrees={tiltFor(entry.key)}
                          onChange={(degrees) => setTiltFor(entry.key, degrees)} cardLabel={entry.title} />
                      ) : null}
                    </div>
                  );

                  return (
                    <article key={entry.key} aria-labelledby={titleId} className="flex min-w-0 flex-col">
                      <header className="mb-3 space-y-1">
                        <h3 id={titleId} className="text-base font-semibold">{entry.title}</h3>
                        <p className="text-sm text-ink-soft">{entry.subtitle}</p>
                      </header>
                      {motionKind === 'video' && entry.panel?.result.status === 'ready' ? (
                        <MotionPreview key={entry.panel.result.imageUrl}
                          videoUrl={savedVideo} imageUrl={entry.panel.result.imageUrl} alt={entry.panel.result.alt}
                          slot={entry.slot} aspectRatio={section.frame}>{actions}</MotionPreview>
                      ) : <>
                        <PhotoSlot slot={entry.slot} aspectRatio={section.frame}
                          className={section.fullBody ? "[&>div]:max-h-portrait [&>div]:w-full" : ""}
                          showProvenance={generation.mode !== 'fixture' || entry.panel?.provenance === 'placeholder'}
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
            </div>
          );
        })}
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
