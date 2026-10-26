# W2 完整档（`lint --render`）第 3 轮复核 · AUDIT_RENDER_r3

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」，第 3 轮 |
| 审计方 | Claude Code（独立会话，不采信执行方自述，以代码、命令输出、git 历史为准） |
| 审计对象 | 在 `d9bd0be` 之后：`211a3f5`（锁定复现夹具和测试）→ `11b87c7`（整改）→ `8982d60`（「不少于」规则）→ `dddee8a`、`5b829c4`、`ce7c76a`、`4b6d66e`（报告和验证结果）。审计时 HEAD = `4b6d66e` |
| 上一轮 | `AUDIT_RENDER_r2.md`：未达标，2 High、4 Medium、3 Low |
| 审计日期 | 2026-10-26 |
| 审计方改动 | 只新建本文件。对抗页面放在 `/tmp/r3audit/`，跑完已删除；`git status --porcelain` 只多出本文件 |

---

## 1. 结论

**未达标。**

### 1.1 流程性原因（与代码质量无关）

R-D1、R-D2 两项 PRD 变更仍未经用户拍板（`open_decisions.json` 中 `resolved: false`）。按项目规则，这一条本身就让结论为「未达标」。执行方的 `results.json` 也如实判了「未达标」。

### 1.2 实质评价：有条件达标

本轮没有发现 Blocker 或 High。第 2 轮的 9 条发现都落实了，审计方用第 2 轮的复现页逐一重跑，并尝试绕过新防线，详见 §3。本轮没有找到「基础档退出码 1、完整档却判通过」的新路径。

本轮发现 **4 条 Medium、1 条 Low**。主要是新的合并机制带来的**重复报告和误报**，不是漏报：

| 严重度 | 条数 | 编号 |
|---|---|---|
| Blocker | 0 | — |
| High | 0 | — |
| Medium | 4 | RC-01 至 RC-04 |
| Low | 1 | RC-05 |

**转为「有条件达标」的条件**（用户拍板 R-D1、R-D2 之后）：

1. RC-01、RC-02、RC-03 修好，并各补一个先失败的测试；
2. RC-04 的报告更正；
3. 审计响应矩阵逐条回应 RC-01 至 RC-05。

---

## 2. 发现清单

复现页面写在 `/tmp/r3audit/` 下，调用 `runRender` 和 `runLint`（`npm run build` 之后的 `packages/cli/dist/index.js`）。下文的通用样式指 `:where(:lang(zh)) { line-break: strict; font-synthesis-style: none; text-autospace: normal; } body { font-family: "Inter", "PingFang SC", sans-serif; font-size: 16px } main { max-width: 36em } p, li { line-height: 1.75 }`。

### RC-01 · Medium · 文字指纹撞上不可见的元素时，基础档结论被保留，和完整档自己的报告重复，还会让基础档的近似误报复活

- **位置：** `render.ts` 的 `staticVerdict`（`checked < dom` 就保留）；`probe.ts` 的 `textCounts`（统计所有中文元素，包括不可见的）、`mark`（只统计可见的）；`render.ts` 的 `mergeCounts`（各宽度分别取最大值，不是按元素取并集）。
- **问题：** 取代条件是「浏览器里这个指纹的**每一个**元素都做过这条规则的检查」。只要页面别处有一个同文字、但不可见的元素，条件就不成立，基础档的结论被保留。常见的不可见同名元素有：
  - `<select>` 里的 `<option>`；
  - 关着的对话框；
  - 响应式页面里「移动端一份、桌面端一份」的同一段文字。

  被保留的结论有两种后果：
  1. **重复报告：** 完整档已经检查并报告了那个可见元素，基础档又报一次，消息里还写着「完整档没有对这个元素检查这条规则（元素不可见、竖排或在代码块里）」，与事实不符。
  2. **误报复活：** 完整档本来已经纠正了基础档的近似误报（例如 RA-10 的 Tailwind 类名推断），撞上不可见的同名元素后，误报又被保留下来，合规页面退出码变成 1。

  另外，各宽度分别取最大值也会制造同样的问题：同一段文字，移动端 `p.m` 只在窄屏显示，桌面端 `p.d` 只在宽屏显示，每个宽度下 `checked` 都只有 1，`dom` 是 2，所以总被判为「没检查」。
