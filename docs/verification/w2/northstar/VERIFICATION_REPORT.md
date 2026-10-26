# 分寸 · Measure（measure-cjk）W2 · 北极星实验报告

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 6 步「测试」→ 第 7 步「审计验收」 |
| 执行方 | Claude Code（用户指示全部由 Claude Code 闭环） |
| 方案 | `docs/verification/w2/NORTH_STAR_PLAN.md`（用户 2026-10-25 确认：每条提示词跑 1 次加配对比较，对照组按对等工具重跑 v3） |
| 机器结果 | `results.json`（`node bench/northstar-compare.mjs` 生成） |
| 原始数据 | `bench/runs/2026-W2-northstar-v3-{codex,claude-code}-{control,measure}/`：每条提示词的 agent 日志、产物、基础档和完整档的 lint 结果、`summary.json` |
| 审计规则 | 用户 2026-10-26 拍板：一轮独立审计；Blocker、High 必修并复核；Medium、Low 记台账 |
| 审计 | `audit/AUDIT_NORTHSTAR.md`（有条件达标：High 2、Medium 4、Low 6）→ 复核 `_r2`（有条件达标）→ `_r3`（**达标**，两条 High 关闭）；响应矩阵 `AUDIT_RESPONSE_NORTHSTAR.md`，Medium、Low 留在台账 |
| 和方案不一样的地方 | ① codex 的 skill 放在临时 `$CODEX_HOME/skills/measure/`，方案写的是 `HOME/.agents/skills`（后者不是 skill 的发现路径，按用户核验过的事实改）；② claude 两组用 `--output-format stream-json --verbose`，各组 `environment.log` 里沿用旧文字写的 `json` 是错的（NA-12） |

---

## 1. 结论

**装上 measure 之后，两个 agent 产出的中文页面在完整档下的零 error 比例都大幅上升，配对比较显著。但提升幅度要分开看：**

| | codex（gpt-6-astra） | claude（claude-opus-5-5） |
|---|---|---|
| 完整档零 error 页 | 0/30 → **30/30** | 0/30 → **27/30** |
| 配对比较（按完整档 error 条数） | 更好 30、一样 0、更差 0，p < 0.0001 | 更好 29、一样 0、更差 1，p < 0.0001 |
| **排除 T02、T04 后**的零 error 页 | 0/30 → **30/30** | 15/30 → **27/30** |
| **排除 T02、T04 后**的配对比较 | 更好 30、一样 0、更差 0，p < 0.0001 | 更好 14、一样 14、更差 2，p = 0.0042 |
| 每页平均完整档 error 条数 | 27.1 → 0 | 7.1 → 0.27 |

- **为什么要看「排除 T02、T04」：** 这两条是本项目自己定的标准（要写 `text-autospace` 和 `line-break: strict`），AI 默认几乎从不写，对照组 60 页全部踩中。只靠这两条，「0% → 100%」就会成立。排除之后剩下的规则（字号、字距、行长、行高、标点等）**也是 measure 自己定的阈值**，所以排除后的差距说明的是「对其余 measure 规则的遵守程度」，仍然不是独立的审美评价（NA-04）。
- **codex：** 提升在排除 T02、T04 之后依然完整。对照组的主要问题是字号太小（T11，30/30 页）、中文字距为负（T07，23/30 页）、行长超标（T05，9/30 页）；装上 skill 后完整档下这些都没有了。
- **claude：** 对照组本来就排得不错，排除这两条后有一半页面已经零 error。skill 让零 error 从 15 页提高到 27 页，配对比较显著（p = 0.0042），但幅度比表面数字小得多。
- **实验组用上校验器的比例不同（NA-02）：** codex 30 次都跑过 `measure-cjk lint`；claude 只有 13 次用上了命令行（这 13 次都跑了 lint），其余 17 次没找到命令——`SKILL.md` 教的是 `node <measure-cjk 仓库>/packages/cli/bin/measure-cjk.js` 的写法，agent 去搜仓库路径时被权限挡住（N-05）。这 17 次里仍有 15 次完整档零 error，其中 14 次带上了 `measure.css` 文件，另外 1 次（029）把同样的三条声明直接写进了页面（R2-02）：skill 的规则和 CSS 本身就起了大部分作用。
- **对外的写法：** 三个数字一起出现——全部规则、排除 T02 和 T04、配对比较——并注明「评分用的是 measure 自己的校验器」；不要单独说「0% → 100%」。
- **这是「遵守 measure 规则」的程度，不是独立的审美评价**（见 §4 第 1 条）。肉眼的前后对比放在第 3 步的对比图里。

## 2. 断言逐条

