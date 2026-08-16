/**
 * Screen 5 — Your colours.
 *
 * Six swatches and the derivation card. The derivation renders entirely from the
 * palette's own trace — the rule key, the rule entry, the measured axes — so it cannot
 * drift out of step with the engine the way hand-written copy would.
 */

import type { AnalyzeResponse } from '@yincol/shared';
import { PearlDivider, SectionHeading } from '../components/ornament.js';
import { Button } from '../components/controls.js';

export function ColorsScreen({
  analysis,
  onContinue,
}: {
  analysis: AnalyzeResponse;
  onContinue: () => void;
}) {
  const { palette, skin, skinMode, skinUnavailableReason } = analysis;
  const { derivation } = palette;

  return (
    <div className="animate-soft-fade space-y-6">
      <header className="text-center">
        <SectionHeading>Your colours</SectionHeading>
        <p className="mt-2 text-base text-ink-soft">Six, chosen by rule.</p>
      </header>

      {/* Swatches reveal in sequence, ~80ms apart, fading in with a 4px rise. */}
      <ul className="grid grid-cols-2 gap-3">
        {palette.swatches.map((swatch, index) => (
          <li
            key={swatch.id}
            className="animate-swatch-rise overflow-hidden rounded-card border border-gold/50 bg-ground"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            {/* The swatch itself sits on plain cream — no scrim, no gradient over it. */}
            <span
              aria-hidden="true"
              className="block h-20 w-full border-b border-gold/40"
              style={{ backgroundColor: swatch.hex }}
            />
            <div className="space-y-1 px-3 py-2.5">
              {/* Never colour alone: every swatch carries a name and a hex. */}
              <p className="font-display text-lg leading-tight text-ink">{swatch.name}</p>
              <p className="font-mono text-xs uppercase text-ink-soft">{swatch.hex}</p>
              <p className="text-xs capitalize text-ink-soft">{swatch.role}</p>
              <p className="text-sm text-ink">{swatch.reason}</p>
            </div>
          </li>
        ))}
      </ul>

      <PearlDivider />

      {/* Rendered from data, not from copy. */}
      <section
        aria-labelledby="derivation-heading"
        className="rounded-card border border-gold/60 bg-surface p-5"
      >
        <SectionHeading id="derivation-heading" className="text-2xl">
          How these were chosen
        </SectionHeading>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { term: 'Undertone', value: derivation.axes.undertone },
            { term: 'Depth', value: derivation.axes.depth },
            { term: 'Contrast', value: derivation.axes.contrast },
          ].map((axis) => (
            <div key={axis.term} className="rounded-card border border-gold/40 bg-ground px-2 py-3">
              <dt className="text-xs uppercase tracking-wide text-ink-soft">{axis.term}</dt>
              <dd className="font-display text-xl capitalize text-ink">{axis.value}</dd>
            </div>
          ))}
        </dl>

        <ol className="mt-4 space-y-3 text-sm text-ink">
          {derivation.notes.map((note) => (
            <li key={note} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              {note}
            </li>
          ))}
        </ol>

        <p className="mt-4 rounded-card border border-gold/40 bg-ground px-3 py-2 text-xs text-ink-soft">
          Rule <span className="font-mono text-ink">{derivation.ruleKey}</span> of 27 · hue{' '}
          {derivation.rule.hueStart}°–{derivation.rule.hueEnd}° · lightness{' '}
          {derivation.rule.lightnessMin}–{derivation.rule.lightnessMax} · saturation ceiling{' '}
          {derivation.rule.saturationCeiling}
        </p>
      </section>

      {/*
        Appearance context, and only if it came back. Framed as context for choosing
        colour — never as an assessment of the person.
      */}
      {skin && skin.signals.length > 0 ? (
        <section
          aria-labelledby="appearance-heading"
          className="rounded-card border border-gold/50 bg-ground p-5"
        >
          <h3 id="appearance-heading" className="font-display text-2xl text-ink">
            A little more context
          </h3>
          {skinMode === 'live' ? (
            <p className="mt-2 text-xs text-ink-soft">
              Skin appearance context from the live Skin Analysis API. The palette and previews
              remain fixture-backed until Facial Color Tone is verified.
            </p>
          ) : null}
          <ul className="mt-3 space-y-3">
            {skin.signals.map((signal) => (
              <li key={signal.id}>
                <p className="text-sm font-semibold text-ink">
                  {signal.label} — <span className="capitalize font-normal">{signal.band}</span>
                </p>
                <p className="text-sm text-ink-soft">{signal.note}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {skinUnavailableReason ? (
        <p className="text-sm text-ink-soft">{skinUnavailableReason} Your palette is unaffected.</p>
      ) : null}

      <Button className="w-full" onClick={onContinue}>
        See it on
      </Button>
    </div>
  );
}
