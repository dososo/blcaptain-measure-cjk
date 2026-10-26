# 分寸 · Measure（measure-cjk）W2 · 完整档（`lint --render`）验证报告（第 9 轮：AUDIT_RENDER_r8 回应）

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 4–5 步「开发、验证」→ 第 7 步「审计验收」（第 9 轮） |
| 执行方 | Claude Code（用户指示全部由 Claude Code 闭环） |
| 提交 | 第 1 轮：锁定 `9e41dc9` → 实现 `da754c1` → 报告 `455ffe9` → 验证 `50a95d5`。第 2 轮：审计复现夹具和测试锁定 `155eb92` → 整改 `833977b` → 报告 `8b02a57`。第 3 轮：复核复现夹具和测试锁定 `211a3f5` → 整改 `11b87c7`、`8982d60` → 报告 `dddee8a`。第 4 轮：复核复现夹具和测试锁定 `eb39212` → 整改 `721b80b` → 报告 `5fb9ab9`。第 5 轮：复核复现夹具和测试锁定 `0b33180` → 整改 `a3e78cf` → 报告 `2416ff3`。第 6 轮：复核复现夹具和测试锁定 `5accb15` → 整改 `6654605` → 报告 `f7a1a21`。第 7 轮：复核复现夹具和测试锁定 `faf2af3` → 整改 `2cf021f` → 报告 `51db2ae`。第 8 轮：复核复现夹具和测试锁定 `9435180` → 整改 `27f2aa7` → 报告 `bce170e`。第 9 轮：补 RH-01 的回归测试 → 本报告 |
| 机器判定 | `docs/verification/w2/render/results.json`（`node scripts/verify-w2-render.mjs`，在干净的工作树上运行） |
| 审计报告 | 第 1 轮 `audit/AUDIT_RENDER.md`：未达标，1 Blocker、6 High、6 Medium、8 Low。第 2 轮 `audit/AUDIT_RENDER_r2.md`：未达标，0 Blocker、2 High、4 Medium、3 Low。第 3 轮 `audit/AUDIT_RENDER_r3.md`：流程上未达标，实质上有条件达标，0 Blocker、0 High、4 Medium、1 Low。第 4 轮 `audit/AUDIT_RENDER_r4.md`：未达标，0 Blocker、2 High、0 Medium、2 Low。第 5 轮 `audit/AUDIT_RENDER_r5.md`：未达标，0 Blocker、1 High、0 Medium、3 Low。第 6 轮 `audit/AUDIT_RENDER_r6.md`：未达标，0 Blocker、1 High、0 Medium、3 Low。第 7 轮 `audit/AUDIT_RENDER_r7.md`：未达标，0 Blocker、1 High、0 Medium、2 Low。第 8 轮 `audit/AUDIT_RENDER_r8.md`：只因 R-D1、R-D2 未拍板而未达标；实质上 0 Blocker、0 High、0 Medium、1 Low |
| PRD 变更 | `docs/verification/w2/PRD_RENDER_PROPOSAL.md` 第 8 版，**待用户确认**，PRD 本身没有改动 |

---

## 1. 结论

**执行方自评：达标。最终结论以审计方的终审为准。**

- `verify-w2-render.mjs` 在干净工作树上判「达标」，`verdict_blockers` 为空。
- 用户已于 2026-10-26 拍板 R-D1、R-D2。原话：「R-D1 和 R-D2 都按推荐同意：按 PRD_RENDER_PROPOSAL 第 8 版改动 1–4 修改 PRD，新增附录 C23–C26（我知道 T05 把全角标点也算字会更严）；检查本地文件时不允许访问 localhost。」
  - 原话已写进 `open_decisions.json` 的 `user_quote`、`resolved_on`、`user_message_verbatim`。
  - 提案第 8 版已写进 `docs/PRD.md`：§5.4、§7.2、§7.3，附录 C23–C26。
- D-A1、D-A2 不阻塞结论，已按 PRD 原文和审计推荐实现，用户可以否决。
- **本段范围：** 只有完整档（`lint --render`）。`card` 命令和 W2 的其余各项不在本段，见 §8。

- **第 8 轮复核：实质上已经没有 Blocker、High、Medium。** 审计方写明：R-D1、R-D2 拍板之后，结论是「有条件达标」；下面三条全部落实，就判「达标」：
  1. 用户本人书面答复，写进 `open_decisions.json` 的 `user_quote` 和 `resolved_on`；然后把提案第 8 版写进 PRD 和附录 C，在干净工作树上重跑 `verify-w2-render`，`verdict_blockers` 为空。已落实（用户 2026-10-26 拍板，`1d227c1`）。
  2. RH-01 补上测试：已补，`H-RH01-drawer-alt`，见 §16。
  3. RF-03 留在「已知局限」里，响应矩阵注明「审计方第 6 轮同意不改」：已注明，见 §15。
- **第 7 轮复核的 3 条发现（RG-01 至 RG-03）已全部处理**，见 §15 的审计响应矩阵：
  - 先锁定复现夹具和测试：整改前 RG-01 的复现页失败（`evidence/audit-r7-tests-before-fix.log`）；另外两页是审计方已确认判断正确的写法，作为 RG-03 的回归测试补进来，整改前就通过；
  - 整改后全部通过（RV-20）。
  - 锁定之后没有再改测试。
- 第 7 轮复核确认：RF-01 至 RF-04 都已修好，「全部检查过才取代」这条规则在 4 种绕过尝试下判断正确。审计方的意见是：RG-01 修好并复核通过、用户拍板 R-D1 和 R-D2 之后，结论会是「有条件达标」，条件是 RG-02、RG-03 和 RF-03 在响应矩阵里逐条回应。
- 任务门：RV-01 至 RV-21 全部 PASS。回归门 PASS：222 个测试，失败 0。关键字扫描未发现问题（这只是关键字扫描，伪成功路径靠 RV-14 至 RV-21 的行为测试覆盖）。
- AC-2（完整档）：golden 20 页零 error，warn 3 条（g02 的 3 个 `li` 行高 2.00，属实）。AC-6（W2 版）、AC-7：通过。
- **本段没有做 `card` 命令**（小红书卡片导出，P0），见 §8。

