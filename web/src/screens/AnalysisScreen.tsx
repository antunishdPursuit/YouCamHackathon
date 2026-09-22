/** Stage 3: statuses follow requests, never an elapsed-time simulation. */
import { useEffect } from 'react';
import { Button } from '../components/controls.js';
import { PearlDivider, SectionHeading } from '../components/ornament.js';

export function AnalysisScreen({
  done, cached = false, imagesLeaveTab, onFinished, fullBody, phase, failed, onBack,
}: {
  done: boolean;
  cached?: boolean;
  imagesLeaveTab: boolean | null;
  fullBody: boolean;
  phase: 'checking' | 'analysis' | 'previews';
  failed: boolean;
  onFinished: () => void;
  onBack: () => void;
}) {
  useEffect(() => { if (done && !failed) onFinished(); }, [done, failed, onFinished]);
  const steps = [
    { label: 'Checking your inputs', finished: phase !== 'checking', active: phase === 'checking' },
    { label: 'Preparing colour and appearance context', finished: phase === 'previews', active: phase === 'analysis' },
    { label: imagesLeaveTab === false ? 'Loading saved demo previews' : 'Generating close-up garments and makeup',
      finished: done, active: phase === 'previews' },
    ...(fullBody ? [{ label: 'Generating full-body outfits and makeup', finished: done, active: phase === 'previews' }] : []),
  ];
  return (
    <div className="animate-soft-fade flex min-h-[60vh] flex-col justify-center space-y-6 text-center">
      <SectionHeading className="text-4xl">
        {failed ? 'Generation stopped' : cached ? 'Using your saved previews' : imagesLeaveTab === false ? 'Loading demo previews' : 'Generating your previews'}
      </SectionHeading>
      <PearlDivider />
      <ol className="mx-auto w-full max-w-sm space-y-4 text-left" aria-live="polite">
        {steps.map(step => <li key={step.label} className="space-y-2">
          <p className="text-base font-semibold text-ink">{step.label}</p>
          <p className="text-sm text-ink-soft">
            {step.finished ? 'Finished' : failed ? 'Stopped' : step.active ? 'In progress' : 'Waiting'}
          </p>
        </li>)}
      </ol>
      {fullBody && !failed ? <p className="mx-auto max-w-reading text-sm text-ink-soft">
        Your full-body photo, trousers, and two tops are used for the outfit previews.
        Both views will appear in Results when generation finishes.
      </p> : null}
      {failed ? <div><Button variant="quiet" onClick={onBack}>Back to inputs</Button></div> : null}
      {cached ? <p className="text-sm text-ink-soft">These previews are reused from this session without another generation.</p> : null}
    </div>
  );
}
