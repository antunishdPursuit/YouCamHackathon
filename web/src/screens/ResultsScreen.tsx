/**
 * Stage 4 — Results.
 *
 * Palette, generated previews, and the two one-variable-at-a-time comparisons now
 * live together. The user does not have to remember which page contains the next
 * decision, and every image keeps its provider/fixture provenance below the frame.
 */

import type { AnalyzeResponse, Palette, TryOnPanel, TryOnResponse } from '@yincol/shared';
import { findGarment, findMakeupLook, scoreGarmentFit } from '@yincol/shared';
import { Button, Chip, Segmented } from '../components/controls.js';
import { PartialResultsNotice } from '../components/StateNotice.js';
import { PhotoSlot } from '../components/PhotoSlot.js';
import { DISPLAY_SLOTS, type DisplaySlotConfig } from '../config/displaySlots.js';
import { Ribbon, SectionHeading, YincolCard } from '../components/ornament.js';
import {
  OCCASION_LABELS,
  SETTING_LABELS,
  type CompareAxis,
  type Occasion,
  type Setting,
} from '../state/session.js';

interface ResultPanel {
  readonly key: string;
  readonly slot: DisplaySlotConfig;
  readonly panel: TryOnPanel | undefined;
  readonly title: string;
  readonly fitLine: string;
  readonly chosen: boolean;
  readonly choose: () => void;
  readonly chooseLabel: string;
}