- **为什么是问题：** 对照组 codex 的 30 页里，按元素合并保留下来的 25 条基础档 error 中，**15 条和完整档自己的报告重复**，涉及 4 个页面：003、015、019、022。报告 §3 把截图从 800 张增加到 815 张，解释为「没有展开的 `<option>`、要滚动到才出现的卡片」，与实际不符（见 RC-04）。
- **复现：**

  ```
  ① 误报复活。样式：.tracking-tight{letter-spacing:-0.025em} .tracking-normal{letter-spacing:0}
  tw-noopt.html：<main class="tracking-tight"><h2 class="tracking-normal">基础数据 API</h2></main>
  == tw-noopt.html | static: fail ["T07"] | render: pass e=0 []
  tw-opt.html：同上，另加 <form><select><option>基础数据 API</option></select></form>
  == tw-opt.html   | static: fail ["T07"] | render: fail e=1 [["T07","error","main.tracking-tight > h2.tracking-normal",3,"中文元素带有 Tailwind 类 tracking-tight（负字距）…"]]

  ② 响应式的两份文字。.m{font-size:10px} .d{display:none} @media (min-width:768px){ .m{display:none} .d{display:block} }，--widths 360,1280
  == resp.html | render: fail e=2 [["T11","error","main > p.m:nth-of-type(1)",3,"【窄屏 390px下】中文字号 10.0px…（基础档结果：完整档没有对这个元素检查这条…"],
                                   ["T11","error","main > p.m:nth-of-type(1)",3,"中文字号 10.0px，小于 12px…"]]

  ③ 对照组 codex 重跑（6 种宽度）：kept 25，duplicates of render findings 15
     T07 | 003 h3 ×3 | 「完整档没有对这个元素检查这条规则」 | DUP（同一个 h3 完整档在 360px 也报了 T07）
     T07 | 015 h2 ×3 | 同上 | DUP（「基础数据 API」也出现在 <option> 里）
     T02、T04 | 022 ×4 | 同上 | DUP（brand-name、mobile-brand 一个只在桌面显示，一个只在移动端显示）
     T11 | 007 code 里的 span ×4 | 「选择器对应到多个元素」 | DUP
     T11 | 019 button ×1 | 同上原因 | DUP
  ```

- **修法：**
  1. 判断「是否检查过」时只看**和这条基础档结论对应的那个元素**。probe 一侧返回「已检查元素」的指纹加选择器（或加源码顺序号）；Node 一侧先按选择器找，选择器对不上（例如浏览器补了 `<tbody>`）再按指纹找。
  2. 按宽度取并集：只要在任一宽度下检查过这个元素就算检查过，不要各宽度分别取最大值再比较。
  3. 保留结论时写的原因，必须和实际判定一致；完整档已经对同一元素报了同一规则的，就不再保留基础档那条。
  4. 用上面的 `tw-opt.html` 和 `resp.html` 各补一个先失败的测试；codex 组重跑后，「保留且与完整档重复」的条数应为 0。

### RC-02 · Medium · 被拦截的外部 iframe 显示的是 Chrome 的错误页，中文系统下它含中文，结果被判为「iframe 里有中文、没检查完」

- **位置：** `render.ts` 的 `framesWithCjk`（不区分 `chrome-error://` 框架）；`launchBrowser` 没有固定浏览器语言。
- **问题：** 完整档会拦截外部请求，被拦的 iframe 会显示 Chrome 的错误页（`chrome-error://chromewebdata/`）。这台机器的系统语言是中文，错误页的文字也是中文，`framesWithCjk` 判定「iframe 里有中文」，整页记为 `cjk-in-frame`、incomplete、退出码 2。所以，**凡是嵌了外部视频、地图、B 站播放器的页面，在中文系统上永远检查不完**；换到英文系统上，同一个页面又能通过，结果随操作系统语言而变。
  - 同一原因的另一表现：主页面加载后跳转被拦截时，主框架也会换成错误页。DOM 快照取到的是错误页，它的「中文元素」被当成页面内容跑了基础档规则。审计方的 `redir.html` 结果里出现了选择器为 `div#main-content:nth-of-type(1) > div#main-message:nth-of-type(2) > h1 > span` 的 T02 error，这是 Chrome 错误页的结构。整页仍是 incomplete，但结果里混进了无关的结论。
