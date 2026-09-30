# Partner guide / 合作开发指南

Updated September 30, 2026. PR #15 is merged; #13 was closed because its commits are included. #16 is merged after confirming both Render services have auto-deploy off and Node 24.16.0 configured. Free Key Value is provisioned; its API connection is saved for the next deployment but not yet exercised. #12 remains open for release acceptance. See the [current deployment checklist](deployment.md) and [PR #15 evidence](pr15-followup.md).

中文：#15 已合并，包含 #13 的提交；#13 已关闭。已核对两个 Render 服务的自动部署关闭、Node 配置为 24.16.0，并合并 #16。免费 KV 已创建，连接配置已保存，实际连接仍待部署验证。#12 保留发布验收事项。

## Current handoff / 当前交接

PR #13's browser history is preserved inside PR #15. Do not rebuild it. Follow-up fixes cover old history migration, cross-origin requests, fresh and reopened image video storage, atomic budget reservations, rolling allowances and lost-state recovery. Demo now visits preselected inputs before saved results without API calls. Missing original sources/captures remain explicitly labelled illustrations or unavailable.

保留 #13 的浏览器历史实现，不重复开发。#15 后续修复包含旧数据兼容、跨域、新旧图片的视频保存、原子额度预留、滚动限额和计数丢失恢复。演示先展示预选输入再进入结果，不调用 API；缺失素材明确标注。

Live video remains disabled by a code gate pending actual response/release verification. Source uploads are never saved in history. Completed media stays in the same browser profile and origin; it does not transfer to a collaborator or another URL. Download a backup before clearing browser data.

实时视频尚未开放，需真实响应及发布验收。原始上传不进入历史；结果仅属于当前浏览器与网站地址，不会随代码转移。清理浏览器数据前请下载备份。

## Local checks / 本地检查

Use the fixture-only commands in [README](../README.md). Run npm test, npm run typecheck, npm run build and npm run contrast-audit --workspace @yincol/web. CI also runs a namespaced Valkey integration test; local execution requires a dedicated YINCOL_TEST_KV_URL. Never point testing at a provider API or use a production budget key for test setup.

按 README 使用演示模式运行。常规测试不花额度。Valkey 集成测试使用独立随机命名空间，本地需专用测试地址；不能把生产额度记录作为测试数据修改。

## Ownership and finish / 分工与收尾

Sean can implement and submit code through GitHub. Dennis controls existing Render/YouCam configuration, secrets, paid captures and release. Keep hosting free, without new accounts/platforms or visitor login. Confirm auto-deploy behavior before merging. Keep #12 open until all acceptance criteria pass; a green local test is not deployed or paid-provider evidence.

Sean 通过 GitHub 开发提交；Dennis 管理现有 Render/YouCam 配置、密钥、付费素材与发布。保持免费托管，不新增平台或访客账号。合并前确认自动部署；#12 在全部验收前保持开启。本地通过不代表已部署或付费接口已验收。

The existing owner-controlled allowance covers at most 11 units for the specified missing makeup/video captures, with no automatic retries. This document is not authorization to spend it. See [remaining acceptance](pr15-followup.md#remaining-acceptance--剩余验收) and the [deployment runbook](deployment.md).

已约定的指定妆容/视频素材预算最多 11 单位，由负责人控制执行，不自动重试；本文不构成调用授权。
