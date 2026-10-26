# 分寸 · Measure · W2 中期复核（第 2 轮）：整改与对照组 v2

- **当前步骤**：W2 第 7 步「审计验收」，复核整改结果，由 Claude Code 作为独立审计方执行。
- **审计日期**：2026-10-25（22:05–22:25 CST）。
- **审计对象**：HEAD `a3ef88e`。涉及的提交依次是：
  - `6d1d24d`：整改前锁定；
  - `a7c5b11`：整改；
  - `0a48fbf`、`2fc94ab`：PRD 中的 W2-01 / C22；
  - `a3ef88e`：对照组 v2。
- **审计依据**：
  - `REPORT_C20_ISOLATED.md` 第 4、5 节；
  - `PRD_W2-01_PROPOSAL.md`；
  - `docs/PRD.md`；
  - `test/w2-review.test.js`；
  - `bench/run-baseline.mjs`；
  - `bench/runs/2026-W2-baseline-isolated-v2-*`；
  - 协调方转述的两条用户原话。
- **审计方式**：只读。
  - 没有运行 verify、package、run-baseline，没有联网，没有提交。
  - 「整改前」的测试取证方法：用 `git archive 6d1d24d` 导出到 scratchpad，单独编译后运行。
  - 为核对 CLI 参数，本机运行了 `claude --help` 和 `codex exec --help`。这两条命令都只读帮助文本。
  - 为核对 codex 的配置白名单，只读取了用户 `config.toml` 的**键名和节名**，没有读取任何值。

---

## 1. 结论

**有条件达标。**

一句话理由：
- 上一轮的 W2-01、W2-02、W2-03、W2-06 已经落实；W2-04、W2-05 只做了一部分，剩下的都是文档上的小问题。
- PRD 的改动和提案逐字一致，没有夹带提案以外的内容。W2-03 的测试在整改前确实失败。
- 对照组 v2 我做了三项核对：隔离是否干净，数据能否复算，CLI 参数是否和 `--help` 的说明一致。三项都通过。
- 还剩两条 Medium，都要改文档或实验方案，不需要改代码：
  1. 北极星实验的新方案里，claude 实验组按现在的权限**跑不了 `measure-cjk lint`**，也读不到 references 里的文件。这样两组之间的差别就不只是「有没有 measure 的内容」。
  2. 三组对比的解读第 1 点做了因果归因，但每条提示词只跑了一次，撑不起这个归因。另外有两个配置节没有对齐，报告里也没有说明。

**用户原话核对**：
- 第 1 条原话（C20、C21）在提案、PRD 附录 C20、commit 信息中出现，逐字一致。
- 第 2 条原话（W2-01）在 `PRD_W2-01_PROPOSAL.md` 第 3 行和 PRD 附录 C22 中出现，逐字一致。
- 局限：我看不到对话本身，原话的真实性需要用户本人确认。

**更正审计方自己的数字**：上一轮报告 W2-02 写的平均用时「91 秒对 174 秒」是错的。我当时 grep `用时` 时，把生成内容里出现的「用时」也算了进去。按 `summary.json` 的 `rows[].seconds` 重新计算，应为 **106 秒对 244 秒**，执行方报告里的表格是对的。方向（隔离组更慢）没有变。

---

## 2. 发现清单

统计：Blocker 0 条，High 0 条，Medium 2 条，Low 6 条。编号从 R2-01 开始。

### Medium

**R2-01　北极星实验的新方案，两组之间的差别不止 measure 一个变量**

