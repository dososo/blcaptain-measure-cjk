# W2 完整档（`lint --render`）审计报告 · AUDIT_RENDER

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」 |
| 审计方 | Claude Code（独立会话，不采信执行方自述，以代码、命令输出、git 历史为准） |
| 审计对象 | `9e41dc9`（锁定夹具和测试）→ `da754c1`（实现）→ `455ffe9`（报告）→ `50a95d5`（验证结果）；审计时 HEAD = `50a95d5` |
| 契约 | `docs/PRD.md` §5.1、§5.3（A01、A11）、§5.4、§7.2、§7.3、§10、§11（AC-2、AC-6、AC-7）；执行方提案 `docs/verification/w2/PRD_RENDER_PROPOSAL.md`（未获用户确认） |
| 审计日期 | 2026-10-25 |
| 审计方改动 | 只新建本文件。所有对抗性页面放在会话临时目录，跑完已删除；仓库 `git status --porcelain` 为空 |

---

## 1. 结论

**未达标。**

结论由两部分组成，分开写：

### 1.1 流程性原因（与代码质量无关）

R-D1、R-D2 两项 PRD 变更尚未经用户拍板。按项目规则（`open_decisions.json` 里 `blocks_verdict: true` 且未 resolved），这一条本身就让结论为「未达标」。执行方的 `results.json` 也如实判了「未达标」。

### 1.2 实质原因（即使 R-D1、R-D2 获批，仍然未达标）

审计发现 **1 条 Blocker、6 条 High**，都有可复现的真实输出（见 §2）：

| 严重度 | 条数 | 编号 |
|---|---|---|
| Blocker | 1 | RA-01 |
| High | 6 | RA-02 至 RA-07 |
| Medium | 6 | RA-08 至 RA-13 |
| Low | 8 | RA-14 至 RA-21 |

**必改清单（全部落实并复核通过后，才可能转为「有条件达标」或「达标」）：**

1. RA-01：截图文件名来自页面可控的数据，可以写到工作区外。
2. RA-02：测量函数在页面主环境里执行，页面脚本能把基础档的 error 「洗」成通过。
3. RA-03：本地文件页面的中文由脚本生成时，结果为「跳过」，退出码 0。
4. RA-04：完整档看不见的中文元素（加载时隐藏、折叠的 `<details>`、`display: contents`）被静默丢掉，基础档的 error 随之消失，结果为通过。
5. RA-05：页面加载后跳转到另一个页面，完整档测的是跳转后的页面，原页面的问题全部丢失。
6. RA-06：URL 页面返回 404、500 时不算打不开，404 页面结果为「跳过」，退出码 0。
7. RA-07：T06 没有浮点容差，`line-height: 1.5` 配非整数字号时误报 error；RV-13 里 claude-code 组 9 条 T06 error 全部是这个误报。
8. 报告更正（RA-13），并把 `test/cli.test.js`、`scripts/verify.mjs` V-07 的改动登记进 RULINGS（见 §3 第 5 条）。
9. 用户对 R-D1、R-D2 拍板。另外两个新出现的决策见 §5。

Medium、Low 项可以作为「有条件达标」的条件逐条处理，但每条都要在审计响应矩阵里回应。

---

## 2. 发现清单

复现用的页面都是审计方写的临时文件，下文给出关键内容。命令中的 `CLI` 指 `node packages/cli/bin/measure-cjk.js`，`runRender` 指 `packages/cli/dist/index.js` 导出的函数（`npm run build` 之后）。

### RA-01 · Blocker · 截图文件名来自页面可控数据，可以写到工作区之外

- **位置：** `packages/cli/src/render.ts:224-225`（`name = \`${rule}-...png\``、`atomicWrite(join(ctx.evidence.path, name))`）；`render.ts:314`（`page.evaluate(measurePage)` 的返回值不做任何校验，直接 `as` 成 `ProbeItem[]`）；`render.ts:340`。
- **问题：** `measurePage` 在页面主环境里执行，它的返回值（`rule`、`severity`、`idx`、`selector`、`message`）完全可以被页面脚本改写。Node 一侧拿 `it.rule` 直接拼截图文件名，没有白名单，也没有检查拼出来的路径是否还在截图目录里。
- **为什么是问题：** 违反 PRD §5.4「不得读取工作区以外的文件」和用户硬规则「路径校验用 realpath」的同一安全边界：一个被检查的 HTML 文件可以让校验器往工作区外写文件。文件名后缀固定为 `-NNN.png`、内容是截图，但目录可任意上跳。
- **复现：** 页面里放一段脚本，改写 `Array.prototype.push`，把推入的对象的 `rule` 改成 `../../PWNED`、`severity` 改成 `error`：

  ```html
  <script>
  const op = Array.prototype.push;
  Array.prototype.push = function (...a) {
    for (const o of a) if (o && typeof o === "object" && "rule" in o && "idx" in o) { o.rule = "../../PWNED"; o.severity = "error"; }
    return op.apply(this, a);
  };
  </script>
  ```

  工作区是 `<tmp>/ws`，截图目录是 `<tmp>/ws/evidence`，调用 `runRender({ inputs: ["trav.html"], root: ws, widths: [1280], evidenceDir: ws/evidence })`。真实输出：

  ```
  == trav.html static: fail T07 | render: fail [["../../PWNED","error","../PWNED-001.png"]]
  base listing: [ 'PWNED-001.png', 'ws' ]
  ```

  `PWNED-001.png` 落在工作区的上一级目录。
