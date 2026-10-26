# 独立审计第 2 轮复核：W2 `card` 命令（AUDIT_CARD 整改）

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」；执行：独立审计方（Claude Code，复核会话） |
| 复核对象 | 锁定提交 `bef874a` → 整改 `fe5d794` → 矩阵与证据 `80d11f0` → 验证结果 `7c2780a`（HEAD，复核开始时工作树干净） |
| 依据 | `audit/AUDIT_CARD.md`（第 1 轮，14 条）、`AUDIT_RESPONSE_CARD.md`、`VERIFICATION_REPORT.md`、`results.json`、`evidence/`、`docs/verification/RULINGS.md` |
| 环境 | macOS（Darwin 25.6.0），Node v22，playwright-core 1.64.1，系统 Chrome；复核期间本机有外部重负载（Remotion 渲染、Unity 编辑器），`uptime` 负载均值 17–48（14 核） |

---

## 1. 结论

**实质结论（只看代码、测试、证据）：有条件达标。**

**按项目规则的机器判定：未达标。** 唯一原因是 R-C2 还没有经用户拍板（见 §1.2）。

### 1.1 实质结论

- **第 1 轮 14 条：** 全部有回应，代码与回应相符。第 1 轮已经复现过的绕过场景，都有锁定夹具覆盖：
  - 夹具在整改之前锁定（`bef874a` 早于 `fe5d794`），MANIFEST 校验通过；
  - 整改前 34 项里有 30 项失败，整改后 34 项全部通过。本轮亲自跑过两次：单独跑全量测试一次，验证脚本里的 CV-10 又跑一次。
- **新发现：** Blocker 0、High 0、Medium 1、Low 3。
  - Medium 的 CB-01 是读代码发现的：卡片 lint 测量之后、截图之前，有一段时间没有任何变化检测。能不能被利用，本轮按范围没有验证，标「待确认」。
- **达标条件（全部满足才算达标）：**
  1. CB-01 二选一：
     - 按修法把变化检测提前到冻结动画之后，并补一个锁定夹具；
     - 或者由下一轮对抗复核证实无法利用，并写明理由。
  2. CB-02 到 CB-04 修完，或者在矩阵里登记为已知问题。
  3. 本轮没有做对抗复核：第 1 轮修法的有效性，只经过锁定夹具这一层验证。

### 1.2 R-C2（与实质结论分开）

- `open_decisions.json` 里 R-C2（`PRD_CARD_PROPOSAL_R2.md` 的改动 4–6）还没有用户原话。按项目规则，`verify-w2-card.mjs` 判为「未达标」，本轮重跑也是这个结论。
- R-C2 涉及的口径都和本轮的裁定有关，例如 §2.1 的「查不到字体的内容判 incomplete」。本轮已经给出审计意见（见 §5），**但拍板权在用户**。
- 用户拍板 R-C2、满足 §1.1 的条件、在干净工作树上重跑验证脚本之后，结论可以是「达标」。

---

## 2. 本轮范围与没做的事

**做了：**
- 读代码：
  - `packages/cli/src/card.ts`（全文）；
  - `render.ts` 的 `CardHooks`、`closeWithin`、`withDeadline`，以及调用顺序；
  - `probe.ts` 的 `snapshotPage`；
  - `fontfile.ts` 的 WOFF/WOFF2 部分；
  - `cli.ts`、`config.ts` 的 `lastConfigPath`；
  - `skills/measure/assets/cards/quote.html`。
- 逐个夹具和 `C00-control.html` 做了 diff，对照第 1 轮的 A01–A30。
- 跑了：
  - `npm run build && npm test`；
  - `node scripts/verify-w2-card.mjs`（跑完已恢复）；
  - 锁定时序和 MANIFEST 核对；
  - RULING-09 复现：在 `/tmp` 下用 `git archive bef874a` 解出整改前的代码；
  - CA-07 变异测试复跑：在 `/tmp` 下的 HEAD 副本里做；
  - G-RG01-cap 失败的诊断复跑。

