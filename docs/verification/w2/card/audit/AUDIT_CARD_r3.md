# 独立审计第 3 轮复核：W2 `card` 命令（AUDIT_CARD_r2 整改）

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」；执行：独立审计方（Claude Code，复核会话） |
| 复核对象 | 锁定提交 `0b89936`（夹具 `w2-card-audit-r2` 和扫描脚本）→ 整改 `d39b3cd`、`610ed1b`、`a2d2ed8` → 验证结果 `c47b261`。实质结论针对 `c47b261` 的代码 |
| 审计期间的提交 | `c5eccf8`：用户拍板 R-C2。只改了 `docs/PRD.md`、`open_decisions.json`、`PRD_CARD_PROPOSAL_R2.md` 三个文件，代码、测试、夹具都没有动（本轮看过 `git show --stat`） |
| 依据 | `AUDIT_RESPONSE_CARD.md` §6、`VERIFICATION_REPORT.md` §6、`audit/AUDIT_CARD_r2.md`、`results.json`、`evidence/` |
| 环境 | macOS（Darwin 25.6.0），Node v22，playwright-core 1.64.1，系统 Chrome。本轮运行期间负载均值 5.4–10.9（14 核），比第 2 轮（17–48）低得多 |

---

## 1. 结论

**实质结论（只看代码、测试、证据）：有条件达标。**

**机器判定：** 本轮在 `c5eccf8` 的干净工作树上重跑验证脚本，结果是「达标」，`verdict_blockers` 为空。仓库里提交的 `results.json` 还是 `a2d2ed8` 那次的「未达标」，已经过时，要按 §6 重跑一次。

### 1.1 实质结论

- **第 2 轮的 4 条发现和 §5.2 的条件：** 全部落实，代码与回应相符，详见 §3。
  - CB-01 的结构性修复在代码里：shot0 和 MutationObserver 提前到冻结动画之后、lint 测量之前，最后三张截图一致才算通过。
  - 我自己跑了一次执行方提交的扫描：31 个时间点全部是 incomplete，0 个 ✗。验证脚本里 CV-11 又扫了 3 次，93 个时间点 0 个 ✗。
- **第 1 轮 14 条：** 没有回退。CV-10 的 34 项全部 PASS；全量测试 310 项，失败 0。
- **锁定时序：**
  - `0b89936` 是 `d39b3cd` 的祖先；
  - `git diff 0b89936..HEAD -- test/` 是空的；
  - `w2-card-audit-r2` 的 MANIFEST 37 行全部 OK；
  - 锁定之后，`scripts/sweep-card-late-change.mjs` 只改了怎么解析仓库路径（`610ed1b`），扫描逻辑没动。
- **新发现：** Blocker 0、High 0、Medium 0、Low 3，其中 CC-01 待确认。
- **达标条件：**
  1. CC-01 到 CC-03 在审计响应矩阵里逐条回应：修掉，或者登记为已知问题。
  2. 第 2、3 两轮都没有做对抗复核。要不要把对抗复核作为终审的前提，由用户决定，见 §1.3。

### 1.2 R-C2（与实质结论分开）

- 审计期间用户已经拍板（`c5eccf8`）。`open_decisions.json` 记录的原话是：「R-C2 同意，查不到字体的内容判没检查完」。
- 这句原话是不是用户本人说的，审计方无法核实，**待用户确认**。
- 拍板之后的 PRD 有一处描述落后于实现，见 CC-03 第 1 点。

### 1.3 开放决策清单（需要用户拍板）

1. **终审前要不要再做一轮对抗复核？**
   - 第 2、3 轮都是非对抗复核。CB-01 就是第 2 轮读代码发现、执行方实测复现的。
   - CC-01 是同一类问题（读代码发现，没有验证），本轮也没有验证。
   - 这一项由用户决定，审计方不替用户默认。

---

## 2. 本轮范围与没做的事

