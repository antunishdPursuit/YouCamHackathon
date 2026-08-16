/**
 * Fit scoring — how well a garment's colour sits inside a palette.
 *
 * The threshold is returned alongside the score, and the UI shows it. A "4 of 6" with
 * no visible threshold is an assertion; a "4 of 6 within ΔE 25" is a claim a shopper
 * can disagree with, which is the only kind worth putting on screen.
 */

import type { FitScore, Hex, Palette, SwatchFit } from '../domain/types.js';
import { deltaE76, hexToLab } from './color.js';

/**
 * ΔE below which a garment colour counts as sitting inside the palette.
 *
 * Under CIE76, ~2.3 is a just-noticeable difference and ~50 is "unrelated colours",
 * so 25 reads as "the same colour family, allowing for a different shade". It is a
 * product decision, not a perceptual constant — which is exactly why it is exported,
 * displayed, and never buried.
 */
export const FIT_THRESHOLD = 25;

function summarise(matched: number, total: number, threshold: number): string {
  const stem = `${matched} of ${total} palette colours sit within ΔE ${threshold} of this garment`;
  if (matched >= 4) return `${stem} — it lands comfortably inside your palette.`;
  if (matched >= 2) return `${stem} — a partial match, so it will read as a deliberate contrast.`;
  if (matched === 1) return `${stem} — one colour carries it, so pair it with that shade.`;
  return `${stem} — nothing here is close, so this one stands apart from your palette.`;
}

/**
 * Score a garment colour against every swatch in a palette.
 *
 * Pure. Returns the count, the total, the threshold itself, and the per-swatch
 * breakdown, so the UI can render the reasoning rather than just the verdict.
 */
export function scoreGarmentFit(
  garmentHex: Hex,
  palette: Palette,
  threshold: number = FIT_THRESHOLD,
): FitScore {
  const garmentLab = hexToLab(garmentHex);

  const breakdown: SwatchFit[] = palette.swatches.map((swatch) => {
    const distance = deltaE76(garmentLab, swatch.lab);
    return {
      swatchId: swatch.id,
      swatchName: swatch.name,
      swatchHex: swatch.hex,
      deltaE: distance,
      within: distance <= threshold,
    };
  });

  const matched = breakdown.filter((entry) => entry.within).length;

  return {
    garmentHex,
    garmentLab,
    matched,
    total: breakdown.length,
    threshold,
    breakdown,
    summary: summarise(matched, breakdown.length, threshold),
  };
}

/**
 * The single closest swatch, useful for the look card's one-line summary.
 * Ties resolve to the earliest swatch, so the result is stable.
 */
export function closestSwatch(score: FitScore): SwatchFit | undefined {
  return score.breakdown.reduce<SwatchFit | undefined>(
    (best, entry) => (best === undefined || entry.deltaE < best.deltaE ? entry : best),
    undefined,
  );
}