**没做：**
- **本轮没有做新的对抗测试**：没有编写新的攻击页面，也没有尝试新的绕过手法。
  - 上一位复核者做对抗复现时，被安全分类器拦下了。
  - CB-01 只是读代码得出的观察，没有写页面验证。
- 没有在高负载下重复跑 K-07 的压力测试，K-07 的裁定只依据证据文件。
- 没有核实「Node 进程退出时，Playwright 会结束它启动的浏览器」这一说法（§2.2 的前提），标「待确认」。
- 没有逐字审查 `PRD_CARD_PROPOSAL_R2.md`：那是 R-C2 的拍板对象，只核对了它和实现的口径是否一致。

---

## 3. 逐条复核（CA-01 至 CA-14）

「夹具覆盖」一栏说的是：第 1 轮已经复现过的场景，有没有落进 `test/fixtures/w2-card-audit/`。

| 编号 | 第 1 轮严重度 | 回应 | 复核状态 | 代码核对 | 夹具覆盖与证据 |
|---|---|---|---|---|---|
| CA-01 | Blocker | 已落实（§2.1 有调整） | **已落实**；§2.1 接受；夹具缺口见 CB-02 | `card.ts:310` 用 `DOM.getDocument({ depth: -1, pierce: true })`；`:323` 遍历 children、pseudoElements、shadowRoots；`:321` 对每个元素节点查字体，不再要求元素直接含文字；`SKIP_NODES` 里已经没有 TEXTAREA；`:35` 的 `OPAQUE` 包含 canvas、iframe、frame、object、embed、video、fencedframe、portal；`:372` 的 `svgProblems` 按网络事件（`image/svg+xml`）识别 SVG 图片 | A02→C01；真实模板上的 `✦` 回退→C02（方框字体去掉 `✦`）；A04–A07→C03–C06；A09、A10→C07、C08；A12→C10；A13→C11；A25→C14；A11→C15；另加 C09（`::first-line`）、C12、C13、C16。本轮跑出 C01–C16 全部 PASS。第 1 轮修法第 3 步要求「每一种载体」都有夹具，embed、CSS 里的 SVG（background-image、mask-image、content: url()）、内联 SVG 的 `<image>` 没有夹具，见 CB-02 |
| CA-02 | High | 已落实（方案一、二都用了） | **已落实**；§2.3 接受；残余窗口见 CB-01 | `card.ts:209` 的 `FREEZE_CSS` 用 CDP 检查器样式表注入（`:299-300`）；`:301` 取消所有动画（`getAnimations().forEach(cancel)`）；截图改用 CDP `Page.captureScreenshot`（`:228`）；lint 证据截图在 card 模式下用 `animations: "allow"`（`render.ts` 的 `screenshot()`）；`:353-360` 两次截图比对、MutationObserver 计数、检查有没有新动画 | A14→C17；另加 C18（0.01 秒动画）、C19（WAAPI）、C20（脚本每 30 ms 切换字体）。C17–C19 断言 PNG 与 C00 逐字节相同，本轮 PASS。`same_png_as` 在 `bef874a` 锁定的 expect.json 里就有，不是事后放宽 |
| CA-03 | High | 已落实 | **已落实** | `card.ts:122` 只按 `face.names` 查授权表，`?? matchFontFile(file)` 已删除；原因里写明「不看文件名」 | C28（伪装成 `LXGWWenKai-Regular.ttf`）、C29（伪装成 `MiSans-Bold.ttf`）都断言 rejected、`reason_has: F-UNKNOWN`、不写 PNG，本轮 PASS |
| CA-04 | High | 已落实 | **已落实** | `card.ts:284-291` 监听 `CSS.fontsUpdated`：`src` 不是 FONT_URL、也不是 `local()` 的，记为页面字体；`:451-459` 网络字体对不上 font_dir 时，记为 `source: "page"` 并拒绝；`:465-467` 加载了但没用到的页面字体也拒绝 | A23→C21（data:）、A24→C22（blob:）、A20→C23（FontFace API），都断言 `source: "page"` 且不允许出图，本轮 PASS。第 1 轮 A18（data:、内部名查不到）走的是同一条代码路径，`fontsUpdated` 不看名字，没有单独的夹具，可以接受 |
| CA-05 | High | 已落实 | **已落实**（时间窗口见 CB-01） | `card.ts:420` 只调用一次 `runRender`，传入 `card` 挂钩；`render.ts` 的视口高度改为 `ctx.viewportHeight`（1440）；字体注入和拦截都在 `hooks.route` 里；`probe.ts` 的 `snapshotPage(skipId)` 去掉了注入的 `<style>` | A30→C25、A27→C26、A28→C27，都因 lint error 拒绝，本轮 PASS |
| CA-06 | High | 已落实 | **已落实** | `card.ts:342-347` 收集每个节点计算后的 `font-family`；`:474-484` 每个名字都查授权表，命中但 `commercial_image` 不是 `true` 的，记为 `source: "css"`、`requested: true`，并拒绝 | A26→C24，断言 rejected、`requested_font`、`reason_has: foundertype.com`，本轮 PASS |
| CA-07 | Medium | 已落实 | **已落实**（亲自复跑过） | `test/card-audit.test.js` 的「安全」测试：每个用例断言 stderr 里的原因；先跑一次对照，确认这张卡片本来能导出；新增 `linked-in`（工作区内的符号链接） | 本轮在 `/tmp` 的 HEAD 副本里，逐条把 `dist/card.js` 第 47、50、67、105、110 行的 `throw new UsageError(` 换成 `void (`，5 次都是 `ℹ fail 1`，不改时 `ℹ fail 0`，与 `evidence/CA-07-mutation.log` 一致 |
| CA-08 | Medium | 已落实 | **基本落实**；残留的文档问题见 CB-04 | 报告 §1 照录 `results.json`；验证脚本自己复制样张、写 `SHA256SUMS`；`xhs-card.md` 和 README 的拦截范围按实际实现写 | 本轮重跑之后，`evidence/real-font/*.png` 和 `SHA256SUMS` 没有任何 diff，样张逐字节可以复现。报告 §2.1 的 K-01、K-04 仍是整改前的说法，见 CB-04 |
| CA-09 | Low | 已落实 | **已落实** | `card.ts:439-447` 把 render problems、超时原因、查不到字体的载体、SVG 原因、检查期间的变化都写进 `problems` | 回归测试对所有没导出的夹具断言 `problems.length > 0`；C15 断言 `problems_has: iframe` |
| CA-10 | Low | 已落实 | **已落实** | `cli.ts` 新增 `--evidence`；`card.ts:416` 处理截图目录；结果里 `lint.run.render.evidence_dir` 记录实际目录，文字输出里也会提示 | 回归测试「card --evidence」本轮 PASS；`xhs-card.md` 写明同名文件会被覆盖 |
| CA-11 | Low | 已落实 | **已落实**；RULING-09 同意 | `card.ts:415`：配置里的 font_dir 用 `opts.configDir ?? rootReal` 解析；`cli.ts:219` 由 `lastConfigPath` 得到 `configDir` | 本轮复现了 RULING-09，见 §5.4 |
| CA-12 | Low | 已落实（§2.2 有调整） | **有条件接受**，见 §5.2 | `render.ts:71-74` 的 `closeWithin` 包住 `context.close()` 和 `browser.close()`，上限 5 秒，超时后不等待、不强杀 | 只有 `evidence/CA-12-stress.log`。本轮全量测试里，「完整档单页超时」用了 6.0 秒，验证脚本里用了 5.1 秒，都低于 30 秒 |
| CA-13 | Low | 已落实 | **已落实**（修法和审计建议略有不同，可以接受） | `fontfile.ts`：WOFF1 的 name 或 OS/2 表声称超过 1 MB 时报错；WOFF2 的解压大小按目录算准，同时受「≤ 256 MB」和「≤ 压缩数据的 64 倍，或者 ≤ 1 MB」两个上限约束；`card.ts:178` 只给放行的字体留 `buf` | 回归测试「解压炸弹」本轮 PASS。审计建议的是「只解压到 name 表结束」；现在的做法是「全量但有比例上限」，一个 1 MB 的文件最多能让解压分配 64 MB。这个上限有界，不单列发现 |
| CA-14 | Low | 已落实 | **已落实** | `quote.html:32`：`.mark` 改为 220px、`height: 80px`、`margin: 0 0 8px` | 本轮看过 `evidence/real-font/quote.png`：引号紧贴引文上方，没有第 1 轮那种约 130px 的空隙；CV-08 结果是 lint 零 error |

