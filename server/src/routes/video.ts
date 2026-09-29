/** Five-second video from a completed image. Official contract is documented;
 * TASK_PATH_VERIFIED.video gates paid work pending owner release acceptance. */

import { Router, type Response } from 'express';
import type { ApiErrorBody, VideoRequest, VideoResponse } from '@yincol/shared';
import { asyncRoute } from './asyncRoute.js';
import { loadConfig, TASK_PATH_VERIFIED } from '../youcam/config.js';
import { FEATURES, buildVideoPayload } from '../youcam/features.js';
import { fileUploadStrategy, MAX_FILE_BYTES } from '../youcam/imageInput.js';
import { runTask } from '../youcam/taskRunner.js';
import { captureVideoLive, videoFailure } from '../youcam/adapters/video.js';
import { logFailure, publicFailureReason } from '../youcam/publicError.js';
import { VIDEO_UNIT_COST } from '../youcam/budget.js';
import { browserIdFrom, idempotencyKeyFor, reserveBudget, settleBudget } from './budgetGate.js';

export const videoRouter = Router();

/** The one fixture image the shipped demo clip was actually captured against. */
const DEMO_SAMPLE_IMAGE_URL = '/fixtures/complete-look-a-result.jpg';
const DEMO_SAMPLE_VIDEO_URL = '/fixtures/garment-a-motion-sample.mp4';

const LIVE_IMAGE_DATA_URL = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+=*)$/;

const badRequest = (res: Response, error: string): void => {
  const body: ApiErrorBody = { error };
  res.status(400).json(body);
};

videoRouter.post('/video', asyncRoute(async (req, res) => {
  const config = loadConfig();
  const body = req.body as Partial<VideoRequest> | undefined;
  const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl : '';

  if (!imageUrl) {
    badRequest(res, 'Choose a completed image before generating a video.');
    return;
  }

  if (!config.liveVideo) {
    if (imageUrl === DEMO_SAMPLE_IMAGE_URL) {
      const response: VideoResponse = {
        video: {
          result: { status: 'ready', videoUrl: DEMO_SAMPLE_VIDEO_URL, alt: 'Saved five-second motion sample' },
          provenance: 'captured',
        },
        mode: 'fixture',
      };
      res.json(response);
      return;
    }
    const response: VideoResponse = {
      video: {
        result: { status: 'failed', reason: 'A demo video is only available for the saved example that ships with one.' },
        provenance: 'placeholder',
      },
      mode: 'fixture',
    };
    res.json(response);
    return;
  }

  // ── Live — see the file header: this cannot actually reach the provider yet ────
  if (!TASK_PATH_VERIFIED.video) {
    res.status(503).json({ error: 'Live video is awaiting release verification. Saved clips remain available.' });
    return;
  }
  const match = LIVE_IMAGE_DATA_URL.exec(imageUrl);
  if (!match) {
    badRequest(res, 'Choose a completed image before generating a video.');
    return;
  }
  const [, contentType, base64] = match;
  const bytes = Buffer.from(base64!, 'base64');
  if (bytes.length === 0 || bytes.length >= MAX_FILE_BYTES) {
    badRequest(res, 'That image could not be used to generate a video.');
    return;
  }

  const browserId = browserIdFrom(req);
  const idempotencyKey = idempotencyKeyFor([browserId, bytes]);
  const reservationId = await reserveBudget(res, browserId, VIDEO_UNIT_COST, idempotencyKey);
  if (!reservationId) return;

  try {
    const reference = await fileUploadStrategy.prepare(
      { bytes, contentType, fileName: 'video-source.jpg' },
      'video',
      config,
    );
    const { raw } = await runTask(config, FEATURES.video, buildVideoPayload(reference));
    const captured = await captureVideoLive(raw, 'video', 'A five-second clip generated from this image');
    await settleBudget(reservationId, captured.status === 'ready' ? 'success' : 'ambiguous');

    const response: VideoResponse = { video: { result: captured.result, provenance: 'live' }, mode: 'live' };
    res.set('Cache-Control', 'private, no-store').json(response);
  } catch (error) {
    await settleBudget(reservationId, 'ambiguous');
    logFailure('video generation', error);
    const reason = publicFailureReason(error, 'This video could not be generated.');
    const response: VideoResponse = { video: { result: videoFailure(reason), provenance: 'live' }, mode: 'live' };
    res.json(response);
  }
}));
