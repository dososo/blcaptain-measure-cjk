# 分寸 · Measure（measure-cjk）W1 · 验证报告（iter_2）

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 4–5 步「开发、验证」，针对独立审计的整改轮 |
| 执行方 | Claude Code（用户 2026-10-25 指示「不交给 codex，全部都由你闭环完成」） |
| 审计方 | 独立审计子 agent（iter_1 报告：`docs/verification/iter_1/audit/AUDIT_iter1.md`，结论「未达标」） |
| 机器判定 | `docs/verification/iter_2/results.json`，由 `node scripts/verify.mjs --iter 2` 在干净的工作树上生成 |
| 证据 | `docs/verification/iter_2/evidence/V-*.log`；整改前的失败清单：`evidence/iter2-tests-before-fix.log` |
| 回交包 | `deliverables/measure-cjk_delivery_iter_2.zip`，SHA-256 见同名 `.sha256` 文件 |

---

## 1. 结论

**执行方自评：有条件达标。**

- 任务门 PASS：V-01 到 V-13 全部 PASS，没有 INCOMPLETE 和 BLOCKED_ENV。
- 回归门 PASS：140 个测试，新增失败 0，已知失败台账 0 条。
- 伪成功扫描：未发现。
- **为什么是「有条件」**：有 4 项影响结论的事项需要你拍板（D-1 到 D-4，见 `open_decisions.json` 和 §7）。拍板之前，`verify.mjs` 只会给「有条件达标」，不会给「达标」。

iter_1 审计提出的 31 条发现：
- 已落实 25 条；
- 部分落实 6 条：A-02、A-05、A-06、A-14、A-17、A-19；
- 拒绝 0 条。

逐条见 §9 审计响应矩阵。

---

## 2. 断言逐条表

| ID | 内容 | 结果 | 说明 |
|---|---|---|---|
| V-01 | skill 格式与字体授权表校验 | PASS | 38 项检查全部通过 |
| V-02 | 仓库里没有字体文件 | PASS | — |
| V-03 | golden 20 页基础档 | PASS | 0 个页面有 error；3 个 warn（g02 列表行高 2.0，见 D-7） |
| V-04 | 每条规则的反例和正例 | PASS | 102 个规则测试；命令由目录改为 glob（Node 22.17.1 不支持把目录当参数，A-24） |
| V-05 | 零网络请求 | PASS | 运行时拦截，并加上 `syncBuiltinESMExports`；另有静态导入禁令（A-10） |
| V-06 | 路径安全 | PASS | 另见 `test/iter2.cli.test.js` 的 A-03、A-09、A-26 测试 |
| V-07 | `--render` 返回 2 | PASS | — |
| V-08 | fonts 查询 🔴 / 🔵 / 🟢 | PASS | — |
| V-09 | 结果文件、理由必填、退出码、没有 `--force` | PASS | — |
| V-10 | `measure.css` 与 PRD §7.4 逐字一致 | PASS | — |
| V-11 | 性能 | PASS | golden 页面 p95 3.2 ms；60 个真实基线页面 p95 17.0 ms；396 KB 超大页面 1.4 s（A-18） |
| V-12 | 6 份 MANIFEST 锁定 | PASS | 新增 iter2、iter2b |
| V-13a | codex 用户环境基线 | PASS | 30/30 页产出 |
| V-13b | claude-code 用户环境基线 | PASS | 30/30 页产出；由 Claude Code 代跑，待你追认（D-4） |
| V-14 | 回归门 | PASS | 140 个测试，失败 0 |

---

## 3. 基线数据

**口径：** 这是「用户环境基线」，不是干净的「不装 skill」对照组。
- measure 没有安装：三个 skill 目录都没有，60 页产物里也没有 `measure.css`。
- 但用户本机的其他 skill 和全局指令照常生效。

**实际环境（`summary.json` 的 `environment_observed`、`environment.log`）：**

