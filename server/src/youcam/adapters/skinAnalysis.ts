/**
 * Skin analysis adapter.
 *
 * LANGUAGE RULE, and it is not negotiable: this feature produces APPEARANCE signals
 * that give context for choosing colour. It does not produce an assessment of a person.
 *
 * Whatever the vendor calls its fields, nothing named for a condition, a severity, a
 * problem or a flaw crosses this boundary. The signals we surface are hydration
 * appearance, tone evenness, texture appearance and finish appearance, each mapped to
 * a soft/balanced/bright band and paired with a sentence about colour — never about the
 * person.
 */

import type { AppearanceBand, SkinAppearance, SkinAppearanceSignal } from '@yincol/shared';
import type { RawTaskResult } from '../taskRunner.js';

type Unknown = Record<string, unknown>;

const asRecord = (value: unknown): Unknown | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Unknown) : undefined;

/**
 * These are the only numeric output categories that may become YINCOL context. The
 * vendor also returns concern, age and mask records; those remain outside this type.
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

const FINISH_BY_SKIN_TYPE: Readonly<
  Record<string, { readonly band: AppearanceBand; readonly note: string }>
> = {
  oily: {
    band: 'bright',
    note: 'Light-reflecting colours may echo the natural light in this finish.',
  },
  dry: {
    band: 'soft',
    note: 'Soft, powdery colour finishes can keep the overall look gentle.',
  },
  normal: {
    band: 'balanced',
    note: 'Both matte and luminous colour finishes are available.',
  },
  combination: {
    band: 'balanced',
    note: 'Both matte and luminous colour finishes are available.',
  },
};

const normaliseToken = (value: string): string => value.toLowerCase().replace(/[\s-]+/g, '_');

function readScore(record: Unknown): number | undefined {
  // Prefer the UI score when the API supplies one. It is already on the 0–100
  // scale used by the bands; raw_score remains a fallback for alternate responses.
  for (const key of ['ui_score', 'score', 'raw_score', 'value']) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

/** Find a 0–100 number under any of several key spellings, at any depth. */
function findScore(source: Unknown, keys: readonly string[]): number | undefined {
  const matches = (value: string): boolean => {
    const normalised = normaliseToken(value);
    return keys.some((candidate) => normalised.includes(normaliseToken(candidate)));
  };

  for (const [key, value] of Object.entries(source)) {
    if (matches(key)) {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      const nested = asRecord(value);
      const score = nested ? readScore(nested) : undefined;
      if (score !== undefined) return score;
    }

    // The documented response uses records such as
    // `{ type: "texture", ui_score: 71, raw_score: 64.9 }`.
    if (key === 'type' && typeof value === 'string' && matches(value)) {
      const score = readScore(source);
      if (score !== undefined) return score;
    }
  }

  for (const value of Object.values(source)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = asRecord(item);
        if (nested) {
          const found = findScore(nested, keys);
          if (found !== undefined) return found;
        }
      }
      continue;
    }
    const nested = asRecord(value);
    if (nested) {
      const found = findScore(nested, keys);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/**
 * Read only the whole-face skin type. This is an inference boundary: a vendor
 * `skin_type` label becomes colour-finish context and is never shown as a personal
 * assessment. Regional T-zone/U-zone values are ignored when a whole-face value exists.
 */
function findWholeSkinType(source: Unknown): string | undefined {
  let regionalFallback: string | undefined;

  const visit = (node: unknown): string | undefined => {
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item);
        if (found !== undefined) return found;
      }
      return undefined;
    }

    const record = asRecord(node);
    if (!record) return undefined;

    const type = typeof record['type'] === 'string' ? normaliseToken(record['type']) : '';
    const skinType = typeof record['skin_type'] === 'string' ? record['skin_type'] : undefined;
    if (skinType && (type === 'skin_type' || 'skin_type' in record)) {
      const region = typeof record['region'] === 'string' ? normaliseToken(record['region']) : '';
      if (region === 'whole') return skinType;
      regionalFallback ??= skinType;
    }

    for (const value of Object.values(record)) {
      const found = visit(value);
      if (found !== undefined) return found;
    }
    return undefined;
  };

  return visit(source) ?? regionalFallback;
}

function finishSignal(source: Unknown): SkinAppearanceSignal | undefined {
  const skinType = findWholeSkinType(source);
  if (!skinType) return undefined;

  const finish = FINISH_BY_SKIN_TYPE[normaliseToken(skinType)];
  if (!finish) return undefined;

  return {
    id: 'finishAppearance',
    label: 'Finish appearance',
    band: finish.band,
    note: finish.note,
  };
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

  const finish = finishSignal(body);
  if (finish) signals.push(finish);

  return { signals };
}
