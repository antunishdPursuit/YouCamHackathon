/**
 * Internal domain types. These are the ONLY shapes the front end ever sees.
 *
 * Vendor JSON is translated inside `server/src/youcam/adapters/` and never escapes it.
 * If a field name here starts to look like a Perfect Corp field name, something has
 * leaked through the boundary.
 *
 * LANGUAGE RULE: this file describes appearance, never health. There is no `severity`,
 * no `problemAreas`, no `diagnosis`, no `condition` — not as a value and not as a field
 * name. Skin signals exist here only as context for choosing colour.
 */

// ─────────────────────────────────────────────────────────────
// Colour primitives
// ─────────────────────────────────────────────────────────────

/** A `#rrggbb` string, lowercase. */
export type Hex = string;

/** CIE L*a*b* under a D65 illuminant. */
export interface Lab {
  /** Lightness, 0 (black) – 100 (white). */
  readonly l: number;
  /** Green–red axis. */
  readonly a: number;
  /** Blue–yellow axis. */
  readonly b: number;
}

/** Cylindrical form of L*a*b*: lightness, chroma, hue angle in degrees. */
export interface Lch {
  readonly l: number;
  readonly c: number;
  /** Hue angle in degrees, 0–360. */
  readonly h: number;
}

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

// ─────────────────────────────────────────────────────────────
// The three palette axes
// ─────────────────────────────────────────────────────────────

export type Undertone = 'warm' | 'neutral' | 'cool';

/** Derived from skin L*: light > 65, medium 45–65, deep < 45. */
export type Depth = 'light' | 'medium' | 'deep';

/**
 * Derived from the L* difference between hair and skin: low < 20, medium 20–40,
 * high > 40. Both values come back from the colour-tone API, so this axis is
 * measured rather than estimated.
 */
export type Contrast = 'low' | 'medium' | 'high';

/** `"${undertone}-${depth}-${contrast}"` — the key into the 27-entry rule table. */
export type RuleKey = `${Undertone}-${Depth}-${Contrast}`;

/**
 * What the colour-tone feature gives us, normalised. Every colour is a measured
 * reading of the person in the photograph.
 */
export interface ColorToneReading {
  readonly skin: Lab;
  readonly hair: Lab;
  readonly eye?: Lab;
  readonly eyebrow?: Lab;
  readonly lip?: Lab;
}

/** The three axes plus the raw measurements they were computed from. */
export interface ToneAxes {
  readonly undertone: Undertone;
  readonly depth: Depth;
  readonly contrast: Contrast;
  /** L* of the skin reading, retained so the derivation card can show its working. */
  readonly skinLightness: number;
  /** L* of the hair reading. */
  readonly hairLightness: number;
  /** |hairLightness − skinLightness|, the measured contrast value. */
  readonly contrastValue: number;
  /**
   * Hue angle of the skin reading in degrees. Undertone is classified from this,
   * so showing it makes the classification checkable rather than magical.
   */
  readonly skinHueAngle: number;
}

// ─────────────────────────────────────────────────────────────
// Palette
// ─────────────────────────────────────────────────────────────

/**
 * Six swatches, always in this order. Two neutrals to build on, two primaries to
 * wear most, one accent, one statement.
 */
export type SwatchRole = 'neutral' | 'primary' | 'accent' | 'statement';

export interface PaletteSwatch {
  readonly id: string;
  readonly role: SwatchRole;
  readonly hex: Hex;
  readonly lab: Lab;
  /** Poetic, from the fixed name table. Never generated at random. */
  readonly name: string;
  /** One plain-language line. The poetry lives in the name and never in here. */
  readonly reason: string;
}

/**
 * A rule-table entry. Undertone picks hue, depth picks lightness, contrast sets the
 * saturation ceiling — low contrast means muted, high contrast permits saturated.
 */
export interface PaletteRule {
  /** Inclusive hue window in degrees. May wrap past 360 (e.g. 340 → 40). */
  readonly hueStart: number;
  readonly hueEnd: number;
  /** Usable L* band. */
  readonly lightnessMin: number;
  readonly lightnessMax: number;
  /** Maximum chroma any swatch in this palette may reach. */
  readonly saturationCeiling: number;
}

