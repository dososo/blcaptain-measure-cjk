# 北极星实验 · 整改复核（AUDIT_NORTHSTAR_r2）

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」，High 整改复核 |
| 复核对象 | HEAD `ae3a60c`（工作树干净）；`AUDIT_RESPONSE_NORTHSTAR.md`；`VERIFICATION_REPORT.md` 的 §1、§2 NS-08、§2.1 N-04 至 N-06、§4；`bench/run-baseline.mjs` 的 `used_measure_cli` 和 `ran_measure_lint`；`results.json`；各组 `summary.json` |
| 范围 | 按用户的规则，只复核 High（NA-01、NA-02）；顺带核对 Medium、Low 的台账登记是否属实 |

---

## 1. 结论：**有条件达标**

| 编号 | 复核结果 |
|---|---|
| NA-01 | **关闭** |
| NA-02 | **未完全关闭**：claude 部分已关闭；codex 的数字和检测器还有 1 处错误（见 R2-01） |

**必须说明：** codex「29/30」这个错误数字最早出自我在 AUDIT_NORTHSTAR 里的 NA-02。我当时解析 codex 日志，只看了每个 `exec` 块的第一行，所以漏掉了 025。执行方的新检测器有同样的盲区，所以「和审计方核对的一致」。错误出在审计方；改正它是 NA-02 的剩余部分。

---

## 2. 逐条复核

### NA-01 · 关闭

- 报告 §1 已经改成「字号太小（T11，30/30 页）、中文字距为负（T07，23/30 页）、行长超标（T05，9/30 页）」，和 AUDIT_NORTHSTAR C4 的重算一致（codex 对照组：T11 30、T07 23、T05 9）。
- 在全文搜索规则编号，没有发现其他编号和含义对错的地方。

### NA-02 · 未完全关闭

**已经做对的部分：**
- claude 的检测：`"name":"Bash","input":{"command":…}` 只取实际发出的 Bash 调用。我用另一种方法独立解析：把 stream-json 里的 tool_use 和 tool_result 对上，排除被权限拒绝的调用。逐次比较的结果和 `summary.json` 完全一致：`used_measure_cli` 13、`ran_measure_lint` 13，**逐次不一致 0 处**。没跑 lint 的 17 次是 002、003、004、006、007、008、011、013、018、019、020、021、022、023、027、028、029。
- 对照组：两个 agent 的对照组都是 `used_measure_cli` 0、`ran_measure_lint` 0，我的独立解析也是 0。
- N-04 的改正（012 只跑了基础档，019、028 没跑 lint，基础档本来也会报 T06）、N-05、§4 第 1 条和 1a：都和日志相符。
- `results.json` 只有 `generated_at` 和 claude 的 `measure_used_cli_runs`（30 → 13）变了。用新的 `--out` 绝对路径重算，结果和仓库里的除 `generated_at` 外一致。

**R2-01（NA-02 的剩余部分，High）：codex 实验组实际是 30/30 跑过 lint，不是 29/30；检测器漏掉了用双引号写的多行命令**

- **位置：** `bench/run-baseline.mjs:271`：`log.match(/^\/bin\/zsh -lc '.*$/gm)`；报告 §1「codex 30 次里有 29 次跑过」、NS-08「codex 29/30」、§4 第 1 条「codex 29/30」、N-06「codex 认 `/bin/zsh -lc '…'` 命令行」；`AUDIT_RESPONSE_NORTHSTAR.md` 的 NA-02 一行。
- **问题：** 这个正则只认用单引号写的命令，而且只取第一行。codex 日志里有 117 行是 `/bin/zsh -lc "…"`（双引号）开头的命令；agent 常在 heredoc 写完文件后，在同一个命令的最后一行跑 lint。025 号运行就这样跑过两次 `measure-cjk lint`，两次都成功（`succeeded in 0ms`、`succeeded in 54ms`，并输出了 lint 的 JSON）。
- **证据（复核方实跑）：**
  ```
  $ node -e '…用 run-baseline.mjs:271 的正则检测 025 号日志…'
  detector cmds: 6 ran_lint: false
  exec blocks containing measure-cjk lint: 2 [
    `/bin/zsh -lc "cat > index.html <<'EOF' … measure-cjk lint index.html --format json"`,
    `/bin/zsh -lc "python3 - <<'PY' … measure-cjk lint index.html --format json"`
  ]
  $ python3 /tmp/ns-r2/check.py   # 按完整 exec 块解析（多行、单双引号都认）
  codex summary used_cli 30 ran_lint 29
   mine: cli 30 lint attempted 30 lint ok 30 render 2
   per-run mismatches (used_cli/ran_lint): ['025']
  ```