- **修法：**
  1. Node 一侧校验 `page.evaluate` 的返回值：`rule` 必须在 `{T02,T04,T05,T06,T07,T08,T11,T12,A01,A11}` 白名单里，`severity` 只能是 `error` / `warn`，`idx` 必须是非负整数，`selector`、`message` 限长；不合格的条目丢弃并记进 `sheet_errors`，同时把这一页记为 `incomplete`。
  2. 截图文件名只用白名单内的规则 ID 和计数器；写之前再算一次 `resolve(evidence.path, name)`，确认 `dirname` 等于 `evidence.path`。
  3. 先补一个失败的测试（页面改写 `Array.prototype.push`），确认工作区外没有新文件、结果为 `incomplete`。

### RA-02 · High · 测量在页面主环境执行，页面脚本能让完整档把基础档的 error 洗成通过

- **位置：** `render.ts:314`（`page.evaluate(measurePage)`）、`render.ts:296`（`snapshotPage` 同样在主环境）、`render.ts:380-386`（`mergePage` 用完整档结果整体取代基础档的 T02、T04–T07、T11）。
- **问题：** 页面脚本可以改写 `getComputedStyle`、`Range.prototype.getClientRects`、`Element.prototype.checkVisibility`、数组方法等，测量结果随它说。完整档又会把基础档同类规则的结果整块删掉，所以基础档本来能发现的 error 也一起消失。
- **为什么是问题：** PRD §5.4「页面内容一律当作不可信数据」。执行方在报告 §5.1 里披露了「页面脚本可以干扰测量」，但没有说明后果是「完整档比基础档更容易被绕过」：同一个文件，基础档退出码 1，完整档退出码 0。项目的北极星指标要用完整档计算（PRD §4.1），这条直接影响指标可信度。
- **复现：** 页面样式 `.bad { letter-spacing: -2px; font-size: 10px; }`，页面里把 `getComputedStyle` 包一层 Proxy，对 `letterSpacing`、`fontSize`、`lineHeight` 返回假值。

  ```
  $ CLI lint launder.html
  ✗ T07  launder.html:8  main > p.bad   中文字距为负（-2.00px）……
  ✗ T11  launder.html:8  main > p.bad   中文字号 10.0px，小于 12px……
  未通过：1 个文件（含中文 1 个），2 个 error，1 个 warn。
  static exit=1

  $ CLI lint launder.html --render --widths 1280
  通过：1 个文件（含中文 1 个），0 个 error，0 个 warn。完整档：在 1280px 宽度下实测……
  render exit=0
  ```
- **修法：** 把 `measurePage`、`locateElement`、`snapshotPage` 放进隔离环境执行：用 `context.newCDPSession(page)` 调 `Page.createIsolatedWorld` 拿到 `executionContextId`，再用 `Runtime.evaluate({ expression: "(" + measurePage + ")(" + JSON.stringify(opts) + ")", contextId, returnByValue: true })`。隔离环境里的全局对象和原型链与页面脚本分开，页面改写不了 `getComputedStyle` 和 `Range`。元素登记表（`__measureCjkElements`）也放在隔离环境里。配合 RA-01 的返回值校验。补测试：上面的 launder 页面在完整档下必须报 T07、T11。

### RA-03 · High（伪成功）· 本地文件页面的中文由脚本生成时，结果为「跳过」，退出码 0

- **位置：** `render.ts:417-434`。`hasCjk` 只由基础档对**源文件**的静态解析决定（`lintPageInto` 的返回值），`render.ts:434` 只有 `hasCjk` 为真时才合并完整档结果。
- **问题：** 构建产物里常见的单页应用（`<div id="root"></div>` 加脚本渲染），源码里没有汉字，基础档判定「没有中文」；浏览器里其实渲染出了中文，完整档也测到了问题，但结果被丢掉，整体状态是 `skipped`，退出码 0。
- **为什么是问题：** PRD §5.4 让 React、Vue 用户「对产物（比如 `dist/`）跑」；完整档存在的意义之一就是能看到脚本渲染后的页面。这是「输入没检查完却返回 0」。
- **复现：**

  ```html
  <body><div id="root"></div>
  <script>document.getElementById("root").innerHTML =
    '<p style="letter-spacing:-2px;font-size:10px">脚本渲染出来的中文段落，字距为负，字号十像素。</p>';</script></body>
  ```

  真实输出：`== spa.html | static: skipped [] | render: skipped []`
- **修法：** 本地文件页面也用浏览器里的 DOM 快照判断有没有中文（URL 页面已经这样做）；或者以 `measurePage` 返回的「含中文元素总数」为准。只要浏览器里有中文而源码里没有，就按 DOM 快照跑基础档规则（不带行号），并在结果里注明。补测试：上面的 spa 页面必须报 T07、T11 error，退出码 1。

