/**
 * Turning measurements into the three palette axes.
 *
 * Every boundary below is a published number, not a learned one, so a reading that
 * lands near an edge can be argued about out loud.
 */

import type { Contrast, ColorToneReading, Depth, RuleKey, ToneAxes, Undertone } from '../domain/types.js';
import { hueAngle, roundTo } from './color.js';

/** Depth from skin L*: light > 65, medium 45–65, deep < 45. */
export function classifyDepth(skinLightness: number): Depth {
  if (skinLightness > 65) return 'light';
  if (skinLightness >= 45) return 'medium';
  return 'deep';
}

/** Contrast from |hair L* − skin L*|: low < 20, medium 20–40, high > 40. */
export function classifyContrast(contrastValue: number): Contrast {
  if (contrastValue < 20) return 'low';
  if (contrastValue <= 40) return 'medium';
  return 'high';
}

/**
 * Undertone from the hue angle of the skin reading.
 *
 * ASSUMPTION(phase0): the facial colour tone response shape is unverified, so we do not
 * know whether it labels undertone directly. This classifier is the fallback: human
 * skin sits in a narrow hue band in L*a*b*, roughly 40°–70°, where a higher angle means
 * more yellow relative to red (golden) and a lower angle means more red relative to
 * yellow (rosy). Boundaries at 50° and 60° split that band into three.
 *
 * If the API does return an undertone label, pass it as `explicitUndertone` and it wins
 * outright — the classifier is only ever a stand-in. Logged in docs/api-findings.md.
 */
export function classifyUndertone(skinHueAngle: number): Undertone {
  if (skinHueAngle < 50) return 'cool';
  if (skinHueAngle <= 60) return 'neutral';
  return 'warm';
}

export function toneAxesFromReading(
  reading: ColorToneReading,
  explicitUndertone?: Undertone,
): ToneAxes {
  const skinLightness = roundTo(reading.skin.l, 2);
  const hairLightness = roundTo(reading.hair.l, 2);
  const contrastValue = roundTo(Math.abs(hairLightness - skinLightness), 2);
  const skinHueAngle = roundTo(hueAngle(reading.skin), 2);

  return {
    undertone: explicitUndertone ?? classifyUndertone(skinHueAngle),
    depth: classifyDepth(skinLightness),
    contrast: classifyContrast(contrastValue),
    skinLightness,
    hairLightness,
    contrastValue,
    skinHueAngle,
  };
}

export const ruleKeyFor = (axes: {
  undertone: Undertone;
  depth: Depth;
  contrast: Contrast;
}): RuleKey => `${axes.undertone}-${axes.depth}-${axes.contrast}`;
