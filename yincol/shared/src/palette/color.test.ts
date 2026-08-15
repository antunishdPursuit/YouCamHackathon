import { describe, expect, it } from 'vitest';
import {
  deltaE76,
  hexToLab,
  labToHex,
  labToLch,
  lchToLab,
  parseHex,
  toGamutLch,
  toHex,
} from './color.js';

describe('hex parsing', () => {
  it('reads six-digit and three-digit forms identically', () => {
    expect(parseHex('#ff8000')).toEqual({ r: 255, g: 128, b: 0 });
    expect(parseHex('ff8000')).toEqual({ r: 255, g: 128, b: 0 });
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('rejects anything that is not a colour', () => {
    expect(() => parseHex('#ggghhh')).toThrow(/hex colour/);
    expect(() => parseHex('rebeccapurple')).toThrow(/hex colour/);
  });

  it('serialises lowercase and zero-padded', () => {
    expect(toHex({ r: 0, g: 5, b: 255 })).toBe('#0005ff');
  });
});

describe('sRGB ↔ L*a*b*', () => {
  // Reference values for the D65 2° observer.
  it('places white, black and mid grey where the standard says', () => {
    const white = hexToLab('#ffffff');
    expect(white.l).toBeCloseTo(100, 2);
    expect(white.a).toBeCloseTo(0, 2);
    expect(white.b).toBeCloseTo(0, 2);

    const black = hexToLab('#000000');
    expect(black.l).toBeCloseTo(0, 2);

    const grey = hexToLab('#808080');
    expect(grey.l).toBeCloseTo(53.585, 1);
    expect(grey.a).toBeCloseTo(0, 1);
    expect(grey.b).toBeCloseTo(0, 1);
  });

  it('matches published L*a*b* for the sRGB primaries', () => {
    const red = hexToLab('#ff0000');
    expect(red.l).toBeCloseTo(53.24, 1);
    expect(red.a).toBeCloseTo(80.09, 1);
    expect(red.b).toBeCloseTo(67.2, 1);

    const green = hexToLab('#00ff00');
    expect(green.l).toBeCloseTo(87.73, 1);
    expect(green.a).toBeCloseTo(-86.18, 1);

    const blue = hexToLab('#0000ff');
    expect(blue.l).toBeCloseTo(32.3, 1);
    expect(blue.b).toBeCloseTo(-107.86, 1);
  });

  it('round-trips every channel value without drift', () => {
    for (const hex of ['#000000', '#ffffff', '#4e323b', '#c6a15b', '#f6d7dd', '#1a7f4b']) {
      expect(labToHex(hexToLab(hex))).toBe(hex);
    }
  });
});

describe('L*a*b* ↔ LCh', () => {
  it('round-trips', () => {
    const lab = hexToLab('#c6a15b');
    const back = lchToLab(labToLch(lab));
    expect(back.l).toBeCloseTo(lab.l, 3);
    expect(back.a).toBeCloseTo(lab.a, 3);
    expect(back.b).toBeCloseTo(lab.b, 3);
  });

  it('reports hue in 0–360, never negative', () => {
    // Blue sits at a negative atan2 result before wrapping.
    expect(labToLch(hexToLab('#0000ff')).h).toBeGreaterThan(180);
    expect(labToLch(hexToLab('#0000ff')).h).toBeLessThan(360);
  });
});

describe('gamut mapping', () => {
  it('leaves an in-gamut colour untouched', () => {
    const inside = labToLch(hexToLab('#c6a15b'));
    expect(toGamutLch(inside)).toEqual(inside);
  });

  it('reduces chroma only, preserving lightness and hue', () => {
    const impossible = { l: 60, c: 140, h: 30 };
    const mapped = toGamutLch(impossible);
    expect(mapped.l).toBe(60);
    expect(mapped.h).toBe(30);
    expect(mapped.c).toBeLessThan(140);
  });

  it('is deterministic — fixed iteration count, not a tolerance loop', () => {
    const impossible = { l: 45, c: 130, h: 275 };
    expect(toGamutLch(impossible)).toEqual(toGamutLch(impossible));
  });
});

describe('ΔE (CIE76)', () => {
  it('is zero for a colour against itself', () => {
    expect(deltaE76(hexToLab('#f6d7dd'), hexToLab('#f6d7dd'))).toBe(0);
  });

  it('is symmetric', () => {
    const a = hexToLab('#c6a15b');
    const b = hexToLab('#4e323b');
    expect(deltaE76(a, b)).toBe(deltaE76(b, a));
  });

  it('equals the Euclidean distance on a known pair', () => {
    // A pure lightness step of 10 with no chroma change is a ΔE of exactly 10.
    expect(deltaE76({ l: 50, a: 0, b: 0 }, { l: 60, a: 0, b: 0 })).toBe(10);
    // 3-4-5 triangle across the three axes.
    expect(deltaE76({ l: 50, a: 0, b: 0 }, { l: 53, a: 4, b: 0 })).toBe(5);
  });

  it('separates black from white by very nearly 100', () => {
    expect(deltaE76(hexToLab('#000000'), hexToLab('#ffffff'))).toBeCloseTo(100, 1);
  });
});
