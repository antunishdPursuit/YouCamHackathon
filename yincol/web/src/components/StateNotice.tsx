/**
 * The designed states.
 *
 * A state screen is not an error page with a sad face. It says what happened, what it
 * means for the shopper, and what they can do — in that order, in plain sentences, on
 * the same cream ground as everything else.
 *
 * No state here blames the person in the photograph.
 */

import type { ReactNode } from 'react';
import { GildedFrame } from './ornament.js';
import { Button } from './controls.js';

export function StateNotice({
  title,
  body,
  action,
  actionLabel,
  secondary,
  tone = 'quiet',
  children,
}: {
  title: string;
  body: string;
  action?: () => void;
  actionLabel?: string;
  secondary?: ReactNode;
  /** `quiet` for informational, `attention` for something that blocks progress. */
  tone?: 'quiet' | 'attention';
  children?: ReactNode;
}) {
  return (
    <GildedFrame
      as="section"
      className={`p-5 ${tone === 'attention' ? 'bg-powder' : 'bg-surface'}`}
    >
      <div role={tone === 'attention' ? 'alert' : undefined}>
        <h3 className="font-display text-2xl leading-tight text-ink">{title}</h3>
        <p className="mt-2 text-base text-ink">{body}</p>
        {children}
        {action && actionLabel ? (
          <Button variant={tone === 'attention' ? 'quiet' : 'primary'} className="mt-4 w-full" onClick={action}>
            {actionLabel}
          </Button>
        ) : null}
        {secondary ? <div className="mt-3">{secondary}</div> : null}
      </div>
    </GildedFrame>
  );
}

/**
 * Shown when some previews came back and others did not.
 *
 * The point is reassurance: one failure out of four does not invalidate the other
 * three, and the shopper should not be left wondering whether to start again.
 */
export function PartialResultsNotice({ failedLabels }: { failedLabels: readonly string[] }) {
  if (failedLabels.length === 0) return null;

  const list =
    failedLabels.length === 1
      ? failedLabels[0]
      : `${failedLabels.slice(0, -1).join(', ')} and ${failedLabels[failedLabels.length - 1]}`;

  return (
    <p
      role="status"
      className="rounded-card border border-gold/50 bg-surface px-4 py-3 text-sm text-ink"
    >
      We could not generate {list}. Everything else on this screen is ready, and your
      palette is unaffected — you can carry on comparing what did come back.
    </p>
  );
}
