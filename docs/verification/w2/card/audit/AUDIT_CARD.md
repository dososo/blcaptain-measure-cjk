# 独立审计：W2 `card` 命令（小红书 3:4 卡片导出）

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」；执行：独立审计方（Claude Code，另一会话） |
| 审计对象 | 提交 `e72a058` → `bb045d8` → `00f0f16` → `d0cfc2e` → `40f7bb2`；审计期间执行方又提交了 `4086c00`（R-C1 用户确认、PRD 写入 C27–C29）和 `4f851f7`（results.json 重跑，结论为达标），一并核对。代码在 `00f0f16` 之后没有变化，本文的复现结果对 `4f851f7` 同样成立 |
| 环境 | macOS（Darwin 25.6.0），系统 Chrome 155.0.8059.86，playwright-core 1.64.1，Node v22.17.1；真实字体 `../deliverables/fonts-for-test/LXGWWenKai-Regular.ttf`（SHA-256 `2d73eea9…7fc8b`，与验证脚本一致） |
| 方法 | 读代码；`npm run build && npm test`；在 `/tmp/audit-card/` 下用 `test/helpers/font.js` 生成方框字体和对抗页面，直接调用 `runCard` 和命令行；在仓库副本里做变异测试。没有联网、没有装依赖、没有改仓库里任何已提交文件，临时文件已清理 |

---

## 1. 结论

**未达标。**

### 1.1 实质发现（与 R-C1 无关）

Blocker 1 条、High 5 条、Medium 2 条、Low 6 条。

`card` 的核心承诺是「导出的 PNG 只用了 `commercial_image: true` 的字体，且卡片 lint 零 error」（F06、D-C2、AC-9）。这一条现在**可以被绕过，而且结果照样是 `exported`、退出码 0**。

- 最典型的路径是在空元素的 `::before` 里放一个装饰符号，比如 `✦`。霞鹜文楷没有这个字，浏览器回退到 Zapf Dingbats。
- 同一个字写成正文会被正确拒绝，写在伪元素里就能导出（CA-01）。

必改清单（全部改完、补上回归测试，才能重新送审）：

1. CA-01：字体检查只查「直接含文字的元素」，伪元素、表单控件、shadow DOM、iframe、canvas、SVG 图片里的文字都没查到。
2. CA-02：先查字体、后截图，截图时 `animations: "disabled"` 把动画快进到终点，状态已经和查字体时不一样。
3. CA-03：内部名查不到时，按文件名判定授权。
4. CA-04：`data:`、`blob:` 字体和 FontFace API 绕过了拦截，结果里还把这些字体记成 `source: "system"`。
5. CA-05：lint 和导出是两次不同的渲染（视口高 800 和 1440、字体也不同），lint 零 error 证明不了导出的那张图。
6. CA-06：卡片点名要用 🔴 字体、但 `font_dir` 里没有这个文件时，静默导出。这与 PRD C27 自己举的例子相反。

### 1.2 R-C1（单独列出）

- **审计开始时（HEAD `40f7bb2`）：** R-C1 未拍板，按项目规则这一条本身就使结论为「未达标」。`results.json` 也是这么判的。
- **审计期间：** 执行方提交了 `4086c00`，在 `open_decisions.json` 里记录 R-C1 已确认（原话「R-C1 同意：按 PRD_CARD_PROPOSAL 的改动 1–3 修改 PRD，新增附录 C27–C29。」），并把 PRD 改了。
  - 审计方无法核实这句原话是不是用户本人说的，**待用户确认**。
  - 在 `4086c00` 里，`VERIFICATION_REPORT.md` §1 已经改成「执行方自评：达标（以 results.json 的机器判定为准）」，可是 `results.json` 当时还是 `git_head d0cfc2e`、`verdict 未达标`。
  - 4 分钟后，执行方提交了 `4f851f7`，`results.json` 补跑成 `git_head 4086c00`、`verdict 达标`。先后顺序的问题已经自己消除。但这个「达标」只是验证脚本看得到的范围，**与本审计的结论冲突，以本审计为准**，见 CA-08。
- **假设实质上没有 Blocker/High：** R-C1 经用户确认、在干净工作树上重跑 `verify-w2-card.mjs` 之后，结论可以是「达标」。
- **实际情况：** 有 1 条 Blocker、5 条 High，所以 R-C1 无论是否拍板，结论都是**未达标**。

---

## 2. 发现清单

复现说明：「方框字体」指 `makeTtf({ family: "LXGW WenKai", localizedFamily: "霞鹜文楷", chars: <页面全部字符> })`，放在工作区的 `fonts/font.ttf`；调用方式是 `runCard({ input: "card.html", out: "card.png", fontDir: "fonts", root: ws, cwd: ws })`。基础页面是 K-pass 夹具的样式加上正文，`body { font-family: "LXGW WenKai", serif }`。对照组：