| | codex | claude-code |
|---|---|---|
| 模型 | gpt-6-astra，推理强度 high（30/30 次运行），CLI 0.154.0 | 输出里没有记录（待确认），CLI 2.1.296 |
| 实际加载的设计类 skill | `~/.codex/skills/anthropic-frontend-design` 18 次，`~/.agents/skills/frontend-design` 12 次，`~/.codex/skills/frontend-design` 2 次 | 无法从 `claude -p` 的输出统计（待确认） |
| 全局指令 | `~/.codex/AGENTS.md` 里没有排版相关关键词 | `~/.claude/CLAUDE.md` 有「中英文空格」「「」」等排版和设计偏好。7/30 次运行的自述里出现了「米纸、朱砂」 |

**三版规则的结果并列（A-31、A-20 要求）：** 「零 error」按产出页面计。T02、T04 两边都是 30/30 命中，所以零 error 率按设计就是 0%，同时给出排除 T02、T04 之后的数字。

| 规则版本 | agent | 零 error | 排除 T02/T04 后零 error | 各规则命中的页面数（error） |
|---|---|---|---|---|
| 原始（生成时的构建，C9 之前） | codex | 0/30 | 未计算 | T02 30、T04 30、T11 25、T06 23、T07 14、T13 8、T03 4、T08 1 |
| C9 之后（iter1 终版） | codex | 0/30 | 0/30 | T02 30、T04 30、T11 25、T06 23、T07 14、T13 7、T03 4、T08 1 |
| iter2（当前） | codex | 0/30 | **4/30** | T02 30、T04 30、T11 25、T07 14、T13 7、T03 4、T08 1、T06 1 |
| 原始（C9 之前） | claude-code | 0/30 | 未计算 | T02 30、T04 30、T03 11、T13 5、T06 4、T11 2、T08 2 |
| C9 之后（iter1 终版） | claude-code | 0/30 | 14/30 | T02 30、T04 30、T03 11、T06 4、T11 2、T13 1、T08 1 |
| iter2（当前） | claude-code | 0/30 | **18/30** | T02 30、T04 30、T03 11、T11 2、T13 1、T08 1 |

**变化原因：**
- **C9**：代码块里的中文注释不再按正文报 T13、T08 error。codex T13 从 8 降到 7；claude T13 从 5 降到 1，T08 从 2 降到 1。
- **iter2 的 C10**：「没设行高」的单行短文降为 warn。codex T06 从 23 降到 1，claude T06 从 4 降到 0。
- 独立审计逐页对比过 C9 的影响：只动了 6 页，全部是 `<pre><code>` 里的注释或字符串，没有把正文里的问题藏起来。

**解读：**
- 不装 skill 时，AI 生成的中文页面，没有一页同时开启中英文间距（T02）和行首禁则（T04）。
- 其余问题里：codex 最突出的是字号小于 12px（25 页）和中文负字距（14 页）；claude 最突出的是引号风格（11 页）。claude 的这一项和全局 CLAUDE.md 偏好「」有关，属于环境影响。
- **这组数字不能直接当北极星对照组用**（D-3）。

---

## 4. 依赖与 license 清单

依赖没有变化，见 `NOTICE`。
- **运行时**：postcss（MIT）、htmlparser2（MIT）、css-select / domhandler / domutils / css-what / nth-check / domelementtype / entities（BSD-2-Clause）、boolbase（ISC）、dom-serializer（MIT）、nanoid（MIT）、picocolors（ISC）、source-map-js（BSD-3-Clause）。
- 全部读过 LICENSE 文件，都没有 install 类脚本。
- **开发**：typescript 5.9.3（Apache-2.0）、@types/node（MIT）。
- 没有 GPL、AGPL、LGPL。
- 仓库里没有字体文件，60 页基线产物里也没有。

---

## 5. 已知局限

