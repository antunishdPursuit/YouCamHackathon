# YINCOL

A small YouCam showcase for comparing garments and makeup, with optional full-body
previews and a saved motion sample. The colour palette uses an explainable local
rule; its current input is an example reading, not a live analysis of the visitor.

[Partner guide / 合作开发指南（English + 简体中文）](docs/partner-guide.md)

## Current application

| Stage | Behavior implemented in this repository |
| --- | --- |
| Start | Product introduction, mode-aware privacy information, automatically saved Previous looks, and a choice between the saved demo and your own photos. |
| Add inputs | Portrait, two garment references, a makeup preset, and optional full-body portrait plus trousers reference. |
| Generate | Explicit generation with progress, input checks, and reuse of a matching result from this browser's saved history. |
| Results | Compare outfits (close-up, plus full body as an additional section when generated) or compare the original portrait against that same portrait with makeup. A per-image action offers a five-second video, gated behind the server's unit budget. |

Each garment passes through Clothes VTO, then Makeup VTO receives that garment
result — that pairing is what Compare outfits shows. The makeup task also runs
directly on the bare portrait, with no garment change, for Compare makeup: the
original portrait against that same portrait with makeup. Full-body generation
first applies trousers once, then runs each top and its makeup independently. A
failed branch does not discard the other usable result.

The saved five-second video plays only for its matching red-shirt / Rose Veil
fixture. A per-image "Generate video" action exists on any other completed
result, budget-permitting, but has no live provider path yet — see the video row
below. Neither is a rotatable 3D model or a view of the back. A click starts
playback; the original still remains available.

### Demo and live entry

Start offers "Try the demo" (the saved comparisons above, no upload, no
YouCam call, and no dependency on the API service being awake — it can sleep on
the free tier) and "Try your photos" (the existing Add-inputs flow). Both label
every result as a saved demo or as generated from your uploads.

### Server unit budget — implemented for `/api/try-on`, not yet complete

A shared Redis-protocol Key Value store (`server/src/youcam/budget.ts`) reserves
the full estimated cost of a request before any provider call, enforcing 100
units/site/day and up to 40/browser in a ~24-hour window, both subject to the
shared pool. Wired into `/api/try-on`; **not yet wired into
`/api/skin-analysis`**, whose live path still has no budget gate. Never
connected to a real Render Key Value instance — `redisClient.ts`'s connection is
unverified, and `YINCOL_KV_URL` unset (the default) fails every live route
closed the same way a missing API key already does. Automatic refunds are not
implemented yet: an ambiguous or failed request keeps its full charge, by
design, until a clean-failure/timeout distinction is threaded through the
existing sequences.

### Live video generation — not implemented; the route cannot reach the provider

`POST /api/video` exists, is budget-gated, and is built and tested exclusively
against a mocked provider. It cannot make a real call regardless of
`YINCOL_LIVE_VIDEO`: the Video Generator task path is an unverified guess, and
the feature has no registered File API upload path at all, so an upload is
refused before any request would leave the process. Treat this exactly like the
long-unverified Facial Color Tone contract — a guess, not a fact — until someone
with API Playground access confirms it.

These are the current safeguards and gaps, stated plainly rather than as a
roadmap. There are no accounts. Browser history and the budget reservation
algorithm are implemented; a verified live video path and a deployed KV
instance are not. The request-rate limiter (`rateLimit.ts`) is separate from the
unit budget and still counts requests in one server process only. The temporary
design preview is separate from the website demo and is not part of the
deployed application.

## Run locally without using credits

Use Node.js 20 or newer. From the repository root:

```bash
npm ci
```

On a fresh clone with no `.env`, `npm run dev` defaults to fixtures. If a local
`.env` already enables live generation, override it for a safe walkthrough.
In PowerShell:

```powershell
$env:YINCOL_FIXTURE_MODE = 'true'
$env:YINCOL_LIVE_SKIN_ANALYSIS = 'false'
$env:YINCOL_LIVE_TRY_ON = 'false'
$env:YINCOL_API_KEY = ''
npm run dev
```

The web app is at <http://localhost:5173>; the API is at
<http://localhost:8787/api/health>. Confirm `mode: "fixture"`, both live flags
`false`, and `hasApiKey: false` before a no-credit walkthrough. Fixture generation
makes local API requests but makes no provider calls and sends no image bytes.
The selected uploads do not replace the saved demo person's face or garments.

`YINCOL_SIMULATE` can be set to `noFace`, `partialFailure`,
`completeLookFailure`, or `skinUnavailable` to exercise the corresponding fixture
state. Restart the API after changing its configuration.

## Opt-in live images

