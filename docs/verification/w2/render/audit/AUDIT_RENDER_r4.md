# W2 完整档（`lint --render`）第 4 轮复核 · AUDIT_RENDER_r4

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」，第 4 轮 |
| 审计方 | Claude Code（独立会话，不采信执行方自述，以代码、命令输出、git 历史为准） |
| 审计对象 | 在 `4b6d66e` 之后：`eb39212`（锁定复现夹具和测试）→ `721b80b`（整改）→ `5fb9ab9`、`759d991`（报告和验证结果）。审计时 HEAD = `759d991` |
| 上一轮 | `AUDIT_RENDER_r3.md`：未达标（实质为有条件达标），4 Medium、1 Low |
| 审计日期 | 2026-10-26 |
| 审计方改动 | 只新建本文件。对抗页面放在 `/tmp/r4audit/`，跑完已删除；`git status --porcelain` 只多出本文件 |

---

## 1. 结论

**未达标。**

### 1.1 流程性原因（与代码质量无关）

R-D1、R-D2 两项 PRD 变更仍未经用户拍板（`open_decisions.json` 中 `resolved: false`）。按项目规则，这一条本身就让结论为「未达标」。执行方的 `results.json` 也如实判了「未达标」。

### 1.2 实质原因：未达标

第 3 轮的 5 条发现（RC-01 至 RC-05）在第 3 轮的复现页上都修好了，对照组 codex「保留且重复」的条数从 15 降到 0，详见 §3。

但这轮为修 RC-01、RC-03 新加的两条对应规则，各自打开了一条伪通过路径。同一页面，基础档或页面实际显示的内容有 error，完整档却判通过、退出码 0：

| 严重度 | 条数 | 编号 |
|---|---|---|
| Blocker | 0 | — |
| High | 2 | RD-01、RD-02 |
| Medium | 0 | — |
| Low | 2 | RD-03、RD-04 |

**必改清单：**

1. **RD-01**：用于去重的 `hits` 是「同一选择器**或**同一文字、同一规则、**任何级别**」。只要可见的同名元素有一条 warn，折叠区里那个元素的基础档 error 就会被删掉。
2. **RD-02**：判断 DOM 快照补报的结论是不是「源码里已有」，用的是「6 个字以上的公共片段」。源码文字很短时，门槛会降到 1 个字。脚本在源码元素上追加、改写出来的问题因此全部漏报。
3. 用户对 R-D1、R-D2 拍板。

---

## 2. 发现清单

复现页面写在 `/tmp/r4audit/` 下，调用 `runRender` 和 `runLint`（`npm run build` 之后的 `packages/cli/dist/index.js`）。下文的通用样式指 `:where(:lang(zh)) { line-break: strict; font-synthesis-style: none; text-autospace: normal; } body { font-family: "Inter", "PingFang SC", sans-serif; font-size: 16px } main { max-width: 36em } p, li { line-height: 1.75 }`。

### RD-01 · High（伪成功）· `hits` 按「同一选择器或同一文字、任何级别」判定，能删掉不可见元素的基础档 error

- **位置：** `packages/cli/src/render.ts`：
  - 测量循环里 `outcome.hits.add(\`${it.rule}|s|${it.selector}\`)`、`outcome.hits.add(\`${it.rule}|t|${it.text}\`)`，对所有 `items` 都记，包括 warn；
  - `staticVerdict` 里 `if (out.hits.has(\`${f.rule}|s|${f.selector}\`) || (t && out.hits.has(\`${f.rule}|t|${t}\`))) return { drop: true };`。
- **问题：** 第 3 轮的修法建议是「完整档已经对**同一元素**报了同一规则的，就不再保留基础档那条」。实现放宽成了「同一选择器**或**同一文字指纹」，而且完整档报的是 warn 也算数。结果，任何一个可见、同选择器或同文字、只有 warn 的元素，都能让另一个元素（例如折叠区、对话框里的）的基础档 error 被删掉。
  - T11 的 warn 是「正文字号小于 14px」，T06 的 warn 是「行高不在 1.6–1.9」，这两种 warn 在真实页面上很常见。
