# 审计响应矩阵：AUDIT_CARD（W2 `card` 命令）

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」：执行方整改完毕，送审计方复核 |
| 执行方 | Claude Code（用户指示全部由 Claude Code 闭环） |
| 审计报告 | `audit/AUDIT_CARD.md`（14 条：Blocker 1、High 5、Medium 2、Low 6） |
| 提交 | 锁定复现夹具和回归测试 `bef874a`（整改前 34 项里 30 项失败，`evidence/card-audit-tests-before-fix.log`）→ 整改 `fe5d794` → 本矩阵、PRD 提案 R2、验证结果（后续提交） |
| 机器判定 | `results.json`（`node scripts/verify-w2-card.mjs`，新增 CV-10 = 本轮回归） |

整改的顺序按审计 §5：先给每条发现写锁定夹具（`test/fixtures/w2-card-audit/`，单独的 MANIFEST），断言「不写 PNG」，再改实现。

---

## 1. 逐条回应

| 发现编号 | 严重度 | 落实状态 | 落在哪 | 怎么落的 | 证据指针 |
|---|---|---|---|---|---|
| CA-01 | Blocker | 已落实（修法第 2 步有调整，见 §2.1；embed 和 CSS 引用的 SVG 的夹具在第 2 轮补上，见 §6 CB-02） | `card.ts` 的 `afterMeasure`、`svgProblems`；`OPAQUE` | ① `DOM.getDocument({ depth: -1, pierce: true })`，遍历 children、pseudoElements、shadowRoots，对**每个**元素和伪元素节点查字体，`TEXTAREA` 不再跳过。② canvas、iframe、frame、object、embed、video、fencedframe、portal 判**没检查完**（退出码 2）。③ SVG 图片按网络事件识别（`image/svg+xml`，含 data:、blob:）：工作区文件和 data: 地址读出内容，含 `<text>`、`<tspan>`、`<textPath>`、`<foreignObject>` 或嵌套 SVG 的判没检查完，blob: 等读不到内容的也判没检查完；不含文字的图标照常导出 | 夹具 C01–C16（伪元素、`✦` 回退、input、placeholder、textarea、select、两种 shadow DOM、`::first-line`、canvas、data: SVG、含文字的 SVG 文件、SVG 图标对照、两种 iframe、object）；`evidence/CV-10.log` |
| CA-02 | High | 已落实（两个方案都用上了） | `card.ts` 的 `afterLoad`、`afterMeasure`；`render.ts` 的 `screenshot()` | ① 方案一：页面加载后用 CDP 检查器样式表（页面脚本看不到、删不掉）注入 `animation: none !important; transition: none !important`，再在隔离环境里 `document.getAnimations().forEach(a => a.cancel())`（含 shadow DOM 和 Web Animations），然后才测量、查字体、截图；截图改用 CDP `Page.captureScreenshot`，lint 的证据截图在 card 模式下用 `animations: "allow"`，不再快进。② 方案二：查字体前后各截一次图，比对 SHA-256；同时用隔离环境的 MutationObserver 记 DOM 变化，并检查有没有新动画。任一不一致判没检查完 | C17（3600 秒的动画）、C18（0.01 秒的动画）、C19（Web Animations）都导出，且 PNG 与对照组 C00 **逐字节相同**，证明导出的就是检查时的画面；C20（脚本每 30 ms 切换字体）不导出 |
| CA-03 | High | 已落实 | `card.ts` 的 `judgeDirFont` | 删掉 `?? matchFontFile(file)`。内部名查不到一律按 F-UNKNOWN 拒绝，原因里写明「按字体文件内部的名字查，不看文件名」 | C28（文件名伪装成 `LXGWWenKai-Regular.ttf`）、C29（`MiSans-Bold.ttf`）都拒绝，原因含 F-UNKNOWN |
| CA-04 | High | 已落实 | `card.ts` 的 `beforeLoad`（`CSS.fontsUpdated`）、`pageFontReason` | 开启 CSS 域监听字体加载事件：`src` 不是 font_dir 注入地址（也不是 `local()`）的一律算页面自带（data:、blob:、FontFace API 的 `src` 为空）。用到的网络字体对不上 font_dir 注入的那批时，也记为页面自带。结果里 `source: "page"`、不放行；加载了但没用来渲染的也列出并拒绝 | C21（data:）、C22（blob:）、C23（FontFace API）都拒绝，且有 `source: "page"` 的字体；K-page-fontface（文件引用被拦截）照常通过 |
| CA-05 | High | 已落实 | `render.ts` 新增 `CardHooks`（`viewportHeight`、`route`、`beforeLoad`、`afterLoad`、`afterMeasure`、`snapshotSkipId`）；`card.ts` 的 `runCard` | 删掉 card 自己的第二次渲染。卡片 lint 和导出在完整档的**同一个页面**里完成：视口 1080×1440，字体注入、拦截规则都由 card 的路由挂钩提供；测量完成后在同一页面里查字体、截图。DOM 快照去掉 card 注入的那份 `<style>`，避免把 font_dir 的 @font-face 当成卡片自己的（否则 MiSans 会被 F03 误报） | C25（`orientation: portrait`）、C26（`min-height`）、C27（脚本发现多了样式就把字改小）都因 lint error 拒绝 |
| CA-06 | High | 已落实 | `card.ts` 的 `runCard`（「样式里点名」一段） | 遍历时收集**所有**元素和伪元素计算后的 `font-family`，每个名字都查授权表；命中、但 `commercial_image` 不是 `true` 的一律拒绝，原因附原文链接。已经作为实际用到的字体列出的，标记 `requested`；否则新增一条 `source: "css"` | C24（点名方正兰亭黑、font_dir 里没有）拒绝，原因含 `foundertype.com` |
| CA-07 | Medium | 已落实 | `test/card-audit.test.js`「安全」一项 | ① 每个用例都断言 stderr 里对应的中文原因。② 用能导出的字体（先跑一次对照，确认能导出），「不覆盖已有的非 PNG 文件」才有意义。③ 新增「指向工作区内的符号链接 font_dir」。旧测试保留不动 | `evidence/CA-07-mutation.log`：逐条去掉 5 项检查，新测试 5 项全部失败（旧测试只测到 3 项）；不改代码时通过 |
| CA-08 | Medium | 已落实 | `VERIFICATION_REPORT.md`、`xhs-card.md`、`README.md`、`scripts/verify-w2-card.mjs` | ① 报告结论只照录 `results.json`，先跑验证、再写结论。② 拦截范围和判定口径按实际实现重写（页面自带字体分「拦截」和「加载了就拒绝」两种；不看文件名；查不到字体的内容；动画；同一次渲染；平台差异）。③ 伪成功扫描一节写明「关键字扫描只能发现写法上的问题，行为层面靠锁定夹具」。④ 验证脚本自己把样张复制进 `evidence/real-font/`，并写 `SHA256SUMS` | `evidence/CV-08.log`、`evidence/real-font/SHA256SUMS` |
| CA-09 | Low | 已落实 | `card.ts` 的 `runCard`（「没检查完的原因」一段） | lint 判 incomplete 时，把 `lint.run.render.problems` 的原文和超时原因写进 `problems`；都没有时写出 skipped 的原因。回归测试对所有没导出的夹具断言 `problems` 非空 | C15（iframe 里有中文）的 `problems` 含「iframe」 |
| CA-10 | Low | 已落实 | `cli.ts`（`--evidence`）、`card.ts`（`evidenceDir`）、`xhs-card.md`、README | 新增 `--evidence <目录>`；默认仍是输出 PNG 旁边的 `evidence/`，`lint.run.render.evidence_dir` 记录实际目录，文字输出里也会提示截图在哪；文档写明同名文件会被覆盖 | 回归测试「card --evidence」 |
| CA-11 | Low | 已落实 | `card.ts`（`configDir`）、`cli.ts` | 配置文件里的 `font_dir` 相对配置文件所在目录解析；命令行的 `--font-dir` 仍相对当前目录；程序调用不传 `configDir` 时相对工作区根目录 | 回归测试「配置文件里的 font_dir」；测试本身的缺陷登记为 RULING-09 |
| CA-12 | Low | 已落实（修法有调整，见 §2.2） | `render.ts` 的 `closeWithin` | 关闭页面上下文和浏览器都设 5 秒上限，超时不再等待 | `evidence/CA-12-stress.log`：与真实字体导出并行跑 6 次全量测试，「完整档单页超时」测试最长 9.1 秒（要求 < 30 秒；整改前 33.4 秒） |
| CA-13 | Low | 已落实 | `fontfile.ts`；`card.ts` 的 `loadFontDir` | ① WOFF2 的解压大小按目录算准（各表长度之和），超过压缩数据的 64 倍（且超过 1 MB）或超过 256 MB 直接报错，`maxOutputLength` 用算准的值。② WOFF1 的 name、OS/2 表声称超过 1 MB 直接报错。③ 只给放行的字体留 `buf` | 回归测试「解压炸弹」：57 KB 级的文件声称解压后 32 MB，200 ms 内报错，额外分配不到 16 MB |
| CA-14 | Low | 已落实 | `skills/measure/assets/cards/quote.html` | 引号字号 120px → 220px，限高 80px、下边距 8px，让它贴近引文。用真实霞鹜文楷看过样张 | `evidence/real-font/quote.png` |

