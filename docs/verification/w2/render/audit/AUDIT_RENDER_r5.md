# W2 完整档（`lint --render`）第 5 轮复核 · AUDIT_RENDER_r5

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」，第 5 轮 |
| 审计方 | Claude Code（独立会话，不采信执行方自述，以代码、命令输出、git 历史为准） |
| 审计对象 | 在 `759d991` 之后：`0b33180`（锁定复现夹具和测试）→ `a3e78cf`（整改）→ `2416ff3`、`2062c7d`（报告和验证结果）。审计时 HEAD = `2062c7d` |
| 上一轮 | `AUDIT_RENDER_r4.md`：未达标，2 High、2 Low |
| 审计日期 | 2026-10-26 |
| 审计方改动 | 只新建本文件。对抗页面放在 `/tmp/r5audit/`，跑完已删除；`git status --porcelain` 只多出本文件 |

---

## 1. 结论

**未达标。**

### 1.1 流程性原因（与代码质量无关）

R-D1、R-D2 两项 PRD 变更仍未经用户拍板（`open_decisions.json` 中 `resolved: false`）。按项目规则，这一条本身就让结论为「未达标」。执行方的 `results.json` 也如实判了「未达标」。

### 1.2 实质原因：未达标（只差 1 条 High）

第 4 轮的 RD-01 至 RD-04 在第 4 轮的复现页上都修好了。前四轮的全部复现页、golden 20 页、对照组 60 页都没有回归，详见 §3、§5。

但新的取代规则「身份完全相同的元素做过检查就取代」，在**两个元素身份相同**时仍然会删掉不该删的 error。身份相同的条件是：选择器超过 4 层后撞车，并且文字指纹相同。审计方用一个常见写法复现了伪通过：收起的侧滑抽屉导航，和桌面导航用同样的链接文字。

| 严重度 | 条数 | 编号 |
|---|---|---|
| Blocker | 0 | — |
| High | 1 | RE-01 |
| Medium | 0 | — |
| Low | 3 | RE-02 至 RE-04 |

**必改清单：**

1. **RE-01**：身份相同的多个元素只要有一个被检查过，就会删掉其他同身份元素的基础档 error。
2. 用户对 R-D1、R-D2 拍板。

RE-01 修好并复核通过、用户拍板之后，按本轮的情况，可以转为「有条件达标」。条件是 3 条 Low 在审计响应矩阵里逐条回应。

---

## 2. 发现清单

复现页面写在 `/tmp/r5audit/` 下，调用 `runRender` 和 `runLint`（`npm run build` 之后的 `packages/cli/dist/index.js`）。下文的通用样式指 `:where(:lang(zh)) { line-break: strict; font-synthesis-style: none; text-autospace: normal; } body { font-family: "Inter", "PingFang SC", sans-serif; font-size: 16px } main { max-width: 36em } p, li { line-height: 1.75 }`。

### RE-01 · High（伪成功）· 身份相同的多个元素中，只要一个被检查过，其余元素的基础档 error 都会被删掉

- **位置：**
  - `packages/cli/src/render.ts` 的 `staticVerdict`：`if (out.ids.has(id)) return checked.has(id) ? { drop: true } : …`；
  - `probe.ts` 的 `ids` 和 `checked`：都是「选择器 + 文字指纹」字符串，Node 一侧并进 `Set`，丢掉了同一身份对应几个元素的信息。
- **问题：** 元素身份是「选择器（最多 4 层）+ 直接文字的前 24 个字符」。两个元素满足下面两条时，身份就完全相同：
  - 第 5 层以上的祖先不同，所以选择器撞车；
  - 文字相同，或者前 24 个字相同。

  `ids`、`checked` 都是集合，无法区分它们。只要其中一个可见、做过检查，另一个不可见元素的基础档 error 就被当作「同一元素已实测」而删掉。
  - 第 2 轮的 RB-02（`collide.html`）只因为两段文字不同才没有触发。文字一相同就会触发。
  - 最常见的情况：收起状态的侧滑抽屉（off-canvas）导航，和页头导航用同一套链接文字；两个 `nav` 都没有 class，并且在不同的父元素下，选择器都是 `nav > ul > li:nth-of-type(n) > a`。抽屉里的链接字号太小，打开抽屉时用户看得到，但完整档判通过。