- **为什么是问题：**
  - 同一页面，基础档退出码 1，完整档退出码 0，属于 RB-02 那一类伪通过。
  - 执行方报告 §7 第 2 条说「这时页面已经因为同一规则、同一选择器失败，不会变成伪通过」，这句话不成立：完整档报的只是 warn，页面不会失败；而且按文字指纹也能命中，不只是选择器撞车。
  - 对照组里也已经出现了按文字删除别的元素的情况。023 页 `select#departure` 的第 9 个 `<option>`「无需通勤」，它的 T11 error 被一个同文字、由脚本生成的可见单选项（`span.choice-box`，11px）删掉了。那个单选项自己也报了 error，所以这一页没有变成通过，但删除依据不是「同一元素」。
- **复现：**

  ```
  S = "同一句话出现在折叠区和正文里，用来测试对应关系。"

  hit-text-t11.html：<main><details><summary>展开</summary><p style="font-size:10px">S</p></details><p style="font-size:13px">S</p></main>
  == hit-text-t11.html | static: fail ["T11"] | render: pass e=0 [["T05","warn",…],["T11","warn","main > p",3,"正文字号 13.0px，建议不小于 14px。"]]

  hit-text-t06.html：折叠区里 <p style="line-height:1.0">SS</p>，正文 <p style="line-height:2.0">SS</p>
  == hit-text-t06.html | static: fail ["T06"] | render: pass e=0 [["T06","warn","main > p",3,"正文行高 2.00，建议在 1.6–1.9 之间。"]]

  hit-sel-t11.html：两个 section > … > div > div > div > p.x（选择器相同），折叠里的 10px，可见的 13px
  == hit-sel-t11.html | static: fail ["T11"] | render: pass e=0 [["T11","warn","div > div > div > p.x",3,"正文字号 13.0px，建议不小于 14px。"]]
  ```

- **修法：**
  1. `hits` 改用元素身份 `选择器 + \u0001 + 文字指纹`（和 `ids`、`checked` 同一口径）。只有完整档对**这个身份**报了同一规则，才认为已经报过。
  2. 选择器对不上、只能按文字找的情况，必须同时满足两条才能删：浏览器里这个文字指纹只对应一个元素；完整档对它报的级别不低于基础档这条（error 只能被 error 取代）。
  3. 三个复现页各补一个先失败的测试。报告 §7 第 2 条的说法按实际行为更正。

### RD-02 · High（伪成功）· 「6 个字以上的公共片段」让脚本追加、改写出来的问题被当成「源码已有」而漏报

- **位置：** `render.ts` 的 `staticPass` 中 `fresh` 的 `corresponds` 判断：

  ```js
  srcPairs.has(`${sel}\u0001${t}`) || srcTexts.has(t) ||
  (srcBySel.get(f.selector) ?? []).some((x) => commonRun(x, t) >= Math.min(6, x.length, t.length))
  ```

- **问题：** 这条规则本来是为了消除 RC-03 的重复：源码元素的文字被脚本改了一点，源码和 DOM 快照各报一次。但它判断的是「这个元素在源码里有没有对应」，不是「这条结论在源码里有没有报过」。只要对应上了，DOM 快照里这个元素的所有结论都不补报。具体有三种漏报：
  1. **脚本在源码元素后面追加文字：** 追加部分有问题，源码没有，结论又被当成「源码已有」丢掉。
  2. **脚本把同一选择器的源码段落换成新文字，新旧文字有 6 个字相同：** 新文字的问题全部漏报。
  3. **门槛是 `Math.min(6, x.length, t.length)`，源码文字很短时门槛跟着变小：** 源码是 `<p>无</p>`、`<span>暂无</span>` 这类 1–2 个字的占位时，新文字只要含这个字就算「对应上了」。

  而 T01、T03、T09、T13 这些规则完整档不重新检查，只能靠 DOM 快照补报，漏掉就是漏掉。
- **为什么是问题：** 和 RB-01 是同一类伪成功：页面实际显示的中文有 error（半角标点、字体栈没有中文字体等），结果却是通过、退出码 0。
- **复现：**

  ```
  append.html：<main><p>这是源码里一段完全正确的中文。</p></main>
               <script>p.textContent += "脚本追加的内容,用了半角逗号"</script>
  == append.html | static: pass [] | render: pass e=0 []

  replace-common.html：<main><p>欢迎来到我们的网站首页。</p></main>
                       <script>p.textContent = "欢迎来到我们的网站,今天的内容是半角逗号"</script>
  == replace-common.html | static: pass [] | render: pass e=0 []

  short-src.html：<main><p>无</p></main><script>p.textContent = "无论如何,这段脚本内容有半角逗号"</script>
  == short-src.html | static: pass [] | render: pass e=0 []
  ```

  对照：把同样的最终文字直接写进源码，基础档会报 T03 error。
