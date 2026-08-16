# YINCOL

One selfie, two garments, one makeup look — and one coordinated decision you can save.

YINCOL turns a single photograph into a personal colour palette derived from a
transparent rule, then shows the shopper the same face two ways at a time, so the choice
is a comparison rather than a guess.

---

## What it does

A shopper walks nine screens:

| # | Screen | What happens |
| --- | --- | --- |
| 1 | Intro | The promise, a sample look card, and an explicit consent panel — what is analysed, where it is stored, and a one-tap delete. |
| 2 | Capture | Upload or camera, with framing guidance and a client-side quality check **before** a call is spent. |
| 3 | Selection | Eight garments and five makeup looks. Pick two garments and one look; the picker holds a visible "2 of 2 chosen" state. |
| 4 | Analysis | Three named steps — "Reading your undertone", "Measuring contrast", "Composing your palette". Never a bare spinner. |
| 5 | Your colours | Six swatches plus the "how these were chosen" card, rendered from the palette's own derivation trace rather than from copy. |
| 6 | Preview | Apparel and makeup results as two separately labelled panels, carrying the honesty label *"Apparel and makeup previews are generated separately."* |
| 7 | Two ways to wear it | A segmented control over two axes — garment A vs B with makeup locked, and bare vs made-up with the garment locked. The locked variable sits in a persistent chip; one tap picks a winner per axis. |
| 8 | The look you kept | The saved artifact: wordmark, portrait, winning garment, winning makeup, three swatches, a one-line summary, a provenance note, and a visibly empty row reserved for hair and accessories. |
| 9 | States | Low-quality image · no face detected · one try-on failed while the other three stay usable · empty saved-looks. |

Four Perfect Corp features sit behind it: facial colour tone, skin analysis, clothes
virtual try-on, and makeup transfer.

**What it deliberately is not.** No stylist chat, no catalogue search, no checkout, no
accounts, no database, no hair colour, no earrings.

---

## Running it

Fixture mode is the default. The app runs end to end with **zero network access and zero
API credits** — the demo has to survive venue wifi.

```bash
npm ci
npm run dev
```

`npm run dev` starts the Vite front end on <http://localhost:5173> and the Express proxy
on <http://localhost:8787>.

No `.env` is needed. Fixture mode is on unless `YINCOL_FIXTURE_MODE` is set to exactly
the string `false`, so a typo can never silently start spending credits.

A deliberate ~1.2s delay sits in front of each fixture response. It is not a simulation
of latency for its own sake — it keeps the three-step analysis animation exercised every
time anyone runs the app, because a loading state nobody ever sees is a loading state
nobody maintains.

### Showing the designed states

The four states in screen 9 are reachable without waiting for one to happen. Set
`YINCOL_SIMULATE` and restart the server:

| Value | What you get |
| --- | --- |
| `none` | Normal flow (default). |
| `noFace` | The photograph has no readable face. Replaces the screen rather than banner-ing over it. |
| `partialFailure` | Garment B's try-on fails; the other three panels stay usable. |
| `skinUnavailable` | Skin appearance context is missing. The palette is unaffected — that is the point of `Promise.allSettled`. |

These make the **server** return exactly what it would return in that situation, so the
front end takes the same code path it would take for real. The low-quality-image state
lives client-side and triggers on any photograph that fails the size check in
`shared/src/domain/imageSpec.ts`.

### Checks

```bash
npm test          # 97 tests — 74 in shared/, 23 in server/
npm run typecheck # all three workspaces
npm run contrast-audit --workspace @yincol/web
```

### Switching to live

```bash
cp .env.example .env
```

Then set `YINCOL_API_KEY`, set `YINCOL_FIXTURE_MODE=false`, and set
`YINCOL_PUBLIC_ASSET_BASE_URL` to somewhere the API can reach over the public internet.
That last one is not optional in live mode: we take the public-URL input path, so the API
fetches the images itself and a `localhost` URL means nothing to it.

Three things are still open on the live path, and they are listed here rather than
discovered later:

1. **The front end always sends `fixture:portrait` as the portrait reference**
   (`web/src/App.tsx`). Live mode needs the uploaded photograph published to a public URL
   first — there is no upload-to-hosting step, because Path A (the File API) is defined as
   an interface and left unimplemented on purpose.
2. **Catalogue garments carry no `imageUrl`** (`shared/src/domain/catalog.ts`), so live
   clothes try-on returns a clean "no product image is on file" failure for every garment
   rather than a broken request. Product image URLs are the missing input.
