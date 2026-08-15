/**
 * POST /api/analyze — colour tone + skin appearance → palette.
 *
 * The two analysis calls run through `Promise.allSettled`, never `Promise.all`. Skin
 * analysis is optional context; the palette is the product. If skin analysis fails, the
 * palette still ships and the UI quietly omits a section.
 */

import { Router } from 'express';
import type { AnalyzeResponse, ColorToneReading, SkinAppearance, Undertone } from '@yincol/shared';
import { buildPaletteFromReading } from '@yincol/shared';
import { loadConfig } from '../youcam/config.js';
import { FEATURES, buildFacialColorTonePayload, buildSkinAnalysisPayload } from '../youcam/features.js';
import { runTask } from '../youcam/taskRunner.js';
import { publicUrlStrategy } from '../youcam/imageInput.js';
import { adaptColorTone } from '../youcam/adapters/facialColorTone.js';
import { adaptSkinAnalysis } from '../youcam/adapters/skinAnalysis.js';
import { FIXTURE_COLOR_TONE, FIXTURE_SKIN_APPEARANCE, fixtureDelay } from '../fixtures/index.js';

export const analyzeRouter = Router();

interface ToneOutcome {
  readonly reading: ColorToneReading;
  readonly undertone?: Undertone;
}

async function readColorToneLive(portraitUrl: string): Promise<ToneOutcome> {
  const config = loadConfig();
  const image = await publicUrlStrategy.prepare({ publicUrl: portraitUrl }, 'facialColorTone');
  const { raw } = await runTask(
    config,
    FEATURES.facialColorTone,
    buildFacialColorTonePayload(image),
  );
  const adapted = adaptColorTone(raw);
  return adapted.undertone
    ? { reading: adapted.reading, undertone: adapted.undertone }
    : { reading: adapted.reading };
}

async function readSkinLive(portraitUrl: string): Promise<SkinAppearance> {
  const config = loadConfig();
  const image = await publicUrlStrategy.prepare({ publicUrl: portraitUrl }, 'skinAnalysis');
  const { raw } = await runTask(config, FEATURES.skinAnalysis, buildSkinAnalysisPayload(image));
  return adaptSkinAnalysis(raw);
}

analyzeRouter.post('/analyze', async (req, res) => {
  const config = loadConfig();
  const portraitRef = String((req.body as { portraitRef?: unknown })?.portraitRef ?? '');

  const [toneSettled, skinSettled] = await Promise.allSettled([
    config.fixtureMode
      ? fixtureDelay().then<ToneOutcome>(() => ({ reading: FIXTURE_COLOR_TONE }))
      : readColorToneLive(portraitRef),
    config.fixtureMode
      ? fixtureDelay().then(() => FIXTURE_SKIN_APPEARANCE)
      : readSkinLive(portraitRef),
  ]);

  // Colour tone is the one call we cannot do without — no reading, no palette.
  if (toneSettled.status === 'rejected') {
    res.status(502).json({
      error: 'We could not read the colours in that photograph.',
      detail: String(toneSettled.reason),
    });
    return;
  }

  const { reading, undertone } = toneSettled.value;
  const palette = buildPaletteFromReading(reading, undertone);

  const response: AnalyzeResponse = {
    palette,
    mode: config.fixtureMode ? 'fixture' : 'live',
    ...(skinSettled.status === 'fulfilled'
      ? { skin: skinSettled.value }
      : { skinUnavailableReason: 'Skin appearance context is unavailable for this photograph.' }),
  };

  res.json(response);
});
