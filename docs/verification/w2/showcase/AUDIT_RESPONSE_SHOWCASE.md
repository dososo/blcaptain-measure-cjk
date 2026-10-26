# 审计响应矩阵：AUDIT_SHOWCASE（W2 第 3 步展示页）

| 项 | 内容 |
|---|---|
| 审计报告 | `audit/AUDIT_SHOWCASE.md`：有条件达标；Blocker 0、High 3、Medium 6、Low 6 |
| 审计规则 | 用户 2026-10-26 拍板：一轮审计；Blocker、High 必修并复核；Medium、Low 记台账 |
| 产物 | `site/index.html`（由 `site/_build.mjs` 从 `site/showcase.json` 生成）、`site/shots/`；生成脚本 `bench/showcase-build.mjs` |

## 1. 逐条回应

| 发现编号 | 严重度 | 落实状态 | 落在哪 | 怎么落的 | 证据指针 |
|---|---|---|---|---|---|
| SA-01 | High | 已落实 | `bench/showcase-build.mjs`（真实页面一节） | 标签的数值改成在截图的这一次渲染里当场量：T11 取元素计算后的字号，T07 取计算后的字距；T03、T05 只标规则名。量出来已经不违反规则的元素不画框，并记下个数（`marks_skipped_not_violating`，4 组都是 0）。页面文字改成「在这张截图里当场量到的值」 | `site/showcase.json` 的 `pairs[].control` |
| SA-02 | High | 已落实（做法有调整） | 同上；`site/_build.mjs` | 先按审计修法实现了「按卡片边框裁切、缩放到同一宽度」，结果两版最小字号占卡片宽度只是 2.03% 对 2.41%。卡片按 1080×1440 导出成图，T11 按浏览器里的像素判断卡片，口径本身有问题，拿这一组当「装之前更差」的例子会误导。**所以撤下了卡片这组**，换成 Claude Code 的文章页（006，中文斜体 T08）。裁切缩放的代码保留在脚本里（`view: "card"`）。T11 对卡片的口径记入台账（新发现，见 §2） | `bench/showcase-build.mjs` 里 PAIRS 的注释 |
| SA-03 | High | 已落实 | `site/_build.mjs`（真实页面一节的说明） | 页面上写明怎么挑的：每个 Agent 两组、覆盖不同页面、偏向问题多看得出差别的页面；并给出每组在各自 30 页里按对照组 error 数的排名（codex 008、011 都排第 4，claude 004 排第 7，006 排第 14）；写明 Claude Code 不装时排除 T02、T04 后本来就有一半页面零 error；列出装了 measure 仍报 error 的页面（Claude Code 012、019、028，都是 T06）。换组时，试过的 claude 007 排第 1、而且在 1280px 下截不到问题，没有采用 | `site/showcase.json` 的 `rank_by_control_errors`、`still_failing` |
| SA-04 | Medium | 已落实（复核时补全） | `bench/showcase-build.mjs`；`site/_build.mjs` | 图注计数加回 lint 省略的「另有 N 处」（例如 011 的 T11 是 51 处）；不计 T06，并在页面上说明。复核指出没说明「红框只画 lint 列出了位置的问题」，已补一句：框数会比图注数字少 | `site/showcase.json` 的 `counts` |
| SA-05 | Medium | 记台账 | `bench/showcase-lib.mjs` | 字体核对用的是黑名单，没收录的系统字体会放行，也不进 iframe。改成白名单（只允许思源字体和页面点名的英文字体）留到下一轮；这次的截图审计方已核对，没有越界 | — |
| SA-06 | Medium | 用户已拍板（S-D2），待下载 | 页脚；`docs/verification/w2/northstar/open_decisions.json` S-D2 | 用户原话：「不让系统 emoji 和符号字体出现在公开截图里。」换成 Noto Color Emoji、Noto Sans Symbols 2；下载前已报文件名和大小，等用户确认后下载、改截图 | `open_decisions.json` |
| SA-07 | Medium | 已落实 | `site/demos/_gen.mjs` | T06 的「关」从行高 1.2 改成 1.35（实验里真实页面报 T06 的最低值）；T07 从 -0.06em 改成 -0.03em。改完重新验证，「关」仍只报目标规则，「开」零 error。页面上加一句「关的程度按实验里真实页面的情况设」 | 生成脚本的验证输出 |
| SA-08 | Medium | 已落实 | `site/_build.mjs` | 手机宽度下，窄图的对比改成单列（卡片组撤下后，目前 4 组都是单列） | — |
| SA-09 | Medium | 记台账 | — | 红框标签会遮住标出来的文字。改进方向：标签放到框外留白处，或者改成编号加图例 | — |
| SA-10 | Low | 已落实 | `site/_build.mjs` | alt 写明页面类型、红框数量和标签含义 | — |
| SA-11 | Low | 已落实 | `site/_build.mjs` | 页面上说明 T01、T13、T04 为什么不做示意 | — |
| SA-12 | Low | 已落实 | `bench/showcase-build.mjs` | 标签字体改成截图用的思源黑体（不用 Menlo）；T03 标签写「标点」，不再写死 | — |
| SA-13 | Low | 已落实 | 页脚 | 写明 measure 版本、实验日期、两个模型和检验方法 | — |
| SA-14 | Low | 记台账 | — | 脚本健壮性（审计报告 SA-14 列出的几处） | — |
| SA-15 | Low | 记台账 | — | 色板直接用了 dososo-design-system 里的示例值，采样来源待确认 | — |