---

## 2. 断言逐条

各条的状态和说明以 `results.json` 为准，真实输出在 `evidence/RV-*.log`。

| 编号 | 内容 | 结果 |
|---|---|---|
| RV-01 | AC-2 完整档：golden 20 页里出现 error 的页面 ≤ 1 | PASS：0 页；6 种宽度；系统 Chrome 155.0.8059.86（playwright-core） |
| RV-02 | 22 个规则夹具按 `expect.json` 命中或不命中；每条 error 都有 PNG 截图；实测规则带视口宽度 | PASS |
| RV-03 | AC-6：在没有 Playwright 的目录里跑 `--render` → 退出码 2 加安装提示；同一份拷贝不加 `--render` 照常运行 | PASS |
| RV-04 | AC-7：`127.0.0.1` 服务上的页面，6 种宽度、`network: localhost`、T05 和 T01 都报出、每条 error 都有截图 | PASS |
| RV-05 | 浏览器一侧网络拦截：远程资源、工作区外的 file://、localhost 服务（HTTP 请求数为 0） | PASS |
| RV-06 | Node 一侧零网络请求 | PASS |
| RV-07 | 死循环页面 → `incomplete`；预算环境变量只能调低 | PASS |
| RV-08 | URL、`--widths`、截图目录的校验 | PASS |
| RV-09 | R-01（页面打不开）、R-02（IP 字面量）、R-03（HTTP 302 不算跳转） | PASS |
| RV-10 | 18 份 MANIFEST 校验通过（新增 `w2-render-audit` 至 `w2-render-audit-r8`） | PASS |
| RV-11 | 基础档默认零网络；源码里没有网络和子进程模块的导入 | PASS |
| RV-12 | 全量测试 222 项，失败 0 | PASS |
| RV-13 | **完成度检查**：对照组 v2 的 60 页在完整档下全部检查完。只检查完成度，不检验结果对不对；结果的抽查见 §3 | PASS |
| RV-14 | AUDIT_RENDER 回归：19 个复现夹具和 13 个测试 | PASS |
| RV-15 | AUDIT_RENDER_r2 回归：17 个复现夹具和 7 个测试 | PASS |
| RV-21 | AUDIT_RENDER_r8 回归：1 个夹具和 1 个测试（同身份元素在不同宽度下轮流可见） | PASS |
| RV-20 | AUDIT_RENDER_r7 回归：3 个复现夹具和 3 个测试 | PASS |
| RV-19 | AUDIT_RENDER_r6 回归：3 个复现夹具和 3 个测试 | PASS |
| RV-18 | AUDIT_RENDER_r5 回归：5 个复现夹具和 5 个测试 | PASS |
| RV-17 | AUDIT_RENDER_r4 回归：6 个复现夹具和 8 个测试，含「基础档判 fail 的页面完整档不能判 pass」和「带选择器的 error 都有文字指纹」 | PASS |
| RV-16 | AUDIT_RENDER_r3 回归：6 个复现夹具和 8 个测试，含「同一规则、同一元素最多一条 error」的通用断言（全部完整档夹具，以及 golden 和对照组共 80 页） | PASS |

### 2.1 第 1 轮实现中发现的问题（沿用）

R-01 伪成功、R-02 IP 字面量被误伤：先修复后补测试。撤掉修复用的命令按审计方要求补进了 `evidence/render-review-undo-patch.md`。

---

## 3. 基线数据

用完整档重新检查**对照组 v2**（隔离环境、不装 skill）的 60 个页面。没有重新调用 agent，数字取自 `evidence/RV-13.json`。耗时每次运行会差零点几秒，表里写的是约数，准确值以 `RV-13.json` 为准；页数、规则命中数、截图数每次都一样。

| agent | 检查方式 | 零 error | 排除 T02/T04 后零 error | 各规则命中的页面数（error） | 耗时 |
|---|---|---|---|---|---|
| codex | 基础档 | 0/30 | 4/30 | T02 30、T04 30、T11 25、T07 15、T13 7、T03 4、T06 2、T08 1 | — |
| codex | **完整档** | 0/30 | **0/30** | T02 30、T04 30、T11 30、T07 19、T05 8、T06 7、T13 7、T03 4、T08 1 | 约 38 秒（800 张截图） |
| claude-code | 基础档 | 0/30 | 18/30 | T02 30、T04 30、T03 7、T11 2、T13 2、T08 2、T07 1 | — |
| claude-code | **完整档** | 0/30 | **9/30** | T02 30、T04 30、T11 8、T03 7、T07 5、T05 3、T08 2、T13 2 | 约 19 秒（211 张截图） |

**第 5、6 轮的变化：** 各规则命中的页面数和前几轮相同。统计脚本 `bench/kept-reasons.mjs` 同时列出「保留原因」和「完整档是否对同一元素、同一规则也报了」，第 5 轮的输出见 `evidence/RD-kept-reasons.log`。第 6 轮（元素身份加了序号）的输出见 `evidence/RE-kept-reasons.log`，第 7 轮的见 `evidence/RF-kept-reasons.log`，第 8 轮的见 `evidence/RG-kept-reasons.log`，结果都和第 5 轮完全一样：
- codex 组：保留 10 条，**其中与完整档重复 0 条**。
  - 没有展开的 `<option>` 里的小字号：6 条。比第 4 轮多的 1 条是 023 页的「无需通勤」，第 4 轮被一个同文字的可见单选项删掉了，审计方在 RD-01 里指出了这个问题，现在照常保留。
  - 关着的对话框：1 条。
  - 表格的 `caption`：1 条。
  - 被代码高亮脚本改写过的代码块：2 条。
