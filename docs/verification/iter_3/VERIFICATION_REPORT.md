# 分寸 · Measure（measure-cjk）W1 · 验证报告（iter_3）

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 4–5 步「开发、验证」，针对复核审计的整改轮 |
| 执行方 | Claude Code |
| 审计方 | 独立审计子 agent。iter_2 复核报告：`docs/verification/iter_2/audit/AUDIT_iter2.md`，结论「未达标」 |
| 机器判定 | `docs/verification/iter_3/results.json`（`node scripts/verify.mjs --iter 3`，在干净的工作树上运行） |
| 证据 | `docs/verification/iter_3/evidence/`；整改前的失败清单：`evidence/iter3-tests-before-fix.log` |
| 回交包 | `deliverables/measure-cjk_delivery_iter_3.zip`，阅读顺序见仓库根目录的 `README_PACKAGE.md` |

---

## 1. 结论

**机器判定：未达标。原因只有一个：D-1 到 D-4 还在等你拍板。**

- **工程部分全部通过**：任务门 PASS（V-01 到 V-13）；回归门 PASS（151 个测试，失败 0）；伪成功扫描未发现。
- **为什么不是「有条件达标」**：按任务包契约 §9 和复核审计 A-36，「有条件达标」只适用于环境受阻（BLOCKED_ENV）。用户还没拍板的事项，涉及 H14 等契约条款是否被违反，所以只能判「未达标」，并逐条列在 `verdict_blockers` 里。
- **执行方不能自己把这些事项改成已拍板**：`open_decisions.json` 里的事项，必须附上你的原话和日期，`verify.mjs` 才会认。
- **你拍板之后**：执行方把你的原话填进 `open_decisions.json`，在干净的工作树上重跑 `verify.mjs`，就能得到「达标」，或者在你要求重跑基线时得到相应的结论。

AUDIT_iter2 共 12 条新发现，外加 4 条「部分落实」：
- 已落实 13 条；
- 部分落实 1 条：A-38 是设计问题，需要你拍板；
- 待你决定 2 条：A-36 的授权部分、A-42 的出处追查。

逐条见 §9。

---

## 2. 断言逐条表

| ID | 内容 | 结果 | 说明 |
|---|---|---|---|
| V-01 | skill 格式与字体授权表 | PASS | 38 项 |
| V-02 | 没有字体文件 | PASS | — |
| V-03 | golden 20 页 | PASS | 0 个页面有 error，3 个 warn |
| V-04 | 规则的反例和正例 | PASS | 见 `evidence/V-04.log` |
| V-05 | 零网络请求 | PASS | — |
| V-06 | 路径安全 | PASS | 另见 `test/iter3.test.js` 的 A-35 测试 |
| V-07 | `--render` 返回 2 | PASS | — |
| V-08 | fonts 查询 | PASS | — |
| V-09 | CLI 行为 | PASS | — |
| V-10 | `measure.css` 与 PRD §7.4 逐字一致 | PASS | PRD 已恢复到 `3b4dafb` 的版本，§7.4 没有改动 |
| V-11 | 性能 | PASS | golden 和真实页面 p95 都远低于 2 秒；超大页面 B（449 KB，1500 条行高、字距规则）用时约 2.5 秒，**超过「单页 2 秒」**，但在耗时上限以内。2 秒门槛只适用于 golden 和真实页面（A-41） |
| V-12 | 7 份 MANIFEST 锁定 | PASS | 新增 iter3 |
| V-13a | codex 用户环境基线 | PASS | 30/30 页产出 |
| V-13b | claude-code 用户环境基线 | PASS | 30/30 页产出；由 Claude Code 代跑，待追认（D-4） |
| V-14 | 回归门 | PASS | 151 个测试，失败 0 |

---

## 3. 基线数据

**口径：** 和 iter_2 一样，是「用户环境基线」。实际加载的 skill 和模型见 `summary.json` 的 `environment_observed`。