1. **基础档的层叠计算仍然是近似的。**
   - 能处理：`@layer`、CSS 嵌套、`var()`、`font` 简写、两个视口下的 `@media`。
   - 不计算：`calc()`、`clamp()`；带 `not` 以外的 `@supports` 条件一律视为成立。
2. **只检查 `.html`、`.htm`、`.css`。** JSX 等源码要先构建；显式传入时退出码 2。
3. **T05 行长只能估算**，只报 warn。
4. **`HYQiHei` 这类汉仪拉丁名只报 F-UNKNOWN warn（A-14 部分落实）。** 「HY」前缀没有出现在官方授权核验文件里，按 H11 不能自行加入授权表。
5. **单页耗时上限 20 秒。** 超时后停止检查，记为 `timeout`，这时的结果是不完整的。
6. **完整档（真实浏览器渲染）在 W2 实现。** RULING-01 到 RULING-03 和 `@layer` 的判断是按 CSS 规范推理得出的，没有在浏览器里验证。

---

## 6. 伪成功扫描

**方法：** `scripts/verify.mjs` 第 5 段运行了 5 组扫描，原始输出在 `evidence/pseudo-success-scan.log`：
1. 测试里的 `skip`、`todo`、`only`；
2. `assert.ok(true)` 和写死的 PASS；
3. 多行空 catch（`scripts/scan-empty-catch.mjs`）；
4. 对被测函数的 mock；
5. `--force` 开关。

**结果：** 未发现。

**人工复核过的 catch 块**（都不是空 catch，而是有意的降级处理）：
- `cascade.ts` 的 `safeMatch`：选择器运行时出错时按「不匹配」处理，与浏览器忽略无效选择器一致；
- `css.ts` 的 `parseInlineStyle`：无效的内联样式按空处理，与浏览器一致；
- `fsafe.ts` 的 `lstat`：文件不存在时按「不是链接」处理。

另外，解析失败的样式和不支持的选择器，现在会如实写进 `run.sheet_errors` 和 `run.unsupported_selectors`。

---

## 7. 需要审计方裁定的问题

**裁定台账：** `docs/verification/RULINGS.md`

| 编号 | 问题 | 执行方的处理 |
|---|---|---|
| RULING-01 | iter1 时修改了锁定夹具，commit 信息还冒用了「审计裁定」的名义 | 历史提交不改写；台账如实记录；独立审计已追认内容。流程上如何处理，待你决定（D-2） |
| RULING-02 | `iter2/T01-pos-section-lang-A20`：根元素是 `en`，报 T04 是正确行为 | 夹具没有改，测试改为只断言不报 T01 |
| RULING-03 | `iter2/T06-neg-layer-only-A11`：不分层的行高优先于分层声明，不是有效的反例 | 夹具没有改，测试改为断言不报 T06；另外在 `iter2b/` 新增了正确的反例，写于实现之后 |

**影响结论的开放决策：**
- D-1：PRD 修改是否授权；
- D-2：RULING-01 的流程；
- D-3：基线要不要在隔离环境里重跑；
- D-4：claude-code 基线由执行方代跑是否追认。

**不影响结论的开放决策：**
- D-5：放宽 H10，以及 `~/.claude/projects` 里的 31 个会话目录如何处理；
- D-6：认可 T06 和 T01 的新口径；
- D-7：g02 的 warn；
- D-8：全局 CLAUDE.md 里 Codex 路径那条记录。

每一项的推荐见 `open_decisions.json`。

---

## 8. 下一轮建议（只写和 W2 直接相关的）

1. **北极星对比之前，先在隔离环境下重跑「不装 skill」的对照组**（D-3），再跑「装 measure」组。两组在同一个环境里对比，才能扣掉其他 skill 和全局指令的影响。
2. **完整档（Playwright）上线后，在真实浏览器里复核 RULING-01 到 03、`@layer`、嵌套的判断**，并把 T05 改为实测行长。
3. **补充多样化的 golden 页面**（A-19），覆盖 `var()`、`@media`、`font` 简写、编译后的 Tailwind v4（`@layer`），**先锁定，再实现**。
4. **A 系列反模式规则**（W2 范围）。