| 用例 | 写法 | 结果 |
|---|---|---|
| A00 对照 | 不加攻击内容 | `exported`，字体只有 LXGW WenKai（正确） |
| A01 对照 | `<p style="font-family:'PingFang SC'">攻击文字用了苹方</p>` | `rejected`，查出 PingFang SC（正确） |

### CA-01 · Blocker · 字体检查只覆盖「直接含文字节点的元素」，很多渲染出来的文字没查

- **位置：** `packages/cli/src/card.ts:268-276`
  - `DOM.getDocument` 没有带 `pierce: true`；
  - `walk` 只遍历 `children`，不遍历 `pseudoElements`、`shadowRoots`、`contentDocument`；
  - 只把「有非空文字子节点」的元素放进 `targets`；
  - `SKIP` 里有 `TEXTAREA`。
- **问题：** 下面这些文字都画进了 PNG，字体却没有被检查。实测结果都是 `exported`、`png: true`、`fonts` 里只有 LXGW WenKai：

| 用例 | 写法 | 结果 |
|---|---|---|
| A02 | 空元素的伪元素：`.pb::before { content: "攻击文字用了苹方"; font-family: "PingFang SC" }` + `<div class="pb"></div>` | exported |
| A04 | `<input class="pf" value="…">` | exported |
| A05 | `<input class="pf" placeholder="…">` | exported |
| A06 | `<textarea class="pf">…</textarea>` | exported |
| A07 | `<select class="pf"><option>…</option></select>` | exported |
| A09 | 脚本 `attachShadow` 后写入 `<p style="font-family:'PingFang SC'">` | exported |
| A10 | 声明式 shadow DOM `<template shadowrootmode="open">` | exported |
| A12 | `<canvas>` 里 `ctx.font="48px 'PingFang SC'"; fillText(…)` | exported |
| A13 | `<img src="data:image/svg+xml,…<text font-family='PingFang SC'>…">` | exported |
| A25 | `<iframe srcdoc="<p style='font-family:Helvetica Neue'>Hello Typography</p>">`（iframe 里没有中文，完整档也不报 `cjk-in-frame`） | exported |

  作为对照，下面这些写法被正确拒绝了：

| 用例 | 写法 | 结果 |
|---|---|---|
| A03 | 伪元素挂在有文字的元素上 | rejected |
| A08 | 内联 SVG 的 `<text>` | rejected |
| A21 | `::marker` | rejected |
| A11 | iframe 里有中文（完整档报 `cjk-in-frame`） | incomplete |

  拼图 `/tmp/audit-card/montage.png`（已清理，可按下面的步骤复现）里，A02、A04–A07、A09、A10、A12、A13 的 PNG 上都是苹方的真实字形；用方框字体渲染的话应该是方块。

- **为什么是 Blocker：** 这是 F06、AC-9「用到的字体全部满足 `commercial_image: true`」的伪成功。
  - 不需要恶意构造。下面这条是**真实字体、真实模板**上的误放行：

    | 写法（`quote.html` 里的 `.mark`） | 结果 |
    |---|---|
    | 改写成 `<p class="mark">✦</p>` | 退出码 1，查出 Zapf Dingbats，正确拒绝 |
    | 改写成 `<p class="mark"></p>`，加上 `.mark::before { content: "✦"; }` | 退出码 0，`exported`，结果里只有 LXGW WenKai |

  - `❦`、`⚘` 同理，`⚘` 回退到的是 Menlo。
  - 卡片里用伪元素放装饰符号、引号、序号很常见，`xhs-card.md` 自己也提到了 CSS 计数器的问题。
- **修法：**
  1. 改成 `DOM.getDocument({ depth: -1, pierce: true })`，遍历 `children`、`pseudoElements`、`shadowRoots`、`contentDocument`，对**每一个元素节点和伪元素节点**都调用 `CSS.getPlatformFontsForNode`（不再要求它有直接文字），并删掉 `SKIP` 里的 `TEXTAREA`。
     - 审计方已经验证：带 `pierce` 之后，空 div 的 `::before`、`<input>`（经由 user-agent shadow 里的 DIV）、脚本创建的 shadow DOM 都能查出 PingFang 或 Songti（见 §4 的 cdp 探针输出）。
  2. CDP 查不到的载体要「宁可拒绝」：页面有 `<canvas>`、`<iframe>`、`<object>`/`<embed>`、SVG 来源的 `<img>`/`<image>`、`background-image`/`mask-image`/`content: url()` 指向 SVG 时，判 `rejected`（或 `incomplete`），并在 `problems` 里说明原因。
  3. 为上面每一种载体加锁定夹具，每个夹具同时断言「不写 PNG」。