- **复现：**

  ```
  f-remote.html：通用样式 + <main><p>主文档的中文，页面里嵌了一个外部视频。</p><iframe src="https://www.youtube.com/embed/xyz"></iframe></main>
  == f-remote.html | static: pass [] | render: incomplete e=0 [] | skipped: [{"file":"f-remote.html","reason":"cjk-in-frame"}]

  URL 页面：iframe 指向 https://example.com/ 和另一个 localhost 端口
  == URL with iframes incomplete [cjk-in-frame] problems: "完整档：页面的 iframe 里有中文（chrome-error://chromewebdata/），完整档不检查 iframe 的内容…"
  ```

- **修法：**
  1. `framesWithCjk` 跳过 `chrome-error://` 和被路由拦截的框架（地址已经记进 `remote_refs`）。
  2. 主框架提交了错误页时，按 `navigated` 或 `unreadable` 处理，不再取 DOM 快照跑基础档规则。
  3. 启动浏览器时加 `--lang=en-US`（或用 context 的 `locale`），让结果不随操作系统语言变化。
  4. 补测试：嵌了外部 iframe 的本地页面不能是 `cjk-in-frame`；被拦截的跳转不能产生来自错误页的结论。

### RC-03 · Medium · DOM 快照补进来的结论与源码的结论重复，同名元素的结论还会互相顶掉

- **位置：** `render.ts` 的 `staticPass`（`fresh` 按「选择器对应的元素里有没有源码里不存在的文字指纹」判断）；`lint.ts` 的 `lintPageInto`（去重键是 `rule|selector|line`，而 DOM 快照的行号对应不上原来的元素）。
- **问题：**
  1. **脚本改了源码元素的文字**（加日期、加「【更新】」前缀、国际化替换）：同一个元素，源码的结论（带行号）和 DOM 快照的结论（不带行号，注明「是脚本渲染出来的」）各报一次。注明的来源也不对，这段内容在源码里有。
  2. **超过 4 层、选择器相同的两个元素，一个来自源码、一个由脚本插入：** DOM 快照的去重键相同，后一个元素的结论被丢掉，留下的却是源码元素那条，等于又报了一次源码的问题。脚本插入元素自己的问题没有报出来。不过这个页面已经因为源码元素失败，不会变成伪通过。
  3. `007` 页面里，代码高亮脚本生成的 `span` 被 DOM 快照补报 T11，完整档也报了 T11，形成重复（已计入 RC-01 的 15 条）。
- **复现：**

  ```
  text-tweak.html：<main><p style="font-family:Arial,sans-serif">你好,世界,这是一段带半角逗号的中文</p></main>
                   <script>p.firstChild.data = "【更新】" + p.firstChild.data</script>
  == text-tweak.html | render: fail e=4 [["T03","error","main > p",3,…],["T13","error","main > p",3,…],
                                        ["T03","error","main > p",null,"…「【更新】你好,世界,这是一段」…（按浏览…"],["T13","error","main > p",null,…]]

  dup-deep.html：两个 section > div > div > div > p，第一个在源码里（半角逗号），第二个由脚本插入（也有半角逗号）
  == dup-deep.html | render: fail e=4 [T03 源码段落（第 3 行）, T13, T03「源码里的段落,半角逗号」（无行号，DOM 补报）, T13]
                     （脚本插入的「脚本插入的段落,也有半角逗号」没有出现）
  ```

- **修法：**
  1. DOM 快照的结论和源码的结论**按元素**对应：先按选择器对应，对不上再按文字指纹的前缀或编辑距离对应；对应上的，只保留源码那条（带行号）。
  2. 跑 DOM 模型时，`lintPageInto` 的去重键要能区分元素，例如加上元素在 DOM 里的序号，不能只用选择器加行号。
  3. 以上两种情况各补一个测试。

### RC-04 · Medium · 报告对保留结论的解释与证据不符

