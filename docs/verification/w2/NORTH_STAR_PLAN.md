# 北极星实验方案（修订版，回应 AUDIT_W2_C20_r2 R2-01）

**状态：用户已确认（2026-10-25）。** 原话：「确认 PRD_R2_PROPOSAL 的两处修正。北极星方案按推荐：等完整档做完再跑，对照组按对等工具重跑 v3，每条提示词跑 1 次加配对比较。接下来开始做完整档。」决定：等完整档做完再跑；对照组按对等工具重跑 v3；每条提示词跑 1 次，加配对比较。

## 1. 要回答的问题

PRD §4.1：同一个 agent、同一个模型，在「不装 skill」和「装 skill」两种条件下各生成一次，用 `measure-cjk lint --render` 检查产物，统计零 error 页面的比例。

## 2. 什么时候跑

**等完整档（`--render`，Playwright）做完之后再跑，只跑一次。**

PRD 规定北极星要用完整档检查，现在只有基础档。如果现在用基础档先跑，完整档做出来以后还得重跑一遍，会白白多花一轮额度。基础档的数字可以作为补充指标，在同一批产物上一起算出来。

## 3. 两组怎么设

原则：**同一个 agent 的两组，只差「有没有 measure」这一个变量。** 工具权限、CLI 能不能用、隔离方式都一样。

| | claude 对照组 | claude 实验组 | codex 对照组 | codex 实验组 |
|---|---|---|---|---|
| 隔离 | `--safe-mode --disable-slash-commands --no-session-persistence` | 同左 | 临时 `HOME`、`CODEX_HOME`，顶层配置按白名单对齐 | 同左 |
| 工具权限 | `--permission-mode acceptEdits --allowedTools "Bash(measure-cjk:*)"` | 同左 | `workspace-write` 沙箱 | 同左 |
| 校验器 | `PATH` 里有 `measure-cjk`（指向仓库的本地 CLI） | 同左 | 同左 | 同左 |
| measure | 没有 | 把 `skills/measure/` 整个复制进工作目录的 `measure-skill/`，并用 `--append-system-prompt` 加一句：「本目录的 measure-skill/ 是中文排版 skill；生成含中文的页面时，先读 measure-skill/SKILL.md 并照做。」 | 没有 | 把 `skills/measure/` 放进临时 `HOME/.agents/skills/measure/`，由 codex 自己发现并触发 |
| 输出格式 | `--output-format stream-json --verbose`，用来核对 agent 读了哪些文件 | 同左 | 日志 | 日志 |

**为什么两个 agent 的「装 skill」方式不一样：**
- claude 在不登录新配置目录的前提下，没办法只加载 measure 一个 skill（已实测：`--safe-mode` 下 `--plugin-dir` 加载不了；`CLAUDE_CONFIG_DIR` 会导致未登录）。所以 claude 实验组测的是 **skill 内容本身**的效果。
- codex 实验组测的是**真实触发**。
- **因此只在同一个 agent 内比较两组，不做跨 agent 比较。**

**对照组需要重跑**：v2 对照组当时没有给 Bash 权限，`PATH` 里也没有 `measure-cjk`，和实验组的工具不对等。按上表重跑一次（记为 v3）。

## 4. 每次运行都要检查的事

1. **skill 有没有被加载。**
   - codex 实验组：`agent.log` 里要读取过 `measure/SKILL.md`；
   - claude 实验组：stream-json 里要有读取 `measure-skill/SKILL.md` 的工具调用。
   - 没加载的运行单独记一类，**不算进实验组**，并在报告里列出次数。
2. **对照组没有泄漏。** 对照组的日志和产物里，不能出现 `measure-skill`、`measure.css`、`text-autospace`。
3. **隔离仍然有效。** 日志里没有用户目录路径；`~/.claude/projects` 不新增目录；codex 凭证文件的修改时间不变。
4. **路径问题。** 工作目录先转成真实路径再传给 `-C`（R2-08），看 codex 的 patch rejected 是否消失。

## 5. 统计方法

- **主指标**：完整档下零 error 页面的比例，两组各 30 页。
- **配对比较**：同一条提示词在两组里各有一页，统计「实验组更好、一样、更差」各有几条，并做符号检验。每条只跑一次时，这个比较比直接比比例更有说服力。
- **补充指标**：基础档的零 error 率；排除 T02 和 T04 后的零 error 率；每页的平均 error 条数；各规则的命中页数。
- **局限**：每条提示词只跑一次，没有组内方差；`--render` 的结论只在完整档做完后才有。

## 6. 成本

每个 agent 两组各 30 页，一共 120 次运行，其中 60 次是重跑对照组。按这次的耗时估算：codex 每页约 2 分钟，claude 每页约 1 分钟；按并发 3 算，总共大约 1.5 小时。会用到用户本机 codex 和 claude 的额度。

## 7. 开放决策

1. **每条提示词跑几次？** 推荐 1 次加配对比较，成本最低。也可以每条跑 3 次，用来估计组内方差，成本是 3 倍。
2. **北极星是否等完整档做完后再跑？** 推荐等。
