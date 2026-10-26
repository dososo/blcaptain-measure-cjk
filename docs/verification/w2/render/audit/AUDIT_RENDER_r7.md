# W2 完整档（`lint --render`）第 7 轮复核 · AUDIT_RENDER_r7

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」，第 7 轮 |
| 审计方 | Claude Code（独立会话，不采信执行方自述，以代码、命令输出、git 历史为准） |
| 审计对象 | 在 `5243d40` 之后：`faf2af3`（锁定复现夹具和测试）→ `2cf021f`（整改）→ `51db2ae`、`ff4c2ee`（报告和验证结果）。审计时 HEAD = `ff4c2ee` |
| 上一轮 | `AUDIT_RENDER_r6.md`：未达标，1 High、3 Low |
| 审计日期 | 2026-10-26 |
| 审计方改动 | 只新建本文件。对抗页面放在 `/tmp/r7audit/`，跑完已删除；`git status --porcelain` 只多出本文件 |

---

## 1. 结论

**未达标。**

### 1.1 流程性原因（与代码质量无关）

R-D1、R-D2 两项 PRD 变更仍未经用户拍板（`open_decisions.json` 中 `resolved: false`）。按项目规则，这一条本身就让结论为「未达标」。执行方的 `results.json` 也如实判了「未达标」。

### 1.2 实质原因：未达标（还差 1 条 High）

第 6 轮的 RF-01 至 RF-04 都修好了。drawer-portal、drawer-clone 和审计方新试的「删掉可见的那个」「轮流可见」「一部分在 iframe 里」都判断正确。前六轮的全部复现页、golden 20 页、对照组 60 页都没有回归，详见 §3、§5。

但「全部检查过才取代」依赖浏览器里元素身份清单 `ids` 的完整性，而 `probe.ts` 把这个清单**静默截断在 5000 个元素**。中文元素超过 5000 个的页面上，排在 5000 之后的不可见元素会被当成「浏览器里不存在」，再按文字或同身份的可见元素取代，又出现了伪通过。这条在前几轮的代码里就有，但直到本轮的「全部检查过」规则依赖 `ids` 完整，才变成可利用的路径。

| 严重度 | 条数 | 编号 |
|---|---|---|
| Blocker | 0 | — |
| High | 1 | RG-01 |
| Medium | 0 | — |
| Low | 2 | RG-02、RG-03 |

**必改清单：**

1. **RG-01**：`ids` 截断在 5000 个元素时，不能用它来取代基础档结论。
2. 用户对 R-D1、R-D2 拍板。

**RG-01 修好并复核通过、用户拍板 R-D1、R-D2 之后，按本轮的情况，结论会是「有条件达标」。** 条件是两条 Low（RG-02、RG-03），以及之前已披露、不改的 RF-03，在审计响应矩阵里逐条回应。审计方目前没有看到其他会阻止「达标」的实质问题。

---

## 2. 发现清单

复现页面写在 `/tmp/r7audit/` 下，调用 `runRender` 和 `runLint`（`npm run build` 之后的 `packages/cli/dist/index.js`）。下文的通用样式指 `:where(:lang(zh)) { line-break: strict; font-synthesis-style: none; text-autospace: normal; } body { font-family: "Inter", "PingFang SC", sans-serif; font-size: 16px } main { max-width: 36em } p, li { line-height: 1.75 }`。

`S` 指「同一句话出现在折叠区和正文里，用来测试对应关系。」；`D4(x)` 指 `<div><div><div>x</div></div></div>`。

### RG-01 · High（伪成功）· 浏览器元素清单 `ids` 静默截断在 5000 个，超出部分的不可见元素被当成不存在，基础档 error 被删掉

- **位置：**
  - `packages/cli/src/probe.ts:197`：`const ids = all.slice(0, 5000).map(idOf);`；
  - `render.ts` 的 `staticVerdict`：用 `out.ids` 判断「浏览器里这个身份有几个元素」「按文字有几个候选」。
