import { describe, expect, it } from 'vitest';
import { buildPalette } from './engine.js';
import { closestSwatch, FIT_THRESHOLD, scoreGarmentFit } from './fit.js';
import { deltaE76, hexToLab } from './color.js';

const AXES = {
  undertone: 'warm',
  depth: 'medium',
  contrast: 'medium',
  skinLightness: 56,
  hairLightness: 26,
  contrastValue: 30,
  skinHueAngle: 66,
} as const;

describe('fit scoring', () => {
  const palette = buildPalette(AXES);

  it('returns the count, the total, the threshold and a full breakdown', () => {
    const score = scoreGarmentFit('#c98a5e', palette);

    expect(score.total).toBe(6);
    expect(score.breakdown).toHaveLength(6);
    expect(score.threshold).toBe(FIT_THRESHOLD);
    expect(score.matched).toBe(score.breakdown.filter((entry) => entry.within).length);
    expect(score.matched).toBeGreaterThanOrEqual(0);
    expect(score.matched).toBeLessThanOrEqual(6);
  });

  it('exposes the threshold so the UI can show it', () => {
    expect(FIT_THRESHOLD).toBe(25);
    expect(scoreGarmentFit('#000000', palette).threshold).toBe(25);
  });

  it('honours a caller-supplied threshold', () => {
    const strict = scoreGarmentFit('#c98a5e', palette, 5);
    const loose = scoreGarmentFit('#c98a5e', palette, 90);
    expect(strict.threshold).toBe(5);
    expect(loose.matched).toBeGreaterThanOrEqual(strict.matched);
    expect(loose.matched).toBe(6);
  });

  it('scores a swatch against itself as a perfect match', () => {
    const first = palette.swatches[0]!;
    const score = scoreGarmentFit(first.hex, palette);
    const selfEntry = score.breakdown.find((entry) => entry.swatchId === first.id)!;

    expect(selfEntry.deltaE).toBe(0);
    expect(selfEntry.within).toBe(true);
    expect(score.matched).toBeGreaterThanOrEqual(1);
  });

  it('matches nothing when the garment is nowhere near the palette', () => {
    // A saturated blue against a warm amber/gold palette.
    const score = scoreGarmentFit('#0022cc', palette);
    expect(score.matched).toBe(0);
    expect(score.summary).toContain('stands apart');
  });

  it('computes ΔE consistently with the colour module', () => {
    const garmentHex = '#8a5a2b';
    const score = scoreGarmentFit(garmentHex, palette);
    for (const entry of score.breakdown) {
      const swatch = palette.swatches.find((s) => s.id === entry.swatchId)!;
      expect(entry.deltaE).toBe(deltaE76(hexToLab(garmentHex), swatch.lab));
    }
  });

  it('marks `within` exactly at the threshold boundary, inclusive', () => {
    const score = scoreGarmentFit('#8a5a2b', palette);
    for (const entry of score.breakdown) {
      expect(entry.within).toBe(entry.deltaE <= score.threshold);
    }
  });

  it('always carries text — a fit signal is never a colour alone', () => {
    for (const hex of ['#0022cc', '#c98a5e', '#f2e6d8', '#3a2a1a']) {
      const score = scoreGarmentFit(hex, palette);
      expect(score.summary).toContain(`${score.matched} of ${score.total}`);
      expect(score.summary).toContain(`ΔE ${score.threshold}`);
      for (const entry of score.breakdown) {
        expect(entry.swatchName.length).toBeGreaterThan(0);
      }
    }
  });

  it('is deterministic', () => {
    const a = JSON.stringify(scoreGarmentFit('#c98a5e', palette));
    const b = JSON.stringify(scoreGarmentFit('#c98a5e', palette));
    expect(a).toBe(b);
  });
});

describe('closest swatch', () => {
  const palette = buildPalette(AXES);

  it('finds the minimum ΔE entry', () => {
    const score = scoreGarmentFit('#c98a5e', palette);
    const closest = closestSwatch(score)!;
    const minimum = Math.min(...score.breakdown.map((entry) => entry.deltaE));
    expect(closest.deltaE).toBe(minimum);
  });

  it('resolves ties to the earliest swatch, so results are stable', () => {
    const score = scoreGarmentFit(palette.swatches[0]!.hex, palette);
    expect(closestSwatch(score)!.swatchId).toBe('swatch-1');
  });
});
