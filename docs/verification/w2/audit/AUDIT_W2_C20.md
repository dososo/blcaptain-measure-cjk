# 分寸 · Measure · W2 中期复核：C20（`@layer measure`）与隔离环境基线

- **当前步骤**：W2 第 7 步「审计验收」（中期），由 Claude Code 作为独立审计方执行。
- **审计日期**：2026-10-25（21:30–21:50 CST）。
- **审计对象**：HEAD `bb328fd`。
  - 相关提交：`5513e52`（实现前锁定）→ `6ab1522`（提案）→ `3368919`（实现）→ `72670d4`（隔离基线）→ `bb328fd`（报告）。
- **审计依据**：
  - 执行方报告与 PRD 提案：`docs/verification/w2/REPORT_C20_ISOLATED.md`、`PRD_C20_C21_PROPOSAL.md`；
  - 实现前、实现后的测试日志：`evidence/c20-tests-*.log`；
  - 测试与夹具：`test/w2-c20.test.js`、`test/fixtures/w2-c20/`；
  - PRD：`docs/PRD.md` 的 §5.1、§7.3、§7.4 和附录 C；
  - 基线：`bench/run-baseline.mjs` 和 `bench/runs/2026-W2-baseline-isolated-*`；
  - 协调方转述的用户原话。
- **审计方式**：只读。
  - 没有运行 verify、package、run-baseline，没有联网，没有提交。
  - 「实现前」测试的取证方法：把 `git archive 5513e52` 解出到 scratchpad，单独编译后跑测试。
  - 测试页面放在 scratchpad。
  - 为了核对 `--safe-mode` 的说明，在本机执行了 `claude --help`。这条命令只读取帮助文本，不会联网。

---

## 1. 结论

**有条件达标。**

一句话理由：
- **C20 的实现、PRD 修改和测试都正确且一致**。PRD 的改动与提案逐条吻合；`measure.css` 与 §7.4 逐字一致；实现前 4 个测试确实失败；层叠结论在我构造的 Tailwind v4 风格页面上全部算对。
- **隔离基线确实没有加载用户的 skill 和全局指令**，数据可以复算。

还有两条 Medium 需要先处理：
1. PRD、README、SKILL 写的「页面上任何样式都优先于 measure.css」不完全准确：**从祖先继承下来的值，会被 measure.css 直接作用在元素上的声明盖掉**。C20 把 `line-break` 挪到每个中文元素上之后，多了一个这样的例子。这句话是用户确认过的 PRD 原文，要改就得用户再次确认。
2. 隔离基线和用户环境基线之间，除了 skill 和全局指令，**还有别的差异**，报告没有披露。另外，北极星实验组的方案和 `--safe-mode` 有冲突。

这两条都只需要改文档、改报告，不需要改代码。

**用户原话核对**：
- `PRD_C20_C21_PROPOSAL.md` 第 3 行、提交 `3368919` 的提交信息、PRD 附录 C20 三处记录的原话，与协调方转述的原话**逐字一致**（含全角「＠」）。
- 局限：我看不到对话本身，原话是否真实，需要用户本人确认。

---

## 2. 发现清单

统计：Blocker 0 条，High 0 条，Medium 2 条，Low 6 条。编号从 W2-01 开始。

### Medium

**W2-01　「页面上任何样式（不分层的样式）都优先于 measure.css」只对直接作用在元素上的声明成立；从祖先继承来的值会被盖掉**

- **位置**：
  - `docs/PRD.md:190`（§5.1）：「不会覆盖用户的任何样式（包括分层样式）」；
  - `docs/PRD.md:530`（§7.4）：「页面上不分层的样式，永远优先于 `measure.css`」；
  - `README.md:52`、`skills/measure/SKILL.md:23`：「页面上的任何样式……都会优先于它」；
  - `measure.css` 文件头的注释。
