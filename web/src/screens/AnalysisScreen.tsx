/**
 * Stage 3 — Generate.
 *
 * Four named steps, never a bare spinner. The user can see what is being checked and
 * generated while the local API proxy completes both analysis and try-on requests.
 */

import { useEffect, useState } from 'react';
import { PearlDivider, SectionHeading } from '../components/ornament.js';

const STEPS = [
  { id: 'images', label: 'Checking your images' },
  { id: 'colour', label: 'Reading your colour context' },
  { id: 'garments', label: 'Generating garment previews' },
  // Second, and on purpose: the makeup step runs on the garment previews, not on the
  // portrait. The order on screen is the order of the work.
  { id: 'makeup', label: 'Applying your makeup to each preview' },
] as const;

/** Keep the explanation visible while the fixture delay is exercised. */
const STEP_DURATION_MS = 1_200;

export function AnalysisScreen({
  done,
  cached = false,
  onFinished,
}: {
  done: boolean;
  cached?: boolean;
  onFinished: () => void;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (cached) {
      setActive(STEPS.length);
      return;
    }
    if (active >= STEPS.length) return;
    const timer = setTimeout(() => setActive((current) => current + 1), STEP_DURATION_MS);
    return () => clearTimeout(timer);
  }, [active, cached]);

  // Advance only when the work has actually finished AND the three steps have been
  // seen. Neither alone is enough: finishing early would flash past the explanation,
  // and finishing late would leave a completed step list sitting there.
  useEffect(() => {
    if (done && active >= STEPS.length) onFinished();
  }, [done, active, onFinished]);

  return (
    <div className="animate-soft-fade flex min-h-[60vh] flex-col justify-center space-y-6 text-center">
      <SectionHeading className="text-4xl">
        {cached ? 'Using your saved previews' : 'Generating your previews'}
      </SectionHeading>

      <PearlDivider />

      <ol className="mx-auto w-full max-w-sm space-y-4 text-left" aria-live="polite">
        {STEPS.map((step, index) => {
          const state = index < active ? 'done' : index === active ? 'active' : 'waiting';
          return (
            <li key={step.id} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                  state === 'waiting' ? 'border-gold/40' : 'border-gold bg-surface'
                }`}
              >
                {state === 'done' ? (
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ink" aria-hidden="true">
                    <path
                      d="M 3 8.5 L 6.5 12 L 13 4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : state === 'active' ? (
                  <span className="h-2 w-2 rounded-full bg-gold" />
                ) : null}
              </span>
              <span
                className={`text-base ${state === 'waiting' ? 'text-ink-soft' : 'font-semibold text-ink'}`}
              >
                {step.label}
                {/* State in words, so it is not signalled by tint alone. */}
                <span className="sr-only">
                  {state === 'done' ? ' — finished' : state === 'active' ? ' — in progress' : ' — waiting'}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-sm text-ink-soft">
        {cached
          ? 'These previews are reused from this session, so the same inputs are not sent again.'
          : 'Your files stay in this tab while the preview work runs.'}
      </p>
    </div>
  );
}