### RA-04 · High（伪成功）· 完整档看不见的中文元素被静默丢掉，基础档的 error 随之消失

- **位置：** `probe.ts:66-73`（`visible` 过滤）、`probe.ts:82`、`render.ts:380-386`（`mergePage` 整块删除基础档的 T04–T07、T11）；`ProbeResult.elements` 已经算出来了，Node 一侧从来不看。
- **问题：** 完整档只测「当前可见」的元素；基础档能检查的元素，只要完整档没看到，它的 error 就被 `mergePage` 删掉，又没有任何东西补上。常见的非恶意场景：
  1. 防闪烁写法：`html.loading body { visibility: hidden }`，脚本稍后去掉 `loading`（webfont 加载器常用）。加载完成时整页都不可见，完整档测到 0 个元素，结果「通过」。
  2. 折叠的 `<details>` 里的正文（FAQ 页面很常见）。
  3. `display: contents` 的元素（没有盒子，`checkVisibility` 返回 false，但文字照样显示、照样继承字距）。
- **为什么是问题：** 同一个页面基础档退出码 1，完整档退出码 0；结果里没有任何「没测到」的提示。
- **复现 1（防闪烁）：**

  ```
  $ CLI lint fouc.html          → ✗ T07、✗ T11，static exit=1
  $ CLI lint fouc.html --render → 通过：1 个文件（含中文 1 个），0 个 error，0 个 warn。render exit=0
  ```

  页面关键内容：`html.loading body { visibility: hidden; } .bad { letter-spacing: -2px; font-size: 10px; }`，`setTimeout(() => document.documentElement.classList.remove("loading"), 3000)`。
- **复现 2（折叠和 `display: contents`）：** `<details><summary>展开</summary><p class="neg">折叠内容里的中文，字距为负。</p></details><span class="neg" style="display:contents">显示为内容的中文，字距为负</span>`，`.neg { letter-spacing: -2px }`。真实输出：`== hidden.html | static: fail [["T07","error"],["T07","error"]] | render: pass []`。
- **修法：**
  1. 覆盖校验：基础档有中文元素、而完整档在所有宽度下可见的中文元素都是 0 时，这一页记为 `incomplete`（原因写清「渲染后没有可见的中文」），不能判通过。
  2. 按元素合并，而不是按规则整块替换：基础档报了 error、但完整档在任何宽度下都没测到的元素（按选择器对应），保留基础档那条，并在消息里注明「完整档未测到（元素不可见）」。
  3. `display: contents` 的元素改用它的文字节点的 `Range` 判断可见性。
  4. 每一种情况各补一个测试。

### RA-05 · High（伪成功）· 页面加载后跳转，完整档测的是另一个页面

- **位置：** `render.ts:293`（`page.goto(..., { waitUntil: "load" })` 之后不检查当前地址）、`render.ts:244-276`（路由拦截不区分主框架的二次导航）。
- **问题：** 页面脚本 `location.replace("clean.html")`（或 `<meta http-equiv="refresh">` 指向工作区内的页面）之后，完整档测量的是 `clean.html`，但结果记在原页面名下；原页面的 T04–T07、T11 被 `mergePage` 删掉。语言切换、旧地址重定向这类页面不需要恶意也会触发。
- **复现：** `redir.html` 里有 `<p style="letter-spacing:-2px;font-size:10px">坏页面……</p>` 和 `<script>location.replace("clean.html")</script>`。真实输出：

  ```
  == redir.html | static: fail [["T05","warn"],["T07","error"],["T11","error"]] | render: pass []
  ```
- **修法：** 在路由处理里拦截主框架的第二次及以后的导航请求（`route.request().isNavigationRequest() && frame === page.mainFrame()`，第一次之后一律 `abort`），并把这一页记为 `incomplete`，原因写「页面在加载后跳转」；每次 `measurePage` 前后都核对 `page.url()` 等于目标地址。补测试。

### RA-06 · High（伪成功）· URL 页面返回 404、500 不算打不开

- **位置：** `render.ts:293`，`page.goto` 的返回值（响应）没有检查 `status()`。
- **问题：** R-01 只修了「连不上」的情况。开发服务器上路径写错时返回 404，页面正文通常没有中文，结果是 `skipped`、退出码 0；返回 500 而错误页恰好有中文时，测的是错误页。
- **复现：** 本机起一个 `127.0.0.1` 服务，`/404` 返回 404 和 `Not Found`，`/500zh` 返回 500 和一个中文错误页。真实输出：

  ```
  == URL /404 status: skipped skipped: [] findings: 0
  == URL /500zh status: pass skipped: [] findings: 0
  ```
- **修法：** `const resp = await page.goto(...)`；`resp` 为空或 `resp.status() >= 400` 时记为 `unreadable`（原因里写 HTTP 状态码），整体 `incomplete`、退出码 2。补测试：404 和 500 各一个。

### RA-07 · High · T06 没有浮点容差，`line-height: 1.5` 被误报为「低于 1.5」