- **问题**：按 CSS 层叠规则，元素自身哪怕只有一条声明，即使在层里、优先级为 0，也压过从父元素继承来的值。`measure.css` 用 `:where(:lang(zh))` 直接命中每个中文元素。所以用户写在 `body` 或 `html` 上、本来要靠继承传下去的 `line-break`、`text-autospace`、`font-synthesis-style`，传到中文元素时都会被 `measure.css` 盖掉。
  - RULING-01 当初讨论的就是这个现象：`body { text-autospace: no-autospace }` 不生效。
  - **C20 新增了一个这样的例子**。原来 `line-break: strict` 只写在根元素上，用户写 `body { line-break: anywhere }` 可以生效；现在写到了每个中文元素上，用户这条设置对中文元素失效。
- **复现**：临时页 `s5-inherit.html`：引入新的 `measure.css`，再写 `body{line-break:anywhere}`。校验器判定段落的 `line-break` 是 `strict`，不报 T04。这个判定和浏览器的层叠规则一致，问题出在文档的说法上。
- **为什么是问题**：这是对使用者的明确承诺。用户（或 Agent）在祖先元素上统一设一个值，会发现对中文不起作用。
- **修法**（文档修改，涉及 PRD，需要用户确认）：
  - 改为「直接写在元素上的样式，无论分不分层，都优先于 measure.css。从祖先继承来的值（如写在 `body` 上的 `line-break`）会被 measure.css 盖掉。要改，请写在具体元素上，或者写 `:lang(zh)` 选择器。」
  - 同时在 C20 里注明 `line-break` 位置变化带来的这个行为差异。

**W2-02　隔离基线和用户环境基线之间还有其他差异，没有披露；北极星实验组的方案和 `--safe-mode` 冲突**

- **位置**：`docs/verification/w2/REPORT_C20_ISOLATED.md` §2；`bench/run-baseline.mjs` 中的 `userCodexModel()` 和 `commandFor()`。
- **问题**：
  1. **codex 只带过去了 `model` 和 `model_reasoning_effort` 两项。**
     - 用户 `config.toml` 里还有 `approval_policy`、`sandbox_mode`、`personality` 等配置项（我只看了键名，没看值）。隔离环境里这几项都用的是默认值。
     - 其中 `personality` 可能影响生成风格。审批和沙箱配置也确实不同：隔离环境里有 6/30 次运行出现「patch rejected: writing outside of the project」，用户环境只有 2/30；平均用时从 91 秒涨到 174 秒。
     - 报告写的是「模型参数与用户环境一致」，这句话本身成立，但两组之间不只差了 skill 和指令，这一点没有说。
  2. **claude 两组的模型可能不同。** W1 用户环境基线的模型记为「待确认」，隔离组是 `claude-opus-5-5`，不能保证两组只差一个变量。
  3. **生成时间不同**（19:00 前后和 21:00 前后），每条提示词只跑了 1 次。报告第 3 点已经如实说明了这一点。
  4. **解读第 2 点有些引申过度。** 报告说 T07 从 0 页升到 4 页，「方向和全局 CLAUDE.md 一致」，但 CLAUDE.md 里没有字距相关的规定，这个归因没有依据。T03 那一条是有依据的：我复算过，隔离组 7 页 T03 里有 6 页是「」引号；用户环境组 11 页 T03 里有 9 页是「」引号。
  5. **北极星实验组的方案行不通。** 报告说「装 measure」那一组也用同样的隔离方式，只额外加载 measure skill。但按 `claude --help` 的说明，`--safe-mode` 会把 skills 一起关掉，在这个模式下没法加载 measure。实验组得换一种隔离方式（比如临时的配置目录里只放 measure），对照组也要跟着换成同一种，才能保证两组只差一个变量。
- **修法**：
  - 报告补一节「两组之间的已知差异」；
  - 删掉或弱化对 T07 的归因；
  - W2 北极星实验开始之前，先确定实验组和对照组共用的隔离方式，然后**用同一种方式重跑对照组**；
  - codex 侧要么把 `personality` 等影响生成的配置也带过去，要么明确写出两组的配置差异。

