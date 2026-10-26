# W2 完整档（`lint --render`）第 6 轮复核 · AUDIT_RENDER_r6

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」，第 6 轮 |
| 审计方 | Claude Code（独立会话，不采信执行方自述，以代码、命令输出、git 历史为准） |
| 审计对象 | 在 `2062c7d` 之后：`5accb15`（锁定复现夹具和测试）→ `6654605`（整改）→ `f7a1a21`、`5243d40`（报告和验证结果）。审计时 HEAD = `5243d40` |
| 上一轮 | `AUDIT_RENDER_r5.md`：未达标，1 High、3 Low |
| 审计日期 | 2026-10-26 |
| 审计方改动 | 只新建本文件。对抗页面放在 `/tmp/r6audit/`，跑完已删除；`git status --porcelain` 只多出本文件 |

---

## 1. 结论

**未达标。**

### 1.1 流程性原因（与代码质量无关）

R-D1、R-D2 两项 PRD 变更仍未经用户拍板（`open_decisions.json` 中 `resolved: false`）。按项目规则，这一条本身就让结论为「未达标」。执行方的 `results.json` 也如实判了「未达标」。

### 1.2 实质原因：未达标（仍差 1 条 High）

第 5 轮的 5 个复现页（`drawer`、`same-id`、`same-id-prefix`、`short-tweak`、`same-text-insert`）现在结果都正确。前五轮的全部复现页、golden 20 页、对照组 60 页都没有回归，详见 §3、§5。

但「序号」假设源码和浏览器里同一身份元素的**先后顺序和个数都一致**，这个假设很容易被打破：

- 脚本把抽屉导航挪到 `body` 末尾（portal 写法）；
- 脚本复制一份导航到页头。

这两种情况下，序号会错位：不可见元素的基础档 error，被当作可见元素「已经实测过」而删掉。RE-01 同类的伪通过还在。

| 严重度 | 条数 | 编号 |
|---|---|---|
| Blocker | 0 | — |
| High | 1 | RF-01 |
| Medium | 0 | — |
| Low | 3 | RF-02 至 RF-04 |

**必改清单：**

1. **RF-01**：序号在「调换顺序」和「只在 DOM 里多出同身份元素」时错位，导致伪通过。
2. 用户对 R-D1、R-D2 拍板。

---

## 2. 发现清单

复现页面写在 `/tmp/r6audit/` 下，调用 `runRender` 和 `runLint`（`npm run build` 之后的 `packages/cli/dist/index.js`）。下文的通用样式指 `:where(:lang(zh)) { line-break: strict; font-synthesis-style: none; text-autospace: normal; } body { font-family: "Inter", "PingFang SC", sans-serif; font-size: 16px } main { max-width: 36em } p, li { line-height: 1.75 }`。

`NAV` 指 `<nav><ul><li><a href="#">首页</a></li><li><a href="#">产品介绍</a></li><li><a href="#">联系我们</a></li></ul></nav>`；抽屉样式指 `.drawer{position:fixed;inset:0 auto 0 0;width:260px;transform:translateX(-100%);visibility:hidden} .drawer a{font-size:11px} header a{font-size:16px}`。

### RF-01 · High（伪成功）· 序号在调换顺序、只在 DOM 里多出同身份元素时错位，不可见元素的 error 被删掉

- **位置：**
  - `packages/cli/src/render.ts` 的 `staticVerdict`：`const id = \`${f.selector}\u0001${t}\u0001${elOrd(f)}\`; if (out.ids.has(id)) return checked.has(id) ? { drop: true } : …`；
  - `model.ts` 的 `ordOf`（按源码顺序编号）；
  - `probe.ts` 的 `ordMap`（按 DOM 顺序编号）。