- **位置**：`REPORT_C20_ISOLATED.md` 第 4 节第 5 条、第 5 节第 5 条。
- **问题**：
  1. **claude 实验组跑不了 lint。** `claude -p … --permission-mode acceptEdits` 只会自动批准文件编辑，不会批准 Bash。SKILL.md 的核心是第 7、8 步：运行 `measure-cjk lint`，再按结果逐条修复。实验组做不了这两步，测到的只是「把规则读一遍」的效果，会低估 skill 的作用。
  2. **claude 实验组读不到参考文件。** SKILL.md 会引用 `references/*.md` 和 `assets/measure.css`。只用 `--append-system-prompt-file` 注入 SKILL.md，agent 拿不到这些文件。报告说会「注入 SKILL.md 和参考文件」，但 `measure.css` 是一个需要复制进项目的文件，不能只作为提示词给出。
  3. **codex 实验组的情况不一样。** codex 是把 skill 放进临时的 `HOME/.agents/skills/`。按 facts-spec-libs.md，这是 codex 的用户级 skill 路径，所以 skill 会被真实触发；`workspace-write` 沙箱也允许运行命令，只要 CLI 可用，它能跑 lint。这样一来，两个 agent 的实验条件不对称：codex 测的是「真实的 skill」，claude 测的是「系统提示」。在同一个 agent 内部对比（对照组和实验组）仍然有效，但不同 agent 之间的结果不能直接比较。
  4. **没有确认 skill 是否真的被加载。** codex 实验组需要统计 `agent.log` 里读取 `measure/SKILL.md` 的次数，`observeEnvironment` 已经支持这个统计。如果某次运行没有触发 skill，这条要单独记下来，不能算进「装了 skill」的结果。
- **修法**：
  - 两组给相同的工具权限。例如 claude 两组都加 `--allowedTools "Bash(node <cli 路径> lint *)"`，codex 两组都提供同一个 CLI 路径。
  - claude 实验组把 skill 目录复制进工作目录（或者用 `--add-dir`），让它读得到 references 和 assets。
  - 实验报告里写明：claude 测的是「内容」，codex 测的是「真实触发」，两者不做跨 agent 比较。
  - 加一项检查：每次运行都要确认 skill 是否被加载。

**R2-02　三组对比的解读第 1 点做了因果归因；两个配置节没有对齐，也没有说明**

- **位置**：`REPORT_C20_ISOLATED.md` 第 5 节「解读」第 1 点；`run-baseline.mjs` 的 `userCodexTopLevel()`。
- **问题**：
  1. 原文「v1 里的差异，主要来自配置没对齐、内置 skill 没关，不是用户 skill 和全局指令造成的」是一个因果判断。但每条提示词只跑了一次，第 4 点自己也写了「不能当成因果结论」。v1 和 v2 的差异只有 2 到 4 页，可能只是随机波动。
  2. 配置白名单本身是合理的。用户 `config.toml` 的顶层键一共 9 个，只看键名，白名单带了其中 8 个，没带的是 `notify`，这是一个通知命令，排除是对的。但下面这些配置节没有带：`projects`（671 个）、`skills`（32）、`plugins`（23）、`mcp_servers`（11）、`marketplaces`（6）、`desktop`（2）、`memories`（1）、`features`（1）、`shell_environment_policy`（1）。报告列了 skills、MCP、插件、memories、projects，**没有列 `features` 和 `shell_environment_policy`**。前者可能开关一些实验功能，后者会影响 shell 拿到的环境变量，两者都可能影响 agent 的行为。
- **修法**：
  - 第 1 点改成「v2 对齐之后，零 error 页数和用户环境一致（codex 4 比 4，claude 18 比 18）。v1 的差异可能来自配置没对齐，也可能是单次运行的波动，目前无法区分」。
  - 在报告里补充列出没有对齐的两个配置节。如果要对齐，就把 `features` 也加进白名单。

### Low

