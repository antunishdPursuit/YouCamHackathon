# PR #15 follow-up — September 29, 2026

## Implemented / 已实现

- Split-origin CORS permits Content-Type and X-Yincol-Browser-Id. Request limits run before JSON parsing.
- PR #13's single-object motion records reopen and download correctly. Video attachments read and update in one IndexedDB transaction, preserving concurrent attachments. Source photographs remain excluded.
- Reopened browser image blobs become JPEG/PNG bytes for video requests. Fresh-result videos wait for the image save and attach to its stable media ID. Superseded work cannot update a cleared session. Current clips remain downloadable if saving fails.
- Demo opens a preselected input screen before saved results, without API health or generation requests. Private original sample inputs are not published; illustrations and missing captures are explicitly labelled.
- Full-body requests generate shared trousers, two tops with makeup, and portrait-only makeup, without redundant close-up outfit tasks. Existing close-up-only inputs remain supported. The full-body comparison displays only its two outfits.
- Try-on, skin analysis and video reserve units before provider work. Unverified colour analysis fails closed. Upload, task, download and KV calls have bounded waits; paid task submissions are not automatically retried.
- One persistent ledger stores charges and duplicate hashes. A Lua compare-and-set atomically commits both caps and the duplicate marker. Site days start at UTC midnight; browser charges use a real trailing 24-hour window. Missing state starts a conservative 24-hour pause, including first provisioning. An API restart retains the ledger. Ambiguous outcomes are never refunded and duplicate hashes do not expire. At 20,000 hashes the service pauses for owner maintenance rather than silently forgetting submissions. Use **noeviction** on the Key Value instance.
- `/api/budget` exposes remaining site/browser allowances. The live input flow displays them. These are reservations for this site, not the provider account balance.

中文：已修复跨域、旧历史格式、历史图片视频输入、新视频保存、并发保存及删除保护。演示先显示预选输入再打开结果，完全不依赖后端；缺失的原始素材保留明确占位。全身流程只生成两套含相同裤装与妆容的造型，以及一张纯妆容肖像。付费接口先预留额度，未验证的肤色接口拒绝调用；额度使用原子更新、真正滚动 24 小时窗口、计数丢失后 24 小时暂停、不自动退款和不自动重试。历史去重摘要达到 20,000 条时暂停，交由负责人维护，不自动清除后重新收费。

## Provider contract / 接口契约

Checked against official documentation without any provider call:

- Video V2 task: `/s2s/v2.0/task/image-to-video/youcam`; input `src_file_id` (or URL), `dst_duration: 5`, `resolution: "720"`. Poll the same task path plus task ID. Download the result URL immediately.
- Upload: generic `/s2s/v2.0/file`, then upload bytes with the returned request method/headers/URL.
- Video: 2 units per second at 720p, therefore 10 for five seconds. Makeup: 1 unit. Full-body outfits plus portrait makeup: 9; legacy close-up outfits plus portrait makeup: 7. Optional standalone skin analysis reserves 12 separately.

The published video result schema contains incomplete `results` definitions. The existing adapter tolerates documented URL forms, but actual provider output and successful paid execution remain **unverified**. `TASK_PATH_VERIFIED.video` remains false; health and the route explicitly disable live video before reservation or upload. Changing an environment flag alone cannot bypass that gate.

中文：已查官方文档并修正视频路径及参数，未调用付费接口。官方结果 schema 存在不完整定义，真实响应与付费执行仍需负责人验收。实时视频保持代码级关闭，不能仅靠环境变量开启。妆容为 1 单位，全身三图为 9 单位，近景兼容流程为 7 单位，五秒 720p 视频为 10 单位。

Sources: [Video OpenAPI](https://docs.perfectcorp.com/_bundle/reference/ai_video_generator.json?download=), [File OpenAPI](https://docs.perfectcorp.com/_bundle/reference/file.json?download=), [Makeup](https://docs.perfectcorp.com/reference/makeup_vto/section/overview), [Render Key Value](https://render.com/docs/key-value), [Valkey EVAL](https://valkey.io/commands/eval/).

## Verification / 验证

- Local: 319 automated tests pass; all workspace typechecks, production build and contrast audit pass (four existing documented contrast gaps).
- Dedicated Edge profile: demo inputs/results, both comparison tabs, 390px layout without horizontal overflow, automatic save, reload/reopen, six media downloads, PR #13 motion-object migration, concurrent video attachment, blob-to-data conversion and deletion protection passed.
- Fresh UI flow used synthetic input files and a stubbed video response: Generate images → Generate video → reload → reopen retained the clip; exactly one video submission. No provider calls or credits.
- Actual browser preflight and POST from port 5174 to a fixture API on port 8789 succeeded with the browser-ID header.
- Added GitHub Actions checks with Valkey 8 and a namespaced real-store integration test. Locally that test is skipped when `YINCOL_TEST_KV_URL` is absent. A green CI run is separate evidence; the real Render instance remains unverified.

中文：本地 319 项测试、类型检查、构建及对比度检查通过。独立 Edge 浏览器验证了演示、对比、手机布局、历史重开/下载、旧数据兼容、并发视频保存、图片字节转换、删除保护和完整新视频保存流程；实际跨域请求也通过。视频使用模拟响应，未花额度。新增 Valkey 8 CI 集成测试，本地无测试 KV 地址时跳过；CI 和真实 Render 验证必须分别记录。

## Remaining acceptance / 剩余验收

1. Verify CI and the actual Render Key Value connection, EVAL permissions, noeviction policy, recovery pause and auto-deploy configuration.
2. Owner supplies/approves missing original sample inputs and captured portrait-makeup/full-body assets. The demo currently uses labelled stand-ins where these are missing.
3. Owner-controlled video response verification and the specifically approved captures; do not enable anonymous paid video before acceptance.
4. Final deployment and mobile/keyboard/storage-failure acceptance on the deployed origin. This pass exercised mobile layout and storage deletion/concurrency, not every failure injection or native file-picker dialog.
5. Keep #12 open. #13 is included in this branch; preserve its ancestry. No merge or deployment approval is implied by these checks.

中文：还需验证 CI、真实 Render 的连接/脚本权限/内存策略/恢复暂停及自动部署设置，补齐获批准的素材与视频验收，并在部署地址完成最终交互和故障检查。#12 保持开启；本次代码检查不等于批准合并或部署。