- **问题：** 「全部检查过才取代」的前提是：`same`（浏览器里同一「选择器 + 指纹」的全部元素）和 `candidates`（同一文字的全部元素）是完整的。`ids` 只记前 5000 个中文元素，而且截断时没有任何记录。
  - 排在后面的不可见元素不在 `ids` 里。如果它有一个同身份、排在前 5000 内的可见元素，`same` 里就只剩那个可见的，「全部检查过」成立，于是取代。
  - 文字回退也是同样的问题：不可见元素排在后面，同文字的可见元素排在前面，候选只有一个，判为已检查。
  - `checked` 不截断，只有 `ids` 截断，两者口径不一致。
- **为什么是问题：**
  - 同一页面，基础档退出码 1，完整档退出码 0，属于伪通过；
  - 静默截断也违反「不静默缩小范围」的规则。

  中文元素超过 5000 个的页面不常见于生成的落地页，但长文档、大表格（1000 行 × 5 列）、术语表都会达到。这类页面在完整档下不会超时：审计方的 5200 个元素的页面，单宽度 3.4 秒、两种宽度 4.9 秒就检查完了。
- **复现：**

  ```
  cap2.html：<main><section>D4(<p class="x" style="font-size:16px">S</p>)</section>
                   <div>（520 个 div，每个 10 个 <span>填i-j</span>，共 5200 个中文元素）</div></main>
             <footer><details>D4(<p class="x" style="font-size:10px">S</p>)</details></footer>
  == cap2.html     | static: fail e=1 | render: pass e=0 3394ms []
  == cap2.html     | static: fail e=1 | render: pass e=0 4879ms []   （--widths 360,1280）

  对照 cap2-ctl.html：同上，但中间只有 2600 个中文元素
  == cap2-ctl.html | static: fail e=1 | render: fail e=1 [["T11","div > div > div > p.x","中文字号 10.0px…（基础档结果：浏览器里有…"]]
  ```

- **修法：**
  1. 不截断 `ids`；或者截断时在结果里带上 `truncated: true`。
  2. Node 一侧遇到截断时，对**任何**结论都不按「浏览器里不存在」或「按文字只有一个候选」去取代，一律保留，原因写「页面元素太多，完整档没能登记全部元素」。同时把这一页记进 `run.render.problems`，这样不会静默。
  3. `checked` 和 `ids` 的上限必须一致。
  4. 用 `cap2.html` 补一个先失败的测试（可以把上限做成测试可调的参数，避免测试太慢）。

### RG-02 · Low · 测量耗时随同级元素个数超线性增长，长页面比第 2 轮慢了约一倍

- **位置：** `probe.ts`：`selectorOf` 每次都遍历父元素的全部子元素来算 `:nth-of-type`；`add` 里有 `all.indexOf(el)`；`ordMap`、`ids` 又各算一遍 `selectorOf`。
- **问题：**
  - 同一个父元素下有 1000、2000、3000 个中文元素时，单宽度耗时分别为 1.6 秒、3.2 秒、6.1 秒。超过 15 秒就记为 timeout、incomplete，方向是安全的，但这类页面会检查不完。
  - 800 段的长文章、6 种宽度，第 2 轮实测 2.8 秒，本轮 5.3 秒。
- **修法：** 每次测量开头为每个元素算一次选择器和序号，缓存进 `Map`；`all.indexOf` 改用预先建好的 `Map<Element, number>`。补一个 3000 个同级元素的性能用例，作为不超时的基准。

### RG-03 · Low · 测试缺口

- **位置：** `test/w2-render-audit-r6.test.js`。
- **问题：** 没有覆盖「元素清单截断」（RG-01）。另外，审计方本轮试过的「删掉可见的那个」「轮流可见」「一部分在 iframe 里」三种情况都判断正确，但没有对应的回归测试。
- **修法：** 按「先写失败测试、单独目录锁定」的规矩补上 RG-01 的夹具，并把这三种情况作为不回退的用例加进去。

