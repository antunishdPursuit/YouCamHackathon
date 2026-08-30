import { Button } from './controls.js';
import { GildedFrame } from './ornament.js';

export type BackendReadiness = 'checking' | 'starting' | 'ready' | 'delayed';

export function BackendStatus({
  readiness,
  onRetry,
}: {
  readiness: BackendReadiness;
  onRetry: () => void;
}) {
  if (readiness === 'ready') return null;

  if (readiness === 'checking') {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mb-6 rounded-card border border-gold/40 bg-surface px-5 py-4 text-base text-ink-soft"
      >
        Connecting to the studio…
      </p>
    );
  }

  if (readiness === 'starting') {
    return (
      <GildedFrame as="section" className="mb-6 bg-sky p-5 sm:p-6">
        <div role="status" aria-live="polite">
          <h2 className="font-display text-2xl leading-tight text-ink">The studio is warming up.</h2>
          <p className="mt-2 text-base text-ink">
            This free demo may take up to a minute to wake. You can add your inputs while it gets ready.
          </p>
        </div>
      </GildedFrame>
    );
  }

  return (
    <GildedFrame as="section" className="mb-6 bg-powder p-5 sm:p-6">
      <div role="alert">
        <h2 className="font-display text-2xl leading-tight text-ink">
          The studio is taking longer than expected.
        </h2>
        <p className="mt-2 text-base text-ink">
          Please try again. Your photograph will stay in this tab until the server is ready.
        </p>
        <Button variant="quiet" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </GildedFrame>
  );
}
