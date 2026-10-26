# 分寸 · Measure（measure-cjk）W1 · 验证报告（iter_4，收尾轮）

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 5 步「验证」→ 第 7 步「审计验收」 |
| 执行方 | Claude Code |
| 审计方 | 独立审计子 agent（iter_3 复核报告：`docs/verification/iter_3/audit/AUDIT_iter3.md`，结论「未达标，自评诚实」） |
| 机器判定 | `docs/verification/iter_4/results.json`（`node scripts/verify.mjs --iter 4`，在干净的工作树上运行） |
| 回交包 | `deliverables/measure-cjk_delivery_iter_4.zip`（阅读顺序见 `README_PACKAGE.md`） |

---

## 1. 结论

**执行方自评：达标。最终结论以审计方的最终复核为准。**

- 任务门 PASS（V-01 到 V-13）；回归门 PASS（153 个测试，失败 0）；伪成功扫描未发现。
- 影响结论的开放决策 D-1 到 D-5，用户已于 2026-10-25 拍板，`open_decisions.json` 里记录了原话和日期。
- **原话由执行方转录**：`user_quote` 是摘录，`user_message_verbatim` 是整条原话。按 AUDIT_iter3 A-51，请审计方或用户本人对照对话记录核验一次。

---

## 2. 断言逐条表

各条的状态和说明以 `results.json` 为准，证据在 `evidence/V-*.log`。V-01 到 V-14 的含义和 iter_3 相同（见 `iter_3/VERIFICATION_REPORT.md` §2）。本轮的变化有两处：
- V-12 新增 `test/fixtures/iter4`，共 8 份 MANIFEST；
- V-14 的测试数为 153。

---

## 3. 基线数据

和 iter_3 相同，规则对页面级统计没有影响。口径是「用户环境基线」，按 D-3 保留，W2 跑北极星对比之前在隔离环境下重跑。

| agent | 零 error | 排除 T02/T04 后零 error |
|---|---|---|
| codex | 0/30 | 4/30 |
| claude-code | 0/30 | 18/30 |

claude-code 一项由执行方代跑，用户已追认（D-4）。

---

## 4. 依赖与 license 清单

没有变化，见 `NOTICE`。没有 GPL 类依赖，没有字体文件。

---

## 5. 已知局限

1. 基础档的层叠计算是近似的。不计算 `calc()`、`clamp()`；除 `not (…)` 之外的 `@supports` 条件一律视为成立。
2. **`measure.css` 不分层**，会盖过放在 `@layer` 里的样式。用户已拍板改为 `@layer measure`，在 W2 实现（C20）。
3. `:where(:root:lang(zh))` 在 `<html lang="en">` 的中英混排页面上不生效，和 C20 一起在 W2 评估。
4. 超大页面可能超过 2 秒，只受 20 秒单页上限约束。超时时结论为 `incomplete`，退出码 2。
5. 全大写的西文名（如 `HYPERLEGIBLE`、`FZERO`）会被前缀规则误判为汉仪或方正（A-46）。

---

## 6. 伪成功扫描

方法同 iter_3，结果：未发现。

本轮补上了「开放决策判定」的真实单测：`scripts/verdict.mjs` 加 `test/iter4.test.js`（A-48）。

---

## 7. 需要审计方裁定的问题

1. **核验用户原话**：请对照对话记录，核对 `open_decisions.json` 里 D-1 到 D-5、D-9 的 `user_quote` 和 `user_message_verbatim`（A-51）。
2. **硬约束的变更**：
   - H14：用户追认执行方修改 PRD（D-1）；
   - H10：放宽为「只禁止安装 skill，允许 Agent 写自己的会话状态」，`~/.claude/projects/` 里的 31 个会话目录保留不删（D-5）。
   - 这两项是用户对契约的修改，请审计方按修改后的契约判定。
3. **没有新的夹具裁定。** RULING-01 已由用户追认；RULING-02、03 已由审计方同意。

---

## 8. 下一轮建议（W2）

1. **C20**：把 `measure.css` 改为 `@layer measure`，同步更新 §7.4 和 V-10，先补「Tailwind v4 不被覆盖」的夹具，**先锁定，再实现**。
2. 在隔离环境下重跑「不装 skill」的对照组（D-3），再跑「装 measure」组，算北极星指标。
3. 完整档（Playwright）、A 系列反模式规则、主题、小红书卡片导出（PRD §10 的 W2 范围）。
4. 遗留的 Low：A-46 全大写名的误判。

---

## 9. 审计响应矩阵（AUDIT_iter3）

| 发现 | 严重度 | 状态 | 落在哪 | 怎么落的 | 证据 |
|---|---|---|---|---|---|
| A-44 | Medium | 已落实 | `iter_4/open_decisions.json` 的 D-5 | `blocks_verdict` 改为 true；用户已拍板，放宽 H10 | `open_decisions.json` |
| A-45 | Medium | 已落实 | `skills/measure/references/typesetting.md` | 明确写出 `aria-hidden` 的文字仍然检查 | — |
| A-46 | Low | 已落实（写进局限） | `README.md` 的已知局限；PRD C19 | 方正的 PostScript 名常是全大写，不能简单排除，所以把这个误判写进局限 | — |
| A-47 | Low | 已落实 | `rules.ts` 的 T03 分段 | 遍历时跳过隐藏的子元素 | `iter4/T03-pos-hidden-inline-A47`（修复前失败，见 `evidence/iter4-tests-before-fix.log`） |
| A-48 | Low | 已落实 | `scripts/verdict.mjs`、`verify.mjs` | 判定逻辑抽成函数，用真实的输入输出做单测 | `test/iter4.test.js`（修复前失败） |
| A-49 | Low | 已落实 | `bench/perf.mjs` | 注释改为约 450 KB | — |
| A-50 | Low | 已落实 | `iter_2`、`iter_3` 的 `results.json` | 加上 `superseded_by` | — |
| A-51 | Low | 已落实（流程） | `scripts/verdict.mjs` 注释；本报告 §7 | 规定用户拍板后，由审计方或用户本人核验原话；本轮已提交审计方核验 | — |
| A-42 | — | 关闭 | `iter_1/audit/PROVENANCE.md` | 按审计方的澄清，没有第三方改动；D-10 关闭 | — |
| PRD 一致性（AUDIT_iter3 步骤 1） | — | 已落实 | `docs/PRD.md` 附录 C、§7.3 | 按 D-1 并入 C10–C19；§7.3 补上 `incomplete`、`timeout`、`threshold_overrides`、`filename_prefixes`；C20 记为 W2 待办；§7.4 没有改动（V-10 通过） | `git diff` |