- **复现：** 在 `/tmp` 建工作区，写入方框字体和下面的页面，调用 `runCard`：

  ```html
  <!-- body 用 LXGW WenKai -->
  <style>.pb::before{content:"攻击文字用了苹方";font-family:"PingFang SC";font-size:60px}</style>
  <div class="pb"></div>
  ```

  真实输出：

  ```
  A02-before-empty {"status":"exported","png":true,"fonts":["LXGW WenKai|font_dir|allowed=true|used=true|glyphs=23"],"blocked":[],"problems":[],"lintErrors":0}
  ```

  真实字体、命令行复现：

  ```
  $ node packages/cli/bin/measure-cjk.js card p.html --out p.png --font-dir fonts --format json   # p.html = quote.html 里的 .mark 改成 ::before "✦"
  ✦ direct=1 rejected [["Zapf Dingbats",false]] | pseudo=0 exported ["LXGW WenKai"]
  ❦ direct=1 rejected [["Zapf Dingbats",false]] | pseudo=0 exported ["LXGW WenKai"]
  ⚘ direct=1 rejected [["Menlo",false]]         | pseudo=0 exported ["LXGW WenKai"]
  ```

### CA-02 · High · 先查字体、后截图，截图前状态会变（动画快进）

- **位置：** `packages/cli/src/card.ts:282-295`，先逐个元素查字体，最后 `page.screenshot({ …, animations: "disabled" })`。
- **问题：** Playwright 的 `animations: "disabled"` 会把有限时长的 CSS 动画**快进到终点**。查字体时动画处在起点，截图时已经在终点。

  | 用例 | 写法 | 结果 |
  |---|---|---|
  | A14 | `@keyframes sw { to { font-family: "PingFang SC" } } .an { animation: sw 3600s linear forwards }` | `exported`，fonts 里只有 LXGW WenKai（31 字形），PNG 上那一行是苹方字形 |

  另一个思路（A15）没能成功：在 load 后用 MutationObserver 监听 Playwright 注入的 style，再改字体。PNG 上仍是方块，不算发现。
- **为什么是 High：** 只用纯 CSS 就能稳定做到。查字体和截图之间的状态不一致，是结构性的检查时与使用时不一致（TOCTOU），以后还可能有别的入口（transition、`:hover` 之类）。
- **修法（任选其一，并加夹具）：**
  - **方案一：先冻结再查。** 先注入 `*, *::before, *::after { animation: none !important; transition: none !important; }`，再查字体、再截图，截图用 `animations: "allow"`。
  - **方案二：截图后复核。** 截图之后再查一遍字体，同时比较前后两张截图的哈希，不一致就判 `incomplete`。
- **复现：** 上面的 A14 页面，真实输出：

  ```
  A14-animation-fastforward {"status":"exported","png":true,"fonts":["LXGW WenKai|font_dir|allowed=true|used=true|glyphs=31"],"blocked":[],"problems":[],"lintErrors":0}
  ```

### CA-03 · High · 内部名查不到时按「文件名」放行

- **位置：** `packages/cli/src/card.ts:107`，`face.names.map((n) => matchFontName(n)).find(Boolean) ?? matchFontFile(file)`。
- **问题：** 字体文件里的名字授权表都查不到时，退回去按文件名前缀匹配授权表。
  - 同一份字节（内部名「Totally Unknown Font」），命名成 `font.ttf` 会被拒绝；命名成 `LXGWWenKai-Regular.ttf` 或 `MiSans-Bold.ttf` 就会被放行并导出。
  - 署名提示里写的还是「「Totally Unknown Font」的授权要求署名」。
- **为什么是 High：**
  - PRD §5.4（以及刚写进 PRD 的 C27）写的是「按字体文件里的名称元数据去查授权表」「按字体文件 name 表里的名字…查授权表」，没有文件名这一说。
  - 报告 §4 第 3 条、`CARD_PLAN.md` 第 44 行也只说按 name 表。
  - 改文件名是最容易发生的误操作，这是一条没有披露的授权放行路径。
  - 夹具全部叫 `font.ttf`，所以没有一条测试走到这个分支。
- **修法：**
  1. 删掉 `?? matchFontFile(file)`。内部名查不到，一律按 F-UNKNOWN 拒绝。
  2. 加夹具：内部名未知、文件名伪装成授权表里的字体 → `rejected`，并断言不写 PNG。
- **复现：** 用 `makeTtf({ family: "Totally Unknown Font", chars })` 生成同一份字节，分别存成下面三个文件名；页面用 `font-family: "Totally Unknown Font", "LXGW WenKai", serif`。真实输出：

  ```
  fname-allowed LXGWWenKai-Regular.ttf {"status":"exported","png":true,"fonts":[{"family":"Totally Unknown Font","file":"fonts/LXGWWenKai-Regular.ttf","license_id":"lxgw-wenkai","allowed":true,"used":true,...}],"attribution":[],"problems":[]}
  fname-neutral font.ttf {"status":"rejected","png":false,"fonts":[{"family":"PingFang SC",...,"allowed":false},{"family":"Totally Unknown Font","file":"fonts/font.ttf","allowed":false,"reason":"授权表里没有「Totally Unknown Font」（F-UNKNOWN）…"}]}
  fname-misans MiSans-Bold.ttf {"status":"exported","png":true,"fonts":[{"family":"Totally Unknown Font","file":"fonts/MiSans-Bold.ttf","license_id":"misans","allowed":true,...}],"attribution":["Totally Unknown Font"],"problems":[]}
  ```

