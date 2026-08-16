import { describe, expect, it } from 'vitest';
import type { ColorToneReading, Contrast, Depth, RuleKey, Undertone } from '../domain/types.js';
import { buildPalette, buildPaletteFromReading, hueSpan, SWATCH_COUNT } from './engine.js';
import { ALL_RULE_KEYS, RULE_TABLE, ruleFor } from './ruleTable.js';
import { classifyContrast, classifyDepth, classifyUndertone, ruleKeyFor, toneAxesFromReading } from './axes.js';
import { hexToLab, labToLch } from './color.js';
import { ALL_SHADE_NAMES } from './shadeNames.js';

const UNDERTONES: Undertone[] = ['warm', 'neutral', 'cool'];
const DEPTHS: Depth[] = ['light', 'medium', 'deep'];
const CONTRASTS: Contrast[] = ['low', 'medium', 'high'];

/** Axes for a rule key, with plausible measurements attached. */
function axesFor(undertone: Undertone, depth: Depth, contrast: Contrast) {
  const skinLightness = depth === 'light' ? 74 : depth === 'medium' ? 56 : 38;
  const contrastValue = contrast === 'low' ? 12 : contrast === 'medium' ? 30 : 52;
  const skinHueAngle = undertone === 'cool' ? 44 : undertone === 'neutral' ? 55 : 66;
  return {
    undertone,
    depth,
    contrast,
    skinLightness,
    hairLightness: skinLightness - contrastValue,
    contrastValue,
    skinHueAngle,
  };
}

describe('rule table', () => {
  it('has exactly 27 entries — 3 undertones × 3 depths × 3 contrasts', () => {
    expect(ALL_RULE_KEYS).toHaveLength(27);
    expect(new Set(ALL_RULE_KEYS).size).toBe(27);
  });

  it('covers every combination with no gaps', () => {
    for (const undertone of UNDERTONES) {
      for (const depth of DEPTHS) {
        for (const contrast of CONTRASTS) {
          const key: RuleKey = `${undertone}-${depth}-${contrast}`;
          expect(RULE_TABLE[key], `missing rule ${key}`).toBeDefined();
        }
      }
    }
  });

  it('lets undertone control hue and nothing else', () => {
    for (const undertone of UNDERTONES) {
      const windows = DEPTHS.flatMap((depth) =>
        CONTRASTS.map((contrast) => {
          const rule = ruleFor(`${undertone}-${depth}-${contrast}`);
          return `${rule.hueStart}-${rule.hueEnd}`;
        }),
      );
      expect(new Set(windows).size, `${undertone} should have one hue window`).toBe(1);
    }
  });

  it('lets depth control the lightness band and nothing else', () => {
    for (const depth of DEPTHS) {
      const bands = UNDERTONES.flatMap((undertone) =>
        CONTRASTS.map((contrast) => {
          const rule = ruleFor(`${undertone}-${depth}-${contrast}`);
          return `${rule.lightnessMin}-${rule.lightnessMax}`;
        }),
      );
      expect(new Set(bands).size, `${depth} should have one lightness band`).toBe(1);
    }
  });

  it('lets contrast control the saturation ceiling, low → muted and high → saturated', () => {
    for (const contrast of CONTRASTS) {
      const ceilings = UNDERTONES.flatMap((undertone) =>
        DEPTHS.map((depth) => ruleFor(`${undertone}-${depth}-${contrast}`).saturationCeiling),
      );
      expect(new Set(ceilings).size, `${contrast} should have one ceiling`).toBe(1);
    }
    const low = ruleFor('warm-medium-low').saturationCeiling;
    const medium = ruleFor('warm-medium-medium').saturationCeiling;
    const high = ruleFor('warm-medium-high').saturationCeiling;
    expect(low).toBeLessThan(medium);
    expect(medium).toBeLessThan(high);
  });

  it('computes a sane span for the hue window that wraps past 360', () => {
    expect(hueSpan(ruleFor('warm-light-low'))).toBe(68); // 28 → 96
    expect(hueSpan(ruleFor('neutral-light-low'))).toBe(80); // 335 → 55, wrapping
    expect(hueSpan(ruleFor('cool-light-low'))).toBe(90); // 258 → 348
  });
});

