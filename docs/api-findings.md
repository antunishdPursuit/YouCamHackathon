# API findings — Perfect Corp / YouCam S2S v2.0

**Last reviewed:** August 17, 2026
**Evidence rule:** Official documentation is documented evidence, not live verification.
Skin Analysis, Clothes VTO, and Makeup VTO have now been verified end to end with our
account and the selected close-up portrait. Facial Color Tone remains open for a live
task and response-shape check; its current task path is now recorded from the provider's
read-only feature-cost response.

This file separates what we treat as **documented**, what we have **verified locally**,
and what remains **open**. Nothing marked open should be repeated as fact in a demo, a
README, or to a judge. Every open implementation assumption should have a matching
`// TODO(phase0): verify in API Playground` in the code or be removed before live use.

The original build ran in fixture mode. On 2026-08-16, local live smoke tests confirmed the
configured host, feature-specific File API metadata responses, pre-signed `PUT`s, task
start, polling, and result-image downloads for Skin Analysis, Clothes VTO, and Makeup VTO.
The browser-shaped palette remains fixture-backed, while the opt-in browser try-on path
now uploads the selected portrait and garment files and maps live result bytes in memory.

The browser-shaped fixture request and the opt-in live request both pass locally. The live
request completed the metadata, upload, task, and polling steps. The adapter now reads the
documented `data.results.output` records, maps safe appearance scores, and normalizes a
whole-face `skin_type` record into colour-only finish context. An earlier 401 was traced
to the workspace server not loading the repository-root `.env`; `server/src/loadEnv.ts`
now loads that file explicitly.

After the adapter update, the same close-up portrait returned `mode: "live"` with
`textureAppearance` and `finishAppearance` signals. The vendor's `Oily` value was
normalized into the latter signal and was not returned to the browser.

**Before any non-Skin live call, check these four items:**

1. The current feature endpoint and payload contract.
2. The feature-specific File API path and the required signed `PUT`.
3. An approved source portrait and reference garment image.
4. The exact unit cost and observed result shape.

---

## Verified locally or documented by the provider

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
  image URL directly on task start. **Path A is implemented for Skin Analysis in
  `server/src/youcam/imageInput.ts`; the browser uses it through
  `server/src/routes/skinAnalysis.ts` and the opt-in live try-on route, while the capture
  script still uses Path B.**
- **Skin Analysis task payload.** The verified request uses `src_file_id` (or
  `src_file_url`), `dst_actions`, and `format: "json"`. The browser route sends the
  documented SD action set `wrinkle`, `pore`, `texture`, `acne`, and `skin_type`.
- **Skin Analysis result mapping.** The observed response puts result records under
  `data.results.output`. YINCOL reads numeric records whose `type` is a safe appearance
  key, preferring `ui_score` and falling back to `score` or `raw_score`. A whole-face
  `skin_type` value of `Oily`, `Dry`, `Normal`, or `Combination` becomes the internal
  colour-only `finishAppearance` signal. Mask URLs, `all`, `skin_age`, and other vendor
  concern names are ignored.
- **Polling.** 2-second interval, cap ~120 attempts. Rate limits are 250 requests per 300
  seconds, enforced per IP and per token, ~5 QPS recommended. Our concurrency is far below
  that, so a simple backoff on 429 is sufficient.
- **Billing.** Credits burn on success only. `task_status: "error"` and `running` consume
  no credits.
- **Feature costs.** The read-only feature-cost response returned these current values:
  Clothes VTO V3 = 2 units per result image; Makeup VTO = 1; Skin Analysis V2.0 SD with
  1–4 concerns = 9 or 5–8 concerns = 12; Facial Color Tones Analyzer = 20. YINCOL's
  current five-action Skin Analysis request uses the 12-unit bracket, so one successful
  opt-in flow uses 17 units. The current account balance is not stored here.
- **Result expiry.** Uploaded files, `file_id` and `task_id` persist 30 days, but the
  download URL returned on success is valid for **2 hours only**; after that a fresh link
  is re-derived from the `task_id`. This is why fixtures store downloaded **image bytes**
  in the repo and never URLs, and why the capture script downloads immediately after a
  task succeeds.
- **Clothes VTO contract is live verified.** The current task is
  `/s2s/v2.0/task/cloth-v3`, with `src_file_id` or `src_file_url` for the person and
  `ref_file_id`, `ref_file_url`, or `template_id` for the garment reference. The File API
  path is `/s2s/v2.0/file/cloth-v3`. One `upper_body` request using the selected portrait
  and a temporary shirt reference returned `data.results.url`; the JPEG result downloaded
  successfully. The temporary reference was not stored in the repository.
