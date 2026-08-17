/**
 * POST /api/skin-analysis — the browser-held portrait → YouCam Skin Analysis.
 *
 * This is deliberately separate from `/api/analyze`. The palette still depends on the
 * unverified Facial Color Tone task, while this route uses the verified Skin Analysis
 * File API path end to end.
 */

import { Router } from 'express';
import type { SkinAnalysisRequest, SkinAnalysisResponse } from '@yincol/shared';
import { FIXTURE_SKIN_APPEARANCE, fixtureDelay } from '../fixtures/index.js';
import { loadConfig } from '../youcam/config.js';
import { FEATURES, buildSkinAnalysisPayload } from '../youcam/features.js';
import {
  fileUploadStrategy,
  MAX_FILE_BYTES,
  SUPPORTED_IMAGE_TYPES,
} from '../youcam/imageInput.js';
import { adaptSkinAnalysis } from '../youcam/adapters/skinAnalysis.js';
import { runTask, YouCamError } from '../youcam/taskRunner.js';

export const skinAnalysisRouter = Router();

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

interface ImageBody {
  readonly data?: unknown;
  readonly contentType?: unknown;
  readonly fileName?: unknown;
}

export function decodeImageBody(image: ImageBody | undefined): {
  readonly bytes: Buffer;
  readonly contentType: string;
  readonly fileName: string;
} {
  const data = typeof image?.data === 'string' ? image.data : '';
  const contentType = typeof image?.contentType === 'string' ? image.contentType : '';
  const fileName = typeof image?.fileName === 'string' ? image.fileName : 'portrait';

  if (!data || data.length % 4 !== 0 || !BASE64_PATTERN.test(data)) {
    throw new Error('The image payload is not valid base64.');
  }
  if (!SUPPORTED_IMAGE_TYPES.has(contentType)) {
    throw new Error('Only JPEG and PNG files can be sent for live analysis.');
  }

  const bytes = Buffer.from(data, 'base64');
  if (bytes.length === 0 || bytes.length >= MAX_FILE_BYTES) {
    throw new Error('The image must be smaller than 10 MB.');
  }

  return {
    bytes,
    contentType,
    fileName: fileName.slice(0, 255) || 'portrait',
  };
}

function isNoFaceFailure(error: unknown): boolean {
  if (!(error instanceof YouCamError)) return false;
  return /face|no_face|src_face/i.test(error.message);
}

skinAnalysisRouter.post('/skin-analysis', async (req, res) => {
  const config = loadConfig();

  // The route remains safe to call in the normal fixture demo. The explicit env flag
  // is the only way to spend a Skin Analysis unit while the rest of the flow is still
  // fixture-backed.
  if (!config.liveSkinAnalysis) {
    await fixtureDelay();
    const response: SkinAnalysisResponse = {
      skin: FIXTURE_SKIN_APPEARANCE,
      mode: 'fixture',
    };
    res.json(response);
    return;
  }

  const body = req.body as Partial<SkinAnalysisRequest> | undefined;

  let image: ReturnType<typeof decodeImageBody>;
  try {
    image = decodeImageBody(body?.image as ImageBody | undefined);
  } catch (error) {
    res.status(400).json({
      code: 'general',
      error: error instanceof Error ? error.message : 'That image could not be read.',
    });
    return;
  }

  try {
    const reference = await fileUploadStrategy.prepare(
      image,
      'skinAnalysis',
      config,
    );
    const { raw } = await runTask(
      config,
      FEATURES.skinAnalysis,
      buildSkinAnalysisPayload(reference),
    );

    const response: SkinAnalysisResponse = {
      skin: adaptSkinAnalysis(raw),
      mode: 'live',
    };
    res.json(response);
  } catch (error) {
    console.error('[yincol] skin analysis failed', error instanceof Error ? error.message : error);

    const noFace = isNoFaceFailure(error);
    res.status(noFace ? 422 : 502).json({
      code: noFace ? 'noFace' : 'general',
      error: noFace
        ? 'We could not find a face in that photograph.'
        : 'We could not analyse that photograph just now.',
    });
  }
});