| 规则版本 | agent | 零 error | 排除 T02/T04 后零 error | 各规则命中的页面数（error） |
|---|---|---|---|---|
| iter2 | codex | 0/30 | 4/30 | T02 30、T04 30、T11 25、T07 14、T13 7、T03 4、T08 1、T06 1 |
| iter3（当前） | codex | 0/30 | 4/30 | 同上（页面级没有变化） |
| iter2 | claude-code | 0/30 | 18/30 | T02 30、T04 30、T03 11、T11 2、T13 1、T08 1 |
| iter3（当前） | claude-code | 0/30 | 18/30 | 同上 |

**A-32 的影响：** `aria-hidden` 但看得见的文字恢复检查之后，codex 有 8 页、共 26 条 T11 error 回来了（复核审计统计的数字）。因为这些页面本来就有别的 error，所以页面级的命中数没有变。这一点正好说明，只看页面级统计会掩盖条目级的变化。

更早的三版数字（原始、C9 之后、iter2）见 `docs/verification/iter_2/VERIFICATION_REPORT.md` §3。

---

## 4. 依赖与 license 清单

没有变化：运行时依赖是 MIT、BSD-2、BSD-3、ISC；开发依赖是 Apache-2.0、MIT；没有 GPL 类依赖，没有字体文件。详见 `NOTICE`。

---

## 5. 已知局限

1. 基础档的层叠计算是近似的：不计算 `calc()`、`clamp()`；除 `not (…)` 之外的 `@supports` 条件一律视为成立。
2. **`measure.css` 不分层，会盖过 `@layer` 里的样式（A-38）。** 已在 SKILL.md 和 README 里如实说明；是否改成 `@layer measure`，等你拍板（D-9）。
3. **`:where(:root:lang(zh))` 在 `<html lang="en">` 的中英混排页面上不生效**（RULING-02 牵出的问题），等 W2 和 D-9 一起评估。
4. **超大页面可能超过 2 秒**：只受 20 秒的单页上限约束，超时后结论是 `incomplete`，退出码 2。
5. **前缀匹配是启发式的**：`FZ`、`HY` 要求后面紧跟大写字母；文件名只按 `filename_prefixes` 匹配。前缀只是字体名到授权表条目的映射规则，不是授权结论。

---

## 6. 伪成功扫描

方法和 iter_2 相同（5 组扫描，`evidence/pseudo-success-scan.log`），结果：未发现。

这一轮修掉的伪成功：
- **A-34**：页面超时没检查完，原来判「通过」，现在判 `incomplete`；
- **A-36**：执行方可以自己把开放决策改成 `resolved` 让结论升级，现在必须附上你的原话和日期；
- **A-43**：一条断言在 0 条结果时也会通过，已改为要求至少命中一条。

---

## 7. 需要审计方裁定的问题

1. **RULING-02、RULING-03**：审计方在 iter_2 复核中已同意，台账已更新为照录审计方结论（见 `RULINGS.md`）。
2. **PRD 变更提案 C10–C20**：`docs/verification/PRD_CHANGE_PROPOSALS.md`。PRD 已撤回到 iter1 审计时的版本，等 D-1。
3. **待你拍板、影响结论的事项**：D-1 到 D-4（`open_decisions.json`）。
4. **待你拍板、不影响结论的事项**：D-5 到 D-10。

---

## 8. 下一轮建议（只写和 W2 直接相关的）

1. **先决定 D-9**，再动 `measure.css`。如果改成 `@layer measure`，要同步更新 PRD §7.4 和 V-10，再新增「Tailwind v4 不被覆盖」的夹具，**先锁定，再实现**。
2. **在隔离环境下重跑「不装 skill」的对照组**（D-3），再跑「装 measure」组。
3. **完整档上线后，在真实浏览器里复核** RULING-01 到 03、`@layer`、`aria-hidden` 和 `:root:lang(zh)` 在混排页面上的行为。

---

## 9. 审计响应矩阵（AUDIT_iter2）

