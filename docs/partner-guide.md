# Partner guide / 合作开发指南

**Updated / 更新日期:** September 22, 2026 / 2026年9月22日

This guide distinguishes the current application from the accepted next increment.
It does not authorize deployment or new paid API calls.

本指南区分当前已实现的应用与下一阶段已确认的方案。本文不授权部署或新增付费 API 调用。

## Current state / 当前状态

| Area / 项目 | Implemented / 已实现 |
| --- | --- |
| Flow / 流程 | Start → Add inputs → Generate → Results. / 开始 → 添加输入 → 生成 → 结果。 |
| Default demo / 默认演示 | Saved results or labelled placeholders; no YouCam calls. / 显示已保存的结果或明确标注的占位图，不调用 YouCam。 |
| Live images / 实时图片 | Server-side opt-in Clothes VTO, Makeup VTO and optional Skin Analysis. / 可在服务端启用服装试穿、妆容试用及可选的皮肤外观分析。 |
| Full body / 全身预览 | An uploaded full-body portrait and trousers reference feed two top-plus-makeup sequences. / 根据上传的全身照与裤装参考图，分别生成两套上衣和妆容结果。 |
| Makeup comparison / 妆容对比 | Currently Garment A before and after makeup, not makeup on the unchanged original portrait. / 当前对比服装 A 的上妆前后效果，尚未改为原始肖像的纯妆容对比。 |
| Palette / 配色 | Local rules use an example colour reading; live Facial Color Tone remains unverified. / 本地规则使用示例色彩数据；实时肤色分析的完整接口尚未验证。 |
| Video / 视频 | One saved five-second red-shirt / Rose Veil clip; no live video route. / 一段已保存的五秒红色上衣、Rose Veil 妆容视频；尚无实时视频生成接口。 |
| Storage / 存储 | Completed outputs, settings and matching sample video save automatically in IndexedDB; source uploads stay in memory. / 完成的预览、设置与对应演示视频自动保存到 IndexedDB；原始上传文件仅保存在内存中。 |
| Limits / 限额 | In-process request limits only. No daily unit budget. / 仅有单个服务进程内的请求频率限制，尚无每日 API 用量额度。 |

A complete look means Makeup VTO received the Clothes VTO result. A captured demo
result must not be presented as generated from a visitor's uploads. The video is
not a 3D model or proof of the unseen back of a garment.

“完整造型”表示妆容接口实际接收了服装试穿的结果。已保存的演示结果不能称为根据访客上传照片生成的结果。
视频不是三维模型，也不能证明衣服背面的真实细节。

## Run and verify / 运行与验证

Install Node.js 20 or newer, then run from the repository root:

安装 Node.js 20 或更高版本，然后在仓库根目录运行：

```bash
npm ci
```

For a no-credit walkthrough, explicitly override any existing live `.env`
settings. PowerShell commands:

为确保测试不消耗 API 额度，应明确覆盖本地 `.env` 中可能已有的实时设置。在 PowerShell 中运行：

```powershell
$env:YINCOL_FIXTURE_MODE = 'true'
$env:YINCOL_LIVE_SKIN_ANALYSIS = 'false'
$env:YINCOL_LIVE_TRY_ON = 'false'
$env:YINCOL_API_KEY = ''
npm run dev
```

Open <http://localhost:5173>. At <http://localhost:8787/api/health>, confirm
`mode: "fixture"`, `liveSkinAnalysis: false`, `liveTryOn: false`, and
`hasApiKey: false`. Local API requests are expected; provider calls are not.

打开 <http://localhost:5173>。检查 <http://localhost:8787/api/health> 返回上述状态。
本地 API 请求属于正常流程，但此模式不会调用 YouCam。

```bash
npm test
npm run typecheck
npm run build
npm run contrast-audit --workspace @yincol/web
```

Walk Start, inputs, Generate and both comparisons. Check navigation, one failed
preview, removal of photos/results, phone layout, and the matching saved video's
play/pause/still controls. Do not use a paid generation as an ordinary regression
test. The [verification record](verification.md) separates fresh evidence from old
runs; the repository currently has no GitHub Actions workflow.

依次检查开始页、输入页、生成页和两种对比。检查返回导航、单张预览失败、删除照片与结果、手机布局，
以及对应演示视频的播放、暂停和查看静态图片操作。常规回归测试不应消耗付费额度。
[验证记录](verification.md)区分最新检查与历史记录；当前仓库没有 GitHub Actions 工作流。

## Saved results / 已保存的结果

Completed previews save automatically; Keep is not required. Open **Previous looks**
on Start to revisit a comparison without generation, even while the API is unavailable.
The matching existing five-second sample video also reopens from stored bytes.
Current comparison controls remain unchanged in this increment.

完成的预览会自动保存，无需点击 Keep。在开始页的 **Previous looks（历史造型）** 打开结果，
即可直接查看，不会重新生成，也不依赖 API 是否已唤醒。对应的现有五秒演示视频也从本地数据播放。
本阶段保留现有对比控件，简化对比及实时视频仍属于下一阶段。

History is specific to this browser profile and site address; localhost, Tailscale
and Render do not share it. Source uploads and echoed source portraits are excluded.
Reselect source files to change a look. Matching file bytes and settings reuse results;
generation stops if history cannot be checked or secure file matching is unavailable.
Use HTTPS or localhost. Failed saves keep the current previews and download links,
with a save-only retry. Browser cleanup, private browsing and storage eviction can
remove media, so download a backup.

