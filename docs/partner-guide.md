# Partner guide / 合作开发指南

**October 22, 2026 scope decision:** YINCOL closes as a locally verified saved
demo. The source branch is published for review, with no new Render deployment
or paid live generation planned. The earlier
release and ownership notes below document the former path; they are not a
current request to complete live video or capture Champagne Halo Outfit A.
See [local verification](verification.md).

**2026 年 10 月 22 日范围决定：**YINCOL 以本地验证的已保存演示版收尾。不再计划新的
Render 部署或付费实时生成。下方旧发布说明仅保留为历史记录。

Historical review from October 11, 2026: PRs #15–#17 were merged, including #13; GitHub `main` was `47e8e97`, while the newer demo candidate was local and uncommitted. The September 30 Render check recorded both services at that commit, auto-deploy off, Node 24.16.0, and real KV initialization/API-restart survival. The public site and health endpoint responded in safe fixture mode, but an October 11 budget request without a browser ID returned unavailable with zero shared-site units. The cause and current dashboard/KV state need checking before a live trial. #12 remained open at that review. See the [deployment checklist](deployment.md) and [verification record](verification.md).

中文：#15 至 #17 已合并，GitHub `main` 为 `47e8e97`；新版演示仍是本地未提交的候选版。9 月 30 日已验证 KV 初始化和 API 重启后状态保留。10 月 11 日公开网站及健康检查正常且保持安全演示模式，但未提供浏览器 ID 的额度查询显示全站额度不可用。实时试用前须检查当前 KV 状态；#12 仍开放。

## Current handoff / 当前交接

PR #13's browser history is preserved inside PR #15. Do not rebuild it. Follow-up fixes cover old history migration, cross-origin requests, fresh and reopened image video storage, atomic budget reservations, rolling allowances and lost-state recovery. Demo now visits preselected inputs before saved results without API calls. Missing original sources/captures remain explicitly labelled illustrations or unavailable.

保留 #13 的浏览器历史实现，不重复开发。#15 后续修复包含旧数据兼容、跨域、新旧图片的视频保存、原子额度预留、滚动限额和计数丢失恢复。演示先展示预选输入再进入结果，不调用 API；缺失素材明确标注。

The local candidate uses the explicitly approved portrait, both garment reference photos, two genuine Champagne Halo full-body results and the captured matching portrait makeup. Results open on Compare makeup, followed by Compare outfits. A separate Rose Veil video example appears below makeup with its exact source image. Compare outfits also includes a separately labelled October 2 ivory-blazer, taupe-trousers and Peach Ember full-body still and video. Both examples save, reopen and download with the demo. The originally specified Champagne Halo Outfit A video remains pending; the ivory-blazer example does not replace it. Live visitor video remains code-gated, and the live UI does not yet route outerwear through Clothes V4. Private source uploads are never saved in history; the exact approved public demo portrait is the only source exception. Media stays in the same browser profile and origin. Download a backup before clearing browser data.

本地候选版包含获批肖像、两张服装参考、两张 Champagne Halo 全身结果及相配肖像妆容。结果先显示妆容，再显示服装。妆容下方保留 Rose Veil 原视频及准确输入图；服装下方另列 10 月 2 日捕获的象牙色西装、灰褐色长裤与 Peach Ember 全身视频。两例均可保存、重开及下载。后者不能代替原定的 Champagne Halo A 套装视频。访客实时视频仍关闭，实时界面尚未将西装接入 Clothes V4。私有上传不进入历史，只有获批公开的演示肖像例外。历史限于同一浏览器及地址，清理前请下载备份。

## Local checks / 本地检查

Use the fixture-only commands in [README](../README.md). Run npm test, npm run typecheck, npm run build and npm run contrast-audit --workspace @yincol/web. CI also runs a namespaced Valkey integration test; local execution requires a dedicated YINCOL_TEST_KV_URL. Never point testing at a provider API or use a production budget key for test setup.

按 README 使用演示模式运行。常规测试不花额度。Valkey 集成测试使用独立随机命名空间，本地需专用测试地址；不能把生产额度记录作为测试数据修改。

## Ownership and finish / 分工与收尾

Sean can implement and submit code through GitHub. Dennis controls existing Render/YouCam configuration, secrets, paid captures and release. Keep hosting free, without new accounts/platforms or visitor login. Confirm auto-deploy behavior before merging. Keep #12 open until all acceptance criteria pass; a green local test is not deployed or paid-provider evidence.

Sean 通过 GitHub 开发提交；Dennis 管理现有 Render/YouCam 配置、密钥、付费素材与发布。保持免费托管，不新增平台或访客账号。合并前确认自动部署；#12 在全部验收前保持开启。本地通过不代表已部署或付费接口已验收。

The earlier owner-controlled allowance covered one portrait makeup task and at most one specified Champagne Halo Outfit A video. A separate October 2 play test captured a 15-unit estimated trousers/blazer/makeup/video chain; actual billed units were not separately verified. Do not treat the old “10 units remain” note as a current provider balance or as authorization for another paid call. See [remaining acceptance](pr15-followup.md#remaining-acceptance--剩余验收) and the [deployment runbook](deployment.md).

原有 11 单位额度仅对应当时指定的肖像妆容及 Champagne Halo A 套装视频。10 月 2 日另有预计 15 单位的全身捕获链，实际扣费未单独核实。旧文中的“尚余 10 单位”不是当前余额，也不授权新的付费调用。