- claude-code 组：保留 0 条。
- 两组都没有 DOM 快照补报的结论。

**和第 1 轮相比：**
- claude-code 组的 T06 从 2 页降到 0 页：那 9 条都是 RA-07 的浮点误报。
- claude-code 组的 T05 从 6 页降到 3 页：T05 改为按字数统计（D-A1），中英混排的行不再被高估。
- 排除 T02/T04 后的零 error 页数：claude-code 从 8 变成 9，codex 仍是 0。

**抽查清单（RA-13 第 2 条）。** 在 claude-code 组里找出完整档新增的 error（同一页面、同一规则基础档没有报），按规则等距各抽 2 张截图，逐张查看：

| 规则 | 页面 | 元素 | 宽度 | 截图里看到的 | 判定 |
|---|---|---|---|---|---|
| T05 | 003 | `p.note:nth-of-type(2)` | 1024 | 「安全底线：所有活动必须佩戴头盔……取消或改期。」一行 54 个字 | 属实 |
| T05 | 018 | `header.hero > p` | 768 | 「本说明介绍三项常用操作……请」一行 46 个字 | 属实（刚超过 45） |
| T07 | 004 | `div.hero-copy > h1` | 360 | 标题「周报不再硬凑，邮件不再纠结。」，计算字距 -0.672px | 属实（规则定义：字距为负即报） |
| T07 | 002 | `div > h1` | 360 | 标题「团队的每一笔钱，清清楚楚。」，计算字距 -0.32px | 属实 |
| T11 | 029 | `p.title > small` | 360 | 「浓郁」7.5px | 属实 |
| T11 | 027 | `li > span.note` | 360 | 「住龙翔桥附近」9px（只在 360、390 宽度下） | 属实 |

各规则新增的 error 条数：T05 3 条、T07 6 条、T11 98 条，T06 0 条。上表只抽了 6 张截图，**不是全量复核**。

---

## 4. 依赖与 license 清单

和第 1 轮相同：
- `playwright-core` 1.64.1：开发依赖，对使用者是可选 peer 依赖，Apache-2.0；
- `playwright` ≥ 1.48：可选 peer 依赖，Apache-2.0。

本仓库不打包 Playwright 和浏览器（见 `NOTICE`）；没有引入新依赖。完整档用到的 CDP 是 Playwright 自带的接口，不是新依赖。

---

## 5. 已知局限

1. **隔离环境只能防住页面改写测量代码，防不住页面改 DOM 和样式。** 例如页面检测到窗口大小变化后临时换一套样式，测到的就是那套样式。完整档只适合检查自己的页面，不能用来给第三方页面「认证」。
2. **只在系统 Chrome 155 上跑过。** 「playwright 自带的 Chromium」和「系统 Edge」两条路径没有实测，待确认。完整档依赖 CDP，不支持 Firefox、WebKit。
3. WebRTC 只靠 Chrome 参数限制非代理的 UDP，没有专门的测试。
4. 截图目录里上一次运行留下的旧截图不会被清理。
5. 超时的页面保留基础档的结果，但这些 error 没有截图。整体结果是 `incomplete`，不会当作通过。
6. T05 只检查上限（40 / 45 字），没有检查 28 字的下限。
7. 行号靠「选择器 + 文字指纹」和源码对应，对不上时不给行号（RA-16）。这样不会给错，但可能缺。
8. A01 的色相范围是经验值，只检查渐变，不检查纯色背景。
9. 视口高度固定为 800px。
10. 「渲染后看不到中文」判为 `incomplete`。像防闪烁写法这种要等脚本去掉隐藏的页面，完整档不会等，会如实报告没检查完。
11. iframe 的内容完整档不检查：页面的 iframe 里有中文就记为没检查完（RB-04），需要单独检查 iframe 指向的页面。跨进程的 iframe 无法确认时，也记为没检查完。
12. 识别「加载后换了文档」靠浏览器事件。`document.open()` 加 `document.write()` 改写当前文档不算换文档：测到的就是用户看到的内容，源码里对不上的结论按元素合并保留。这是审计方第 2 轮认可的处理。
13. T05 的字数把弯引号、破折号、省略号也算进去。它们在英文里也会出现，中英混排时会多算几个字。
14. 元素的身份是「选择器 + 文字指纹 + 序号」，序号两边各自按文档顺序编。脚本挪动、复制、调换同一「选择器 + 指纹」的元素后，序号会对错，所以这种「选择器 + 指纹」出现不止一次的情况不靠序号判断：浏览器里这些元素全部做过检查才取代基础档结论（RF-01）。第 6 轮报告里「序号对错时按对应不上处理」的说法与当时的代码不符（RF-02），已更正。
15. 浏览器语言固定为 zh-CN。好处是结果不随操作系统语言变化；代价是按 `navigator.language` 或 `Accept-Language` 切换内容的页面，检查的是中文版。
16. DOM 快照补报靠文字的公共片段判断「是不是源码里那个元素被脚本改了文字」，门槛固定为 6 个字，这是经验规则。即使判断成同一个元素，只要源码没对它报过同一条规则，DOM 快照里的结论照样补报。
17. 元素在浏览器里对不上、文字又对应多个元素时，保留基础档结论。这种情况可能和完整档对其中某个元素的报告重复，但不会把有问题的元素漏掉。
18. DOM 快照补报（RE-03）：脚本插入了同文字的新元素，并且这个插入让原来那个元素的选择器变了（例如多了 `:nth-of-type`）时，原来那个元素的结论也会被当成新内容再报一次。这会造成重复，不会漏报。
19. 页面上的中文元素超过 20 万个时，记为没检查完（RG-01），不再静默截断。
20. 耗时（RG-02）：选择器按父元素缓存之后，同一父元素下 1000、2000、3000 个中文元素，单宽度分别是 1.0、0.9、1.1 秒；整改前是 1.5、3.1、6.0 秒（`evidence/RG-02-scale.log`）。这组数字只在本机测过，不同机器会不一样。