- **修法：**
  1. 判断粒度从「元素」改成「结论」：DOM 快照的一条结论，只有在源码对**对应元素**报了**同一规则**时才不补报。同一规则的消息不同（比如片段文字变了），只保留源码那条，因为它带行号。源码对这个元素没有报这条规则的，一律补报。
  2. 公共片段的门槛不能低于一个固定下限（例如 6 个字）。源码文字比下限短时，只认「文字完全相同」。
  3. 三个复现页各补一个先失败的测试；RC-03 的 `text-tweak.html` 仍然不能重复报。

### RD-03 · Low · RULING-07 之后，通用的「不重复」断言依赖实现自己给出的文字指纹

- **位置：** `test/w2-render-audit-r3.test.js` 的 `assertNoDuplicates`：键里用的是 `f[EL_TEXT] ?? ""`。
- **问题：** 「同一元素」的判断改成「选择器 + 实现写在结论上的文字指纹」之后，如果实现漏写了某类结论的指纹（值为 `undefined`），或者两边算出的指纹不一致，重复报告会因为键不同而测不出来。断言的正确性因此依赖被测对象本身。
  - 审计方在 golden 和对照组 60 页上统计过：带选择器、但没有指纹的 error 为 0 条，按这个口径的重复也是 0 条。所以目前没有实际漏测。
- **修法：** 在通用断言里加一条：每条带选择器的 error 都必须有非 `undefined` 的 `EL_TEXT`。另外对同一选择器、只是指纹不同的两条 error，打印出来供人工核对，而不是直接放过。

### RD-04 · Low · 报告 §7 第 2 条的说法与实际行为不符

- **位置：** `VERIFICATION_REPORT.md` §7 第 2 条：「选择器超过 4 层撞车时，可能把另一个元素的基础档结论也去掉。不过这时页面已经因为同一规则、同一选择器失败，不会变成伪通过。」
- **问题：** 按文字指纹相同也会删除；完整档报的是 warn 也会删除，这时页面不会失败。RD-01 的三个复现页都是伪通过。
- **修法：** 修完 RD-01 后，按实际判定规则重写这一段。

---

## 3. 第 3 轮发现逐条复核

| 编号 | 第 3 轮严重度 | 复核结论 | 依据（真实输出摘录） |
|---|---|---|---|
| RC-01 | Medium | **修好**（但 `hits` 的放宽造成了 RD-01） | `tw-opt.html \| render: pass e=0 []`；`resp.html \| render: fail e=1`，同一元素只有一条 T11。codex 组重跑：保留 9 条；按审计口径（同页、同规则、同选择器，T02/T04 按同页同规则）和完整档重复 **0 条**；第 3 轮是 25 条里 15 条重复 |
| RC-02 | Medium | **修好** | `f-remote.html \| render: pass`；URL 页面嵌被拦截的 `https://example.com/` iframe → pass，地址记进 `remote_refs`；`redir.html` → incomplete（unreadable），结果里不再有来自错误页的结论 |
| RC-03 | Medium | **修好**（但对应规则过宽，造成了 RD-02） | `text-tweak.html` 只剩源码的 T03、T13 两条；`dup-deep.html` 里脚本插入段落的 T03 报出来了（「脚本插入的段落,也有半角逗号」） |
| RC-04 | Medium | **修好** | 报告 §3 的 799 张截图、保留 9 条、其中 0 条重复，与审计方重跑一致。9 条保留的原因逐条核对属实：023 页 5 个 `<option>`、022 页关着的对话框、007 页的 `caption`、007 页 2 个被高亮脚本改写的代码块 |
| RC-05 | Low | **修好** | `test/w2-render-audit-r3.test.js` 有通用的「不重复」断言，对全部审计夹具执行（口径见 RD-03） |

另外核对过、没有发现问题的部分：