- **Makeup VTO contract is live verified.** The current task is `/s2s/v2.0/task/makeup-vto`,
  with `/s2s/v2.0/file/makeup-vto` for the portrait. The task uses `src_file_id` or
  `src_file_url`, an `effects` configuration, and `version: "1.0"`; this path does not
  use a makeup reference image. One request returned `data.results.url`; the result
  downloaded successfully. The live API also confirmed that a gloss lip palette requires
  `transparencyIntensity`, which is now present in the payload builder.
- **Feature-specific image constraints apply.** The shared ceiling is a 4096px long side
  and files must remain under 10 MB. Clothes VTO and Makeup VTO publish additional
  feature-specific framing and face requirements. Do not treat the old universal “face
  over 60% of image width” note as a provider-wide rule.

## Endpoints and evidence level

| Feature | Method + path | Notes |
| --- | --- | --- |
| Skin Analysis file metadata | `POST /s2s/v2.0/file/skin-analysis` | Locally verified; response provides `file_id` and a pre-signed `PUT` request. |
| Clothes VTO file metadata | `POST /s2s/v2.0/file/cloth-v3` | Live verified; response provided a file id and pre-signed `PUT` request. |
| Clothes VTO | `POST /s2s/v2.0/task/cloth-v3` | Live verified with `ref_file_id`; success returned `data.results.url`. |
| Makeup VTO file metadata | `POST /s2s/v2.0/file/makeup-vto` | Live verified; response provided a file id and pre-signed `PUT` request. |
| Makeup VTO | `POST /s2s/v2.0/task/makeup-vto` | Live verified with `effects`; success returned `data.results.url`. |
| Skin Analysis | `POST /s2s/v2.0/task/skin-analysis` | Locally verified end to end. |
| Facial Color Tones Analyzer | `POST /s2s/v2.0/task/skin-tone-analysis` | Task path recorded by the feature-cost response; input, File API, and result mapping remain unverified. |

---

## Open — confirm before live mode

- [x] **Non-Skin host behavior.** `yce-api-01.makeupar.com` accepted the current Clothes
      VTO and Makeup VTO File API and task paths in the local live smoke tests.
      → single source of truth: `YINCOL_API_BASE_URL` in `.env`, consumed in
      `server/src/youcam/config.ts`.
- [x] **Facial color tone task path recorded.** The provider's read-only feature-cost
      response lists `/s2s/v2.0/task/skin-tone-analysis` for AI Facial Color Tones
      Analyzer. This does not verify the input fields, File API path, or response shape.
      → `FACIAL_COLOR_TONE_TASK_PATH` in `server/src/youcam/config.ts`.
- [ ] **Facial color tone response shape.** We assume it returns skin, hair, eye, eyebrow
      and lip colors, each with an sRGB hex and/or LAB triple. The palette engine needs
      **skin L\*** and **hair L\*** specifically, since contrast is measured as the L\*
      difference between them.
      → normalisation is isolated in `server/src/youcam/adapters/facialColorTone.ts`.
- [x] **Clothes VTO live smoke test.** One `cloth-v3` task completed with an upper-body
      garment reference; `data.results.url` was downloaded successfully.
- [x] **Makeup VTO live smoke test.** One `makeup-vto` task completed with the effects
      payload and no makeup reference image; `data.results.url` was downloaded successfully.
- [ ] **File API reuse across features.** Skin Analysis metadata and upload are verified.
      Whether a `file_id` can be reused across current feature-specific File API paths is
      unknown. Treat each feature's File API path as separate until confirmed.
- [ ] **Clothes VTO `garment_category` vocabulary.** We assume `upper_body`, `lower_body`,
      `full_body`. The official example shows `full_body`; confirm the accepted enum.
      → `GARMENT_CATEGORIES` in `server/src/youcam/config.ts`.
- [x] **Result field names on success.** Both live smoke tests returned
      `data.results.url`, and both result downloads succeeded. Keep the adapter tolerant
      until more than one successful response is captured per feature.
- [x] **Feature cost.** The read-only feature-cost response recorded the scoped costs:
      Clothes VTO V3 = 2 units/result, Makeup VTO = 1, Skin Analysis V2.0 SD with 1–4
      concerns = 9, and Facial Color Tones Analyzer = 20.
- [ ] **Available balance.** Check the account console before spending on a live Facial
      Color Tones task or a repeated demo run.
- [ ] **Webhook option.** Docs mention webhooks as an alternative to polling. Not used —
      polling is simpler for a local demo and works behind venue wifi with no ingress.

---

## Stale assumptions corrected on August 16, 2026

