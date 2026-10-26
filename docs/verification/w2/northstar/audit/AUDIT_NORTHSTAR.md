# 北极星实验 · 独立审计（AUDIT_NORTHSTAR）

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」 |
| 审计方 | Claude Code（独立审计，只做这一轮） |
| 审计对象 | `docs/verification/w2/northstar/VERIFICATION_REPORT.md`、同目录 `results.json`、`evidence/`；`bench/runs/2026-W2-northstar-v3-{codex,claude-code}-{control,measure}/`；`bench/run-baseline.mjs`、`bench/northstar-compare.mjs` |
| 基线 | HEAD `8c817dd`，工作树干净 |
| 审计规则 | 用户定：Blocker、High 执行方必须修并复核；Medium、Low 记台账 |
| 范围限制 | 没有重跑 120 次 agent 生成；只读代码与日志、重算统计、对 5 页产物重跑完整档 lint |

---

## 1. 结论：**有条件达标**

- **数字没有算错。** 我从 120 份 `lint-render.json` 独立重算，主指标、配对计数、两个符号检验的 p 值、排除 T02/T04 的口径、每页平均 error 条数，和 `results.json` 完全一致；`northstar-compare.mjs` 重算出的结果和仓库里的文件除 `generated_at` 外逐字相同。抽查 5 页重跑完整档，findings 和仓库里存的一致（5/5）。
- **核心结论站得住：** 同一模型下，装 measure 后完整档零 error 页面显著增加（codex 0/30 → 30/30；claude 0/30 → 27/30；排除 T02/T04 后 claude 15/30 → 27/30，p = 0.0042）。两组除 measure 外的条件一致；对照组 60 次运行里没有任何一次提到或调用过 `measure-cjk`，没有泄漏。
- **但报告有 2 处 High 级事实错误，必须修正并复核：**
  - NA-01：§1 把 T07 写成「行长超标」，实际上 T07 是「中文字距为负」；
  - NA-02：「实验组 30/30 都跑了 measure-cjk 并照着改」不成立。`used_measure_cli` 检测会被日志里 SKILL.md 的正文误触发。实际跑过 `lint` 的次数：codex 29/30，claude 只有 13/30。N-04 对 019、028 两页的描述也因此错了。
- 落实 NA-01、NA-02 并复核后，可以改判达标。

| 严重度 | 条数 | 编号 |
|---|---|---|
| Blocker | 0 | — |
| High | 2 | NA-01、NA-02 |
| Medium | 4 | NA-03、NA-04、NA-05、NA-06 |
| Low | 6 | NA-07 – NA-12 |

---

## 2. 逐条发现

### NA-01 · High · §1 把 T07 写成了「行长超标」

- **位置：** `VERIFICATION_REPORT.md` §1 第 3 个要点：「对照组的主要问题是字号太小（T11，30/30 页）和行长超标（T07，23/30 页）」。
- **问题：** T07 是「中文字距不能为负」（`packages/cli/src/rulesMeta.ts:31`；`probe.ts:275` 的判定是 `letterSpacing < 0`）。行长是 T05，codex 对照组只命中 9/30 页。
- **为什么是问题：** §1 是要拿去对外宣传的结论段，它说错了 skill 修好了什么。读者会以为 skill 主要解决的是行长。
- **证据（审计方实跑）：**
  ```
  $ python3（统计两组对照组完整档 T07/T05 的 error 信息）
  codex [('T07 中文字距为负（计算值 -0.5px）…', 20), ('T07 中文字距为负（计算值 -1px）…', 19), ('T07 中文字距为负（计算值 -0.6px）…', 12), …, ('T05 实测：在 1280px 宽度下，正文最长一行有 58 个', 8)]
  codex control rule pages [('T02', 30), ('T11', 30), ('T04', 30), ('T07', 23), ('T05', 9), ('T13', 6), ('T06', 6), ('T03', 2)]
  ```