- **位置：** `probe.ts:189-190`：`lh = parseFloat(cs.lineHeight) / fs; if (lh < o.lineHeightMin) add("T06", "error", ...)`。同一文件里 T11 用了 `- 0.01`、T06 的 warn 区间用了 `± 0.005`，唯独这里没有。
- **问题：** 浏览器给出的计算值是四舍五入后的像素值，字号带小数（`vw`、`cqw`、`rem`、`clamp()`）时，`1.5` 算出来会是 `1.4999999999999998`。PRD §5.1 的口径是「正文低于 1.5 是 error」，等于 1.5 不应报 error。
- **为什么是问题：** 完整档在合规页面上给出 error，退出码 1；基础档同一页面退出码 0。RV-13 的 claude-code 组里，T06 的 9 条 error（026、029 两页）全部是这个误报：`026/output/style.css:114` 和 `029/output/index.html:84` 都写的是 `line-height: 1.5`。
- **复现：**

  ```
  页面：p { font-size: 4.3vw; line-height: 1.5 }
  $ CLI lint lh_4_3vw.html --render
  lh_4_3vw.html fail [ 'error 360 正文行高 1.50（计算值 23.22px ÷ 字号 15.48px），低于 1.5。……' ]
  $ CLI lint lh_4_3vw.html → static exit=0

  RV-13 重跑（claude-code 组）：
  026/output/index.html T06 360 … > p | 正文行高 1.50（计算值 13.671px ÷ 字号 9.114px），低于 1.5。
  029/output/index.html T06 360 … > p.why | 正文行高 1.50（计算值 12.1283px ÷ 字号 8.08556px），低于 1.5。
  $ node -e 'console.log(13.671/9.114)'  →  1.4999999999999998
  ```
- **修法：** 改成 `if (lh < o.lineHeightMin - 0.005)`，和 warn 区间的容差一致；`lh.toFixed(2)` 的显示保持不变。补测试：`font-size: 4.3vw; line-height: 1.5` 不报 T06 error。修好后重跑 RV-13，更新报告 §3 的规则命中数。

### RA-08 · Medium · T05 把多栏排版里同一高度的几栏当成一行，误报 error

- **位置：** `probe.ts:99-118`（`lineWidths` 只按垂直中线把矩形归成一行，取最左到最右）。
- **问题：** `column-count: 2` 的正文，每栏约 30 字，两栏同一高度的文字被并成一行，算出 62 字。报刊类主题（PRD §5.3「报刊 Broadsheet：栏线」）很可能用到多栏。
- **复现：** `.cols { column-count: 2; column-gap: 32px; width: 1000px }`，段落为 16px。真实输出：`== columns.html | static: pass [["T05","warn"]] | render: fail [["T05","error","实测：在 1440px 宽度下，正文最长一行约 62 个字（行宽 996px ÷ 字号 16px），超过 45。……"]]`。
- **修法：** 归行时同时要求水平方向连续：同一中线上的矩形之间出现大于 1 个字号的空隙时拆成两段，取最宽的一段；或者先读 `columnCount`，不是 `auto` 时按栏宽计算。补测试。

### RA-09 · Medium · 完整档里有 error 没有截图（F03）

- **位置：** `render.ts:405`（`.css` 输入只做 `lintCssFile`，没有截图）；`lint.ts:90-97`（去重时先到先得，`.css` 文件那条在前，页面那条带截图的被去掉）。
- **问题：** PRD §5.4「每条 error 截一张元素级的截图」，AC-7「每条 error 都有截图」。目录里同时有页面和它引用的 CSS 时（`bench/golden/` 就是这种结构），F03 error 没有截图。
- **复现：** `font.css` 里自托管「方正兰亭黑」，`page.html` 引用它。真实输出：

  ```
  inputs [ '.' ]         status fail [["F03","font.css","NO-EVIDENCE"]]
  inputs [ 'font.css' ]  status fail [["F03","font.css","NO-EVIDENCE"]]
  inputs [ 'page.html' ] status fail [["F03","font.css","evidence/F03-001.png"]]
  ```
- **修法：** 去重时优先保留带 `evidence` 的那条；只有 CSS、没有页面可截图时，在 PRD 提案里写明例外（例如 `evidence` 留空并在消息里注明「样式表本身没有可截图的页面」），并让测试的 `assertEvidence` 覆盖这种情况。

### RA-10 · Medium · T07 的 Tailwind 类名启发式在完整档里制造误报

- **位置：** `probe.ts:196-206`。
- **问题：** 完整档已经拿到计算后的字距，计算值 ≥ 0 时仍然因为祖先上有 `tracking-tight` 类名报 error。子元素用 `tracking-normal` 改回来的写法会被误报。基础档用启发式是因为算不出层叠；完整档没有这个理由。
- **复现：** `<main class="tracking-tight"><p class="tracking-normal">中文段落，字距已经改回正常。</p></main>`，样式里 `.tracking-tight { letter-spacing: -0.025em } .tracking-normal { letter-spacing: 0 }`。真实输出：`tw.html [["T07","error",5,"main.tracking-tight > p.tracking-normal","中文元素带有 Tailwind 类 tracking-tight（负字距），汉字"]]`。
- **修法：** 完整档只在「样式没有加载」时才用类名启发式（例如页面上找不到任何声明 `tracking-` 类的样式规则，或计算值恰好等于浏览器默认值且类名存在时降为 warn）；计算值 ≥ 0 时不报 error。锁定夹具 `R-T07-neg-tailwind-class` 没有加载 Tailwind 样式，仍然应该报，所以这一改动不影响现有预期。

