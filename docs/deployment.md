# Deployment and release acceptance

Updated September 30, 2026. PR #15 is merged and includes #13's saved-history
work. Code acceptance is complete for that increment; the actual Render and
budgeted live-provider release checks below remain open under #12.

中文：#15 已合并，包含 #13 的历史功能。代码验收不等于发布验收；真实 Render、
受额度保护的付费流程及部署交互检查仍属于 #12，未完成前保持开启。

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

## Ownership and order

Dennis controls the existing Render/YouCam accounts, secrets, approved captures
and release. Sean can prepare code without account access. Keep the existing
free hosting scope; do not add accounts or paid services.

1. Inspect both services' connected branch, deployed commit, runtime and
   auto-deploy settings before merging. Record whether a merge would deploy.
2. Merge the approved Node metadata update (#16) after that check. Use a
   supported runtime on both services: Node 22.22.2+ within 22.x, 24.15.0+
   within 24.x, or 26.0.0+. CI exercises 22.22.2.
3. Verify the fixture release at the chosen commit with live flags off and no key.
4. Configure and verify the dedicated free Key Value service before any live
   trial. Allow the initial 24-hour pause to expire naturally.
5. Complete the exact approved provider captures and acceptance. Keep video
   disabled until the current upload/task/download route is verified and its
   release is approved. Historical sample evidence alone does not verify it.
6. Record the deployed-origin results and owner release decision, then close #12
   only when the remaining acceptance items are satisfied.

中文：先核对分支、提交、运行时及自动部署，再合并。先验收无密钥的演示版；
配置独立免费 Key Value 并等待首次 24 小时暂停结束后，才进行明确批准的付费验证。
不得将旧素材记录当作当前完整路由的验证；全部验收后才能关闭 #12。

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

The existing allowance is at most 11 units for the specifically approved
original-portrait makeup sample and one Outfit A five-second 720p video. It
is not an allowance for general testing, retries or additional full-body work.
Confirm the exact input, existing capture evidence, current rate and remaining
allowance before submission. Download successful bytes immediately.

The September 20 saved video has a recorded `data.results.url` response in
`docs/captured-shapes/garment-a-motion-sample.json`. It used `src_file_url`.
The current live route uses the generic File API and `src_file_id`; that full
budgeted path still needs acceptance. Do not discard historical evidence or
claim it verifies an untested route.

Original source images and private full-body results remain private unless
Dennis explicitly approves their intended use. Do not copy them into public
fixtures to remove an unavailable label. Keep placeholders labelled until the
required genuine, approved bytes exist.

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