- **修法：** 改成「字号太小（T11，小于 12px，30/30 页）和中文负字距（T07，23/30 页）；行长超标（T05）9/30 页」。全文检查其他地方有没有把规则编号和含义对应错。

### NA-02 · High · 「实验组 30/30 都跑了 measure-cjk」不成立：检测会被 SKILL.md 正文误触发

- **位置：** `bench/run-baseline.mjs:269`：`row.used_measure_cli = /measure-cjk (lint|card|fonts|rules)/.test(log)`。受影响的地方：`results.json` 的 `checks.measure_used_cli_runs`（两个 agent 都是 30）；报告 §4 第 1 条「30/30 都跑了，然后照着改」；N-04「这几页的 agent 自检时只跑了基础档，0 error」。
- **问题：** 这条正则在整份日志里搜索。SKILL.md 正文里有 3 处会命中的字样（例如 ``先运行 `measure-cjk fonts "<字体名>"` ``）；实验组只要读过 SKILL.md，SKILL.md 的内容就会出现在日志里，检测必然为真。所以它没有测出「agent 跑没跑过 CLI」。按实际执行的命令重新统计：
  - codex 实验组：29/30 次运行执行过 `measure-cjk lint`。025 只跑过 `measure-cjk fonts`，没跑 lint。跑过 `--render` 的只有 2/30（001、029）。
  - claude 实验组：**只有 13/30** 次运行成功执行过 `lint`，跑过 `--render` 的只有 1/30（026）。其余 17 次没找到 CLI。原因是 SKILL.md 的「命令」一节教的是 `node <measure-cjk 仓库>/packages/cli/bin/measure-cjk.js`，agent 就去找仓库：用 `find ~`、`mdfind`、`ls ~` 搜索，或者写 `command -v measure-cjk` 这类复合命令。这些命令不在 `--allowedTools "Bash(measure-cjk:*)"` 的放行范围内，在 `-p` 模式下被拒绝。
  - N-04 说「这几页自检时只跑了基础档，0 error」，只对 012 成立。019、028 两页**根本没跑过 lint**，而且这两页的基础档本身就报 T06 error（019 有 1 条，028 有 3 条）。
- **为什么是问题：** ① 报告写的是检测器输出的数字，没有核对实际调用，属于伪成功；② 它改变了对 claude 实验组的解读：claude 实验组测到的主要是「skill 内容（规则 + measure.css）」的效果，只有不到一半的运行有「自检闭环」；③ N-04 的第①个改进方向建立在错误的前提上（见 §3 裁定 3）。
- **证据（审计方实跑）：**
  ```
  $ grep -c "measure-cjk fonts\|measure-cjk.js lint" skills/measure/SKILL.md
  3
  $ python3 /tmp/ns-audit/claude_cli.py   # 逐个解析 stream-json 里 Bash 的 tool_use，以及对应的 tool_result
  002 lint_ok 0 … 003 lint_ok 0 … 019 lint_ok 0 … 028 lint_ok 0 …
  {'runs_with_lint': 13, 'runs_with_render': 1}
  019 CMD: find ~ -maxdepth 5 -name "measure-cjk.js" … |ERR | find in '~' was blocked. …
  028 CMD: ls …; command -v measure-cjk; … |ERR | This Bash command contains multiple operations. The following part requires approval: command -v measure-cjk
  $ python3 /tmp/ns-audit/codex_logs.py   # 只统计 codex 日志里 exec 块执行过的命令
  measure 025 catSKILL=1 measure-cjk execs=4 lint=0 render=0
  measure 001 … lint=1 render=1；029 … lint=4 render=2；其余 lint≥1、render=0
  $ python3（读 012/019/028 的 lint.json）
  012 static {'errors': 0, 'status': 'pass'}；019 static {'errors': 1, 'status': 'fail'} [T06 error]；028 static {'errors': 3, 'status': 'fail'} [T06 error ×3]
  ```
