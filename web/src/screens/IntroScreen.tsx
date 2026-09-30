/**
 * Screen 1 — Intro.
 *
 * The value promise, a focused comparison guide, and an explicit consent panel that
 * says what is analysed, where it is stored, and how to delete it. Consent is asked
 * for once, plainly, before a photograph is chosen — not buried in a footer afterwards.
 */

import { SectionHeading, YincolCard } from '../components/ornament.js';
import { Button } from '../components/controls.js';
import type { ReactNode } from 'react';
import { storageSentence } from '../config/privacyCopy.js';

function WhatYouGet() {
  return (
    <YincolCard aria-labelledby="get-heading" tone="surface" className="p-6">
      <SectionHeading id="get-heading" className="text-2xl">
        What you&apos;ll get
      </SectionHeading>
      <ul className="mt-6 space-y-4 text-base text-ink">
        <li className="flex gap-3">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
          A six-colour direction with the rule shown.
        </li>
        <li className="flex gap-3">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
          Two garment previews, with and without makeup.
        </li>
        <li className="flex gap-3">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
          Completed previews saved on this browser to revisit and download.
        </li>
      </ul>
    </YincolCard>
  );
}

function ComparisonGuide() {
  return (
    <YincolCard
      aria-labelledby="comparison-heading"
      className="p-6"
    >
      <SectionHeading id="comparison-heading" className="text-2xl">
        How you&apos;ll compare
      </SectionHeading>
      <p className="mt-3 text-base text-ink-soft">
        Compare one choice at a time.
      </p>

      <div className="mt-6 space-y-3 text-base" aria-label="Comparison structure">
        <div className="rounded-card border border-gold/40 bg-surface px-4 py-3">
          <span className="font-semibold text-ink">The preview portrait</span>
          <span className="ml-2 text-ink-soft">stays the same</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="rounded-card border border-gold/40 px-3 py-3 text-center text-ink">Garment A</span>
          <span aria-hidden="true" className="text-ink-soft">vs</span>
          <span className="rounded-card border border-gold/40 px-3 py-3 text-center text-ink">Garment B</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="rounded-card border border-gold/40 px-3 py-3 text-center text-ink">Original portrait</span>
          <span aria-hidden="true" className="text-ink-soft">vs</span>
          <span className="rounded-card border border-gold/40 px-3 py-3 text-center text-ink">With makeup</span>
        </div>
      </div>

    </YincolCard>
  );
}

export function IntroScreen({
  onBeginDemo,
  onBeginLive,
  resuming,
  previousLooks,
  imagesLeaveTab,
}: {
  onBeginDemo: () => void;
  onBeginLive: () => void;
  resuming: boolean;
  previousLooks: ReactNode;
  imagesLeaveTab: boolean | null;
}) {
  return (
    <div className="animate-soft-fade space-y-8">
      <header className="mx-auto max-w-3xl text-center">
        <SectionHeading className="text-4xl sm:text-5xl">Choose a look with confidence</SectionHeading>
        <p className="mx-auto mt-4 max-w-reading text-lg text-ink">
          One portrait, two garments, and a makeup direction — compared in one focused session.
        </p>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(220px,0.75fr)_minmax(560px,1.8fr)_minmax(300px,1fr)] xl:items-start">
        {/* Consent is first in the source order so the mobile journey starts with the primary action. */}
        <YincolCard
          aria-labelledby="consent-heading"
          className="p-6 shadow-card xl:col-start-2 xl:row-start-1"
        >
          <SectionHeading id="consent-heading" className="text-2xl">
            Before we begin
          </SectionHeading>
          <p className="mt-3 text-lg text-ink-soft">
            Try the demo for saved example results with no upload, or add your own photos.
            Each result identifies whether it is a saved demo or generated from your uploads.
          </p>
          <dl className="mt-5 space-y-4 text-base">
            <div>
              <dt className="font-semibold text-ink">How the comparison works</dt>
              <dd className="text-ink-soft">
                {imagesLeaveTab === false
                  ? 'Example colour readings and saved previews show a demo subject. Your selected photos do not change these results and are not analysed.'
                  : 'The palette follows a visible colour rule. Results identify saved examples and any live previews separately.'}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Where it is stored</dt>
              <dd className="text-ink-soft">
                {storageSentence(imagesLeaveTab)}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Deleting it</dt>
              <dd className="text-ink-soft">
                Use “Remove photos and saved results” wherever your photograph appears to clear
                your current inputs and all saved looks from this browser. You can also delete individual looks from Previous looks.
              </dd>
            </div>
          </dl>

          <p className="mt-5 text-sm text-ink-soft">
            YINCOL describes how colours look on you. It is not a health or skincare
            assessment and makes no claims about your skin.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="quiet" className="w-full sm:w-auto" onClick={onBeginDemo}>
              Try the demo
            </Button>
            <Button className="w-full sm:w-auto" onClick={onBeginLive}>
              {resuming ? 'Continue with your inputs' : 'Try your photos'}
            </Button>
          </div>
    </YincolCard>

        <aside
          aria-label="What to expect"
          className="space-y-6 xl:col-start-3 xl:row-start-1"
        >
          <WhatYouGet />
          <ComparisonGuide />
        </aside>

        {previousLooks}
      </div>
    </div>
  );
}
