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
 *   YINCOL_FIXTURE_MODE=false YINCOL_API_KEY=… npm run capture-fixtures
 *
 * Source images are read from assets/source/ and uploaded through the verified File API
 * paths. Facial Color Tone is intentionally skipped until its File API input contract
 * is verified.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { loadRootEnv } from '../src/loadEnv.js';
import { loadConfig } from '../src/youcam/config.js';
import { FEATURES, buildSkinAnalysisPayload } from '../src/youcam/features.js';
import { runTask, type RawTaskResult } from '../src/youcam/taskRunner.js';
import { fileUploadStrategy, type ImageSource } from '../src/youcam/imageInput.js';
import { runCompleteLookSequence } from '../src/youcam/completeLook.js';
import { adaptSkinAnalysis } from '../src/youcam/adapters/skinAnalysis.js';
import { redactUrlsDeep } from '../src/youcam/redact.js';
import { CAPTURE_TARGETS, FIXTURE_PUBLIC_DIR } from '../src/fixtures/index.js';
import { findGarment, findMakeupLook } from '@yincol/shared';

/**
 * The look the captured complete-look fixtures use.
 *
 * One look, because the makeup step runs per garment and capturing every look against
 * every garment would multiply the credit cost for no demo benefit. Any other look in the
 * picker falls back to the designed placeholder, which says so.
 */
const FIXTURE_MAKEUP_LOOK_ID = 'rose-veil';

loadRootEnv();

const config = loadConfig();
const SOURCE_DIR = join(FIXTURE_PUBLIC_DIR, '..', '..', '..', 'assets', 'source');

const CONTENT_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

function requireLiveMode(): void {
  // The key is checked first because `loadConfig` fails closed: with no key it forces
  // fixture mode on, and reporting that as "fixture mode is on" would hide the real cause.
  if (!config.apiKey) {
    throw new Error('YINCOL_API_KEY is empty. Set it in .env (which is gitignored).');
  }
  if (config.fixtureMode) {
    throw new Error(
      'Refusing to run: fixture mode is on. This script spends real API credits.\n' +
        'Set YINCOL_FIXTURE_MODE=false explicitly to capture.',
    );
  }
}

function readLocalSource(filename: string): ImageSource {
  const path = join(SOURCE_DIR, filename);
  if (!existsSync(path)) {
    throw new Error(`Missing source image: assets/source/${filename}`);
  }

  const contentType = CONTENT_TYPE_BY_EXTENSION[extname(filename).toLowerCase()];
  if (!contentType) {
    throw new Error(`Unsupported source image type: assets/source/${filename}`);
  }

  return {
    bytes: readFileSync(path),
    contentType,
    fileName: filename,
  };
}

/**
 * Write the success payload beside the fixture, so the real shape gets recorded.
 *
 * URLs are redacted first. A successful task returns a presigned S3 link carrying
 * `X-Amz-Credential`, `X-Amz-Signature` and a two-hour expiry — a bearer credential for a
 * generated image of a face, and these files are committed. The record exists to document
 * which fields come back and how they nest, and redaction costs it none of that.
 */
function recordShape(name: string, raw: RawTaskResult): void {
  const target = join(FIXTURE_PUBLIC_DIR, '..', '..', '..', 'docs', 'captured-shapes');
  mkdirSync(target, { recursive: true });
  writeFileSync(
    join(target, `${name}.json`),
    JSON.stringify(redactUrlsDeep(raw), null, 2),
    'utf8',
  );
  console.log(`  ↳ response shape written to docs/captured-shapes/${name}.json`);
}

/**
 * Write one step's bytes to disk.
 *
 * The sequence has already downloaded them — it has to, because step 2's input is step
 * 1's image — so by the time this runs the two-hour rule has been honoured and there is
 * nothing left to race.
 */
function writeFixture(label: string, filename: string, bytes: Buffer): void {
  mkdirSync(FIXTURE_PUBLIC_DIR, { recursive: true });
  writeFileSync(join(FIXTURE_PUBLIC_DIR, filename), bytes);
  console.log(`  ✓ ${label} → web/public/fixtures/${filename} (${bytes.length} bytes)`);
}

async function main(): Promise<void> {
  requireLiveMode();

  console.log('\n[1/3] Facial colour tone');
  console.log('  - skipped: the File API input and task contract are not verified yet.');

  const portraitSource = readLocalSource(CAPTURE_TARGETS.portrait.source);

  console.log('\n[2/3] Skin analysis');
  try {
    const portrait = await fileUploadStrategy.prepare(portraitSource, 'skinAnalysis', config);
    const { raw } = await runTask(config, FEATURES.skinAnalysis, buildSkinAnalysisPayload(portrait));
    recordShape('skin-analysis', raw);
    const appearance = adaptSkinAnalysis(raw);
    console.log(`  ✓ ${appearance.signals.length} appearance signals read`);
  } catch (error) {
    console.error(`  ✗ ${(error as Error).message}`);
  }

  // ── the complete-look sequence, once per garment ───────────
  //
  // Two fixtures come out of each garment, because two images come out of the live path:
  // the garment task's own result, and that result after the makeup task rendered the
  // effects onto it. Capturing them the same way the browser route generates them is the
  // point — a fixture that was produced differently from the thing it stands in for is
  // not much of a fixture.
  const look = findMakeupLook(FIXTURE_MAKEUP_LOOK_ID);
  if (!look) throw new Error(`Unknown makeup look ${FIXTURE_MAKEUP_LOOK_ID}.`);

  console.log('\n[3/3] Complete look — clothes, then makeup on the clothes result');
  for (const target of CAPTURE_TARGETS.garments) {
    const garment = findGarment(target.catalogId);
    const label = garment?.name ?? target.catalogId;

    try {
      const portrait = await fileUploadStrategy.prepare(portraitSource, 'clothesVto', config);
      const garmentSource = readLocalSource(target.source);
      const garmentImage = await fileUploadStrategy.prepare(garmentSource, 'clothesVto', config);

      // The same function the browser route calls. The script differs only in how the
      // first step's inputs are prepared — local bytes here, tab-held bytes in the browser —
      // and in writing each step's bytes down as they arrive.
      const outcome = await runCompleteLookSequence({
        config,
        portrait,
        garment: garmentImage,
        garmentCategory: garment?.category ?? 'upper_body',
        look,
        garmentName: label,
        onStep: (step, detail) => {
          const filename = step === 'garment' ? target.fixture : target.completeLookFixture;
          const stepLabel = step === 'garment' ? label : `${label} + ${look.name}`;
          recordShape(`${step}-${target.catalogId}`, detail.raw);
          writeFixture(stepLabel, filename, detail.image.bytes);
        },
      });

      for (const [step, panel] of [
        ['garment', outcome.garmentOnly],
        ['complete look', outcome.completeLook],
      ] as const) {
        if (panel.result.status === 'failed') {
          console.error(`  ✗ ${label} ${step}: ${panel.result.reason}`);
        }
      }
    } catch (error) {
      // A failed task consumes no credits, so a failure here costs nothing but time.
      console.error(`  ✗ ${label}: ${(error as Error).message}`);
    }
  }

  console.log('\n[yincol] capture complete. Commit the bytes in web/public/fixtures/.');
}

main().catch((error: unknown) => {
  console.error(`[yincol] capture failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