3. **The facial colour tone task path is a guess.** If live mode 404s on the first call,
   that is where to look — see below.

Fixture capture is the supported way to spend credits:

```bash
YINCOL_FIXTURE_MODE=false YINCOL_API_KEY=… YINCOL_PUBLIC_ASSET_BASE_URL=… \
  npm run capture-fixtures
```

It refuses to run while fixture mode is on, and it downloads result bytes the instant a
task succeeds — see [the two-hour rule](#a-note-on-the-demo-images).

---

## The palette rule, in prose

The engine is a pure function in `shared/src/palette/`. No `fetch`, no SDK import, no
`async`, no clock, no random source. The same input always produces byte-identical
output, and that property is what lets us put the rule table on screen and claim it *is*
the rule. It is meant to be opened in front of a judge.

**Three axes come out of the colour-tone reading.**

- **Undertone** — warm, neutral, or cool. Taken from the API's own label when it gives
  one; otherwise classified from the hue angle of the skin reading in L\*a\*b\*, where
  boundaries at 50° and 60° split the narrow band human skin occupies into three.
- **Depth** — light (skin L\* > 65), medium (45–65), or deep (< 45).
- **Contrast** — low (< 20), medium (20–40), or high (> 40), computed as the L\*
  difference between the hair reading and the skin reading. Both come back from the API,
  so this axis is *measured*, not estimated.

**Each axis controls exactly one property**, which is what makes the derivation card
explainable in one sentence per axis:

- Undertone picks the **hue window** — warm opens 28°–96° (amber through olive-gold),
  neutral 335°–55° (rose through peach, wrapping past 360°), cool 258°–348°
  (blue-violet through berry).
- Depth picks the **lightness band** — light 62–92 L\*, medium 48–84, deep 32–76.
- Contrast sets the **saturation ceiling**, and nothing else — 26, 42, or 62 C\*. Low
  contrast between hair and skin means muted colours; high contrast permits saturated
  ones.

That is a 3×3×3 lookup keyed `"${undertone}-${depth}-${contrast}"`, all 27 entries
written out in full in `ruleTable.ts`.

**Six swatches come out of it**, always: two neutrals, two primaries, one accent, one
statement. Each is placed by a fixed recipe that says *where inside the entry's box* it
sits — a fraction across the hue window, a fraction up the lightness band, and a fraction
of the saturation ceiling. So a recipe never hard-codes a colour; it describes a
position, and the rule decides what that position means. Six recipes across 27 entries
give 162 possible swatches, none of them written down anywhere. The statement swatch is
the only one that reaches the full ceiling.

Every swatch carries a hex, a LAB triple, a poetic name from a fixed name table indexed
by hue and lightness, and one plain sentence on why it is there. The poetry lives in the
label and never in the explanation.

**Fit scoring** converts a garment's dominant colour to LAB and computes ΔE against each
of the six swatches, counting those within **25**. The score returns the count, the
total, *the threshold itself*, and the per-swatch breakdown — and the UI shows the
threshold. "4 of 6" with no visible threshold is an assertion; "4 of 6 within ΔE 25" is a
claim a shopper can disagree with, which is the only kind worth putting on screen.

**The derivation trace** travels with the palette: its own three axes, the raw L\*
readings, the matched rule key, and the rule entry. The "how these were chosen" card
renders from that data, so it cannot drift away from what actually happened.

74 tests cover it: all 27 rules produce six swatches, identical input yields identical
output, ΔE is correct on known pairs, and every swatch has a non-empty name and reason.

---

## Architecture

Three layers with hard boundaries. The front end never sees a vendor response shape, and
the palette engine never learns that a network exists.

| Path | What it is |
| --- | --- |
| `web/` | React + Tailwind + Vite. Internal types only. |
| `server/` | Node + Express. Hides the API key and normalises the async pipeline. No database, no auth, no accounts. |
| `shared/` | Framework-free. Domain types and the palette engine. |

Four decisions worth knowing before reading the code:

- **One task runner, not four polling loops.** Every feature follows the same five steps
  — get an image in, `POST` to the task endpoint, receive a `task_id`, poll until
  `task_status` is `success` or `error`, read the result. That is written once in
  `server/src/youcam/taskRunner.ts` with four per-feature configs beside it.
- **Vendor JSON is translated inside the adapter and never escapes it.** Every unverified
  field name is tolerated in one place, `server/src/youcam/adapters/`.
- **Try-on results are a discriminated union**, `{status:'ready'} | {status:'failed'}`,
  not an optional field — so failure has to be handled at compile time.
- **Analysis calls use `Promise.allSettled`, never `Promise.all`.** Skin analysis is
  optional context; the palette is the product. Skin analysis failing must not take the
  palette down with it.

---

## What is verified about the API, and what is not

This matters more than it sounds. Some of what follows is confirmed from Perfect Corp's
documentation; some is a reasonable guess that has to be checked in the API Playground
before anyone relies on it. The full list, with every open question, lives in
[`docs/api-findings.md`](docs/api-findings.md).

**Verified.** v2.0 endpoints authenticate with `Authorization: Bearer <key>` directly —
no RSA or `client_secret` exchange; that is legacy v1 and we do not build it. Every
feature follows the same async pipeline. Credits burn on success only — a task that ends
in `error` costs nothing. Success download URLs expire after **two hours**, while
`task_id` persists 30 days. Makeup transfer works from a **reference photo of a made-up
face**, not from shade values or SKUs. Three endpoints are confirmed:
`POST /s2s/v2.0/task/cloth`, `POST /s2s/v2.0/task/mu-transfer`,
`POST /s2s/v2.0/task/skin-analysis`.

**Not verified.** The API host — both `yce-api-01.makeupar.com` and
`yce-api-01.perfectcorp.com` appear in Perfect Corp materials, and we default to the
former. The facial colour tone task path and its response shape. The image field name on
a task-start payload. Whether one File API upload is reusable across features. The
`garment_category` enum. The exact field names on a successful result.

Each of those is a single config constant in `server/src/youcam/config.ts` with a
`// TODO(phase0): verify in API Playground` beside it, so confirming one is a one-line
change. Nothing marked unverified is repeated as fact anywhere in the UI — the server's
`/api/health` endpoint reports which task paths we can actually cite.

---

## A note on the demo images

**Nothing in this demo is generated live, and nothing shipped in this repository is an
API output.**

Two kinds of picture exist here, and they are never allowed to be confused:

- **Placeholders.** The four SVG panels in `web/public/fixtures/` are designed
  stand-ins — a cream 3:4 panel with a gold hairline frame and a quiet caption. They ship
  with the repo so the flow runs before any capture exists. Every one is labelled
  `provenance: 'placeholder'` by the server and surfaced as such in the UI. This is what
  the demo currently runs on.
- **Captured results.** `npm run capture-fixtures` is the only thing in the repository
  that produces a result image. It runs the real API once, downloads the bytes
  immediately — the download URL is dead in two hours, so bytes are what survive to demo
  day — and writes them over the placeholders. Those are labelled `provenance:
  'captured'`, and they are **real API outputs, pre-captured**, not generated in front of
  the audience.

If a picture in `web/public/fixtures/` did not come from that script, it is a placeholder,
and it must never be described as an API output.

Fixtures store **bytes, never URLs**, for the same two-hour reason. A fixture holding a
URL would be dead by the morning of the demo.

---

## Images

Four **source** images are supplied by the team; three **result** images are generated by
the capture script and never hand-supplied. `assets/source/` is gitignored, because face
images carry likeness rights — they must be a team member's own photograph or properly
licensed. Full detail, including the four specs, in [`assets/README.md`](assets/README.md).

The app runs fully on ornamental placeholders until real photographs land.

---

## Accessibility

WCAG 2.2 AA: 4.5:1 text contrast, 44px touch targets, visible focus rings, a full
keyboard path including axis switching, alt text on every photograph, and a non-visual
text summary of the look card. `prefers-reduced-motion` turns every transition into an
instant state change.

`npm run contrast-audit --workspace @yincol/web` checks every gold instance and every
pastel button ground and prints the ratios. Two known gaps are recorded — antique gold is
ornament only, never text — and they are written up in
[`docs/api-findings.md`](docs/api-findings.md) rather than patched by nudging a design
token until the number goes green. A **new** failure fails the run.

---

## A note on language

YINCOL describes appearance, never health. Skin signals are framed as context for
choosing colour — "hydration appearance", "even-looking tone", "texture appearance" — and
never as an assessment of the person. There are no diagnoses, conditions, treatments, or
severity grades anywhere in this repository, including in type and field names.

---

## Build phases

The branch history is the work log; each phase is one commit.

| Phase | What landed |
| --- | --- |
| 0 | Scaffold, gitignore, env template, API-unknowns doc |
| 1 | Palette engine — 27-rule table, ΔE fit scoring, full test suite |
| 2 | Generic task runner, four feature adapters, fixture mode, capture script |
| 3 | Nine-screen flow on fixtures |
| 4 | Error states and a WCAG 2.2 AA pass |
| 5 | Docs |
