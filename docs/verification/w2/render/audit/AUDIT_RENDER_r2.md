# W2 完整档（`lint --render`）第 2 轮复核 · AUDIT_RENDER_r2

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」，第 2 轮 |
| 审计方 | Claude Code（独立会话，不采信执行方自述，以代码、命令输出、git 历史为准） |
| 审计对象 | 在 `50a95d5` 之后：`155eb92`（锁定复现夹具和测试）→ `833977b`（整改）→ `8b02a57`、`d9bd0be`（报告和验证结果）。审计时 HEAD = `d9bd0be` |
| 上一轮 | `AUDIT_RENDER.md`：未达标，1 Blocker、6 High、6 Medium、8 Low |
| 审计日期 | 2026-10-25 |
| 审计方改动 | 只新建本文件。对抗页面放在 `/tmp/r2audit/`，跑完已删除；仓库 `git status --porcelain` 只多出本文件 |

---

## 1. 结论

**未达标。**

### 1.1 流程性原因（与代码质量无关）

R-D1、R-D2 两项 PRD 变更仍未经用户拍板（`open_decisions.json` 中 `resolved: false`）。按项目规则，这一条本身就让结论为「未达标」。执行方的 `results.json` 也如实判了「未达标」。

### 1.2 实质原因（即使 R-D1、R-D2 获批，仍然未达标）

第 1 轮的 21 条发现，Blocker（RA-01）和大部分 High 确实修好了，审计方用更强的对抗页面复现过，详见 §3。

但整改引入了一个新的合并机制（按元素合并），对 RA-03 的修复也只覆盖了一部分。本轮发现 **2 条 High**，都能让「基础档退出码 1」的页面在完整档下变成「通过、退出码 0」：

| 严重度 | 条数 | 编号 |
|---|---|---|
| Blocker | 0 | — |
| High | 2 | RB-01、RB-02 |
| Medium | 4 | RB-03 至 RB-06 |
| Low | 3 | RB-07 至 RB-09 |

**必改清单：**

1. **RB-01**：源码里有少量中文（例如「加载中……」占位）时，脚本渲染出来的内容不跑基础档规则（T01、T03、T09、T13），结果判通过。
2. **RB-02**：按元素合并只看选择器、不看规则，会错误删掉基础档的 error。有两种情况：选择器碰撞；完整档测到了元素，却没有检查这条规则（竖排段落的 T06）。
3. 用户对 R-D1、R-D2 拍板。

Medium、Low 可以作为「有条件达标」的条件处理，但每条都要在审计响应矩阵里回应。

---

## 2. 发现清单

复现页面写在 `/tmp/r2audit/` 下，调用 `runRender` 和 `runLint`（`npm run build` 之后的 `packages/cli/dist/index.js`）。下文的通用样式指 `:where(:lang(zh)) { line-break: strict; font-synthesis-style: none; text-autospace: normal; } body { font-family: "Inter", "PingFang SC", sans-serif; font-size: 16px } main { max-width: 36em } p, li { line-height: 1.75 }`。

### RB-01 · High（伪成功）· 源码里有占位中文时，脚本渲染的内容不跑基础档规则

- **位置：** `packages/cli/src/render.ts:538-546`。只有源码里「一个中文元素都没有」（`model.cjkElements.length === 0`）时才改用 DOM 快照。
- **问题：** RA-03 的修复只覆盖了「源码里完全没有中文」。单页应用的构建产物里，经常有中文占位，例如 `<div id="root"><p>加载中……</p></div>`。这时基础档只检查源码，也就是那一行占位；脚本渲染出来的正文完全不过 T01、T03、T09、T13、F03 这些「只有基础档检查」的规则。完整档只测 T02、T04–T08、T11 等，结果判通过。
- **为什么是问题：** 和 RA-03 是同一类伪成功。页面上实际显示的中文有 error，退出码却是 0；结果里也没有任何「没检查」的提示。
- **复现：** `spa-placeholder.html`：通用样式加上 `<div id="root"><p>加载中……</p></div>`，再加一段脚本：

  ```js
  document.getElementById("root").innerHTML =
    '<main><p style="font-family: Arial, sans-serif">脚本渲染的中文,用了半角逗号,字体栈里也没有中文字体。</p></main>';
  ```

  对照页 `dom-equivalent.html` 把同样的内容直接写进源码。真实输出：

  ```
  == dom-equivalent.html  | static: fail ["T03","T13"] | render: fail [["T03","error",…],["T13","error",…]]
  == spa-placeholder.html | static: pass []            | render: pass []
  ```

