/**
 * Screen 4 — Analysis.
 *
 * Three named steps, never a bare spinner. The copy is soft but specific: "Reading your
 * undertone" says what the system is doing. "Consulting the mirror" would hide it, and
 * a loading state that hides the work is how a product stops being trustworthy.
 */

import { useEffect, useState } from 'react';
import { PearlDivider, SectionHeading } from '../components/ornament.js';

const STEPS = [
  { id: 'undertone', label: 'Reading your undertone' },
  { id: 'contrast', label: 'Measuring contrast' },
  { id: 'palette', label: 'Composing your palette' },
] as const;

/** ~2s per step, matching the fixture delay so the animation is always exercised. */
const STEP_DURATION_MS = 2_000;

export function AnalysisScreen({ done, onFinished }: { done: boolean; onFinished: () => void }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= STEPS.length) return;
    const timer = setTimeout(() => setActive((current) => current + 1), STEP_DURATION_MS);
    return () => clearTimeout(timer);
  }, [active]);

  // Advance only when the work has actually finished AND the three steps have been
  // seen. Neither alone is enough: finishing early would flash past the explanation,
  // and finishing late would leave a completed step list sitting there.
  useEffect(() => {
    if (done && active >= STEPS.length) onFinished();
  }, [done, active, onFinished]);

  return (
    <div className="animate-soft-fade flex min-h-[60vh] flex-col justify-center space-y-6 text-center">
      <SectionHeading>A moment at the counter</SectionHeading>

      <PearlDivider />

      <ol className="mx-auto w-full max-w-xs space-y-4 text-left" aria-live="polite">
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
        Your photograph is being read for colour only.
      </p>
    </div>
  );
}