历史记录仅属于当前浏览器配置与网站地址，localhost、Tailscale 和 Render 之间不会同步。
原始上传文件与接口回传的原始肖像不进入历史记录；修改造型时需重新选择源文件。
文件内容和设置相同时复用已有结果；无法检查历史或安全匹配文件时暂停生成，请使用 HTTPS 或 localhost。
保存失败时仍保留当前预览和下载入口，可只重试保存，不再次调用生成接口。
清理浏览器数据、隐私浏览或存储回收可能移除媒体，因此请下载备份。

Delete on a history card removes that look. **Remove photos and saved results**
confirms deletion of current inputs and all saved looks. Late writes cannot restore
deleted media; other tabs may still hold already-open results in memory until closed
or cleared. The first valid legacy session cache may migrate once without generation.

历史卡片上的 Delete 仅删除该造型。**Remove photos and saved results** 会确认清除当前输入及所有历史造型。
延迟写入不能恢复已删除媒体；其他标签页已打开的结果可能仍在内存中，直到关闭或清除。
首次加载时可迁移一份有效的旧会话缓存，无需重新生成。

## Next increment / 下一阶段

The following is accepted direction, **not completed functionality**:

以下是已确认的方向，**并非已完成功能**：

1. **Demo and live entry.** The saved demo pre-fills sample inputs and displays saved
   photos/video after Generate. Live entry starts warming the API while inputs are
   added. The temporary design preview has been removed; saved website demo assets remain.
   **演示与实时入口。** 演示模式预填示例输入，点击生成后显示已保存的照片与视频。实时入口在用户添加输入时唤醒 API。
   临时设计预览已移除，网站演示素材予以保留。
2. **Simpler comparisons.** Original portrait versus makeup on that same portrait;
   Outfit A and Outfit B each use trousers and makeup. Remove the extra view switch.
   **简化对比。** 原始肖像与同一肖像的上妆结果对比；服装 A、B 都包含裤装与妆容。移除额外的视图切换。
3. **Connect future videos to existing history.** Browser history is implemented;
   reuse its save/open/download/delete flow for the upcoming live video route.
   **将后续视频接入现有历史记录。** 浏览器历史已实现；实时视频应复用现有保存、打开、下载和删除流程。
4. **Video per result.** Generate from the chosen completed image, save it beside
   that image, and offer playback/download. Remove the need to mark a result as kept.
   **为结果生成视频。** 使用选定的最终图片生成视频，将其与对应图片一起保存，并提供播放和下载；无需先点击保留。
5. **Server budget.** Free Render Key Value holds usage counters: 100 units per day
   sitewide and at most 40 per browser per 24 hours, subject to the shared pool.
   Reserve the complete request's estimated units before paid work. Browser identity
   is approximate without accounts. Reject duplicate submissions and fail closed
   if the counter store is unavailable or lost.
   **服务端额度。** 免费 Render Key Value 保存计数：全站每天共 100 单位，每个浏览器每 24 小时最多 40 单位，
   同时受全站余额限制。在付费任务开始前预留整个请求的预计用量。没有账户时，浏览器身份只能近似区分用户。
   拒绝重复提交；计数服务不可用或数据丢失时，暂停实时生成。

Current close-up generation costs an estimated 6 units; optional full-body adds 8,
optional Skin Analysis adds 12. The planned simpler three-image flow is about 9
units without Skin Analysis; a five-second 720p video adds 10. These are estimates,
not an account balance. Check the provider rates linked in the [README](../README.md).

当前近景生成预计消耗 6 单位；可选全身预览增加 8 单位，可选皮肤分析增加 12 单位。
计划中的三张新图片流程在不做皮肤分析时约需 9 单位；五秒 720p 视频另需 10 单位。
这些是估算，不代表账户余额；使用前请核对 [README](../README.md) 中链接的官方价格。

## Render ownership / Render 分工

Sean can implement the application, tests and documentation in a GitHub pull
request without access to Dennis's Render account or provider key. Dennis creates
and configures the personal Render services, enters secrets, and verifies the
release. Do not place credentials or private source images in issues or commits.

Sean 可以通过 GitHub 拉取请求完成应用、测试和文档，无需访问 Dennis 的 Render 账户或 API 密钥。
Dennis 负责创建与配置个人 Render 服务、设置密钥及验证发布。不要将密钥或私有原始图片写入问题或提交。

A Hobby workspace cannot invite a second member. Connected GitHub branches can
trigger automatic deployment after a push or merge, depending on service settings;
merging must therefore be treated as a release action when auto-deploy is enabled.

Hobby 工作区不能邀请第二名成员。关联的 GitHub 分支可能在推送或合并后自动部署，具体取决于服务设置；
启用自动部署时，合并也应被视为发布操作。

The free API can sleep after 15 minutes of inactivity and may take about a minute
to wake. Its restart does not erase a separate Key Value service. However, free
Key Value loses its own data if it restarts. The proposed response to lost counters
is a conservative 24-hour pause for new live work; saved examples and browser
history remain usable. That recovery rule is not implemented yet.

免费 API 服务在 15 分钟无访问后可能休眠，唤醒约需一分钟。API 重启不会清除独立 Key Value 服务的数据；
但免费 Key Value 自身重启会丢失数据。计划在计数丢失后保守地暂停新的实时生成 24 小时，
已保存的演示与浏览器历史仍可使用。该恢复规则尚未实现。

Sources / 来源:
[Render members](https://render.com/docs/team-members),
[Deploys](https://render.com/docs/deploys),
[Free service limits](https://render.com/docs/free).

The [deployment runbook](deployment.md) describes the current fixture-only release.
Live rollout requires the budget, storage and failure checks above; current local
image generation does not make the public site safe for anonymous paid calls.

[部署说明](deployment.md)描述当前仅使用已保存演示结果的发布方式。实时发布前必须完成上述额度、存储和故障检查；
本地可以生成图片，不代表公开网站已具备匿名付费调用的保护措施。