- **修法：** 本地文件页面一律用 DOM 快照跑基础档规则，源码只用来给行号。也就是按 DOM 快照建模，再用「选择器 + 文字指纹」去源码里找行号，找不到就不给。另一个可选做法：把 DOM 快照里有、源码里没有的中文元素单独再跑一遍基础档规则。补测试：上面两页的结果必须一致。

### RB-02 · High（伪成功）· 「按元素合并」只看选择器、不看规则，会错误删掉基础档的 error

- **位置：**
  - `render.ts:486-490`（`dropStatic`：基础档 error 的选择器在 `measured` 里就删）；
  - `probe.ts` 末尾 `measured = Array.from(vis).map(selectorOf)`：不分规则，只要元素可见就算「测过」；
  - `probe.ts` 的 T05、T06 循环：`if (… cs.writingMode !== "horizontal-tb") continue;`，以及 `blocks` 排除了代码块里的段落。
- **问题：** 有两种情况。
  1. **规则层面：** 元素被完整档测到了（可见），但完整档不对它检查某条规则。基础档对它的 error 照样被删。例如竖排段落：基础档按 `line-height: 1.0` 报 T06 error；完整档的 T06 只查横排，竖排的直接跳过；但这个段落在 `measured` 里，所以基础档那条被删。代码块里的 `p` 同理。第 1 轮的实现里，T06 不受横排限制，所以这是本轮整改引入的回归。
  2. **选择器碰撞：** 选择器只取 4 层。超过 4 层、结构相同的两个元素选择器一样。折叠区里有问题的元素，会因为另一个可见、没问题的同名元素被「测过」，基础档的 error 被删。手风琴、选项卡这类重复结构里很容易出现。
- **为什么是问题：** 同一页面，基础档退出码 1，完整档退出码 0。按项目路线，宋刻主题有「可选竖排」，竖排页面会直接受影响。
- **复现：**

  ```
  vertical-lh.html：<main><p style="writing-mode:vertical-rl;height:300px;line-height:1.0">竖排的中文段落，行高太小。…</p></main>
  == vertical-lh.html | static: fail ["T06"] | render: pass []

  collide.html（.x { letter-spacing: -2px; font-size: 10px }）：
    <section><details><div><div><div><p class="x">折叠里的段落，字距为负，字号十像素。</p></div></div></div></details></section>
    <section><div><div><div><p class="x" style="letter-spacing:0;font-size:16px">可见的段落，样式正常。</p></div></div></div></section>
  == collide.html | static: fail ["T07","T11"] | render: pass []
  ```

- **修法：**
  1. `measured` 改成按「规则 → 选择器」记录：只有完整档对这个元素真的做了这条规则的检查，才删基础档对应规则的结论。例如竖排段落不进 T06 的 `measured`，代码块里的段落不进 T05、T06 的 `measured`。
  2. 选择器在浏览器 DOM 或源码里不唯一时，不删除基础档结论。probe 一侧可以对每个选择器数 `querySelectorAll` 的个数，或者给 `measured` 附上文字指纹，两边都对上才删。
  3. 两种情况各补一个先失败的测试。

### RB-03 · Medium · 「加载后跳转」的拦截能被 `blob:`、`javascript:` 导航绕过

- **位置：** `render.ts:322-327`。导航拦截写在 `context.route` 里，而 `blob:`、`javascript:`、`about:` 导航不经过路由。
- **问题：** RA-05 的修法只拦截经过网络层的导航，提案第 2 版却写的是「主页面的第二次导航一律拦截」。页面在 `load` 时 `location.href = URL.createObjectURL(blob)` 或 `location.href = "javascript:…"`，完整档测的就是新文档；再加上 RB-02 的按选择器合并，基础档的 error 被删掉。
  - 跳到 `about:blank` 的情况已经被 `no-visible-cjk` 兜住，判 incomplete。
  - `document.open()` / `document.write()` 是同一文档的内容替换，测到的就是用户实际看到的内容，审计方认为可以接受。
  - `history.pushState` 不换文档，测量正常。
