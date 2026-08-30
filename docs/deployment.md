# Deployment

The approved shape for the first public release: **two free Render services, fixture-only,
and no API key.**

- a Render Static Site for the React build;
- a Render Free Web Service for the Node/Express API.

Deployment itself is a separate approved action. This document describes how, not when —
nothing here is authorisation to deploy.

---

## The shape

The browser loads the front end from the Static Site and calls the API Web Service from
the exact origin configured in `YINCOL_ALLOWED_ORIGIN`:

```
  browser
     │
     ├── loads the static site ──────► Render Static Site (web/dist)
     │
     └── calls /api/* ───────────────► Render Web Service (Node + Express)
                                        │
                                        └── fixture routes only
```

The browser receives the API origin at static-site build time through `VITE_API_URL`.
The API service accepts browser requests only from the exact `YINCOL_ALLOWED_ORIGIN`.
There are no accounts, sessions, database writes, or user uploads in the public release.

The server can still serve `web/dist` for local or single-process previews. The public
deployment does not depend on that fallback.

---

## Creation order

The two public URLs are configuration inputs for each other. Create them in this order:

1. Create and deploy the API Web Service first. Leave `YINCOL_ALLOWED_ORIGIN` empty only
   until the Static Site URL is known. Record the API service URL.
2. Create and deploy the Static Site with `VITE_API_URL` set to that API URL. Record the
   Static Site URL.
3. Set `YINCOL_ALLOWED_ORIGIN` on the API Web Service to the exact Static Site origin and
   restart or redeploy the API service.
4. Run the health, CORS, and browser checks below before sharing either URL.

Do not use a wildcard while connecting the services. The API is safe without an allowed
origin during the short setup window because the public release has no API key and the
static site cannot call it successfully until its exact origin is configured.

---

## Render Static Site

Create a Static Site from the approved default branch of the repository.

| Setting | Value |
| --- | --- |
| Root Directory | repository root; leave blank if Render uses the root by default |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `web/dist` |
| Environment variable | `VITE_API_URL=https://<api-service>.onrender.com` |

Replace the placeholder with the API service's actual public URL. Use the origin only:
do not append `/api` and do not add a trailing slash.

The static site has no secrets. Do not put `YINCOL_API_KEY` on it.

## Render Web Service

Create a Web Service from the same approved commit.

| Setting | Value |
| --- | --- |
| Root Directory | repository root; leave blank if Render uses the root by default |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Instance type | Free |

Set these environment variables on the Web Service:

```text
YINCOL_FIXTURE_MODE=true
YINCOL_LIVE_SKIN_ANALYSIS=false
YINCOL_LIVE_TRY_ON=false
YINCOL_ALLOWED_ORIGIN=https://<static-site>.onrender.com
YINCOL_TRUST_PROXY=true
```

Replace the placeholder with the Static Site's exact public origin. Do not use `*`.
Render supplies `PORT`; do not hard-code a public port.

Leave `YINCOL_API_KEY` unset. The API service must report `hasApiKey: false` and
`mode: "fixture"` before the site is considered safe to share.

---

## Why the app waits for the API

When the static site opens, the browser calls `/api/health` immediately. If the free API
service is asleep, the UI shows that the studio is warming up and retries with bounded
timeouts. The Generate button stays disabled until a health response succeeds.

The health check is also the mode check. Until it succeeds, the browser does not make a
privacy claim about the active mode. In fixture mode, the generation client sends fixture
metadata and does not read the portrait or garment files for upload.

This improves the first visit after sleep, but it cannot remove the free-tier cold start.
Render may stop an inactive free Web Service, and the first request after sleep can take
up to about a minute. The static site itself remains available while the API wakes.

## Verify before sharing

Run these checks against the API service URL:

```bash
curl -i https://<api-service>.onrender.com/api/health
```

```json
{
  "ok": true,
  "mode": "fixture",
  "liveSkinAnalysis": false,
  "liveTryOn": false,
  "hasApiKey": false
}
```

Check the allowed browser origin:

```bash
curl -i \
  -H "Origin: https://<static-site>.onrender.com" \
  https://<api-service>.onrender.com/api/health
```

The response must include:

```text
Access-Control-Allow-Origin: https://<static-site>.onrender.com
```

Check that another origin is rejected:

```bash
curl -i \
  -H "Origin: https://example.com" \
  https://<api-service>.onrender.com/api/health
```