## 2. 和审计修法不一致的地方

### 2.1 CA-01：查不到字体的内容判「没检查完」，不是「拒绝」

审计修法写的是「判 `rejected`（或 `incomplete`）」。我选了 incomplete（退出码 2），理由：
- 和完整档对 iframe 里中文的处理一致（`cjk-in-frame` 也是 incomplete）；
- 这些内容不一定违规，只是工具查不到，退出码 1 的含义是「卡片不合规」，用在这里不准确。

这一点会改变 PRD 刚写进去的口径，已经写进 `PRD_CARD_PROPOSAL_R2.md`，作为 R-C2 的一部分请用户拍板。

另外，审计说「SVG 来源的 `<img>` 一律判拒绝」。我只对**含文字**（或读不到内容）的 SVG 判没检查完，不含文字的图标照常导出（夹具 C13），避免误伤卡片上常见的装饰图标。

### 2.2 CA-12：没有 `SIGKILL`

审计建议超时后 `browser.process()?.kill("SIGKILL")`。Playwright 的 `chromium.launch()` 返回的 `Browser` 对象没有公开的 `process()`（只有 `launchServer()` 返回的 `BrowserServer` 有），为此改成 `launchServer` 会动到已经终审达标的完整档启动逻辑。所以只做了「关闭设上限、超时不等」。Node 进程退出时，Playwright 会结束它启动的浏览器进程。请审计方判断是否接受。