**做了：**
- 读代码：
  - `card.ts` 的 `afterLoad`（第 300–321 行）和 `afterMeasure`（三张截图比对，第 374 行）；
  - `render.ts` 的 `MARK_ID` 导出（第 28 行）和 `caret` 改动（第 312 行）；
  - `probe.ts` 的 `markElement`；
  - `test/card-audit-r2.test.js`；
  - `w2-card-audit-r2` 的 `expect.json`，以及各夹具和 `D00-control.html` 的 diff；
  - `scripts/stress-card.sh`、`scripts/sweep-card-late-change.mjs`、`scripts/verify-w2-card.mjs` 的改动；
  - `package.json`。
- 跑了：
  - `npm run build && npm test`；
  - 执行方提交的扫描 `node scripts/sweep-card-late-change.mjs . 50 80 1`；
  - `node scripts/verify-w2-card.mjs`，跑完已恢复；
  - 锁定时序和 MANIFEST 核对。
- 核对了 Playwright 在进程退出时清理浏览器的代码：`node_modules/playwright-core/lib/coreBundle.js`。

**没做：**
- **本轮没有做新的对抗测试**：没有编写新的攻击页面，也没有尝试新的绕过手法。
  - 唯一跑过的复现脚本是执行方提交的 `sweep-card-late-change.mjs`。
  - CC-01 只是读代码得出的观察，没有写页面验证。
- 没有跑 `scripts/stress-card.sh`：它要在高负载下跑多次全量测试，只读了源码。
- 没有构造「关闭本身卡死」的页面。§5.2 的裁定依据是证据文件，加上 Playwright 源码。

---

## 3. 逐条复核（第 2 轮的 CB-01 至 CB-04、§5.2 条件）

| 编号 | 第 2 轮严重度 | 回应 | 复核状态 | 代码核对 | 夹具与证据 |
|---|---|---|---|---|---|
| CB-01 | Medium（执行方已复现） | 已落实（夹具口径有调整） | **已落实**；夹具口径有条件接受（§5.1）；残余问题见 CC-01、CC-02 | ① `card.ts:300-321` 的 `afterLoad`：冻结动画、等字体就绪之后，装 MutationObserver，截 shot0（`:320`）。按 `render.ts:488-491` 的调用顺序，这一步在 DOM 快照和 `measurePage` 之前。② `:374` 要求 shot0、shot1、shot2 哈希一致，变化数为 0，没有新动画，否则判 incomplete。③ observer 不计红框：目标是 `MARK_ID` 元素的变化，以及增删的节点全是 `MARK_ID` 的 childList 变化（`:308`）。④ `render.ts:312` 在 card 模式下用 `caret: "initial"`，避免 Playwright 往页面里插 `<style>`；`FREEZE_CSS` 已经把光标设成透明 | 整改前扫描 3 次共 14 个 ✗（`CB-01-sweep-before-fix.log`）；整改后 3 次 0 个 ✗（`CB-01-sweep-after-fix.log`）。**本轮自己跑 1 次：31 个时间点全部 incomplete，0 个 ✗；验证脚本的 CV-11 扫 3 次，93 个时间点全部 incomplete，0 个 ✗。** 锁定的 25 个 D-late 夹具在整改前 33/33 通过（`card-audit-r2-tests-before-fix.log`），对这个问题没有区分能力，见 §5.1、CC-02 |
| CB-02 | Low | 已落实 | **已落实** | 代码没变：`OPAQUE` 含 EMBED；CSS 引用的 SVG 走 `Network.responseReceived` | D10 embed → incomplete，原因含「embed」；D11 背景图（文件）、D12 背景图（data:）、D13 mask-image、D14 content: url()、D15 内联 SVG 的 `<image>` → incomplete，原因含「SVG」；D16 不含文字的 SVG 背景 → exported（对照）。覆盖了第 2 轮列出的全部载体。夹具写于实现之后，执行方已如实注明。CV-10 的描述已改为「含文字的 SVG 图片（img、object）」 |
| CB-03 | Low | 已落实 | **已落实** | `package.json`：`node --test --test-concurrency=4 …`；`verify-w2-card.mjs` 的 CV-09 改成 `["uptime", "npm test", "uptime"]`；`scripts/stress-card.sh` 把每次全量测试的完整输出写进 `stress-<i>.log`，汇总里用 grep 只是为了提取摘要，完整日志保留；脚本里没有重试逻辑，注释写明「不自动重试」 | 提交版 CV-09 日志开头有 `10:14 … load averages: 6.80 7.68 10.68`；本轮重跑的 CV-09 日志前后都有 uptime（`5.40 7.40 9.55` → `8.37 8.87 9.91`）。本轮全量测试 310/310，第 2 轮失败过的 G-RG01-cap 这次用了 2363 ms |
| CB-04 | Low | 已落实 | **已落实** | `grep -n "SVG_TEXT\b" card.ts` 没有匹配（退出码 1）；报告 K-01 改成「审计方已同意」；K-04 改成「已修（CA-12）」并附证据；§4 第 7 条写明检测窗口从去掉动画之后开始、到导出截图之后结束 | `VERIFICATION_REPORT.md` 第 45、47、71 行。第 7 条关于 shadow DOM 的说法还有一处不准确，见 CC-01 |
| §5.2 条件 | — | 部分落实 | **接受**，理由见 §5.3 | `evidence/CA-12-no-orphan.log`：卡死页面跑 3 次，退出后浏览器进程数都是 0；运行中的对照能数到 7 个，说明计数方法有效 | 本轮补充核对了 Playwright 源码：进程退出时，会对它启动的浏览器进程组发 SIGKILL |