---

## 6. 伪成功扫描

**方法：**
- 关键字扫描（`evidence/pseudo-success-scan.log`）：
  - 搜 `.skip`、`.only`、`todo`；
  - 搜 `assert.ok(true)`；
  - 搜空的 `catch`；
  - 搜 mock，包括 `runLint =`、`runRender =`；
  - 搜 `--force`。

  结果：未发现。
- **关键字扫描的局限（RA-13）：** 它发现不了逻辑上的伪成功路径。第 1 轮的 RA-03 至 RA-06、第 2 轮的 RB-01 至 RB-04 都是关键字扫描漏掉的。这一类路径现在由 RV-14、RV-15 的行为测试覆盖：
  - 脚本渲染的中文；
  - 加载时整页隐藏；
  - 加载后跳转；
  - HTTP 404、500；
  - 测量结果被篡改；
  - 源码里有占位中文、正文由脚本渲染；
  - 竖排段落、选择器碰撞；
  - `blob:`、`javascript:` 跳转；
  - 中文全在 iframe 里；
  - 不可见的同文字元素、响应式的两份文字（不能让近似误报复活）；
  - 被拦截的外部 iframe（不能误判为 iframe 里有中文）。

  每种情况都断言结果不是 pass、退出码不是 0。

---

## 7. 需要审计方裁定的问题

无新的问题。第 8 轮审计方已对上一轮的两个问题给出裁定：
- 元素清单不截断、20 万上限记为没检查完：同意；
- 不需要其他性能处理。

---

## 8. 下一轮建议

1. **用户确认 R-D1、R-D2 之后**：把提案第 8 版的改动 1–4 写进 PRD，新增附录 C23–C26，再重跑 `verify-w2-render.mjs`。
2. **`card` 命令**：和 3 种 1080×1440 卡片模板、F06 一起做（AC-9）。先锁定夹具和测试，再实现。
3. **北极星实验**：按 `NORTH_STAR_PLAN.md` 跑 v3 对照组和实验组，共 120 次运行。完整档的口径已经按审计修正。
4. W2 其余项：静态的 A 系列规则（A02–A07、A09、A12）、6 个主题、10 组前后对比图、展示页。
5. 遗留的 Low：A-46、W2-07、W2-08；未决开放决策 D-6、D-7、D-8、D-A1、D-A2。

---

## 9. 审计响应矩阵（AUDIT_RENDER，第 1 轮）

「测试」一列里，「锁定在前」表示测试写在整改之前，并且整改前失败（`evidence/audit-tests-before-fix.log`）。