- **复现：** 坏页面（`.bad { letter-spacing: -2px; font-size: 10px }`），分别加上：

  ```
  addEventListener("load", () => { location.href = URL.createObjectURL(new Blob([CLEAN_HTML], {type: "text/html"})); })
  == nav-blob.html       | static: fail ["T07","T11"] | render: pass []
  == nav-js.html         | static: fail ["T07","T11"] | render: pass []   （location.href = "javascript:…"）
  == nav-blob-early.html | static: fail ["T07","T11"] | render: pass []   （解析阶段就跳转）
  == nav-blank.html      | render: incomplete（no-visible-cjk）
  == nav-pushstate.html  | render: fail [T07, T11]（正常）
  ```

- **修法：** 除了路由拦截，再监听 `page.on("framenavigated")`。主框架导航次数超过 1，或者测量前后 `page.mainFrame().url()` 不等于目标地址（允许服务器重定向后的最终地址），本页就记为 `navigated`。补测试：`blob:` 和 `javascript:` 各一个。

### RB-04 · Medium（伪成功）· 页面的中文全在 iframe 里时，结果为「跳过（没有中文内容）」，退出码 0

- **位置：** `render.ts:535-565`、`probe.ts` 的 `measurePage`（都只看主文档）。
- **问题：** 页面上显示的中文全部来自 iframe，主文档没有中文，结果为 `skipped`、退出码 0。本地文件的情况下，如果 iframe 指向的文件也在输入范围里，会被单独检查；URL 页面里，iframe 的内容永远没人检查。
- **复现：**

  ```
  frame.html：<iframe src="inner.html">，inner.html 是坏页面
  == frame.html | static: skipped [] | render: skipped []
  == URL /frame（iframe 指向同一个 localhost 服务的 /inner）| status skipped, skipped_inputs [], problems []
  ```

- **修法：** 测量时遍历 `page.frames()`。同源的子框架里有可见中文时，在每个框架里各建一个隔离环境测量，结果的 `file` 记为「页面 → 框架地址」。最低限度：子框架里有中文而主文档没有时，记为 incomplete（例如原因写 `cjk-in-frame`），不能判「跳过」。

### RB-05 · Medium · 浏览器补 `<tbody>`、脚本插入元素之后选择器对不上：同一元素报两条 error，提示语还写错

- **位置：** `render.ts:486-501`（`dropStatic`、`mergePage`），`model.ts` 与 `probe.ts` 的 `selectorOf`。
- **问题：** htmlparser2 不补 `<tbody>`，浏览器会补。同一个表格单元格，基础档的选择器是 `table > tr > td.t`，完整档的是 `table > tbody > tr > td.t`。结果是基础档那条没被取代，两条 error 同时出现。基础档那条还被加上「完整档在所有宽度下都没测到这个元素，例如它被折叠或隐藏了」，而实际上完整档测到了。没有 `<tbody>` 的表格在生成的页面里很常见；脚本插入同类元素导致 `:nth-of-type` 偏移，也是同样的后果。
- **复现：**

  ```
  table.html：<main><table><tr><td class="t">表格里的中文，字距为负。</td></tr></table></main>，.t { letter-spacing: -1px }
  == table.html | render: fail [["T07","error","main > table > tr > td.t","…（基础档结果：完整档在所有宽度下都没测到这个元素…）"],
                                ["T07","error","table > tbody > tr > td.t","中文字距为负（计算值 -1px）…"]]
  ```

- **修法：** 基础档的选择器在浏览器里找不到对应元素时（probe 一侧可以 `querySelectorAll` 基础档的选择器），用文字指纹对应元素，再按 RB-02 的规则合并。对不上的，消息改为「完整档没能对应到这个元素」，不要断言「被折叠或隐藏」。

### RB-06 · Medium · `linesOf` 的「间隔超过 1.5 个字号就算新的一行」：单行被拆成两行（T06 误报 error），长行被拆成短段（T05 漏报）