第 1 轮 CA-01 到 CA-14：本轮没有发现回退。CV-10 34/34 PASS；CV-08 的真实字体样张逐字节不变（重跑之后 `evidence/real-font/` 没有 diff）。

---

## 4. 新发现

### CC-01 · Low（待确认）· 变化检测有两个盲区：页面能用的固定 id，和 shadow DOM 内部；先改后改回的临时变化，截图比对抓不到

- **位置：**
  - `card.ts:308`：`const ours = (n) => n && n.nodeType === 1 && n.id === mark;`；
  - `card.ts` 的 `afterLoad`：observer 只挂在 `document` 上；
  - `VERIFICATION_REPORT.md` §4 第 7 条。
- **问题：**
  1. 红框是靠 id 排除的，`MARK_ID = "__measure-cjk-mark"`，这是固定字符串（`render.ts:28`）。页面自己的元素如果用了同一个 id，它自身的属性变化、它下面的增删节点都不计入变化数。
  2. MutationObserver 不进 shadow root，报告也写了这一点。报告说 shadow DOM 里的变化「只能靠截图比对发现」，但截图只在 shot0、shot1、shot2 三个时间点拍。如果页面在 lint 测量期间改了、又在 shot1 之前改回去，三张截图仍然一致，lint 认证的却是那个临时状态，不是导出的画面。
  - 这和 CB-01 是同一类问题，只是窗口更窄，要构造两次定时变化。
- **为什么是 Low、而且待确认：**
  - 代码事实是确定的：靠 id 排除、observer 不进 shadow root。
  - 能不能利用，本轮按范围没有写页面验证。
  - 利用条件比 CB-01 苛刻：要「改」和「改回」两次都落在测量窗口里。
  - 如果下一轮对抗复核证实能稳定复现，升为 Medium。
- **修法（任选其一，并补夹具）：**
  1. 按对象身份排除红框，不按 id 排除。`markElement` 和 observer 运行在同一个隔离环境里，`markElement` 创建节点时，放进隔离环境里的 `WeakSet`，observer 只排除这个集合里的节点。页面看不到隔离环境，冒充不了。
  2. 改用 CDP 的 DOM 事件记变化（`DOM.childNodeInserted`、`attributeModified`、`characterDataModified` 等，配合 `pierce`），这样能覆盖 shadow DOM。
  3. 至少把报告 §4 第 7 条改准确：shadow DOM 里「先改后改回」的变化，截图比对发现不了。

### CC-02 · Low · CB-01 的回归保护靠时机，扫描门槛没有证明自己覆盖了漏洞窗口