### RA-11 · Medium · T05 的「每行字数」口径偏离 PRD 原文

- **位置：** `probe.ts:173-180`（`chars = 行宽 ÷ 字号`）；PRD §5.4「用 `Range.getClientRects()` 统计每行的**汉字数**」，§5.1 T05「每行 28–40 个汉字」。
- **问题：** 行宽 ÷ 字号是「等宽汉字的个数」。中英混排、带行内代码的行，按这个算法会明显偏高。例：RV-13 重跑中 `019/output/index.html` 的 `p:nth-of-type(2)`，报「约 58 个字」，截图（审计方查看了 `T05-013.png`）上这一行实际约 27 个汉字，其余是英文单词和带内边距的 `code`。
- **为什么是问题：** 执行方在 PRD_RENDER_PROPOSAL 改动 2 里写了新口径，但没有在报告里把它列为「对 PRD 语义的改动」；用户拍板 R-D1 时可能没意识到这一点。
- **修法：** 二选一，由用户决定（见 §5 D-A1）：① 按 PRD 原文统计每行的汉字个数（逐字取矩形归行，或按行分段后数 `\p{Script=Han}`）；② 保留「行宽 ÷ 字号」，在提案里单列为口径变更，并在消息里改说「约 N 个字宽」。

### RA-12 · Medium · A01 漏掉蓝到靛蓝的渐变和伪元素上的渐变

- **位置：** `probe.ts:261`（色相 250°–320°）、`probe.ts:264`（只检查元素本身，不检查 `::before`、`::after`）。
- **问题：** PRD 原文是「紫色渐变、**蓝紫渐变**背景」。Tailwind 的 `from-blue-500 to-indigo-600`（`#3b82f6 → #4f46e5`，色相约 217°、243°）、`indigo-500 → indigo-700`（约 239°、245°）都不报；hero 区用 `::before` 铺渐变的常见写法也不报。
- **复现：** 真实输出：`g1.html A01: []`（`#3b82f6, #4f46e5`）、`g2.html A01: []`（`#6366f1, #4338ca`）、`g5.html A01: []`（`.hero::before { background: linear-gradient(135deg,#7c3aed,#c026d3) }`）；对照 `g3.html`（`#2563eb, #7c3aed`）、`g4.html`（`#667eea, #764ba2`）能报。
- **修法：** 色相下限放到约 230°，或增加「同一渐变里同时有蓝（200°–250°）和紫（250°–320°）」的判断；对 `getComputedStyle(el, "::before")`、`"::after"` 也做同样检查。各补一个夹具（写于实现之后，按规矩登记）。

### RA-13 · Medium · 验证报告的数字和结论与证据不符

- **位置：** `docs/verification/w2/render/VERIFICATION_REPORT.md` §1、§3、§6。
- **问题：**
  1. §3 表格写 codex「51 秒」、claude-code「22 秒」，第 4 条写「每页约 1.7 秒、0.7 秒」；已提交的 `evidence/RV-13.json` 和 `RV-13.log`（`50a95d5` 重跑）是 46.8 秒、18.6 秒。报告没有随重跑更新。
  2. §3 第 1 条「抽查了 T05、T06、T07、T11 的前 40 条……都符合规则定义，没有发现误报」：审计方重跑 claude-code 组，T06 的 9 条新增 error 全部是 RA-07 的误报。
  3. §1、§6「伪成功扫描：未发现」：扫描只是 grep 关键字，RA-03 至 RA-06 四条伪成功路径都没有被它覆盖。这个结论需要限定为「关键字扫描未发现」。
  4. RV-13 的判定条件只看「60 页都检查完」，不检验结果是否正确，却作为 PASS 写进任务门。
- **修法：** 修完 RA-01 至 RA-07 后重跑 `verify-w2-render.mjs` 和 `render-compare.mjs`，报告中的数字一律从 `RV-13.json` 读取；第 1 条抽查结论改为附上抽查清单（文件、选择器、截图、判定）；伪成功扫描写明方法的局限；RV-13 的描述改为「完成度检查」，不再暗示结果正确。

### RA-14 · Low · 「另有 N 处，已省略」把同一元素按宽度重复计数

- **位置：** `render.ts:323-326`、`351-354`。超出 20 条上限的元素不进 `merged`，每换一个宽度会再被数一次，所以 N 最多被放大 6 倍。RV-13 重跑中 codex 组 `012/output/index.html` 报「同一条规则在本页另有 30 处」。
- **修法：** 用一个 `Set` 记录被省略的 `rule|selector`，最后报 `Set` 的大小。

### RA-15 · Low · T04 的「实测」消息可能被吞掉

