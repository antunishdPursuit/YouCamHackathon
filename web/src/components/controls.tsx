/**
 * Buttons, chips and the segmented control.
 *
 * Soft emboss on primary buttons — a faint inner highlight and a faint outer shadow,
 * like pressed powder. Pill shapes throughout.
 *
 * ACCESSIBILITY, and it is load-bearing: every interactive element here is at least
 * 44px tall, keeps its focus ring, and states its selected-ness in text or ARIA rather
 * than in colour alone.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'quiet' | 'link';
  children: ReactNode;
};

export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonProps) {
  const base =
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 py-3 ' +
    'text-base font-semibold transition-[transform,box-shadow] duration-200 ' +
    'disabled:cursor-not-allowed disabled:opacity-55';

  const variants = {
    // Powder-pink ground with rose-brown ink: the gold stays on the hairline border,
    // never in the text, because gold on a light ground fails contrast.
    primary: 'bg-powder text-ink border border-gold/60 shadow-emboss active:shadow-emboss-press',
    quiet: 'bg-ground text-ink border border-gold/40 shadow-none hover:bg-surface',
    link: 'bg-transparent text-ink underline underline-offset-4 px-2',
  }[variant];

  return (
    <button type="button" className={`${base} ${variants} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/**
 * A chip showing a locked or selected value.
 *
 * `tone="locked"` is the persistent chip in the results workspace naming the variable
 * that is being held still.
 */
export function Chip({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'locked';
}) {
  const tones = {
    default: 'bg-surface border-gold/50 text-ink',
    locked: 'bg-sky border-gold/60 text-ink',
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${tones}`}
    >
      {children}
    </span>
  );
}

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** Spoken description, when the visible label is too terse on its own. */
  readonly hint?: string;
}

/**
 * Segmented control for switching the compare axis.
 *
 * Built as a real tablist so the whole thing is reachable by keyboard: arrow keys move
 * between axes, and the selected axis is announced rather than merely tinted.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  const move = (direction: 1 | -1) => {
    const index = options.findIndex((option) => option.value === value);
    const next = options[(index + direction + options.length) % options.length];
    if (next) onChange(next.value);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex rounded-full border border-gold/60 bg-surface p-1"
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          move(1);
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          move(-1);
        }
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`min-h-[44px] rounded-full px-5 text-sm font-semibold transition-shadow duration-200 ${
              selected ? 'bg-powder text-ink shadow-emboss' : 'bg-transparent text-ink'
            }`}
          >
            {option.label}
            {option.hint ? <span className="sr-only"> — {option.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