describe('all 27 rules produce a well-formed palette', () => {
  for (const undertone of UNDERTONES) {
    for (const depth of DEPTHS) {
      for (const contrast of CONTRASTS) {
        const key = `${undertone}-${depth}-${contrast}`;

        it(`${key} yields 6 swatches, each named, reasoned and valid`, () => {
          const palette = buildPalette(axesFor(undertone, depth, contrast));

          expect(palette.swatches).toHaveLength(SWATCH_COUNT);
          expect(palette.swatches).toHaveLength(6);

          for (const swatch of palette.swatches) {
            expect(swatch.hex).toMatch(/^#[0-9a-f]{6}$/);
            expect(swatch.name.trim().length).toBeGreaterThan(0);
            expect(ALL_SHADE_NAMES).toContain(swatch.name);
            expect(swatch.reason.trim().length).toBeGreaterThan(0);
            // The reported LAB must be the LAB of the colour actually painted.
            expect(swatch.lab).toEqual(hexToLab(swatch.hex));
          }

          // Distinct names within a palette — the collision walk must resolve.
          const names = palette.swatches.map((s) => s.name);
          expect(new Set(names).size).toBe(6);

          // Distinct colours too.
          expect(new Set(palette.swatches.map((s) => s.hex)).size).toBe(6);
        });
      }
    }
  }

  it('always returns 2 neutrals, 2 primaries, 1 accent and 1 statement', () => {
    for (const key of ALL_RULE_KEYS) {
      const [undertone, depth, contrast] = key.split('-') as [Undertone, Depth, Contrast];
      const roles = buildPalette(axesFor(undertone, depth, contrast)).swatches.map((s) => s.role);
      expect(roles, key).toEqual(['neutral', 'neutral', 'primary', 'primary', 'accent', 'statement']);
    }
  });

  it('never exceeds the saturation ceiling its contrast permits', () => {
    for (const key of ALL_RULE_KEYS) {
      const [undertone, depth, contrast] = key.split('-') as [Undertone, Depth, Contrast];
      const palette = buildPalette(axesFor(undertone, depth, contrast));
      const ceiling = palette.derivation.rule.saturationCeiling;
      for (const swatch of palette.swatches) {
        // Small tolerance: chroma is measured after the hex round-trip, which quantises
        // each channel to 8 bits.
        expect(labToLch(swatch.lab).c, `${key} / ${swatch.name}`).toBeLessThanOrEqual(ceiling + 1.5);
      }
    }
  });

  it('produces lower-chroma palettes for low contrast than for high contrast', () => {
    const meanChroma = (contrast: Contrast) => {
      const palette = buildPalette(axesFor('warm', 'medium', contrast));
      const total = palette.swatches.reduce((sum, s) => sum + labToLch(s.lab).c, 0);
      return total / palette.swatches.length;
    };
    expect(meanChroma('low')).toBeLessThan(meanChroma('medium'));
    expect(meanChroma('medium')).toBeLessThan(meanChroma('high'));
  });
});

describe('determinism', () => {
  it('returns byte-identical output for identical input', () => {
    for (const key of ALL_RULE_KEYS) {
      const [undertone, depth, contrast] = key.split('-') as [Undertone, Depth, Contrast];
      const first = buildPalette(axesFor(undertone, depth, contrast));
      const second = buildPalette(axesFor(undertone, depth, contrast));
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    }
  });

  it('is stable across 50 repeat runs of the same reading', () => {
    const reading: ColorToneReading = {
      skin: hexToLab('#e3b89a'),
      hair: hexToLab('#2d1b14'),
    };
    const baseline = JSON.stringify(buildPaletteFromReading(reading));
    for (let i = 0; i < 50; i += 1) {
      expect(JSON.stringify(buildPaletteFromReading(reading))).toBe(baseline);
    }
  });

  it('changes output when — and only when — an axis changes', () => {
    const base = JSON.stringify(buildPalette(axesFor('warm', 'medium', 'medium')));
    // Same axes, different raw measurements that land in the same bands: the swatches
    // are identical, copy included, because the rule table only ever sees the bands.
    // The raw readings survive in the derivation notes, which is where they belong.
    const sameBands = buildPalette({
      ...axesFor('warm', 'medium', 'medium'),
      skinLightness: 58,
      hairLightness: 30,
      contrastValue: 28,
      skinHueAngle: 70,
    });
    expect(JSON.stringify(sameBands.swatches)).toBe(JSON.stringify(JSON.parse(base).swatches));
    // …but the trace still reports what was actually measured.
    expect(sameBands.derivation.axes.skinLightness).toBe(58);
    expect(sameBands.derivation.notes[0]).toContain('58');

    // A different band gives a different palette.
    expect(JSON.stringify(buildPalette(axesFor('warm', 'deep', 'medium')))).not.toBe(base);
    expect(JSON.stringify(buildPalette(axesFor('cool', 'medium', 'medium')))).not.toBe(base);
    expect(JSON.stringify(buildPalette(axesFor('warm', 'medium', 'high')))).not.toBe(base);
  });
});

describe('axis classification', () => {
  it('splits depth at 65 and 45', () => {
    expect(classifyDepth(80)).toBe('light');
    expect(classifyDepth(65.1)).toBe('light');
    expect(classifyDepth(65)).toBe('medium');
    expect(classifyDepth(45)).toBe('medium');
    expect(classifyDepth(44.9)).toBe('deep');
  });

  it('splits contrast at 20 and 40', () => {
    expect(classifyContrast(19.9)).toBe('low');
    expect(classifyContrast(20)).toBe('medium');
    expect(classifyContrast(40)).toBe('medium');
    expect(classifyContrast(40.1)).toBe('high');
  });

  it('splits undertone at 50° and 60° of skin hue', () => {
    expect(classifyUndertone(42)).toBe('cool');
    expect(classifyUndertone(50)).toBe('neutral');
    expect(classifyUndertone(60)).toBe('neutral');
    expect(classifyUndertone(61)).toBe('warm');
  });

  it('measures contrast as the absolute L* gap, whichever is lighter', () => {
    const darkHair = toneAxesFromReading({ skin: { l: 70, a: 12, b: 18 }, hair: { l: 20, a: 4, b: 6 } });
    const lightHair = toneAxesFromReading({ skin: { l: 20, a: 12, b: 18 }, hair: { l: 70, a: 4, b: 6 } });
    expect(darkHair.contrastValue).toBe(50);
    expect(lightHair.contrastValue).toBe(50);
    expect(darkHair.contrast).toBe('high');
    expect(lightHair.contrast).toBe('high');
  });

  it('lets an API-supplied undertone override the hue classifier', () => {
    const reading: ColorToneReading = { skin: { l: 70, a: 8, b: 20 }, hair: { l: 25, a: 3, b: 5 } };
    expect(toneAxesFromReading(reading).undertone).toBe('warm');
    expect(toneAxesFromReading(reading, 'cool').undertone).toBe('cool');
  });

  it('builds the rule key in the documented order', () => {
    expect(ruleKeyFor({ undertone: 'cool', depth: 'deep', contrast: 'high' })).toBe('cool-deep-high');
  });
});

describe('derivation trace', () => {
  it('carries its own inputs, matched rule key and ceiling', () => {
    const axes = axesFor('cool', 'deep', 'high');
    const palette = buildPalette(axes);

    expect(palette.derivation.axes).toEqual(axes);
    expect(palette.derivation.ruleKey).toBe('cool-deep-high');
    expect(palette.derivation.rule).toEqual(ruleFor('cool-deep-high'));
    expect(palette.derivation.rule.saturationCeiling).toBe(62);
  });

  it('renders one note per axis, each quoting the measurement behind it', () => {
    const palette = buildPalette(axesFor('warm', 'light', 'low'));
    const notes = palette.derivation.notes;

    expect(notes).toHaveLength(3);
    expect(notes[0]).toContain('74'); // skin L*
    expect(notes[1]).toContain('12'); // contrast value
    expect(notes[2]).toContain('66'); // skin hue angle
    for (const note of notes) expect(note.trim().length).toBeGreaterThan(0);
  });
});

describe('product language rules', () => {
  it('never uses clinical vocabulary in a swatch name or reason', () => {
    const banned = [
      'diagnos',
      'condition',
      'treatment',
      'problem',
      'flaw',
      'severity',
      'correct',
      'fix',
      'cure',
      'symptom',
    ];
    for (const key of ALL_RULE_KEYS) {
      const [undertone, depth, contrast] = key.split('-') as [Undertone, Depth, Contrast];
      const palette = buildPalette(axesFor(undertone, depth, contrast));
      const prose = [
        ...palette.swatches.map((s) => `${s.name} ${s.reason}`),
        ...palette.derivation.notes,
      ]
        .join(' ')
        .toLowerCase();
      for (const word of banned) {
        expect(prose, `"${word}" appeared in ${key}`).not.toContain(word);
      }
    }
  });
});