- **位置：** `probe.ts:168`、`probe.ts:222` 与 `render.ts:317-321`。同一元素在较早的宽度先被「line-break 不是 strict」那条占了键 `T04|selector`，后面宽度里「标点实测落在行首」的那条因为严重度相同被跳过，用户看不到实测证据。
- **修法：** 合并时，同一严重度下优先保留带「实测」的消息；或把两类 T04 用不同的键。

### RA-16 · Low · 脚本插入元素后，行号缺失或指向别的元素

- **位置：** `render.ts:335`、`render.ts:424-428`。完整档的选择器来自浏览器 DOM，行号表来自源码；脚本插入同类元素后 `:nth-of-type` 序号整体偏移。复现：页面末尾的脚本 `prepend` 一个 `<p>`，原来的 `p.small:nth-of-type(3)` 变成 `nth-of-type(4)`，T11 error 没有行号（`["T11","error",null,"main > p.small:nth-of-type(4)",…]`）；没有 class 时会对上另一个段落的行号。
- **修法：** 本地文件页面在 `page.goto` 之后、页面脚本运行之前（`addInitScript` 或 `DOMContentLoaded` 前）给每个元素记下源码顺序号，用它对应行号；对不上时不给行号，而不是给错的。

### RA-17 · Low · 文字都在行内元素里的段落，T05、T06 都不测（与基础档相同）

- **位置：** `probe.ts:79`、`probe.ts:173`（只看直接子文本节点的汉字数）。`<p style="line-height:normal"><span>（很长的中文）</span></p>`：基础档、完整档都是 `pass []`。
- **修法：** 完整档里，`p`、`li` 的判定改用 `ownText(el)` 的汉字数（它已经写好了）。这是对基础档语义的偏离，需写进提案。

### RA-18 · Low · 页面文字原样进入消息，可带终端控制字符

- **位置：** `probe.ts:164`（T04 消息引用页面原文）、`cli.ts` 的 `formatLintText`。`\x1b` 不是空白字符，`replace(/\s+/g, " ")` 去不掉，文本格式直接打到终端。结果也会被 agent 读取，页面原文混在「修法」附近。
- **修法：** 引用页面原文前去掉 `\p{Cc}` 并限长，用「」括起来；文本格式输出前统一转义控制字符。

### RA-19 · Low · 本地文件页面的导航类请求会和 localhost 建立 TCP 连接

- **位置：** `render.ts:147-148`（`EXCLUDE localhost`、代理 `bypass` 对所有页面生效）。
- **现象：** 审计方用一个只计数的本机服务测试了 19 种外发方式。所有 HTTP 请求都被拦住（请求数 0），但 `<iframe>`、`<object>`、`window.open`、表单提交、`<meta refresh>` 这 5 种各建立了 1 个 TCP 连接（没有发送 HTTP 数据）。R-D2 的意图是「检查本地文件时不允许访问 localhost」，连接层面没有完全做到。
- **修法：** 输入里只有本地文件时，启动浏览器不排除 localhost（`MAP * ~NOTFOUND` 不加 EXCLUDE，代理不加 bypass）；有 URL 输入时，本地文件和 URL 用两个浏览器实例分别检查。

### RA-20 · Low · 测试缺口

- **位置：** `test/fixtures/w2-render/expect.json`、`test/w2-render.test.js`。
- **问题：** ① 没有 T02 完整档的反例夹具（`text-autospace: no-autospace` 计算值），完整档 T02 的代码路径没有被任何断言覆盖；② 没有边界值夹具（`line-height: 1.5` 配小数字号、T05 恰好 45/46 字）；③ 没有「页面改写测量结果」的对抗测试；④ `assertEvidence` 只检查文件存在且是 PNG，不检查截图是否框住了对应元素（至少应核对 PNG 宽高与元素矩形大致一致）。
- **修法：** 按「先写失败测试、单独目录锁定、登记写于实现之后」的规矩补上。

### RA-21 · Low · 测试文件引用了不存在的文档

- **位置：** `test/w2-render-review.test.js:1` 注释写「见 docs/verification/w2/REPORT_RENDER.md」，该文件不存在，实际报告是 `docs/verification/w2/render/VERIFICATION_REPORT.md`。
- **修法：** 改正路径。

### 审计方核对过、没有发现问题的部分

- 工作区外的 `file://`（绝对路径、相对路径上跳、指向工作区外的文件和目录的符号链接）、`.git` 里的文件、超过 5 MB 的文件：都被拦截并记入 `skipped_inputs`；`<base href>` 指向远程、`@import` 远程样式：被拦截并记入 `remote_refs`。
- 本地文件页面对 localhost 的 19 种外发方式（prefetch、preload、modulepreload、sendBeacon、keepalive fetch、EventSource、WebSocket、Worker、`@import`、`@font-face`、`<video>`、ping 等）：服务端收到的 HTTP 请求数为 0（TCP 连接见 RA-19）。
- 超时：死循环页面在 2 秒预算下返回 `incomplete`，整个进程 4.8 秒退出，退出后没有残留的 Chrome 进程。
- 截图目录：已有目录是符号链接、在工作区外时，都会在启动浏览器之前被拒绝（执行方的测试覆盖，审计方重跑通过）；`.git` 的排除、新建目录时 `ensure()` 用 `lstat` 再检查一次，审计方只做了代码核对，没有专门复现。
- `localhost`、`app.localhost`、`127.0.0.1` 三种写法都能正常渲染。
- 选择器写法：`probe.ts` 的 `selectorOf` 与 `model.ts` 的 `selectorOf` 逐行对照，规则一致（差异只来自浏览器 DOM 与 htmlparser2 解析树的不同，以及 RA-16 的脚本改动）。
- 抽查 RV-13 背后的截图：`T05-001.png`、`T07-003.png`、`T11-011.png`、`T05-013.png` 的红框都框对了元素。

