/**
 * The persistent privacy affordance.
 *
 * CONSENT IS PERSISTENT. This stays visible on every screen that shows the portrait,
 * and its delete is real: it clears the photograph and everything derived from it, not
 * just the picture on screen. A delete that leaves the palette behind would be a
 * gesture, not a deletion.
 */

import { useState } from 'react';
import { Button } from './controls.js';

export function PrivacyBar({ onDelete }: { onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-card border border-gold/50 bg-surface px-5 py-4">
      {confirming ? (
        <div className="space-y-2">
          <p className="text-sm text-ink">
            Remove your photo and results?
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1 !px-3 text-sm"
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              Delete it
            </Button>
            <Button
              variant="quiet"
              className="flex-1 !px-3 text-sm"
              onClick={() => setConfirming(false)}
            >
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-soft">
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="mr-1 inline-block h-3.5 w-3.5 align-[-2px] text-gold"
            >
              <path
                d="M 8 1.6 L 13.6 4 v 4 c 0 3.2 -2.4 5.6 -5.6 6.4 C 4.8 13.6 2.4 11.2 2.4 8 V 4 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
              />
            </svg>
            Your photograph stays in this tab. No account, no database.
          </p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="min-h-[44px] rounded-full px-3 text-sm font-semibold text-ink underline underline-offset-4"
          >
            Remove photo and results
          </button>
        </div>
      )}
    </div>
  );
}