| 发现 | 严重度 | 状态 | 落在哪 | 怎么落的 | 测试 / 证据 |
|---|---|---|---|---|---|
| RA-01 | Blocker | 已落实 | `render.ts` 的 `sanitizeProbeItems`、`screenshot`；`probe.ts` | 测量放进 CDP 隔离环境；返回值按白名单校验，不合格的丢弃，本页记为 incomplete；截图文件名只用白名单里的规则 ID，写之前核对路径没有越出截图目录 | `A-RA01-push-traversal`（工作区上一级没有新文件）、RA-01 单元测试；锁定在前 |
| RA-02 | High | 已落实 | `render.ts` 的 `inWorld` | `measurePage`、`locateElement`、`snapshotPage`、`markElement` 和等待字体、等待重绘的代码，都通过 `Page.createIsolatedWorld` 加 `Runtime.evaluate` 在隔离环境里执行；元素登记表也放在隔离环境里 | `A-RA02-launder`：完整档报 T07、T11；锁定在前 |
| RA-03 | High | 第 2 轮复核：部分修好；第 3 轮按 RB-01 补齐 | `render.ts` 的 `staticPass` | 本地页面也取 DOM 快照；源码里没有中文、DOM 里有时，按快照跑基础档规则，不带行号，消息里注明 | `A-RA03-spa`：报 T07、T11，状态 fail；锁定在前 |
| RA-04 | High | 第 2 轮复核：部分修好；第 3 轮按 RB-02、RB-05 补齐 | `render.ts` 的 `dropStatic`、`mergePage`；`probe.ts` 的 `visible`、`measured` | ① 覆盖校验：页面有中文、但所有宽度下可见的中文元素都是 0 时，记为 `no-visible-cjk`、incomplete；② 按元素合并：只取代完整档实测过的元素，没测到的保留基础档结论并注明；③ `display: contents` 按文字的矩形判断可见性和位置 | `A-RA04-fouc`（incomplete）、`A-RA04-details-contents`（两条 T07 error）；锁定在前 |
| RA-05 | High | 第 2 轮复核：部分修好；第 3 轮按 RB-03 补齐 | `render.ts` 的路由处理 | 主页面的第二次及以后的导航一律拦截，本页记为 `navigated`、incomplete；弹出窗口直接关掉；服务器的 HTTP 重定向不受影响 | `A-RA05-redirect`（incomplete，锁定在前）；R-03（302 照常检查，写于实现之后） |
| RA-06 | High | 已落实 | `render.ts` 的 `renderOne` | 没有响应记为 `unreadable`；HTTP ≥ 400 记为 `http-error`；都是 incomplete | RA-06 测试（404、500 都是 incomplete）；锁定在前 |
| RA-07 | High | 已落实 | `probe.ts` 的 T06 | error 判定留 0.005 的容差：`lh < min - 0.005` | `A-RA07-lh15-vw`（锁定在前）；RV-13 里 claude-code 组的 T06 从 2 页降到 0 页 |
| RA-08 | Medium | 已落实 | `probe.ts` 的 `linesOf` | 按阅读顺序逐字归行；往左回绕、跳到下一栏（间隔超过 1.5 个字号）算新的一行 | `A-RA08-columns`；锁定在前 |
| RA-09 | Medium | 已落实 | `lint.ts` 的去重；`render.ts` 的 `runRender` 末尾 | 去重时优先保留带截图的那条；只检查样式表时，F03 消息里注明「没有可截图的页面」 | RA-09 测试；锁定在前 |
| RA-10 | Medium | 已落实 | `probe.ts` 的 T07 | 页面上有任何 `tracking-` 类的样式规则时，不再按类名推断；样式没加载时仍然推断（锁定夹具 `R-T07-neg-tailwind-class` 照样报） | `A-RA10-tracking-reset`；锁定在前 |
| RA-11 | Medium | 已落实（按 PRD 原文） | `probe.ts` 的 T05 | 统计每行的字数（汉字加全角标点），不再用行宽 ÷ 字号；D-A1 列为不阻塞的开放决策 | `A-RA11-mixed-latin`、`A-RA11-exactly-45`；锁定在前 |
| RA-12 | Medium | 已落实 | `probe.ts` 的 A01 | 色相下限从 250° 放到 235°；也检查 `::before`、`::after` | `A-RA12-blue-indigo`、`A-RA12-before`、`A-RA12-pos-blue`；锁定在前 |
| RA-13 | Medium | 已落实 | 本报告 | 数字一律取自重跑后的 `RV-13.json`；抽查改为逐张看截图并附清单（§3）；伪成功扫描写明是关键字扫描（§6）；RV-13 改称完成度检查 | 本报告 §2、§3、§6 |
| RA-14 | Low | 已落实 | `render.ts` 的 `omitted` | 按「规则 → 选择器」集合计数，不再按宽度重复计 | `A-RA14-overflow`（另有 5 处）；锁定在前 |
| RA-15 | Low | 已落实；第 3 轮补了测试（`B-RA15-t04-both`） | `render.ts` 的合并键 | 「实测标点落在行首」和「line-break 不是 strict」用不同的键，分别报告 | 只改了代码；锁定夹具 `R-T04-neg-anywhere` 仍然报出实测那条 |
| RA-16 | Low | 已落实 | `model.ts` 的 `textOf`；`render.ts` 的 `lineFor` | 行号要求「选择器 + 文字指纹」都对上；对不上时按唯一的文字指纹找；还找不到就不给行号 | `A-RA16-shift`；锁定在前 |
| RA-17 | Low | 已落实（写进提案） | `probe.ts` 的 T05、T06 | `p`、`li` 按自己的全部文字算，文字在行内子元素里也算；写进提案第 2 版改动 2 | `A-RA17-inline-only`；锁定在前 |
| RA-18 | Low | 已落实 | `cli.ts` 的 `term`；`probe.ts` 的 `clean` | 文本格式输出前把控制字符换成「�」；测量消息里引用的页面原文也去掉控制字符并限长 | RA-18 测试（锁定在前；测试输入的修正见 RULING-06） |
| RA-19 | Low | 已落实 | `render.ts` 的 `launchBrowser` | 本地文件和 URL 用两个浏览器实例；本地文件模式下，DNS 规则不排除 localhost，代理加 `<-loopback>`，localhost 也走一个不存在的代理 | RA-19 测试（TCP 连接数 0；锁定在前）；用旧参数对照，测到 4 个连接（`evidence/RA-19-old-args.log`） |
| RA-20 | Low | 已落实 | 测试 | ① 完整档的 T02 反例；② 两个边界夹具：行高 1.5 配小数字号、每行正好 45 字；③ 两个对抗页面：改写数组方法、伪造 `getComputedStyle`；④ 读截图的 PNG 宽高，核对它和元素的大小一致 | `A-RA20-T02-no-autospace` 等；RA-20 测试 |
| RA-21 | Low | 已落实 | `test/w2-render-review.test.js` 第 1 行 | 注释改为指向 `docs/verification/w2/render/VERIFICATION_REPORT.md §2.1` | — |
| §3 第 1 条 | — | 已照录 | `RULINGS.md` 的 RULING-04 | 状态栏照录审计方结论 | — |
| §3 第 2 条 | — | 已落实 | `evidence/render-review-undo-patch.md` | 补上撤掉修复用的命令 | — |
| §3 第 5 条 | — | 已落实 | `RULINGS.md` 的 RULING-05；`test/cli.test.js` | 登记；测试改名，并补上一条能成功渲染的断言 | `test/cli.test.js` |

---

## 10. 审计响应矩阵（AUDIT_RENDER_r2，第 2 轮）

「锁定在前」表示测试写在整改之前，并且整改前失败（`evidence/audit-r2-tests-before-fix.log`）。