- **位置：** `VERIFICATION_REPORT.md` §3「第 3 轮的变化」；`evidence/RB-02-kept-reasons.log`。
- **问题：** 报告说 codex 组多出的 15 张截图「是按元素合并后保留下来的基础档 error」，举例为「没有展开的 `<option>`、要滚动到才出现的卡片」。审计方重跑并逐条核对：保留的 25 条里，有 15 条完整档对同一元素、同一规则已经报过，属于重复报告。只有 `<option>`（023 页 6 条）、关着的对话框（022 页 1 条），以及 007 页的 1 条 `caption` 和 2 条被高亮脚本改写过的代码块这 10 条，属于真正「完整档没检查到」。`RB-02-kept-reasons.log` 只统计了原因的文字，没有核对原因是否属实。
- **为什么是问题：** 这个解释把一个缺陷（RC-01）说成了预期行为。和第 1 轮的 RA-13 是同一类问题。
- **修法：** 修完 RC-01 后重跑，把统计脚本改为「保留原因 + 完整档是否对同一元素报了同一规则」两列，报告按这两列写。

### RC-05 · Low · 测试缺口

- **位置：** `test/w2-render-audit-r2.test.js`、`test/fixtures/w2-render-audit-r2/expect.json`。
- **问题：**
  - RC-01、RC-02、RC-03 的情况都没有测试。
  - `B-RB05-table` 用 `max_errors` 断言「不重复」，但只覆盖了 `<tbody>` 一种情况。没有断言「整个页面不存在同一规则、同一元素的两条 error」。
- **修法：** 在回归测试里加一条通用断言：同一页面、同一规则下，同一个元素（按截图坐标或选择器加指纹判断）最多一条 error，对全部审计夹具和 golden 页面都执行。

---

## 3. 第 2 轮发现逐条复核

| 编号 | 第 2 轮严重度 | 复核结论 | 依据（真实输出摘录） |
|---|---|---|---|
| RB-01 | High | **修好**（有副作用，见 RC-03） | `spa-placeholder.html \| render: fail [T03, T13]`，和 `dom-equivalent.html` 一致 |
| RB-02 | High | **修好**（有副作用，见 RC-01） | `vertical-lh.html \| render: fail [T06 …（基础档结果：完整档没有对…）]`；`collide.html \| render: fail [T07, T11 …保留]` |
| RB-03 | Medium | **修好** | `nav-blob`、`nav-js`、`nav-blob-early`、`nav-blank`、`window.open(…, "_self")` 都记为 `navigated`；`pushState`、`location.hash` 照常检查，判 fail，没有误判；`document.write` 不算换文档，测到改写后的内容，源码里对不上的结论被保留 |
| RB-04 | Medium | **修好**（有副作用，见 RC-02） | `srcdoc` iframe、load 后动态插入的 iframe、本地文件 iframe 都记为 `cjk-in-frame`；`about:blank` 的空 iframe 不受影响 |
| RB-05 | Medium | **修好** | `table.html \| render: fail e=1 [["T07","error","table > tbody > tr > td.t",…]]`，只有一条 |
| RB-06 | Medium | **修好** | `gap.html` → T06 warn（不再是 error）；`icon.html` → T05 error 64 字；`columns.html` → pass |
| RB-07 | Low | **修好** | `navy.html`、纯蓝不报；`indigo.html`（`#6366f1→#4338ca`）报 A01 warn |
| RB-08 | Low | **修好** | §9 里 RA-03/04/05 的状态已更正，提案按实际行为改写。本轮又出现了新的不实解释，见 RC-04 |
| RB-09 | Low | **修好** | `B-RA15-t04-both`、`B-RA16-line`（要求行号准确）已补；RB-01 至 RB-07 都有锁定在前的夹具 |

另外核对过、没有发现问题的部分：

- **锁定测试没有改动：** `git log 211a3f5..HEAD -- test/w2-render-audit-r2.test.js test/fixtures/w2-render-audit-r2` 输出为空；`git diff --stat 211a3f5 HEAD -- test/` 输出为空；`MANIFEST.sha256` 校验全部 OK。整改前的失败证据 `audit-r2-tests-before-fix.log` 为 6/7 失败，与描述一致。
- **RA-01、RA-02 没有回退：** 页面改写数组方法和 `getComputedStyle` 后，完整档照样报 T07、T11，工作区上一级目录没有新文件。
- **文字指纹碰撞不会造成漏报：**
  - 前 24 个字相同、一个在折叠区里有问题、一个可见没问题：基础档结论被保留；
  - 两个都可见：完整档自己报出有问题的那个。