function garmentSlotLabel(index: number): string {
  if (index === 0) return 'Garment A';
  if (index === 1) return 'Garment B';
  return `Garment ${index + 1}`;
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
  occasion,
  setting,
  analysis,
  tryOn,
  garmentIds,
  makeupLookId,
  axis,
  garmentWinnerId,
  makeupWinner,
  savedLook,
  onAxisChange,
  onPickGarment,
  onPickMakeup,
  onSave,
  onEditInputs,
  onStartOver,
}: {
  occasion: Occasion | null;
  setting: Setting | null;
  analysis: AnalyzeResponse;
  tryOn: TryOnResponse;
  garmentIds: readonly string[];
  makeupLookId: string | null;
  axis: CompareAxis;
  garmentWinnerId: string | null;
  makeupWinner: 'bare' | 'madeUp' | null;
  savedLook: boolean;
  onAxisChange: (axis: CompareAxis) => void;
  onPickGarment: (garmentId: string) => void;
  onPickMakeup: (winner: 'bare' | 'madeUp') => void;
  onSave: () => void;
  onEditInputs: () => void;
  onStartOver: () => void;
}) {
  const occasionLabel = occasion ? OCCASION_LABELS[occasion] : 'Your occasion';
  const resultHeading = occasion === 'other'
    ? 'Your look for this occasion'
    : occasion
      ? `Your ${occasionLabel.toLowerCase()} look`
      : 'Your results';
  const contextLabel = setting
    ? `${occasionLabel} · ${SETTING_LABELS[setting]}`
    : occasionLabel;
  const look = makeupLookId ? findMakeupLook(makeupLookId) : undefined;
  const lockedGarmentId = garmentWinnerId ?? garmentIds[0];
  const lockedGarmentIndex = lockedGarmentId ? garmentIds.indexOf(lockedGarmentId) : -1;
  const lockedGarmentLabel = lockedGarmentIndex >= 0 ? garmentSlotLabel(lockedGarmentIndex) : 'none';

  const garmentPanels: ResultPanel[] = garmentIds.map((garmentId, index) => {
    const garment = findGarment(garmentId);
    const fit = garment ? scoreGarmentFit(garment.dominantHex, analysis.palette) : null;
    const panel = tryOn.garments[garmentId];
    const slotLabel = garmentSlotLabel(index);
    const liveResult = panel?.provenance === 'live';
    const capturedResult = panel?.provenance === 'captured';
    return {
      key: garmentId,
      slot: index === 0 ? DISPLAY_SLOTS.garmentA : DISPLAY_SLOTS.garmentB,
      panel,
      title: slotLabel,
      fitLine: liveResult
        ? 'Live YouCam result from your uploaded reference. Colour fit is not measured from this image yet.'
        : capturedResult
          ? 'Pre-captured live result. Colour fit is not measured from this image.'
          : fit
            ? `Demo catalogue fit: ${fit.matched} of ${fit.total} palette colours within ΔE ${fit.threshold}.`
            : 'No demo fit reading for this garment.',
      chosen: garmentWinnerId === garmentId,
      choose: () => onPickGarment(garmentId),
      chooseLabel: `Keep ${slotLabel}`,
    };
  });

  const lipFit = look ? scoreGarmentFit(look.chips.lip.hex, analysis.palette) : null;
  const makeupPanels: ResultPanel[] = [
    {
      key: 'bare',
      slot: DISPLAY_SLOTS.portrait,
      panel: tryOn.portrait,
      title: 'Bare face',
      fitLine: 'Your palette is unchanged.',
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
        ? `Configured lip colour: ${look?.chips.lip.name} — ${lipFit.matched} of ${lipFit.total} palette colours within ΔE ${lipFit.threshold}.`
        : 'No fit reading for this look.',
      chosen: makeupWinner === 'madeUp',
      choose: () => onPickMakeup('madeUp'),
      chooseLabel: `Keep the ${look?.name ?? 'makeup'} look`,
    },
  ];

  const panels = axis === 'garments' ? garmentPanels : makeupPanels;
  const failedLabels = panels
    .filter((entry) => entry.panel?.result.status === 'failed')
    .map((entry) => `the ${entry.title.toLowerCase()} preview`);
  const lockedLabel = axis === 'garments'
    ? `Makeup locked: ${look?.name ?? 'none'}`
    : `Garment locked: ${lockedGarmentLabel}`;

  return (
    <div className="animate-soft-fade space-y-8">
      <header className="text-center">
        <SectionHeading className="text-4xl">{resultHeading}</SectionHeading>
        <p className="mx-auto mt-3 max-w-reading text-base text-ink-soft">
          Compare two options for this moment, then keep the combination you like.
        </p>
        <div className="mt-4 flex justify-center">
          <Chip>{contextLabel}</Chip>
        </div>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(260px,0.34fr)_minmax(0,1fr)] xl:items-start">
        <PaletteSummary analysis={analysis} />

        <section aria-labelledby="previews-heading" className="min-w-0 space-y-5">
        <div>
          <SectionHeading id="previews-heading" className="text-3xl">Generated previews</SectionHeading>
          <p className="mt-1 text-sm text-ink-soft">These are separate garment and makeup generations of the same portrait.</p>
        </div>

        {tryOn.mode === 'fixture' ? (
          <p className="rounded-card border border-gold/50 bg-surface px-4 py-3 text-sm text-ink-soft">
            Local demo preview: these images are fixtures, not live YouCam results.
          </p>
        ) : null}
        {tryOn.mode === 'live' ? (
          <p className="rounded-card border border-gold/50 bg-surface px-4 py-3 text-sm text-ink-soft">
            Your colour direction uses YINCOL&apos;s local palette rule. The previews below are live YouCam results generated from your uploaded files.
          </p>
        ) : null}

        <div className="flex flex-col items-center gap-3">
          <Segmented
            label="What to compare"
            value={axis}
            onChange={onAxisChange}
            options={[
              { value: 'garments', label: 'Garments', hint: 'compare garment A with garment B' },
              { value: 'makeup', label: 'Makeup', hint: 'compare the bare face with the makeup look' },
            ]}
          />
          <Chip tone="locked">
            <span aria-hidden="true">🔒</span>
            {lockedLabel}
          </Chip>
        </div>

        <PartialResultsNotice failedLabels={failedLabels} />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {panels.map((entry) => (
            <article key={entry.key} className="flex flex-col">
              <PhotoSlot
                slot={entry.slot}
                {...(entry.panel ? { result: entry.panel.result, provenance: entry.panel.provenance } : {})}
              />
              <h3 className="mt-2 text-base font-semibold text-ink">{entry.title}</h3>
              <p className="mt-1 min-h-[3rem] text-sm text-ink-soft">{entry.fitLine}</p>
              <Button
                variant={entry.chosen ? 'primary' : 'quiet'}
                aria-pressed={entry.chosen}
                onClick={entry.choose}
                className="mt-2 self-start !px-4 text-sm"
              >
                {entry.chosen ? 'Kept' : 'Keep this'}
                <span className="sr-only"> — {entry.chooseLabel}</span>
              </Button>
              {entry.chosen ? <span className="mt-2 self-start"><Ribbon label="Your pick" /></span> : null}
            </article>
          ))}
        </div>

        <p aria-live="polite" className="sr-only">
          {garmentWinnerId && makeupWinner
            ? `Garment ${garmentSlotLabel(garmentIds.indexOf(garmentWinnerId))} and ${makeupWinner === 'bare' ? 'bare face' : (look?.name ?? 'the makeup look')} selected.`
            : 'Choose one garment and one makeup option to keep your combination.'}
        </p>

        <p className="rounded-card border border-gold/50 bg-surface px-4 py-3 text-sm text-ink">
          Apparel and makeup previews are generated separately.
        </p>
        </section>
      </div>

      <section className="flex flex-col items-center gap-3">
        {!savedLook && (!garmentWinnerId || !makeupWinner) ? (
          <p className="text-center text-sm text-ink-soft">
            Choose one garment and one makeup option to keep your combination.
          </p>
        ) : null}
        <Button className="w-full sm:w-auto" disabled={!garmentWinnerId || !makeupWinner} onClick={onSave}>
          {savedLook ? 'Look kept for this session' : 'Keep this combination'}
        </Button>
        {savedLook ? (
          <p className="text-center text-sm text-ink-soft" role="status">
            Your choice is held in this tab only. You can edit the inputs or start a new look.
          </p>
        ) : null}
        <div className="flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button variant="quiet" className="w-full sm:w-auto" onClick={onEditInputs}>Back to inputs</Button>
          <Button variant="link" className="w-full sm:w-auto" onClick={onStartOver}>Start a new look</Button>
        </div>
      </section>
    </div>
  );
}