---

## 4. 新发现

### CB-01 · Medium（待确认）· 卡片 lint 测量之后、截图之前，有一段时间没有任何变化检测

- **位置：**
  - `render.ts:488`：`afterLoad`，冻结动画；
  - `render.ts:491`：DOM 快照，基础档检查；
  - `render.ts:519`：`measurePage`，完整档测量；
  - lint 证据截图；
  - `render.ts:580`：`afterMeasure`；
  - `card.ts:306-307`：到这时才装 MutationObserver、截第一张图（shot1）。
- **问题：**
  - 变化检测由三样东西组成：shot1 和 shot2 的比对、MutationObserver、动画计数。它们只覆盖「查字体」这一段。
  - 从冻结动画到 shot1 之间，包括 lint 的 DOM 快照和测量，页面主环境的计时器仍在运行，DOM 变化不会被记录。
  - 后果：如果页面在 lint 测量完成之后、shot1 之前改了和 lint 规则有关的样式（字号、行高之类），PNG 截下的是 lint 没有检查过的状态。字体本身不受影响，因为查字体在 shot1 之后。
  - 这和 CA-05 要求的「lint 认证的就是导出的那张图」是同一类问题，属于检查时与使用时不一致（TOCTOU）。
  - `VERIFICATION_REPORT.md` §4 第 7 条只说「只能发现看得见的变化」，没有披露这段时间窗口。