### Low

| 编号 | 位置 | 问题 | 修法 |
|---|---|---|---|
| W2-03 | `packages/cli/src/cli.ts:164` | `init --spacing text` 靠一条按 LF 写的正则删掉 `@supports` 那一段。如果文件是 CRLF 换行（比如在 Windows 上用 `core.autocrlf` 检出），正则匹配不上，**不会报错，整段原样保留**。我用 node 模拟过：CRLF 版本 replace 之后内容不变，`text-autospace: normal` 还在。LF 版本没问题，括号 5 对 5 配对正确，也没有越界删除。 | 删除之后检查结果，内容没变就退出码 2；或者先统一成 LF 再处理。 |
| W2-04 | `README.md:52` | README 只写了「入口 CSS 的第一行」。在 HTML 里按顺序 `<link>` 多个样式表时，`@layer measure;` 必须出现在**全页最早声明的层之前**。临时页 `s4` 复现：语句写在 Tailwind 的 `<link>` 之后，`measure` 层仍然排在后面，盖过了工具类，校验器的判定与浏览器一致。SKILL 补了「或者让 measure.css 成为第一个引入的样式表」，README 没有。 | README 补上这句备选写法，并说明是按「全页样式表的先后顺序」算。 |
| W2-05 | `docs/PRD.md:521`、附录 C20 | PRD 里有两处和提案不一致：①§7.4 的标题加了「（…W2 按 C20 改为 `@layer measure`）」，提案里没有这项改动；②提案第 5 条要求「写上实现的 commit」，附录 C20 里没写。都不影响内容。 | 附录 C20 补上 `3368919`。标题的改动在 C21 里登记一下即可。 |
| W2-06 | `bench/run-baseline.mjs` 的 `isolatedEnv()` | codex 的 `auth.json` 是用 symlink 指回原文件的。如果 codex 运行时刷新 token，并且是「写临时文件再 rename」的方式，就会把 symlink 换成一份本地副本，原文件不会更新；refresh token 有轮换机制的话，用户的登录可能失效。本次运行中原文件的修改时间停在 16:15，没有变化，临时目录也已经清理干净，所以没有发生。这只是潜在风险。 | 运行结束后检查 `auth.json` 是否仍然是 symlink；在文档里写明这个风险。 |
| W2-07 | `bench/golden/` | golden 页面里内联的仍是旧版基础样式（不分层，`line-break` 写在根元素上），V-03 测不到新版 `measure.css` 的写法。已知，执行方说明过「锁定不改」。 | W2 做 golden 多样化时，补几页用新版 `@layer measure` 的页面。 |
| W2-08 | `init --spacing text` 生成的文件 | 删掉那一段后，在层的闭合括号前留下一个多余的空行。只影响外观。 | 可以不改。 |

---

## 3. 逐项复核

### 3.1 PRD 改动与提案是否一致、measure.css 是否逐字一致、实现前是否失败（第 1 项）

**`git diff 3368919^ 3368919 -- docs/PRD.md` 和提案逐条比对：**

| 提案 | PRD 实际改动 | 结论 |
|---|---|---|
| 改动 1：§7.4 代码块整体替换 | 新代码块与提案逐字相同 | 一致 |
| 改动 2：§7.4 的「优先级与层」 | 4 条要点与提案逐字相同 | 一致（内容问题见 W2-01） |
| 改动 3：§5.1 第 190 行 | 与提案相同 | 一致（内容问题见 W2-01） |
| 改动 4：§7.3 的 `Thresholds` | 新增 `Thresholds` 接口，`thresholds?: Partial<Thresholds>`。我对过范围数值，与 `config.ts` 的 `THRESHOLD_RANGE` 一致 | 一致 |
| 改动 5：附录 C | C20 改为已实现，新增 C21 | 基本一致，C20 没写实现的 commit（W2-05） |
| 提案以外 | §7.4 标题多了一个括号说明 | 小的提案外改动（W2-05） |

