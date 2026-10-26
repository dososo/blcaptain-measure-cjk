# 分寸 · Measure（measure-cjk）W2 · `card` 命令（小红书卡片导出）验证报告

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」：按独立审计 AUDIT_CARD 整改完毕，送审计方复核 |
| 执行方 | Claude Code（用户指示全部由 Claude Code 闭环） |
| 提交 | 方案 `e72a058` → 用户拍板 D-C1–D-C7 → 夹具和测试锁定 `bb045d8` → 实现 `00f0f16` → 用户确认 R-C1、PRD 写入 C27–C29 `4086c00` → 独立审计 AUDIT_CARD 判未达标 → 复现夹具锁定 `bef874a` → 整改 `fe5d794` |
| 机器判定 | `docs/verification/w2/card/results.json`（`node scripts/verify-w2-card.mjs`，在干净工作树上运行） |
| 方案和拍板 | `CARD_PLAN.md`；`open_decisions.json`（D-C1–D-C7、R-C1 已拍板，附用户原话） |
| PRD 变更 | `PRD_CARD_PROPOSAL.md`，用户 2026-10-26 确认（R-C1），已写进 PRD 附录 C27–C29；整改带来的第二份 `PRD_CARD_PROPOSAL_R2.md`，**待用户确认（R-C2）** |
| 审计 | `audit/AUDIT_CARD.md`（14 条）；响应矩阵 `AUDIT_RESPONSE_CARD.md` |

---

## 1. 结论

**机器判定（`results.json`，HEAD `c140d9b`，工作树干净）：达标。** CV-01 至 CV-11 全部 PASS（CV-10、CV-11 是三轮审计的回归，CV-11 的两次自适应扫描都扫到了窗口两端、0 个 ✗），回归门 313 项、失败 0；D-C1 至 D-C7、R-C1 至 R-C3 都已由用户拍板。

**审计口径的说明：** 第 1 轮是对抗审计（未达标，已整改）；第 2、3 轮是非对抗复核，实质结论都是「有条件达标」，条件已逐条落实（响应矩阵 §6、§7），但没有再请审计方复核第 3 轮的整改。用户决定终审前不再做对抗复核（原话：「我认为按这个顺序，主题做6个」，回复的顺序第 1 步是「R-C3 同意，card 收尾」）。所以这个「达标」是机器判定加上非对抗复核，没有经过第 2 次对抗审计。

- 上一版报告（`4086c00`）在机器判定之前就把结论写成了「达标」，而且验证脚本测不到审计发现的绕过路径（AUDIT_CARD CA-08）。本版先跑验证脚本，再照录 `results.json`。
- 三轮整改见 `AUDIT_RESPONSE_CARD.md`：第 1 轮 14 条（§1–§5），第 2 轮 CB-01 至 CB-04 和 §5.2 的条件（§6），第 3 轮 CC-01 至 CC-03（§7）；和审计修法有出入的地方都写明了原因。
- AC-9：3 种模板和 `examples/card.html` 用真实霞鹜文楷导出 1080×1440 的 PNG，只用到这一款字体，lint 零 error（CV-08）。

## 2. 断言逐条

各条的状态和说明以 `results.json` 为准，真实输出在 `evidence/CV-*.log`。

| 编号 | 内容 |
|---|---|
| CV-01 | 字体文件解析：TTF、OTF、TTC、WOFF、WOFF2 都能读出名称；截断、乱码、空文件返回 error，不抛异常 |
| CV-02 | F06 判定，8 个锁定的夹具：🟢 和 🔵 放行；🔴、放进 `font_dir` 的微软雅黑、查不到的字体都拒绝；缺字回退到不能出图的系统字体时拒绝；页面自带的字体文件被拦截；有 lint error 时不出图 |
| CV-03 | 3 种模板和示例卡片：导出 1080×1440，lint 零 error（方框字体）；不用紫渐变、不用玻璃拟态 |
| CV-04 | 命令行退出码和结果 JSON、WOFF2 注入、安全校验（`font_dir` 在工作区外或是符号链接、`--out` 不是 .png、已有的非 PNG 文件、工作区外的路径）、64 MB 和 50 个的上限、没装 Playwright 时退出码 2 |
| CV-05 | Node 一侧零网络请求 |
| CV-06 | 夹具锁定，MANIFEST 校验 |
| CV-07 | 仓库里没有字体文件；skill 格式和授权表校验 |
| CV-08 | **AC-9 真实字体验收**：霞鹜文楷 v1.530（SHA-256 `2d73eea9…`，从官方 GitHub 下载，放在仓库外）导出 4 张卡片，全部导出，用到的字体只有霞鹜文楷，lint 零 error。样张由验证脚本复制进 `evidence/real-font/`，哈希在 `evidence/real-font/SHA256SUMS`，每张的结果 JSON 在 `evidence/CV-08-*.json` |
| CV-10 | **AUDIT_CARD 回归**：`test/card-audit.test.js`，30 个锁定夹具（C00–C29）和 4 项测试（安全检查逐条断言原因、`--evidence`、配置里的 font_dir、解压炸弹）。整改前 34 项里 30 项失败（`evidence/card-audit-tests-before-fix.log`） |
| CV-11 | **AUDIT_CARD_r2、r3 回归**：`test/card-audit-r2.test.js`（33 个锁定夹具：CB-01 延时改页面 25 个，必须拒绝、判没检查完，或者导出的 PNG 和对照组逐字节相同；CB-02 的 embed、CSS 背景、mask、`content: url()`、内联 SVG 的 `<image>`，以及不含文字的 SVG 背景对照）、`test/card-audit-r3.test.js`（CC-01 的 3 个夹具：shadow DOM、样式表、冒用红框 id 的持续改动），加上 `scripts/sweep-card-late-change.mjs --adaptive` 自适应扫描 2 次，每次都必须扫到窗口两端（同时出现拒绝和导出）且 0 个 ✗ |
| CV-09 | 回归门：全量测试，失败 0。`npm test` 限制为 4 个测试文件并发（CB-03），日志记下运行前后的 uptime |