---

## 3. 第 6 轮发现逐条复核

| 编号 | 第 6 轮严重度 | 复核结论 | 依据（真实输出摘录） |
|---|---|---|---|
| RF-01 | High | **修好** | `drawer-portal.html`、`drawer-clone.html` → `render: fail e=3`（3 条 T11 保留，原因写「浏览器里有多个选择器和文字都相同的元素…」）；`drawer`、`drawer-first`、`drawer-remove` 仍是 fail e=3 |
| RF-02 | Low | **修好** | 报告 §5 第 14 条按实际行为改写，并注明第 6 轮的说法与当时的代码不符 |
| RF-03 | Low | **已披露，不改** | 报告 §5 第 18 条写明了重复的规律；第 6 轮审计方的裁定允许这样处理 |
| RF-04 | Low | **修好** | `test/w2-render-audit-r6.test.js` 覆盖了 portal、clone、调换顺序三种情况，整改前 3/3 失败 |

### 绕过「全部检查过才取代」的尝试（除 RG-01 外都判断正确）

| 写法 | 页面 | 结果 |
|---|---|---|
| 脚本删掉同身份元素中可见的那个，只留下不可见的那个 | `drawer-remove.html` | 3 条 T11 保留，fail |
| 同身份元素在不同宽度下轮流可见：窄屏只显示有问题的那份，宽屏只显示页头 | `drawer-alt.html`（`--widths 360,1280`） | 完整档在 360px 实测报出 3 条 T11，fail |
| 同身份元素一部分在 iframe 里 | `drawer-iframe.html`（可见的那份在 `srcdoc` iframe 里） | 记为 `cjk-in-frame`，incomplete，基础档的 3 条 T11 保留 |
| 删掉折叠里有问题的元素、换上同文字的正常元素 | `swap.html` | pass。用户看到的是正常元素，符合第 5 轮 §4 第 2 条的裁定 |

### 前几轮的复现页

`same-id`、`collide`、`hit-text-t11`、`append`、`spa-placeholder`、`vertical-lh` 的结果与上一轮一致。

### 锁定测试

- `git log faf2af3..HEAD -- test/` 无输出；`w2-render-audit-r6` 的 MANIFEST 校验全部 OK。
- 整改前的证据为 3/3 失败，失败消息都是 `'pass' !== 'fail'`。

### golden 与对照组

- golden 20 页：0 error、3 warn；
- claude-code：211 个 error、211 张截图，排除 T02/T04 后零 error 9/30，保留 0 条；
- codex：800 个 error、800 张截图，保留 10 条，重复 0 条。保留原因是「所有宽度下都没有检查」8 条、「对应不上」2 条。

都与报告 §3、`RV-13.json`、`RF-kept-reasons.log` 一致。

---

## 4. 对执行方报告 §7 的裁定

| 编号 | 问题 | 裁定 | 理由 |
|---|---|---|---|
| 1 | 「全部检查过才取代」是否还有绕过路径，例如脚本删掉可见的那个、只留下不可见的那个 | **规则本身同意；有一条依赖数据完整性的绕过路径（RG-01）** | 审计方试了四种写法（§3 的表），包括报告点名的「删掉可见的那个」，都判断正确。唯一的绕过来自 `ids` 在 5000 个元素处静默截断，规则本身没有问题。修好 RG-01 后，这条规则可以写进 PRD（R-D1）。 |
| 2 | `F-RF04-swap` 夹具在锁定前修正过前提 | **同意** | 修正理由成立：基础档的 `isHidden` 本来就跳过 `display: none` 的元素，用它做夹具，基础档不会报 error，测不到要测的东西；改成折叠的 `<details>` 后，基础档报 T11。git 历史里这个文件只出现在锁定提交 `faf2af3` 里，之后没有改动。锁定之前的修改没有进 git，审计方无法独立核实具体时间，但锁定版本的内容和整改前 3/3 失败的证据一致，不影响结论。 |

