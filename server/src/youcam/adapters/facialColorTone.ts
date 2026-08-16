/**
 * Facial colour tone adapter — the boundary vendor JSON is not allowed to cross.
 *
 * Everything above this file speaks in `ColorToneReading`. If a snake_case key ever
 * appears outside this directory, the boundary has leaked.
 *
 * The palette engine needs skin L* and hair L* specifically, because contrast is
 * measured as the difference between them.
 */

import type { ColorToneReading, Lab, Undertone } from '@yincol/shared';
import { hexToLab } from '@yincol/shared';
import type { RawTaskResult } from '../taskRunner.js';

export interface ColorToneOutcome {
  readonly reading: ColorToneReading;
  /** Present only if the API labels undertone itself; it overrides our classifier. */
  readonly undertone?: Undertone;
  /** What we actually received, kept so the capture script can write the shape down. */
  readonly rawKeys: readonly string[];
}

/**
 * TODO(phase0): verify in API Playground. The response shape is unconfirmed — this is
 * the single most speculative adapter in the codebase. It accepts a colour as any of:
 * a hex string, an `{r,g,b}` object, or an `{l,a,b}` object, under any of several
 * plausible key spellings, because guessing one spelling and being wrong is worse than
 * accepting three and logging which one arrived.
 */

type Unknown = Record<string, unknown>;

const asRecord = (value: unknown): Unknown | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Unknown) : undefined;

/** Read one colour, whichever of the three encodings it arrived in. */
function readColor(value: unknown): Lab | undefined {
  if (typeof value === 'string') {
    try {
      return hexToLab(value);
    } catch {
      return undefined;
    }
  }

  const record = asRecord(value);
  if (!record) return undefined;

  // Already L*a*b*.
  const { l, a, b } = record;
  if (typeof l === 'number' && typeof a === 'number' && typeof b === 'number') {
    return { l, a, b };
  }

  // sRGB triple.
  const { r, g } = record;
  if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
    return hexToLab(
      `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`,
    );
  }

  // Nested one level, e.g. `{ skin: { color: "#..." } }`.
  for (const key of ['color', 'hex', 'value', 'rgb', 'lab', 'srgb']) {
    if (key in record) {
      const nested = readColor(record[key]);
      if (nested) return nested;
    }
  }

  return undefined;
}

/** Find a colour under any of several plausible key spellings. */
function findColor(source: Unknown, aliases: readonly string[]): Lab | undefined {
  for (const alias of aliases) {
    if (alias in source) {
      const parsed = readColor(source[alias]);
      if (parsed) return parsed;
    }
  }
  // One level down, e.g. `{ colors: { skin_color: … } }`.
  for (const value of Object.values(source)) {
    const nested = asRecord(value);
    if (nested) {
      const found = findColor(nested, aliases);
      if (found) return found;
    }
  }
  return undefined;
}

const SKIN_KEYS = ['skin_color', 'skinColor', 'skin_tone', 'skinTone', 'skin'] as const;
const HAIR_KEYS = ['hair_color', 'hairColor', 'hair'] as const;
const EYE_KEYS = ['eye_color', 'eyeColor', 'eye'] as const;
const EYEBROW_KEYS = ['eyebrow_color', 'eyebrowColor', 'eyebrow', 'brow'] as const;
const LIP_KEYS = ['lip_color', 'lipColor', 'lip'] as const;
const UNDERTONE_KEYS = ['undertone', 'under_tone', 'skin_undertone'] as const;

function findUndertone(source: Unknown): Undertone | undefined {
  for (const key of UNDERTONE_KEYS) {
    const value = source[key];
    if (typeof value === 'string') {
      const normalised = value.trim().toLowerCase();
      if (normalised === 'warm' || normalised === 'cool' || normalised === 'neutral') {
        return normalised;
      }
    }
  }
  for (const value of Object.values(source)) {
    const nested = asRecord(value);
    if (nested) {
      const found = findUndertone(nested);
      if (found) return found;
    }
  }
  return undefined;
}

export class ColorToneShapeError extends Error {
  constructor(readonly rawKeys: readonly string[]) {
    super(
      'The colour tone response did not contain a readable skin and hair colour. ' +
        `Top-level keys were: ${rawKeys.join(', ') || '(none)'}. ` +
        'Record the real shape in docs/api-findings.md and tighten this adapter.',
    );
    this.name = 'ColorToneShapeError';
  }
}

export function adaptColorTone(raw: RawTaskResult): ColorToneOutcome {
  const body = asRecord(raw['result']) ?? asRecord(raw['data']) ?? raw;
  const rawKeys = Object.keys(body);

  const skin = findColor(body, SKIN_KEYS);
  const hair = findColor(body, HAIR_KEYS);

  // Both are required: skin sets depth and undertone, hair is half of contrast. Without
  // hair there is no contrast axis, and a guessed contrast would quietly corrupt the
  // one number the palette rule leans on hardest.
  if (!skin || !hair) throw new ColorToneShapeError(rawKeys);

  const eye = findColor(body, EYE_KEYS);
  const eyebrow = findColor(body, EYEBROW_KEYS);
  const lip = findColor(body, LIP_KEYS);
  const undertone = findUndertone(body);

  const reading: ColorToneReading = {
    skin,
    hair,
    ...(eye ? { eye } : {}),
    ...(eyebrow ? { eyebrow } : {}),
    ...(lip ? { lip } : {}),
  };

  return { reading, ...(undertone ? { undertone } : {}), rawKeys };
}