- **位置：** `scripts/verify-w2-card.mjs` 的 CV-11 判定；`scripts/sweep-card-late-change.mjs`；`test/fixtures/w2-card-audit-r2/D-late-*.html`。
- **问题：**
  - 锁定的 25 个延时夹具，整改前全部通过（`card-audit-r2-tests-before-fix.log`，33/33）。它们对 CB-01 没有区分能力，执行方也如实说明了。
  - 真正的门槛是 CV-11：固定扫 50–80 ms，判定条件只是「没有 ✗」。
  - 漏洞窗口在流程里的位置会随负载移动。整改前的 3 次扫描里，命中点分布在 56–80 ms，而且每次都不一样。
  - 本轮 4 次扫描（124 个时间点）全部是 incomplete，一个 rejected 和一个 exported 都没有。这说明这次的 50–80 ms 整段落在 shot0 之后、shot2 之前，扫描没有跨到窗口的两端。
  - 如果负载让窗口移出 50–80 ms，回归之后扫描照样是 0 个 ✗，CV-11 照样 PASS。
- **为什么是问题：** 门槛有可能在没有测到东西的情况下给出 PASS，这是伪通过风险。目前结构性修复是有效的（代码核对过），所以定为 Low。
- **修法：**
  1. 扫描范围改成自适应，例如 0–400 ms、步长 2 ms。
  2. CV-11 加一条判定：扫描结果里必须**同时出现** rejected（变化落在测量之前）和 exported（变化落在导出截图之后），才能证明扫描跨过了整个检测窗口。否则判 FAIL 或 BLOCKED_ENV，不能判 PASS。
  3. 不要为了测试在产品代码里加环境变量形式的挂钩，以免形成门禁旁路。

### CC-03 · Low · PRD 描述落后于实现；整改前扫描日志里的命令行不准确

- **位置和问题：**
  1. `docs/PRD.md:297`（`c5eccf8` 写入）：「截图前后各截一次，画面不同、DOM 有变化或者又启动了动画，判为没检查完。」
     - 这是 CB-01 整改之前的两张截图口径。
     - 现在的实现是从冻结动画之后就开始检测，三张截图（测量前、查字体前、查字体后）都要一致。
     - 实现比 PRD 更严，不矛盾，但 PRD 没有写出检测窗口。原因是 R-C2 的提案写于 CB-01 整改之前。
  2. `evidence/CB-01-sweep-before-fix.log` 第 1 行写的命令是 `node scripts/sweep-card-late-change.mjs . 50 80 1`。但 `610ed1b` 的提交信息写明，修正之前传 `.` 会被当成包名，CV-11 因此 FAIL。也就是说，整改前的扫描不可能按日志里写的这条命令跑出来，实际用的应该是绝对路径。
- **为什么是问题：** 证据要能照着复现，PRD 要和实现一致（CA-08 的精神）。
- **修法：**
  1. PRD 第 297 行的检测窗口写法：执行方写一份小提案，按 D-C7 交用户确认，不要直接改 PRD。
  2. 在 `CB-01-sweep-before-fix.log` 的说明里注明实际用的命令。日志正文不改，另加一行勘误即可。

---

## 5. 裁定

### 5.1 CB-01 的夹具口径：允许「拒绝、没检查完、导出且 PNG 和对照组逐字节相同」三种结果

**有条件接受。**

- 三种结果的语义都对：
  - 变化落在 lint 测量之前：lint 看到的就是改过的画面，有 error 就拒绝；
  - 变化落在测量和导出截图之间：判没检查完；
  - 变化落在截图之后：导出的 PNG 就是 lint 检查过的画面。
- 第三种情况下，「和对照组逐字节相同」足以证明 PNG 上没有那段 10px 的字（测试第 47–51 行），不构成伪成功。
- 但这批夹具在整改前全部通过，不能当成回归证据。可靠的门槛只有 CV-11，加上代码结构本身（shot0 提前）。
- **条件：** CV-11 按 CC-02 改成必须证明扫描跨过了整个窗口。

