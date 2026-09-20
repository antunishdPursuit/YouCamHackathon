import { useId, useRef, useState, type ReactNode } from 'react';
import type { DisplaySlotConfig } from '../config/displaySlots.js';
import { Button } from './controls.js';
import { PhotoSlot } from './PhotoSlot.js';
import { GARMENT_A_MOTION_URL } from './motionSample.js';

/** A captured, silent video. Playback always requires an explicit user action. */
export function MotionPreview({ imageUrl, alt, slot, aspectRatio, children }: {
  imageUrl: string;
  alt: string;
  slot: DisplaySlotConfig;
  aspectRatio: string;
  children: ReactNode;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  const [showVideo, setShowVideo] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const showStill = () => {
    video.current?.pause();
    setShowVideo(false);
    setLoading(false);
  };
  const fail = () => {
    showStill();
    setFailed(true);
  };
  const play = (restart = false) => {
    const element = video.current;
    if (!element) return;
    if (restart || element.ended || !showVideo) element.currentTime = 0;
    setShowVideo(true);
    setEnded(false);
    setLoading(true);
    void element.play().catch((error: unknown) => {
      // Returning to the still can cancel a pending play request.
      if (!(error instanceof DOMException && error.name === 'AbortError')) fail();
    });
  };

  return (
    <div>
      {!showVideo ? (
        <PhotoSlot slot={slot} aspectRatio={aspectRatio} showProvenance={false}
          result={{ status: 'ready', imageUrl, alt }} />
      ) : null}
      <div hidden={!showVideo}
        className="overflow-hidden rounded-card border border-gold/60 bg-ground"
        style={{ aspectRatio }}>
        <video ref={video} src={GARMENT_A_MOTION_URL} poster={imageUrl}
          preload="none" muted playsInline
          aria-label="Garment A natural-motion sample" aria-describedby={descriptionId}
          className="h-full w-full object-contain"
          onPlaying={() => { setPlaying(true); setLoading(false); }}
          onPause={() => { setPlaying(false); setLoading(false); }}
          onEnded={() => { setEnded(true); setPlaying(false); setLoading(false); }}
          onWaiting={() => setLoading(true)}
          onError={fail} />
      </div>
      {children}
      <p id={descriptionId} className="mt-2 text-center text-sm text-ink-soft">
        Generated motion sample · 5 seconds. Her head and shoulders turn, then she smiles.
        Use the original still to compare colour and detail.
      </p>
      {failed ? (
        <p role="status" className="mt-2 text-center text-sm text-ink-soft">
          Motion could not play. The original still is available.
        </p>
      ) : (
        <div ref={controls} role="group" aria-label="Garment A motion controls"
          className="mt-3 flex flex-wrap justify-center gap-2">
          <Button variant="quiet" className="!px-4 text-sm" disabled={loading}
            onClick={() => playing ? video.current?.pause() : play()}>
            {loading ? 'Loading motion…' : playing ? 'Pause motion' : ended && showVideo ? 'Replay motion' : showVideo ? 'Resume motion' : 'Play motion'}
          </Button>
          {showVideo ? <>
            {!ended ? <Button variant="quiet" className="!px-4 text-sm" onClick={() => play(true)} disabled={loading}>Replay</Button> : null}
            <Button variant="quiet" className="!px-4 text-sm" onClick={() => {
              showStill();
              requestAnimationFrame(() => controls.current?.querySelector('button')?.focus());
            }}>Show still</Button>
          </> : null}
        </div>
      )}
      <p role="status" className="sr-only">{showVideo && loading ? 'Loading motion sample.' : ''}</p>
    </div>
  );
}
