# API findings — Perfect Corp / YouCam S2S v2.0

This file separates what we treat as **ground truth** from what we **guessed and must
confirm** in the [API Playground](https://docs.perfectcorp.com/develop/introduction).

Nothing marked unverified below should be repeated as fact in a demo, a README, or to a
judge. Every unverified item has a matching `// TODO(phase0): verify in API Playground`
in the code and a single config constant that can be changed in one place.

---

## Verified — treated as ground truth

- **Auth.** v2.0 endpoints accept the API key directly as `Authorization: Bearer <key>`.
  The RSA / `client_secret` exchange is legacy v1 only. The v1 path is deliberately not
  built.
- **Uniform async pipeline.** Every feature follows the same five steps: get an image in →
  `POST` to the task endpoint → receive `task_id` → poll `GET {taskEndpoint}/{task_id}`
  until `task_status` is `success` or `error` → read the result. Implemented once as a
  generic runner (`server/src/youcam/taskRunner.ts`) with four per-feature configs.
- **Two image-input paths.** Path A is File API + a self-performed `PUT` of the bytes;
  calling the File API alone uploads nothing, and skipping the `PUT` surfaces later as a
  misleading `500 unknowninternalerror` or a `404`. Path B passes a publicly reachable
  image URL directly on task start. **We use Path B.** Path A exists as an interface with
  no implementation.
- **Polling.** 2-second interval, cap ~120 attempts. Rate limits are 250 requests per 300
  seconds, enforced per IP and per token, ~5 QPS recommended. Our concurrency is far below
  that, so a simple backoff on 429 is sufficient.
- **Billing.** Credits burn on success only. `task_status: "error"` and `running` consume
  no credits.
- **Result expiry.** Uploaded files, `file_id` and `task_id` persist 30 days, but the
  download URL returned on success is valid for **2 hours only**; after that a fresh link
  is re-derived from the `task_id`. This is why fixtures store downloaded **image bytes**
  in the repo and never URLs, and why the capture script downloads immediately after a
  task succeeds.
- **Makeup transfer is reference-image based.** The API extracts a look from a reference
  photo of a made-up face and transfers it. It does not accept shade values or SKUs.
- **Image specs.** Long side ≤ 4096px, short side ≥ 480px (SD) or ≥ 1080px (HD). One
  person, upper body clearly visible, uncluttered background.

## Verified endpoints

| Feature | Method + path | Notes |
| --- | --- | --- |
| Clothes VTO | `POST /s2s/v2.0/task/cloth` | payload includes `garment_category` and `change_shoes` |
| Makeup transfer | `POST /s2s/v2.0/task/mu-transfer` | `GET /s2s/v2.0/task/mu-transfer/{task_id}` |
| Skin analysis | `POST /s2s/v2.0/task/skin-analysis` | |

---

## Unverified — confirm in the API Playground before live mode

- [ ] **Base URL.** Both `yce-api-01.makeupar.com` and `yce-api-01.perfectcorp.com` appear
      in Perfect Corp materials. We default to the makeupar host.
      → single source of truth: `YINCOL_API_BASE_URL` in `.env`, consumed in
      `server/src/youcam/config.ts`.
- [ ] **Facial color tone task path.** Marketed as detecting skin tone plus eye, eyebrow,
      lip and hair colors, but the task path is unconfirmed. We assume
      `/s2s/v2.0/task/facial-color-tone` by analogy with the other three.
      → `FACIAL_COLOR_TONE_TASK_PATH` in `server/src/youcam/config.ts`.
- [ ] **Facial color tone response shape.** We assume it returns skin, hair, eye, eyebrow
      and lip colors, each with an sRGB hex and/or LAB triple. The palette engine needs
      **skin L\*** and **hair L\*** specifically, since contrast is measured as the L\*
      difference between them.
      → normalisation is isolated in `server/src/youcam/adapters/facialColorTone.ts`.
- [ ] **File API reuse across features.** The File API endpoint appears per-feature (e.g.
      `/s2s/v2.0/file/skin-analysis`). Whether one upload is reusable across features is
      unknown. Moot while we use Path B.
- [ ] **Clothes VTO `garment_category` vocabulary.** We assume `upper_body`, `lower_body`,
      `full_body`. Confirm the accepted enum.
      → `GARMENT_CATEGORIES` in `server/src/youcam/config.ts`.
- [ ] **Result field names on success.** We assume the polled result exposes downloadable
      image URLs under `result.data[].url` for image features and a JSON payload for
      analysis features. Every adapter tolerates several shapes and logs what it actually
      received.
- [ ] **Skin analysis output vocabulary.** We only consume appearance-level signals
      (hydration appearance, evenness of tone, texture appearance). Confirm which keys the
      API actually returns so the mapping in `adapters/skinAnalysis.ts` is exact.
- [ ] **Webhook option.** Docs mention webhooks as an alternative to polling. Not used —
      polling is simpler for a local demo and works behind venue wifi with no ingress.

---

## Open questions

Assumptions logged during the build. Each has a matching
`// ASSUMPTION(phase0): …` comment at the relevant line of code.

### 1. ΔE is CIE76, not CIEDE2000
`shared/src/palette/color.ts` → `deltaE76`

The brief specifies a fit threshold of **25**. Under CIE76 that reads as "the same colour
family, allowing for a different shade", which is the intended meaning. Under CIEDE2000
the just-noticeable difference is about 2.3 and 25 would match nearly anything, so the
threshold was clearly written for CIE76. CIE76 also has the advantage of being explainable
in one sentence — it is the straight-line distance between two points in L\*a\*b\* — which
matters more for a demo whose whole claim is transparency.

**To change:** `deltaE76` is the only distance function, and `FIT_THRESHOLD` in
`shared/src/palette/fit.ts` is the only threshold. Swapping formulas means changing both.

### 2. Undertone is classified from skin hue angle
`shared/src/palette/axes.ts` → `classifyUndertone`

The facial colour tone response shape is unverified, so we do not know whether it returns
an undertone label directly. The fallback classifies from the hue angle of the skin
reading in L\*a\*b\*: human skin occupies a narrow band around 40°–70°, where a higher
angle is more yellow relative to red (golden) and a lower angle more red relative to
yellow (rosy). Boundaries sit at 50° and 60°.

**To change:** `toneAxesFromReading` takes an optional `explicitUndertone` which overrides
the classifier outright. If the API returns a label, pass it through the adapter and the
guess is never used.

### 3. Swatch copy is a function of the three axes, not the raw readings
`shared/src/palette/engine.ts` → `reasonFor`

Two people whose measurements differ but who land in the same three bands receive an
identical palette, wording included. Raw L\* readings appear exactly once, in the
derivation notes. This keeps "same input → same output" true of the whole palette object
rather than only of its hex values.

### 4. Placeholder fixture bytes are synthetic, and labelled as such
`server/fixtures/` and `web/public/fixtures/`

Committed placeholder fixtures are generated ornamental panels, not API output. They exist
so the flow runs before a real capture. Every one is watermarked in the UI as a
placeholder, and `npm run capture-fixtures` overwrites them with genuine API results.

---

## Contrast audit

Recorded in Phase 4. Anything failing WCAG 2.2 AA is logged here rather than silently
changing a design token.

_(populated in Phase 4)_