- **问题：** 同一身份（选择器加文字指纹）的第 n 个，在源码和浏览器里各自按文档顺序编号。两边的顺序或个数一旦不同，「源码第 0 个」就会对上「浏览器第 0 个」，而这两个可能是不同的元素。如果浏览器第 0 个可见、做过检查，源码第 0 个（不可见、有问题）的基础档 error 就被删掉。两种很常见的写法都会触发：
  1. **portal：** 源码里抽屉导航写在页头前面，脚本把它挪到 `body` 末尾。
  2. **复制：** 源码只有抽屉里的一份导航，脚本把它复制一份到页头。
- **为什么是问题：** 同一页面，基础档退出码 1，完整档退出码 0，与 RE-01 是同一类伪通过。执行方报告 §5 第 14 条说「如果脚本改变了同一身份元素的先后顺序，序号会对错，这时按『对应不上』处理，保留基础档结论」，实际行为相反（见 RF-02）。
- **复现：**（`--widths 360,1280`）

  ```
  drawer-portal.html：<aside class="drawer">NAV</aside><header>NAV</header><main><p>正文的中文段落。</p></main>
                      <script>document.body.append(document.querySelector(".drawer"))</script>
  == drawer-portal.html | static: fail ["T11","T11","T11"] | render: pass e=0 []

  drawer-clone.html：<header></header><aside class="drawer">NAV</aside><main>…</main>
                     <script>header.innerHTML = drawer.innerHTML</script>
  == drawer-clone.html  | static: fail ["T11","T11","T11"] | render: pass e=0 []

  对照（顺序和个数一致或只少不多时是对的）：
  == drawer.html        | render: fail e=3（保留）
  == drawer-first.html  | render: fail e=3（不可见的在前、可见的在后，没有调换）
  == drawer-remove.html | render: fail e=3（脚本删掉页头那份，只在源码多一个）
  ```

- **修法：** 序号只在两边的「个数和相对顺序都能确认一致」时才可信，做不到就不要用它取代基础档结论。具体做法：
  1. 同一身份（选择器加指纹，不含序号）在源码或浏览器里出现**不止一次**时：只有这个身份在浏览器里的**全部**元素都做过这条规则的检查，才取代；否则保留，原因写「浏览器里有多个相同的元素，无法一一对应」。这就是第 5 轮修法的第 2 条，可以和序号一起用：序号用来给行号，取代与否按「全部检查过」判断。
  2. 同一身份只出现一次时，维持现在的规则。
  3. 用 `drawer-portal.html`、`drawer-clone.html` 各补一个先失败的测试；`drawer.html`、`drawer-first.html`、`drawer-remove.html` 继续保留 3 条 T11。

### RF-02 · Low · 报告 §5 第 14 条、§7 第 1 条的说法与实际行为不符

- **位置：** `VERIFICATION_REPORT.md` §5 第 14 条：「如果脚本改变了同一身份元素的先后顺序，序号会对错，这时按『对应不上』处理，保留基础档结论。」
- **问题：** 代码里没有「序号对错」的判断。序号对错时，`out.ids.has(id)` 仍然成立（对上的是另一个元素），结果是取代而不是保留，见 RF-01 的 `drawer-portal.html`。
- **修法：** 修完 RF-01 后，按实际判定规则重写这两处。

### RF-03 · Low · 脚本插入同文字元素、改变了原元素的 `:nth-of-type` 时，原元素的结论重复报告（报告已披露）

- **位置：** `render.ts` 的 `staticPass` 中 `fresh` 的对应规则②：DOM 里同一文字的元素比源码多时，只认选择器、文字、序号完全相同的元素。
- **问题：** 报告 §5 第 18 条已经披露了这个现象。审计方复现确认：同一个问题报了两次，脚本插入的新段落也报了一次，一共三条，页面不会因此变成通过。
  - 第 5 轮 RE-03 要求「多出来的那个当新内容补报」。现在多出来的那个确实补报了，但原来那个也被当成新内容又报了一次。
