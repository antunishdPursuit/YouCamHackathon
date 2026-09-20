import { asyncRoute } from './asyncRoute.js';
import { rejectImageBytesInFixtureMode } from './fixtureGuard.js';
/**
 * POST /api/analyze — colour tone + skin appearance → palette.
 *
 * The two analysis calls run through `Promise.allSettled`, never `Promise.all`. Skin
 * analysis is optional context; the palette is the product. If skin analysis fails, the
 * palette still ships and the UI quietly omits a section.
 */

import { Router } from 'express';
import type {
  AnalyzeResponse,
  ApiErrorBody,
  ColorToneReading,
  SkinAppearance,
  Undertone,
} from '@yincol/shared';
import { buildPaletteFromReading } from '@yincol/shared';
import { loadConfig } from '../youcam/config.js';
import { FEATURES, buildFacialColorTonePayload, buildSkinAnalysisPayload } from '../youcam/features.js';
import { runTask } from '../youcam/taskRunner.js';
import { publicUrlStrategy } from '../youcam/imageInput.js';
import { logFailure } from '../youcam/publicError.js';
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

analyzeRouter.post('/analyze', asyncRoute(async (req, res) => {
  const config = loadConfig();
  if (config.fixtureMode && rejectImageBytesInFixtureMode(req.body, res)) return;
  const rawRef = (req.body as { portraitRef?: unknown } | undefined)?.portraitRef;
  const portraitRef = typeof rawRef === 'string' ? rawRef : '';

  const [toneSettled, skinSettled] = await Promise.allSettled([
    config.fixtureMode
      ? fixtureDelay().then<ToneOutcome>(() => {
          if (config.simulate === 'noFace') throw new Error('no-face-detected');
          return { reading: FIXTURE_COLOR_TONE };
        })
      : readColorToneLive(portraitRef),
    config.fixtureMode
      ? fixtureDelay().then(() => {
          if (config.simulate === 'skinUnavailable') throw new Error('skin-unavailable');
          return FIXTURE_SKIN_APPEARANCE;
        })
      : readSkinLive(portraitRef),
  ]);

  // Colour tone is the one call we cannot do without — no reading, no palette.
  if (toneSettled.status === 'rejected') {
    // The reason itself never ships. On the live path it is a provider error carrying
    // the vendor's raw response body, and there is no version of that a shopper needs.
    logFailure('analyze colour tone', toneSettled.reason);

    const noFace = String(toneSettled.reason).includes('no-face-detected');
    const body: ApiErrorBody = {
      code: noFace ? 'noFace' : 'colorToneFailed',
      error: noFace
        ? 'We could not find a face in that photograph.'
        : 'We could not read the colours in that photograph.',
    };
    res.status(422).json(body);
    return;
  }

  if (skinSettled.status === 'rejected') logFailure('analyze skin appearance', skinSettled.reason);

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
}));