- **修法：**
  1. 把 `used_measure_cli` 改为只统计「实际执行过的命令」：codex 只看 `exec` 块里的命令行；claude 只看 Bash `tool_use` 的 `input.command`，并且对应的 `tool_result` 不是权限拒绝。另外分别记 `lint` 和 `lint --render` 的次数。用 `--relint-only` 重新汇总（不重新生成页面），再重跑 `northstar-compare.mjs`。
  2. 修改报告 §4 第 1 条：codex 29/30 跑过 lint（2/30 用完整档）；claude 13/30 跑过 lint（1/30 用完整档），17 次没找到 CLI。补一句：claude 实验组里，没跑 lint 的 17 次零 error 有 15 次，跑过 lint 的 13 次零 error 有 12 次（审计方从上面的数据算出），说明大部分提升来自 skill 内容本身。这一条要求执行方复核。
  3. 修改 N-04：只有 012 是「只跑了基础档、基础档 0 error」；019、028 没跑过 lint，基础档本来就会报 error。

### NA-03 · Medium · 「工具对等」只是名义上的；处理组实际是三样东西捆在一起

- **位置：** 报告 NS-04、§4 第 1 条；方案 §3。
- **问题：** 两组的 PATH 和权限确实一样（各组 001 号日志的第一行已核对，见 §4）。但对照组没有任何途径知道有 `measure-cjk` 这个命令：60 次对照组运行里，0 次提到过 `measure-cjk`。所以「装 measure」实际同时给了三样东西：① 规则说明；② 可以直接复制的 `measure.css`（54/60 份实验组产物的根目录有 `measure.css` 文件（claude 28、codex 26），60/60 写了 `text-autospace`）；③ 用评分工具自检（codex 29/30，claude 13/30）。这个实验分不出三者各自的贡献。
- **为什么是问题：** 对外说「装了 skill 就提升」没问题；如果说成「skill 的规则说明让 AI 学会了中文排版」，就超出了证据。另外，claude 实验组的执行和方案设想的不一样：方案以为 claude 能用 PATH 里的 CLI，实际上 SKILL.md 引导 agent 去找仓库路径，结果 17/30 没用上（NA-02）。
- **修法：** §4 增加一条局限，写明处理组是「规则 + measure.css + 校验器闭环」的组合，并写明 claude 实验组只有 13/30 用到了校验器；§1 的措辞按 §3 裁定 4 调整。

### NA-04 · Medium · §1 对「排除 T02、T04」的解读说过头了

- **位置：** §1「排除之后的差距，才说明 skill 对其余排版问题有没有用」；「codex：提升是实打实的」。
- **问题：** 剩下的 T05、T06、T07、T11 也是 measure 自己定的阈值（例如 T06 低于 1.5 报 error，T11 小于 12px 报 error），SKILL.md 的速查表里逐条写着。实验组又用同一个工具自检。所以排除 T02/T04 之后，衡量的仍然是「遵守 measure 规则的程度」，只是去掉了两条「AI 默认不写」的声明式规则。
- **为什么是问题：** 「实打实」这类说法会被理解成独立的质量提升，和 §4 第 1 条自己写的局限相矛盾。
- **修法：** 改成「排除 T02、T04 后，差距来自字号、字距、行长、行高等其余 measure 规则；这些仍是 measure 的标准，不是独立的审美评价」。「实打实」改成「排除这两条后依然显著（30/0/0）」。

### NA-05 · Medium · T06 完整档对单行的 p、li 按正文行高报 error，判定前后不一致（回应 N-04 ②）