- **复现：**

  ```
  nth-shift.html：<main><p style="font-family:Arial,sans-serif">同样的文字,同样的问题</p></main>
                  <script>main.prepend(同样文字、同样样式的新 p)</script>
  == nth-shift.html | render: fail e=6 [T03 main > p（源码，第 3 行）, T13 main > p,
                                        T03 main > p:nth-of-type(1)（DOM）, T03 main > p:nth-of-type(2)（DOM）, T13 …]
  ```

- **修法：** 文字相同、DOM 比源码多的情况，先按「去掉 `:nth-of-type` 之后的选择器加文字」把源码元素和 DOM 元素按文档顺序配对，配上的几个视为对应，剩下的才当新内容补报。或者维持现状，但报告里写明「每多插入一个同文字元素，原元素会多报一次」。

### RF-04 · Low · 测试缺口

- **位置：** `test/w2-render-audit-r5.test.js`。
- **问题：** 没有覆盖「调换顺序」和「只在 DOM 里多出同身份元素」，这两种正是 RF-01 的触发条件。
- **修法：** 按「先写失败测试、单独目录锁定」的规矩，补上 RF-01 的两个复现页和三个对照页。

---

## 3. 第 5 轮发现逐条复核

| 编号 | 第 5 轮严重度 | 复核结论 | 依据（真实输出摘录） |
|---|---|---|---|
| RE-01 | High | **第 5 轮的复现页修好了；序号错位的路径还在（RF-01）** | `drawer.html \| render: fail e=3`；`same-id.html`、`same-id-prefix.html \| render: fail e=1`（折叠里的 T11 保留） |
| RE-02 | Low | **修好** | `short-tweak.html \| render: fail e=2`，只有源码的 T03、T13，没有重复。`short-src` 那类单字占位仍然对应不上（门槛 2 个字），第 4 轮 RD-02 的修复没有回退 |
| RE-03 | Low | **修好**（有披露过的副作用，见 RF-03） | `same-text-insert.html \| render: fail e=3`，脚本插入的 `main > div#x > p` 的 T03 补报出来了 |
| RE-04 | Low | **修好** | `test/w2-render-audit-r5.test.js` 覆盖了第 5 轮的 5 个复现页，整改前 5/5 失败 |

其他尝试，都没有发现问题：

- **不可见元素在前、可见元素在后（顺序不变）：** `drawer-first.html` 保留 3 条 T11。
- **只在源码里多一个同身份元素：** `drawer-remove.html` 保留 3 条 T11。
- **同身份元素一个直接文字有中文、一个的中文在子元素里：** `mixed-direct.html` 保留折叠里的 T11。序号只在直接文字有中文的元素之间排，两边口径一致。
- **「≥2 字整段包含」：** `contain2.html`：源码 `<p>关于</p>` 被脚本换成「关于我们,这里有半角逗号」，T03 照样补报。原因是源码没有对这个元素报过 T03，对应上也不会省略。这条规则只用于「源码报过同一规则的元素」，所以不会造成伪通过。
- **脚本删掉源码段落、在别处插入同文字段落：** `move-text.html`：源码的 T03、T13 保留；新段落自己的 T07 由完整档实测报出。
- **锁定测试没有改动：** `git log 5accb15..HEAD -- test/` 无输出；`w2-render-audit-r5` 的 MANIFEST 校验全部 OK；整改前的证据为 5/5 失败，失败消息和第 5 轮的复现一致。
- **golden 与对照组：**
  - golden 20 页：0 error、3 warn；
  - claude-code：211 个 error、211 张截图，排除 T02/T04 后零 error 9/30，保留 0 条；
  - codex：800 个 error、800 张截图，保留 10 条，和完整档重复 0 条。

  都与报告 §3、`RV-13.json`、`RE-kept-reasons.log` 一致。

---

## 4. 对执行方报告 §7 的裁定