**`measure.css` 与 §7.4：**
- `test/assets.test.js` 4/4 通过，也就是 V-10 成立。
- `skills/measure/assets/measure.css` 与 `packages/cli/assets/measure.css` 用 `diff` 比较，完全相同。

**实现前确实失败：**
- 用 `5513e52` 的源码编译后跑 `test/w2-c20.test.js`：5 项里 4 项失败，1 项通过。通过的那一项是对照组（不分层的用户样式优先），在实现前本来就应该通过。这和 `c20-tests-before-impl.log` 的记录一致。
- 锁定之后夹具和测试没有动过：`git diff 5513e52 HEAD -- test/` 结果为空，9 份 MANIFEST 全部 OK。
- 另外看了一下失败原因：init 那一项在实现前失败，是因为断言里写了 `@layer measure`，并不是因为复现了「层的闭合括号被删掉」这个缺陷。实现后的括号配对已经单独确认过（5 对 5），不影响结论。

**HEAD 状态：**
- `npm test` 158/158 通过；
- `dist` 与 `src` 的编译结果一致；
- golden 20 页 0 error、3 warn；
- validate-skill 38 项通过。

### 3.2 `@layer measure` 的层叠结论（第 2 项）

**三条规则逐条核对：**

| 规则 | 结论 | 依据 |
|---|---|---|
| 普通声明里，不分层的优先于所有分层的 | 正确 | 我在 iter2 和本轮都复现过 |
| 层之间，先声明的层优先级最低，后声明的优先 | 正确 | — |
| `!important` 时顺序反转（分层的 `!important` 压过不分层的 `!important`，先声明的层的 `!important` 最强） | 正确 | 我在 iter2 用 `e02` 复现过；`measure.css` 本身没有 `!important`，所以反转规则不会让它反过来压过用户样式 |

**文档里「入口 CSS 第一行写 `@layer measure;`」这个说法：**
- 规范上允许：`@layer` 语句可以写在 `@import` 前面。
- 用 Tailwind v4 的写法（先写 `@layer measure;`，再写 `@import "tailwindcss";`），`measure` 会排在 `theme`、`base` 等层之前，这一点正确。
- 前提：Tailwind v4 的构建工具（Lightning CSS）要保留这条语句，并且不改变它的位置。这一点没有官方资料可以核验，属于**待确认**，建议在完整档上线后用真实浏览器验证一次。
- 文档没写到的边界：见 W2-04（多个 `<link>` 的情况）和 W2-01（继承值的情况）。

**校验器的计算**：我构造了 6 个页面，用的都是新版 `measure.css`，结果全部与 CSS 规范一致。

| 页面 | 写法 | 校验器结果 | 是否正确 |
|---|---|---|---|
| s1 | `measure.css` 在前，Tailwind 风格的 `tw.css` 在后 | T06 error，`leading-tight` 生效 | 正确 |
| s2 | `tw.css` 在前，没有 `@layer measure;` 语句 | 没有 T06，`measure` 排在后面，盖过了工具类 | 正确（文档已经提醒） |
| s3 | 入口 CSS 写成 `@layer measure; @import "tw.css"; @import "measure.css";` | T06 error | 正确 |
| s4 | 语句写在 `<style>` 里，但这个 `<style>` 在 `tw.css` 的 `<link>` 之后 | 没有 T06 | 正确（问题见 W2-04） |
| s5 | `body{line-break:anywhere}`，加上新版 `measure.css` | 判定为 `strict`，不报 T04 | 正确（问题见 W2-01） |
| s6 | `@import url(measure.css) layer(base2)` | 正常解析，0 error | — |

### 3.3 `init --spacing text` 的边界情况（第 3 项）