- **位置：** `probe.ts` 的 `linesOf`：`r.left - prev.right < fs * 1.5`。
- **问题：** 这个条件是为多栏排版（RA-08）加的，但它对所有段落生效：
  - 行内的大间隔（带 `margin` 的标签、行内图标、图片、`inline-block` 徽章）会把一行切成两段。
  - 对 T06：一行的段落被数成 2 行，`line-height: normal` 时从 warn 升为 error。
  - 对 T05：一行里每隔一段就有图标时，一行被切成几段短的，字数被低估，error 消失。
- **复现：**

  ```
  gap.html：<main><p style="line-height:normal">标题文字<span style="margin-left:4em">标签</span></p></main>
  == gap.html | static: pass [] | render: fail [["T06","error","main > p","实测：在 1280px 宽度下，这段中文折成 2 行…"]]

  t05-icon.html：<p style="width:1100px">（26 个字 + 一个 2.2em 宽的行内图片）× 8</p>（一行约 60 个字）
  == t05-icon.html | static: pass [] | render: pass []   （应报 T05 error）
  ```

- **修法：** 只在多栏时才按间隔断行：段落或祖先的计算值 `columnCount` 不是 `auto`，或 `columnWidth` 不是 `auto`。其余情况只按「垂直位置变化或往左回绕」断行。T06 的行数改用垂直位置去重后的行数。两个复现各补一个夹具。

### RB-07 · Low · A01 把纯蓝、藏青渐变也报成「紫色 / 蓝紫渐变」；提案的说法不准确

- **位置：** `probe.ts` 的 `isViolet`（色相 235°–320°）；`PRD_RENDER_PROPOSAL.md` 第 2 版说「蓝色（约 220°）不报」。
- **问题：** 纯蓝 `#0000ff`、藏青 `#000080` 的色相都是 240°，落在新范围里。深蓝页头的渐变会被报成 AI 套路，提案的描述也和实际行为不符。
- **复现：** `body { background: linear-gradient(#000080, #000033) }` → `A01 warn「背景是紫色 / 蓝紫渐变（rgb(0, 0, 128)）」`；`linear-gradient(90deg, #0000ff, #00bfff)` → 同样报。
- **修法：** 235°–250° 这一段只在「同一渐变里另有 ≥ 250° 的颜色」，或「饱和度、亮度接近 Tailwind indigo 系」时才算。或者回到 250°，只在同一渐变里同时有蓝和紫时才报。提案按实际行为改写，补一个藏青渐变的反例夹具。

### RB-08 · Low · 报告和提案里有超出证据的说法

- **位置：** `VERIFICATION_REPORT.md` §1「审计的 21 条发现全部落实」、§9 矩阵中 RA-03、RA-04、RA-05 的「已落实」；`PRD_RENDER_PROPOSAL.md` 第 2 版「主页面的第二次导航一律拦截」、A01「蓝色（约 220°）不报」。
- **问题：** 对照 RB-01、RB-02、RB-03、RB-07，这些说法偏强。报告里的数字审计方逐项核对过，没有问题（见 §4）。
- **修法：** 矩阵状态按实际改为「部分落实，见 AUDIT_RENDER_r2 RB-xx」；提案按实际行为改写。

### RB-09 · Low · 测试缺口

- **位置：** `test/w2-render-audit.test.js`、`test/fixtures/w2-render-audit/expect.json`。
- **问题：**
  1. RA-15 没有测试，执行方自己写明了。
  2. RA-16 的 `line_of` 断言允许「不给行号」，所以「完全不给行号」也能通过，测不出对应关系是否生效。
  3. RB-01 到 RB-06 的情况都没有测试。
- **修法：**
  - RA-16 增加一个必须给出正确行号的正例：选择器和文字指纹都唯一的元素。
  - RA-15 补一个夹具：同一元素先在窄宽度下只有「不是 strict」，到宽的宽度下才出现「实测行首标点」，断言两条都在。
  - RB-01 到 RB-06 按「先写失败测试、单独目录锁定」的规矩补上。

---

## 3. 第 1 轮发现逐条复核