- **位置：** `packages/cli/src/probe.ts:318-326`；基础档 `packages/cli/src/rules.ts:213-223` 的写法相同。
- **问题：** 没设行高（`normal`，约 1.2）的单行元素只报 warn；显式设了 1.3、1.4 的单行元素反而报 error。T05 要求元素自身至少有 15 个汉字才检查，T06 没有这个下限。claude 实验组 3 页失败的元素都是单行：
  ```
  $ node /tmp/ns-audit/lines.mjs   # 系统 Chrome，360 和 1440 宽度
  012 p.price "¥150 / 次" fs 15px lh 19.5px（只有 1 个汉字「次」，内含 40px 的数字 span，高度折算 3 行是 span 撑高的，视觉上是 1 行）
  019 p.brand "用户服务 API" fs 18px lh 25.2px lines 1
  028 p.term "复利"/"通货膨胀"/"流动性" fs 48px lh 62.4px lines 1
  ```
- **为什么是问题：** 按规则本意（「正文行高」），这 3 页都是误报。48px 的标题词用 1.3 的行高，在排版上很正常。claude 实验组唯一一个「实验组更差」的配对（012：3 → 4）也来自这个误报。这对实验组是**保守**的偏差，不会夸大结论。
- **修法：** 显式行高低于 1.5 时，也像 `normal` 分支那样，实际折成 2 行及以上才报 error，否则报 warn；可以再给 T06 加一个最少汉字数的下限。基础档同步修改，补回归用例（单行价格标签、48px 词条）。**不要用改过的规则重新给这次实验打分并替换主数字**；如果要补算，作为附加列和原数字并列（见 §5 开放决策 1）。

### NA-06 · Medium · 隔离：除 N-03 外还有三处没记录

- **位置：** `bench/run-baseline.mjs:108-123`（`isoBase` 在一组 30 次运行之间共用）；`evidence/isolation-checks.log`。
- **问题：**
  1. codex 的临时 `CODEX_HOME` 在同一组的 30 次运行之间共用，运行过程中会累积状态。实验组 002 列目录时看到了 `plugins/cache/openai-curated-remote/build-macos-apps/0.1.4/skills/…`（codex 运行时自己下载的远程插件，里面带 skill）、`memories_1.sqlite`、`shell_snapshots/`。因此，「插件不带」的说法不准确；同一组的各次运行也不是严格独立的。memories 有没有在两次运行之间写入和读取：**待确认**。
  2. codex 沙箱的可写范围是 `[workdir, /tmp, $TMPDIR]`（每份日志的开头都有）。并发运行的工作目录和共用的 `CODEX_HOME` 都在 `$TMPDIR` 里，彼此可读可写。025 号运行就执行了 `rg --files /private/tmp /private/var/folders/.../T`。
  3. claude 实验组有多次运行试图搜索用户目录（`find ~`、`mdfind`、`ls ~`），都被权限拦下了。`isolation-checks.log` 只记了「日志里出现用户目录路径」，没有记这些尝试。
- **为什么是问题：** 对这次的结论**没有实际影响**。我核对过：对照组 60 份日志没有出现其他运行的临时目录，也没有 `measure-skill`、`skills/measure/SKILL.md`；120 份产物里没有任何 `/Users/` 引用；远程插件是 macOS 应用开发相关的，和中文排版无关。但「各次运行独立」是符号检验的前提，下一轮应该保证。
- **修法：** 每次运行用全新的 `CODEX_HOME`（凭证仍用符号链接）；记录 codex 的 memories 和插件同步配置，能关就关；把上面三点补进 `isolation-checks.log` 和 §4 第 5 条。

### NA-07 · Low · 「skill 是否加载」的检测太宽（数据本身没问题）

- **位置：** `run-baseline.mjs:268`。
- **问题：** codex 的检测只看日志里有没有出现 `skills/measure/SKILL.md` 这个路径；列目录时也会出现这个路径（例如 002 的 `rg --files`）。claude 的检测里，`log.includes("name: measure")` 是在整份日志里搜，没有和那次读取的返回结果对应起来；`head -3 measure-skill/SKILL.md` 这样只读了开头几行的命令也能通过。
- **对本次数据的影响：** 我逐个解析了 tool_use 和对应的 tool_result：claude 实验组 30/30 都有一次完整读取（返回内容同时包含「## 工作流」「## 命令」「## 参考文件」），其中 21 次用 Read、9 次用 Bash，和 N-01 说的一致；codex 实验组 30/30 都有一条 `cat …/skills/measure/SKILL.md` 的 exec。
- **修法：** 检测和对应的 tool_result 绑定，并检查正文里的标志字样；codex 只认 `exec` 块里的读取命令。