| 发现 | 严重度 | 状态 | 落在哪 | 怎么落的 | 测试 / 证据 |
|---|---|---|---|---|---|
| RB-01 | High | 已落实 | `render.ts` 的 `staticPass` | 基础档规则既查源码，也查浏览器渲染后的 DOM 快照。DOM 里有、源码里没有的中文元素（按文字指纹判断），它们的结论补进结果，不带行号，并注明「是脚本渲染出来的」 | `B-RB01-spa-placeholder`（报 T03、T13，状态 fail），以及「占位页和直接写进源码的页面结论一致」；锁定在前 |
| RB-02 | High | 已落实 | `probe.ts` 的 `checked`、`textCounts`；`render.ts` 的 `staticVerdict` | 测量函数按规则记录「真的检查过的元素」（文字指纹 → 个数）：竖排不进 T05、T06，代码块不进 T05、T06。基础档的结论只有在「浏览器里同文字的元素不比源码少，并且每一个都做过这条规则的检查」时才被取代；选择器对应多个元素时一律保留。真实页面上保留下来的条数见 §3 | `B-RB02-vertical-lh`、`B-RB02-collide`；锁定在前 |
| RB-03 | Medium | 已落实 | `render.ts` 的 `renderOne` | 路由拦截之外，再用两个 CDP 事件判断：主框架的 `Page.frameNavigated` 多于一次；同一次提交之后，主框架新建了不止一个默认执行环境（`Runtime.executionContextCreated`）。实测：`blob:` 是两次提交；`javascript:` 是一次提交、两个执行环境；`pushState` 都是一次 | `B-RB03-nav-blob`、`B-RB03-nav-js`（incomplete）、`B-RB03-pushstate`（fail，没有误判）；锁定在前 |
| RB-04 | Medium | 已落实（最低限度） | `render.ts` 的 `framesWithCjk` | 在每个子框架里各建一个隔离环境，检查有没有中文；有，或者无法确认，就记为 `cjk-in-frame`、incomplete。不逐个框架测量 | `B-RB04-frame`（incomplete）；锁定在前 |
| RB-05 | Medium | 已落实 | `render.ts` 的 `staticVerdict`、`mergePage` | 用文字指纹对应元素，不靠选择器，浏览器补 `<tbody>` 不再造成重复报告。保留下来的结论写明具体原因：选择器对应多个元素；浏览器里找不到这个元素；同文字的元素比源码少；完整档没有对它检查这条规则。不再笼统地说「没测到」 | `B-RB05-table`（只有一条 T07，消息里没有「没测到」）；锁定在前 |
| RB-06 | Medium | 已落实 | `probe.ts` 的 `multicol`、`linesOf` | 只有段落自己或祖先是多栏排版时，才按「间隔超过 1.5 个字号」断行；其余只按垂直位置变化和往左回绕断行 | `B-RB06-gap`（不报 T06 error）、`B-RB06-icon`（报 T05 error）；锁定在前 |
| RB-07 | Low | 已落实 | `probe.ts` 的 `isViolet`；提案第 3 版；`anti-patterns.md` | 250°–320° 照旧；235°–250° 只在饱和度 60%–95%、亮度 40%–75% 时才算。纯蓝、藏青不报，靛蓝单色渐变照样报 | `B-RB07-navy`、`B-RB07-pure-blue`、`B-RB07-indigo-mono`；锁定在前 |
| RB-08 | Low | 已落实 | 本报告 §1、§9；提案第 3 版 | §9 里 RA-03、RA-04、RA-05 的状态按复核结论更正；提案改写成实际行为（跳转的识别方式、A01 的范围） | — |
| RB-09 | Low | 已落实 | 测试 | ① RA-15 补了夹具 `B-RA15-t04-both`：同一元素必须同时有两类 T04；② RA-16 补了必须给出正确行号的正例 `B-RA16-line`；③ RB-01 至 RB-07 都有锁定在前的夹具 | RV-15 |
| §4.1 第 1 条 | — | 已照录 | `RULINGS.md` 的 RULING-06 | 状态栏照录审计方结论 | — |
| §4.1 第 3、4 条 | — | 已落实 | 提案第 3 版改动 2、开放决策 R-D1 | 写明「全角标点也算字」会让 T05 变严，每行通常多算 3–6 个字，随 R-D1 一起由用户确认；也写明弯引号等在英文里也会被算进字数 | — |
| §4.1 第 5 条 | — | 已落实 | `render.ts` 的 `staticVerdict` | 见 RB-05 一行 | — |

---

## 11. 审计响应矩阵（AUDIT_RENDER_r3，第 3 轮）

「锁定在前」表示测试写在整改之前，并且整改前失败（`evidence/audit-r3-tests-before-fix.log`）。

| 发现 | 严重度 | 状态 | 落在哪 | 怎么落的 | 测试 / 证据 |
|---|---|---|---|---|---|
| RC-01 | Medium | 已落实 | `types.ts` 的 `EL_TEXT`；`rules.ts`；`probe.ts` 的 `ids`、`checked`；`render.ts` 的 `staticVerdict` | 基础档的每条结论带上对应元素的文字指纹（Symbol 键，不进 JSON）。浏览器一侧返回全部元素和每条规则检查过的元素的身份（选择器 + 指纹），各宽度取并集。判定顺序：① 完整档对同一元素已报同一规则 → 取代；② 有身份相同的元素 → 看它是否做过检查；③ 身份对不上时按指纹找，找到的都检查过才取代。保留时写明原因 | `C-RC01-tw-option`（合规页面判通过）、`C-RC01-responsive`（T11 只有一条）；锁定在前。codex 组「保留且与完整档重复」从 15 条降到 0 条（`RC-04-kept-reasons.log`） |
| RC-02 | Medium | 已落实 | `render.ts` 的 `framesWithCjk`、`renderOne` | 跳过 `chrome-error:` 框架；`goto` 之后主页面是错误页时记为 `unreadable`；取 DOM 快照前主页面已经是错误页的，不取快照；判为「换了文档」时撤回从 DOM 快照补进来的结论；浏览器语言固定为 zh-CN（理由见 §7 第 3 条） | `C-RC02-remote-iframe`（判通过）、`C-RC02-redirect-errorpage`（incomplete，结果里没有错误页的结论）；锁定在前 |
| RC-03 | Medium | 已落实 | `render.ts` 的 `staticPass`（`fresh`、`commonRun`）；`lint.ts` 的去重键 | DOM 快照的结论在以下任一情况下算「源码里已有」，不补：同一选择器加同一文字；文字在源码里出现过；同一选择器的源码元素和它有 6 个字以上的公共片段；源码里有完全相同的结论；指纹为空、而源码里有这个选择器的元素。逐页去重的键加上文字指纹，同名元素不再互相顶掉 | `C-RC03-text-tweak`（T03、T13 各一条）、`C-RC03-dup-deep`（两个段落都报，含脚本插入的那个）；锁定在前 |
| RC-04 | Medium | 已落实 | `bench/kept-reasons.mjs`；本报告 §3 | 统计脚本放进仓库，同时列出「保留原因」和「完整档是否对同一元素、同一规则也报了」；报告按统计结果写，不再凭推测解释 | `evidence/RC-04-kept-reasons.log`。旧的 `RB-02-kept-reasons.log` 保留，文件头注明已被取代 |
| RC-05 | Low | 已落实 | `test/w2-render-audit-r3.test.js` | 通用断言：同一页面、同一规则、同一元素最多一条 error。范围是全部完整档夹具（4 个目录），以及 golden 和对照组共 80 页（同一元素的口径见 RULING-07） | RV-16 |
| §4.1 第 1 条 | — | 同意，无需改动 | — | 「不少于」的部分审计方同意；「每一个都检查过」的部分按 RC-01 改为按元素判断 | — |
| §4.1 第 3 条 | — | 已落实 | — | 条件是先修 RC-02，已修 | — |
| §4.1 第 4 条 | — | 已落实 | — | 条件是先修 RC-03，已修 | — |