### CA-04 · High · 页面自带的 `data:` / `blob:` / FontFace API 字体没有被拦截，还被记成「系统字体」

- **位置：**
  - `packages/cli/src/card.ts:201-251`：`context.route` 拦不到 `data:` URL、`blob:` URL，也拦不到 `new FontFace(name, ArrayBuffer)`，这几种方式都不发网络请求；
  - `card.ts:351-360`：`isCustomFont` 为 true、但对不上 `font_dir` 的字体，交给 `judgeSystemFont`，按名字查授权表，并写成 `source: "system"`。
- **问题：** PRD §5.4（C27）写的是「`card` 命令只使用 `font_dir` 里用户自己准备的字体文件」「卡片页面自己用 `@font-face` 引用的字体文件一律拦截」，`xhs-card.md:37` 也这么告诉用户。实际情况：

  | 用例 | 写法 | 结果 |
  |---|---|---|
  | A23 | `@font-face { font-family: "Noto Sans SC"; src: url(data:font/ttf;base64,…) }` | `exported`；fonts 里多出 `Noto Sans SC|system|allowed=true`，`blocked` 为空 |
  | A24 | 脚本把 base64 转成 Blob，再用 `url(blob:…)` 声明 | 同上，`exported` |
  | A18、A20 | `data:` 和 FontFace API，内部名查不到 | 被拒绝，但原因写成「浏览器用了系统字体「Fake Display」」，字体来源写错了 |

  锁定夹具 K-page-fontface 测的正是「页面自带一份内部名为 Noto Sans SC 的字体 → 拦截 → 拒绝」。换成 `data:` 写法，同样的内容就能导出。
- **为什么是 High：**
  - PRD 写明的约束（只用 `font_dir`、页面自带字体一律拦截）被绕过；
  - 结果 JSON 对字体来源的描述是错的（`source: "system"`），用户会以为用的是本机系统字体；
  - 从网页里复制带 base64 字体的模板，是很常见的做法。
- **修法：**
  1. `isCustomFont === true`、但对不上「本次注入的 `font_dir` 字体」时，一律拒绝，原因写「页面自带的字体（data:/blob:/FontFace），card 只使用 font_dir」。
  2. 在隔离环境里枚举 `document.fonts`，凡不是注入的那批 FontFace，判 `rejected`。
  3. 加 `data:`、`blob:`、FontFace API 三个夹具。
- **复现：** A23 页面，真实输出：

  ```
  A23-data-allowed-name-not-in-fontdir {"status":"exported","png":true,"fonts":["LXGW WenKai|font_dir|allowed=true|used=true|glyphs=23","Noto Sans SC|system|allowed=true|used=true|glyphs=8"],"blocked":[],"problems":[],"lintErrors":0}
  A24-blob-fontface-noto {"status":"exported","png":true,"fonts":["LXGW WenKai|font_dir|allowed=true|used=true|glyphs=23","Noto Sans SC|system|allowed=true|used=true|glyphs=8"],"blocked":[],"problems":[],"lintErrors":0}
  ```

### CA-05 · High · lint 和导出是两次不同的渲染，D-C2「有 error 不导出」可以被纯 CSS 绕过

- **位置：**
  - `packages/cli/src/card.ts:325`：`runRender({ …, widths: [CARD_WIDTH] })`，视口高度用 `render.ts:23` 的 `VIEWPORT_HEIGHT = 800`，不注入 `font_dir` 字体，网络规则也和导出不同；
  - `card.ts:195`：导出用的是 1080×1440、注入字体。
- **问题：**
  - 1080×800 是横向，1080×1440 是竖向。只在竖向或高视口下生效的样式，lint 看不到，导出时才生效。
  - 页面脚本还能检测注入的 `#__measure_card_fonts`，只在导出那次改内容（A28）。

  | 用例 | 写法 | 结果 |
  |---|---|---|
  | A30 | `@media (orientation: portrait) { .po { font-size: 11px; line-height: 1.2; } }` | lint 0 error，`exported`。PNG 里是 11px、行高 1.2 的中文，违反 T11、T06 |
  | A27 | `@media (min-height: 1000px) { .mq { font-style: italic; font-size: 10px; letter-spacing: -0.2em } }` | lint 0 error，`exported` |
  | A29 对照 | 同样的样式不加媒体查询 | `rejected`，「卡片有 3 条 lint error」 |

- **为什么是 High：**
  - D-C2 和 AC-9 的「lint 零 error」，认证的是另一次渲染。
  - 执行方报告 §4 第 5 条只说「行长等可能略有出入」，低估了这个问题：这不是测量误差，是规则结论可以完全不同。
  - `orientation: portrait` 在竖版卡片里是正常写法。
