/**
 * The fixture layer.
 *
 * FIXTURE MODE IS THE DEFAULT, and it is not a debugging convenience — it is how the
 * demo runs. Zero network access, zero API credits, on venue wifi.
 *
 * Two rules shape this file:
 *
 *  1. Fixtures store BYTES, not URLs. The API's download URLs expire after two hours,
 *     so anything captured is downloaded immediately and committed as a file. A fixture
 *     that held a URL would be dead by the morning of the demo.
 *
 *  2. A fixture is labelled with its provenance. `captured` means a real API result
 *     that we downloaded. `placeholder` means a designed stand-in that shipped with the
 *     repo. The UI shows the difference, because presenting the second as the first
 *     would be a lie told to a judge.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { ColorToneReading, Provenance, SkinAppearance, TryOnResult } from '@yincol/shared';
import { hexToLab } from '@yincol/shared';

const here = dirname(fileURLToPath(import.meta.url));

/** Fixture images live in the web app's public directory so Vite serves them directly. */
export const FIXTURE_PUBLIC_DIR = join(here, '..', '..', '..', 'web', 'public', 'fixtures');

/**
 * The artificial delay is deliberate and must not be removed.
 *
 * The analysis screen shows three named steps rather than a bare spinner, and a loading
 * state nobody ever sees is a loading state nobody maintains. ~1.2s per call keeps that
 * animation exercised every time anyone runs the app.
 */
export const FIXTURE_DELAY_MS = 1_200;

export const fixtureDelay = (ms: number = FIXTURE_DELAY_MS): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─────────────────────────────────────────────────────────────
// Analysis fixtures
// ─────────────────────────────────────────────────────────────

/**
 * A plausible colour-tone reading, written as hex and converted on load so the numbers
 * stay legible to a human editing this file.
 *
 * Skin #e0b492 reads at roughly L* 76 with a hue around 62°, and hair #3b2a22 at
 * roughly L* 19 — a light depth with high contrast, which exercises the most saturated
 * corner of the rule table. Change these two values to demo a different palette.
 */
export const FIXTURE_COLOR_TONE: ColorToneReading = {
  skin: hexToLab('#e0b492'),
  hair: hexToLab('#3b2a22'),
  eye: hexToLab('#4a3728'),
  eyebrow: hexToLab('#4a352a'),
  lip: hexToLab('#bc7a72'),
};

/**
 * Appearance context only. Bands describe how colour will read, never the person.
 */
export const FIXTURE_SKIN_APPEARANCE: SkinAppearance = {
  signals: [
    {
      id: 'hydrationAppearance',
      label: 'Hydration appearance',
      band: 'balanced',
      note: 'Both matte and luminous finishes read comfortably.',
    },
    {
      id: 'toneEvenness',
      label: 'Even-looking tone',
      band: 'bright',
      note: 'The stronger colours in your palette have room to be worn boldly.',
    },
    {
      id: 'textureAppearance',
      label: 'Texture appearance',
      band: 'balanced',
      note: 'Nothing in your palette needs adjusting for texture.',
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// Image fixtures
// ─────────────────────────────────────────────────────────────

/**
 * Which catalogue entries the three supplied source images correspond to.
 *
 * ASSUMPTION(phase0): the brief supplies exactly one portrait and two garments, but the
 * picker offers eight garments and five looks. So one pair of garments and one look can
 * have real captured results; everything else renders the designed placeholder. Makeup
 * is configured by the server and has no source image in the current API contract.
 */
export const CAPTURE_TARGETS = {
  portrait: { source: 'portrait.jpg', fixture: 'portrait.jpg' },
  garments: [
    { catalogId: 'rosewater-cardigan', source: 'garment-a.jpg', fixture: 'garment-a-result.jpg' },
    { catalogId: 'sage-linen-shirt', source: 'garment-b.jpg', fixture: 'garment-b-result.jpg' },
  ],
  makeup: [{ catalogId: 'rose-veil', fixture: 'makeup-on-result.jpg' }],
} as const;

/** Designed stand-ins that ship with the repo. Clearly marked as such, in the file. */
const PLACEHOLDER_FILES: Readonly<Record<string, string>> = {
  portrait: 'placeholder-portrait.svg',
  garmentA: 'placeholder-garment-a.svg',
  garmentB: 'placeholder-garment-b.svg',
  makeupOn: 'placeholder-makeup-on.svg',
};

export interface FixtureImage {
  readonly result: TryOnResult;
  readonly provenance: Provenance;
}

/**
 * Resolve one image slot.
 *
 * Prefers a captured fixture; falls back to the shipped placeholder. The provenance
 * comes back with it so the UI never has to guess which it got.
 */
export function resolveFixtureImage(
  capturedFilename: string | undefined,
  placeholderKey: keyof typeof PLACEHOLDER_FILES,
  alt: string,
): FixtureImage {
  if (capturedFilename && existsSync(join(FIXTURE_PUBLIC_DIR, capturedFilename))) {
    return {
      result: { status: 'ready', imageUrl: `/fixtures/${capturedFilename}`, alt },
      provenance: 'captured',
    };
  }

  const placeholder = PLACEHOLDER_FILES[placeholderKey];
  if (placeholder && existsSync(join(FIXTURE_PUBLIC_DIR, placeholder))) {
    return {
      result: { status: 'ready', imageUrl: `/fixtures/${placeholder}`, alt },
      provenance: 'placeholder',
    };
  }

  return {
    result: {
      status: 'failed',
      reason: 'No preview has been captured for this combination yet.',
    },
    provenance: 'placeholder',
  };
}

/** The captured fixture filename for a garment, if that garment is a capture target. */
export const capturedGarmentFixture = (garmentId: string): string | undefined =>
  CAPTURE_TARGETS.garments.find((target) => target.catalogId === garmentId)?.fixture;

/** The captured fixture filename for a makeup look, if it is a capture target. */
export const capturedMakeupFixture = (lookId: string): string | undefined =>
  CAPTURE_TARGETS.makeup.find((target) => target.catalogId === lookId)?.fixture;