---

## 12. 审计响应矩阵（AUDIT_RENDER_r4，第 4 轮）

「锁定在前」表示测试写在整改之前，并且整改前失败（`evidence/audit-r4-tests-before-fix.log`）。

| 发现 | 严重度 | 状态 | 落在哪 | 怎么落的 | 测试 / 证据 |
|---|---|---|---|---|---|
| RD-01 | High | 已落实 | `render.ts` 的 `staticVerdict`、`hits` | 去掉「同一选择器或同一文字指纹、任何级别」的匹配。现在只看身份完全相同的元素有没有做过检查；身份对不上时，只有文字指纹恰好对应一个元素才按它判断，对应多个就保留。`hits` 改为按完整身份记录，只用于 T08 两边去重 | `D-RD01-hit-text-t11`、`D-RD01-hit-text-t06`、`D-RD01-hit-sel-t11`（都判 fail），以及「基础档判 fail 的页面完整档不能判 pass」；锁定在前。真实数据：023 页「无需通勤」的 `<option>` 照常保留（`RD-kept-reasons.log`） |
| RD-02 | High | 已落实 | `render.ts` 的 `staticPass` 中的 `fresh` | 按结论判断要不要补报：先找对应的源码元素，只有源码对它报过同一条规则才不补。公共片段门槛固定为 6 个字，源码文字不到 6 个字时只认完全相同 | `D-RD02-append`、`D-RD02-replace-common`、`D-RD02-short-src`（都报 T03、判 fail）；锁定在前。`C-RC03-text-tweak` 仍然只报一条（RV-16） |
| RD-03 | Low | 已落实 | `test/w2-render-audit-r4.test.js` | 新增断言：全部完整档夹具里，带选择器的 error 都带文字指纹（`@font-face` 的 F03 除外） | RV-17 |
| RD-04 | Low | 已落实 | 本报告 §7 | 第 4 轮 §7 第 2 条「不会变成伪通过」的说法不成立，已删除；本轮 §7 按实际行为改写 | — |
| §4 第 1 条（RULING-07） | — | 已照录 | `RULINGS.md` 的 RULING-07 | 状态栏照录审计方结论；附带的条件见 RD-03 | — |
| §4 第 3 条（zh-CN） | — | 已落实 | 本报告 §5 第 15 条 | 写明按 `navigator.language` 切换内容的页面，检查的是中文版 | — |

---

## 13. 审计响应矩阵（AUDIT_RENDER_r5，第 5 轮）

「锁定在前」表示测试写在整改之前，并且整改前失败（`evidence/audit-r5-tests-before-fix.log`）。

| 发现 | 严重度 | 状态 | 落在哪 | 怎么落的 | 测试 / 证据 |
|---|---|---|---|---|---|
| RE-01 | High | 已落实 | `types.ts` 的 `EL_ORD`；`model.ts` 的 `ordOf`；`rules.ts`；`probe.ts` 的 `ordOf`、`idOf`；`render.ts` 的 `staticVerdict` | 元素身份加上序号（同一「选择器 + 文字指纹」在文档里的第几个）。基础档的结论、完整档的 `ids` 和 `checked` 都按「选择器 + 指纹 + 序号」对应。身份对不上时按文字找，仍然要求这段文字在浏览器里只对应一个元素 | `E-RE01-drawer`、`E-RE01-same-id`、`E-RE01-same-id-prefix`（都判 fail）；锁定在前 |
| RE-02 | Low | 已落实 | `render.ts` 的 `staticPass` 中的 `fresh` | 文字在源码里没有时，同一选择器、并且源码文字（至少 2 个字）整段出现在 DOM 文字里，也算对应 | `E-RE02-short-tweak`（T03、T13 各一条）；锁定在前。RD-02 的 `short-src`（「无」）仍然补报（RV-17） |
| RE-03 | Low | 已落实 | 同上 | 「文字相同」只在 DOM 里这段文字的元素不比源码多时才算对应；多出来的，只有选择器、文字、序号完全相同的才算对应，其余作为新内容补报 | `E-RE03-same-text-insert`（两处 T03 都报）；锁定在前 |
| RE-04 | Low | 已落实 | `test/w2-render-audit-r5.test.js` | RE-01 至 RE-03 各有锁定在前的测试 | RV-18 |
| §5 裁定第 2 条 | — | 同意，无需改动 | — | 身份对不上、文字唯一时按那个元素判断：审计方同意 | — |
| §5 裁定第 3 条 | — | 已落实 | — | 条件是处理 RE-02、RE-03，已处理 | — |

---

