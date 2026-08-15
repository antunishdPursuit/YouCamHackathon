/**
 * Skin analysis adapter.
 *
 * LANGUAGE RULE, and it is not negotiable: this feature produces APPEARANCE signals
 * that give context for choosing colour. It does not produce an assessment of a person.
 *
 * Whatever the vendor calls its fields, nothing named for a condition, a severity, a
 * problem or a flaw crosses this boundary. The three signals we surface are hydration
 * appearance, tone evenness and texture appearance, each mapped to a soft/balanced/
 * bright band and paired with a sentence about colour — never about the person.
 */

import type { AppearanceBand, SkinAppearance, SkinAppearanceSignal } from '@yincol/shared';
import type { RawTaskResult } from '../taskRunner.js';

type Unknown = Record<string, unknown>;

const asRecord = (value: unknown): Unknown | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Unknown) : undefined;

/**
 * TODO(phase0): verify in API Playground. The output vocabulary is unconfirmed. We look
 * for a 0–100 score under a handful of plausible spellings and ignore everything else —
 * deliberately reading less than the API offers, because the only thing this screen is
 * allowed to do is help choose a colour.
 */
const SIGNAL_SOURCES = [
  {
    id: 'hydrationAppearance',
    label: 'Hydration appearance',
    keys: ['moisture', 'hydration', 'water'],
    notes: {
      soft: 'Colours with a soft, powdery finish tend to sit well here.',
      balanced: 'Both matte and luminous finishes read comfortably.',
      bright: 'Light-reflecting colours will look especially lively.',
    },
  },
  {
    id: 'toneEvenness',
    label: 'Even-looking tone',
    keys: ['evenness', 'uniformity', 'tone_uniformity', 'radiance'],
    notes: {
      soft: 'Gentler, lower-intensity colours keep the overall look calm.',
      balanced: 'Your palette works across its full intensity range.',
      bright: 'The stronger colours in your palette have room to be worn boldly.',
    },
  },
  {
    id: 'textureAppearance',
    label: 'Texture appearance',
    keys: ['texture', 'smoothness', 'surface'],
    notes: {
      soft: 'Softer, more diffuse colours flatter this texture appearance.',
      balanced: 'Nothing in your palette needs adjusting for texture.',
      bright: 'Crisper, cleaner colours will read sharply.',
    },
  },
] as const satisfies readonly {
  id: SkinAppearanceSignal['id'];
  label: string;
  keys: readonly string[];
  notes: Record<AppearanceBand, string>;
}[];

/** Find a 0–100 number under any of several key spellings, at any depth. */
function findScore(source: Unknown, keys: readonly string[]): number | undefined {
  for (const key of Object.keys(source)) {
    const normalised = key.toLowerCase();
    if (keys.some((candidate) => normalised.includes(candidate))) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      const nested = asRecord(value);
      const score = nested?.['score'] ?? nested?.['value'] ?? nested?.['raw_score'];
      if (typeof score === 'number' && Number.isFinite(score)) return score;
    }
  }
  for (const value of Object.values(source)) {
    const nested = asRecord(value);
    if (nested) {
      const found = findScore(nested, keys);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/**
 * Bands, not grades. `soft` / `balanced` / `bright` describe how a colour will read,
 * which is a statement about colour. A clinical scale would be a statement about the
 * person, and we do not make those.
 */
function toBand(score: number): AppearanceBand {
  if (score < 40) return 'soft';
  if (score < 70) return 'balanced';
  return 'bright';
}

export function adaptSkinAnalysis(raw: RawTaskResult): SkinAppearance {
  const body = asRecord(raw['result']) ?? asRecord(raw['data']) ?? raw;

  const signals: SkinAppearanceSignal[] = [];
  for (const source of SIGNAL_SOURCES) {
    const score = findScore(body, source.keys);
    // A missing signal is simply omitted. Skin analysis is optional context, and an
    // absent reading must never be filled in with an invented one.
    if (score === undefined) continue;

    const band = toBand(score);
    signals.push({ id: source.id, label: source.label, band, note: source.notes[band] });
  }

  return { signals };
}
