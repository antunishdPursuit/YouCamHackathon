# Verification record

**Record updated:** August 29, 2026
**Final verification tree:** captured-fixture tree represented by `7412d68`, later
merged into `main` by PR #5. The capture commit was subsequently rewritten to remove
historical presigned URLs; its file content and the results below were unchanged.
**Machine:** Windows 11, Node 20+, npm workspaces from the repository root
**Issue:** #4 item 14 — run and record tests, typecheck, build, dependency audit, and
browser verification.

This file records what was run and what came back. Where a check could not be run, it
says so and why, rather than leaving the row out.

**Three runs are recorded, oldest first. The third is the current state** — it was run
after the captured fixtures landed, and it supersedes the two below it wherever they
disagree. Skip to [the third run](#third-run--final-after-the-captured-fixtures) for what
is true now; the earlier two are kept because they record when each property was
established.

---

## Summary

| Check | Command | Result |
| --- | --- | --- |
| Tests | `npm test` | **172 passed**, 0 failed (74 shared, 98 server) |
| Typecheck | `npm run typecheck` | **clean**, all three workspaces |
| Build | `npm run build` | **succeeded**, 186.56 kB JS / 58.44 kB gzipped |
| Contrast audit | `npm run contrast-audit --workspace @yincol/web` | **4 known gaps, no new failures** |
| Dependency audit | `npm audit` and `npm audit --omit=dev` | **5 dev-toolchain findings; 0 production vulnerabilities** |
| Browser | fixture-mode walkthrough with captured fixtures | **passed** — see the third run below |

---

The entries below are the first recorded run. They are retained as historical evidence;
the current values are in the third run.

## Tests — 131 passed

```
shared   3 files    74 tests   passed
server   7 files    57 tests   passed
```

Up from 125. The six new tests are `server/src/youcam/publicError.test.ts`, covering the
rule that a provider error is never published. One existing test in
`completeLook.test.ts` was tightened from "redacts the signed URL" to "publishes none of
the provider response, and the detail is still on the console".

## Typecheck — clean

`tsc --noEmit` across `shared`, `server` and `web`. No errors.

## Build — succeeded

```
dist/index.html                  1.17 kB │ gzip:  0.62 kB
dist/assets/index-*.css         18.65 kB │ gzip:  4.50 kB
dist/assets/index-*.js         185.14 kB │ gzip: 58.00 kB
built in 21.39s
```

**Historical first-run limitation.** At this stage, `npm run build` built the web bundle
only. There was no server build step — `@yincol/server`'s `start` script ran `tsx
src/index.ts`, and `tsx` was a devDependency — and nothing served `dist/` in a production
run. The production start path was added and verified in the second run below for issue
#4 item 3.

## Contrast audit — 4 known gaps, no new failures

Unchanged from the recorded baseline: three AA-1 rows for gold hairlines used as
non-text ornament, and one AA-0 row for gold as text, which is a tripwire rather than a
usage. All four are written up in [`api-findings.md`](api-findings.md#contrast-audit).
The script exits non-zero only on an undocumented failure, and found none.

## Dependency audit — 5 findings, all in the dev toolchain

```
CRITICAL  vitest        Vitest UI server: arbitrary file read/execute when listening
HIGH      vite          path traversal in optimized-deps .map handling;
                        server.fs.deny bypass on Windows alternate paths;
                        launch-editor NTLMv2 hash disclosure via UNC paths
MODERATE  esbuild       dev server accepts cross-origin requests and returns responses
MODERATE  @vitest/mocker  via vite
MODERATE  vite-node       via vite
```

**Assessment: none of these ship, and none apply to a fixture-only deployment.** Every
one is a `devDependencies` package — `vite`, `vitest`, `esbuild` and their children. The
production dependency set is `react` and `react-dom` in `web/`, and `cors`, `dotenv` and
`express` in `server/`; none of them appear in the audit. Every advisory describes a
**development server** or the **Vitest UI**, neither of which exists in a built artifact.

**Where they do apply:** anyone running `npm run dev` or `npm test` on an untrusted
network. The dev server binds localhost only unless `--host` is passed, which the repo
does not do.

**Not fixed here, deliberately.** `npm audit fix --force` resolves them by installing
`vite@8`, a major-version jump across the build and test toolchain. That is not closeout
work, it is a toolchain upgrade with its own verification burden, and #4's constraints
say not to expand scope. Recorded for the owner to schedule.

## Browser verification — fixture mode, Chrome

**Credit safety first.** The repository-root `.env` on this machine has
`YINCOL_LIVE_SKIN_ANALYSIS=true`, `YINCOL_LIVE_TRY_ON=true` and a real API key, so a
default `npm run dev` here would have spent units. `server/src/loadEnv.ts` calls
`dotenv.config()` without `override`, so shell variables win. The run was started as:

```bash
YINCOL_FIXTURE_MODE=true YINCOL_LIVE_SKIN_ANALYSIS=false YINCOL_LIVE_TRY_ON=false \
  YINCOL_API_KEY= YINCOL_SIMULATE=none npm run dev
```

and `/api/health` confirmed it before anything was clicked:

```json
{"ok":true,"mode":"fixture","liveSkinAnalysis":false,"liveTryOn":false,"hasApiKey":false}
```

The server log was checked afterwards for provider activity and had none. **No API units
were spent producing this record.**

### What was walked

Three generated PNGs at 1200×1600 stood in for the portrait and two garment references —
above the 480px SD floor and the 1080px HD advisory, so all three cleared the client-side
size check with "Image size looks good."

| # | Check | Result |
| --- | --- | --- |
| 1 | App loads, intro renders | pass |
| 2 | Portrait and two garment references upload and validate | pass |
| 3 | Makeup direction selectable, Generate enabled only when inputs are complete | pass |
| 4 | Full generation completes, Results screen renders | pass — palette, both axes, provenance chip reading "Local demo preview · fixture images" |
| 5 | Session cache written after a completed generation | pass |
| 6 | **Delete during an in-flight generation** | pass — see below |
| 7 | Delete from the Results screen | pass — returned to Add inputs, palette gone, cache emptied |
| 8 | Console errors across the whole walkthrough | none |

### Item 6 in detail — the #5 acceptance

Generate was clicked, and the privacy bar's delete was confirmed 620ms into a generation
that takes roughly 2.4s of fixture delay, so the delete landed while both requests were
still in flight:

```
t=0    clicked Generate previews
t=500  stage: Current: Generate
t=620  DELETED mid-generation
t=6600 stage: Current: Add inputs
t=6600 results text on page: false
t=6600 sessionStorage cache: empty
t=6600 error banner: none
```

The generation completed on the wire after the delete and wrote nothing: no results
returned to the screen, no cache entry, and no error banner for work the shopper had
already discarded.

**Not covered.** The same scenario was not re-run against the pre-fix build to
demonstrate the failure — a second file upload was blocked partway through, and the
before-state is established by reading the old code rather than by observation.

**Known limitation, out of scope here.** The in-flight `fetch` is not aborted, only its
results are dropped. In fixture mode that is the whole problem. On the opt-in live paths
the already-started provider tasks still run and still cost their units after a delete.
Aborting them touches the request layer that #4 items 4, 6 and 9 cover.

---

## Second run — August 29, 2026, after the fixture-privacy and packaging work

Re-run after the commits that made fixture mode send no image bytes, made the
configuration fail closed, added the request limits, and put the front end and `/api` in
one process. **This is a historical run record; the third run below is current.** At the
time of this run, the captured fixtures were still queued, and the browser portion would
be re-run once they landed; that rerun is recorded in the third run.

| Check | Result |
| --- | --- |
| Tests | **163 passed**, 0 failed (74 shared, 89 server) |
| Typecheck | clean, all three workspaces |
| Build | succeeded, 186.56 kB JS / 58.44 kB gzipped |
| Contrast audit | 4 known gaps, no new failures |
| `npm audit` | 5 findings, all dev-only |
| `npm audit --omit=dev` | **0 vulnerabilities** — see below |
| Production install and start | **passed** — see below |
| Fail-closed configuration | **passed** — see below |
| Fixture mode sends no image bytes | **passed** — see below |
| #4 item 12 state sweeps | **passed**, one defect found and fixed |

### Dependency audit — the production tree is clean

`npm audit` still reports 5 findings, and all of them are Vite, Vitest, and Vite's nested
esbuild 0.21.5 — the dev toolchain, which no deployment installs.

`npm audit --omit=dev` reports **0 vulnerabilities**, which is the number that describes
what actually ships.

`tsx` moved from devDependencies to dependencies so a pruned install can still start the
server. It brings esbuild 0.28.2, which is above the advisory's `<=0.24.2` range, so it
does not carry the finding into production. `cors` was removed outright along with the
cross-origin setup it existed for.

### Production install and start

A clean tree built from `git archive HEAD`, with `web/dist` copied in:

```
npm ci --omit=dev     → 76 packages, 0 vulnerabilities
npm start             → listening, mode FIXTURE, body limit 32kb, serving web/dist
```

| Check | Result |
| --- | --- |
| `/api/health` | `{"mode":"fixture","liveSkinAnalysis":false,"liveTryOn":false,"hasApiKey":false}` |
| `GET /` | 200, the built app |
| Unknown page | 200, SPA fallback |
| Unknown `/api` path | 404, not the HTML shell |
| Fixture guard | 400, image bytes refused |

### Fail-closed configuration

Started with **every live flag set to live and no API key** — the worst-case
misconfiguration:

```
YINCOL_FIXTURE_MODE=false  YINCOL_LIVE_SKIN_ANALYSIS=true  YINCOL_LIVE_TRY_ON=true
```

```
[yincol] mode: FIXTURE (no network, no credits)
[yincol] a live path was requested but YINCOL_API_KEY is empty — staying on fixtures.
```

`/api/health` confirmed `liveSkinAnalysis: false`, `liveTryOn: false`. Covered for every
flag combination by `server/src/youcam/config.test.ts`.

### Fixture mode sends no image bytes

The claim the privacy bar makes, measured rather than asserted. Three real images
(1200×1600 portrait, two 1400×1200 garments, ~145 kB total) were uploaded through the
actual file inputs, then `window.fetch` was instrumented to record every outgoing body
before a full generation:

| Request | Body | Bytes |
| --- | --- | --- |
| `POST /api/analyze` | `{"portraitRef":"fixture:portrait"}` | 34 |
| `POST /api/skin-analysis` | `{}` | 2 |
| `POST /api/try-on` | `{"portraitRef":…,"garmentIds":[…],"makeupLookId":"peach-ember"}` | 118 |

**154 bytes for a whole generation, and no image field in any of them.** Before this
change the same generation sent the three images base64-encoded.

The privacy copy was checked in both directions. In fixture mode the intro reads "In this
browser tab only…" and the inputs screen "Your uploads stay in this tab." With the live
flags on — verified against a server holding a deliberately invalid key, so nothing could
be spent — both switch to saying the photograph is sent to the preview service.

### #4 item 12 — state sweeps

| State | How it was reached | Result |
| --- | --- | --- |
| Responsive, 375×812 | mobile viewport, both reachable screens | no horizontal overflow, 0 overflowing elements |
| Tap targets | measured every visible control | all ≥ 44px (45–141px) |
| Keyboard | 14 focusables, skip link focused | logical order; skip link expands 1px → 42px and becomes visible |
| Reduced motion | `styles/index.css` | global `prefers-reduced-motion` override; one animation in the app |
| Invalid upload | 320×240 JPEG | rejected, "only 240px on its shortest side", Generate stays disabled |
| Partial failure | `YINCOL_SIMULATE=partialFailure` | garment B "Not generated", garment A intact, palette unaffected |
| Complete-look failure | `YINCOL_SIMULATE=completeLookFailure` | renders, garment preview kept |
| No face | `YINCOL_SIMULATE=noFace` | replaces the screen, offers "Choose a different photograph" |
| Skin unavailable | `YINCOL_SIMULATE=skinUnavailable` | palette still shown, section omitted with a reason |
| Retry / error banner | generation limit tripped | plain banner, Dismiss available, no status code or internals leaked |
| Delete | privacy bar, on the results screen | confirm prompt, then results, palette and file inputs cleared; `sessionStorage` and `localStorage` both empty |

**One defect found and fixed.** The partial-failure notice lower-cased the panel title, so
it said "the garment b complete look preview" directly beneath a panel headed "Garment B
complete look". Fixed in `web/src/screens/ResultsScreen.tsx`; re-verified as "We could not
generate the Garment B complete look preview."

**Method note.** The browser pane could not deliver synthetic click events for part of this
run, so the flow was driven from the page with `fetch` + `DataTransfer` to populate the
real file inputs and dispatch real `change` events. That exercises the application's own
handlers; no application code was modified to make the run work. The uploaded test images
were served from `web/dist/testfixtures/`, which was deleted afterwards and is gitignored
in any case.

### Still not verified, as of the second run

- **Captured fixtures.** Every panel still renders a designed stand-in. No captured API
  result exists in the repository yet, so nothing here verifies a real YouCam output.
  *(Resolved in the third run — the captured fixtures landed in rewritten commit
  `7412d68`.)*
- **Reduced motion under emulation.** Confirmed by reading the stylesheet, not by
  emulating the preference in a browser.
- **Multi-instance rate limiting.** The limiter is per process; the approved shape is one
  process. Not exercised behind a load balancer.

---

## Third run — final, after the captured fixtures

**Run on:** August 29, 2026, against the captured-fixture tree, now represented by
rewritten commit `7412d68`, and the closeout commits on top of it. **This section is the
current verified state.**

| Check | Result |
| --- | --- |
| `npm test` | **172 passed**, 0 failed (74 shared, 98 server) |
| `npm run typecheck` | clean, all three workspaces |
| `npm run build` | succeeded, 186.56 kB JS / 58.44 kB gzipped |
| `npm run contrast-audit` | 4 known gaps, no new failures |
| `npm audit` | 5 findings, all dev-only |
| `npm audit --omit=dev` | **0 vulnerabilities** |
| Captured fixtures render | **passed** |
| Fixture mode still sends no image bytes | **passed**, 152 bytes per generation |
| Three defects found in the capture | **fixed** — below |

### What the capture cost

**18 units**, matching the estimate for a run that skips Facial Color Tone:

| Task | Units |
| --- | --- |
| Skin Analysis (5–8 concerns bracket) | 12 |
| Clothes VTO × 2, at 2 each | 4 |
| Makeup VTO × 2, at 1 each | 2 |
| Facial Color Tone — **skipped**, contract unverified | 0 |
| **Total** | **18** |

The earlier 38-unit figure assumed Facial Color Tone would be attempted. It was
deliberately not, so that 20 was never spent.

### What renders now

| Selection | Image | Caption |
| --- | --- | --- |
| Rose Veil, garment A | `complete-look-a-result.jpg` (1122×1402) | Garment and Rose Veil makeup |
| Rose Veil, garment B | `complete-look-b-result.jpg` (1122×1402) | Garment and Rose Veil makeup |
| Rose Veil, makeup axis | `garment-a-result.jpg` + complete look | Garment only, no makeup / Garment and Rose Veil makeup |
| **Any other look** | the designed placeholders | Designed stand-in |

The provenance chip reads "Local demo preview · fixture images" throughout.

### Three defects found in the capture, and fixed

1. **Presigned URLs committed.** `recordShape` wrote each task's full payload to
   `docs/captured-shapes/`, including the provider's download link — a presigned S3 URL
   with `X-Amz-Credential`, `X-Amz-Signature` and a two-hour expiry. Twelve across five
   files, eight of them skin-analysis masks derived from a face. Now redacted by
   `youcam/redact.ts`, on the committed files and on every future capture. The structure
   the records exist to document is untouched.
2. **The captured complete look stood in for every makeup look.** The lookup keyed on the
   garment alone, so choosing Peach Ember returned the Rose Veil images captioned "Garment
   and Peach Ember makeup". The look is now part of the lookup; other looks fall back to
   the stand-in, as `assets/README.md` always said they would.
3. **Alt text claimed the visitor was in the picture.** Every fixture panel read "You
   wearing the rosewater cardigan". Fixture mode never receives the visitor's photograph:
   a capture shows the demo portrait, and a placeholder shows no garment at all. Alt text
   is the whole description for a screen-reader user, so this was the one audience being
   told something the visible caption never said.

A fourth was found earlier and is worth listing with them: the capture commit broke
`fixtures/completeLook.test.ts`, which asserted "both resolve to placeholders, because no
capture has been run in this repository" — the environment rather than the invariant. It
now asserts the pairing that holds either way.

### Privacy, re-measured against the real fixtures

Three images uploaded and held in the tab, `window.fetch` instrumented:

| Request | Bytes |
| --- | --- |
| `POST /api/analyze` | 34 |
| `POST /api/skin-analysis` | 2 |
| `POST /api/try-on` | 116 |

**152 bytes, no image field.** The captured fixtures changed what comes back, not what
goes out.

### Still not verified

- **Facial Color Tone.** Deliberately skipped by the capture; its File API input contract
  is still unverified. The palette remains computed locally.
- **Reduced motion under emulation.** Confirmed by reading the stylesheet, not by
  emulating the preference in a browser.
- **Multi-instance rate limiting.** The limiter is per process; the approved shape is one
  process. Not exercised behind a load balancer.
- **The other six garments and four looks.** No capture exists for them by design, and
  they render designed stand-ins that say so.

---

## Not run

The production start and the item 12 sweeps were run in the second run above; the
captured-fixture rerun is recorded in the third run.

| Check | Why |
| --- | --- |
| Live-mode verification of any provider path | Out of scope for a fixture-only closeout, and would spend units |