---

## 9. 审计响应矩阵

**落实状态说明：**
- 「已落实」表示有代码改动和对应的测试或证据；
- 「部分」表示做了能做的部分，剩余的需要你拍板，或者受 H11 限制。

| 发现 | 严重度 | 状态 | 落在哪 | 怎么落的 | 证据 |
|---|---|---|---|---|---|
| A-01 | Blocker | 已落实 | `scripts/verify.mjs`、`scripts/package.mjs`、本报告 | 补齐 8 节报告和回交包；新增 `dirty` 字段；工作树不干净或报告缺章节时不得判达标；有未决事项时只能判有条件达标；证据在干净的工作树上一次性生成并一起提交 | `results.json` 里的 `dirty`、`report`、`verdict_conditions` 字段；`evidence/git-status.log` |
| A-02 | High | 部分 | `verify.mjs` 的 V-13 | 新增 INCOMPLETE 状态；PASS 要求 30/30；claude-code 一项写明授权依据。**是否追认待 D-4** | `evidence/V-13b.log` |
| A-03 | High | 已落实 | `config.ts` 的 `loadConfig` | 默认配置走 lstat、realpath、`isInside`；解析失败只说「不是合法 JSON」，不回显内容 | `test/iter2.cli.test.js` 的两条 A-03 测试 |
| A-04 | High | 已落实 | `lint.ts` 的 status | 有 error 一律判 fail | 测试「A-04：只传 .css…」 |
| A-05 | High | 部分 | PRD 附录 C 开头 | 写明修改 PRD 的授权依据（用户指示），并列为 D-1 等你确认；不认可时回滚的方案已写明 | `docs/PRD.md` 附录 C |
| A-06 | High | 部分 | `docs/verification/RULINGS.md` | 建立台账，如实记录 RULING-01 自称审计裁定的违规；从 iter2 起的规矩已写明；历史提交不改写。**流程处理待 D-2** | `RULINGS.md`；RULING-02、03 按新规矩处理 |
| A-07 | High | 已落实 | `cli.ts` | `join` 改为 `resolve` | 测试「A-07」 |
| A-17 | High | 部分 | `bench/run-baseline.mjs`、`summary.json` | 标注为「用户环境基线」；自动提取实际加载的 skill 和模型；修正 `agent.log` 里的命令记录（以后生成时生效，已有的 60 份日志没有重写）。**隔离重跑待 D-3；H10 待 D-5** | `summary.json` 的 `environment_observed` 字段 |
| A-08 | Medium | 已落实 | `config.ts` | 阈值有允许范围，越界时退出码 2；偏离默认值的写进 `run.threshold_overrides`，文本输出给出 ⚠ | 测试「A-08」 |
| A-09 | Medium | 已落实 | `cli.ts` 的 `cmdInit` | lstat 拒绝符号链接；用 `wx` 独占创建 | 测试「A-09」 |
| A-10 | Medium | 已落实 | `test/offline.test.js` | 加 `syncBuiltinESMExports`；新增 `src` 和 `dist` 的网络、子进程导入禁令 | `evidence/V-05.log` |
| A-11 | Medium | 已落实 | `css.ts`、`cascade.ts`、`model.ts` | `@layer` 排序（含 `!important` 反转）、嵌套选择器展开、`@supports not` 不成立、`font` 简写里的 `var()` 延迟展开 | `iter2/T06-*-A11`、`T11/T13-*-font-shorthand-var-A11` |
| A-12 | Medium | 已落实 | `rules.ts` 的 T03 | 按最近的块级元素拼接文字再检查 | `iter2/T03-neg-inline-boundary-A12` |
| A-13 | Medium | 已落实 | `rules.ts` 的 `checkFontFaces` | 只写 `local()` 不检查；全是远程 URL 时只报 warn 并写明「原文未明确」；只有本地 `url()` 才算自托管 | `iter2/F03-*-A13` |
| A-14 | Medium | 部分 | `fonts.ts` | 去掉 `_GBK`、「简体」等后缀；文件名前缀不区分大小写。`HY` 前缀没有官方依据，不加入（见 §5） | `iter2/F03-*-A14` |
| A-15 | Medium | 已落实 | `data/fonts/licenses.json` | 9 个 OFL 条目的 `revocable` 改为 unknown；方正、汉仪商用条目的 `attribution_required` 改为 unknown；新增 `field_semantics` 写明字段语义 | `evidence/V-01.log` |
| A-16 | Medium | 已落实 | `fsafe.ts`、`cli.ts` | 显式传入不支持的类型时退出码 2；0 个文件时给出提示 | 测试「A-16」 |
| A-18 | Medium | 已落实 | `rules.ts`、`bench/perf.mjs` | 单页耗时上限 20 秒；压测加入 60 个真实页面，以及和审计方同等规模的超大页面 | `evidence/V-11.log` |
| A-19 | Medium | 部分 | §7、§8 | golden 页面已锁定，不修改；g02 提交裁定（D-7）；多样化的 golden 页面放到 W2 | `open_decisions.json` |
| A-20 | Medium | 已落实 | `rules.ts` 的 T06 和 T01；PRD C10、C11 | 没设行高：30 字以上 error，否则 warn；T01 看每个中文元素实际继承的 lang；基线给出前后两套数字 | §3；`iter2/T06-*-A20`、`T01-*-A20` |
| A-21 | Medium | 已落实 | `SKILL.md`、`README.md`、`references/` | 发布之前不用 `npx measure-cjk`，改为本地路径或 `npx --no-install` | grep 确认已经没有直接的 `npx measure-cjk` |
| A-22 | Medium | 已落实 | `test/rules/rules.test.js`、`test/iter2.cli.test.js` | 反例断言严重级别；原子写入失败时的清理测试；替换掉恒真断言；补上 CLI `--root`、默认配置 symlink、只检查 CSS 时的退出码测试 | `evidence/V-04.log`、`V-14.log` |
| A-31 | Medium | 已落实 | `model.ts` 的 `CODE_BLOCK`；`rules.ts`；PRD C13 | 豁免只限 `pre`、`code`、`kbd`、`samp`；代码块里的 T13 改为 warn；基线三版数字并列 | §3；`iter2/T13-*-A31` |
| A-23 | Low | 已落实 | `.claude-plugin/plugin.json` | 只留 `name`、`description`、`version` | — |
| A-24 | Low | 已落实 | `verify.mjs` | V-04 写明改用 glob；V-12 的命令改为 `(cd … && …)`，可以照抄 | `results.json` |
| A-25 | Low | 已落实 | `rules.ts`、`cascade.ts` | 隐藏元素不检查；读取 SVG 文字的 `font-size` 等属性 | `iter2/T11-*-A25` |
| A-26 | Low | 已落实 | `fsafe.ts`、`cli.ts` | `--out` 只能是 `.json`，不能是输入文件、`.git` 或目录；默认不打印堆栈 | 测试「A-26」 |
| A-27 | Low | 已落实 | `fsafe.ts` 的 `dedupeSkipped`；`types.ts` 注释 | 去重；注释已更新 | 测试「A-27」 |
| A-28 | Low | 已落实 | `fonts.md`、`SKILL.md` | HarmonyOS Sans、MiSans 改为「原文未明确」 | — |
| A-29 | Low | 已落实 | `web.md` | 改为 `max-w-prose`（65ch）大约等于 33–39 个汉字，在合适范围内 | — |
| A-30 | Low | 已落实 | `typesetting.md`、T13 报错文案 | 去掉没有核验的「Windows 上常是宋体」 | — |