- **「不少于」（`8982d60`）没有引入漏报：**
  - 脚本删掉有问题的元素、换上同文字的正常元素：判通过。用户看到的是正常元素，审计方同意（见 §4 第 1 条）；
  - 脚本把有问题的元素藏起来、再插入一个同文字的正常元素：基础档结论被保留；
  - 脚本复制一份有问题的元素：完整档对两个都报，符合实际显示。

  按代码推理，要让基础档结论被错误取代，必须让有问题的元素在**每一个宽度下都不显示或被删除**，同时在别的宽度下凑出数量相等、都可见的同名元素。这只有刻意对抗的页面才做得到，而且那个元素在任何宽度下都不显示，取代它的结论不影响用户看到的内容。
- **golden 20 页：** `{"errors":0,"warns":3,"status":"pass"}`，与基础档一致，没有新误报。
- **对照组重跑：** 截图数、页数、规则命中页数与 `RV-13.json` 一致（codex 815 张、零 error 0/30；claude-code 211 张、排除 T02/T04 后 9/30）。claude-code 组没有保留下来的基础档 error。

---

## 4. 对执行方报告 §7 的裁定

| 编号 | 问题 | 裁定 | 理由 |
|---|---|---|---|
| 1 | 「不少于」规则有没有引入漏报；「脚本用同文字的正常元素替换有问题的元素」时取代是否正确 | **「不少于」本身同意；「每一个都检查过」这一半需要改** | ① 审计方尝试了替换、隐藏后插入、复制三种写法，都没有漏报（§3）。替换的情况下，用户看到的是正常元素，取代正确。② 漏报方向是安全的；问题出在另一个方向：「每一个同指纹的元素都检查过」这个条件，会被不可见的同名元素（`<option>`、对话框、响应式的另一份）破坏，造成重复报告和误报复活，见 RC-01。 |
| 2 | 用 `Page.frameNavigated` 和 `Runtime.executionContextCreated` 识别换文档是否充分；`document.open()` 不算换文档是否合适 | **充分，同意** | 审计方测了 `blob:`（load 时、解析时）、`javascript:`、`about:blank`、`window.open(…, "_self")`、`pushState`、`location.hash`、`document.write`，识别结果都正确，也没有误判。`document.open()` 改写的是当前文档，测到的就是用户看到的内容，可以接受。附带问题：被拦截的跳转会让主框架变成 Chrome 错误页，DOM 快照取了错误页，见 RC-02 第 2 点。 |
| 3 | iframe 里有中文一律判没检查完（最低限度做法） | **有条件接受** | 「不能判跳过」这一底线已经做到，`srcdoc`、动态插入的 iframe 也覆盖了。条件是修 RC-02：被拦截的外部 iframe（显示 Chrome 错误页）不能算「有中文」，并且固定浏览器语言。否则在中文系统上，嵌了外部视频或地图的页面永远检查不完。逐个框架测量可以留到下一阶段，在「已知局限」里写明即可。 |
| 4 | RB-01 用「源码 + DOM 新增元素」，没有用「一律按 DOM 建模」 | **有条件接受** | 执行方给的理由成立：改为一律按 DOM 建模，会改变全部本地页面的基础档结果，包括 F03 的文件归属，以及 `var()`、嵌套 CSS 的序列化差异。现在的做法补上了占位页的漏洞（`B-RB01` 两页结论一致）。条件是修 RC-03：脚本改过文字的源码元素被重复报告；同名元素的结论在 DOM 模型里互相顶掉。 |

RULINGS.md 里 RULING-05、RULING-06 的状态栏照录了第 2 轮的裁定，内容无误。

---

## 5. 审计方亲自运行的命令和关键输出

全部在本机运行（系统 Chrome 155.0.8059.86，playwright-core 1.64.1，系统语言为中文），没有联网，没有安装依赖，没有运行 `bench/run-baseline.mjs`。

1. **锁定测试有没有被改**

   ```
   $ git log --format='%h %s' 211a3f5..HEAD -- test/w2-render-audit-r2.test.js test/fixtures/w2-render-audit-r2   → 无输出
   $ git diff --stat 211a3f5 HEAD -- test/                                                                        → 无输出
   $ (cd test/fixtures/w2-render-audit-r2 && shasum -a 256 -c MANIFEST.sha256) | grep -vc OK                      → 0
   ```

2. **构建和全量测试**

   ```
   $ npm run build && npm test
   ℹ tests 194
   ℹ pass 194
   ℹ fail 0
   EXIT=0
   ```