### 2.3 CA-02：两种动画夹具判「导出」

审计要求每个夹具都断言 rejected 或 incomplete、并且不写 PNG。C17–C19（动画）按新口径应当导出：动画被去掉，导出的是静态样式，PNG 上没有苹方。为了证明这一点，测试断言这三张 PNG 和对照组 C00 **逐字节相同**，比「不写 PNG」更强。只有 C20（脚本不停切换字体）要求不导出。

## 3. 对审计 §3 裁定的回应

| # | 裁定 | 回应 |
|---|---|---|
| 1 | RULING-08 同意 | 已在 `RULINGS.md` 照录审计方原文，状态改为「审计方同意」 |
| 2a | 「点名要用的字体不出图」原则同意，按 CA-06 修 | 已按 CA-06 修 |
| 2b | font_dir 里没被点名的不合规字体只列出 | 保持不变 |
| 3 | 平台差异要写进 PRD | 写进 `PRD_CARD_PROPOSAL_R2.md` 改动 4 第 5 点，等用户确认；`xhs-card.md` 已经写了 |
| 4 | 两次渲染的出入不接受 | 按 CA-05 改成同一次渲染 |
| 5 | K-04 要修 | 按 CA-12 修；高负载下 3 次全量测试的日志见 `evidence/CA-12-stress.log` |

## 4. 新增的裁定事项

- **RULING-09**（待审计方裁定）：锁定的 CA-11 测试漏写配置文件的 `schema_version`，整改前的失败原因因此不对。只补了 `schema_version`，断言不变；改正后在整改前的代码上失败原因变成审计复现的「font_dir 不存在：fonts」（`evidence/RULING-09-ca11.log`）。