It must return `403` with the generic message `This origin is not allowed.`.

Then open the Static Site and verify the user flow:

1. The page loads without a same-origin `/api` assumption.
2. The API status changes from connecting or warming up to ready.
3. Generate remains disabled until both the inputs and API readiness are complete.
4. Fixture generation returns the shipped results.
5. The browser Network panel shows no portrait or garment bytes in fixture requests.
6. The result provenance labels remain visible.

## Local checks

From the repository root:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

For local development, leave `YINCOL_ALLOWED_ORIGIN` empty and leave
`VITE_API_URL` unset. Vite serves the front end and proxies `/api` to `localhost:8787`.

---

## What protects the process

The public demo spends no credits, so the limits protect availability rather than a budget.

| Guard | Fixture release |
| --- | --- |
| Request body | 32 kB |
| `/api/*` per IP | 120/min |
| `/analyze`, `/skin-analysis`, `/try-on` per IP | 30/min |
| Browser origin | exact `YINCOL_ALLOWED_ORIGIN` |
| Provider access | disabled; no API key |

One generation is three requests, so the generation budget is roughly ten generations a
minute per address.

In fixture mode the routes also **refuse image payloads outright** rather than ignoring
them, so a stale tab or a hand-rolled request cannot upload a photograph to a process that
has promised not to receive one. The browser does not send bytes in fixture mode either —
it reads `/api/health` before it reads a file — but the server does not rely on that.

The rate limiter is in memory and the free service runs as one instance. If the service
ever scales to multiple instances or live provider calls are enabled, add a shared rate
limit store and stronger anonymous abuse controls before that release.

---

## Turning it off

**Disable live paths** (already the public state): remove `YINCOL_API_KEY`, set the three
fixture/live flags explicitly as shown above, and restart the Web Service. Nothing else is
required, and nothing else is sufficient — the flags alone do not enable live mode without
a key, and they do not disable it if a key is present and fixture mode is explicitly off.

**Take the demo down:** suspend both Render services. No cleanup follows. Nothing was
stored, so there is nothing to delete: no user data, no uploads, no database.

**Roll back:** redeploy both Render services to the same previous approved commit, then
repeat the health, CORS, and browser checks. There is no state, schema, or migration, so a
rollback is only a pair of redeploys. Fixtures are committed bytes, so a rolled-back
deployment shows exactly what that commit showed.

---

## Known limitations

- **The free API service can sleep after inactivity.** A first visit after sleep can wait
  for startup. The front end retries the health check and keeps Generate disabled while it
  waits, but a free instance cannot guarantee an instant response.
- **The rate limiter is per process.** State is in memory, so two instances behind a load
  balancer each enforce their own window. The approved shape is one free instance. Scaling
  out needs a shared store or the platform's own edge limiter first.
- **The server runs TypeScript through `tsx` in production.** It transpiles on startup
  rather than serving precompiled JavaScript. This follows from consuming the shared
  workspace as TypeScript source, which is a deliberate project decision; changing it means
  compiling both workspaces and is a larger change than this closeout makes.
- **Facial Color Tone is not live.** The palette is computed locally from the fixture
  reading. The provider's task path is recorded but its request shape and response mapping
  are unverified — see `docs/api-findings.md`. Nothing in the public deployment calls it.
- **Fixture provenance, and how much of the demo is real.** The August 29, 2026 capture
  produced four genuine API results: a garment preview and a complete look for each of the
  two catalogue garments `rosewater-cardigan` and `sage-linen-shirt`, with the **Rose Veil**
  look. Everything else — the other six garments, and every look other than Rose Veil — is
  a designed stand-in. Every panel says on its face which it is. Do not describe a stand-in
  as a YouCam output, and note that a shopper who picks a different look is, correctly,
  shown stand-ins rather than the Rose Veil image relabelled.
- **The demo shows one face.** Fixture mode renders the captured results whatever the
  visitor uploads; their own photograph never leaves the tab and is never processed. The
  previews are of the approved demo portrait, not of them.
- **3D/2.5D rotation is deferred.** It remains a separate feature for the collaborator
  and is not part of this closeout release.

---

## Not approved

- Deploying from an unmerged feature branch.
- Any deployment configured with an API key.
- Public live API access. That is a different release scope — an anonymous,
  server-mediated live demo — and needs stronger abuse controls before it goes anywhere
  public.
- 3D/2.5D rotation in the closeout release.
