# Verification record

## Saved browser history — locally verified

This increment follows merged PR #11. It does not include a Render release,
new paid generation, daily usage budgets or a live video endpoint.

本阶段基于已合并的 #11，实现浏览器历史保存；未部署 Render、未进行新的付费生成，
也未实现每日额度或实时视频接口。

- 267 tests passed: 72 shared, 147 server, 48 web. All three workspace typechecks
  passed; production build passed (JS 217.58 kB / 68.18 kB gzip).
- A real Chrome persistent profile exercised the app against an isolated
  fixture-only API with no key and both live flags disabled. The profile was
  closed and reopened to verify IndexedDB retention, rather than only reloading
  a page. Existing public fixture files supplied the test uploads and results.
- Thirteen browser checks passed: empty history/input flow, automatic saving,
  image links/video-byte download, matching video playback, start-over retention,
  browser-restart reopening with the API unavailable, phone/keyboard use, exact
  reuploaded-input reuse, individual deletion/cancel/reload, storage-quota
  recovery, confirmed all-history deletion/stale writes, deletion during media
  saving, and unavailable-storage protection before generation.
- Reopening, matching reuse and save retries added zero generation POSTs.
  Three intentional fixture runs made nine local generation POSTs in total,
  with zero provider calls. There were no uncaught app errors on the final run.
- Desktop 1440 px and phone 390 px screenshots used the existing theme. Images
  remained uncropped, the saved video played from a Blob after reopening, and
  the tested phone layout had no horizontal overflow. No design tokens changed.
- Unit checks cover byte-based matching, source-portrait exclusion from both
  history and the session cache, partial/full-body result preservation, media
  provenance, object-URL cleanup, and reopening without source files or consent
  being manufactured.
- Source uploads are not persisted. History uses output Blobs and settings,
  scoped to one browser profile and site address. A deletion revision prevents
  pending writes in other tabs from restoring deleted media. Already-open
  results in another tab can remain in that tab's memory until closed/cleared.
- Natural browser eviction and every private-browser implementation were not
  tested. Storage-full and unavailable-storage states were injected. Current
  downloads remain available when saving fails; clearing storage is not a backup.
- No dependencies or server routes changed. Full-body provider generation,
  live provider costs, Render deployment and new video generation were not tested.

The saved-history work is implemented. Remaining application work is the separate
demo/live entry, original-portrait makeup comparison, per-result live video and
server budget/failure controls in the partner guide.

自动保存、重新打开、下载和删除已完成本地验证。剩余工作包括演示与实时入口分离、
原始肖像妆容对比、每个结果的实时视频，以及服务端额度和故障保护。
The dated cleanup and older records below describe their original snapshots.

## September 21, 2026 cleanup verification

This section records the cleanup increment separately from the historical runs
below. A local pass is not a Render deployment check or a new provider test.

本节记录本次清理的验证结果，与下方历史记录分开。本地通过不代表 Render 已部署，
也不代表重新验证了付费接口。合作开发说明见[中英双语指南](partner-guide.md)。

| Check | Current evidence |
| --- | --- |
| Baseline before cleanup | 268 tests passed; typecheck and build passed before cleanup. |
| Final tests, typecheck and build | **259 tests passed** (72 shared, 147 server, 40 web); all three typechecks and production build passed. JS 204.05 kB / 63.78 kB gzip. |
| Final contrast and browser checks | Contrast: four documented token gaps, no new failures. Chrome walkthrough passed at desktop and 390 px; details below. |
| Dependency audit | `npm audit --json`: **0 known vulnerabilities** after owner approval for the package metadata query. Historical counts below are not current. |
| Paid provider generation | Not run during cleanup. |
| Render deployment | Not performed during cleanup; main and the deployed release are separate from the cleanup branch. |
| GitHub CI | No GitHub Actions workflow currently exists in this repository. |

### Cleanup scope and browser evidence

- Preserved the current full-body input and result flow, captured website demo,
  saved motion sample, and fixture-safe defaults.
- Fixed repeated-makeup cache invalidation, stale image decode callbacks, and
  missing full-body labels in the Start summary. Removed unused adapters, UI
  exports and animations. Consolidated duplicate tests instead of dropping
  failure-path coverage; the suite is nine tests smaller than the baseline.
- Malformed image base64 is rejected before provider work; provider response
  bodies are omitted from logs. Environment variants and private captures stay
  ignored. Removed the two obsolete proposal documents with owner approval.
- A temporary source-based harness prefilled synthetic input objects and served
  the existing public fixture images. Its separate API had no key and both live
  flags false. It exercised the real app, reducer, client and fixture routes.