- **K-07**（待审计方判断）：CA-12 压力测试第一组第 3 次全量测试里，完整档的 `C-RC01-responsive` 失败了一次（23 ms，还没启动浏览器），那组脚本过滤了输出，原因没有保留。之后带负载全量 3 次、16 路并发都没能复现（`evidence/CA-12-stress.log`）。

## 5. 需要用户拍板

- **R-C2**：是否按 `PRD_CARD_PROPOSAL_R2.md` 的改动 4–6 修改 PRD、新增附录 C30–C32。拍板之前，`results.json` 的结论按规则是「未达标」。

---

## 6. 第 2 轮复核（AUDIT_CARD_r2）的响应

第 2 轮是非对抗复核（`audit/AUDIT_CARD_r2.md`）：实质结论「有条件达标」，新发现 Medium 1、Low 3，外加 §5.2 的一个条件。用户要求全部修完，再交第 3 轮复核。

顺序同第 1 轮：先锁定夹具和复现脚本（`0b89936`），再整改。

| 发现编号 | 严重度 | 落实状态 | 落在哪 | 怎么落的 | 证据指针 |
|---|---|---|---|---|---|
| CB-01 | Medium（已复现） | 已落实（夹具口径有调整，见下） | `card.ts` 的 `afterLoad`、`afterMeasure`；`render.ts` 导出 `MARK_ID`，card 模式下截证据图不让 Playwright 插隐藏光标的样式 | ① 去掉动画、等字体就绪之后，立即装 MutationObserver 并截 shot0，再开始 lint 测量。② 查字体前后的 shot1、shot2 必须和 shot0 一致，从 shot0 起的 DOM 变化数必须是 0，没有新动画，否则判没检查完。③ 完整档给 lint error 截证据时临时加的红框（`MARK_ID`）不算页面变化。④ card 模式下截证据图用 `caret: "initial"`，因为 `caret: "hide"` 会往页面里插一个 `<style>`；光标已由冻结样式设成透明 | 整改前扫描 3 次共 14 个 ✗（`evidence/CB-01-sweep-before-fix.log`）；整改后 3 次共 93 个时间点 0 个 ✗，0–1500 ms 宽范围扫描也没有 ✗（`evidence/CB-01-sweep-after-fix.log`）；验证脚本新增 CV-11 |
| CB-02 | Low | 已落实 | `test/fixtures/w2-card-audit-r2/` D10–D16 | 补了 embed、CSS `background-image`（文件和 data:）、`mask-image`、`content: url()`、内联 SVG 的 `<image>` 的夹具，都判没检查完；另加不含文字的 SVG 背景作对照，照常导出。这批夹具写于实现之后（审计修法原文允许）。CV-10 的描述改成「含文字的 SVG 图片（img、object）」，不再夸大覆盖面 | `test/card-audit-r2.test.js`；CV-11 |
| CB-03 | Low | 已落实（不能消除外部负载的影响） | `package.json`、`scripts/verify-w2-card.mjs`、`scripts/stress-card.sh` | ① `npm test` 加 `--test-concurrency=4`（本机默认是 13 个文件并发）。② CV-09 的日志记下运行前后的 uptime。③ 压力测试脚本放进仓库，每次全量测试的完整输出单独保存，汇总记负载、失败项和单页超时的耗时。④ 没有加自动重试 | `scripts/stress-card.sh`；`evidence/CV-09.log` |
| CB-04 | Low | 已落实 | `VERIFICATION_REPORT.md` §2.1、§4 第 7 条；`card.ts` | K-01 改成「审计方已同意」；K-04 改成「已修（CA-12）」并附证据；§4 第 7 条写明检测窗口的起点和终点；删掉没用到的 `SVG_TEXT` 正则，只留实际生效的 `SVG_HAS_TEXT` | 报告 §2.1、§4 |
| §5.2 条件 | — | 部分落实 | `evidence/CA-12-no-orphan.log` | 卡死页面（load 后死循环，预算 3 秒）跑 3 次：每次退出码 2，耗时 3–4 秒，退出后 Playwright 启动的浏览器进程数都是 0；作为对照，运行到第 2 秒时能数到 7 个。**没有覆盖到的：** 这几次的关闭本身都没卡到 5 秒上限，我构造不出「关闭本身卡死」的页面，所以那种情况下有没有残留，没有证据 | `evidence/CA-12-no-orphan.log` |