---

## 5. 审计方亲自运行的命令和关键输出

全部在本机运行（系统 Chrome 155.0.8059.86，playwright-core 1.64.1），没有联网，没有安装依赖，没有运行 `bench/run-baseline.mjs`。

1. **锁定测试有没有被改**

   ```
   $ git log --format='%h %s' faf2af3..HEAD -- test/                                                     → 无输出
   $ (cd test/fixtures/w2-render-audit-r6 && shasum -a 256 -c MANIFEST.sha256) | grep -vc OK             → 0
   $ git log --format='%h %s' -- test/fixtures/w2-render-audit-r6/F-RF04-swap.html                       → 只有 faf2af3
   ```

2. **构建和全量测试**（含前六轮的全部回归测试）

   ```
   $ npm run build && npm test
   ℹ tests 218
   ℹ pass 218
   ℹ fail 0
   EXIT=0
   ```

3. **复现页和绕过尝试**（`t1.mjs`，节选）：

   ```
   == drawer.html          | static: fail e=3 | render: fail e=3
   == drawer-portal.html   | static: fail e=3 | render: fail e=3（保留：浏览器里有多个选择器和文字都相同的元素…）
   == drawer-clone.html    | static: fail e=3 | render: fail e=3
   == drawer-remove.html   | render: fail e=3
   == drawer-first.html    | render: fail e=3
   == drawer-alt.html      | render: fail e=3（360px 实测）
   == drawer-iframe.html   | render: incomplete（cjk-in-frame），e=3
   == same-id.html         | render: fail e=1
   == swap.html            | render: pass（显示的是正常元素）
   == collide.html / hit-text-t11.html / append.html / spa-placeholder.html / vertical-lh.html | 与上一轮一致
   == cap.html、cap-before.html（5100 个同级 span）| render: incomplete（timeout，15.4 秒）
   ```

4. **元素清单截断**（`t3.mjs`）：

   ```
   == cap2.html     | static: fail e=1 | render: pass e=0 3394ms []        ← RG-01
   == cap2-ctl.html | static: fail e=1 | render: fail e=1 1485ms
   == cap2.html     | static: fail e=1 | render: pass e=0 4879ms []（360、1280）
   ```

5. **耗时**（`t2.mjs`）：

   ```
   spans 1000 1 width: pass 1602ms
   spans 2000 1 width: pass 3167ms
   spans 3000 1 width: pass 6108ms
   long 800 paragraphs, 6 widths: pass 5287ms
   table 300x4 cells, 6 widths: pass 2328ms
   ```

6. **golden 与对照组**（复制到 `/tmp` 后跑 6 种宽度）：

   ```
   golden         {"errors":0,"warns":3,"status":"pass"} kept 0 dup 0 dom 0
   rv-claude-code {"errors":211,"warns":146,"status":"fail"} excl 9 shots 211 kept 0 dup 0 dom 0
   rv-codex       {"errors":800,"warns":302,"status":"fail"} excl 0 shots 800 kept 10 dup 0 dom 0 {"完整档在所有宽度下都没有":8,"完整档没能在浏览器里对应":2}
   ```

7. **收尾**：`/tmp/r7audit/` 和构建日志已删除；`git status --porcelain` 只显示本文件。

---

## 6. 需要用户拍板的事项

| 编号 | 事项 | 审计方意见 |
|---|---|---|
| R-D1 | 是否按 PRD_RENDER_PROPOSAL 第 7 版的改动 1–4 修改 PRD | 按元素合并的口径（身份 + 全部检查过才取代）已经稳定，推荐 RG-01 修完后同意 |
| R-D2 | 检查本地文件时不允许访问 localhost（包括 TCP 连接） | 同意 |
| D-A1 | T05 按每行汉字数统计，全角标点也算字 | 推荐同意 |
| D-A2 | 页面脚本照常执行，测量放进隔离环境 | 推荐同意 |
