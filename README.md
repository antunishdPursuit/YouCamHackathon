# YINCOL

One selfie, two garments, one configured makeup look — and one coordinated decision you can keep for this session.

YINCOL turns a single photograph into a personal colour palette derived from a
transparent rule, then shows the shopper the same face two ways at a time, so the choice
is a comparison rather than a guess.

---

## What it does

A shopper walks four stages:

| # | Stage | What happens |
| --- | --- | --- |
| 1 | Start | The promise, a concise privacy disclosure, and session-only deletion. |
| 2 | Add inputs | Upload a portrait and two garment references, then choose one makeup effects preset. Each image gets a client-side quality check before a call is spent. |
| 3 | Generate | Named progress steps: checking images, reading colour context, generating garment previews, and applying makeup. Never a bare spinner. |
| 4 | Results | A compact palette, separate garment and makeup previews, one-variable-at-a-time comparison, provenance labels, session-only keep/start-over actions, and reuse of matching completed previews. |

Four Perfect Corp features sit behind the fixture flow: facial colour tone, skin analysis,
clothes virtual try-on, and makeup virtual try-on. The current documented makeup endpoint
uses an effects configuration, not a makeup reference image.

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

A deliberate ~1.2s delay sits in front of each fixture response. It keeps the four-step
generation progress visible every time anyone runs the app, because a loading state
nobody ever sees is a loading state nobody maintains.

### Showing the designed states

The designed failure states are reachable without waiting for one to happen. Set
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
npm test          # 112 tests — 74 in shared/, 38 in server/
npm run typecheck # all three workspaces
npm run contrast-audit --workspace @yincol/web
```

### Switching to live

```bash
cp .env.example .env
```

Then set `YINCOL_API_KEY`. For the currently verified live paths, keep
`YINCOL_FIXTURE_MODE=true` and enable only the opt-in flags below. Do not set
`YINCOL_FIXTURE_MODE=false` yet: the Facial Color Tones Analyzer input and response
contract still needs verification before the palette can run live. The server-side
File API upload primitive handles the verified Skin Analysis, Clothes VTO, and Makeup
VTO paths, so
`YINCOL_PUBLIC_ASSET_BASE_URL` is needed only by the existing public-URL fixture capture
path, not by the new upload path.

To test only the browser-to-Skin-Analysis increment while keeping the rest of the demo
safe on fixtures, leave `YINCOL_FIXTURE_MODE=true` and set:

```bash
YINCOL_LIVE_SKIN_ANALYSIS=true
```

The selected JPEG or PNG remains in browser memory, is sent as bounded base64 JSON to
`POST /api/skin-analysis`, uploaded through the verified File API path, and mapped back
to YINCOL appearance context. The palette and try-on screens remain fixture-backed in
this mode. No portrait is persisted.

To test the verified live Clothes and Makeup VTO path while keeping the palette on its
fixture-backed color engine, leave `YINCOL_FIXTURE_MODE=true` and also set:

```bash
YINCOL_LIVE_TRY_ON=true
```

The browser sends its portrait and selected garment files to `POST /api/try-on`. The
server uploads them through the feature-specific File APIs, downloads successful result
bytes immediately, and returns in-memory image data to the browser. This runs two Clothes
tasks and one Makeup task, so successful tasks consume API units. Use real team-owned or
licensed source images; do not commit them.

The live adapter reads score records from YouCam's `output` array and normalizes the
whole-face `skin_type` value into a colour-only "finish appearance" signal. It ignores
vendor fields such as masks, overall scores, skin age, and concern names.

The remaining live-path gaps are listed here rather than discovered later:

1. **The live Skin Analysis increment is now wired** (`web/src/App.tsx`,
   `server/src/routes/skinAnalysis.ts`). The browser upload is opt-in with
   `YINCOL_LIVE_SKIN_ANALYSIS=true`; the full live palette is still blocked on the
   unverified Facial Color Tone input, File API, and response contract below.
2. **The Facial Color Tone task path is recorded but not enabled.** The read-only
   feature-cost response lists `/s2s/v2.0/task/skin-tone-analysis`; the full task
   contract still needs a live check before it can replace the local palette.

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
documentation; some is verified locally; and some is a reasonable guess that has to be
checked in the API Playground before anyone relies on it. The full list, with every open
question, lives in
[`docs/api-findings.md`](docs/api-findings.md).

**Verified locally.** v2.0 endpoints authenticate with `Authorization: Bearer <key>`
directly — no RSA or `client_secret` exchange; that is legacy v1 and we do not build it.
The Skin Analysis File API, signed upload, task, polling, and result mapping work locally.
Credits burn on success only — a task that ends in `error` costs nothing. Success download
URLs expire after **two hours**, while `task_id` persists 30 days.

**Verified locally.** Clothes VTO uses
`POST /s2s/v2.0/task/cloth-v3` with `ref_file_id`, `ref_file_url`, or `template_id`.
Makeup VTO uses `POST /s2s/v2.0/task/makeup-vto` with an `effects` configuration and
`version: "1.0"`; the current documentation does not define a makeup reference-image
input. Both paths have a successful live smoke test and the opt-in browser path returns
in-memory result bytes.

**Not verified.** The API host — both `yce-api-01.makeupar.com` and
`yce-api-01.perfectcorp.com` appear in Perfect Corp materials, and we default to the
former for the locally verified paths. Facial Color Tone's input contract, File API path,
and response mapping. The feature-specific File API reuse behavior. The
`garment_category` enum. The current account balance.

The read-only feature-cost response recorded these current unit costs: Clothes VTO V3 =
2 units/result, Makeup VTO = 1, Skin Analysis V2.0 SD with 1–4 concerns = 9 or 5–8
concerns = 12, and Facial Color Tones Analyzer = 20. YINCOL's current five-action Skin
Analysis request uses the 12-unit bracket, so one successful opt-in flow uses 17 units
(Skin Analysis + two Clothes results + one Makeup result). The exact current balance still
belongs in the account console, not in this repository.

Each remaining open item is isolated behind the server boundary. Nothing marked
unverified is repeated as fact anywhere in the UI — the server's
`/api/health` endpoint reports which task paths we can actually cite.

---

## A note on the demo images

**Fixture mode ships with placeholders, and nothing shipped in this repository is an
API output.** Opt-in live mode can return temporary YouCam result bytes in memory during
local testing.

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

Portrait and garment reference images can be selected in the input workspace and remain
in the browser tab. The current fixture preview path still uses the local garment
catalogue ids; uploaded garment bytes are not presented as live provider inputs. Makeup
is a request-side effects configuration, not a reference image. `assets/source/` remains
gitignored because face images carry likeness rights. Full detail is in
[`assets/README.md`](assets/README.md).

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
choosing colour — "hydration appearance", "even-looking tone", "texture appearance", and
"finish appearance" — and never as an assessment of the person. There are no diagnoses,
conditions, treatments, or severity grades anywhere in this repository, including in type
and field names.

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