**CB-01 的夹具口径和审计修法不一致的地方：** 审计修法要求夹具「断言 rejected 或 incomplete、不写 PNG」。延时改页面的夹具，结果取决于改动落在哪一段：
- 落在 lint 测量之前：lint 报 error，拒绝；
- 落在测量和导出截图之间：判没检查完；
- 落在截图之后：导出的就是 lint 检查过的画面。

所以夹具允许三种结果，导出时要求 PNG 和对照组逐字节相同。另外，锁定的夹具在整改前恰好全部通过：这段窗口只有十几毫秒，固定的延时不一定打中。可靠的复现靠扫描脚本，所以把扫描做成了验证门槛 CV-11。

---

## 7. 第 3 轮复核（AUDIT_CARD_r3）的响应

第 3 轮是非对抗复核（`audit/AUDIT_CARD_r3.md`）：实质结论「有条件达标」，新发现 3 条 Low。顺序同前：CC-01 先锁夹具（`2bc8f3b`），再整改。

| 发现编号 | 严重度 | 落实状态 | 落在哪 | 怎么落的 | 证据指针 |
|---|---|---|---|---|---|
| CC-01 | Low（已复现） | 已落实 | `probe.ts` 的 `markElement`；`card.ts` 的 `beforeLoad`、`afterLoad`、`afterMeasure` | ① 完整档画红框时，把元素登记在隔离环境的 WeakSet 里，card 的 MutationObserver 按对象身份排除，不再看 id。② 新增 CDP 一路：afterLoad 里先取一次完整的 DOM 树（穿透 shadow DOM，让节点都推给 CDP），从 shot0 起统计 DOM 事件（插入、删除、属性、文字、shadow root）和样式表事件（改动、新增、删除），红框的插入和删除按 id 排除；两路计数都算进「检查期间的变化」 | 夹具 E01（closed shadow DOM 里每帧改属性）、E02（每帧插入再删除一条样式规则）、E03（每帧加一个、删一个冒用红框 id 的元素）：整改前都被导出（`evidence/card-audit-r3-tests-before-fix.log`），整改后都判没检查完；全部 card 测试 91 项通过，没有误报 |
| CC-02 | Low | 已落实 | `scripts/sweep-card-late-change.mjs --adaptive`；验证脚本 CV-11 | 先在 0–3000 ms 按 50 ms 粗扫，找到「拒绝」的最后一点和「导出」的第一点，再在两点之间按 2 ms 细扫；必须同时出现拒绝和导出（扫到了窗口两端）且 0 个 ✗，才以退出码 0 结束。CV-11 跑 2 次 | `evidence/CC-02-adaptive-sweep.log`：在 CB-01 修复前的代码（`0b89936`）上报 2 个 ✗、退出码 1；在当前代码上 0 个 ✗、退出码 0 |
| CC-03 | Low | 部分落实（PRD 那一处等用户确认） | `PRD_CARD_PROPOSAL_R3.md`；`evidence/CB-01-sweep-before-fix.log` | ① PRD §5.4「截图前后各截一次」的口径写成提案 R-C3，拍板后写进 PRD 附录 C33。② 扫描日志的标题写的是「`.`」，实际运行时用的是仓库绝对路径（那时用「`.`」跑不起来），在日志末尾追加了更正说明，没有改动原有内容 | 提案；日志末尾的更正 |
| §5.3 补充 | — | 已落实 | `VERIFICATION_REPORT.md` §4 第 8 条 | 补上库用法的残留风险：在长期运行的宿主进程里调用 `runCard`，如果关闭本身卡住超过 5 秒，浏览器进程会留到宿主进程退出为止 | 报告 §4 |

**需要用户拍板：**
- R-C3（PRD 口径）；
- 终审前要不要再做一轮对抗复核（AUDIT_CARD_r3 §1.3）。
