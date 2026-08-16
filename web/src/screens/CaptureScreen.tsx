/**
 * Screen 2 — Capture.
 *
 * Upload or camera, framing guidance, and a quality check that runs BEFORE anything is
 * submitted. Catching a too-small photograph in the browser costs a sentence; catching
 * it at the API costs a call, a wait, and a worse message.
 */

import { useRef, useState } from 'react';
import { checkImageDimensions, IMAGE_SPEC, type ImageCheck } from '@yincol/shared';
import { ArchPanel, PearlDivider, SectionHeading } from '../components/ornament.js';
import { Button } from '../components/controls.js';
import { PhotoSlot } from '../components/PhotoSlot.js';
import { DISPLAY_SLOTS } from '../config/displaySlots.js';
import type { CapturedPortrait } from '../state/session.js';

const GUIDANCE = [
  'One person, upper body in frame.',
  'Face fills most of the frame — more than 60% of the image width.',
  'A plain, uncluttered background.',
  'Even light from the front — no strong shadow across the face.',
  'A bare face, so the makeup preview has somewhere to go.',
];

export function CaptureScreen({
  portrait,
  onPortrait,
  onContinue,
}: {
  portrait: CapturedPortrait | null;
  onPortrait: (portrait: CapturedPortrait) => void;
  onContinue: () => void;
}) {
  const [check, setCheck] = useState<ImageCheck | null>(null);
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;

    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      setCheck({
        code: 'unsupportedType',
        usable: false,
        message: 'Please choose a JPEG or PNG photograph for live analysis.',
      });
      return;
    }

    if (file.size >= IMAGE_SPEC.maxFileBytesExclusive) {
      setCheck({
        code: 'fileTooLarge',
        usable: false,
        message: 'That file is too large. Please choose an image smaller than 10 MB.',
      });
      return;
    }

    setReading(true);

    const previewUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const verdict = checkImageDimensions(image.naturalWidth, image.naturalHeight);
      setCheck(verdict);
      setReading(false);

      if (!verdict.usable) {
        // Nothing is kept if it cannot be used — release the object URL rather than
        // leaving a photograph the shopper thinks they discarded.
        URL.revokeObjectURL(previewUrl);
        return;
      }

      onPortrait({
        previewUrl,
        file,
        width: image.naturalWidth,
        height: image.naturalHeight,
        ...(verdict.code === 'belowHd' ? { note: verdict.message } : {}),
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      setReading(false);
      setCheck({
        code: 'tooSmall',
        usable: false,
        message: 'That file could not be read as a photograph. Please try another.',
      });
    };

    image.src = previewUrl;
  };

  return (
    <div className="animate-soft-fade space-y-6">
      <header className="text-center">
        <SectionHeading>Your photograph</SectionHeading>
        <p className="mt-2 text-base text-ink-soft">
          One picture is all this needs.
        </p>
      </header>

      <ArchPanel>
        <div className="mx-auto max-w-[16rem]">
          <PhotoSlot
            slot={DISPLAY_SLOTS.portrait}
            result={
              portrait
                ? {
                    status: 'ready',
                    imageUrl: portrait.previewUrl,
                    alt: 'The photograph you chose',
                  }
                : undefined
            }
          />
        </div>
      </ArchPanel>

      {/* The quality check speaks in plain sentences, never in error codes. */}
      <div aria-live="polite" className="min-h-[1.5rem]">
        {reading ? <p className="text-center text-sm text-ink-soft">Reading your photograph…</p> : null}
        {check && !reading ? (
          <p
            className={`rounded-card border px-4 py-3 text-center text-sm ${
              check.usable
                ? 'border-gold/50 bg-surface text-ink'
                : 'border-gold/60 bg-powder text-ink'
            }`}
          >
            {check.usable && check.code === 'ok' ? 'This photograph is a good size.' : check.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/jpeg,image/png"
          capture="user"
          className="sr-only"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        <Button onClick={() => fileInput.current?.click()}>
          {portrait ? 'Choose a different photograph' : 'Choose a photograph'}
        </Button>
        <Button variant="quiet" onClick={() => cameraInput.current?.click()}>
          Take one now
        </Button>
      </div>

      <PearlDivider />

      <section aria-labelledby="framing-heading">
        <h3 id="framing-heading" className="font-display text-xl text-ink">
          What works best
        </h3>
        <ul className="mt-2 space-y-2 text-base text-ink-soft">
          {GUIDANCE.map((line) => (
            <li key={line} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      <Button className="w-full" disabled={!portrait} onClick={onContinue}>
        Continue to the rail
      </Button>

      {/*
        The app has to be walkable before anyone has shot a photograph — that is the
        whole point of the designed empty state. This path says plainly what it does
        rather than pretending a placeholder is a portrait.
      */}
      {!portrait ? (
        <div className="rounded-card border border-gold/40 bg-surface px-4 py-3 text-center">
          <p className="text-sm text-ink-soft">
            No photograph to hand? Walk the whole flow on the placeholder portrait — every
            preview will be marked as a placeholder rather than a result.
          </p>
          <Button variant="quiet" className="mt-3 w-full text-sm" onClick={onContinue}>
            Continue without a photograph
          </Button>
        </div>
      ) : null}
    </div>
  );
}