- **修法：** 卡片 lint 必须和导出共用同一次渲染的条件。
  - 视口 1080×1440、注入同一批字体、同样的拦截规则；
  - 最好在导出那次渲染里直接跑完整档的测量；
  - 至少要给 `runRender` 加上视口高度参数和字体注入，并加 A27、A30 这样的夹具。
- **复现：** A30 页面，真实输出：

  ```
  A30-lint-orientation {"status":"exported","png":true,"fonts":["LXGW WenKai|font_dir|allowed=true|used=true|glyphs=31"],"blocked":[],"problems":[],"lintErrors":0}
  A29-control-italic {"status":"rejected","png":false,...,"problems":["卡片有 3 条 lint error"],"lintErrors":3}
  ```

### CA-06 · High · 点名要用的 🔴 字体不在 `font_dir` 里时，静默导出（与 PRD C27 的例子相反）

- **位置：** `packages/cli/src/card.ts:363-366`、`card.ts:377`。「点名要用但不允许」只对 `font_dir` 里的文件判断。
- **问题：** PRD §5.4（C27，已写进 PRD）原文：
  > 例如 `font-family` 里写了方正兰亭黑，即使浏览器回退到了别的字体，也不出图，并说明原因、附原文链接（对应场景 S2）

  A26 写的是 `.red { font-family: "方正兰亭黑", "LXGW WenKai", serif }`，`font_dir` 里只有 LXGW WenKai。结果是 `exported`，`problems` 为空，完全没提方正兰亭黑。只有把方正兰亭黑的文件也放进 `font_dir`（K-red 夹具）才会拒绝。
- **为什么是 High：** 实现与刚确认的 PRD 条文直接矛盾。场景 S2（用户点名要方正兰亭黑）下，用户拿到的是一张换了字体、却没有任何提示的卡片。
- **修法：**
  1. 遍历时收集所有元素和伪元素计算后的 `font-family`，每个名字都过一遍 `matchFontName`。命中条目、但 `commercial_image !== true` 的，不管在不在 `font_dir`，都拒绝，原因附原文链接。
  2. 加夹具「点名 🔴 字体、`font_dir` 里没有这份文件」。
- **复现：** A26 页面，真实输出：

  ```
  A26-requested-red-not-in-fontdir {"status":"exported","png":true,"fonts":["LXGW WenKai|font_dir|allowed=true|used=true|glyphs=31"],"blocked":[],"problems":[],"lintErrors":0}
  ```

### CA-07 · Medium · 「安全」测试只断言退出码 2，5 项检查里有 2 项被别的检查掩盖

- **位置：** `test/card.test.js` 的「安全：font_dir 在工作区外或是符号链接…」那一项。
- **问题：** 审计方在仓库副本里逐条把 `dist/card.js` 的 `throw new UsageError(` 换成 `void (`，再跑这一项测试：

  | 删掉的检查 | 结果 |
  |---|---|
  | `--out` 在工作区外（`card.js:35`） | **仍然通过**：卡片 lint 的截图目录 `dirname(out)/evidence` 在工作区外，被 `evidenceTarget` 拦下，同样是退出码 2 |
  | `--out` 不是 .png（`:38`） | 失败（测到了） |
  | 已有文件不是 PNG（`:55`） | 失败（测到了） |
  | `font_dir` 是符号链接（`:92`） | **仍然通过**：realpath 之后在工作区外，被下一条检查拦下 |
  | `font_dir` 在工作区外（`:97`） | 失败（测到了） |

  另外两点：
  - 测试用的 `font_dir` 是空目录，卡片永远会被拒绝，所以「不写任何文件」「notes.png 没被覆盖」这两条断言在任何情况下都成立，等于没测；
  - 指向工作区**内**的符号链接 `font_dir` 完全没有测。
- **为什么是问题：** 执行方说实现之后，这项测试「真正测到安全检查」。实际只测到 3/5，而且断言不看原因：任何内部错误、超时，退出码都是 2。
- **修法：**
  1. 每个用例都断言 stderr 里有对应的中文原因。
  2. 用能导出的字体做「已有非 PNG 文件」这个用例，让「不覆盖」的断言有意义。
  3. 加「工作区内的符号链接 font_dir」用例。
- **复现：** 见 §4 的变异测试输出。

### CA-08 · Medium · 报告和文档的说法与实际不符

- **位置和问题：**
  1. `VERIFICATION_REPORT.md` §1 在 `4086c00` 里先改成「执行方自评：达标（以 `results.json` 的机器判定为准）」，当时 `results.json` 还是 `"git_head": "d0cfc2e…"`、`"verdict": "未达标"`；直到 `4f851f7` 才补跑成「达标」。
     - 结论先于机器判定，这次的顺序问题已经补上。
     - 更要紧的是，验证脚本的 CV-01 到 CV-09 全部测不到 CA-01 到 CA-06，所以 `4f851f7` 的「达标」是覆盖不足造成的伪达标。
  2. `skills/measure/references/scenarios/xhs-card.md:37`、PRD C27 写「卡片页面自己用 `@font-face` 引用的字体文件会被拦截」，与 CA-04 不符。
  3. 报告 §4 第 3 条和 `CARD_PLAN.md:44` 只说按 name 表查授权表，没有披露文件名兜底（CA-03）。
  4. 报告 §5「伪成功扫描：未发现」只是关键字扫描，行为层面的伪成功见 CA-01 到 CA-06。
  5. `evidence/real-font/*.png` 不是验证脚本生成的：`verify-w2-card.mjs` 只写到 `../deliverables/card-samples/`，这些 PNG 是手工复制过来的。审计方核对过，哈希与最新一次运行一致。