## 2. 新发现（整改中发现，记台账）

- **N-SC1：T11 对小红书卡片的口径。** 卡片按 1080×1440 导出成图，最终在图片里显示的大小取决于导出时的缩放；T11 按浏览器视口里的 CSS 像素判断，对设计宽度小于 1080 的卡片会误报。建议 `card` 命令和完整档对卡片按「字号 ÷ 卡片宽度」或导出后的像素判断。属于产品规则问题，留到修 T06 误报时一起处理。**它还影响北极星的首屏数字**：Claude Code「排除 T02、T04」的配对比较在这个口径下不再显著（见 §4 R2-01）。

## 3. 需要用户拍板

1. **SA-06：截图里自动回退出现的 emoji 字体（Apple Color Emoji）和符号字体（Zapf Dingbats），能不能出现在公开的截图里？** 执行方推荐：不能，下一轮把页面里的 emoji 和特殊符号也换成开源字体渲染（例如 Noto Color Emoji、Noto Sans Symbols 2，都是 OFL-1.1，需要另外下载）；在此之前，展示页可以先在页脚写明。

## 4. 复核（AUDIT_SHOWCASE_r2）的响应

复核结论：有条件达标。SA-01、SA-02 关闭；SA-03 差一处措辞；新 High R2-01。

| 发现编号 | 严重度 | 落实状态 | 落在哪 | 怎么落的 | 证据指针 |
|---|---|---|---|---|---|
| SA-03（剩余） | High | 已落实 | `site/_build.mjs` | 删掉「覆盖四类页面」（实际是文章页两组、价格页一组、落地页一组） | 页面「怎么挑的」一条 |
| R2-01 | High | 已落实 | `bench/showcase-build.mjs`（`card_sensitivity`）；`site/_build.mjs`（数字区说明）；北极星报告 §4；`open_decisions.json` N-D3；本矩阵 §2 N-SC1 | 由脚本算出卡片口径的敏感性并写进 `showcase.json`：Claude Code 有 5 页受影响，「排除 T02、T04」一行会变成 20/30 → 27/30，配对 9/18/3，p = 0.1460，不再显著；Codex 有 1 页受影响，仍然显著。数字区加一条说明，北极星报告的已知局限加一条，补算附加列交用户拍板（N-D3）。主数字不改 | `site/showcase.json` 的 `card_sensitivity`；执行方独立验算结果与审计一致（20/30 → 27/30，9/18/3，p = 0.1460） |
| N-SC1 补充 | — | 已落实 | 本矩阵 §2 | 补写它对首屏数字的影响（同 R2-01） | — |

## 5. 终审

- 第 2 次复核（`audit/AUDIT_SHOWCASE_r3.md`）：**达标**。SA-01、SA-02、SA-03、R2-01 全部关闭；Medium、Low 留在台账。
- **发布前提**（审计方写明）：用户的 S-D2 执行完——下载 Noto Color Emoji、Noto Sans Symbols 2，重截还在用系统 emoji 或符号字体的 3 张截图（`real-codex-008-control.jpg`、`real-codex-011-measure.jpg`、`real-claude-code-004-control.jpg`）——之前，展示页不对外发布。
- S-D2 的用户原话由执行方对照对话原文核对过，与记录一致。
- R3-01（Low，记台账）：卡片敏感性对 Codex 没有真的按卡片宽度换算（codex 029 换算后约 5.9px，仍然违规），只会让 Codex 看起来更差、结论仍然显著，不构成夸大；修 N-SC1 时改成按卡片宽度换算。

## 6. 发布前提的执行（S-D2）

- 用户 2026-10-26 确认下载（原话：「同意下载 googlefonts/noto-emoji v2.051 的 fonts/NotoColorEmoji.ttf（10,673,480 字节）和 notofonts/symbols 的 NotoSansSymbols2-v2.008.zip（2,331,441 字节）到 deliverables/fonts-for-test/。」）。
- 两个文件的大小与官方一致；`NotoColorEmoji.ttf` 的 git blob 与仓库 v2.051 记录一致。来源、哈希记在 `../deliverables/fonts-for-test/SOURCES.md`。
- `bench/showcase-lib.mjs`：字体栈的通用字族后面补上 Noto Sans Symbols 2、Noto Color Emoji；Apple Color Emoji、Zapf Dingbats、Apple Symbols 列入不合格名单。
- 重截后 22 张截图全部只用到允许的字体。审计点名的 3 张：`real-codex-008-control.jpg`、`real-codex-011-measure.jpg` 改用 Noto Sans Symbols 2，`real-claude-code-004-control.jpg` 改用 Noto Sans Symbols 2 和 Noto Color Emoji（逐张记录在 `site/showcase.json` 的 `fonts`）。放大看过 004 里的 ✨，彩色 emoji 正常显示，不是空白方框。
- 页脚的字体说明同步更新。展示页自身 lint --render 零 error。
