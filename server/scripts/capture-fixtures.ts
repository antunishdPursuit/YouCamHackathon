/**
 * Capture fixtures — run the real API once, keep the results forever.
 *
 * This is the only thing in the repository that produces a RESULT image. If a picture
 * in web/public/fixtures/ did not come from this script, it is a placeholder, and it
 * must never be described as an API output.
 *
 * ⚠ THE TWO-HOUR RULE. A successful task returns a download URL that is valid for two
 * hours. `task_id` lives 30 days, but the link does not. So this script downloads the
 * bytes the instant a task succeeds, before doing anything else — no batching, no
 * collecting URLs to fetch at the end. Bytes are what survive to demo day.
 *
 * Run with:
 *   YINCOL_FIXTURE_MODE=false YINCOL_API_KEY=… YINCOL_PUBLIC_ASSET_BASE_URL=… \
 *     npm run capture-fixtures
 *
 * The public asset base URL must be reachable from the public internet — the API
 * fetches the source images itself, so localhost will not do.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRootEnv } from '../src/loadEnv.js';
import { loadConfig, RESULT_URL_TTL_HOURS } from '../src/youcam/config.js';
import {
  FEATURES,
  buildClothesVtoPayload,
  buildFacialColorTonePayload,
  buildMakeupTransferPayload,
  buildSkinAnalysisPayload,
  isTaskPathVerified,
} from '../src/youcam/features.js';
import { downloadResult, runTask, type RawTaskResult } from '../src/youcam/taskRunner.js';
import { publicUrlStrategy } from '../src/youcam/imageInput.js';
import { adaptColorTone } from '../src/youcam/adapters/facialColorTone.js';
import { adaptSkinAnalysis } from '../src/youcam/adapters/skinAnalysis.js';
import { adaptTryOnUrl } from '../src/youcam/adapters/tryOn.js';
import { CAPTURE_TARGETS, FIXTURE_PUBLIC_DIR } from '../src/fixtures/index.js';
import { findGarment } from '@yincol/shared';

loadRootEnv();

const config = loadConfig();

function requireLiveMode(): void {
  if (config.fixtureMode) {
    throw new Error(
      'Refusing to run: fixture mode is on. This script spends real API credits.\n' +
        'Set YINCOL_FIXTURE_MODE=false explicitly to capture.',
    );
  }
  if (!config.apiKey) {
    throw new Error('YINCOL_API_KEY is empty. Set it in .env (which is gitignored).');
  }
  if (!config.publicAssetBaseUrl) {
    throw new Error(
      'YINCOL_PUBLIC_ASSET_BASE_URL is empty. The API fetches the source images itself, ' +
        'so they must sit somewhere publicly reachable — a localhost URL will not work.',
    );
  }
}

const sourceUrl = (filename: string): string => `${config.publicAssetBaseUrl}/${filename}`;

/** Write the full success payload beside the fixture, so the real shape gets recorded. */
function recordShape(name: string, raw: RawTaskResult): void {
  const target = join(FIXTURE_PUBLIC_DIR, '..', '..', '..', 'docs', 'captured-shapes');
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, `${name}.json`), JSON.stringify(raw, null, 2), 'utf8');
  console.log(`  ↳ response shape written to docs/captured-shapes/${name}.json`);
}

/** Download immediately. Not later. See the two-hour rule at the top of this file. */
async function captureImage(
  label: string,
  raw: RawTaskResult,
  feature: Parameters<typeof downloadResult>[1],
  filename: string,
): Promise<void> {
  const url = adaptTryOnUrl(raw);
  if (!url) {
    console.error(`  ✗ ${label}: task succeeded but no result URL could be read.`);
    return;
  }

  console.log(`  ↳ downloading now (URL expires in ~${RESULT_URL_TTL_HOURS}h)`);
  const { bytes } = await downloadResult(url, feature);
  mkdirSync(FIXTURE_PUBLIC_DIR, { recursive: true });
  writeFileSync(join(FIXTURE_PUBLIC_DIR, filename), bytes);
  console.log(`  ✓ ${label} → web/public/fixtures/${filename} (${bytes.length} bytes)`);
}