- **LF 换行**：只删掉注释和 `@supports` 那一段；括号 5 对 5，层的闭合括号保留；生成的配置里是 `spacing: "text"`。
- **目标文件已存在或是 symlink**：继续沿用 iter2 的 `lstat` 检查加 `wx`（文件已存在时不写），会拒绝，不会覆盖。
- **CRLF 换行**：会悄悄不删（W2-03），但不会删多，也不会把括号删坏。

**结论**：安全，不会删坏文件；唯一的缺口是 CRLF 时不删也不报错。

### 3.4 隔离基线（第 4 项）

**是否真的隔离：**
- 60 份 `agent.log` 里都没有 `~/.agents`、`.codex`、`.claude` 这些路径；
- 没有读取过任何 `SKILL.md`，日志里也没有任何 `skills/` 路径；
- 60 份产物里没有出现 `measure.css`、`text-autospace`、`line-break`；
- `~/.claude/projects/` 里带 `measure-baseline` 的目录仍是 31 个，没有新增；
- 两组都是 30/30 产出、退出码全部为 0；
- 模型都有记录：codex 是 `gpt-6-astra`，共 30 次；claude 是 `claude-opus-5-5`，共 30 次；
- 临时目录已经清理干净。

**codex 凭证的 symlink 处理**：没有复制、也没有读取 `auth.json` 的内容；临时目录是 `mkdtemp` 建的，只有本用户可以访问；运行期间原文件没有被改动。潜在风险见 W2-06。

**`claude --safe-mode` 的覆盖范围**：本机 `claude --help`（2.1.296）的说明是：关闭 CLAUDE.md、skills、已安装的插件、hooks、MCP 服务器、自定义命令和 agent、输出风格、workflows 等；管理员策略、认证、模型选择、内置工具仍然生效。这和 `run-baseline.mjs` 注释、报告里的说法一致。`--no-session-persistence` 只在 `--print` 模式下生效，这里用的是 `-p`，所以生效。

**对比数据**：我用 HEAD 的构建对 4 组基线（两个 agent × 用户环境和隔离环境）全部重新 lint 了一遍：
- 每组的零 error 页数、排除 T02/T04 后的零 error 页数（codex 4 / 2，claude 18 / 14）、各规则命中页数，都和报告里的表一致；
- 60 份 `lint.json` 和重新计算的结果没有差异。

**解读是否如实**：
- 第 1、3 点如实：「两边都是 0%」「没有方差估计，不能下因果结论」。
- 第 2 点里 T07 的归因引申过度，第 4 点的实验方案和 `--safe-mode` 冲突（W2-02）。
- 整体看没有夸大效果，但对两组之间的差异披露不够。

### 3.5 执行方报告的操作失误是否处理干净（第 5 项）

- 仓库根目录下没有 `measure.css` 和 `measure.config.json`；
- `git status --ignored` 只列出了 `packages/cli/dist/`，这是正常的构建产物；
- 两个文件名在 git 历史里**从来没有被提交过**（`git log --all --name-only` 里搜不到）；
- 实现之后的完整测试日志（158/158）是在删掉这两个文件之后生成的，我在 HEAD 上重跑也是 158/158。

**结论：处理干净。**

> 补充说明：如果误生成的 `measure.config.json` 当时还在根目录，它会被当作默认配置读进去。之后的重跑排除了这个影响。

---

## 4. 没能核查的部分

1. 用户原话是否真实：我只核对了三处记录和协调方转述的版本逐字一致。
2. Tailwind v4 构建时会不会保留 `@layer measure;` 这条语句和它的位置：不能联网，无法核验官方文档。
3. 真实浏览器的表现：完整档还没有，`@layer` 和继承的结论都是按 CSS 规范推理的。
4. `@layer` 的浏览器支持版本（Chrome 99、Firefox 97、Safari 15.4）：只能对照提案里引用的 MDN 数据和我自己已有的知识，本轮没有直接读 BCD 原文。
5. 用户 `config.toml` 里 `personality` 等配置项的具体值：为了少接触用户配置，有意没有读取。