- **为什么是 Medium、而且待确认：**
  - 代码顺序是确定的事实：observer 装在 `afterMeasure` 开头，晚于 `measurePage`。
  - 但能不能稳定利用，取决于时机：窗口不长，而且第 1 轮 C20 那种周期性改动会被 shot1 和 shot2 的比对抓到。
  - 本轮按范围没有写页面验证。如果下一轮对抗复核证实可以稳定复现，升为 High。
- **修法：**
  1. 在 `afterLoad` 里冻结动画、等字体就绪之后，立刻安装 MutationObserver，并截一张 shot0；
  2. 在 `afterMeasure` 里要求 shot0、shot1、shot2 三张图哈希一致，并且从 `afterLoad` 起累计的变化数为 0，否则判 incomplete；
  3. 先补一个锁定夹具（写在修复之前，单独登记 MANIFEST），断言 rejected 或 incomplete、不写 PNG；
  4. 在报告 §4 第 7 条写明检测窗口的起点和终点。

### CB-02 · Low · CA-01 修法第 3 步「每一种载体都要有锁定夹具」只部分落实，矩阵却写「已落实」

- **位置：** `test/fixtures/w2-card-audit/`；`AUDIT_RESPONSE_CARD.md` §1 CA-01 行。
- **问题：** 第 1 轮修法第 2 步列出的载体里，下面这些在代码里有处理，但没有夹具：
  - `<embed>`：在 `OPAQUE` 里；
  - `background-image`、`mask-image`、`content: url()` 指向的 SVG：经由 `Network.responseReceived` 识别；
  - 内联 SVG 里的 `<image>`。

  `grep -rn -i "embed\|background-image\|mask-image\|content: *url\|<image" test/*.test.js test/fixtures/w2-card*` 没有找到相关夹具，唯一的命中是 `iter3.test.js` 里一个无关的 F03 夹具名。
