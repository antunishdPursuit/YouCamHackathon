/**
 * YINCOL Express proxy.
 *
 * Exists only to hide the API key and normalise the async pipeline. No database, no
 * auth, no accounts — there is nothing to store, because nothing is kept.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GARMENTS, MAKEUP_LOOKS } from '@yincol/shared';
import { loadConfig, TASK_PATH_VERIFIED } from './youcam/config.js';
import { analyzeRouter } from './routes/analyze.js';
import { tryOnRouter } from './routes/tryOn.js';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', (_req, res) => {
  const config = loadConfig();
  res.json({
    ok: true,
    mode: config.fixtureMode ? 'fixture' : 'live',
    // Never echo the key itself, only whether one is present.
    hasApiKey: config.apiKey.length > 0,
    verifiedTaskPaths: TASK_PATH_VERIFIED,
  });
});

/** The picker's contents. Static data, served so the front end has one source. */
app.get('/api/catalog', (_req, res) => {
  res.json({ garments: GARMENTS, makeupLooks: MAKEUP_LOOKS });
});

app.use('/api', analyzeRouter);
app.use('/api', tryOnRouter);

// Anything unhandled becomes a plain message, never a stack trace with a key in it.
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[yincol]', error.message);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

const port = Number(process.env['PORT'] ?? 8787);
app.listen(port, () => {
  const config = loadConfig();
  console.log(`[yincol] server listening on http://localhost:${port}`);
  console.log(`[yincol] mode: ${config.fixtureMode ? 'FIXTURE (no network, no credits)' : 'LIVE'}`);
});