The previous repository planning model treated Clothes VTO as `/task/cloth` with
`garment_image` and treated Makeup as `/task/mu-transfer` with a `reference_image`.
Those assumptions are not the current documented contract. The current official pages
describe Clothes VTO `cloth-v3` with a garment reference file or template, and Makeup VTO
`makeup-vto` with an `effects` configuration. The adapter has now been updated to build
those contracts, and both non-Skin live paths have one successful smoke test. The browser
integration is now wired as an opt-in browser path. The Facial Color Tones Analyzer
task path was corrected to the provider-listed `/s2s/v2.0/task/skin-tone-analysis`, but
the feature remains disabled until its complete live contract is verified.

Sources:

- [Perfect Corp Quick Start Guide](https://docs.perfectcorp.com/develop/quick_start_guide)
- [AI Clothes Virtual Try-On reference](https://docs.perfectcorp.com/reference/ai_clothes/section/overview)
- [AI Makeup Virtual Try-On reference](https://docs.perfectcorp.com/reference/makeup_vto/section/overview)
- [AI Facial Color Tones Analyzer reference](https://docs.perfectcorp.com/reference/ai_skin_tone_analysis/v1.0)
- [Perfect Corp Release Notes](https://docs.perfectcorp.com/release/changelog)

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

Five of them now, not four: each garment slot gained a complete-look counterpart, and the
bare-makeup panel went away with the unsequenced path that produced it. A placeholder is
returned with no `stage`, so it can never describe itself as a complete look.

### 5. The live Skin Analysis path is isolated from the live palette path
`web/src/App.tsx` → `requestSkinAnalysis` and `server/src/routes/skinAnalysis.ts`

The browser keeps the selected JPEG or PNG in memory and sends it as base64 JSON to the
dedicated route. The server performs the verified metadata request, signed `PUT`, task
start, polling, and adapter mapping. Set `YINCOL_LIVE_SKIN_ANALYSIS=true` while leaving
`YINCOL_FIXTURE_MODE=true` to test this path without enabling the live palette. The
resulting skin appearance context is labelled as live in the UI; the palette and previews
remain fixtures in that mode. The current live response completes successfully and now
yields the safe appearance context that the adapter can read.

**To change:** once Facial Color Tone is confirmed, add a separate live palette increment
that accepts the same browser-held portrait. Do not treat the current fixture palette as a
live result.

### 6. The opt-in live browser try-on path

`web/src/api/client.ts` → `server/src/routes/tryOn.ts` → `server/src/youcam/imageInput.ts`

When `YINCOL_LIVE_TRY_ON=true` and fixture mode remains on, the browser sends its selected
portrait and garment references as bounded base64 JSON. The server uploads each image
through the feature-specific File API, runs the complete-look sequence per garment,
downloads successful result bytes before the vendor URL expires, and returns in-memory data
URLs. The browser receives only the internal `TryOnResponse` shape; it does not receive the
API key or vendor response JSON. Missing garment input fails only that garment panel.

The live browser-shaped request passed locally on August 16, 2026 with two temporary shirt
references. Both garment panels, the makeup panel, and the portrait returned `ready` with
`provenance: "live"`. The temporary references were not stored.

### 8. The sequenced complete-look path
`server/src/youcam/completeLook.ts` → `server/src/routes/tryOn.ts`

Each selected garment runs Clothes VTO, then Makeup VTO on the image Clothes VTO returned.
The second task's portrait input is the first task's downloaded result, uploaded through
the Makeup VTO File API — there is nowhere public to put an image that exists only in
server memory, so step 2 always takes Path A regardless of how step 1's inputs arrived.

**Cost.** A fully successful generation is now four successful tasks, not three: two
Clothes and two Makeup. The previous shape ran one Makeup task on the bare portrait, which
was cheaper and was not a complete look. Failed and running tasks still consume nothing,
and a repeated in-session request is served from the browser's session cache.

**The invariant.** `stage: 'completeLook'` is assigned at exactly one place, immediately
after the makeup task returns an image it was given the garment result to work from. A
shipped placeholder gets no stage at all. The UI is only allowed to say "complete look"
where that stage is present, which is what keeps the claim checkable rather than assumed.
`server/src/youcam/completeLook.test.ts` asserts the ordering, the chained bytes, and that
a failed panel carries no stage.

**Failure granularity.** Three outcomes per garment, all local and none fatal to the other
garment: both panels fail (the garment task never produced an image), the garment panel
survives and the complete look fails (the makeup step failed), or both succeed.
`YINCOL_SIMULATE=completeLookFailure` reproduces the middle one on fixtures.

**Not yet verified live.** The sequence itself has been verified by direct local smoke test
per the handoff note, and the browser route is covered by stubbed-`fetch` tests, but the
browser route running the sequence against the live API has not been re-run since this
change. That check is the one thing outstanding before this path is called live-verified.

### 7. Catalogue garments carry no product image URL
`shared/src/domain/catalog.ts` → `GARMENTS`

Eight garments are defined with a name, category, and dominant hex — enough for the picker
and for fit scoring, which only needs the colour. None has an `imageUrl`, because no
garment product images were supplied.

Live clothes try-on does not require catalogue `imageUrl` values: the browser supplies a
garment reference keyed to the selected catalogue id. Fixture mode still uses catalogue
ids to choose the designed placeholder or captured fixture. Fit scoring remains based on
the catalogue dominant colour, not on the provider result.

**To change:** add catalogue `imageUrl` values only if the product picker later needs
catalogue-owned reference images without a user upload. That is not required for the
current live browser flow.

---

## Contrast audit

Recorded in Phase 4, re-run in Phase 5. Reproduce with:

```bash
npm run contrast-audit --workspace @yincol/web
```

Anything failing WCAG 2.2 AA is logged here rather than silently changing a design token.
The script distinguishes a **known gap** (investigated, written up below, does not fail the
run) from a **new failure** (undocumented, exits non-zero). That distinction is the point:
a baseline, not an excuse.

| Ratio | Needs | Result | What |
| ---: | ---: | --- | --- |
| 11.21 | 4.5 | pass | ink on ground (body) |
| 10.37 | 4.5 | pass | ink on surface (body) |
| 8.51 | 4.5 | pass | ink on powder (primary button label) |
| 8.80 | 4.5 | pass | ink on sky (locked chip) |
| 7.80 | 4.5 | pass | ink on wisteria |
| 7.56 | 4.5 | pass | ink-soft on ground (secondary) |
| 6.99 | 4.5 | pass | ink-soft on surface (secondary) |
| 5.74 | 4.5 | pass | ink-soft on powder (secondary) |
| 2.39 | 3.0 | **AA-1** | gold hairline on ground (non-text border) |
| 2.21 | 3.0 | **AA-1** | gold hairline on surface (non-text border) |
| 1.81 | 3.0 | **AA-1** | gold hairline on powder (non-text border) |
| 2.39 | 4.5 | **AA-0** | gold as text on ground — must never be used |
| 11.21 | 3.0 | pass | focus ring (ink) on ground |
| 10.37 | 3.0 | pass | focus ring (ink) on surface |

Four known gaps. No new failures.

### AA-0 — antique gold fails as text, at 2.39:1 against every ground

Not a gap in the build; a gap in the palette itself, recorded so nobody later "improves"
the design by using gold for a heading. Antique gold `#C6A15B` cannot carry text on any of
our light grounds — it needs 4.5:1 and reaches 2.39:1 on milk cream.

**Resolution: gold is never used as text.** Body and heading text is deep rose-brown
`#4E323B` (11.21:1) or the softer `#6B4A54` (7.56:1). The check stays in the audit as a
tripwire — if someone introduces gold text, this row is already there arguing against it.

### AA-1 — gold hairlines sit below 3:1 as non-text contrast

Gold hairline frames, corner flourishes, pearl-dot dividers and small ornamental icons
land between 1.81:1 and 2.39:1 against the grounds they are drawn on. WCAG 2.2 SC 1.4.11
asks 3:1 of non-text content **that conveys information or is required to identify a
control**.

**Assessed as not applicable, and left as is.** Every gold instance in the build is purely
decorative: the frame around a card, the flourish in its corner, the rule above and below
the wordmark, the dot between sections. Nothing gold carries meaning on its own and
nothing gold identifies a control —

- Card and panel boundaries are also conveyed by a background change (`#FFFDF9` ground
  against `#FBF3EA` surface) and by radius, so the hairline is reinforcement, not the
  boundary itself.
- Every control's boundary, state, and focus ring is drawn in ink, not gold — the focus
  ring checks in at 11.21:1, well past the 3:1 required.
- The selected-option ribbon carries a text label alongside it, per the "never colour
  alone" rule, so the ribbon's gold is never the only signal.

Darkening the gold to reach 3:1 would take it out of the antique-gold range the whole
visual direction rests on. That is a design change, and the brief says to log the failure
rather than make one quietly. **Logged, deliberate, and open to being overruled.**

**If it is overruled:** `#9C7838` is the lightest gold we measured that clears 3:1 on all
three grounds — 4.01:1 on milk cream, 3.71:1 on parchment, 3.04:1 on powder pink, against
`#C6A15B`'s 2.39 / 2.21 / 1.81. Powder pink is the binding constraint; anything lighter
than this passes on the two cream grounds and fails on the pink. It reads as a darker,
more bronze gold, which is a real loss to the vanity-table feel — hence the recommendation
to leave it. It is a one-line change to the `gold` token in `web/tailwind.config.js`, and
the audit's `TOKENS.gold` in `web/scripts/contrast-audit.ts` has to move with it.