| 编号 | 第 1 轮严重度 | 复核结论 | 依据 |
|---|---|---|---|
| RA-01 | Blocker | **修好** | 页面同时改写 `Array.prototype.push`、`Element.prototype.getBoundingClientRect`、`Range.prototype.getClientRects`、`getComputedStyle`、`CSSStyleDeclaration.prototype.letterSpacing`，完整档照样报出 T07、T11，工作区上一级目录没有新文件（`base listing: [ 'ws' ]`）。截图名有 `EVIDENCE_RULE` 白名单，写之前核对 `dirname`（`render.ts:256、279-280`）。 |
| RA-02 | High | **修好** | 同上：隔离环境里的 DOM 接口和原型链与页面独立，页面的改写没有生效。隔离环境挡不住页面改 DOM 和样式本身，报告 §5.1 已写明。 |
| RA-03 | High | **部分修好** | 源码完全没有中文的单页应用现在会报 T07、T11、T13 等；源码有占位中文时仍然漏掉，见 RB-01。 |
| RA-04 | High | **部分修好** | 防闪烁页判 incomplete；`<details>` 和 `display: contents` 里的 T07 各报出一条；跳到 `about:blank` 被 `no-visible-cjk` 兜住。按元素合并有新漏洞，见 RB-02、RB-05。 |
| RA-05 | High | **部分修好** | `location.replace`、meta refresh、表单提交判 `navigated`；302 重定向照常检查（R-03）。`blob:`、`javascript:` 能绕过，见 RB-03。 |
| RA-06 | High | **修好** | 404、500 → `http-error`；302 → 404 → `http-error`；204 → `unreadable`（ERR_ABORTED）。都是 incomplete。 |
| RA-07 | High | **修好** | 容差 0.005（`probe.ts`）；RV-13 重跑后 claude-code 组的 T06 error 为 0 页。 |
| RA-08 | Medium | **修好**，但引入了 RB-06 | 双栏段落不再报 T05。 |
| RA-09 | Medium | **修好** | 去重时优先保留带截图的那条；只检查 CSS 时消息里注明（测试覆盖，审计方重跑通过）。 |
| RA-10 | Medium | **修好** | 内联样式和外链样式（`site.css`）两种写法下，`tracking-tight` 加 `tracking-normal` 都不再误报。 |
| RA-11 | Medium | **修好**（按 PRD 原文） | 逐字数「汉字加全角标点」。审计方用 claude-code 组重跑，T05 error 页数为 3，与报告一致；抽查 018 的 `header.hero > p`（46 字）和 003 的 `p.note`（54 字），属实。 |
| RA-12 | Medium | **修好**，但引入了 RB-07 | 靛蓝渐变和 `::before` 渐变都报了。 |
| RA-13 | Medium | **修好** | §3 的耗时、截图数、规则命中数与 `RV-13.json` 一致，审计方重跑结果也一致（见 §4）。抽查改为附截图清单，伪成功扫描写明了局限。 |
| RA-14 | Low | **修好** | `A-RA14-overflow` 断言「另有 5 处」。 |
| RA-15 | Low | **修好，但没有测试** | 合并键区分两类 T04（`render.ts:424`）。 |
| RA-16 | Low | **修好，测试偏弱** | 见 RB-09 第 2 点。 |
| RA-17 | Low | **修好** | `<p><span>…</span></p>` 现在报 T05、T06。 |
| RA-18 | Low | **修好** | 文本输出用 `term()`，测量消息用 `clean()`。 |
| RA-19 | Low | **修好** | 13 种外发方式（含 `localhost` 写法的 preconnect 和 iframe），HTTP 请求数 0，TCP 连接数 0。 |
| RA-20 | Low | **修好** | 夹具里补了 T02、边界值、对抗页面，以及截图尺寸核对。 |
| RA-21 | Low | **修好** | 注释路径已改正。 |

---

## 4. 裁定

### 4.1 执行方报告 §7 的 5 个问题

