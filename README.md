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
| Results | Compare the two full-body outfits when requested, or legacy close-up results or compare the original portrait against that same portrait with makeup. Saved clips play beside their images; live video remains gated pending release verification. |

Each garment passes through Clothes VTO, then Makeup VTO receives that garment
result — that pairing is what Compare outfits shows. The makeup task also runs
directly on the bare portrait, with no garment change, for Compare makeup: the
original portrait against that same portrait with makeup. Full-body generation
first applies trousers once, then runs each top and its makeup independently. A
failed branch does not discard the other usable result.

The saved five-second video plays only for its matching red-shirt / Rose Veil
fixture. A per-image "Generate video" action exists on any other completed
result, budget-permitting, but remains disabled pending live-route acceptance — see the video row
below. Neither is a rotatable 3D model or a view of the back. A click starts
playback; the original still remains available.

### Demo and live entry

Start offers "Try the demo" (preselected illustrated inputs, then saved comparisons; no upload, no
YouCam call, and no dependency on the API service being awake — it can sleep on
the free tier) and "Try your photos" (the existing Add-inputs flow). Both label
every result as a saved demo or as generated from your uploads.

### Server budgets and video

Try-on, skin analysis and video reserve units before provider work. The persistent
Key Value ledger enforces 100 units per UTC site day and 40 per browser over a true
rolling 24 hours. Atomic compare-and-set commits both limits and duplicate protection.
Missing state pauses live work for 24 hours, including first provisioning. There are
no automatic refunds, paid retries or expiring duplicate locks. Real Render connection
verification remains pending. See [follow-up evidence and release gates](docs/pr15-followup.md).

Video's documented V2 task and upload contract are implemented, but real output and
release acceptance remain unverified. An explicit code gate keeps live video disabled
before reservation/upload; the saved sample remains available. No visitor accounts.

## Run locally without using credits

Use Node.js 22.22.2+ within 22.x, 24.15.0+ within 24.x, or 26.0.0+.
These versions match the jsdom 30 test dependency; Node 20 is no longer supported
for this workspace. CI checks the minimum supported version, 22.22.2.

中文：开发和测试请使用 Node.js 22.x（至少 22.22.2）、24.x（至少 24.15.0）
或 26.0.0 及以上版本，以满足 jsdom 30 的要求；不再支持 Node 20。

From the repository root:

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
| Legacy close-up: two Clothes tasks + two Makeup tasks + one portrait-only Makeup task | 7 |
| Full-body: shared trousers + two tops with makeup + portrait-only makeup (replaces close-up) | 9 |
| Optional five-action Skin Analysis | +12 |
| Full-body flow + Skin Analysis | 21 |
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
not in setup commands. GitHub Actions is configured in `.github/workflows/checks.yml`;
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