### 5.2 CB-03：`npm test` 并发限制为 4，不自动重试

**接受。**

- `package.json`、CV-09 日志里的 uptime、`stress-card.sh` 保留完整输出且不重试，三点都核对过。
- 负载很高时，回归门可能因为单页超过 15 秒预算而失败。这时如实记为失败、不重试，是正确的做法，不算缺陷。
- 本轮在负载 5–11 下，全量测试 310/310 通过两次：一次单独跑，一次在 CV-09 里跑。

### 5.3 §5.2 的条件：没有残留的浏览器进程；关闭本身卡到 5 秒上限的情况没有覆盖到

**接受（Low 残余，保留报告 §4 第 8 条的披露）。**

- 证据文件显示，3 次卡死页面运行之后，残留进程都是 0；运行中能数到 7 个，说明计数方法有效。
- 没覆盖到的情况，本轮从 Playwright 源码补了依据。`node_modules/playwright-core/lib/coreBundle.js` 里：
  - 第 10081 行：`addProcessHandlerIfNeeded("exit")`；
  - 第 9982–9985 行：`exitHandler` 对 `killSet` 里每个进程调用 `kill()`；
  - 第 10115 行：`process.kill(-spawnedProcess.pid, "SIGKILL")`，在非 Windows 系统上杀整个进程组。
- 所以命令行用法下，即使关闭卡死，Node 进程退出时浏览器也会被强杀。
- **剩下的风险只在库用法：** `runCard` 在长期运行的宿主进程里被调用时，关闭卡死之后，浏览器会一直留到宿主退出。请在报告 §4 第 8 条补上这一句。

### 5.4 K-07

**维持第 2 轮的裁定：接受为「已知、没能复现」。**

- 压力测试脚本已经放进仓库，保留了完整输出。
- 本轮负载较低，两次全量测试都没有失败，没有新的信息。

---

## 6. 证据三件套是否互相印证

| 核对项 | 结果 |
|---|---|
| 提交版 `results.json`（`c47b261`） | `git_head a2d2ed8`、`dirty false`、`verdict 未达标`，blocker 只有 R-C2。和当时的状态一致 |
| `c5eccf8` 之后 | 提交版 `results.json` **已经过时**：R-C2 已拍板，但 `results.json` 没有重跑。本轮在 `c5eccf8` 的干净工作树上重跑：CV-01 到 CV-11 全部 PASS；CV-06 是 6 份 MANIFEST；CV-09 是 310 项、失败 0；伪成功扫描：未发现；`verdict_blockers: []`；`verdict: 达标`。已恢复，没有提交。执行方或协调方要重跑并提交 |
| 本轮重跑的 diff | 16 个文件。除了 `results.json` 的 `git_head`、`verdict_blockers`、`verdict` 之外，只有时间戳、耗时和扫描各点的具体结果在变。`evidence/real-font/` 没有 diff，样张逐字节可以复现 |
| 矩阵 §6 与 evidence | CB-01 → 整改前、整改后的扫描日志，加上 CV-11，一致（命令行的出入见 CC-03）；CB-03 → CV-09 日志里有 uptime、`stress-card.sh`，一致；§5.2 → `CA-12-no-orphan.log`，一致 |
| 报告 §6 的 4 项 | 本文 §5.1 到 §5.4 逐项裁定 |
| 验证脚本的副作用 | 会重新生成仓库外的 `../deliverables/card-samples/`，哈希不变 |

---

## 7. 审计方亲自跑过的命令和关键输出