| 编号 | 内容 | 结果 | 证据 |
|---|---|---|---|
| NS-01 | 4 组各 30 次，全部产出页面，agent 退出码都是 0 | PASS | 各组 `summary.json` 的 `rows` |
| NS-02 | 实验组 skill 被加载：codex 30/30（日志里 `cat .../skills/measure/SKILL.md`）、claude 30/30（Read 或 `cat measure-skill/SKILL.md`，返回内容里有 SKILL.md 正文） | PASS | `summary.json` 的 `northstar.skill_loaded_runs`；检测方法的修正见 §2.1 |
| NS-03 | 对照组没有泄漏：日志里没有 `measure-skill`、`skills/measure/SKILL.md`，产物里没有 `measure.css`、`text-autospace` | PASS | `northstar.leak_runs`、`text_autospace_pages` 都为空 |
| NS-04 | 两组工具对等：PATH 里都有 `measure-cjk`；claude 都是 `--allowedTools "Bash(measure-cjk:*)"`；codex 都是 `workspace-write` | PASS | 各组 `001/agent.log` 第一行的命令 |
| NS-05 | 隔离：codex 凭证文件没被改，`~/.claude/projects` 没有新增目录 | PASS | `evidence/isolation-checks.log` |
| NS-06 | 隔离：日志里不出现用户目录路径 | **FAIL（不影响结果）** | 12 次运行的日志里出现了，原因和影响见 §2.1、`evidence/isolation-checks.log` |
| NS-07 | 主指标和配对比较由脚本从原始数据算出 | PASS | `results.json`；`bench/northstar-compare.mjs`；审计方从 120 份 `lint-render.json` 独立重算，结果一致 |
| NS-08 | 实验组用上了校验器（只认 agent 真正发出的命令，NA-02） | codex 30/30 跑过 lint；claude 13/30 | `summary.json` 的 `northstar.ran_measure_lint_runs`；检测方法见 N-06 |

### 2.1 实验过程中的问题

| 编号 | 问题 | 处理 |
|---|---|---|
| N-01 | 「skill 有没有加载」的检测最初只认 Read 工具，claude 实验组有 9 次用 Bash 的 `cat measure-skill/SKILL.md` 读取（claude 会自动放行只读命令），被误判成「没加载」，一度只有 21 次算进实验组 | 逐次核对这 9 次的工具返回内容，都含有 SKILL.md 正文（`name: measure`），对照组 0 次。检测改为「Read 或 Bash 读过、并且返回内容里有正文」，用 `--relint-only` 重新汇总（**没有重新生成页面**），30 次都算进实验组 |
| N-02 | claude 的 `--allowedTools "Bash(measure-cjk:*)"` 没有挡住 `ls`、`cat` 这类只读命令 | 两组条件一样，不影响对等；记为已知情况 |
| N-03 | codex 的隔离不完全：`workspace-write` 只限制写、不限制读。12 次运行的日志里出现用户目录路径，大多是 `which node` 或 `cat` 那个转发 measure-cjk 的 shim；codex 实验组第 028 次还列了一遍仓库文件，并运行了 `ls ~/Library/Fonts` 找字体 | 120 份产物里没有一份引用用户目录或仓库路径，028 号产物只写了 `"Noto Sans SC", sans-serif`。不影响结果，但如实记为 NS-06 FAIL |
| N-04 | claude 实验组有 3 页在完整档下报 T06（行高低于 1.5）：012 比对照组更差（按全部规则的主口径；排除 T02、T04 后 012、019 都更差，NA-09）。出问题的都是单行元素：价格标签行高 1.3、品牌名行高 1.4。**012 跑过 lint，但只跑了基础档，0 error，完整档实测才查出来；019、028 根本没跑 lint，基础档本来也会报这条 T06**（我原来写成「三页都只跑了基础档」，是错的，NA-02） | ① T06 对单行的 p、li 按正文行高报 error，审计方判为误报（NA-05），记入台账，修规则时不替换这次的主数字；② 让 agent 有浏览器时跑 `lint --render`，但前提是先解决 N-05 |
| N-05 | claude 实验组 17 次没用上校验器：`SKILL.md` 第 71–73 行教的是 `node <measure-cjk 仓库>/packages/cli/bin/measure-cjk.js …`，agent 去搜仓库路径（`find ~` 之类）被权限挡住，没想到直接用 PATH 里的 `measure-cjk` | skill 本身的缺陷，记入台账：`SKILL.md` 改成「先 `command -v measure-cjk`，有就直接用；没有再用 `node <仓库>/…` 或 `npx`」。这次的实验数据不重算，改版后的下一次实验再验证 |
| N-06 | 「用过 measure-cjk」的检测最初在整份日志里搜关键词，`SKILL.md` 正文里本来就有命令示例，读过就会命中，报成了实验组 30/30 都用过（NA-02） | 改成只认 agent 真正发出的命令：codex 按完整的命令块解析（以单独一行 `exec` 开头，可以跨行，单双引号都认），claude 认 Bash 工具调用的 `command` 字段。用 `--relint-only` 重新汇总，不重新生成页面。第一次改的时候 codex 只认单引号、只看第一行，漏掉了 025 号用双引号写的多行命令，算成 29/30；复核时更正为 30/30（AUDIT_NORTHSTAR_r2 R2-01） |

