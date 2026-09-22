import express from 'express';
import type { YouCamConfig } from './youcam/config.js';

/** Live uploads may be enabled while the unverified palette stays in fixture mode. */
export function createRequestBodyParser(config: YouCamConfig) {
  const acceptsImages = !config.fixtureMode || config.liveSkinAnalysis || config.liveTryOn;
  return express.json({ limit: acceptsImages ? '70mb' : '32kb' });
}