Copy `.env.example` to `.env` and enter the key privately on the API server.
Keep `YINCOL_FIXTURE_MODE=true`; set `YINCOL_LIVE_TRY_ON=true` for verified
Clothes/Makeup VTO. Enable `YINCOL_LIVE_SKIN_ANALYSIS=true` only when the separate
appearance analysis is needed. Restart from a shell without the fixture-only
overrides above, reload the browser, and inspect `/api/health` before generation.

Do not enable the live palette by setting `YINCOL_FIXTURE_MODE=false`: Facial
Color Tone's full contract remains unverified. Never put the key in `web/`, a
`VITE_` variable, logs, fixtures, or Git. Public live access needs a deployed,
verified Key Value connection and full budget coverage (see "Server unit
budget" above) before activation; deployment alone does not enable live calls.

The browser sends bounded image data through the server's File API adapter.
Successful output bytes are downloaded immediately; signed provider URLs do not
reach the browser. Source uploads remain in memory. Completed output images and the matching saved
demo video are copied into IndexedDB as bytes, with their settings and colour
context. The API-echoed source portrait is omitted from both persistent history
and the session cache. Starting a new look preserves history.
Already-submitted provider work may still finish and consume units after deletion.

### Saved results on this browser

After generation, wait for **Saved on this browser**. Start's **Previous looks**
opens the comparison directly, including the saved sample video when it matches.
Reopening works while the API is unavailable and sends no generation request.
A matching set of file bytes, makeup, full-body inputs and runtime flags reuses
history. Generation pauses if storage cannot be checked or safe file matching
is unavailable; use HTTPS or localhost for the browser's file hashing support.

Results offer individual downloads. Starting a new look keeps history. Delete
on a history entry removes that look; **Remove photos and saved results** confirms
clearing current inputs and all saved looks. Deletion invalidates pending writes,
including writes prepared before deletion in another tab. Existing results already
open in another tab remain in that tab's memory until it is closed or cleared.

History belongs to the same browser profile and site address. It does not sync
between localhost, Tailscale and Render. Storage quota, private browsing or browser
data clearing can prevent saving or remove history. A failed save leaves current
results and downloads available, with a save-only retry that does not call YouCam.
The first valid older session cache may be imported once without regeneration.
Source uploads are not restored; reselect them to change or generate a look.
`POST /api/video` exists but has no verified live path — see "Live video
generation" above.

### Recorded unit estimates

| Workflow | Expected units on success |
| --- | ---: |
| Current close-up: two Clothes tasks + two Makeup tasks + one portrait-only Makeup task | 9 |
| Optional full-body: shared trousers + two tops + two makeup tasks | +8 |
| Optional five-action Skin Analysis | +12 |
| Current close-up + full-body + Skin Analysis | 29 |
| Planned five-second, 720p video (unverified — no live path yet) | +10 each |

The original uploaded portrait requires no generation. Estimates exclude retries
and are not a balance check. Verify current rates before approved paid work:
[Clothes VTO](https://docs.perfectcorp.com/reference/ai_clothes/section/overview),
[Makeup VTO](https://docs.perfectcorp.com/reference/makeup_vto/section/overview),
[Skin Analysis](https://docs.perfectcorp.com/reference/ai_skin_analysis/section/overview),
and [Video](https://docs.perfectcorp.com/reference/ai_video_generator/section/overview).

## Checks

```bash
npm test
npm run typecheck
npm run build
npm run contrast-audit --workspace @yincol/web
npm audit
```

Ordinary tests stub provider requests and require no API key. Test totals and
verification results belong in the dated [verification record](docs/verification.md),
not in setup commands. The repository currently has no GitHub Actions workflow;
local checks are separate from deployment verification.

## Repository map

| Path | Purpose |
| --- | --- |
| `web/` | React, Tailwind and Vite UI; uses internal response types. |
| `server/` | Express API, provider adapters, image validation, exact-origin CORS and request limits. |
| `shared/` | Domain types, presets and the deterministic palette engine. |
| `web/public/fixtures/` | Public captured results, the saved motion clip and labelled placeholders. |
| `assets/source/`, `assets/private-results/` | Ignored private inputs and test captures; not bundled or served. |

The palette engine maps undertone, depth and contrast through 27 fixed rules to
six swatches. It does not diagnose skin conditions, recommend treatments, or make
fit guarantees. See [API findings](docs/api-findings.md) for the rule assumptions
and historical provider evidence.

## Handoff and deployment

- [Partner guide / 合作开发指南](docs/partner-guide.md): current state, planned work,
  verification and ownership in English and Simplified Chinese.
- [Deployment](docs/deployment.md): the current split, fixture-only Render release.
- [Assets](assets/README.md): source rights and result provenance.
- [Verification](docs/verification.md): dated local evidence and remaining limits.

Sean can prepare code, tests and a pull request without access to Dennis's Render
account. Dennis operates the personal Render workspace, secrets and release checks.
Public live generation remains a separate implementation and rollout.
