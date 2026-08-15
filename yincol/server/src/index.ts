/**
 * YINCOL Express proxy.
 *
 * Exists only to hide the API key and normalise the async pipeline.
 * No database, no auth, no accounts. Routes land in Phase 2.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env['PORT'] ?? 8787);
app.listen(port, () => {
  console.log(`[yincol] server listening on http://localhost:${port}`);
});