1. 锁定时序和完整性：

   ```
   $ git log --format='%h %ad %s' --date=iso
   c47b261 10:17:03  a2d2ed8 10:12:01  610ed1b 10:07:01  d39b3cd 10:03:11  0b89936 09:53:52
   $ git merge-base --is-ancestor 0b89936 d39b3cd        → 0
   $ git diff 0b89936..HEAD -- test/ | wc -l              → 0
   $ git diff --stat 7c2780a..0b89936 -- packages/ scripts/ package.json
    scripts/sweep-card-late-change.mjs | 28 +++   （锁定提交没有改实现）
   $ git diff 0b89936 HEAD -- scripts/sweep-card-late-change.mjs
    只改了 import 的路径解析（resolve + pathToFileURL），扫描逻辑没动
   $ cd test/fixtures/w2-card-audit-r2 && shasum -a 256 -c MANIFEST.sha256   → 37 行 OK，exit=0
   $ cd test/fixtures/w2-card-audit && shasum -a 256 -c MANIFEST.sha256      → exit=0
   $ git show --stat c5eccf8  → docs/PRD.md、PRD_CARD_PROPOSAL_R2.md、open_decisions.json（3 个文件）
   ```

2. 构建和全量测试（`c47b261` 的代码）：

   ```
   $ npm run build && npm test
   BUILD_EXIT=0
   ✔ AUDIT_CARD_r2 夹具 …（33 项）
   ✔ 第 7 轮复核夹具 G-RG01-cap：整页 fail (2363.2ms)
   ℹ tests 310
   ℹ pass 310
   ℹ fail 0
   ℹ duration_ms 116142.4
   TEST_EXIT=0
   uptime：开始 7.01 8.41 10.55 → 结束 9.41 9.84 10.90
   ```

3. 执行方提交的扫描（不是新的对抗测试）：

   ```
   $ node scripts/sweep-card-late-change.mjs . 50 80 1
   50ms:incomplete 51ms:incomplete … 80ms:incomplete
   SWEEP_EXIT=0；✗ 0 个；rejected 0、incomplete 31、exported 0
   ```

4. 验证脚本（`c5eccf8`，工作树干净）：

   ```
   $ node scripts/verify-w2-card.mjs
   PASS CV-01 … PASS CV-06（6 份 MANIFEST）… PASS CV-08 … PASS CV-10 … 
   PASS CV-11 —— ℹ pass 33，ℹ fail 0；扫描 3 次共 0 个 ✗（93 个点全是 incomplete）
   PASS CV-09 回归门 —— 测试 310 项，失败 0 项（uptime 5.40 7.40 9.55 → 8.37 8.87 9.91）
   任务门 PASS｜回归门 PASS｜伪成功扫描 未发现｜结论：达标
   VERIFY_EXIT=0
   results.json: "git_head": "c5eccf8…", "dirty": false, "verdict_blockers": [], "verdict": "达标"
   $ git diff --stat → 16 files changed（evidence/CV-01–CV-11、CV-08-*.json、results.json）
   $ git checkout -- docs/verification/w2/card && git clean -fd docs/verification/w2/card/evidence
   $ git status --porcelain →（空）
   ```

5. CB-04 和 Playwright 源码：

   ```
   $ grep -n "SVG_TEXT\b" packages/cli/src/card.ts   → 没有匹配（exit 1）
   coreBundle.js:10081  addProcessHandlerIfNeeded("exit");
   coreBundle.js:9982   function exitHandler() { for (const kill of killSet) kill(); }
   coreBundle.js:10115  process.kill(-spawnedProcess.pid, "SIGKILL");
   ```

临时文件都放在 `/tmp/cardr3/`，用完已经删除。仓库里只新增了本文件。

---

## 8. 给执行方的下一轮要求

1. **CC-01：** 改成按对象身份排除红框，或者改用 CDP 的 DOM 事件记变化，并补夹具；至少把报告 §4 第 7 条改准确。
2. **CC-02：** CV-11 要求扫描结果里同时出现 rejected 和 exported，扫描范围改成自适应。
3. **CC-03：**
   - PRD 第 297 行的检测窗口：写小提案，交用户确认；
   - 给 `CB-01-sweep-before-fix.log` 加一行勘误，注明实际用的命令。
4. **§5.3：** 在报告 §4 第 8 条补上库用法下的残留风险。
5. **重跑：** 本文提交之后，在干净工作树上重跑 `verify-w2-card.mjs`，提交新的 `results.json`。
6. **用户：** 拍板 §1.3 的开放决策（终审前要不要再做对抗复核）。