### NA-08 · Low · `northstar-compare.mjs --out` 传绝对路径时会写进仓库

- **位置：** `bench/northstar-compare.mjs:21`：`join(repo, opt("out", …))`。
- **证据：**
  ```
  $ node -e 'const {join}=require("path");console.log(join(process.cwd(),"/tmp/ns-check"))'
  <仓库>/tmp/ns-check
  ```
  按任务说明执行 `--out /tmp/ns-check`，会在仓库里新建 `tmp/ns-check/`。我改用了 `--out ../../../../../../tmp/ns-check`。
- **修法：** 用 `path.resolve(repo, out)`，或者用 `isAbsolute` 判断是不是绝对路径。

### NA-09 · Low · N-04 说「012、019 两页比对照组更差」，没有说明是按哪个口径

- **问题：** 按主口径（完整档全部 error），只有 012 更差（3 → 4），019 是 2 → 1，算实验组更好；只有在「排除 T02/T04」口径下，012、019 才都更差（这就是那个 2）。
- **修法：** 写明口径。

### NA-10 · Low · 「每页平均 error 条数」把不同计数单位的规则混在一起

- **问题：** T02、T04 每页最多算 1 条（`probe.ts:330-331` 汇总成一条），T11、T07、T06 每个元素各算一条。codex 对照组平均 27.1 条，大部分是 T11 逐个元素计出来的。
- **修法：** 加脚注说明计数单位，或者改报「每页命中的规则数」。

### NA-11 · Low · 局限里还缺两条

- 30 条提示词是本项目自己写的，6 类各 5 条，其中 5 条小红书卡片，skill 直接提供了模板（`assets/cards/`），外部效度有限；
- 完整档在断网下渲染（`render.ts:202-204`），web 字体加载不了，用回退字体测量行长。两组条件相同，不影响比较，但测出的绝对数字和线上不同。
- **修法：** 补进 §4。

### NA-12 · Low · 两处环境说明和实际不符

- claude 组的 `environment.log` 和 console 日志开头写的是 `--output-format json`（`run-baseline.mjs:83`），实际用的是 `stream-json`；
- 方案 §3 写的是 codex skill 放在 `HOME/.agents/skills/measure/`，实现放在 `$CODEX_HOME/skills/measure/`。实现的写法符合用户核验过的路径，代码注释里也写了，但方案和报告都没有标注这处偏离。
- **修法：** 改掉第 83 行的文字；在报告 §2 或 §4 注明方案的这处偏离。

---

## 3. 对报告 §6 四个问题的裁定

