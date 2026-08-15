/**
 * The palette engine.
 *
 * A pure function. No `fetch`, no SDK import, no `async`, no clock, no random source.
 * The same input always produces byte-identical output — that property is what lets us
 * put the rule table on screen and claim it is the rule.
 *
 * Six swatches, always: 2 neutrals, 2 primaries, 1 accent, 1 statement.
 */

import type {
  ColorToneReading,
  DerivationTrace,
  Lch,
  Palette,
  PaletteRule,
  PaletteSwatch,
  SwatchRole,
  ToneAxes,
  Undertone,
} from '../domain/types.js';
import { hexToLab, labToHex, lchToLab, roundTo, toGamutLch } from './color.js';
import { ruleFor } from './ruleTable.js';
import { pickShadeName } from './shadeNames.js';
import { ruleKeyFor, toneAxesFromReading } from './axes.js';

/**
 * Where each of the six swatches sits inside the rule entry's box.
 *
 * All three numbers are fractions of the entry's own ranges, so a recipe never
 * hard-codes a colour — it describes a position, and the rule decides what that
 * position means. This is the whole trick: one set of six recipes, 27 rule entries,
 * 162 possible swatches, none of them written down anywhere.
 */
interface RoleRecipe {
  readonly role: SwatchRole;
  /** 0–1 across the hue window. */
  readonly huePosition: number;
  /** 0–1 across the lightness band. */
  readonly lightnessPosition: number;
  /** 0–1 of the saturation ceiling. The statement swatch is the only 1.0. */
  readonly chromaFraction: number;
}

const RECIPES: readonly RoleRecipe[] = [
  { role: 'neutral', huePosition: 0.2, lightnessPosition: 0.96, chromaFraction: 0.14 },
  { role: 'neutral', huePosition: 0.62, lightnessPosition: 0.34, chromaFraction: 0.2 },
  { role: 'primary', huePosition: 0.34, lightnessPosition: 0.74, chromaFraction: 0.52 },
  { role: 'primary', huePosition: 0.72, lightnessPosition: 0.52, chromaFraction: 0.64 },
  { role: 'accent', huePosition: 0.06, lightnessPosition: 0.66, chromaFraction: 0.86 },
  { role: 'statement', huePosition: 0.92, lightnessPosition: 0.4, chromaFraction: 1.0 },
];

export const SWATCH_COUNT = RECIPES.length;

/** Width of a hue window in degrees, handling windows that wrap past 360. */
export function hueSpan(rule: PaletteRule): number {
  const span = (((rule.hueEnd - rule.hueStart) % 360) + 360) % 360;
  return span === 0 ? 360 : span;
}

function positionToLch(rule: PaletteRule, recipe: RoleRecipe): Lch {
  const h = (rule.hueStart + hueSpan(rule) * recipe.huePosition) % 360;
  const l = rule.lightnessMin + (rule.lightnessMax - rule.lightnessMin) * recipe.lightnessPosition;
  const c = rule.saturationCeiling * recipe.chromaFraction;
  return { l: roundTo(l, 4), c: roundTo(c, 4), h: roundTo(h, 4) };
}

// ─────────────────────────────────────────────────────────────
// Plain-language reasons
// ─────────────────────────────────────────────────────────────

const UNDERTONE_PHRASE: Readonly<Record<Undertone, string>> = {
  warm: 'the golden side',
  neutral: 'the balanced middle',
  cool: 'the rosy side',
};

/**
 * One plain sentence per swatch. These describe the rule, not the person — they say
 * what the colour is for and which part of the rule put it there.
 *
 * Deliberately phrased from the three AXES and the rule entry only, never from the raw
 * L* readings: two people whose measurements differ but who land in the same three
 * bands must receive an identical palette, copy included. The raw numbers appear once,
 * in the derivation notes, where they belong.
 */
function reasonFor(index: number, axes: ToneAxes, rule: PaletteRule, lch: Lch): string {
  const ceiling = Math.round(rule.saturationCeiling);
  const intensity = Math.round(lch.c);
  const lightness = Math.round(lch.l);

  switch (index) {
    case 0:
      return `A quiet base for layering. Its intensity is held at ${intensity}, far below the ceiling of ${ceiling}, so it stays behind your face instead of beside it.`;
    case 1:
      return `A grounding neutral for the largest piece you wear, where a stronger colour would take over the outfit.`;
    case 2:
      return `An everyday colour drawn from ${UNDERTONE_PHRASE[axes.undertone]} your skin reads toward, kept light at L* ${lightness} to suit ${axes.depth} depth.`;
    case 3:
      return `A second everyday colour, deeper at L* ${lightness} and stronger at ${intensity}, for when the outfit should carry more weight.`;
    case 4:
      return `A brighter note for smaller pieces — a scarf, a bag, a lip. Your ${axes.contrast} contrast permits intensity up to ${ceiling}.`;
    default:
      return `The boldest colour here, sitting at the full ceiling of ${ceiling} that ${axes.contrast} contrast allows. Best worn on its own.`;
  }
}

function derivationNotes(axes: ToneAxes, rule: PaletteRule): readonly string[] {
  return [
    `Your skin reads at L* ${axes.skinLightness} on a 0–100 lightness scale, which places it in the ${axes.depth} band and sets the palette's lightness range to ${rule.lightnessMin}–${rule.lightnessMax}.`,
    `Hair reads at L* ${axes.hairLightness}. The gap of ${axes.contrastValue} points between hair and skin is your contrast — ${axes.contrast} — and that alone sets the saturation ceiling of ${rule.saturationCeiling}.`,
    `Skin hue sits at ${axes.skinHueAngle}°, which classifies as ${axes.undertone} undertone and opens the hue window ${rule.hueStart}°–${rule.hueEnd}°.`,
  ];
}

// ─────────────────────────────────────────────────────────────
// The engine
// ─────────────────────────────────────────────────────────────

/**
 * Build the six-swatch palette for a set of axes.
 *
 * Deterministic end to end: fixed recipes, a fixed rule table, a fixed name table, and
 * a gamut mapping that bisects a fixed number of times rather than to a tolerance.
 */
export function buildPalette(axes: ToneAxes): Palette {
  const ruleKey = ruleKeyFor(axes);
  const rule = ruleFor(ruleKey);

  const taken = new Set<string>();
  const swatches: PaletteSwatch[] = RECIPES.map((recipe, index) => {
    const mapped = toGamutLch(positionToLch(rule, recipe));
    // Round-trip through the hex so the LAB we report is the LAB of the colour actually
    // painted on screen. Fit scores are computed against what the shopper sees.
    const hex = labToHex(lchToLab(mapped));
    const lab = hexToLab(hex);
    const name = pickShadeName(mapped.h, mapped.l, taken);
    taken.add(name);

    return {
      id: `swatch-${index + 1}`,
      role: recipe.role,
      hex,
      lab,
      name,
      reason: reasonFor(index, axes, rule, mapped),
    };
  });

  const derivation: DerivationTrace = {
    axes,
    ruleKey,
    rule,
    notes: derivationNotes(axes, rule),
  };

  return { swatches, derivation };
}

/** Convenience: measurements straight from the colour-tone adapter to a palette. */
export function buildPaletteFromReading(
  reading: ColorToneReading,
  explicitUndertone?: Undertone,
): Palette {
  return buildPalette(toneAxesFromReading(reading, explicitUndertone));
}