- **为什么是问题：** 证据三件套之间要能互相印证。结论先改成「达标」、机器判定还停在「未达标」，违反「不谎报完成」。
- **修法：**
  1. 修完 CA-01 到 CA-06 后重跑验证脚本，报告结论以新的 `results.json` 为准；
  2. 文档里的拦截范围、判定口径按实际实现写；
  3. 验证脚本自己把样张复制进 `evidence/real-font/`，并在日志里记哈希。

### CA-09 · Low · `incomplete` 时 `problems` 可能为空

- **位置：** `card.ts:381-384`。lint 的 `summary.status` 为 `incomplete` 时，没有把原因（例如 `cjk-in-frame`）写进 `result.problems`。
- **复现：** A11（iframe srcdoc 里有中文）的输出是 `"status":"incomplete","problems":[]`，原因只在 `lint.run.render.problems` 里。
- **修法：** 把 `lint.run.skipped_inputs` 和 `lint.run.render.problems` 的原因追加到 `problems`。

### CA-10 · Low · 卡片 lint 的截图悄悄写进 `--out` 旁边的 `evidence/`，被拒绝时也写

- **位置：** `card.ts:325`，`evidenceDir: join(dirname(outReal), "evidence")`。
- **问题：** A16 被拒绝后，工作区里多了 `evidence/T13-001.png`；同名文件会被覆盖。命令说明、`xhs-card.md`、PRD C28 都没提这件事。
- **修法：** 在结果 JSON 里写明截图目录（或者提供 `--evidence-dir`），并在 `xhs-card.md` 里说明。

### CA-11 · Low · 配置文件里的 `font_dir` 按 cwd 解析，不按工作区或配置文件所在目录

- **位置：** `card.ts:126` `resolve(cwd, dir)`、`card.ts:321`。
- **复现：** 工作区根目录有 `measure.config.json`，内容为 `{"font_dir":"fonts"}`。
  - 在根目录运行，退出码 0；
  - 在 `sub/` 下运行 `card card.html --out b.png --root ..`，输出 `错误：font_dir 不存在：fonts`，退出码 2。
- **修法：** 来自配置的 `font_dir` 相对配置文件所在目录（或 root）解析；命令行参数仍相对 cwd。

### CA-12 · Low · 关闭卡死的页面没有时间上限（K-04 的成因）

- **位置：**
  - `render.ts:246-257`：`withDeadline` 超时后 `context.close()` 不等待；
  - `card.ts:302-305`：`finally` 里 `await context.close()`、`await browser.close()` 都没有时间上限。
- **问题：** `evidence/CV-09-first-run-flaky.log` 里，预算 3 秒的死循环页面总共用了 33.4 秒，与「关闭被卡住」吻合。审计方在低负载下跑 card 的死循环页面（`MEASURE_RENDER_BUDGET_MS=3000`），9 秒、退出码 2、`incomplete`，结果正确，但时长没有保证。
- **修法：** 关闭操作加上时间上限，超时后 `browser.process()?.kill("SIGKILL")`；测试阈值不变。

### CA-13 · Low · 内存：全部字体的缓冲区都留到渲染结束；WOFF2 小文件可以触发 256 MB 的解压

- **位置：**
  - `card.ts:153、162`：被拒绝的字体、TTC 的每一款都留着 `buf`；
  - `fontfile.ts:192`：`maxOutputLength` 是 256 MB。
- **问题：**
  - 50 个 64 MB 的文件最多常驻 3.2 GB；
  - 一个 57 KB 的 WOFF2 就能让解压分配到 256 MB 才报错，实测 105 ms，RSS 867 MB。
  - 没有越界，也没有抛出异常（20,000×4 次变异模糊测试：0 次抛出，最长 5.6 ms）。
- **修法：**
  - 只给放行的字体留 `buf`；
  - WOFF2 先用目录里 name、OS/2 的偏移和长度算出需要的解压长度，`maxOutputLength` 取「到 name 表结束」的长度。

### CA-14 · Low · 引语卡的大引号视觉偏弱

- **位置：** `skills/measure/assets/cards/quote.html:32`，`.mark { font-size: 120px; line-height: 1 }`。
- **问题：** 霞鹜文楷的「“」字形只占字身左上角一小块。真实字体样张 `evidence/real-font/quote.png` 里，引号只有约 35px 高，和正文之间留出约 130px 的空白，看起来与引文脱节。
- **修法：** 调小 `line-height` 和下边距，或者改用 `margin-bottom: -0.4em` 让引号贴近正文。看过样张再定。