- **为什么是问题：** 报告和 `summary.json` 里仍然有一个错误的数字，检测器也还会在下一次实验里漏判。对结论的影响很小（codex 的「自检闭环」从 29/30 变成 30/30），但 High 必须完全落实。
- **修法：**
  1. codex 的命令按完整的 `exec` 块解析：从 `exec\n` 到 ` in <工作目录>` 为止，可以跨行，单引号、双引号都认。
  2. 用 `--relint-only` 重新汇总 codex 实验组，确认 `ran_measure_lint_runs` 为 30。
  3. 把 §1、NS-08、§4 第 1 条的「29/30」改成「30/30」，把 N-06 的检测方法描述改成新写法；同时改正响应矩阵 NA-02 那一行。
  4. 顺带建议（不计入 High）：在 `northstar-compare.mjs` 的 `checks` 里加 `measure_ran_lint_runs` 和 `--render` 次数（codex 2/30、claude 1/30），这样 `results.json` 一个文件就能复核 NS-08。

---

## 3. 报告里残留的其他错误说法

| 编号 | 级别 | 位置 | 问题 | 修法 |
|---|---|---|---|---|
| R2-02 | Low | 报告 §1 第 4 个要点、§4 第 1a 条 | 「这 17 次里仍有 15 次完整档零 error，并且都用上了 `measure.css`」：15 次里 14 次的产物里有 `measure.css` 文件；029 是小红书卡片，没有 `measure.css` 文件，只在页面里内联了 `:where(:lang(zh)) { line-break: strict; font-synthesis-style: none; text-autospace: normal; }` 一行（028 也是这样，但它是失败页） | 改成「都用上了 `measure.css`，或者卡片模板里内联的同样声明」 |
| R2-03 | Low | 报告 §4 的编号 | 第 1a 条、第 6a–6d 条插在第 1 条和第 6 条之间，第 6 条在 6a–6d 后面，编号顺序乱了 | 重新编号 |

以上记入台账，不影响 High 的判定。

## 4. Medium、Low 台账登记核对

逐条对照 `AUDIT_RESPONSE_NORTHSTAR.md` 和报告的实际改动：

- NA-03、NA-04、NA-06、NA-09、NA-10：登记属实，报告里有对应的段落。
- NA-05、NA-07：登记为后续任务，属实。
- NA-08：属实。实测 `--out /tmp/ns-r2/out` 写到了 `/tmp`，仓库里没有出现 `tmp/`，结果和仓库里的除 `generated_at` 外一致。
- NA-12：属实（`run-baseline.mjs:83` 已改；报告抬头已更正）。
- NA-11：基本属实，但第 6a 条漏了原发现里的「其中 5 条小红书卡片，skill 直接提供了模板」。请补上，不影响判定。
- 没有发现把没做的事登记成已落实的情况。

## 5. 复核方亲自跑过的命令（临时文件都在 `/tmp/ns-r2`，结束后已删除）

| # | 命令 | 结果 |
|---|---|---|
| V1 | `git log --oneline -3 && git status --short` | HEAD `ae3a60c`，工作树干净 |
| V2 | `git diff 8c817dd HEAD -- bench/run-baseline.mjs bench/northstar-compare.mjs docs/verification/w2/northstar/results.json` | 代码改动和响应矩阵描述的一致；`results.json` 只变了 `generated_at` 和 claude 的 `measure_used_cli_runs` |
| V3 | `git diff 8c817dd HEAD -- 'bench/runs/*lint*.json'`，把时间戳归一后统计改动的行 | 240 份 lint 结果只改了 `started_at`，findings 没变 |
| V4 | `python3 /tmp/ns-r2/check.py`：claude 按 tool_use 和 tool_result 配对解析；codex 按完整 exec 块解析；逐次和 `summary.json` 比较 | claude：13/13，逐次一致；codex：`summary.json` 是 29，独立解析是 30，不一致的是 025 |
| V5 | 用 `run-baseline.mjs:271` 的正则在 Node 里检测 025 号日志，再和完整 exec 块的解析对比 | 正则：`ran_lint: false`；实际有 2 个成功执行的 exec 块含 `measure-cjk lint` |
| V6 | `grep -c '^/bin/zsh -lc "'`，统计 codex 实验组日志 | 117 行双引号命令 |
| V7 | 对照组用同样方法解析 | 两个 agent 的对照组都没有任何一次真正调用 `measure-cjk` |
| V8 | 检查 claude 17 次没跑 lint 的产物：有没有 `measure.css` 文件、有没有 `@layer measure`、完整档 error 条数 | 15 次零 error；029 没有 `measure.css` 文件，只有内联的三条声明（R2-02） |
| V9 | `node bench/northstar-compare.mjs --out /tmp/ns-r2/out`，再和仓库里的 `results.json` 比较；`ls tmp` | 除 `generated_at` 外一致；仓库里没有 `tmp/` |
| V10 | 在报告里搜「30/30」「29/30」「13/30」 | 「29」出现在第 31 行（§1）、第 46 行（NS-08）、第 67 行（§4 第 1 条） |

## 6. 下一步

执行方落实 R2-01，交回：新的检测代码、codex 实验组 `summary.json` 里的 `ran_measure_lint_runs: 30`、报告和响应矩阵的 diff。R2-01 是对 NA-02 剩余部分的机械修正：复核方核对这几处改动，并重跑 V4 的逐次比较。没有发现别的问题，就把 NA-02 改判为关闭，整体结论改判为达标。