| 编号 | 问题 | 裁定 | 理由 |
|---|---|---|---|
| 1 | 身份加序号，是否堵住了 RE-01；序号对错时会不会出现新的伪通过 | **没有完全堵住：序号对错时会伪通过** | 顺序和个数一致时，序号是对的（`drawer`、`drawer-first`、`drawer-remove`）。但脚本调换顺序（`drawer-portal`），或者只在 DOM 里多出同身份元素（`drawer-clone`），都会让序号对上另一个元素，判通过。见 RF-01。报告 §5 第 14 条说「序号对错时保留」，代码里没有这个判断（RF-02）。 |
| 2 | DOM 快照补报的「按个数配对」：代价是可能重复、不会漏报，是否可以接受 | **可以接受，附说明** | 审计方复现确认：有重复（`nth-shift` 一共 6 条，其中原元素的问题报了两次），没有发现漏报，不影响通过与否。作为 Low（RF-03）处理：要么按 RF-03 的修法配对，要么在报告里写明重复的规律。 |

---

## 5. 审计方亲自运行的命令和关键输出

全部在本机运行（系统 Chrome 155.0.8059.86，playwright-core 1.64.1），没有联网，没有安装依赖，没有运行 `bench/run-baseline.mjs`。

1. **锁定测试有没有被改**

   ```
   $ git log --format='%h %s' 5accb15..HEAD -- test/                                                     → 无输出
   $ (cd test/fixtures/w2-render-audit-r5 && shasum -a 256 -c MANIFEST.sha256) | grep -vc OK             → 0
   ```

2. **构建和全量测试**（含前五轮的全部回归测试）

   ```
   $ npm run build && npm test
   ℹ tests 215
   ℹ pass 215
   ℹ fail 0
   EXIT=0
   ```

3. **第 5 轮复现页和绕过序号的尝试**（`t1.mjs`、`t2.mjs`，节选）：

   ```
   == drawer.html           | static: fail ["T11","T11","T11"] | render: fail e=3
   == same-id.html          | render: fail e=1
   == same-id-prefix.html   | render: fail e=1
   == short-tweak.html      | render: fail e=2（不重复）
   == same-text-insert.html | render: fail e=3（插入段落补报）
   == drawer-portal.html    | static: fail ["T11","T11","T11"] | render: pass e=0   ← RF-01
   == drawer-clone.html     | static: fail ["T11","T11","T11"] | render: pass e=0   ← RF-01
   == drawer-remove.html    | render: fail e=3
   == drawer-first.html     | render: fail e=3
   == mixed-direct.html     | render: fail e=1
   == contain2.html         | render: fail e=2 [T13（源码）, T03（DOM 快照补报）]
   == move-text.html        | render: fail e=3
   == nth-shift.html        | render: fail e=6（原元素的问题报了两次）           ← RF-03
   ```

4. **golden 与对照组**（复制到 `/tmp` 后跑 6 种宽度）：

   ```
   golden         {"files":21,"cjk_files":20,"errors":0,"warns":3,"status":"pass"} kept 0 dup 0 dom 0
   rv-claude-code {"errors":211,"warns":146,"status":"fail"} excl 9 shots 211 kept 0 dup 0 dom 0
   rv-codex       {"errors":800,"warns":302,"status":"fail"} excl 0 shots 800 kept 10 dup 0 dom 0
   ```

5. **收尾**：`/tmp/r6audit/` 和构建日志已删除；`git status --porcelain` 只显示本文件。

---

## 6. 需要用户拍板的事项

| 编号 | 事项 | 审计方意见 |
|---|---|---|
| R-D1 | 是否按 PRD_RENDER_PROPOSAL 第 6 版的改动 1–4 修改 PRD | RF-01 修完后可以批：剩下的只是「多个同身份元素一律要求全部检查过」这一处口径 |
| R-D2 | 检查本地文件时不允许访问 localhost（包括 TCP 连接） | 同意 |
| D-A1 | T05 按每行汉字数统计，全角标点也算字 | 推荐同意 |
| D-A2 | 页面脚本照常执行，测量放进隔离环境 | 推荐同意 |