---

## 3. 对执行方「需要审计方裁定的问题」（报告 §7）的裁定

| 编号 | 问题 | 裁定 | 理由 |
|---|---|---|---|
| 1 | RULING-04：锁定后改了 `test/w2-render.test.js` 两处 | **同意，未放宽** | ① `captureAsync` 在异步测试里替换 `process.stdout.write`，会截走 node:test 子进程写往父进程的上报，执行方描述的「3 个测试从报告里消失」与机制吻合；改成子进程跑真实的 `bin/measure-cjk.js` 之后，各测试的断言条件（退出码、stderr 内容、JSON 字段）逐条对照 diff 没有变化，而且测的是真实入口，比原来更严。② `summary.files === 20` 改为 `summary.cjk_files === 20`：`bench/golden/` 里确有 `site.css`（`RV-01.json` 中 `files: 21`），新断言要求 20 个页面都被识别为含中文，强度不低于原断言；「有 error 的页面 ≤ 1」不变。请执行方把本裁定原样照录进 RULINGS 的状态栏。 |
| 2 | R-01、R-02 先修后补测试，修复前证据来自在 `dist` 里临时撤掉修复 | **有条件接受** | 两个回归测试现在都在，审计方重跑通过，并验证了它们确实能抓住对应问题（死端口 → `incomplete`、退出码 2）。条件：把撤掉修复用的补丁和命令写进 `evidence/`（现在只有结果，没法复现「撤掉」这一步）。另外，R-01 只修了「连不上」，HTTP 404、500 仍是伪成功，见 RA-06。 |
| 3 | 合并口径：完整档取代基础档的 T02、T04–T07、T11，是否漏掉基础档能发现的问题 | **不同意现状** | 取代的方向可以接受，但目前是按规则整块替换，没有覆盖校验，确实漏掉了基础档能发现的问题：完整档看不见的元素（RA-04）、源码没有中文的页面（RA-03）、页面跳转（RA-05）、页面脚本改写测量（RA-02）。Tailwind 类名启发式在页面里照样执行，但它反过来制造了误报（RA-10）。要求按 RA-04 的修法改成「按元素合并 + 覆盖校验」。 |
| 4 | §3 第 1 条「新增的 error 符合规则定义」只基于 40 条按计算值的抽查 | **抽查结论不成立** | 审计方重跑 claude-code 组，新增的 T05、T06、T07、T11 error 共 126 条：T07 6 条全部属实（标题上的 `-0.01em`，基础档因 `clamp()` 算不出像素而漏报）；T11 98 条，看了 1 张截图并核对 3 个页面的计算值，属实；T05 13 条，看了 2 张截图，行宽属实，但口径问题见 RA-11；**T06 9 条全部是误报**（RA-07）。codex 组的 T06 新增 error 审计方只核对了消息（都是「没有设置行高、实测折成 2–3 行」），没有看截图。 |
| 5 | W1 的 `test/cli.test.js`、`scripts/verify.mjs` V-07 改成 W2 版 AC-6 | **同意，附条件** | PRD §10 写明 W1 版 AC-6 是「`--render` 返回退出码 2」，W2 版是 §11 的 AC-6，替换符合 PRD。条件：① 这是对已锁定的 W1 测试和验证脚本的修改，按台账规矩要登记（建议 RULING-05），目前只写在报告里；② 新测试名「`--render` 走完整档」名不副实，它只测了两条出错路径（`--widths abc` 同步返回 2，截图目录在工作区外异步返回 2），请改名为「`--render` 的参数校验走完整档的异步路径」，或补一条能成功渲染的断言。 |

---

## 4. 审计方亲自运行的命令和关键输出

全部在本机运行（系统 Chrome 155.0.8059.86，playwright-core 1.64.1），没有联网，没有安装依赖，没有运行 `bench/run-baseline.mjs`。

1. **构建和全量测试**

   ```
   $ cd measure-cjk && npm run build && npm test
   ℹ tests 173
   ℹ pass 173
   ℹ fail 0
   ℹ duration_ms 26430.813083
   EXIT=0
   ```

2. **执行方的提交和测试改动**

   ```
   $ git diff --stat 9e41dc9 da754c1 -- test/
    test/cli.test.js              | 14 ++++++----
    test/w2-render-review.test.js | 64 +++++++++++
    test/w2-render.test.js        | 47 ++++-----
   $ git diff --stat da754c1 50a95d5 -- test/ packages/ scripts/ bench/   → 无输出（报告提交没有动代码）
   $ (cd test/fixtures/w2-render && shasum -a 256 -c MANIFEST.sha256)   → 全部 OK
   ```