- Verified Start -> Add inputs -> Generate -> Results; return navigation; both
  comparison tabs; arrow-key focus; matching saved video playback (5.0625 s);
  retained choices after re-selecting the same makeup; and confirmed removal,
  which cleared inputs and disabled Generate. Images loaded, the 390 px layout
  stacked correctly with no horizontal overflow, and there were no app warnings
  or errors (unrelated browser-extension warnings were excluded).
- Native file-picker interaction, new paid generation, and full-body provider
  execution were not repeated. Decode races, full-body rendering, validation and
  partial failures are covered by the local automated tests.
- The retired port 8788 design preview and temporary browser-check processes
  were removed. The saved website demo assets remain.

### Remaining release work

The [partner guide](partner-guide.md) describes the next increment: original-
portrait makeup comparison, automatic IndexedDB history, live video, and server
unit reservations in separate Render Key Value. Public live rollout also needs
request guards before large-body parsing, bounded provider network timeouts,
and duplicate-submission protection. None of those safeguards is claimed here.
No GitHub CI or target-environment deployment was verified during this cleanup.

## Historical verification — August 29, 2026

The sections below are retained evidence for older trees. Their counts,
dependency findings, bundles and browser observations are not the current
release status. References to "current" within a dated run mean that run's tree.

**Record updated:** August 29, 2026
**Final verification tree:** captured-fixture tree represented by `7412d68`, later
merged into `main` by PR #5. The capture commit was subsequently rewritten to remove
historical presigned URLs; its file content and the results below were unchanged.
**Machine:** Windows 11, Node 20+, npm workspaces from the repository root
**Issue:** #4 item 14 — run and record tests, typecheck, build, dependency audit, and
browser verification.

This file records what was run and what came back. Where a check could not be run, it
says so and why, rather than leaving the row out.

**Four historical runs are recorded, oldest first.** The third followed captured
fixtures; the fourth followed split-deployment hardening. They preserve when each
property was established. Use the dated cleanup section above for current checks.

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
that historical capture's final values are in the third run.

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
production dependency set is `react` and `react-dom` in `web/`, and `dotenv`, `express`
and `tsx` in `server/`; none of them appear in the audit. Every advisory describes a
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
one process. **This is a historical run record; the third run below superseded it for that tree.** At the
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
does not carry the finding into production. The `cors` package was removed; the later
split-deployment hardening uses a small exact-origin middleware without that dependency.

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
- **Multi-instance rate limiting.** The limiter is per process; the approved API shape is
  one free instance. Not exercised behind a load balancer.

---

## Third run — final, after the captured fixtures

**Run on:** August 29, 2026, against the captured-fixture tree, now represented by
rewritten commit `7412d68`, and the closeout commits on top of it. **This section is the
verified state at that time.**

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
- **Multi-instance rate limiting.** The limiter is per process; the approved API shape is
  one free instance. Not exercised behind a load balancer.
- **The other six garments and four looks.** No capture exists for them by design, and
  they render designed stand-ins that say so.

---

## Fourth run — free split-deployment hardening

**Run on:** August 29, 2026, on branch `feature/free-render-split-deployment`. This run
verified the local implementation for the approved free Render Static Site plus Free Web
Service shape. No remote state was changed and no deployment was made.

| Check | Result |
| --- | --- |
| `npm test` | **176 passed**, 0 failed (74 shared, 102 server) |
| `npm run typecheck` | clean, all three workspaces |
| `npm run build` | succeeded |
| `npm run contrast-audit --workspace @yincol/web` | 4 known gaps, no new failures |
| Fixture-only API health | passed; no API key, live flags false |
| Exact-origin CORS | passed; matching origin allowed, different origin rejected with 403 |
| CORS preflight | passed; matching `OPTIONS` request returned 204 |
| Separate static preview | passed; static build reached the API through `VITE_API_URL` |
| Readiness gate | passed; Generate stayed disabled until API readiness and inputs were complete |
| Browser console | no warnings or errors |

The runtime checks used an empty API key and explicit fixture flags. The test build's
`VITE_API_URL` pointed only to `localhost` and was not committed.

### What changed

- `VITE_API_URL` now selects the API origin while retaining the local Vite proxy default.
- `YINCOL_ALLOWED_ORIGIN` provides exact-origin, credential-free CORS without a new package.
- The browser checks `/api/health` on entry, retries bounded wake-up attempts, and keeps
  Generate disabled until the API is ready.
- The Render runbook now defines the two free services, environment variables, cold-start
  behavior, CORS checks, and rollback procedure.

---

## Not run

The production start and the item 12 sweeps were run in the second run above; the
captured-fixture rerun is recorded in the third run; split-deployment hardening is recorded
in the fourth run.

| Check | Why |
| --- | --- |
| Live-mode verification of any provider path | Out of scope for a fixture-only closeout, and would spend units |