### 2.1 实现过程中的问题

| 编号 | 问题 | 处理 |
|---|---|---|
| K-01 | 锁定的测试辅助代码（方框字体生成器）有 bug：字符里含空格时，cmap 出现重复的段，Chrome 的字体清洗器 OTS 拒绝加载字体，应当导出的卡片因此回退到苹方、被拒绝 | 生成器改为补空格之后再去重，测试断言一个字都没改。登记为 RULING-08，**审计方已同意**（AUDIT_CARD §3 第 1 条）。复现记录见 RULINGS.md |
| K-02 | 模板最初用 CSS 计数器生成清单序号。生成出来的数字不在源码文字里，测试用的方框字体没覆盖到，回退到了 Times | 改成把序号直接写进 HTML。真实字体本来就有这些数字，但这样写更稳，也写进了 `xhs-card.md` 的说明 |
| K-04 | 第一次运行验证脚本时，完整档「单页超时」测试（死循环页面，预算 3 秒）总共用了 33 秒，超过测试要求的 30 秒（`evidence/CV-09-first-run-flaky.log`） | **已修（AUDIT_CARD CA-12）。** 成因是关闭卡死的页面没有时间上限；现在关闭页面和浏览器都设 5 秒上限。高负载下 6 次全量测试，这项测试最长 9.1 秒（`evidence/CA-12-stress.log`）；卡死页面超时后没有残留的浏览器进程（`evidence/CA-12-no-orphan.log`） |
| K-05 | 独立审计 AUDIT_CARD 判未达标：Blocker 1（伪元素、表单控件、shadow DOM 等里的字没查）、High 5（动画快进、按文件名放行、data:/blob: 字体、两次渲染、点名的 🔴 字体） | 先锁定 30 个复现夹具，再整改，见 `AUDIT_RESPONSE_CARD.md` |
| K-06 | 锁定的 CA-11 测试漏写配置文件的 `schema_version` | 只补 `schema_version`，登记 RULING-09，待审计方裁定 |
| K-07 | **一次没能复现的失败。** CA-12 压力测试第一组第 3 次全量测试里，完整档的「第 3 轮复核夹具 C-RC01-responsive」失败，只用了 23 ms，还没启动浏览器就失败了。那组脚本过滤了输出，失败原因没有保留 | 之后单独跑 6 次、带同样负载的全量测试 3 次（保留完整日志）、16 个进程同时跑这个测试文件，全部通过；磁盘空间、文件句柄上限正常（`evidence/CA-12-stress.log`）。没有凭猜测改代码，请审计方判断 |
| K-08 | 第 2 轮非对抗复核（AUDIT_CARD_r2）实质结论「有条件达标」，提出 CB-01（Medium）、CB-02 至 CB-04（Low）。CB-01 实测可以复现：整改前，页面在加载后约 56–80 ms 改字号时，扫描 3 次共 14 个时间点导出了 lint 没检查过的画面 | 先锁定夹具和扫描脚本（`0b89936`），再整改。整改后扫描 3 次共 93 个时间点，0 个 ✗（`evidence/CB-01-sweep-after-fix.log`）。锁定的夹具测试在整改前恰好全部通过（命中与否取决于时机），所以验证脚本新增 CV-11，把扫描作为门槛 |
| K-09 | 第 3 轮非对抗复核（AUDIT_CARD_r3）实质结论「有条件达标」，提出 CC-01 至 CC-03（都是 Low） | CC-01：先锁 3 个夹具（`2bc8f3b`，整改前全部被导出），再整改。CC-02：扫描改成自适应，在 CB-01 修复前的代码上报 2 个 ✗、以失败退出，在当前代码上 0 个 ✗（`evidence/CC-02-adaptive-sweep.log`）。CC-03：PRD 的口径写成提案 R-C3，待用户确认 |
| K-03 | 引语卡第一版字号 52px，一行 16 个字，第一行在「本」和「身」之间断开，把「本身」拆成了两行 | 改成 46px，第一行在「本身，」后面断开。用真实字体看过样张 |