async function main(): Promise<void> {
  requireLiveMode();

  const sourceDir = join(FIXTURE_PUBLIC_DIR, '..', '..', '..', 'assets', 'source');
  const portraitFile = CAPTURE_TARGETS.portrait.source;
  if (!existsSync(join(sourceDir, portraitFile))) {
    console.warn(
      `[yincol] warning: assets/source/${portraitFile} not found locally. Continuing, ` +
        'because the API fetches from YINCOL_PUBLIC_ASSET_BASE_URL rather than from disk — ' +
        'but check the file really is published there.',
    );
  }

  const portrait = await publicUrlStrategy.prepare(
    { publicUrl: sourceUrl(portraitFile) },
    'facialColorTone',
  );

  // ── analysis ───────────────────────────────────────────────
  if (!isTaskPathVerified('facialColorTone')) {
    console.warn(
      '[yincol] note: the facial colour tone task path is UNVERIFIED. If this 404s, ' +
        'the path in server/src/youcam/config.ts is the thing to fix.',
    );
  }

  console.log('\n[1/4] Facial colour tone');
  try {
    const { raw } = await runTask(config, FEATURES.facialColorTone, buildFacialColorTonePayload(portrait));
    recordShape('facial-color-tone', raw);
    const adapted = adaptColorTone(raw);
    console.log(`  ✓ skin L* ${adapted.reading.skin.l}, hair L* ${adapted.reading.hair.l}`);
    console.log(`  ↳ keys received: ${adapted.rawKeys.join(', ')}`);
  } catch (error) {
    console.error(`  ✗ ${(error as Error).message}`);
  }

  console.log('\n[2/4] Skin analysis');
  try {
    const { raw } = await runTask(config, FEATURES.skinAnalysis, buildSkinAnalysisPayload(portrait));
    recordShape('skin-analysis', raw);
    const appearance = adaptSkinAnalysis(raw);
    console.log(`  ✓ ${appearance.signals.length} appearance signals read`);
  } catch (error) {
    console.error(`  ✗ ${(error as Error).message}`);
  }

  // ── garments ───────────────────────────────────────────────
  console.log('\n[3/4] Clothes try-on');
  for (const target of CAPTURE_TARGETS.garments) {
    const garment = findGarment(target.catalogId);
    const label = garment?.name ?? target.catalogId;
    try {
      const garmentImage = await publicUrlStrategy.prepare(
        { publicUrl: sourceUrl(target.source) },
        'clothesVto',
      );
      const { raw } = await runTask(
        config,
        FEATURES.clothesVto,
        buildClothesVtoPayload(portrait, garmentImage, garment?.category ?? 'upper_body'),
      );
      await captureImage(label, raw, 'clothesVto', target.fixture);
    } catch (error) {
      // A failed task consumes no credits, so a failure here costs nothing but time.
      console.error(`  ✗ ${label}: ${(error as Error).message}`);
    }
  }

  // ── makeup ─────────────────────────────────────────────────
  console.log('\n[4/4] Makeup transfer');
  for (const target of CAPTURE_TARGETS.makeup) {
    try {
      const reference = await publicUrlStrategy.prepare(
        { publicUrl: sourceUrl(target.source) },
        'makeupTransfer',
      );
      const { raw } = await runTask(
        config,
        FEATURES.makeupTransfer,
        buildMakeupTransferPayload(portrait, reference),
      );
      await captureImage(target.catalogId, raw, 'makeupTransfer', target.fixture);
    } catch (error) {
      console.error(`  ✗ ${target.catalogId}: ${(error as Error).message}`);
    }
  }

  console.log('\n[yincol] capture complete. Commit the bytes in web/public/fixtures/.');
}

main().catch((error: unknown) => {
  console.error(`[yincol] capture failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
