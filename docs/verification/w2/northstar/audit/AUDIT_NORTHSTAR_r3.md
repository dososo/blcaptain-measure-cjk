# 北极星实验 · R2-01 复核（AUDIT_NORTHSTAR_r3）

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」：复核 NA-02 剩下的 R2-01 |
| 复核对象 | HEAD `a4062fb`（工作树干净）：`bench/run-baseline.mjs` 中 codex 命令块的解析；各组 `summary.json`；`results.json`；`VERIFICATION_REPORT.md` 的 §1、NS-08、N-06、§4；`AUDIT_RESPONSE_NORTHSTAR.md` 的 §4 |
| 范围 | 只复核 R2-01。R2-02、R2-03、NA-11 的补充顺带看了一眼，不另行判定 |

---

## 1. 结论：**达标**

- **R2-01 关闭，NA-02 关闭。** 加上 AUDIT_NORTHSTAR_r2 已经关闭的 NA-01，两条 High 都已关闭。Medium、Low 按用户的规则记在台账里。
- 我用另一种写法解析命令块，对四组 120 次运行逐次比较，和 `summary.json` 没有一处不一致：codex 实验组 30/30、对照组 0/30；claude 实验组 13/30、对照组 0/30。

## 2. 逐次比较

**执行方的写法：** 从单独一行 `exec` 开始，到 ` succeeded in …` 或 ` exited N in …` 那一行结束。

**复核方的写法：** 从 `exec` 下一行的 `/bin/zsh -lc ` 开始，到命令末尾的引号加 ` in <工作目录>` 结束，同时记下这条命令的结束状态。也就是用命令文本自身的结尾来切分，不依赖结果行。claude 照旧用 stream-json 的 tool_use 解析。

```
$ python3 /tmp/ns-r3/check.py
codex control  summary used_cli 0  ran_lint 0  | mine used_cli 0  ran_lint 0  | blocks/cmds 81  | mismatches []
codex measure  summary used_cli 30 ran_lint 30 | mine used_cli 30 ran_lint 30 | blocks/cmds 279 | mismatches []
  025 lint block endings: ['succeeded', 'succeeded']
claude-code control summary used_cli 0  ran_lint 0  | mine used_cli 0  ran_lint 0  | blocks/cmds 1   | mismatches []
claude-code measure summary used_cli 13 ran_lint 13 | mine used_cli 13 ran_lint 13 | blocks/cmds 175 | mismatches []
```

**命令块切分的完整性：** 用执行方的切分规则，统计「找不到结束行的命令块」。

```
control exec lines 81  unterminated blocks 0
measure exec lines 279 unterminated blocks 0
```

两种写法切出的命令块数相同（81 和 279），所有命令块都有结束行，切分没有漏掉命令。

## 3. 其他核对

| # | 检查 | 结果 |
|---|---|---|
| V1 | `git log --oneline -3`、`git status --short` | HEAD `a4062fb`，工作树干净 |
| V2 | `git diff HEAD~1 HEAD -- 'bench/runs/*/summary.json'`，只看实质改动的行 | 只有 codex 实验组：`ran_measure_lint_runs` 29 → 30，025 的 `ran_measure_lint` false → true；codex 对照组只变了 `generated_at` |
| V3 | `git diff HEAD~1 HEAD -- 'bench/runs/*lint*.json'`，把时间戳归一后统计改动的行 | 120 份文件只改了 `started_at`，findings 没变 |
| V4 | `node bench/northstar-compare.mjs --out /tmp/ns-r3/out`，再和仓库里的 `results.json` 比较 | 除 `generated_at` 外一致 |
| V5 | 在报告和响应矩阵里搜「29/30」「29 次」 | 报告里已经没有了。§1、NS-08、N-06、§4 第 1 条都改成了 codex 30/30。N-06 写清楚了第一次漏判的原因 |
| V6 | 在报告和响应矩阵里搜旧编号「6a–6d」「1a」 | 已经没有。§4 按 1–11 重新编号，响应矩阵里没有残留的旧编号 |
| V7 | R2-02、NA-11 补充 | §1 改成「14 次带了 `measure.css` 文件，029 把同样的三条声明直接写进了页面」，和 r2 V8 的核对一致；§4 第 7 条补上了 5 条小红书卡片和模板 |

## 4. 台账补记（Low，不影响结论）

- **R3-01 · Low · 位置：** `AUDIT_RESPONSE_NORTHSTAR.md` 中 NA-02 那一行的「怎么落的」第 ① 点。
  - **问题：** 那里仍然写着「codex 认 `/bin/zsh -lc '…'` 命令行」，这是第一次整改时的旧写法。同一行第 ② 点和 §4 的 R2-01 行已经写明改成了按完整命令块解析，所以只是描述过时，不影响数字。
  - **修法：** 改成「codex 按完整命令块解析」，或者加注「见 §4 R2-01」。

## 5. 复核方跑过的命令

见 §2 和 §3。临时文件都在 `/tmp/ns-r3`，结束后已删除。没有修改任何已提交的文件。