| 编号 | 位置 | 问题 | 修法 |
|---|---|---|---|
| R2-03 | `bench/run-baseline.mjs:58`；`2026-W2-baseline-isolated-v2-claude-code/environment.log` 第 1 行 | `environment.log` 第一行写的是「claude --safe-mode --no-session-persistence」，没有 `--disable-slash-commands`。实际命令里是有这个参数的：30 份 `agent.log` 的第一行都带了它（30/30）。 | 更新第 58 行的说明文字，下次生成时生效。 |
| R2-04 | 报告第 4 节第 1 条、`summary.json` | 「实测可用 skill 为『无』」这一结论，仓库里没有对应的探测输出。本机 `claude --help` 对 `--disable-slash-commands` 的说明是「Disable all skills」，**说明文字支持这个结论**，但缺少实测证据。 | 把那次探测的命令和输出存进 `docs/verification/w2/evidence/`。 |
| R2-05 | `2026-W2-baseline-isolated-claude-code/summary.json`（v1） | v1 的 `baseline_kind` 还写着「不加载 CLAUDE.md、skills…」。报告第 4 节已经承认 v1 下内置 skill 仍然可用，但这个文件里没有更正，单独读它会被误导。 | 给 v1 的两份 summary 加一个 `superseded_by` 字段，或者在 `bench/runs` 里放一份说明。 |
| R2-06 | `README.md:52`（W2-04）；`docs/PRD.md:521`（W2-05） | 两处上一轮的整改只做了一部分：①SKILL.md 补上了「或者让 measure.css 成为第一个引入的样式表」，README 没有补，也没有说明这里的「第一」按全页样式表的先后顺序算；②附录 C20 已经补上 commit 号，但 §7.4 标题多出来的括号说明，没有在 C21 里登记。 | README 补上这一句；C21 登记标题的改动。 |
| R2-07 | `docs/PRD.md:531`（C22 新增的例外） | 「写在 `body` 等祖先元素上的 `line-height`……传不到中文元素」这句说得太宽。`measure.css` 只在 `p`、`li`、`h1`–`h3` 上设置了 `line-height`，其他中文元素（比如 `div` 里的正文）照样能继承 `body` 的行高。`line-break`、`text-autospace` 这两条说法是准确的，因为它们写在所有 `:lang(zh)` 元素上。这段文字用户已经确认过，要改需要用户再次确认。 | 下次修改 PRD 时，补一句「`line-height` 只影响 `p`、`li`、`h1`–`h3`」。 |
| R2-08 | 报告第 5 节第 3 点（patch rejected 的原因） | 执行方写的是「原因待确认」。我从日志里找到了一条比较可能的原因，见第 3.3 节。 | 用 `realpathSync` 把工作目录统一成 `/private/var/...` 形式，再传给 `-C`；然后看这个错误是否消失。 |

---

## 3. 逐项复核

### 3.1 上一轮发现的落实情况（第 1 项）

| 发现 | 复核结论 | 证据 |
|---|---|---|
| W2-01 | **确认落实** | PRD 的 `git diff bb328fd HEAD` 只动了三处：§5.1 一句、§7.4 新增「例外：继承来的值」、附录 C22。三处都和 `PRD_W2-01_PROPOSAL.md` 的改动 1–3 逐字一致，**没有提案以外的改动**（`2fc94ab` 只是把 C22 挪到 C21 后面）。README 和 SKILL 同步改了。措辞上的小问题见 R2-07 |
| W2-02 | **确认落实**（有残留，见 R2-02） | T07 的归因已撤回；claude 用户环境组的模型无法补记，已写进局限；北极星方案已更正（但新方案还有 R2-01 的问题）；codex 配置已按白名单对齐；claude 加了 `--disable-slash-commands` |
| W2-03 | **确认落实** | 用 `6d1d24d` 的构建跑 `test/w2-review.test.js`，**失败 1/1**，与日志一致。修复后的 `stripAutospace` 对 LF 和 CRLF 都生效；找不到要删的段落时报 `UsageError`，不再静默跳过。HEAD 上测试 159/159 通过；`git diff 6d1d24d HEAD -- test/` 为空；9 份 MANIFEST 都 OK；V-10（`assets.test`）4/4 通过；`dist` 与 `src` 一致 |
| W2-04 | **部分落实** | 见 R2-06 |
| W2-05 | **部分落实** | 见 R2-06 |
| W2-06 | **确认落实** | 报告里写明了风险；运行前后 `auth.json` 的修改时间都是 `1792916128`，仍是普通文件，没有被替换（已复核）。脚本没有在运行结束后自动检查，这一点可以接受 |
| W2-07、W2-08 | 未处理 | 都是 Low，可以接受 |

### 3.2 claude v2：`--disable-slash-commands`，以及 v1 的降级说明（第 2 项）

- **参数是否都带上了**：30 份 `agent.log` 的第一行都是 `claude -p <提示词> --permission-mode acceptEdits --safe-mode --disable-slash-commands --no-session-persistence --output-format json`，30/30。
- **参数的含义**：本机 `claude --help`（2.1.296）对 `--disable-slash-commands` 的说明是「Disable all skills」，和执行方的说法一致。
- **隔离检查**：
  - 日志里出现用户目录路径：0 处；
  - 日志里出现 `SKILL.md`：0 处；
  - 产物里出现 `measure.css`、`text-autospace`、`line-break`：0 个文件；
  - `~/.claude/projects` 里 measure 相关的目录仍是 31 个；
  - 模型：claude-opus-5-5，30 次；
  - 退出码全部为 0。