- **为什么是问题：** 同一页面，基础档退出码 1，完整档退出码 0。与 RB-02、RD-01 是同一类伪通过。
- **复现：**

  ```
  drawer.html：<header>NAV</header><aside class="drawer">NAV</aside><main><p>正文的中文段落。</p></main>
    NAV = <nav><ul><li><a href="#">首页</a></li><li><a href="#">产品介绍</a></li><li><a href="#">联系我们</a></li></ul></nav>
    样式：.drawer{position:fixed;inset:0 auto 0 0;width:260px;transform:translateX(-100%);visibility:hidden} .drawer a{font-size:11px} header a{font-size:16px}
  == drawer.html | static: fail ["T11","T11","T11"] | render: pass e=0 []      （--widths 360,1280）

  same-id.html：两个 section > … > div > div > div > p.x，文字相同（S），折叠里的 10px，可见的 16px
  == same-id.html        | static: fail ["T11"] | render: pass e=0 []
  same-id-prefix.html：同上，两段文字前 24 个字相同、后面不同
  == same-id-prefix.html | static: fail ["T11"] | render: pass e=0 []
  ```

- **修法：**
  1. 身份里加上「同一身份中的序号」：probe 按文档顺序给同一个「选择器 + 指纹」编号；基础档模型也按源码顺序编号。两边按「选择器 + 指纹 + 序号」对应。浏览器里同一身份的元素个数和源码不一样时，按「对应不上」处理。
  2. 最低限度：把 `ids` 改成计数。同一身份在浏览器里有多个元素时，只有它们**全部**做过检查才取代，否则保留，原因写「浏览器里有多个相同的元素」。
  3. 用 `drawer.html` 和 `same-id.html` 各补一个先失败的测试。

### RE-02 · Low · 源码文字不到 6 个字时，脚本改过文字的元素又会被源码和 DOM 快照各报一次（RC-03 的重复部分回来了）

- **位置：** `render.ts` 的 `staticPass` 中 `fresh` 的对应条件：`e.text.length >= MIN_RUN && t.length >= MIN_RUN && commonRun(e.text, t) >= MIN_RUN`。
- **问题：** 公共片段门槛固定为 6 个字，是为了堵 RD-02 的漏报，这是对的。但源码文字不到 6 个字时，只认「文字完全相同」。脚本给短文字加个前缀，这个元素就对应不上，DOM 快照的结论被当成新内容补报，和源码那条重复。页面本来就失败，不影响通过与否，只是同一个问题报两次。
- **复现：**

  ```
  short-tweak.html：<main><p style="font-family:Arial,sans-serif">你好,世界</p></main>
                    <script>p.firstChild.data = "【更新】" + p.firstChild.data</script>
  == short-tweak.html | render: fail e=3 [["T03","error","main > p",3,"…「你好,世界」…"],["T13","error","main > p",3,…],
                                          ["T03","error","main > p",null,"…「【更新】你好,世界」…（按浏览器…"]]
  ```

- **修法：** 对应条件里加一条：同一选择器，并且源码文字完整地出现在 DOM 文字里（`t.includes(e.text)`），源码文字至少 2 个字。这样短文字加前缀、加后缀能对应上，RD-02 的 `short-src`（「无」→「无论如何,…」）仍然对应不上，因为门槛是 2 个字。补一个测试。

### RE-03 · Low · 脚本插入一个和源码段落文字相同、问题也相同的新段落时，新段落的结论被省掉

- **位置：** `fresh` 的 `matches`：`(e.text !== "" && e.text === t)`，不看选择器。
- **问题：** 文字相同就算「对应」。源码那个段落已经报过同一规则，所以脚本新插入的那个段落（位置不同）不再补报。页面仍然失败，但少报了一处问题，用户修完源码那段以后，会以为问题已经全部解决。
- **复现：**

  ```
  same-text-insert.html：<main><p style="font-family:Arial,sans-serif">同样的文字,同样的问题</p><div id="x"></div></main>
                         <script>x.innerHTML = '<p style="font-family:Arial,sans-serif">同样的文字,同样的问题</p>'</script>
  == same-text-insert.html | render: fail e=2（只有源码段落 main > p 的 T03、T13；main > div#x > p 那段没有报）
  ```

- **修法：** 「文字相同」只在选择器也能对上，或者 DOM 里这个文字只出现一次时，才算对应。DOM 里同一文字有多个元素时，按个数配对，多出来的作为新内容补报。