3. **第 2 轮复现页重跑**（`t1.mjs`，节选）：

   ```
   == trav.html            | render: fail e=2 [T07, T11]，base: [ 'ws' ]
   == spa-placeholder.html | static: pass [] | render: fail e=2 [T03, T13]
   == vertical-lh.html     | static: fail ["T06"] | render: fail e=1 [T06（基础档结果：完整档没有对…）]
   == collide.html         | static: fail ["T07","T11"] | render: fail e=2 [T07, T11 保留]
   == table.html           | render: fail e=1 [T07 table > tbody > tr > td.t]
   == gap.html             | render: pass e=0 [T06 warn]
   == icon.html            | render: fail e=1 [T05 error 64 字]
   == navy.html            | render: pass e=0 []
   == nav-blob / nav-js / nav-blob-early / nav-blank / nav-blank-write | incomplete（navigated）
   == nav-pushstate / nav-hash | fail [T07, T11]
   == nav-docwrite         | fail [T07, T11 保留（完整档没能在浏览器里对应到这个元素）]
   == redir.html           | incomplete（navigated），结果里有来自 Chrome 错误页的 T02 error   ← RC-02
   ```

4. **新的绕过尝试**（`t2.mjs`、`t3.mjs`、`t4.mjs`）：

   ```
   == f-srcdoc.html     | incomplete（cjk-in-frame）
   == f-dynamic.html    | incomplete（cjk-in-frame）
   == f-remote.html     | incomplete（cjk-in-frame，实为 Chrome 错误页）   ← RC-02
   == f-empty.html      | pass
   == fp-collide.html   | fail [T07, T11 保留]
   == fp-collide-vis.html | fail [T07, T11 完整档实测]
   == text-tweak.html   | fail e=4（源码 2 条 + DOM 2 条，同一元素）        ← RC-03
   == dup-deep.html     | fail e=4（源码段落报两次，脚本插入段落没报）      ← RC-03
   == swap.html         | pass（显示的是正常元素）
   == hide-swap.html    | fail [T07, T11 保留]
   == clone.html        | fail e=4（两个可见副本各报一次，符合实际显示）
   == resp.html         | fail e=2（同一元素 T11 两条）                     ← RC-01
   == tw-noopt.html     | render: pass；tw-opt.html | render: fail e=1        ← RC-01
   == URL with iframes  | incomplete「iframe 里有中文（chrome-error://chromewebdata/）」 ← RC-02
   ```

5. **golden 20 页**：`{"files":21,"cjk_files":20,"errors":0,"warns":3,"status":"pass"}`；基础档同为 `errors 0, warns 3`。

6. **对照组重跑**（两组复制到 `/tmp` 后用 `runRender` 跑 6 种宽度）：

   ```
   claude-code 18451ms {"errors":211,"warns":152,"status":"fail"} excl 9 shots 211 problems []
   codex       38488ms {"errors":815,"warns":303,"status":"fail"} excl 0 shots 815 problems []
   保留下来的基础档 error：codex 25 条，其中与完整档自己的报告重复 15 条（003 T07 ×3、015 T07 ×3、022 T02/T04 ×4、007 T11 ×4、019 T11 ×1）
   ```

   003 页重复的原因：`h3`「下班后的风」的文字，也出现在脚本用 `data-route` 生成的 `<option>` 里。015 页的原因：`h2`「基础数据 API」也出现在 `<select id="api-type">` 的 `<option>` 里。

7. **收尾**：`/tmp/r3audit/` 和构建日志已删除；`git status --porcelain` 只显示本文件。

---

## 6. 需要用户拍板的事项

| 编号 | 事项 | 审计方意见 |
|---|---|---|
| R-D1 | 是否按 PRD_RENDER_PROPOSAL 第 3 版的改动 1–4 修改 PRD | 等 RC-01 修完、按元素合并的口径定下来之后再批，避免把「每一个同指纹元素都检查过」写进 PRD |
| R-D2 | 检查本地文件时不允许访问 localhost（包括 TCP 连接） | 同意（第 2 轮已实测，13 种方式的连接数都是 0） |
| D-A1 | T05 按每行汉字数统计，全角标点也算字 | 推荐同意；门槛实际上变严，提案已写明 |
| D-A2 | 页面脚本照常执行，测量放进隔离环境 | 推荐同意 |