- **v1 的结论是否如实降级**：报告第 4 节第 1 条已经写明「v1 的 claude 隔离基线并非没有任何 skill」，并把北极星对照组改用 v2。**报告层面已经如实降级**；但 v1 的 `summary.json` 没有改（R2-05）。

### 3.3 codex v2 的配置白名单，以及 patch rejected（第 3 项）

- **白名单是否合理**：用户顶层键一共 9 个（只看了键名）。带过去 8 个：`model`、`model_reasoning_effort`、`plan_mode_reasoning_effort`、`approval_policy`、`approvals_reviewer`、`sandbox_mode`、`personality`、`service_tier`。没带的是 `notify`，这是通知命令，排除合理。**没有带入不该带的配置。** 没有对齐的配置节见 R2-02。
- **日志里的运行参数**：v2 和用户环境的每份日志里都是 `approval: never`、`model: gpt-6-astra`、`reasoning effort: high`、`sandbox: workspace-write [workdir, /tmp, $TMPDIR]`，各 30 次，完全一致。
- **patch rejected 的可能原因**（推测，需要实测确认）：
  - 每份 codex 日志一开始都会执行 `pwd`，输出的是**真实路径** `/private/var/folders/.../measure-baseline-codex-NNN-…`。但脚本用 `-C` 传进去的是 `/var/folders/...`（`os.tmpdir()` 返回的形式；在 macOS 上，`/var` 是指向 `/private/var` 的符号链接）。
  - 13 次被拒，紧挨着被拒之前出现的路径**全都是 `/private/var/...` 形式**。被拒之后紧接着的一次 `apply patch` 成功了，用的是 `/var/folders/.../index.html`（以 004 为例）。
  - 所以比较可能的情况是：agent 第一次写文件时用了 `pwd` 给出的 `/private/var` 路径，沙箱按字面比较，认为它不在 `/var` 形式的可写目录里，于是拒绝；agent 换成 `/var` 路径重试后成功。
  - 三组被拒的次数是 2、6、13。差异更可能来自 agent 选路径的随机性，或者某些配置项的影响，而不是隔离本身有问题。最终 30 页全部产出，**不影响页面质量的统计**。
  - 验证方法见 R2-08 的修法。

### 3.4 三组对比的解读与北极星方案（第 4 项）

- **数据可以复算**：我用 HEAD 的构建对 v2 两组重新 lint：
  - codex：排除 T02/T04 后零 error 4 页，各规则命中页数 T11 25、T07 15、T13 7、T03 4、T06 2、T08 1；
  - claude：排除 T02/T04 后零 error 18 页，各规则命中页数 T03 7、T11 2、T08 2、T13 2、T07 1；
  - 60 份 `lint.json` 与重新计算的结果没有差异；
  - 平均用时按 `summary.rows` 计算，为 130 秒和 70 秒，与报告一致。
- **解读是否如实**：
  - 第 2 点（claude 的 T03 是 11 比 7 比 7，「」引号的偏好）、第 3 点（patch rejected）、第 4 点（没有方差，不能下因果结论）都如实；
  - 第 1 点的归因过强（R2-02）。
- **北极星方案是否可行**：
  - `--append-system-prompt-file` 是 claude CLI 支持的参数，`--help` 在 `--bare` 一节里提到了 `--append-system-prompt[-file]`；
  - codex 的 `~/.agents/skills` 是用户级 skill 路径；
  - 所以方案**在技术上可行**，但两组之间不只差一个变量（R2-01）。

---

## 4. 没能核查的部分

1. **用户原话的真实性**：只核对了逐字一致，真实性需要用户本人确认。
2. **「实测可用 skill 为『无』」**：要验证就得调用 claude API，属于联网，所以只核对了 `--help` 的说明（R2-04）。
3. **patch rejected 的原因**：只能从日志推断，确认需要改 `-C` 的参数后重跑。
4. **`features`、`shell_environment_policy` 两个配置节的值**：有意没有读取，所以无法判断它们是否真的影响了生成结果。
