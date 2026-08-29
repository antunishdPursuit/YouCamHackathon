# Deployment

The approved shape for the first public release: **fixture-only, one process, no API key.**

Deployment itself is a separate approved action. This document describes how, not when —
nothing here is authorisation to deploy.

---

## The shape

One Node/Express process serves both halves of the app from the same origin:

```
                    ┌──────────────────────────────┐
  browser  ───────► │  Express (server/src/index)  │
                    │                              │
                    │   /            → web/dist    │
                    │   /api/*       → routes      │
                    └──────────────────────────────┘
```

There is no separate static host and no cross-origin request, which is why the app carries
no CORS policy. There is no database, no account system, and no session store: nothing is
kept between requests, so there is nothing to migrate, back up, or purge.

---

## Build and start

The build needs the dev toolchain; running does not. That is two stages, and conflating
them is the one way to get this wrong.

```bash
npm ci && npm run build && npm ci --omit=dev && npm start
```

Stage by stage:

| Step | Command | What it does |
| --- | --- | --- |
| Install | `npm ci` | Full tree, including Vite. |
| Build | `npm run build` | Compiles the front end to `web/dist`. |
| Prune | `npm ci --omit=dev` | Drops the dev toolchain. Keeps `web/dist`. |
| Run | `npm start` | Serves `web/dist` and `/api` on one port. |

Requires **Node 20 or newer** (`engines` in `package.json`).

The server runs its TypeScript directly through `tsx`, which is a runtime dependency for
exactly this reason — a pruned install must still be able to start. The shared workspace is
consumed as TypeScript source by design, so there is no separate server compile step. See
"Known limitations" below.

`PORT` selects the port and defaults to `8787`. Most platforms set it for you.

On startup the process states what it is doing, and these lines are the first thing to
check after a deploy:

```
[yincol] server listening on http://localhost:8787
[yincol] mode: FIXTURE (no network, no credits)
[yincol] request body limit: 32kb
[yincol] serving the built front end from /app/web/dist
```

If the last line instead says no web build was found, stage two did not run or `web/dist`
was pruned: `/api` will work and the site will 404.

---

## Environment for the public deployment

```text
YINCOL_FIXTURE_MODE=true
YINCOL_LIVE_SKIN_ANALYSIS=false
YINCOL_LIVE_TRY_ON=false
# YINCOL_API_KEY is deliberately absent.
YINCOL_TRUST_PROXY=true   # only if the platform terminates TLS in front of the app
```

**Set no API key.** That is the deployment's safety property, not a tidiness preference.
`loadConfig` derives fixture mode from the key's presence: with no key there is no live
path, whatever the three flags say. A flag set wrongly — or a stray `YINCOL_FIXTURE_MODE=false`
copied from a development shell — cannot start a live call or spend a credit. The process
says so out loud on startup when it happens:

```
[yincol] a live path was requested but YINCOL_API_KEY is empty — staying on fixtures.
```

`server/src/youcam/config.test.ts` covers this for every combination of the three flags.

`YINCOL_TRUST_PROXY` is off by default and should stay off unless the app really does sit
behind a proxy. It makes `req.ip` read the forwarded header, which is the rate limiter's
key — trusting it when nothing sets it lets any caller choose their own key.

### Confirming a deployment is safe

```bash
curl -s https://<host>/api/health
```

```json
{ "mode": "fixture", "liveSkinAnalysis": false, "liveTryOn": false, "hasApiKey": false }
```

All four values matter. `hasApiKey: false` is the one that cannot be faked by configuration.

---

## What protects the process

The public demo spends no credits, so the limits protect availability rather than a budget.

| Guard | Fixture | Live |
| --- | --- | --- |
| Request body | 32 kB | 42 MB |
| `/api/*` per IP | 120/min | 120/min |
| `/analyze`, `/skin-analysis`, `/try-on` per IP | 30/min | 30/min |

One generation is three requests, so the generation budget is roughly ten generations a
minute per address.

In fixture mode the routes also **refuse image payloads outright** rather than ignoring
them, so a stale tab or a hand-rolled request cannot upload a photograph to a process that
has promised not to receive one. The browser does not send bytes in fixture mode either —
it reads `/api/health` before it reads a file — but the server does not rely on that.

---

## Turning it off

**Disable live paths** (already the public state): remove `YINCOL_API_KEY` and restart.
Nothing else is required, and nothing else is sufficient — the flags alone do not enable
live mode without a key, and they do not disable it if a key is present and fixture mode is
explicitly off.

**Take the demo down:** stop the process, or scale the service to zero. No cleanup follows.
Nothing was stored, so there is nothing to delete: no user data, no uploads, no database.

**Roll back:** redeploy the previous commit and run the same four build commands. There is
no state, no schema, and no migration, so a rollback is only ever a redeploy. Fixtures are
committed bytes, so a rolled-back deployment shows exactly what that commit showed.

---

## Known limitations

- **The rate limiter is per process.** State is in memory, so two instances behind a load
  balancer each enforce their own window and the effective limit doubles. The approved
  shape is one process. Scaling out needs a shared store or the platform's own edge
  limiter first.
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

---

## Not approved

- Deploying from a branch.
- Any deployment configured with an API key.
- Public live API access. That is a different release scope — an anonymous,
  server-mediated live demo — and needs the anonymous abuse controls agreed on issue #4
  before it goes anywhere public.
