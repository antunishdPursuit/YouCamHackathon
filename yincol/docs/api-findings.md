# API findings — Perfect Corp / YouCam S2S v2.0

This file separates what we treat as **ground truth** from what we **guessed and must
confirm** in the [API Playground](https://docs.perfectcorp.com/develop/introduction).

Nothing marked unverified below should be repeated as fact in a demo, a README, or to a
judge. Every unverified item has a matching `// TODO(phase0): verify in API Playground`
in the code and a single config constant that can be changed in one place.

Nothing here was confirmed against a live endpoint — the whole build ran in fixture mode,
which is what the brief asked for. So every checkbox below is still unchecked, and the
first live call is the moment they start getting ticked.

**Check these four first, in this order.** They are the ones that stop a live call from
working at all, and the rest can be discovered from a successful response:

1. Base URL — one of two hosts.
2. Facial colour tone task path — the single most likely thing to 404.
3. Image field name on a task-start payload.
4. Result field names on success.

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
- [ ] **Image field name on a task-start payload.** Taking Path B, we pass the image as
      `src_url` on the start payload, and the garment and makeup reference as
      `garment_image` / `reference_image`. The names are inferred, not cited.
      → `imageField` in `server/src/youcam/features.ts` is the only place the portrait key
      appears; the two secondary keys sit in the payload builders directly below it.
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

### 5. The live path is written but not reachable from the UI
`web/src/App.tsx` → `beginAnalysis`

The front end always sends `'fixture:portrait'` as the portrait reference. In live mode
the server would pass that string to the API as a public image URL, which is meaningless
to it. Publishing the shopper's uploaded photograph to a public URL is the missing step,
and it is missing on purpose: Path A (the File API) is defined as an interface and left
unimplemented per the brief, so there is nowhere to upload to.

The live code path itself is complete and exercised by the capture script, which supplies
real public URLs from `YINCOL_PUBLIC_ASSET_BASE_URL`. That is the supported way to spend
credits.

**To change:** either implement Path A in `server/src/youcam/imageInput.ts` (the interface
is already there), or add a small upload-to-public-host step and pass the resulting URL
as `portraitRef`.

### 6. Catalogue garments carry no product image URL
`shared/src/domain/catalog.ts` → `GARMENTS`

Eight garments are defined with a name, category, and dominant hex — enough for the picker
and for fit scoring, which only needs the colour. None has an `imageUrl`, because no
garment product images were supplied.

Live clothes try-on therefore returns a clean, typed failure — *"No product image is on
file for X, so it cannot be tried on"* — for every garment, rather than a broken request.
Fit scoring, the palette, and the whole fixture-mode flow are unaffected, since none of
them needs the photograph.

**To change:** add `imageUrl` to the catalogue entries. The field is already optional on
the `Garment` type and already read by `routes/tryOn.ts`.

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
