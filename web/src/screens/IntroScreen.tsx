/**
 * Screen 1 — Intro.
 *
 * The value promise, a focused comparison guide, and an explicit consent panel that
 * says what is analysed, where it is stored, and how to delete it. Consent is asked
 * for once, plainly, before a photograph is chosen — not buried in a footer afterwards.
 */

import { SectionHeading, YincolCard } from '../components/ornament.js';
import { Button } from '../components/controls.js';
import { findMakeupLook } from '@yincol/shared';

/**
 * The kept-options shelf.
 *
 * Empty is the normal state, not a failure — there is no database, so a new visitor
 * always starts here. It stays visible as a compact session shelf so a returning user
 * can find kept options without searching through the page.
 */
function KeptLooks({
  garmentIds,
  keptGarmentIds,
  keptMakeupWinners,
  makeupLookId,
  className = '',
}: {
  garmentIds: readonly string[];
  keptGarmentIds: readonly string[];
  keptMakeupWinners: readonly ('bare' | 'madeUp')[];
  makeupLookId: string | null;
  className?: string;
}) {
  const keptOptions = [
    ...keptGarmentIds.map((garmentId) => {
      const index = garmentIds.indexOf(garmentId);
      return {
        id: `garment:${garmentId}`,
        label: index === 0 ? 'Garment A' : index === 1 ? 'Garment B' : 'Garment option',
      };
    }),
    ...keptMakeupWinners.map((winner) => ({
      id: `makeup:${winner}`,
      label: winner === 'bare'
        ? 'Bare face'
        : (makeupLookId ? findMakeupLook(makeupLookId)?.name : undefined) ?? 'Makeup look',
    })),
  ];

  return (
    <YincolCard
      aria-labelledby="kept-heading"
      className={`p-6 ${className}`}
    >
      <h3 id="kept-heading" className="font-display text-2xl text-ink">
        Looks kept
      </h3>
      <p className="mt-1 text-sm text-ink-soft">Your kept options for this session.</p>

      {keptOptions.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-gold/50 px-4 py-8 text-center">
          <svg viewBox="0 0 60 60" aria-hidden="true" className="mx-auto h-10 w-10 text-gold">
            <path
              d="M 14 46 L 14 22 a 16 16 0 0 1 32 0 L 46 46 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <circle cx="30" cy="18" r="2.4" fill="currentColor" opacity="0.6" />
          </svg>
          <p className="mt-2 text-base text-ink">Nothing kept in this session.</p>
          <p className="mt-1 text-sm text-ink-soft">Keep an option and it will appear here while this tab stays open.</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {keptOptions.map((option) => (
            <li
              key={option.id}
              className="flex items-center gap-3 rounded-card border border-gold/40 bg-surface px-4 py-3"
            >
              <span aria-hidden="true" className="text-gold">✓</span>
              <span className="flex-1 text-sm text-ink">
                {option.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </YincolCard>
  );
}

function WhatYouGet() {
  return (
    <YincolCard aria-labelledby="get-heading" tone="surface" className="p-6">
      <SectionHeading id="get-heading" className="text-2xl">
        What you&apos;ll get
      </SectionHeading>
      <p className="mt-3 text-base text-ink-soft">
        A short, explainable comparison built from your portrait and two garment references.
      </p>
      <ul className="mt-6 space-y-4 text-base text-ink">
        <li className="flex gap-3">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
          A six-colour direction with the rule shown.
        </li>
        <li className="flex gap-3">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
          Two garment previews of the same portrait.
        </li>
        <li className="flex gap-3">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
          One preview using the configured makeup look.
        </li>
        <li className="flex gap-3">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
          Options you can keep individually for this session.
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
        Your portrait stays the same while you compare one choice at a time.
      </p>

      <div className="mt-6 space-y-3 text-base" aria-label="Comparison structure">
        <div className="rounded-card border border-gold/40 bg-surface px-4 py-3">
          <span className="font-semibold text-ink">Your portrait</span>
          <span className="ml-2 text-ink-soft">stays the same</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="rounded-card border border-gold/40 px-3 py-3 text-center text-ink">Garment A</span>
          <span aria-hidden="true" className="text-gold">or both</span>
          <span className="rounded-card border border-gold/40 px-3 py-3 text-center text-ink">Garment B</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="rounded-card border border-gold/40 px-3 py-3 text-center text-ink">Bare face</span>
          <span aria-hidden="true" className="text-gold">or both</span>
          <span className="rounded-card border border-gold/40 px-3 py-3 text-center text-ink">Makeup look</span>
        </div>
      </div>

      <p className="mt-5 text-sm text-ink-soft">
        This is the comparison map, not a generated result. Previews appear after you add your inputs.
      </p>
    </YincolCard>
  );
}

export function IntroScreen({
  onBegin,
  garmentIds,
  keptGarmentIds,
  keptMakeupWinners,
  makeupLookId,
}: {
  onBegin: () => void;
  garmentIds: readonly string[];
  keptGarmentIds: readonly string[];
  keptMakeupWinners: readonly ('bare' | 'madeUp')[];
  makeupLookId: string | null;
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
            Add one portrait and two garment references. We&apos;ll use them to make a focused comparison.
          </p>
          <dl className="mt-5 space-y-4 text-base">
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

          <p className="mt-5 text-sm text-ink-soft">
            YINCOL describes how colours look on you. It is not a health or skincare
            assessment and makes no claims about your skin.
          </p>

          <Button className="mt-6 w-full" onClick={onBegin}>
            Start with a photo
          </Button>
    </YincolCard>

        <aside
          aria-label="What to expect"
          className="space-y-6 xl:col-start-3 xl:row-start-1"
        >
          <WhatYouGet />
          <ComparisonGuide />
        </aside>

        <KeptLooks
          garmentIds={garmentIds}
          keptGarmentIds={keptGarmentIds}
          keptMakeupWinners={keptMakeupWinners}
          makeupLookId={makeupLookId}
          className="xl:col-start-1 xl:row-start-1"
        />
      </div>
    </div>
  );
}
