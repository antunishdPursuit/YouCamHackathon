# Deployment and release acceptance

**October 22, 2026 closeout decision:** This project is finished as a local
saved demo. The source-only branch is published for review; the app has not
been deployed and no separate backup was made. No new server deployment, paid
provider call, or
public live-feature release is planned. The October 11 release plan below is
retained as historical context. Its live-route and exact Champagne Halo Outfit A
video criteria are deferred by the local-only scope. The existing public fixture
site is a separate older release and does not contain the October 2 local candidate. Local
verification is recorded in [verification.md](verification.md).

Historical remote review: October 11, 2026. GitHub `main` is at merged commit
`47e8e97`; issue #12 is open and there is no open pull request. The October 2
ivory-blazer complete-look still and video are in a newer local candidate, not
in this deployed release. The fixture release and the September 30 real KV
initialization/API-restart check are verified. Current live budget readiness,
the exact Champagne Halo Outfit A video criterion, and final live acceptance
remain open.

On October 11, public GETs to [API health](https://yincol-api.onrender.com/api/health)
and [budget](https://yincol-api.onrender.com/api/budget) returned HTTP 200.
Health reported fixture mode, all live flags false, no API key, and the video
task gate false. The budget request sent no browser ID and returned
`available:false`, `siteRemaining:0`, and `browserRemaining:0`. This confirms
the shared site allowance was unavailable for that request; it does not identify
the ledger cause or establish an identified browser's allowance. The public
[site](https://yincol.onrender.com/) returned HTTP 200. Render dashboard commit,
runtime, auto-deploy, and current KV health were not rechecked in this review.

中文：#15 至 #17 已合并，GitHub `main` 为 `47e8e97`。演示版和 9 月 30 日的
KV 初始化及 API 重启检查已有记录；10 月 11 日公开额度查询仍显示不可用。10 月 2 日
新增的象牙色西装全身视频仅在本地候选版，尚未部署；它不同于原定的 Champagne Halo
A 套装视频。#12 保持开启，最终实时验收仍未完成。

## Current behavior and evidence

- Start -> Try the demo -> sample inputs -> Generate opens saved comparisons
  without an API wake-up or provider request. Missing captures remain labelled.
- Previous looks reopens completed media from this browser without the API.
  Source uploads stay in memory; completed media is saved in IndexedDB on the
  same browser profile and origin. Entering live inputs starts readiness checks.
- Live try-on, skin analysis and video use server-side reservations. The site
  cap is 100 units per UTC calendar day; the browser cap is 40 over the trailing
  24 hours. Browser identity is an approximate allowance, not authentication.
- A separate Key Value ledger commits both caps and duplicate markers atomically.
  Unknown provider outcomes remain charged; submissions are not automatically
  retried. Missing state starts a 24-hour pause, including initial provisioning.
- Live video remains code-gated by `TASK_PATH_VERIFIED.video=false`. Setting an
  environment flag cannot bypass it. The existing captured sample still plays.
- CI verifies real Valkey concurrency/recovery behavior. This does not establish
  the actual Render connection, memory policy, deployment, or paid route behavior.

中文：演示和历史重开不依赖 API；只有进入照片输入才检查后端。额度按 UTC 日和
真实滚动 24 小时计算，计数缺失后暂停 24 小时，不自动重试或退款。实时视频仍由
代码关闭。CI 的 Valkey 验证不能替代真实 Render 与付费接口验收。

## Historical ownership and release order (deferred)

Historical September 30 deployment check: both existing services track `main`, have
auto-deploy **Off**, and run `47e8e97` on Node **24.16.0** after the approved
fixture deployment. The free Ohio Key Value service is available with
`noeviction`, no disk persistence and external access blocked. API ledger
initialization exercised GET/EVAL/SET; recovery timestamp `1790896937619`
survived a Render-confirmed API restart. No paid reservation was made.
Fixture mode remains true, all live flags false, and no provider key is configured.
Natural recovery ends **October 1, 2026, 23:22:17 UTC / 7:22:17 p.m. EDT**.
The recorded pause deadline has passed. The October 11 budget response above
is still unavailable; inspect the current KV connection and ledger state before
any live trial. Never clear or shorten a recovery pause to make acceptance pass.

中文：9 月 30 日的部署检查显示自动部署关闭，真实 KV 初始化及 API 重启后的状态
保留已验证，但没有付费预留。原定暂停期限已过；10 月 11 日公开查询仍显示额度不可用。
必须检查当前 KV 与额度状态，不能清空账本或跳过恢复期。

Dennis controls the existing Render/YouCam accounts, secrets, approved captures
and release. Sean can prepare code without account access. Keep the existing
free hosting scope; do not add accounts or paid services.

1. Review and commit the newer local candidate, then open a pull request and
   obtain CI review before any approved fixture deployment. Recheck both
   services' branch, commit, runtime, and auto-deploy settings first.
2. Verify the deployed fixture release at the chosen commit with live flags off
   and no key. Check demo media, save/reopen, downloads, keyboard and phone layout.
3. For a separate live trial, diagnose the October 11 unavailable budget state
   in Render/KV without resetting the ledger. Confirm current site and identified
   browser allowances, then perform only the specifically approved paid checks.
4. Keep browser live video disabled until the budgeted upload/task/download
   route and saved-video reuse pass acceptance and the owner approves release.
   The October 2 bounded provider capture does not verify that browser route.
5. Record deployed-origin results and the owner release decision. Close or
   rescope #12 only when its remaining acceptance items are resolved.

中文：先核对分支、提交、运行时及自动部署，再审查新候选版、提交、通过 CI 并部署
获批的演示版。实时试用需先查明当前额度不可用的原因；不得清空账本。10 月 2 日的
供应商视频捕获不等于浏览器付费路线验收。#12 须完成或明确缩小范围后才能关闭。

## Fixture-only Render configuration

Use one Static Site and one Free Web Service in the existing workspace. The
server can also serve the built frontend for local previews.

| Setting | Static Site | API Web Service |
| --- | --- | --- |
| Root directory | Repository root | Repository root |
| Build command | `npm ci && npm run build` | `npm ci --omit=dev` |
| Publish directory | `web/dist` | Not applicable |
| Start command | Not applicable | `npm start` |
| Health check | Not applicable | `/api/health` |

Set `VITE_API_URL` at static-site build time to the API origin, without `/api`
or a trailing slash. Set `YINCOL_ALLOWED_ORIGIN` on the API to the exact static
site origin. Do not use a wildcard. Render supplies `PORT`.

API environment for a fixture release:

```text
YINCOL_FIXTURE_MODE=true
YINCOL_LIVE_SKIN_ANALYSIS=false
YINCOL_LIVE_TRY_ON=false
YINCOL_LIVE_VIDEO=false
YINCOL_TRUST_PROXY=true
YINCOL_ALLOWED_ORIGIN=https://<static-site>.onrender.com
```

Replace `<static-site>` with the actual service name. Leave `YINCOL_API_KEY`
unset. Keep credentials off the Static Site and out of all `VITE_` variables.
Keep `.env`, source images and private results out of Git.

## Key Value acceptance before live work

Use the separate free Render Key Value service in the existing workspace, in
an appropriate region for the API. Store its connection privately as
`YINCOL_KV_URL` on the API. Configure:

```text
YINCOL_SITE_DAILY_UNIT_CAP=100
YINCOL_BROWSER_WINDOW_UNIT_CAP=40
```

Free Key Value does not provide disk-backed persistence. Its separate process
can preserve counters through an API restart, but a Key Value restart can lose
them. The 24-hour recovery pause is required for that free-tier limitation;
`noeviction` prevents memory-pressure eviction, not restart data loss.

Verify and record:

- The API can connect and execute `GET` and atomic `EVAL`/`SET` operations.
- The service's eviction policy is `noeviction`; memory exhaustion must fail
  closed instead of dropping spending records.
- API restarts retain reservations. Store loss/unavailability blocks new work;
  an empty store starts a 24-hour pause. Never clear the production ledger or
  edit its recovery time to make acceptance pass.
- `/api/budget` shows the expected site/browser availability and recovery state.
- Concurrent requests, duplicate clicks and ambiguous failures cannot bypass
  reservations. Duplicate hashes do not expire; at 20,000 hashes the ledger
  pauses for owner maintenance.

The CI integration test uses unique `yincol:test:<random>:` keys. For a local
store test, supply a dedicated `YINCOL_TEST_KV_URL` and run the server tests.
Never use the production ledger as disposable test data. Free-store durability
and the observed Render policy must be recorded separately from CI evidence.

中文：核对连接、EVAL 权限和 noeviction；API 重启不能清空额度。计数丢失或不可用时
必须停止付费工作。不能删除生产记录或跳过恢复等待来通过测试；测试使用独立命名空间。

## Captures and provider boundary

The earlier 11-unit allowance covered the specifically approved
original-portrait makeup sample and one Champagne Halo Outfit A five-second
720p video. The owner-run makeup capture used one unit on September 30 EDT.
The former “at most 10 remain” figure is not a current provider balance or
authorization for another call, especially after the separate October 2
full-body capture. Neither capture exercised the production budget route.
This allowance did not cover general testing, retries, or additional full-body
work.
Confirm the exact input, existing capture evidence, current rate and remaining
allowance before submission. Download successful bytes immediately.

The September 20 saved video has a recorded `data.results.url` response in
`docs/captured-shapes/garment-a-motion-sample.json`. It used `src_file_url`.
The current live route uses the generic File API and `src_file_id`; that full
budgeted path still needs acceptance. The separate October 2 ivory-blazer,
taupe-trousers and Peach Ember full-body capture used `src_file_id` and returned
a genuine V2 video; see [capture evidence](captured-shapes/ivory-blazer-complete-look-peach-ember-20261002.json).
Its 15-unit chain is an estimate; actual billed units were not separately
verified. It is a distinct demo example and does not satisfy the specified
Champagne Halo Outfit A video criterion. Do not claim either bounded capture
verifies the budgeted browser route.

Dennis approved the exact public demo portrait, both garment reference photos,
both existing Champagne Halo full-body final results, and matching makeup/video
captures on September 30. The approved inputs and existing results are copied
byte-for-byte into the local candidate; the matching makeup result is now captured.
See [asset hashes and boundaries](../assets/README.md#approved-champagne-halo-demo-assets--september-30-2026).
Other source images and private results stay private. The matching video
remains unavailable until genuinely captured. Public-use approval does not
establish that a capture succeeded or that a release is verified.

## Deployed-origin checks

Record the URLs, deployed frontend/API commits, flags and observation date.
Do not record secrets. Check:

1. Health reports fixture mode, all live features false and `hasApiKey: false`
   for the fixture release. Exact-origin CORS and the `X-Yincol-Browser-Id`
   preflight work; an unrelated origin is rejected.
2. Demo works while the API is asleep or unavailable and spends no credits.
   Live inputs show a clear waking state and usable failure recovery.
3. Save -> reload -> Previous looks -> reopen -> edit inputs -> generate works.
   Downloads, individual deletion and clear-all affect only the intended data.
4. Storage unavailable/full, pending-save deletion and partial result failures
   keep useful results visible and offer truthful recovery/download actions.
5. Phone layout, keyboard focus/tab controls and reduced-motion behavior work.
   Check actual controls; the token contrast audit is not a full WCAG audit.
6. Only after owner acceptance: exercise the specified paid path with the exact
   approved assets and unit ceiling, then verify saved-video reuse without a
   second submission. Record observed billing separately from estimated cost.

## Disable and rollback

To stop paid work, remove the API key and set fixture mode true and all three
live flags false; restart the API and verify health. Merely clearing one live
flag is insufficient if `YINCOL_FIXTURE_MODE=false` and a key is still present.
Keep saved demo/history usable where possible.

Rollback frontend and API to a compatible, previously approved pair. Do not
roll back to code that assumes the old motion-record shape without checking
saved-history compatibility. Preserve the budget ledger and private connection
settings; never reset allowances as part of a rollback. Download important
browser results before changing origin or clearing site data.

中文：停用付费时移除密钥、开启演示模式并关闭全部实时标志，再核对健康状态。
回滚必须考虑历史数据格式，保留额度记录，不能通过清空计数恢复额度。

References: [Render free services](https://render.com/docs/free),
[Key Value](https://render.com/docs/key-value),
[auto-deploys](https://render.com/docs/deploys),
[recorded implementation and checks](pr15-followup.md).
