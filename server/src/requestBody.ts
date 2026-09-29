import express from 'express';
import type { YouCamConfig } from './youcam/config.js';

const FIXTURE_LIMIT_BYTES = 32 * 1024;
const LIVE_LIMIT_BYTES = 70 * 1024 * 1024;

/** The one place this number is computed, so the body parser and the pre-parse guard in
 * requestGuards.ts can never disagree about what "too large" means. */
export function requestBodyLimitBytes(config: YouCamConfig): number {
  const acceptsImages = !config.fixtureMode || config.liveSkinAnalysis || config.liveTryOn;
  return acceptsImages ? LIVE_LIMIT_BYTES : FIXTURE_LIMIT_BYTES;
}

/** Live uploads may be enabled while the unverified palette stays in fixture mode. */
export function createRequestBodyParser(config: YouCamConfig) {
  return express.json({ limit: requestBodyLimitBytes(config) });
}