### 已核实、未发现问题的项

- **`fontfile.ts` 的鲁棒性：**
  - TTF、WOFF、WOFF2、TTC 各 20,000 次随机变异：0 次抛出，全部返回 `error` 或正常结果；
  - WOFF1 inflate 炸弹（200 MB）、WOFF2 brotli 炸弹（300 MB）都在 256 MB 上限内报错；
  - Base128 溢出返回 error；
  - name 表记录数上限 2000，TTC 款数上限 256。
- **路径：**
  - `--out` 在 `.git` 里、是符号链接、是非 PNG 文件都会拒绝；
  - `font_dir` 先取 realpath 再判断是否在工作区内；
  - `font_dir` 里的符号链接文件会被跳过。
- **网络：** 工作区外的 `file://`、http(s)、WebSocket 都会被拦截；加载后的跳转被拦截，结果判 `incomplete`。
- **退出码：**

  | 情形 | 退出码 |
  |---|---|
  | 导出 | 0 |
  | 拒绝（不写 PNG） | 1 |
  | 超时 | 2 |
  | 用法错误 | 2 |

  `--result` 用原子写入。
- **`local()` 别名：** `local()` 给系统字体起别名（A16、A17），或者用 `data:` 字体冒充授权表里的名字、内部却是 🔴 字体（A19），CDP 报的都是字体内部的真实名字，都被正确拒绝。
- **模板：**
  - 没有紫色渐变、玻璃拟态、emoji 图标；
  - 强调色只有青瓷 `#7e8c6b` 和朱砂 `#9e4b3b` 两个；
  - 留白充足；
  - 真实字体样张没有标点在行首、错误断行或缺字。

---

## 3. 对执行方报告 §6 的逐条裁定

| # | 问题 | 裁定 |
|---|---|---|
| 1 | RULING-08：锁定后修改 `test/helpers/font.js` 的去重逻辑 | **同意，没有放宽测试。** 改动只是让生成器生成合法字体：旧代码在已经含空格的字符列表后面再补一个 0x20，cmap 出现重复的段。测试断言一个字没改；K-fallback 的「部分覆盖」只取前 4 个字，不含空格，不受影响。审计方在仓库副本里换回 `bb045d8` 的生成器，`card 夹具 K-pass` 失败，原因是回退到 PingFang SC 被拒绝；换回 HEAD 的生成器后通过，与 RULINGS.md 的描述一致。请登记为「审计方同意」 |
| 2a | 卡片点名要用、但不允许出图的字体：即使回退到别的字体也不出图 | **原则同意。** 但现在只对 `font_dir` 里的文件生效，与 PRD C27 的例子矛盾，按 CA-06 修 |
| 2b | `font_dir` 里没被点名的不合规字体，只列出、不影响导出 | **同意。** 没有被渲染、也没有被点名的字体不构成使用；结果里列出来，提示性也够了 |
| 3 | 系统字体回退的平台差异要不要写进 PRD | **要写**，在 §5.4「卡片导出的字体」加一句：同一张卡片在不同系统上结论可能不同，结果以运行环境为准（`lint.run.render.browser` 已经记录了浏览器）。属于文档补充，不单独计为发现 |
| 4 | 两次渲染的出入是否可以接受 | **不接受。** 这不是「略有出入」，规则结论可以完全不同，而且能被纯 CSS 利用，见 CA-05 |
| 5 | K-04 偶发超时要不要处理 | **要处理，但不阻塞本轮。** 成因和修法见 CA-12；修完后在高负载下（与 CV-08 并行）跑 3 次全量测试，留日志 |

---

## 4. 审计方亲自跑过的命令和关键输出

1. 构建和全量测试（HEAD `40f7bb2`）：

   ```
   $ cd measure-cjk && npm run build && npm test
   已同步 2 个文件到 packages/cli
   ℹ tests 243
   ℹ pass 243
   ℹ fail 0
   ℹ duration_ms 103616.56275
   EXIT=0
   ```

2. 对抗页面（`/tmp/audit-card/run.mjs`，调用 `runCard`）的汇总：

   ```
   A00-control-pass exported     A01-control-reject rejected
   A02-before-empty exported ✗   A03-before-on-text rejected
   A04-input-value exported ✗    A05-placeholder exported ✗
   A06-textarea exported ✗       A07-select exported ✗
   A08-svg-text rejected         A09-shadow-script exported ✗
   A10-shadow-declarative exported ✗   A11-iframe-srcdoc incomplete（problems 为空）
   A12-canvas exported ✗         A13-img-svg exported ✗
   A14-animation-fastforward exported ✗   A15-observer-style-inject exported（PNG 为方框，未构成绕过）
   A16/A17 local() 别名 rejected  A18 data: 未知名 rejected（source 记成 system）
   A19 data: 冒名 rejected        A20 FontFace API rejected（source 记成 system）
   A21-marker rejected           A22 data: 同名 rejected（因 T13 lint error）
   A23 data: Noto Sans SC exported ✗   A24 blob: Noto Sans SC exported ✗
   A25 iframe 西文 Helvetica Neue exported ✗
   A26 点名方正兰亭黑、font_dir 里没有 exported ✗
   A27 min-height 媒体查询 exported ✗   A28 脚本检测注入 exported ✗
   A29 对照 rejected（3 条 lint error）  A30 orientation: portrait exported ✗
   ```

   ✗ 表示伪成功：PNG 已写出，但用了不允许的字体，或含有 lint error 的内容。凡是涉及字体的 ✗，审计方都把 PNG 裁出来看过，确认是苹方的真实字形，不是方框。