## 3. 依赖与 license

- 没有新增依赖。
- 用到本机的 codex-cli 0.154.0 和 Claude Code 2.1.296，消耗了用户的额度：120 次正式运行，加 4 次冒烟测试。
- 用时中位数：codex 对照组 147 秒、实验组 166 秒；claude 对照组 72 秒、实验组 110 秒。

## 4. 已知局限

1. **评分和练习用的是同一把尺。** 评分用 `measure-cjk`，而实验组的 agent 有一部分在生成过程中自己跑过它、照着改（codex 30/30，claude 13/30）。所以这组数字衡量的是「遵守 measure 规则」的程度。这正是 PRD §4.1 定义的北极星，但它不能证明页面在人眼看来更好，后者要靠第 3 步的前后对比图。
2. **处理组是捆绑的（NA-03）：** 「装 measure」同时带来了规则文档、`measure.css` 和校验器自检三样东西，这次的设计分不出各自的贡献。claude 没用上校验器的 17 次也有 15 次零 error，只能说明「规则加 CSS」已经起了大部分作用，不是严格的拆分实验。
3. **T02、T04 主导了表面数字**（§1）。对外只报「0% → 100%」会误导。
4. **每条提示词只跑了 1 次**，没有组内方差（方案 §5 已说明）。
5. **只在同一个 agent 内比较**：claude 实验组测的是 skill 内容本身（用 `--append-system-prompt` 提示去读），codex 实验组测的是真实触发。两个 agent 之间不能直接比。
6. **隔离不完全**（N-03）。
7. **提示词是本项目自己写的**（30 条，6 类页面），外部效度有限；其中 5 条是小红书卡片，skill 直接提供了卡片模板，这一类的提升有一部分来自模板（NA-11）。
8. **完整档在断网下渲染**，页面引用的网络字体加载不了，用的是本机的回退字体（NA-11）。
9. **「每页平均 error 条数」混了两种计数单位**：T02、T04 按页面计 1 条，其余规则按元素逐个计（NA-10），只作参考，不作主指标。
10. **隔离还有三处没做到**（NA-06）：codex 一组 30 次共用同一个临时 `CODEX_HOME`，运行中会累积插件缓存和 memories 数据库，两次运行之间是否读写过，待确认；codex 沙箱对 `$TMPDIR` 可写，并发运行之间理论上能互相读写；claude 有几次试图搜索用户目录，被权限挡住。
11. **完整档的截图不进 git**：约 1000 张、25 MB，`lint-render.json` 里引用的截图可以用 `node bench/run-baseline.mjs --agent <a> --isolated --arm <m> --relint-only` 重新生成。

12. **T11 判断小红书卡片的口径有问题（AUDIT_SHOWCASE_r2 R2-01，展示页台账 N-SC1）。** claude 对照组有 5 页卡片（026–030），排除 T02、T04 后只剩 T11；卡片按 1080×1440 导出成图，按卡片自身宽度换算后最小汉字都在 18.7px 以上，可能不算违规。如果这 5 页不算违规，claude「排除 T02、T04」的零 error 从 15/30 → 27/30 变成 20/30 → 27/30，配对比较从更好 14、一样 14、更差 2（p = 0.0042）变成 9、18、3（p ≈ 0.146），**不再显著**。codex 有 1 页受影响，仍然显著（p < 0.0001）。卡片的导出宽度是假设，这是敏感性估算；主数字不改，是否补算附加列交用户拍板（`open_decisions.json` N-D3）。

## 5. 伪成功扫描

- 主指标由脚本从原始的 `lint-render.json` 算出，没有手填数字。
- 「skill 加载」的口径在运行之后改过一次（N-01）：改口径之前，我逐次核对过工具返回的内容；改动只影响分组统计，不影响任何一页的 lint 结果。
- 对照组的泄漏检查为 0；实验组的 skill 加载按日志里实际的读取记录判定，不按「有没有安装」判定。

## 6. 需要审计方裁定的问题

1. N-01 的口径修正是否合理（运行之后才改检测方法）。
2. NS-06（隔离不完全）是否影响结论。
3. N-04 的两个改进方向：SKILL.md 是否要求跑完整档；T06 对单行元素的判定是否算误报。（审计方已裁定，见 `AUDIT_RESPONSE_NORTHSTAR.md`）
4. §1 的表述是否恰当，特别是对外宣传时怎么写这组数字。

## 7. 下一轮建议

1. 一轮独立审计（按用户定的新规则）。
2. 第 3 步：从这批产物里挑 10 组前后对比图，做展示页。同一条提示词的对照组和实验组各一页，正好是真实的前后对比。
3. N-04 的改进项，等审计意见后决定。
