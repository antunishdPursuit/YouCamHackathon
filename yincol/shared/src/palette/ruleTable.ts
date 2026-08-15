/**
 * The rule table — 27 entries, written out in full.
 *
 * This file is meant to be opened in front of a judge. It is a lookup table, not a
 * model: three axes, three values each, one entry per combination. Given the same
 * three inputs it returns the same entry forever.
 *
 * How to read an entry:
 *   · UNDERTONE picks the hue window. Warm leans golden, cool leans rosy-violet,
 *     neutral takes the rose-to-peach band that sits between them.
 *   · DEPTH picks the lightness band. A deeper reading gets a band that reaches
 *     further down; a lighter reading gets one that reaches further up.
 *   · CONTRAST sets the saturation ceiling, and nothing else. Low contrast between
 *     hair and skin means muted colours; high contrast permits saturated ones.
 *
 * Each axis controls exactly one property, which is what makes the derivation card
 * explainable in one sentence per axis.
 */

import type { PaletteRule, RuleKey } from '../domain/types.js';

// Hue windows, in CIELCh degrees. `neutral` wraps past 360.
const WARM_HUE = { hueStart: 28, hueEnd: 96 } as const; // amber → gold → olive-gold
const NEUTRAL_HUE = { hueStart: 335, hueEnd: 55 } as const; // rose → red → peach (wraps)
const COOL_HUE = { hueStart: 258, hueEnd: 348 } as const; // blue-violet → wisteria → berry

// Lightness bands, in L*.
const LIGHT_BAND = { lightnessMin: 62, lightnessMax: 92 } as const;
const MEDIUM_BAND = { lightnessMin: 48, lightnessMax: 84 } as const;
const DEEP_BAND = { lightnessMin: 32, lightnessMax: 76 } as const;

// Saturation ceilings, in C* (LCh chroma).
const LOW_CEILING = 26;
const MEDIUM_CEILING = 42;
const HIGH_CEILING = 62;

export const RULE_TABLE: Readonly<Record<RuleKey, PaletteRule>> = {
  // ── warm ────────────────────────────────────────────────────
  'warm-light-low': { ...WARM_HUE, ...LIGHT_BAND, saturationCeiling: LOW_CEILING },
  'warm-light-medium': { ...WARM_HUE, ...LIGHT_BAND, saturationCeiling: MEDIUM_CEILING },
  'warm-light-high': { ...WARM_HUE, ...LIGHT_BAND, saturationCeiling: HIGH_CEILING },
  'warm-medium-low': { ...WARM_HUE, ...MEDIUM_BAND, saturationCeiling: LOW_CEILING },
  'warm-medium-medium': { ...WARM_HUE, ...MEDIUM_BAND, saturationCeiling: MEDIUM_CEILING },
  'warm-medium-high': { ...WARM_HUE, ...MEDIUM_BAND, saturationCeiling: HIGH_CEILING },
  'warm-deep-low': { ...WARM_HUE, ...DEEP_BAND, saturationCeiling: LOW_CEILING },
  'warm-deep-medium': { ...WARM_HUE, ...DEEP_BAND, saturationCeiling: MEDIUM_CEILING },
  'warm-deep-high': { ...WARM_HUE, ...DEEP_BAND, saturationCeiling: HIGH_CEILING },

  // ── neutral ─────────────────────────────────────────────────
  'neutral-light-low': { ...NEUTRAL_HUE, ...LIGHT_BAND, saturationCeiling: LOW_CEILING },
  'neutral-light-medium': { ...NEUTRAL_HUE, ...LIGHT_BAND, saturationCeiling: MEDIUM_CEILING },
  'neutral-light-high': { ...NEUTRAL_HUE, ...LIGHT_BAND, saturationCeiling: HIGH_CEILING },
  'neutral-medium-low': { ...NEUTRAL_HUE, ...MEDIUM_BAND, saturationCeiling: LOW_CEILING },
  'neutral-medium-medium': { ...NEUTRAL_HUE, ...MEDIUM_BAND, saturationCeiling: MEDIUM_CEILING },
  'neutral-medium-high': { ...NEUTRAL_HUE, ...MEDIUM_BAND, saturationCeiling: HIGH_CEILING },
  'neutral-deep-low': { ...NEUTRAL_HUE, ...DEEP_BAND, saturationCeiling: LOW_CEILING },
  'neutral-deep-medium': { ...NEUTRAL_HUE, ...DEEP_BAND, saturationCeiling: MEDIUM_CEILING },
  'neutral-deep-high': { ...NEUTRAL_HUE, ...DEEP_BAND, saturationCeiling: HIGH_CEILING },

  // ── cool ────────────────────────────────────────────────────
  'cool-light-low': { ...COOL_HUE, ...LIGHT_BAND, saturationCeiling: LOW_CEILING },
  'cool-light-medium': { ...COOL_HUE, ...LIGHT_BAND, saturationCeiling: MEDIUM_CEILING },
  'cool-light-high': { ...COOL_HUE, ...LIGHT_BAND, saturationCeiling: HIGH_CEILING },
  'cool-medium-low': { ...COOL_HUE, ...MEDIUM_BAND, saturationCeiling: LOW_CEILING },
  'cool-medium-medium': { ...COOL_HUE, ...MEDIUM_BAND, saturationCeiling: MEDIUM_CEILING },
  'cool-medium-high': { ...COOL_HUE, ...MEDIUM_BAND, saturationCeiling: HIGH_CEILING },
  'cool-deep-low': { ...COOL_HUE, ...DEEP_BAND, saturationCeiling: LOW_CEILING },
  'cool-deep-medium': { ...COOL_HUE, ...DEEP_BAND, saturationCeiling: MEDIUM_CEILING },
  'cool-deep-high': { ...COOL_HUE, ...DEEP_BAND, saturationCeiling: HIGH_CEILING },
};

export const ALL_RULE_KEYS = Object.keys(RULE_TABLE) as readonly RuleKey[];

export const ruleFor = (key: RuleKey): PaletteRule => {
  const rule = RULE_TABLE[key];
  if (!rule) throw new Error(`No rule for key "${key}" — the table is meant to be total.`);
  return rule;
};