3. 真实字体（霞鹜文楷 v1.530）、命令行：

   ```
   $ node …/measure-cjk.js card quote.html --out q.png --font-dir fonts
   quote exit=0
   已导出：q.png（1080×1440）
   ✓ LXGW WenKai（font_dir：fonts/LXGWWenKai-Regular.ttf，用了 42 个字形）

   # quote.html 的 .mark 改成空元素加 ::before { content: "引语"; font-family: "PingFang SC"; }
   attack2 exit=0
   exported qa2.png [["LXGW WenKai","font_dir",true,41]] 0     ← PNG 上「引语」两个字是苹方
   ```

4. 文件名兜底，见 CA-03 的输出。

5. 退出码：

   ```
   pass exit=0
   reject exit=1 png=          ← 拒绝时没有写 PNG
   loop exit=2 secs=9          ← MEASURE_RENDER_BUDGET_MS=3000，死循环页面
   incomplete ["卡片渲染超过 3 秒，没有检查完"] incomplete
   ```

6. 字体解析的模糊测试和解压炸弹：

   ```
   { total: 80000, ok: 28716, errs: 51284, throws: 0, maxMs: '5.6' }
   woff2 bomb 57176 bytes -> Cannot create a Buffer larger than 268435456 bytes 105ms rss MB 867
   woff1 bomb 203912 bytes -> 字体文件里没有家族名（name 表的 1、16 号） 117ms rss MB 725
   base128 overflow -> unexpected end of file
   ```

7. CDP 探针（验证 CA-01 修法可行；`DOM.getDocument({ depth: -1, pierce: true })`，遍历 children、pseudoElements、shadowRoots，对每个元素调用 `getPlatformFontsForNode`）：

   ```
   DIV |  | PingFang SC:2
   ::before | before | PingFang SC:2
   INPUT |  | PingFang SC:3
   DIV |  | PingFang SC:3        ← input 的 user-agent shadow
   DIV |  | Songti SC:2          ← 脚本创建的 shadow host
   P |  | Songti SC:2
   ```

8. 变异测试（仓库副本 `/tmp/audit-card/mut`，逐条去掉 `dist/card.js` 的安全检查，跑「安全」那一项）：

   ```
   去掉 :35 工作区外 --out        → ok（仍然通过，被 evidence 目录检查掩盖）
   去掉 :38 非 .png              → not ok（测到了）
   去掉 :55 已有的非 PNG 文件      → not ok（测到了）
   去掉 :92 font_dir 是符号链接    → ok（仍然通过，被 realpath 检查掩盖）
   去掉 :97 font_dir 在工作区外    → not ok（测到了）
   ```

9. RULING-08 复现（仓库副本）：

   ```
   bb045d8 的生成器：not ok 1 - card 夹具 K-pass：exported
     {"status":"rejected","fonts":[["PingFang SC","system",false,"浏览器用了系统字体「PingFang SC」…"]]…}
   HEAD 的生成器：   ok 1 - card 夹具 K-pass：exported
   ```

10. 证据核对：
    - `evidence/real-font/*.png` 与 `../deliverables/card-samples/*.png` 的 SHA-256 一致（cover/example `13d27e4f…`，list `8860d01a…`，quote `279121f0…`）；
    - 真实字体 SHA-256 `2d73eea9…7fc8b`，与脚本一致；
    - `bb045d8` 之后，`test/` 下只改了 `test/helpers/font.js` 的 2 行，夹具目录没动；
    - 实现前的测试日志是 20 项失败、1 项通过，与报告一致。

---

## 5. 给执行方的下一轮要求

1. 逐条修 CA-01 到 CA-06。每一条先加锁定夹具（写于修复之前，单独登记 MANIFEST），断言 `rejected` 或 `incomplete`、并且不写 PNG，再改实现。
2. CA-07、CA-08 一并修完；CA-09 到 CA-14 可以在本轮修，也可以登记为已知问题，但要在审计响应矩阵里逐条回应。
3. 在干净工作树上重跑 `verify-w2-card.mjs`：结论以新的 `results.json` 为准，报告不能先于机器判定。
4. 提交审计响应矩阵，回应本文全部 14 条和 §3 的 5 项裁定，交审计方复核。
