/**
 * Screen 1 — Intro.
 *
 * The value promise, a sample look card, and an explicit consent panel that says what
 * is analysed, where it is stored, and how to delete it. Consent is asked for once,
 * plainly, before a photograph is chosen — not buried in a footer afterwards.
 */

import { ArchPanel, PearlDivider, Ribbon, SectionHeading, Wordmark } from '../components/ornament.js';
import { Button } from '../components/controls.js';
import type { SavedLook } from '../state/session.js';

const SAMPLE_SWATCHES = [
  { hex: '#f6e0da', name: 'Peach Blossom Dusk' },
  { hex: '#e7b878', name: 'Gilded Apricot' },
  { hex: '#c1ae9c', name: 'Ivory Knight' },
];

/**
 * The kept-looks shelf.
 *
 * Empty is the normal state, not a failure — there is no database, so a new visitor
 * always starts here. It is drawn as a designed shelf with nothing on it rather than
 * hidden, because hiding it would make the feature invisible until it happened to work.
 */
function KeptLooks({ savedLooks }: { savedLooks: readonly SavedLook[] }) {
  return (
    <section aria-labelledby="kept-heading" className="rounded-card border border-gold/50 bg-ground p-5">
      <h3 id="kept-heading" className="font-display text-2xl text-ink">
        Looks you kept
      </h3>

      {savedLooks.length === 0 ? (
        <div className="mt-3 rounded-card border border-dashed border-gold/50 px-4 py-6 text-center">
          <svg viewBox="0 0 60 60" aria-hidden="true" className="mx-auto h-10 w-10 text-gold">
            <path
              d="M 14 46 L 14 22 a 16 16 0 0 1 32 0 L 46 46 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <circle cx="30" cy="18" r="2.4" fill="currentColor" opacity="0.6" />
          </svg>
          <p className="mt-2 text-base text-ink">Nothing kept yet.</p>
          <p className="mt-1 text-sm text-ink-soft">
            Looks you keep will sit here for as long as this tab stays open.
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {savedLooks.map((look) => (
            <li
              key={look.id}
              className="flex items-center gap-3 rounded-card border border-gold/40 bg-surface px-3 py-2.5"
            >
              <span className="flex shrink-0 gap-1" aria-hidden="true">
                {look.swatchHexes.map((hex) => (
                  <span
                    key={hex}
                    className="h-5 w-5 rounded-full border border-gold/50"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </span>
              <span className="flex-1 text-sm text-ink">
                <span className="font-semibold">{look.garmentName}</span> · {look.makeupName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function IntroScreen({
  onBegin,
  savedLooks,
}: {
  onBegin: () => void;
  savedLooks: readonly SavedLook[];
}) {
  return (
    <div className="animate-soft-fade space-y-6">
      <header className="flex flex-col items-center pt-2 text-center">
        <Wordmark size="lg" />
        <p className="mt-4 max-w-[34ch] text-lg text-ink">
          One photograph, two garments, one makeup look — and a decision you can keep.
        </p>
      </header>

      <ArchPanel>
        <div className="mx-auto max-w-sm text-center">
          <SectionHeading className="text-2xl">What you will get</SectionHeading>
          <ul className="mt-4 space-y-3 text-left text-base text-ink">
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              Six colours chosen for you by a rule you can read, not a guess.
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              The same face two ways at a time, so choosing is comparing.
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              A look card of the combination you kept.
            </li>
          </ul>
        </div>
      </ArchPanel>

      <PearlDivider />

      {/* Sample look card — a taste of the artifact, not a real reading. */}
      <section
        aria-label="Example look card"
        className="rounded-card border border-gold/60 bg-surface p-4 shadow-card"
      >
        <div className="flex items-center justify-between">
          <Wordmark size="sm" />
          <Ribbon label="Example" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div
            aria-hidden="true"
            className="h-16 w-12 shrink-0 rounded-lg border border-gold/50 bg-ground"
          />
          <div className="flex-1">
            <p className="font-display text-xl text-ink">Rosewater cardigan · Rose Veil</p>
            <p className="text-sm text-ink-soft">4 of 6 palette colours within ΔE 25.</p>
            <ul className="mt-2 flex gap-2" aria-label="Three colours from the example palette">
              {SAMPLE_SWATCHES.map((swatch) => (
                <li key={swatch.hex} className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full border border-gold/50"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <span className="text-xs text-ink-soft">{swatch.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <PearlDivider />

      <KeptLooks savedLooks={savedLooks} />

      <PearlDivider />

      {/* Consent — explicit, specific, and before anything is chosen. */}
      <section
        aria-labelledby="consent-heading"
        className="rounded-card border border-gold/60 bg-ground p-5"
      >
        <SectionHeading id="consent-heading" className="text-2xl">
          Before we begin
        </SectionHeading>
        <dl className="mt-3 space-y-3 text-base">
          <div>
            <dt className="font-semibold text-ink">What is analysed</dt>
            <dd className="text-ink-soft">
              The colours in your photograph — your skin, hair, eyes and lips — and how
              light or deep they are. Nothing else is read from it.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Where it is stored</dt>
            <dd className="text-ink-soft">
              In this browser tab only, for as long as it stays open. There is no account
              and no database. Closing the tab ends it.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Deleting it</dt>
            <dd className="text-ink-soft">
              A delete link stays on every screen that shows your photograph. One tap
              removes the photograph and everything derived from it.
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-sm text-ink-soft">
          YINCOL describes how colours look on you. It is not a health or skincare
          assessment and makes no claims about your skin.
        </p>

        <Button className="mt-5 w-full" onClick={onBegin}>
          I understand — choose a photograph
        </Button>
      </section>
    </div>
  );
}