- **为什么是问题：** 这些路径以后改动时，没有回归保护。`results.json` 里 CV-10 的描述写的是「SVG 图片都不能导出」，覆盖面比夹具说得大。第 1 轮没有专门复现这几种写法，所以定为 Low。
- **修法：**
  1. 给 embed 和 CSS 引用的 SVG 各加一个夹具，按新目录或新文件单独锁定，注明写于实现之后；
  2. 矩阵里 CA-01 的状态改成「已落实（夹具覆盖见清单）」，并列出没有夹具的载体。

### CB-03 · Low · 回归门在高负载下不稳定（K-04、K-07 和本轮 G-RG01-cap 是同一类问题）

- **位置：** `package.json` 的 `"test": "node --test --test-reporter=spec \"test/**/*.test.js\""`，测试文件默认并行跑；`render.ts:22` 的 `RENDER_BUDGET_MS = 15_000`。
- **问题：** 本轮单独跑 `npm test`，结果是 1 项失败：

  ```
  ✖ 第 7 轮复核夹具 G-RG01-cap：整页 fail (21801.144459ms)
    + 'incomplete'
    - 'fail'
  ℹ tests 277 / ℹ pass 276 / ℹ fail 1
  TEST_EXIT=1
  ```

  - 当时本机负载均值 21.58 / 43.86 / 48.68，有外部进程（Remotion、Unity）。
  - 随后单独用 `runRender` 跑这个夹具 3 次：`status=fail`，耗时 2977、2272、2196 ms，`skipped=[]`；单独跑这个测试文件 3/3 通过。
  - 验证脚本里的 CV-09 也通过了，但这一项用了 13284 ms，离 15 秒的预算很近。
  - 判断：这是负载导致的单页超时（21.8 秒 ≈ 15 秒预算 + 关闭等待），不是代码回归。
- **为什么是问题：** 回归门的 PASS 或 FAIL 取决于机器负载，会让「失败 0」这个证据失去区分度。K-07（23 ms 就失败）的失败原因又没有保留下来，没法排除别的原因。
- **修法：**
  1. 给浏览器类测试限制并发，例如 `npm test` 加 `--test-concurrency=<N>`，或者把浏览器测试分组串行跑；
  2. 验证脚本在 CV-09 的日志里记下 `uptime`（负载）；
  3. 压力测试脚本保留完整输出，不要用 grep 过滤，并放进仓库的 `scripts/`。现在 `CA-12-stress.log` 引用的 `stress.sh` 在会话临时目录里，没法复现；
  4. 不要用自动重试掩盖失败，那是伪成功。

### CB-04 · Low · 文档残留和死代码

- **位置和问题：**
  1. `VERIFICATION_REPORT.md` §2.1：
     - K-01 仍写「已登记 RULING-08，待审计方裁定」，但 `RULINGS.md` 里 RULING-08 已经是「审计方同意」；
     - K-04 仍写「请审计方判断要不要处理」，但 CA-12 已经修了，§6 也没有列出这一项。
  2. `card.ts:36` 定义了 `SVG_TEXT` 正则（含 `image|use|style|@font-face|data:`），整个文件都没有用到，真正生效的是 `:216` 的 `SVG_HAS_TEXT`。两个正则口径不同，读代码的人会误判检查范围。
- **为什么是问题：** 证据之间要互相印证（CA-08 的精神），死代码会误导以后的审计。
- **修法：** 改正 K-01、K-04 的说法；删掉 `SVG_TEXT`，或者把它并进 `SVG_HAS_TEXT`，并在注释里写明检查哪些标签。

---

## 5. 裁定

### 5.1 矩阵 §2.1：CA-01 判 incomplete 而不是 rejected；不含文字的 SVG 照常导出

**接受。**

- incomplete 时退出码是 2、不写 PNG（`card.ts:501-504`；回归测试对 C10–C12、C14–C16 断言 PNG 不存在），不构成伪成功。
- 第 1 轮修法原文就是「判 `rejected`（或 `incomplete`）」，两种都允许。
- 和完整档的 `cjk-in-frame` 口径一致；退出码 1 的含义是「卡片不合规」，用在查不到字体的内容上确实不准。
- 不含文字的 SVG 照常导出，也接受：
  - SVG 作为图片时不加载外部资源；
  - 嵌套的 `data:image/svg` 也算进 `SVG_HAS_TEXT`（`card.ts:216`）；
  - 不含 `text`、`tspan`、`textPath`、`foreignObject` 的 SVG 渲染不出文字；
  - 读不到内容的 SVG（blob: 等）按查不到处理。