### RE-04 · Low · 测试缺口

- **位置：** `test/w2-render-audit-r4.test.js`。
- **问题：** 没有覆盖「身份完全相同的多个元素」（RE-01），也没有覆盖 RE-02、RE-03。前几轮的通用「不重复」断言测不出漏报。
- **修法：** 按「先写失败测试、单独目录锁定」的规矩补上 RE-01 至 RE-03 的夹具。

---

## 3. 第 4 轮发现逐条复核

| 编号 | 第 4 轮严重度 | 复核结论 | 依据（真实输出摘录） |
|---|---|---|---|
| RD-01 | High | **第 4 轮的路径已堵住，但身份撞车的路径还在（RE-01）** | `hit-text-t11 \| render: fail e=1`（折叠里的 T11 error 保留）；`hit-text-t06 \| fail e=1`；`hit-sel-t11 \| fail e=1`。`hits` 只用于 T08，按完整身份记录 |
| RD-02 | High | **修好** | `append`、`replace-common`、`short-src` 都报 T03 error、判 fail；RC-03 的 `text-tweak`、`dup-deep` 没有回退（`text-tweak` 只有源码的两条，`dup-deep` 报出了脚本插入段落的 T03） |
| RD-03 | Low | **修好** | `test/w2-render-audit-r4.test.js` 断言带选择器的 error 都有文字指纹（`@font-face` 的 F03 除外）；审计方在 golden 和对照组 60 页上统计，缺指纹的 error 为 0 |
| RD-04 | Low | **修好** | 报告 §7 按实际行为改写，删掉了「不会变成伪通过」的说法 |

另外核对过、没有发现问题的部分：

- **锁定测试没有改动：** `git log 0b33180..HEAD -- test/` 无输出；`w2-render-audit-r4` 的 MANIFEST 校验全部 OK；整改前的证据为 7/8 失败，失败消息与审计方第 4 轮看到的一致。
- **前几轮的复现页没有回退：**
  - 第 3 轮：`tw-opt`（pass）、`resp`（1 条）、`f-remote`（pass）、`text-tweak`、`dup-deep`；
  - 第 2 轮：`spa-placeholder`、`vertical-lh`、`collide`、`table`。

  结果都与上一轮一致或更好。
- **「身份对不上、文字唯一就按它判断」：**
  - `swap.html`：脚本删掉有问题的元素，换上同文字的正常元素，判 pass，用户看到的确实是正常元素；
  - `swap-text.html`：有问题的元素文字被改了，另一个脚本插入的正常元素用了它原来的文字。有问题的元素仍然显示，完整档自己报出 T07、T11，判 fail。

  这条路径没有发现可利用之处，见 §4 第 2 条。
- **golden 20 页：** `{"errors":0,"warns":3,"status":"pass"}`，保留 0 条，DOM 快照补报 0 条，重复 0 条。
- **对照组：**
  - claude-code：211 个 error、211 张截图，排除 T02/T04 后零 error 9/30，保留 0 条；
  - codex：800 个 error、800 张截图，保留 10 条，和完整档重复 0 条。023 页「无需通勤」的 `<option>` 恢复保留。

  都与报告 §3、`RV-13.json`、`RD-kept-reasons.log` 一致。

---

## 4. 对执行方报告 §7 的裁定

| 编号 | 问题 | 裁定 | 理由 |
|---|---|---|---|
| 1 | 只看「身份完全相同的元素是否做过检查」，是否堵住了 RD-01 那类路径 | **部分堵住** | 第 4 轮的三个复现页（按文字命中、按选择器命中、warn 也算）都已堵住。但「身份完全相同」本身仍然可能对应多个元素，见 RE-01。修法是给身份加上序号，或者至少要求同一身份的元素全部做过检查。 |
| 2 | 身份对不上、文字指纹唯一、做过检查就取代（为浏览器补 `<tbody>` 保留） | **同意** | 审计方试了两种写法：脚本删掉有问题的元素再插入同文字的正常元素，判通过，用户看到的确实是正常元素；有问题的元素还在、只是改了文字，完整档会自己报出它。浏览器里同一文字有多个元素时这条路径不生效，所以没有 RE-01 那样的撞车问题。 |
| 3 | DOM 快照补报按结论判断，公共片段门槛固定 6 个字：有没有新的漏报或重复 | **有条件接受** | RD-02 的三种漏报都已堵住，没有发现新的伪通过路径。条件是处理两处副作用：源码文字不到 6 个字时又出现重复（RE-02）；脚本插入的同文字新段落少报（RE-03）。两者都不影响页面通过与否，可以作为「有条件达标」的条件。 |