3. **RA-01 路径穿越**：`node poc1.mjs` → `base listing: [ 'PWNED-001.png', 'ws' ]`（详见 RA-01）。

4. **RA-02 洗白**：`CLI lint launder.html` → `static exit=1`；`CLI lint launder.html --render --widths 1280` → `通过……render exit=0`。

5. **RA-03、RA-05、RA-06、RA-08、RA-04（折叠）**：`node poc2.mjs`

   ```
   == spa.html | static: skipped [] | render: skipped []
   == redir.html | static: fail [["T05","warn"],["T07","error"],["T11","error"]] | render: pass []
   == columns.html | static: pass [["T05","warn"]] | render: fail [["T05","error","实测：在 1440px 宽度下，正文最长一行约 62 个字（行宽 996px ÷ 字号 16px），超过 45。……"]]
   == hidden.html | static: fail [["T07","error"],["T07","error"]] | render: pass []
   == inline.html | static: pass [] | render: pass []
   == URL /404 status: skipped skipped: [] findings: 0
   == URL /500zh status: pass skipped: [] findings: 0
   ```

6. **RA-04 防闪烁**：`CLI lint fouc.html` → `static exit=1`；`CLI lint fouc.html --render` → `通过……render exit=0`。

7. **RA-07 T06 边界**：`p { font-size: 4.3vw; line-height: 1.5 }` → 完整档 `fail`（`正文行高 1.50（计算值 23.22px ÷ 字号 15.48px），低于 1.5`），基础档 `exit=0`；`15.19px`、`17.3px`、`1.07rem` 三种字号只报 warn。

8. **网络拦截（file 页面 → 本机计数服务）**：`node poc3.mjs`，19 种方式的 HTTP 请求数全部为 0；`iframe`、`object`、`winopen`、`metarefresh`、`form` 各有 `conns: 1`。

9. **file:// 边界**：符号链接到工作区外、`.git/g.css`、6 MB 的 `big.css`、`file:///…/outside6/o.css`：都没有加载（页面不报 T07），`skipped_inputs` 分别记为 `outside-root`、`too-large`；`node_modules/x/n.css` 可以加载（PRD 只要求输入收集跳过 `node_modules`，这里不算问题）。

10. **RA-09 F03 无截图**：`node poc4.mjs` → `inputs [ '.' ] status fail [["F03","font.css","NO-EVIDENCE"]]`。

11. **超时和进程回收**：`MEASURE_RENDER_BUDGET_MS=2000 CLI lint R-timeout-infinite-loop.html late.html --render --widths 1280` → `status: 'incomplete'`，两页都记 `timeout`，耗时 4.8 秒；前后 `pgrep -f remote-debugging-pipe` 都是 0。

12. **RV-13 重跑（claude-code 组，复制到临时工作区后用 `runRender` 跑 6 种宽度）**：`status fail errors 230 new page-rule errors: 126`，按规则：T05 13、T06 9、T07 6、T11 98。T06 全部来自 026、029 两页，见 RA-07。codex 组同样重跑：`errors 801`，与 `RV-13.json` 的截图数一致。

13. **A01**：`#3b82f6→#4f46e5`、`#6366f1→#4338ca`、`::before` 紫色渐变均为 `A01: []`；`#2563eb→#7c3aed`、`#667eea→#764ba2` 能报。

14. **RA-10、RA-16**：`tw.html [["T07","error",5,"main.tracking-tight > p.tracking-normal",…]]`；`shift.html [["T11","error",null,"main > p.small:nth-of-type(4)",…]]`。

15. **收尾**：临时目录全部删除；`git status --porcelain` 为空，仓库里只新增本文件。

---

## 5. 需要用户拍板的事项（开放决策清单）

| 编号 | 事项 | 审计方意见 |
|---|---|---|
| R-D1 | 是否按 PRD_RENDER_PROPOSAL 改动 1–4 修改 PRD（执行方已提出） | 待 RA-01 至 RA-07 修完、提案按 RA-04（按元素合并、覆盖校验）、RA-11 更新后再批，避免把现在的整块替换口径写进 PRD |
| R-D2 | 检查本地文件时不允许访问 localhost（执行方已提出） | 同意方向；批准时一并要求做到连接层面（RA-19） |
| D-A1 | T05 的「每行字数」按 PRD 原文数汉字，还是改成「行宽 ÷ 字号」（RA-11） | 推荐按 PRD 原文数汉字。北极星指标要用完整档计算，中英混排的技术页面会被「行宽 ÷ 字号」系统性高估 |
| D-A2 | 完整档对页面脚本的态度：只靠隔离环境执行测量（RA-02 修法），还是本地文件页面默认关闭 JavaScript、需要时加参数打开 | 推荐前者：单页应用必须执行脚本才能看到内容（RA-03），关掉脚本会让完整档对这类页面失去意义 |