| 编号 | 问题 | 裁定 | 理由 |
|---|---|---|---|
| 1 | RULING-06：锁定后改了 RA-18 测试的输入 | **同意，未放宽** | 原输入「中文,␛[31m」里，半角逗号后面不是汉字，T03 的正则 `(?=\p{Script=Han}\|\s*$)` 本来就不会命中，测试前提不成立，属于测试本身的错误。改成「中文,中␛[31m」以后，T03 的片段（命中位置前后各取 8、9 个字符）仍然包含 `\u001b`，断言「输出里没有 `\u001b`」照样测到了要测的东西。夹具目录没有改动。请把本裁定照录进 RULINGS。 |
| 2 | RULING-05 的条件是否落实 | **已落实，同意** | 台账已登记；测试已改名；新增的断言用 `R-pos-baseline` 真实渲染，返回 0，并核对了 `run.mode`、`run.render.widths`。审计方重跑通过。 |
| 3 | D-A1、D-A2 不等用户拍板就实现，并列为不阻塞 | **可以接受，附说明** | D-A1 的做法是回到 PRD 原文（统计每行汉字数），D-A2 不涉及 PRD 改动，两者都没有偏离已确认的契约，所以列为不阻塞是合理的。但「全角标点也算字」是对原文「汉字」的细化，必须随 R-D1 一起由用户确认（提案第 2 版已写明）。另外，`ZI` 正则里的 `‘’“”—…` 在英文语境里也会出现，混排时会把英文引号算进字数，影响很小，在提案里注明即可。 |
| 4 | T05 把全角标点算作字，是解释还是改动 | **算解释性细化，须随 R-D1 确认** | clreq 里标点占一个字位，这是排版惯例；PRD 原文写的是「汉字」，没有说标点算不算。它会让每行字数略多（每行通常多 3–6 个），error 门槛因此实际上变严。用户拍板 R-D1 时应该知道这一点。 |
| 5 | 保留下来的基础档结论加一句「完整档在所有宽度下都没测到这个元素」，是否够清楚 | **不够，而且有时不对** | RB-05 的表格例子里，完整档其实测到了这个元素，只是选择器对不上，这句提示与事实不符。应该区分两种情况：「元素在所有宽度下都不可见」（可以确认时才这样写），和「完整档没能对应到这个元素」（其余情况）。 |

### 4.2 第 1 轮裁定的照录情况

RULINGS.md 里 RULING-04 的状态栏照录了第 1 轮的裁定，内容无误。`render-review-undo-patch.md` 补上了撤掉修复用的命令，执行方说明这两条 `sed` 只适用于 `da754c1` 的产物，审计方接受。第 1 轮裁定第 2 条附带的条件已落实。

---

## 5. 审计方亲自运行的命令和关键输出

全部在本机运行（系统 Chrome 155.0.8059.86，playwright-core 1.64.1），没有联网，没有安装依赖，没有运行 `bench/run-baseline.mjs`。

1. **构建和全量测试**

   ```
   $ npm run build && npm test
   ℹ tests 187
   ℹ pass 187
   ℹ fail 0
   EXIT=0
   ```

2. **锁定后改动的测试**：`git diff 155eb92 833977b -- test/w2-render-audit.test.js` 只有 RA-18 那一行输入（RULING-06）；`test/cli.test.js`（RULING-05）和 `test/w2-render-review.test.js` 是新增内容，没有删改原有断言。

3. **RA-01、RA-02 加强版对抗页**（同时改写 5 种原型和全局函数）：

   ```
   == trav.html | static: fail ["T07","T11"] | render: fail [["T07","error","main > p.bad","中文字距为负（计算值 -2px）…"],["T11","error",…]]
   base listing: [ 'ws' ]
   ```

4. **第 1 轮复现页重跑和新的绕过尝试**（`t2.mjs`）：

   ```
   == spa.html             | static: skipped [] | render: fail [T13, T07, T11, T06 warn, T02, T04]
   == spa-placeholder.html | static: pass []    | render: pass []                      ← RB-01
   == redir.html           | render: incomplete（navigated → clean.html）
   == columns.html         | render: pass []
   == hidden.html          | render: fail [T07（基础档保留并注明）, T07（display: contents 实测）]
   == inline.html          | render: fail [T05 error 80 字, T06 error 2 行]
   == vertical-lh.html     | static: fail ["T06"] | render: pass []                    ← RB-02
   == collide.html         | static: fail ["T07","T11"] | render: pass []              ← RB-02
   == table.html           | render: fail [T07 基础档 tr > td, T07 完整档 tbody > tr > td] ← RB-05
   == gap.html             | static: pass [] | render: fail [T06 error「折成 2 行」]     ← RB-06
   ```

5. **导航、iframe、大页面、URL 边界**（`t3.mjs`）：

   ```
   == nav-blob.html       | render: pass []                     ← RB-03
   == nav-blank.html      | render: incomplete（no-visible-cjk）
   == nav-js.html         | render: pass []                     ← RB-03
   == nav-docwrite.html   | render: pass []（同一文档的内容被替换，测到的就是用户看到的内容，接受）
   == nav-pushstate.html  | render: fail [T07, T11]
   == nav-blob-early.html | render: pass []                     ← RB-03
   == frame.html          | static: skipped | render: skipped   ← RB-04
   == big.html（2 万个段落）status incomplete，skipped timeout，15441ms
   == URL /r404（302 → 404）incomplete http-error
   == URL /204 incomplete unreadable（ERR_ABORTED）
   == URL /frame skipped                                       ← RB-04
   ```

6. **RV-13 重跑**（两组复制到 `/tmp` 后用 `runRender` 跑 6 种宽度）：

   ```
   claude-code 18256ms errors 211 shots 211 zero 0 exclT02T04 9 {"T11":8,"T02":30,"T04":30,"T07":5,"T05":3,"T03":7,"T08":2,"T13":2} problems []
   codex       37242ms errors 800 shots 800 zero 0 exclT02T04 0 {"T11":30,"T02":30,"T04":30,"T07":19,"T13":7,"T06":7,"T05":8,"T03":4,"T08":1} problems []
   ```

   与 `evidence/RV-13.json`（claude-code 18181ms、211 张；codex 37346ms、800 张）和报告 §3 一致。T05 error：003 的 `p.note` 54 字、017 的 `p.lead` 48 字、018 的 `header.hero > p` 46 字；其余是 41–45 字的 warn。

7. **网络**（`t4.mjs`，本地文件页面 → 本机计数服务）：prefetch、preconnect（两种写法）、sendBeacon、EventSource、iframe（两种写法）、object、`window.open`、meta refresh、表单、WebSocket、img，HTTP 请求数和 TCP 连接数都是 0。meta refresh 和表单提交判 `navigated`。

8. **长页面性能**：300 段 × 150 字、6 种宽度用时 1464ms；800 段用时 2763ms，都是 pass。

9. **其他边界**（`t5.mjs`、`t7.mjs`）：

   ```
   a01-navy.html  → A01 warn rgb(0, 0, 128)                    ← RB-07
   a01-blue.html  → A01 warn rgb(0, 0, 255)                    ← RB-07
   t05-icon.html  → render: pass []（应报 T05 error）           ← RB-06
   t05-justify.html → T05 error 47 字（中英混排、两端对齐，属实）
   tw-linked.html（外链 site.css 里有 tracking 规则）→ render: pass []（RA-10 在外链样式下也生效）
   ```

10. **超时与进程回收**：本地文件和 URL 各一个死循环页面，预算 2 秒 → 都记 `timeout`，结果 incomplete，用时 4921ms；两个浏览器实例都关掉了，`pgrep -f remote-debugging-pipe` 为 0。

11. **收尾**：`/tmp/r2audit/` 和构建日志已删除；`git status --porcelain` 只显示本文件。

---

## 6. 需要用户拍板的事项

| 编号 | 事项 | 审计方意见 |
|---|---|---|
| R-D1 | 是否按 PRD_RENDER_PROPOSAL 第 2 版的改动 1–4 修改 PRD | 等 RB-01、RB-02 修完、提案按 RB-03、RB-07 的实际行为改写之后再批 |
| R-D2 | 检查本地文件时不允许访问 localhost（包括 TCP 连接） | 同意。审计方实测，13 种方式的连接数都是 0 |
| D-A1 | T05 按每行汉字数统计（含全角标点） | 已按 PRD 原文实现，推荐同意。注意「全角标点算字」会让门槛实际上变严 |
| D-A2 | 页面脚本照常执行，测量放进隔离环境 | 已实现，审计方的加强版对抗页面没能干扰测量，推荐同意 |