## 14. 审计响应矩阵（AUDIT_RENDER_r6，第 6 轮）

「锁定在前」表示测试写在整改之前，并且整改前失败（`evidence/audit-r6-tests-before-fix.log`）。

| 发现 | 严重度 | 状态 | 落在哪 | 怎么落的 | 测试 / 证据 |
|---|---|---|---|---|---|
| RF-01 | High | 已落实 | `render.ts` 的 `staticVerdict`、`StaticInfo.srcBaseCount` | 「选择器 + 文字指纹」在源码或浏览器里出现不止一次时，不靠序号：浏览器里这些元素全部做过这条规则的检查才取代，否则保留，并注明「有多个选择器和文字都相同的元素」。只出现一次时，按那一个元素判断 | `F-RF01-drawer-portal`、`F-RF01-drawer-clone`（都判 fail，T11 ≥ 3 条）；锁定在前 |
| RF-02 | Low | 已落实 | 本报告 §5 第 14 条 | 按 RF-01 修好后的实际行为改写，并注明第 6 轮报告里的说法与当时的代码不符 | — |
| RF-03 | Low | 已披露，不改 | 本报告 §5 第 18 条 | 审计方复现确认只会重复、不会漏报，并裁定可以接受（第 6 轮 §7 第 2 条） | — |
| RF-04 | Low | 已落实 | `test/w2-render-audit-r6.test.js` | 补上「调换顺序」（`F-RF04-swap`）、「脚本挪动」（portal）、「只在 DOM 里多出同身份元素」（clone）三种情况的测试 | RV-19 |

---

## 15. 审计响应矩阵（AUDIT_RENDER_r7，第 7 轮）

| 发现 | 严重度 | 状态 | 落在哪 | 怎么落的 | 测试 / 证据 |
|---|---|---|---|---|---|
| RG-01 | High | 已落实 | `probe.ts` 的 `ids`；`render.ts` 的 `mergeIds` | 浏览器一侧不再截断元素清单（原来是 5000 个）。Node 一侧保留 20 万个的安全上限，超过时整页记为没检查完，不静默截断 | `G-RG01-cap`（5200 个中文元素，判 fail，报 T11）；锁定在前，整改前失败 |
| RG-02 | Low | 已落实 | `probe.ts` 的 `nthOf`、`selectorOf`（缓存）、`indexOf`、`paraSet`；`render.ts` 的 `byBase`、`byText` | `:nth-of-type` 的序号按父元素一次算好、整页缓存；元素序号用 Map 取；Node 一侧给身份清单建索引 | `bench/render-scale.mjs`；`evidence/RG-02-scale.log`：3000 个同级元素从 6.0 秒降到 1.1 秒 |
| RG-03 | Low | 已落实 | `test/w2-render-audit-r7.test.js` | 补上 RG-01，以及审计方试过的「删掉可见的同身份元素」「同身份元素一部分在 iframe 里」的回归测试。第 8 轮更正：「在不同宽度下轮流可见」那一种当时没有补，理由写的是「夹具不容易写」，这个说法不对（AUDIT_RENDER_r8 RH-01：基础档在 390px 下就能报出 error）。第 9 轮已补，见 §16 | RV-20、RV-21 |
| RF-03 | Low | 已披露，不改（**审计方第 6 轮同意不改**） | 本报告 §5 第 18 条 | 第 6 轮审计方已裁定可以接受：只会重复，不会漏报 | — |

---

## 16. 审计响应矩阵（AUDIT_RENDER_r8，第 8 轮）

| 发现 | 严重度 | 状态 | 落在哪 | 怎么落的 | 测试 / 证据 |
|---|---|---|---|---|---|
| RH-01 | Low | 已落实 | `test/fixtures/w2-render-audit-r8/`、`test/w2-render-audit-r8.test.js` | 按审计方给出的写法补成回归夹具 `H-RH01-drawer-alt`：宽屏只显示页头导航，窄屏只显示抽屉导航（11px）。基础档在 390px 下报 3 条 T11 error（已核对）；完整档在 360px 实测，也报 3 条，整页 fail。这一行为在补测试之前就是对的，所以这条测试是回归守护，不是「整改前失败」的复现 | RV-21 |
| 达标条件第 1 条 | — | **等用户**（已于 2026-10-26 落实，见 §1、`1d227c1`） | `open_decisions.json` 的 R-D1、R-D2 | 用户书面答复后：把提案第 8 版写进 PRD 和附录 C23–C26，在干净工作树上重跑 `verify-w2-render` | — |
| 达标条件第 3 条 | — | 已落实 | §15 的 RF-03 一行 | 注明「审计方第 6 轮同意不改」 | — |

---

## 17. 审计响应矩阵（AUDIT_RENDER_final，终审）

| 发现 | 严重度 | 状态 | 落在哪 | 怎么落的 |
|---|---|---|---|---|
| FIN-01 | Low | 已落实 | `docs/PRD.md` §5.1 T05、§5.4「完整档的实现要点」第 3 条 | 注明完整档实测时全角标点也算一个字，口径见 C24。这是用户拍板 R-D1 时确认的内容，只补指向，不改语义 |
| FIN-02 | Low | 已落实 | `docs/PRD.md` §5.4 C24；`PRD_RENDER_PROPOSAL.md` 改动 2 | 「两种情况」改为「三种情况」，和下面列出的条目一致 |
| FIN-03 | Low | 已落实 | `docs/PRD.md` §7.3 `RuleMeta` | 补列 `implemented_w1: boolean`。实现从 W1 起就有这个字段，C26 的注释也提到它，只是接口里漏列。附录 C26 一行注明了这次补齐 |
| FIN-04 | Low | 已落实 | 本报告 §1 | 「这一条等用户」改为「已落实（用户 2026-10-26 拍板）」 |

以上 4 处都只改文档，不改代码。