RULINGS.md 里 RULING-07 的状态栏照录了第 4 轮的裁定，RD-03 的条件已落实，内容无误。

---

## 5. 审计方亲自运行的命令和关键输出

全部在本机运行（系统 Chrome 155.0.8059.86，playwright-core 1.64.1），没有联网，没有安装依赖，没有运行 `bench/run-baseline.mjs`。

1. **锁定测试有没有被改**

   ```
   $ git log --format='%h %s' 0b33180..HEAD -- test/                                                     → 无输出
   $ (cd test/fixtures/w2-render-audit-r4 && shasum -a 256 -c MANIFEST.sha256) | grep -vc OK             → 0
   ```

2. **构建和全量测试**（含前四轮的全部回归测试）

   ```
   $ npm run build && npm test
   ℹ tests 210
   ℹ pass 210
   ℹ fail 0
   EXIT=0
   ```

3. **前四轮复现页和新的绕过尝试**（`t1.mjs`、`t2.mjs`，节选）：

   ```
   == hit-text-t11.html    | static: fail ["T11"] | render: fail e=1（保留：完整档在所有宽度下都没有对这个元素检查…）
   == hit-text-t06.html    | static: fail ["T06"] | render: fail e=1
   == hit-sel-t11.html     | static: fail ["T11"] | render: fail e=1
   == append.html          | render: fail e=1 [T03（DOM 快照补报）]
   == replace-common.html  | render: fail e=1 [T03]
   == short-src.html       | render: fail e=1 [T03]
   == tw-opt.html          | render: pass e=0
   == resp.html            | render: fail e=1
   == f-remote.html        | render: pass e=0
   == text-tweak.html      | render: fail e=2（不重复）
   == dup-deep.html        | render: fail e=3（含脚本插入段落的 T03）
   == spa-placeholder.html | render: fail e=2 [T03, T13]
   == vertical-lh.html     | render: fail e=1
   == collide.html         | render: fail e=2
   == table.html           | render: fail e=1
   == same-id.html         | static: fail ["T11"] | render: pass e=0              ← RE-01
   == same-id-prefix.html  | static: fail ["T11"] | render: pass e=0              ← RE-01
   == drawer.html          | static: fail ["T11","T11","T11"] | render: pass e=0 ← RE-01
   == swap.html            | render: pass e=0（显示的是正常元素）
   == swap-text.html       | render: fail e=2（有问题的元素完整档自己报出）
   == short-tweak.html     | render: fail e=3（源码 T03 和 DOM 快照 T03 重复）   ← RE-02
   == same-text-insert.html| render: fail e=2（脚本插入的同文字段落没有报）       ← RE-03
   ```

4. **golden 与对照组**（复制到 `/tmp` 后跑 6 种宽度）：

   ```
   golden         {"files":21,"cjk_files":20,"errors":0,"warns":3,"status":"pass"} kept 0 domAdded 0 generic dup 0 noText 0
   rv-claude-code {"errors":211,"warns":146,"status":"fail"} excl 9 shots 211 kept 0 dup 0 domAdded 0 noText 0
   rv-codex       {"errors":800,"warns":302,"status":"fail"} excl 0 shots 800 kept 10 dup(by selector/page-agg) 0 domAdded 0 noText 0
   ```

5. **收尾**：`/tmp/r5audit/` 和构建日志已删除；`git status --porcelain` 只显示本文件。

---

## 6. 需要用户拍板的事项

| 编号 | 事项 | 审计方意见 |
|---|---|---|
| R-D1 | 是否按 PRD_RENDER_PROPOSAL 第 5 版的改动 1–4 修改 PRD | RE-01 修完后可以批：按元素合并的口径已基本稳定，只差「身份加序号」这一处 |
| R-D2 | 检查本地文件时不允许访问 localhost（包括 TCP 连接） | 同意 |
| D-A1 | T05 按每行汉字数统计，全角标点也算字 | 推荐同意 |
| D-A2 | 页面脚本照常执行，测量放进隔离环境 | 推荐同意 |