- **锁定后只改了一处测试：** `git diff eb39212 HEAD -- test/` 只有 `assertNoDuplicates` 的键（RULING-07）；夹具目录 `w2-render-audit-r3` 的 MANIFEST 校验全部 OK。整改前的证据为 8/8 失败。
- **前几轮的复现页没有回退：** RA-01、RA-02 的对抗页、`spa-placeholder`、`vertical-lh`、`collide`（基础档结论保留）、`blob:` 和 `javascript:` 跳转，结果都和第 3 轮一致。
- **撤回 DOM 快照结论的时机：**
  - 解析阶段就跳到 `blob:`：判 navigated，DOM 快照补报的结论被撤回，结果里一条都没有留下；
  - 测量完之后才跳转（`setTimeout` 300ms）：测到的是原页面，补报的结论保留，判 fail。

  两种都合理。
- **语言固定为 zh-CN：** 没有发现新的误报或漏报。按 `navigator.language` 切换语言的页面，现在固定显示中文版，结果不再随操作系统变化。这对面向中文读者的页面是合适的口径，见 §4 第 3 条。
- **golden 20 页：** `{"errors":0,"warns":3,"status":"pass"}`，没有保留下来的基础档结论，也没有 DOM 快照补报的结论。
- **对照组：**
  - claude-code：211 个 error，排除 T02/T04 后零 error 9/30，保留 0 条；
  - codex：799 个 error、799 张截图，保留 9 条，重复 0 条。

  都与报告 §3 和 `RC-04-kept-reasons.log` 一致。

---

## 4. 对执行方报告 §7 的裁定

| 编号 | 问题 | 裁定 | 理由 |
|---|---|---|---|
| 1 | RULING-07：通用断言的「同一元素」从「同一选择器」改为「选择器 + 文字指纹」 | **同意，未实质放宽，附条件** | 原断言和同一份锁定期望里的 `C-RC03-dup-deep`（`min_errors: { T03: 2 }`，两个选择器相同的不同段落各报一条）互相矛盾，属于测试自身的错误。改动后，同一选择器、同一文字的重复仍然会被抓住；审计方在对照组 60 页上用同样的口径统计，重复为 0。条件见 RD-03：补一条「带选择器的 error 必须有指纹」的断言，避免断言依赖被测对象而失效。请把本裁定照录进 RULINGS。 |
| 2 | 「同一元素已报同一规则」按同一选择器或同一指纹判断 | **不同意** | 这会造成伪通过，见 RD-01。报告里「页面已经因为同一规则、同一选择器失败」的前提不成立：完整档报 warn 也会删除，文字相同也会删除。应改为按元素身份判断，并且 error 只能被 error 取代。 |
| 3 | 浏览器语言固定为 zh-CN，而不是审计方建议的 en-US | **同意** | 审计方建议 en-US 的目的是让结果不随操作系统变化，同时避开中文错误页。执行方用「跳过 `chrome-error:` 框架」和「主框架是错误页时不取快照」解决了错误页问题，固定 zh-CN 同样能让结果可复现。对中文页面来说，zh-CN 更贴近真实读者：按语言切换内容的页面会显示中文版，没写 `lang` 的中文也按简体中文选字形。建议在「已知局限」里写明：按 `navigator.language` 切换内容的页面，完整档检查的是中文版。 |
| 4 | DOM 快照补报用「6 个字以上的公共片段」判断对应，没有用编辑距离 | **不同意现状** | 「判断对应」用哪种经验规则不是关键，关键是对应上之后就把这个元素的所有 DOM 结论都丢掉，造成漏报。另外门槛随源码文字的长度降到 1 个字。见 RD-02。改成「对应元素 + 同一规则才不补报」之后，公共片段规则可以保留作为对应依据，但门槛要有固定下限。 |

---

## 5. 审计方亲自运行的命令和关键输出

全部在本机运行（系统 Chrome 155.0.8059.86，playwright-core 1.64.1），没有联网，没有安装依赖，没有运行 `bench/run-baseline.mjs`，也没有运行会在仓库 `test/` 下建临时目录的 `bench/kept-reasons.mjs`。审计方用自己的脚本，在复制到 `/tmp` 的副本上做了同样的统计。