1. **N-01 运行后改口径：合理，没有把没读到 SKILL.md 的运行算进来。** 方案 §4 的原话是「stream-json 里要有读取 measure-skill/SKILL.md 的**工具调用**」，并没有限定 Read 工具。最初的实现比方案窄，修正之后才和方案一致。我逐次核对：30 次都有完整读取（21 次 Read、9 次 Bash，返回内容都含正文）。这次修改也不可能夸大结果：只用 21 次 Read 的结果是 19/21 零 error，30 次全算是 27/30 零 error；9 次 Bash 里还有一个失败页（012）。全部 30 次都算进来，等于按「意向处理」口径分析，比剔除未加载的运行更保守。遗留问题是检测器偏宽（NA-07，Low）。
2. **NS-06（隔离不完全）不影响结论。** 对照组没有泄漏，产物里没有引用用户目录，泄漏的途径和排版规则无关。但隔离核对漏了三处（NA-06：共用的 `CODEX_HOME` 会累积插件、memories 等状态；`$TMPDIR` 可写；claude 有搜索用户目录的尝试）。按 Medium 记台账，下一轮要修。
3. **N-04：**
   - ①「SKILL.md 应该要求跑完整档」：**方向对，但不是主要问题。** 3 个失败页里只有 012 是「只跑了基础档、漏掉了」；019、028 根本没跑 lint（NA-02），基础档本来就能抓到。根本原因是 SKILL.md 的「命令」一节只教了 `node <仓库>/…` 的写法，agent 找不到 CLI（claude 有 17/30 次）。建议：第 7 步改成「先 `command -v measure-cjk`；有就直接用；没有再用仓库路径」，并在第 7 步写明「能用 Playwright 时用 `lint --render`」（现在这句只在「命令」一节里）。改了 SKILL.md 之后，这次实验的数字不能再拿来代表新版 skill。
   - ②「T06 对单行元素报 error 是误报」：**是误报**。判定也前后不一致，见 NA-05。建议修复规则，但不要用修过的规则替换这次的主数字。
4. **§1 的表述：数字准确，有一处事实错误（NA-01），有一处说过头（NA-04）。** 建议对外这样写（三个数字必须一起出现）：
   > 同一个模型，各用 30 条中文页面需求测试。装上 measure 后，按 measure-cjk 完整档检查零 error 的页面：codex 从 0/30 升到 30/30，claude 从 0/30 升到 27/30。其中 T02、T04 两条规则是 measure 自己的标准，AI 默认不写；去掉这两条，claude 从 15/30 升到 27/30（配对符号检验 p = 0.0042），codex 从 0/30 升到 30/30。评分工具就是 measure 自己的校验器，所以这些数字说明的是「遵守 measure 规则的程度」，不是独立的审美评价。

   不要单独对外说「0% → 100%」，也不要说成「排版质量提升了 X 倍」。

---

## 4. 审计方亲自跑过的命令（都在 HEAD `8c817dd` 上执行，临时文件都放在 `/tmp`，结束后已删除）