/**
 * The palette carries its own derivation so the "how these were chosen" card renders
 * from data rather than from copy someone has to keep in sync.
 */
export interface DerivationTrace {
  readonly axes: ToneAxes;
  readonly ruleKey: RuleKey;
  readonly rule: PaletteRule;
  /** Plain-language sentences, one per axis, describing what was measured. */
  readonly notes: readonly string[];
}

export interface Palette {
  readonly swatches: readonly PaletteSwatch[];
  readonly derivation: DerivationTrace;
}

// ─────────────────────────────────────────────────────────────
// Fit scoring
// ─────────────────────────────────────────────────────────────

export interface SwatchFit {
  readonly swatchId: string;
  readonly swatchName: string;
  readonly swatchHex: Hex;
  /** CIE76 ΔE between the garment colour and this swatch. */
  readonly deltaE: number;
  /** deltaE <= threshold */
  readonly within: boolean;
}

/**
 * The threshold travels with the score on purpose. A number with a visible threshold
 * beside it is a claim someone can check; a bare "4/6" is an assertion.
 */
export interface FitScore {
  readonly garmentHex: Hex;
  readonly garmentLab: Lab;
  readonly matched: number;
  readonly total: number;
  readonly threshold: number;
  readonly breakdown: readonly SwatchFit[];
  /** Rendered sentence — every fit signal carries text, never colour alone. */
  readonly summary: string;
}

// ─────────────────────────────────────────────────────────────
// Catalogue
// ─────────────────────────────────────────────────────────────

export type GarmentCategory = 'upper_body' | 'lower_body' | 'full_body';

export interface Garment {
  readonly id: string;
  readonly name: string;
  readonly category: GarmentCategory;
  /** Dominant colour, used for fit scoring. */
  readonly dominantHex: Hex;
  readonly colorName: string;
  /**
   * Product photograph, when the team has shot one. Optional on purpose: the picker
   * renders an illustrated card from `dominantHex` when there is no photograph, which
   * is honest — an illustration cannot be mistaken for a product shot we do not have.
   */
  readonly imageUrl?: string;
}

/**
 * Makeup transfer is REFERENCE-IMAGE BASED. The API extracts a look from a photo of a
 * made-up face; it does not accept shade values or SKUs.
 *
 * `referenceImageUrl` is therefore the only field the API ever sees. The lip / cheek /
 * eye chips below are HAND-AUTHORED DISPLAY METADATA describing what the reference
 * looks like — they are never sent anywhere and never influence the result.
 */
export interface MakeupLook {
  readonly id: string;
  readonly name: string;
  /** The only field that is API input. */
  readonly referenceImageUrl: string;
  /** Display-only. See the note above. */
  readonly chips: {
    readonly lip: { readonly hex: Hex; readonly name: string };
    readonly cheek: { readonly hex: Hex; readonly name: string };
    readonly eye: { readonly hex: Hex; readonly name: string };
  };
  readonly description: string;
}

// ─────────────────────────────────────────────────────────────
// Try-on results
// ─────────────────────────────────────────────────────────────

/**
 * A discriminated union, not an optional field, so a failed try-on has to be handled
 * at compile time. One try-on failing must never take down the other three.
 */
export type TryOnResult =
  | { readonly status: 'ready'; readonly imageUrl: string; readonly alt: string }
  | { readonly status: 'failed'; readonly reason: string };

/** The four photographs the UI can render. */
export type DisplaySlotId = 'portrait' | 'garmentA' | 'garmentB' | 'makeupOn';

// ─────────────────────────────────────────────────────────────
// Skin appearance — context for colour, never an assessment of a person
// ─────────────────────────────────────────────────────────────

export type AppearanceBand = 'soft' | 'balanced' | 'bright';

export interface SkinAppearanceSignal {
  readonly id: 'hydrationAppearance' | 'toneEvenness' | 'textureAppearance';
  readonly label: string;
  readonly band: AppearanceBand;
  /** Plain sentence explaining what this means for choosing colour. Never advice. */
  readonly note: string;
}

export interface SkinAppearance {
  readonly signals: readonly SkinAppearanceSignal[];
}