1. **锁定测试的改动范围**

   ```
   $ git log --format='%h %s' eb39212..HEAD -- test/   → 只有 721b80b
   $ git diff eb39212 HEAD -- test/                    → 只改 test/w2-render-audit-r3.test.js 的 assertNoDuplicates（键加上 EL_TEXT）
   $ (cd test/fixtures/w2-render-audit-r3 && shasum -a 256 -c MANIFEST.sha256) | grep -vc OK   → 0
   ```

2. **构建和全量测试**

   ```
   $ npm run build && npm test
   ℹ tests 202
   ℹ pass 202
   ℹ fail 0
   EXIT=0
   ```

3. **第 3 轮复现页和新的绕过尝试**（`t1.mjs`）：

   ```
   == tw-opt.html          | static: fail ["T07"] | render: pass e=0 []
   == resp.html            | static: fail ["T11"] | render: fail e=1（只有一条）
   == f-remote.html        | static: pass [] | render: pass e=0 []
   == redir.html           | render: incomplete（unreadable），没有来自错误页的结论
   == text-tweak.html      | render: fail e=2（只有源码的 T03、T13）
   == dup-deep.html        | render: fail e=3（含脚本插入段落的 T03）
   == spa-placeholder.html | render: fail e=2 [T03, T13]
   == vertical-lh.html     | render: fail e=1 [T06 保留]
   == collide.html         | render: fail e=2 [T07, T11 保留]
   == hit-text-t11.html    | static: fail ["T11"] | render: pass e=0   ← RD-01
   == hit-text-t06.html    | static: fail ["T06"] | render: pass e=0   ← RD-01
   == hit-sel-t11.html     | static: fail ["T11"] | render: pass e=0   ← RD-01
   == append.html          | render: pass e=0（显示的文字里有「内容,用了」）   ← RD-02
   == replace-common.html  | render: pass e=0                                  ← RD-02
   == short-src.html       | render: pass e=0                                  ← RD-02
   == URL with blocked iframe | pass，remote_refs ["https://example.com/"]
   ```

4. **撤回时机和语言**（`t2.mjs`）：

   ```
   == spa-then-blob.html  | render: fail e=2 [T03, T13（DOM 快照补报）]（测量完之后才跳转，测到的是原页面）
   == spa-early-blob.html | render: incomplete e=0（navigated，DOM 快照补报的结论已撤回）
   == lang-switch.html    | render: fail [T01, T03, T13 …]（navigator.language 为 zh-CN，页面显示中文版）
   ```

5. **golden 与对照组**（`rv.mjs`，复制到 `/tmp` 后跑 6 种宽度）：

   ```
   golden      {"files":21,"cjk_files":20,"errors":0,"warns":3,"status":"pass"} kept 0 domAdded 0 generic dup 0
   claude-code {"errors":211,"warns":146,"status":"fail"} excl 9 shots 211 kept 0 domAdded 0 generic dup 0 无指纹 0
   codex       {"errors":799,"warns":302,"status":"fail"} excl 0 shots 799 kept 9 dup(by selector / page-agg) 0 generic dup 0 无指纹 0
   ```

   023 页第 9 个 `<option>`「无需通勤」第 3 轮还被保留，这一轮被删掉了。用 playwright-core 打开这一页核对：浏览器里另有一个由脚本生成、可见的 `span.choice-box`，文字也是「无需通勤」，字号 11px。它的 T11 error 超出了每条规则 20 条的上限，被归进「另有 26 处」，但仍然写进了 `hits`，按文字指纹删掉了 `<option>` 那条。见 RD-01。

6. **收尾**：`/tmp/r4audit/` 和构建日志已删除；`git status --porcelain` 只显示本文件。

---

## 6. 需要用户拍板的事项

| 编号 | 事项 | 审计方意见 |
|---|---|---|
| R-D1 | 是否按 PRD_RENDER_PROPOSAL 第 4 版的改动 1–4 修改 PRD | 等 RD-01、RD-02 修完、按元素合并的口径稳定之后再批 |
| R-D2 | 检查本地文件时不允许访问 localhost（包括 TCP 连接） | 同意 |
| D-A1 | T05 按每行汉字数统计，全角标点也算字 | 推荐同意 |
| D-A2 | 页面脚本照常执行，测量放进隔离环境 | 推荐同意 |
