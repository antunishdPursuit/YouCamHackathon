# Complete-look integration handoff

## Purpose

This note defines the next implementation increment after the current YINCOL flow
and live upload plumbing. It is written for the developer who takes the next
branch from `main`.

The next increment is to make the browser's live results match the API sequence
already verified locally: apply a selected garment first, then apply the selected
makeup effects to that returned garment image.

## Current product state

The four-stage flow is intentionally small:

1. Start
2. Add inputs
3. Generate
4. Results

The current branch includes the root-level app layout, the YINCOL design system,
session-only inputs and cached generation state, fixture mode, live Skin Analysis
plumbing, and opt-in live Clothes VTO and Makeup VTO uploads.

The live browser route currently requests the garment previews and makeup preview
as separate operations from the original portrait. This means the live makeup
panel is not yet a complete look: it does not receive the selected garment result.

## Scope of the next increment

Implement one sequential live path for a selected garment:

```text
portrait + garment reference
        │
        ▼
Clothes VTO
        │ result image bytes
        ▼
Makeup VTO effects
        │
        ▼
complete-look preview
```

Keep the two garment comparisons separate. For each selected garment, run the
same sequence and return its own complete-look result. Preserve the existing
fixture path and the current partial-failure behavior.

Do not add motion, video, 3D rotation, scenario backgrounds, a custom camera,
accounts, a database, catalogue search, or checkout in this increment. A later
motion-preview experiment must be separately approved and must use a selected
complete-look result as its input.

## Required implementation behavior

- Keep the API key and secret on the server. The browser must never call YouCam
  directly.
- Reuse the existing File API upload, polling, result download, and adapter
  boundaries. Do not expose vendor response shapes to `web/`.
- Pass the downloaded Clothes VTO result bytes into Makeup VTO as the second
  task's portrait input.
- Keep Makeup VTO effects configuration in the existing preset definition. A
  makeup reference image is not part of the verified contract.
- Return explicit ready/failed states for each garment. One failed sequence must
  not hide a usable result for the other garment.
- Preserve the current fixture default. Live try-on remains opt-in through
  `YINCOL_LIVE_TRY_ON=true` while the palette remains fixture-backed.
- Preserve session caching. A matching completed request must not spend the same
  API units again during the open browser session.
- Keep result provenance truthful. A fixture is a fixture; a live result is a
  temporary in-memory result; a captured image is a pre-captured API output.
- Check image sizing for full-body outputs. The result display must not silently
  crop the body because of a fixed portrait-card ratio.

## Acceptance criteria

The increment is ready when all of these are true:

1. Fixture mode still completes the full four-stage journey with no network calls
   and no API-unit use.
2. Live mode sends each garment through Clothes VTO and then sends that returned
   image to Makeup VTO.
3. The Results screen clearly distinguishes a garment-only preview from a
   complete-look preview without repeating or inventing provider claims.
4. The two complete-look results preserve the same person and show the selected
   garment with the configured makeup effects.
5. A failed Clothes or Makeup task is shown as a local, recoverable failure and
   does not erase the other garment's result.
6. Repeating the same session request uses the existing session cache instead of
   spending another successful API call.
7. Full-body test inputs display without unacceptable cropping at the supported
   viewport sizes.
8. The existing tests, typecheck, build, contrast audit, and manual smoke checks
   pass.

## Verification checklist

Run from the repository root:

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run contrast-audit --workspace @yincol/web
```

For a safe browser walkthrough, keep fixture mode enabled:

```bash
npm run dev
```

For the opt-in live try-on check, copy `.env.example` to `.env`, set the API key,
keep `YINCOL_FIXTURE_MODE=true`, and set:

```text
YINCOL_LIVE_TRY_ON=true
```

Use a face-forward full-body portrait and two team-owned or licensed garment
references. Do not commit those source files or any key. Record the task outcome,
not the temporary signed URL, in the handoff or PR notes.

## Evidence already available

The direct local smoke test has already verified this sequence with a full-body
portrait and one garment reference:

- Clothes VTO returned a full-body garment result.
- Makeup VTO accepted that Clothes VTO result and returned a complete-look image.
- The combined sequence succeeded without using an image-generation model.

The remaining work is browser-route integration and verification, not a new
provider-discovery exercise.

## Review questions

- Does the server make the sequencing explicit rather than hiding it in the
  browser?
- Are task failures and API-unit use visible enough for local testing?
- Does the UI describe the output as a complete look only when the second task
  actually received the first task's result?
- Are the existing four stages and session-only privacy promise unchanged?
- Is the later motion-preview idea kept out of this change until the complete-look
  path is stable?
