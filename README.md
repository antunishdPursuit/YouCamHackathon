# YINCOL

A small YouCam showcase for comparing garments and makeup, with optional full-body
previews and a saved motion sample. The colour palette uses an explainable local
rule; its current input is an example reading, not a live analysis of the visitor.

[Partner guide / 合作开发指南（English + 简体中文）](docs/partner-guide.md)

## Current application

| Stage | Behavior implemented in this repository |
| --- | --- |
| Start | Product introduction and mode-aware privacy information. |
| Add inputs | Portrait, two garment references, a makeup preset, and optional full-body portrait plus trousers reference. |
| Generate | Explicit generation with progress, input checks, and reuse of a matching result in the current session. |
| Results | Compare outfits or makeup; switch between available close-up/full-body results; keep a choice for the session. |

Each garment passes through Clothes VTO, then Makeup VTO receives that garment
result. The current makeup comparison is **Garment A before and after makeup**.
Full-body generation first applies trousers once, then runs each top and its
makeup independently. A failed branch does not discard the other usable result.

The saved five-second video plays only for its matching red-shirt / Rose Veil
fixture. It is not a video of the visitor's new result and is not a rotatable 3D
model. A click starts playback; the original still remains available.

### Accepted next increment — not implemented yet

- Start offers a saved website demo and a separate live trial.
- The demo opens Add inputs with sample photos filled in, then displays saved
  comparisons and video without calling YouCam.
- Compare makeup shows the original portrait against makeup on that same portrait,
  with its clothing unchanged. Compare outfits shows both full-body outfits with
  trousers and makeup. The extra view selector is removed.
- Completed images and videos save automatically in IndexedDB and appear in
  previous looks. Keep/kept is replaced by saved results and per-image video actions.
- Live video generation uses the selected completed image.
- The API enforces 100 YouCam units per day shared across the site and up to 40
  units per browser per 24 hours, subject to the shared pool, using free Render
  Key Value. A lost counter store pauses live generation instead of resetting credit.

These are planned changes, not current safeguards. There are no accounts or
persistent result history yet. The current limiter counts requests in one server
process; it does not enforce a daily YouCam budget. The temporary design preview
is separate from the website demo and is not part of the deployed application.

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
`VITE_` variable, logs, fixtures, or Git. Public live access needs the planned
budget controls before activation; deployment alone does not enable live calls.

The browser sends bounded image data through the server's File API adapter.
Successful output bytes are downloaded immediately; signed provider URLs do not
reach the browser. Source uploads remain in memory. Matching results are cached
in sessionStorage or memory when the response is too large. This is **not durable
history**. Starting over or removing photos clears the current results and cache.
Already-submitted provider work may still finish and consume units after deletion.

### Recorded unit estimates

| Workflow | Expected units on success |
| --- | ---: |
| Current close-up: two Clothes tasks + two Makeup tasks | 6 |
| Optional full-body: shared trousers + two tops + two makeup tasks | +8 |
| Optional five-action Skin Analysis | +12 |
| Current close-up + full-body + Skin Analysis | 26 |
| Planned makeup-only portrait + two full outfits, without Skin Analysis | 9 |
| Planned five-second, 720p video | +10 each |

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