## 3. 依赖与 license

- 没有新增依赖。字体解析只用 Node 自带的 `zlib`（inflate、brotli）。
- 霞鹜文楷 v1.530：OFL-1.1（GitHub API 核对，2026-10-26）。只用于本机验收，不进仓库、不分发。样张 PNG 是用它渲染出的图片，OFL 允许。
- 外部事实的来源（2026-10-26 读取）：
  - Chrome 开发者协议 `pdl/domains/CSS.pdl`（`getPlatformFontsForNode`）；
  - W3C WOFF2 规范；
  - Microsoft OpenType 规范的 name 章节。

## 4. 已知局限

1. **`CSS.getPlatformFontsForNode` 所在的 CSS 域标为 experimental**，Chrome 升级后可能变动。只在系统 Chrome 155 上测过。
2. **结果依赖本机字体环境。** 回退到哪款系统字体由操作系统决定。本机（macOS）回退到苹方，按不允许出图处理；在装了 Noto CJK 的 Linux 上，同一张卡片的结论可能不同。审计 §3 第 3 条要求写进 PRD，已放进 R-C2 提案。
3. **按字体文件里的名字查授权表。** 如果字体文件内部的名字被改过，结论也会跟着错。授权表不是法律意见。
4. **TTC 字体集合只注入第一款**：浏览器只加载集合里的第一款，其余几款列为不放行，并提示拆成单独的文件。
5. **查不到字体的内容判为没检查完**：canvas、iframe、frame、object、embed、video、含文字或读不到内容的 SVG 图片。卡片要写成静态页面（`xhs-card.md` 已写明）。
6. **动画会被去掉**：导出的是去掉动画和过渡之后的样式，不是动画的最后一帧。
7. **变化检测的范围**：从去掉动画之后开始，到导出截图之后结束，覆盖 lint 测量、查字体、截图的全过程（AUDIT_CARD_r2 CB-01）。手段有三类：① 三张截图比对（测量前、查字体前、查字体后）；② DOM 变化两路记录——隔离环境的 MutationObserver（完整档的红框按对象身份排除）和 CDP 的 DOM 事件（覆盖 shadow DOM，包括 closed 的），再加上 CDP 的样式表事件（CSSOM 改样式表）（AUDIT_CARD_r3 CC-01）；③ 动画计数。导出截图之后发生的变化不影响导出的 PNG。
8. **关闭卡死的页面只设了上限，没有强杀浏览器进程**（AUDIT_RESPONSE_CARD §2.2）。命令行用法下，Node 进程退出时 Playwright 会对它启动的浏览器进程组发 SIGKILL（第 3 轮复核核对过 Playwright 源码），卡死页面跑完后实测没有残留（`evidence/CA-12-no-orphan.log`）。**剩下的风险在库用法**：在长期运行的宿主进程里调用 `runCard`，如果关闭本身卡住超过 5 秒，浏览器进程会留到宿主进程退出为止。
9. **没有检查内容是否超出 1440 高度。** 模板写死了 `overflow: hidden`，超出的部分会被裁掉，不会报错。

## 5. 伪成功扫描

关键字扫描（`evidence/pseudo-success-scan.log`）只能发现写法上的问题，例如跳过的测试、恒真断言、mock 掉 `runCard`。上一版报告写「未发现」，但审计用 30 个对抗页面找到了 14 处行为层面的伪成功（CA-01 至 CA-06），关键字扫描不可能发现这类问题。

行为层面现在靠锁定夹具防守：
- 每个没导出的夹具都断言 PNG **不存在**，并且 `problems` 写明原因；
- 动画夹具断言导出的 PNG 和对照组**逐字节相同**；
- 「安全」测试逐条断言原因，变异测试证明 5 项检查都测得到（`evidence/CA-07-mutation.log`）；
- 修复前的失败日志：`evidence/card-audit-tests-before-fix.log`（34 项里 30 项失败）。

## 6. 需要审计方裁定的问题

1. **CC-01 的修法**：红框按对象身份排除；DOM 变化另用 CDP 的 DOM 事件和样式表事件计数。CDP 那一路按 id 排除红框（页面冒用这个 id 骗得过这一路，骗不过 MutationObserver 那一路，夹具 E03 验证过）。
2. **CC-02 的门槛**：自适应扫描 2 次，每次要求扫到窗口两端且 0 个 ✗。在 CB-01 修复前的代码上，这道门槛会失败。
3. **R-C3**：PRD 的口径修订等用户确认，拍板前机器判定是「未达标」。

## 7. 下一轮建议

1. 用户拍板 R-C3 之后，把 `PRD_CARD_PROPOSAL_R3.md` 写进 PRD 附录 C33，再重跑 `verify-w2-card.mjs`。
2. 终审前要不要再做一轮对抗复核，由用户决定（AUDIT_CARD_r3 §1.3）。
3. W2 其余项：北极星实验、静态 A 系列规则、6 个主题、10 组前后对比图、展示页。
