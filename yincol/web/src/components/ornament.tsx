/**
 * The ornament vocabulary.
 *
 * Fairytale beauty counter: antique vanity table, embossed compact lids, ribbons and
 * pearls, a gilt-edged storybook. Everything here is decoration drawn in gold hairlines
 * — about three ornamental moments per screen and no more, or it stops reading as
 * restraint and starts reading as clutter.
 *
 * TWO-ZONE COLOUR RULE, enforced by construction: ornament frames content from the
 * OUTSIDE. Nothing in this file paints a tint, gradient, scrim, glow or shadow across a
 * container that holds a photograph, a garment or a swatch. Those interiors stay cream.
 */

import type { ReactNode } from 'react';

/** Small gold corner flourish. Four of these make a frame feel hand-set. */
function CornerFlourish({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none absolute h-5 w-5 text-gold ${className}`}
    >
      <path
        d="M 2 38 L 2 14 Q 2 2 14 2 L 38 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </svg>
  );
}

/**
 * A hairline gold frame with corner flourishes.
 *
 * The frame is drawn on the wrapper; the interior it wraps keeps whatever ground it
 * had. That is what keeps photographs and swatches sitting on plain cream.
 */
export function GildedFrame({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <Tag className={`relative rounded-card border border-gold/60 ${className}`}>
      <CornerFlourish className="left-1 top-1" />
      <CornerFlourish className="right-1 top-1 rotate-90" />
      <CornerFlourish className="bottom-1 right-1 rotate-180" />
      <CornerFlourish className="bottom-1 left-1 -rotate-90" />
      {children}
    </Tag>
  );
}

/**
 * An arched top edge, like a vanity mirror or a chapel window. Used on hero containers
 * only — one per screen at most.
 */
export function ArchPanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`relative border border-gold/50 bg-surface px-5 pb-6 pt-8 shadow-card ${className}`}
      style={{ borderRadius: '140px 140px 20px 20px' }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 top-3 bottom-3 border border-gold/30"
        style={{ borderRadius: '128px 128px 14px 14px' }}
      />
      {children}
    </section>
  );
}

/** Pearl-dot divider between sections. */
export function PearlDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-4 ${className}`} aria-hidden="true">
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold/60" />
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="rounded-full bg-gold/70"
          style={{ height: index === 1 ? 6 : 4, width: index === 1 ? 6 : 4 }}
        />
      ))}
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold/60" />
    </div>
  );
}

/** The wordmark: display serif, all caps, wide tracking, thin gold rule above and below. */
export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const scale = { sm: 'text-base', md: 'text-2xl', lg: 'text-4xl' }[size];
  return (
    <div className="inline-flex flex-col items-center">
      <span className="h-px w-full bg-gold/70" />
      <span className={`font-display uppercase tracking-[0.34em] text-ink ${scale} px-2 py-1`}>
        Yincol
      </span>
      <span className="h-px w-full bg-gold/70" />
    </div>
  );
}

/**
 * A ribbon marking a chosen option or a saved look.
 *
 * Carries text, never colour alone — a ribbon that only signalled by being pink would
 * be invisible to anyone who cannot see pink.
 */
export function Ribbon({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/70 bg-powder px-3 py-1 text-xs font-semibold text-ink shadow-emboss">
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="h-3 w-3 text-gold">
        <path
          d="M8 1.5 L9.9 5.6 L14.4 6.2 L11.1 9.3 L11.9 13.8 L8 11.7 L4.1 13.8 L4.9 9.3 L1.6 6.2 L6.1 5.6 Z"
          fill="currentColor"
        />
      </svg>
      {label}
    </span>
  );
}

/** Section heading — gentle and narrative, never "Results" or "Output". */
export function SectionHeading({
  children,
  id,
  className = '',
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <h2 id={id} className={`font-display text-3xl leading-tight text-ink ${className}`}>
      {children}
    </h2>
  );
}
