/**
 * YINCOL Express proxy, and in production the whole server.
 *
 * The API service keeps the API key server-side, keeps the rate limit and the live kill
 * switch in one place, and serves the fixture-backed routes. In the free public shape,
 * the static front end calls this service from its configured origin. No database, no
 * auth, no accounts: there is nothing to store, because nothing is kept.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { GARMENTS, MAKEUP_LOOKS } from '@yincol/shared';
import { loadRootEnv } from './loadEnv.js';
import { loadConfig, liveWasRequestedWithoutKey, TASK_PATH_VERIFIED } from './youcam/config.js';
import { createRateLimiter } from './rateLimit.js';
import { createRequestBodyParser, requestBodyLimitBytes } from './requestBody.js';
import { rejectOversizedContentLength } from './requestGuards.js';
import { createCorsMiddleware } from './cors.js';
import { analyzeRouter } from './routes/analyze.js';
import { skinAnalysisRouter } from './routes/skinAnalysis.js';
import { tryOnRouter } from './routes/tryOn.js';
import { videoRouter } from './routes/video.js';
import { logFailure } from './youcam/publicError.js';

loadRootEnv();

const startupConfig = loadConfig();
const app = express();

// In local development this stays unset and Vite's same-origin proxy is used. In the
// split public deployment it is the exact static-site origin, with no credentials or
// wildcard fallback.
app.use(createCorsMiddleware(process.env['YINCOL_ALLOWED_ORIGIN']));

/**
 * Trust the platform's proxy only where the deployment says there is one.
 *
 * `req.ip` is the rate limiter's key. Trusting `X-Forwarded-For` unconditionally would
 * let any caller choose their own key and walk straight past the limit.
 */
if ((process.env['YINCOL_TRUST_PROXY'] ?? '').toLowerCase() === 'true') {
  app.set('trust proxy', 1);
}

/**
 * The request-size ceiling follows the mode, because the mode decides what a legitimate
 * request can contain.
 *
 * When all image features use fixtures the browser sends fixture metadata — a few hundred bytes — and the
 * routes refuse image bytes outright, so 32 kB is generous. With any live image feature,
 * five sub-10 MB
 * images become just under 67 MB as base64 JSON, and each is still rejected at or above
 * the provider's 10 MB limit before upload.
 */
app.use(rejectOversizedContentLength(requestBodyLimitBytes(startupConfig)));
app.use(createRequestBodyParser(startupConfig));

/**
 * Two limits, because the two kinds of request cost different amounts.
 *
 * One generation is three requests, so the generation window allows roughly ten
 * generations a minute per address — far more than a person clicking, far less than a
 * script can use to fill the process.
 */
const generalLimit = createRateLimiter({ windowMs: 60_000, max: 120 });
const generationLimit = createRateLimiter({ windowMs: 60_000, max: 30 });

app.use('/api', generalLimit);

app.get('/api/health', (_req, res) => {
  const config = loadConfig();
  if (liveWasRequestedWithoutKey()) {
    res.status(503).json({ ok: false, error: 'Live generation is not configured. Please contact the studio owner.' });
    return;
  }
  res.json({
    ok: true,
    mode: config.fixtureMode ? 'fixture' : 'live',
    liveSkinAnalysis: config.liveSkinAnalysis,
    liveTryOn: config.liveTryOn,
    // Never echo the key itself, only whether one is present.
    hasApiKey: config.apiKey.length > 0,
    verifiedTaskPaths: TASK_PATH_VERIFIED,
    fullBodyTryOn: config.liveTryOn,
  });
});

/** The picker's contents. Static data, served so the front end has one source. */
app.get('/api/catalog', (_req, res) => {
  res.json({ garments: GARMENTS, makeupLooks: MAKEUP_LOOKS });
});

/**
 * Mounted on the generation paths themselves, once.
 *
 * Attaching it per router instead would run it once for every router the request walks
 * past on its way to the one that answers, so a `/try-on` call would spend three of its
 * own budget and an unmatched `/api` path would spend three of someone else's.
 */
app.use(['/api/analyze', '/api/skin-analysis', '/api/try-on', '/api/video'], generationLimit);

app.use('/api', analyzeRouter);
app.use('/api', skinAnalysisRouter);
app.use('/api', tryOnRouter);
app.use('/api', videoRouter);

/**
 * The built front end can still be served by this process for local or single-process
 * previews. The public free deployment serves it from a separate static site instead.
 *
 * Absent in development, where Vite serves the app on its own port and proxies `/api`
 * back here. Its absence is a normal state for the split deployment, not a failure.
 */
const WEB_DIST = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'dist');
const hasBuiltWeb = existsSync(join(WEB_DIST, 'index.html'));

if (hasBuiltWeb) {
  app.use(express.static(WEB_DIST));

  // Client-side routing fallback. Scoped away from `/api` so an unknown API path stays a
  // 404 instead of quietly returning the HTML shell.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(join(WEB_DIST, 'index.html'));
  });
}

// Anything unhandled becomes a plain message, never a stack trace with a key in it.
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // An oversized body is the one framework error worth naming: in fixture mode it is what
  // a stale client sending image bytes will hit first, and a 500 would misdescribe it.
  if ((error as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ code: 'general', error: 'That request is too large for this demo.' });
    return;
  }

  if ((error as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Send a valid JSON request.' });
    return;
  }

  logFailure('unhandled request', error);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

const port = Number(process.env['PORT'] ?? 8787);
app.listen(port, () => {
  console.log(`[yincol] server listening on http://localhost:${port}`);
  console.log(
    `[yincol] palette: ${startupConfig.fixtureMode ? 'FIXTURE' : 'LIVE'}; live try-on: ${startupConfig.liveTryOn}; live skin analysis: ${startupConfig.liveSkinAnalysis}`,
  );
  console.log(`[yincol] request body limit: ${!startupConfig.fixtureMode || startupConfig.liveSkinAnalysis || startupConfig.liveTryOn ? '70mb' : '32kb'}`);
  console.log(
    hasBuiltWeb
      ? `[yincol] serving the built front end from ${WEB_DIST}`
      : '[yincol] no web build found — run `npm run build` for single-process serving',
  );

  // Health checks also refuse readiness when live generation has no credential.
  if (liveWasRequestedWithoutKey()) {
    console.warn(
      '[yincol] a live path was requested but YINCOL_API_KEY is empty — ' +
        'generation is unavailable until the server key is configured.',
    );
  }
});
