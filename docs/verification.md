# Verification record

**Run on:** August 29, 2026
**Commit:** `chore/closeout-deployment-readiness`, on top of `8efcc51`
**Machine:** Windows 11, Node 20+, npm workspaces from the repository root
**Issue:** #4 item 14 — run and record tests, typecheck, build, dependency audit, and
browser verification.

This file records what was run and what came back. Where a check could not be run, it
says so and why, rather than leaving the row out.

---

## Summary

| Check | Command | Result |
| --- | --- | --- |
| Tests | `npm test` | **131 passed**, 0 failed |
| Typecheck | `npm run typecheck` | **clean**, all three workspaces |
| Build | `npm run build` | **succeeded**, 56 modules, 21.4s |
| Contrast audit | `npm run contrast-audit --workspace @yincol/web` | **4 known gaps, no new failures** |
| Dependency audit | `npm audit` | **5 findings, all dev-toolchain** — see below |
| Browser | fixture-mode walkthrough, Chrome | **passed**, no console errors |

---

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

**What this does not cover.** `npm run build` builds the web bundle only. There is no
server build step — `@yincol/server`'s `start` script runs `tsx src/index.ts`, and `tsx`
is a devDependency, so the current start path needs the dev toolchain installed. Nothing
serves `dist/` either: the front end reaches `/api` through Vite's dev proxy, which does
not exist in a production run. So there is no production start path to verify yet. That
is issue #4 item 3, and it depends on the hosting shape decided in item 2.

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

## Not run

| Check | Why |
| --- | --- |
| Production start / deployed smoke test | No production start path exists yet — #4 item 3, blocked on item 2 |
| Responsive, keyboard, reduced-motion, retry, partial-failure, invalid-upload sweeps | #4 item 12, better run against the final deployed shape |
| Live-mode verification of any provider path | Out of scope for a fixture-only closeout, and would spend units |