- **条件：** 这个口径改变了 PRD C27，必须经 R-C2 由用户拍板。另外，CB-02 要补上 embed 和 CSS 引用的 SVG 两个夹具。

### 5.2 矩阵 §2.2：CA-12 没有用 SIGKILL

**有条件接受（Low 残余）。**

- 本轮核对了 `node_modules/playwright-core/types/types.d.ts`（版本 1.64.1）：
  - `interface Browser`（第 11083 行起）没有 `process()`；
  - `interface BrowserServer`（第 20715 行起）有 `process(): ChildProcess`。
- 执行方的事实陈述属实。为了强杀进程改成 `launchServer`，会动到已经终审达标的完整档启动逻辑，代价不小。
- 关闭现在有 5 秒上限，命令不会无限期等下去，这正是 CA-12 的核心诉求。本轮两次全量测试里，「单页超时」测试分别用了 6.0 秒和 5.1 秒。
- **条件：**
  1. 「Node 进程退出时，Playwright 会结束它启动的浏览器」这一说法，执行方要补一条证据：例如死循环页面跑完之后，用 `ps` 确认没有残留的浏览器进程。本轮没有核实，标「待确认」。
  2. 报告 §4 第 8 条保留这条局限。

### 5.3 矩阵 §2.3：CA-02 的动画夹具判导出，要求 PNG 与对照组逐字节相同

**接受。**

- `same_png_as` 和 `status: "exported"` 在 `bef874a` 锁定的 `expect.json` 里就有，不是整改后放宽的。
- 「与对照组逐字节相同」加上「导出时用到的字体全部允许出图」（测试第 72 行），能证明 PNG 上没有苹方字形，比「不写 PNG」更强。本轮 C17–C19 都 PASS。
- 整改前 C17 的失败原因正是「导出的 PNG 和对照组不同」（`card-audit-tests-before-fix.log`），说明这个断言确实测到了 CA-02。
- 副作用是导出的不是动画的最后一帧，报告 §4 第 6 条已经写明。

### 5.4 RULING-09：锁定的 CA-11 测试补了 `schema_version`

**审计方同意，没有放宽测试。**

- 本轮看了 `git diff bef874a..HEAD -- test/`：只有 `test/card-audit.test.js` 改了 1 行，在配置的 JSON 里加了 `schema_version: "1.0.0"`。断言没变，夹具目录没动，MANIFEST 校验通过。
- 本轮在 `/tmp` 下用 `git archive bef874a` 解出整改前的代码，构建之后：
  - 锁定版测试的失败原因：`错误：配置文件 …/measure.config.json 的 schema_version 应为 "1.0.0"`。这说明锁定版测试根本走不到 font_dir 的解析；
  - HEAD 版测试的失败原因：`错误：font_dir 不存在：fonts`，与第 1 轮 CA-11 的复现一致；
  - HEAD 版测试跑在 HEAD 代码上：`✔ … (1154.9ms)`，`ℹ pass 1`、`ℹ fail 0`。
- 与 `evidence/RULING-09-ca11.log` 一致。请在 `RULINGS.md` 里照录本条，状态改为「审计方同意（AUDIT_CARD_r2 §5.4）」。

### 5.5 K-07：压力测试里一次没能复现的失败

**接受为「已知、没能复现」，不阻塞，但要按 CB-03 改进。**

- `evidence/CA-12-stress.log` 显示：
  - 失败的是完整档的 `C-RC01-responsive`，只用了 23 ms，还没启动浏览器；
  - 之后带负载的全量测试 3 次、16 个进程同时跑这个测试文件，都通过了；
  - 失败原因因为 grep 过滤没有保留。