| # | 命令 | 结果 |
|---|---|---|
| C1 | `git log --oneline -3 && git status --short` | HEAD `8c817dd`，工作树干净 |
| C2 | `npm run build` | 成功（`已同步 2 个文件到 packages/cli`，`tsc` 无报错；构建后 `git status` 仍然干净） |
| C3 | `node bench/northstar-compare.mjs --out ../../../../../../tmp/ns-check`，再用 python 和仓库里的 `results.json` 比较 | 输出：codex 排除后 0/30 → 30/30，30/0/0；codex 完整档 0% → 100%；claude 排除后 15/30 → 27/30，14/14/2，p = 0.0042；claude 完整档 0% → 90%，29/0/1。`identical except generated_at: True` |
| C4 | python 直接读 120 份 `lint-render.json` 独立重算，p 值用 `math.comb` 精确计算 | codex：配对 30/0/0，p = 1.86e-09；排除后 30/0/0；每页平均 27.13 → 0；没检查完的页 0。claude：配对 29/0/1，p = 5.77e-08；排除后 14/14/2，p = 0.0042；每页平均 7.07 → 0.27；没检查完的页 0。全部和报告一致 |
| C5 | 把 5 页产物复制到 `/tmp/ns-audit/relint/*/page`（去掉 `_evidence`），在页面目录里执行 `node packages/cli/bin/measure-cjk.js lint . --render --format json > …`，再和仓库里存的 `lint-render.json` 逐条比较 | codex-control/001：16 条 error，一致；codex-measure/028：0 条，一致；claude-measure/012：4 条，一致；claude-measure/028：3 条，一致；claude-control/015：2 条，一致。注：`--out` 写到工作区外会被拒绝（`错误：输出路径在工作区之外，已拒绝`），所以改为从标准输出取结果 |
| C6 | `python3 /tmp/ns-audit/claude_logs.py`：解析 claude 60 份 stream-json，把 tool_use 和 tool_result 对上 | 对照组：0 次读 SKILL.md、0 次调用 measure-cjk，日志里 0 处 `measure-cjk` 字样。实验组：30/30 完整读取（21 次 Read、9 次 Bash） |
| C7 | `python3 /tmp/ns-audit/claude_cli.py`：只统计 Bash 实际执行、没被拒绝的 `measure-cjk lint` | 13/30 跑过 lint，1/30 跑过 `--render`（见 NA-02） |
| C8 | `python3 /tmp/ns-audit/codex_logs.py`：只统计 codex 日志里 `exec` 块执行过的命令 | 对照组：0 次 cat SKILL.md，0 次 measure-cjk，日志里 0 处 `measure-cjk` 字样。实验组：30/30 cat 过 SKILL.md，29/30 跑过 lint（025 没跑），2/30 跑过 `--render`；028 执行过 `rg --files <仓库>`，并对仓库路径执行了 `require.resolve('playwright', …)` |
| C9 | 对照组日志里搜其他运行的临时目录名（`measure-baseline-*`、`measure-isolated-*`） | 0 条 |
| C10 | `grep -rl "/Users/" bench/runs/2026-W2-northstar-v3-*/*/output --include=*.html --include=*.css` | 0 |
| C11 | 统计各组产物里出现 `text-autospace` 的页数 | claude 实验组 30、codex 实验组 30、两个对照组都是 0 |
| C12 | `node /tmp/ns-audit/lines.mjs`：用系统 Chrome 测量 012、019、028 被 T06 报 error 的元素，宽度 360 和 1440 | 都是视觉上的单行元素（见 NA-05） |
| C13 | 读 012、019、028 的 `lint.json` | 012 基础档 0 error；019 基础档 1 条 T06 error；028 基础档 3 条 T06 error |
| C14 | `git log -- packages/cli/src` 对比 `isolation-checks.log` 里的正式开始时间 | CLI 最后一次改动在 2026-10-26 10:37 +0800，正式运行从 11:20 +0800 开始，评分用的构建前后一致 |
| C15 | 对照组 T04 的「实测行首标点」类 error | 两个对照组都是 0 页。排除 T04 没有顺带排除肉眼可见的行首标点问题 |

**核对过、没有发现问题的地方：** 四组 `001/agent.log` 的第一行命令。claude 两组的唯一差别是 `--append-system-prompt`，外加工作目录里多一个 `measure-skill/`。codex 两组命令完全相同，差别只在临时 `CODEX_HOME/skills/measure`。模型：codex 两组都是 `gpt-6-astra` ×30，claude 两组都是 `claude-opus-5-5` ×30。`copyOutputs` 不复制 `measure-skill/`，但没有一份产物引用了 `measure-skill/` 下的文件（028、030 只在注释里提到），所以评分没有因为缺文件而失真。

---

## 5. 开放决策清单（需要用户拍板）

1. **T06 修复后，要不要在这批产物上补算一列？** 推荐：只作为附加列，主数字不变；修复要等下一轮实验才计入。
2. **SKILL.md 改成先找 PATH 里的 `measure-cjk`、第 7 步要求跑完整档之后，要不要重跑 claude 实验组（30 次，消耗 claude 额度）？** 推荐：本轮不重跑。在报告里写明这次 claude 实验组只有 13/30 用上了校验器；等下次 skill 改版后的北极星实验，再一并重跑。

## 6. 执行方需要交回的审计响应矩阵

请逐条回应 NA-01 – NA-12（落实 / 不落实及理由 / 证据）。NA-01 和 NA-02 必须附上复核证据：修正后的 `results.json` 中的 `measure_used_cli_runs`（拆成 lint 和 render 两项）、报告 §1、§4、N-04 的 diff，以及对应命令的输出。