| 发现 | 严重度 | 状态 | 落在哪 | 怎么落的 | 证据 |
|---|---|---|---|---|---|
| A-32 | High | 已落实 | `rules.ts` 的 `isHidden` | 去掉 `aria-hidden`；只认 `hidden`、`display: none`、`sr-only` 一类的类名 | `iter3/T11-neg-aria-hidden-visible-A32`（修复前失败） |
| A-33 | High | 已落实 | `rules.ts` 的 `checkFontFaces` | `data:` URI 按自托管处理，按字体族名匹配授权表 | `iter3/F03-neg-data-uri-commercial-A33`（修复前失败）、`F03-pos-data-uri-embeddable-A33` |
| A-34 | Medium | 已落实 | `rules.ts` 的 `pageBudgetMs`；`lint.ts` | 超时后 `status: incomplete`，退出码 2；`MEASURE_PAGE_BUDGET_MS` 只能调低（0 到 20000），越界时退出码 2 | `test/iter3.test.js` 的两条 A-34 测试，用环境变量模拟超时 |
| A-35 | Medium | 已落实 | `fsafe.ts` 的 `safeOutPath`；`cli.ts` | 拒绝覆盖 `package.json`、`package-lock.json`、`measure.config.json`、`licenses.json`、`tsconfig.json`，以及本次读取的配置文件；已有 `.json` 只有是 measure-cjk 的结果文件才允许覆盖 | 测试「A-35」 |
| A-36 | Medium | 部分（授权部分待你决定） | PRD 已恢复到 `3b4dafb`；`docs/verification/PRD_CHANGE_PROPOSALS.md`；`verify.mjs` | 撤回 C10–C17，改为提案；未拍板的事项判「未达标」；`resolved` 必须带 `user_quote` 和 `resolved_on` | 测试「A-36」；`results.json` 的 `verdict_blockers` |
| A-38 | Medium | 部分（设计问题，待 D-9） | `SKILL.md` 第 4 步、`README.md`「已知设计问题」 | 如实说明 `measure.css` 会盖过 `@layer` 里的样式；PRD §7.4 的锁定代码块没有动 | `PRD_CHANGE_PROPOSALS.md` 的 C20 |
| A-37 | Low | 已落实 | `fonts.ts` 的 `prefixMatches`；`licenses.json` | 统一规则：两个字母的拉丁前缀后面必须紧跟大写字母；汉仪加 `HY`；新增 `filename_prefixes`（`fz`、`hanyi`） | 测试「A-37」（`HYQiHei` 能命中，`Hyperlegible` 不误伤） |
| A-39 | Low | 已落实 | `config.ts` 的 `THRESHOLD_RANGE` | 宽松的一端就是 PRD 默认值：行高下限不低于 1.5、正文字号不低于 14、行长 warn 不超过 40，依此类推 | 测试「A-39」 |
| A-40 | Low | 已落实 | `rules.ts` 的 T03 分段 | 遇到嵌套的块级元素、代码类元素就断开 | `iter3/T03-pos-nested-block-boundary-A40`（修复前失败）、`T03-neg-inline-still-joined-A40` |
| A-41 | Low | 已落实 | `bench/perf.mjs` | 注释如实（约 400 KB，只设置 color）；新增仿照审计方式的超大页面 B，并如实写明它超过了 2 秒 | `evidence/V-11.log` |
| A-42 | Low | 部分（出处待你决定） | `iter_1/results.json` 加了 `superseded_by`；`iter_1/audit/PROVENANCE.md` | 标明 iter_1 自评已被审计判为未达标；说明执行方没有修改 `AUDIT_iter1.md`，改动来源待确认（D-10） | — |
| A-43 | Low | 已落实 | `test/rules/code.test.js`；`README_PACKAGE.md` | 断言至少命中一条 warn；新增回交包阅读顺序说明 | — |
| A-08 | 复核判部分 | 已落实 | 同 A-39 | 不能再往宽松的方向调 | 测试「A-39」 |
| A-18 | 复核判部分 | 已落实 | 同 A-34、A-41 | 超时不再判通过；证据如实 | — |
| A-25 | 复核判部分 | 已落实 | 同 A-32 | 回归已修复 | — |
| A-26 | 复核判部分 | 已落实 | 同 A-35 | 受保护文件和非结果文件都不能覆盖 | — |