- 本轮又出现了一次同类的负载失败（G-RG01-cap，见 CB-03）。这说明回归门在高负载下本来就会抖动，K-07 很可能也是这一类，但 23 ms 的失败和超时不是同一种表现，原因「待确认」。
- 有一种可能，本轮没有验证：关闭超时之后不等待、不强杀（§5.2），残留的浏览器进程在高负载下可能让下一次启动立刻失败。所以 §5.2 的条件 1 同样适用于这里。
- **条件：** 以后的压力测试保留完整输出；再出现时，按原因定位，不按偶发处理。

---

## 6. 证据三件套是否互相印证

| 核对项 | 结果 |
|---|---|
| `results.json`（`7c2780a` 里提交的版本）与 HEAD | `git_head` 是 `80d11f0`，比 HEAD 早一个提交。`7c2780a` 只提交了 `results.json` 和 evidence，在验证脚本的 dirty 判定里不算（脚本排除了 `docs/verification/w2/card/`），可以接受 |
| 本轮重跑 `verify-w2-card.mjs` | CV-01 到 CV-10 全部 PASS；任务门 PASS；回归门 PASS（277 项，失败 0）；伪成功扫描：未发现；结论：未达标，唯一的 blocker 是 R-C2。`git diff` 显示 15 个文件只有时间戳、`git_head`、测试耗时这类内容变化，各条断言的状态和 notes 与提交版本一致 |
| 真实字体样张 | 重跑之后 `evidence/real-font/*.png` 和 `SHA256SUMS` 没有 diff。cover、card 是 `13d27e4f…`，list 是 `8860d01a…`，quote 是 `14a25352…`。PNG 逐字节可以复现 |
| `VERIFICATION_REPORT.md` 与 `results.json` | §1 照录了 `results.json` 的结论和 blocker，一致；§2.1 有 K-01、K-04 两处过时说法，见 CB-04 |
| 矩阵与 evidence | CA-07 → `CA-07-mutation.log`，本轮复跑一致；RULING-09 → `RULING-09-ca11.log`，本轮复现一致；CA-12 → `CA-12-stress.log`，内容自洽，但引用的 `stress.sh` 不在仓库里（CB-03）；整改前的失败日志是 34 项里 30 项失败，与矩阵一致 |
| 验证脚本的副作用 | 脚本会删掉并重新生成仓库外的 `../deliverables/card-samples/`。本轮重跑之后，样张哈希与提交版本相同 |

---

## 7. 审计方亲自跑过的命令和关键输出

1. 构建和全量测试（HEAD `7c2780a`）：

   ```
   $ npm run build && npm test
   已同步 2 个文件到 packages/cli
   BUILD_EXIT=0
   ✔ AUDIT_CARD 夹具 C00-control：exported … ✔ C29-filename-misans：rejected   （34 项全部 ✔）
   ✔ 完整档单页超时：页面脚本死循环 → status incomplete，退出码 2 … (6022.8ms)
   ✖ 第 7 轮复核夹具 G-RG01-cap：整页 fail (21801.144459ms)   + 'incomplete' - 'fail'
   ℹ tests 277
   ℹ pass 276
   ℹ fail 1
   TEST_EXIT=1
   $ uptime   →  load averages: 21.58 43.86 48.68
   ```

2. G-RG01-cap 诊断（`/tmp` 下的脚本直接调用 `runRender`），以及单独跑这个测试文件：

   ```
   run 1: status=fail ms=2977 skipped=[] problems=[]
   run 2: status=fail ms=2272 skipped=[] problems=[]
   run 3: status=fail ms=2196 skipped=[] problems=[]
   $ node --test test/w2-render-audit-r7.test.js   →  ℹ tests 3 / ℹ pass 3 / ℹ fail 0（G-RG01-cap 3451.8ms）
   ```

3. 验证脚本：

   ```
   $ node scripts/verify-w2-card.mjs
   PASS CV-01 … PASS CV-08 … PASS CV-10 —— ℹ pass 34，ℹ fail 0
   PASS CV-09 回归门：全量测试失败为 0 — 测试 277 项，失败 0 项（G-RG01-cap 13284.2ms）
   任务门 PASS｜回归门 PASS｜伪成功扫描 未发现｜结论：未达标（待用户拍板：R-C2 …）
   VERIFY_EXIT=0
   results.json: "git_head": "7c2780a…", "dirty": false, "verdict": "未达标"

   $ git diff --stat
    evidence/CV-01.log … CV-07.log、CV-08-{card,cover,list,quote}.json、CV-08.log、CV-09.log、CV-10.log、results.json
    15 files changed, 361 insertions(+), 361 deletions(-)
   （内容只有时间戳、git_head、耗时变化；real-font/ 没有 diff）

   $ git checkout -- docs/verification/w2/card && git clean -fd docs/verification/w2/card/evidence
   $ git status --porcelain   →（空）
   ```

4. 锁定时序和夹具完整性：

   ```
   $ git log --format='%h %ad %s' --date=iso
   fe5d794 2026-10-26 08:47:21 +0800 AUDIT_CARD 整改：…
   bef874a 2026-10-26 08:34:25 +0800 AUDIT_CARD 整改：先锁定复现夹具和回归测试…
   $ git merge-base --is-ancestor bef874a fe5d794  →  exit=0
   $ cd test/fixtures/w2-card-audit && shasum -a 256 -c MANIFEST.sha256
   34 行全部 OK（C00–C29、C12-text.svg、C13-icon.svg、_gen.mjs、expect.json）   MANIFEST_EXIT=0
   $ git diff --stat bef874a..HEAD -- test/
    test/card-audit.test.js | 2 +-     （只有 RULING-09 那一行）
   ```

5. RULING-09 复现（`/tmp` 下解出 `git archive bef874a`，复用仓库的 node_modules，用 tsc 构建）：

   ```
   锁定版测试，跑在 bef874a 代码上：AssertionError: 错误：配置文件 …/measure.config.json 的 schema_version 应为 "1.0.0"
   HEAD 版测试，跑在 bef874a 代码上：AssertionError: 错误：font_dir 不存在：fonts
   HEAD 版测试，跑在 HEAD 代码上：  ✔ … (1154.9ms)  ℹ pass 1  ℹ fail 0
   ```

6. CA-07 变异测试复跑（`/tmp` 下的 HEAD 副本，逐行把 `throw new UsageError(` 换成 `void (`）：

   ```
   mutate line 47 -> ℹ fail 1
   mutate line 50 -> ℹ fail 1
   mutate line 67 -> ℹ fail 1
   mutate line 105 -> ℹ fail 1
   mutate line 110 -> ℹ fail 1
   mutate line 0 (不改) -> ℹ fail 0
   ```

7. Playwright 类型核对：

   ```
   playwright-core 1.64.1
   types.d.ts:11083 export interface Browser {          （没有 process()）
   types.d.ts:20715 export interface BrowserServer {    （第 45 行：process(): ChildProcess;）
   ```

临时文件都放在 `/tmp/cardr2/`，用完已经删除。仓库里只新增了本文件。

---

## 8. 给执行方的下一轮要求

1. **CB-01：** 先锁定夹具，再把变化检测提前到 `afterLoad`。或者交给下一轮对抗复核，由它证实这条无法利用。
2. **CB-02：** 补 embed、CSS 引用的 SVG 两个夹具；改正矩阵里 CA-01 的覆盖说明。
3. **CB-03：** 浏览器测试限制并发；验证日志记下负载；压力测试脚本放进仓库，保留完整输出。
4. **CB-04：** 改正报告 §2.1 的 K-01、K-04；删掉死代码 `SVG_TEXT`。
5. **§5.2 条件 1：** 补上「关闭超时之后没有残留浏览器进程」的证据。
6. **登记：** `RULINGS.md` 里 RULING-09 照录本文 §5.4。
7. **R-C2：** 由用户拍板。之后在干净工作树上重跑 `verify-w2-card.mjs`，再交下一轮复核（建议包含对抗复核）。
