# 分寸 · Measure（measure-cjk）W1 · iter_3 复核审计报告

- **当前步骤**：8 步流程第 7 步「审计验收」（第二次复核），由 Claude Code 作为独立审计方执行。
- **审计日期**：2026-10-25（20:10–20:30 CST）。
- **审计对象**：
  - 仓库 HEAD 为 `c5f4302`。iter3 新增 5 个 commit：`23cc274`（整改前锁定）→ `73fcfa5`（整改）→ `9e444e1`（基线重新 lint）→ `50ab3dc`（台账和报告）→ `c5f4302`（证据）。
  - 回交包 `measure-cjk_delivery_iter_3.zip`，SHA-256 为 `aa03a395…b659`，和同目录 `.sha256` 文件里的值一致。
- **审计依据**：
  - `iter_3/VERIFICATION_REPORT.md` 第 9 节（审计意见响应矩阵）；
  - `results.json`、`evidence/`、`open_decisions.json`；
  - `docs/verification/PRD_CHANGE_PROPOSALS.md`、`RULINGS.md`；
  - `iter_1/audit/PROVENANCE.md`、`README_PACKAGE.md`；
  - 上一轮的 `AUDIT_iter2.md`。
- **审计方式**：只读。
  - 没有运行 `verify.mjs` 和 `package.mjs`，没有联网，也没有提交任何内容。
  - 「修复前」的结果是这样得到的：用 `git archive 23cc274` 把整改前锁定的版本解到 scratchpad，单独编译，再跑 iter3 的测试。
  - 测试页面都放在 scratchpad 里。

---

## 1. 结论

**未达标。** 这个结论和执行方自评一致，而且执行方的自评是诚实的。

**一句话理由**：工程方面已经全部整改到位。iter2 我提出的 High 和 Medium 共 6 条，都已复现确认修复，对应的测试在修复前确实会失败。剩下没过的原因有四个：
1. D-1 到 D-4 仍在等用户拍板。
2. 除此之外，我认为还有一个未达标理由被执行方漏掉了：D-5 涉及的是硬约束 H10，却被标成「不影响结论」（A-44）。
3. 有一处 skill 文档和实现矛盾：文档说 `aria-hidden` 不检查，实现已经恢复检查（A-45）。
4. PRD §7.3 已经回滚，代码却还在输出提案里的新字段，H6「严格按 PRD §7.3」暂时不成立。不过这一条随 D-1 一起解决。

**更正（审计方自己的错误）**：iter2 的 A-42 说「`AUDIT_iter1.md` 被第三方改过措辞」，这个判断是**错的**。仓库里的版本，就是审计方最后一次写入的版本。当时扩大审计范围后，我重写了整份报告，比对时却拿重写之前的初稿去对照。D-10 不需要追查，`PROVENANCE.md` 里的「改动来源待确认」可以改为「已由审计方澄清：没有第三方改动」。执行方因为这条错误判断做了额外的追查工作，特此说明。

---

## 2. 发现清单（iter_3 新发现）

**统计**：Blocker 0 条，High 0 条，Medium 2 条，Low 6 条。编号接着上一轮继续。

### Medium

**A-44　D-5（H10）的 `blocks_verdict` 被标成 `false`，但它和 D-1（H14）一样，都是硬约束要不要追认的问题**

- **位置**：`docs/verification/iter_3/open_decisions.json` 的 D-5。
- **问题**：
  - 任务包 §2 规定：违反 H1–H16 中任意一条，本轮即失败。
  - H10 写的是「不得往 `~/.claude/` 写任何东西」。claude 基线实际在 `~/.claude/projects/` 留下了 31 个会话目录（iter1 已核验）。
  - 执行方把 H14 的追认（D-1）设为会阻塞结论，却把 H10 的追认（D-5）设为不阻塞，两者标准不一致。
- **修法**：把 D-5 改为 `blocks_verdict: true`。如果用户按推荐放宽 H10，就在 `user_quote` 里记下原话。

**A-45　skill 参考文档还写着「`aria-hidden` 不检查」，但实现已经恢复检查（A-32 的文档没有同步）**

- **位置**：`skills/measure/references/typesetting.md:11`（「不检查：隐藏元素（`hidden`、`aria-hidden="true"`、…）」）。
- **问题**：
  - 和实现矛盾：`rules.ts` 的 `isHidden` 已经去掉了 `aria-hidden` 的判断。
  - 和 PRD 变更提案 C14 也矛盾：C14 写的是「`aria-hidden` 仍然检查」。
  - 这份文档是 Agent 会读的 skill 参考资料，Agent 读了可能会误以为把文字标上 `aria-hidden` 就能逃过检查。
- **修法**：删掉文档里的 `aria-hidden="true"`。属于文档修改，不涉及代码。

### Low

- **A-46　前缀规则对全大写的西文名仍有误伤。**
  - `measure-cjk fonts "HYPERLEGIBLE"`、`"HYBRID Sans"` 会被判为 🔴 汉仪，`"FZERO"` 会被判为 🔴 方正。
  - 原因：全大写时，第三个字母同样是大写，规则区分不出来。iter3 的测试只覆盖了 `Hyperlegible` 这种首字母大写的写法。
  - 实际影响很小，因为全大写的 family 名不常见。
  - 建议：再加一条限制，前缀后面不能是全大写的单词，或者把这个已知局限写进 §5。
- **A-47　T03 的分段改成按节点遍历之后，隐藏的行内文字又被纳入检查了。**
  - 例子：`<p>正常的句子。<span class="sr-only">读屏专用,说明</span><span hidden>隐藏,文字</span></p>` 会报 T03。
  - iter2 跳过了隐藏文字，这是一个小回归，和文档写的「隐藏元素不检查」不一致。
  - 建议：遍历时跳过 `isHidden` 判定为隐藏的子元素。
- **A-48　A-36 的测试只检查 `verify.mjs` 的源码里有没有出现 `user_quote`、`resolved_on` 这两个字符串**，没有真正跑一遍判定逻辑。
  - 我静态审查了 `verify.mjs:131-137`，逻辑是对的：`resolved === true`、`user_quote` 非空、日期格式合法，三个条件都满足才算已解决；没解决的进入 `verdict_blockers`，结论判「未达标」。
  - 建议：把判定逻辑抽成函数，用真正的输入输出来做单测。
- **A-49　`bench/perf.mjs:68` 的注释写「约 550 KB」，实际是 449 KB**（`V-11.log` 里的数字是对的）。
  - 「2 秒门槛只适用于 golden 和真实页面」是对 V-11 的解释性收窄。执行方已经如实写明，我接受，但需要用户知道这一点。
- **A-50　`iter_2/results.json` 没有标注已被取代。** 它写的结论是「有条件达标」，而 AUDIT_iter2 的结论是「未达标」，但文件里没有像 iter_1 那样加 `superseded_by`。建议补上。
- **A-51　「执行方不得自行填写 `user_quote`」只靠自觉。** `verify.mjs` 只能检查这个字段非空，没法验证它真的是用户原话。建议：用户拍板之后，由审计方（或者用户本人）对照对话记录核验一次再提交。

---

## 3. 矩阵逐条复核（AUDIT_iter2 的发现）

| 发现 | 执行方状态 | 复核结论 | 证据 |
|---|---|---|---|
| A-32 | 已落实 | **确认落实**（文档残留，见 A-45） | 我在 iter2 的复现页 `d02-ariahidden.html` 现在报 T07、T08、T11 共 3 个 error，退出码 1；`iter3/T11-neg-aria-hidden-visible-A32` 在修复前的构建上会失败；codex 001 的 T11 error 数恢复到 iter1 的水平（23 条） |
| A-33 | 已落实 | 确认落实 | 我在 iter2 的复现页 `d01-datauri.html` 现在报 F03 error；🟢 字体用 `data:` 内嵌时不报（有正例夹具）；对应测试在修复前会失败 |
| A-34 | 已落实 | 确认落实 | 设置 `MEASURE_PAGE_BUDGET_MS=0` 后得到 `status: incomplete`、退出码 2；用注入时钟复现（第 151 段才违规的页面）同样得到 `incomplete` / 2；把这个变量设成 `999999` 或 `abc` 时退出码 2，说明上限只能往下调、不能往上调 |
| A-35 | 已落实 | 确认落实 | `--out` 指向 `package.json`、`measure.config.json`、`other.json`、`PACKAGE.JSON`（大小写变体）、`sub/../package.json`（路径变体）时都是退出码 2，`package.json` 内容没有变；指向 `--config` 当前读取的配置文件时退出码 2；覆盖上一次的 lint 结果文件仍然允许 |
| A-36 | 部分（授权待定） | **确认落实**，判定逻辑成立 | `git diff 3b4dafb HEAD -- docs/PRD.md` 为空；未拍板的事项会进入 `verdict_blockers` 并判「未达标」，`verdict_conditions` 为空；`isResolved` 要求同时有 `user_quote` 和 `resolved_on`。补充说明：回滚到 `3b4dafb` 后，PRD 里仍然保留着执行方在 iter1 写的 C1–C9（相对原始的 `a4208ae` 多了 22 行），这一点 D-1 的问题描述里已经如实写明。测试强度偏弱，见 A-48 |
| A-37 | 已落实 | **确认落实**（有 Low 残留，见 A-46） | `HYQiHei`、`HYZhongHeiJ`、`FZLanTingHei` 能命中，`Hyperlegible` 不会误命中；文件名 `HYQiHei-55S.woff2`、`hanyiqihei.woff2` 报 F03 error，`hyqihei.woff2` 只报 F-UNKNOWN warn（数据里没有 `hy` 文件名前缀，这是有意保守，可以接受） |
| A-38 | 部分（D-9） | **处理成立** | SKILL 第 4 步、README 第 51 行都如实写明「会盖过放在 `@layer` 里的样式」；PRD §7.4 被 V-10 锁定，在拍板之前保持不动是对的；提案 C20 写得清楚。W1 范围内可以接受 |
| A-39 | 已落实 | 确认落实 | `body_line_height_min` 设 1.49、`min_font_px_body` 设 13、`line_length_warn` 设 41、`line_length_error` 设 50，都退出码 2；往更严格方向调（1.6、30）可以正常运行 |
| A-40 | 已落实 | **确认落实**（有 Low 副作用，见 A-47） | `e01-nested-block` 不再报出「第一部分.结尾」这种跨块拼接；行内元素边界上的标点（`p09`）仍然能抓到；对应夹具在修复前会失败 |
| A-41 | 已落实 | 确认落实（注释有出入，见 A-49） | `V-11.log` 如实写出了页面 B 449 KB、2415 ms、超过 2 秒 |
| A-42 | 部分（出处待定） | **审计方撤回出处部分；其余已落实** | `iter_1/results.json` 已加 `superseded_by`。出处问题是审计方自己弄错了（见 §1 的更正），D-10 可以关闭 |
| A-43 | 已落实 | 确认落实 | `code.test.js` 改成要求至少报一条 warn；新增了 `README_PACKAGE.md` |
| A-08、A-18、A-25、A-26（iter2 判为部分） | 已落实 | 确认落实 | 分别由 A-39、A-34/A-41、A-32、A-35 落实 |

**修复前确实会失败的证据**：用 `23cc274` 的源码编译后运行 `test/iter3.test.js`，结果是 11 项里 9 项失败、2 项通过。通过的 2 项是两条正例（🟢 字体用 `data:` 内嵌、行内元素边界的标点仍能抓到），它们在修复前本来就应该通过。这和 `iter3-tests-before-fix.log` 记录的 9 个失败完全一致。

**统计**：

| 范围 | 条数 | 复核结果 |
|---|---|---|
| iter2 新发现 12 条，加上 iter2 判为部分落实的 4 条 | 16 | 确认落实 14 条，其中 3 条有 Low 残留 |
| A-38（处理成立）、A-42（出处部分由审计方撤回） | 2 | 不再计为未落实 |
| 合计 | 16 | **没有未落实的条目** |

---

## 4. 执行方的自评诚实吗？还有没有别的未达标理由？

**诚实。**
- `results.json` 的 `verdict` 是「未达标」，`verdict_blockers` 正好列出 D-1 到 D-4。
- `verdict_conditions` 为空，没有拿「有条件达标」包装。
- 报告第 1 节明确写了 PRD 只回滚到 `3b4dafb`，C1–C9 的去留等 D-1 决定。
- 基线报告里明确说页面级统计没有变化，并给出了条目级变化的原因。

**另外还有三个理由，执行方没有列进去**：
1. **A-44**：D-5（H10）应该和 D-1（H14）同样阻塞结论。
2. **A-45**：skill 参考文档和实现矛盾，Agent 会照着这份文档执行。
3. **H6 和 PRD §7.3 不一致**：实现里已经有 `summary.status = "incomplete"`、`skipped_inputs.reason = "timeout"`、`run.threshold_overrides`、授权表 `filename_prefixes`，而回滚后的 PRD §7.3 没有这些字段。在 C10–C19（特别是 C18、C19）并入 PRD 之前，H6「严格按 PRD §7.3」在字面上不成立。这一条已经包含在 D-1 的「是否并入」里，不需要单独列为 blocker，但要知道：并入是让结论达标的必要步骤，不是可选项。

---

## 5. 如果用户按推荐对 D-1 到 D-4 拍板，不改代码能不能达标？

**能，但还差下面几步。每一步都是文档、数据或流程操作，不需要改代码：**

1. **D-1 追认**之后，把 `PRD_CHANGE_PROPOSALS.md` 里的 C10–C19 并入 PRD 附录 C 和 §7.3，这样 H6 才能对上。C20 等 D-9 拍板后再处理。
2. **D-5 也要拍板**（见 A-44）。按推荐放宽 H10，并记下原话。
3. **修正 `typesetting.md:11`**（A-45）。
4. **把用户原话和日期填进 `open_decisions.json`**，最好由审计方或用户本人对照对话记录核验一遍（A-51）。
5. **重新生成证据和回交包**：在干净的工作树上重跑 `verify.mjs --iter 4` 和 `package.mjs --iter 4`。

做完这 5 步，结论就能变成「达标」：任务门、回归门目前都已 PASS，伪成功扫描未发现问题，三件套也是齐的。

剩下的 Low 项（A-46 到 A-50）不影响达标，可以放到 W2 处理。代码方面唯一建议在 W2 之前修掉的是 A-47（隐藏的行内文字被纳入 T03 检查），改动只有一行。

---

## 6. 新问题检查结果（第 4 项要求）

- **回归**：HEAD 上测试 151/151 通过；`dist` 和 `src` 编译结果完全一致；7 份 MANIFEST 都 OK；`git diff 23cc274 HEAD -- test/fixtures bench/golden` 为空，说明锁定之后没有动过夹具；golden 仍然是 0 error。
  - 我把 iter1 和 iter2 用过的复现页全部重跑了一遍：`@layer`、嵌套、`@supports not`、`font: var()`、`local()`、CDN、`--root` 传绝对路径、`init` 遇到 symlink、默认配置 symlink 越界，结果都正确。
  - 只发现 A-47 这一处小回归。
- **误报和漏报**：A-46（全大写的西文字体名被误判）、A-47（隐藏的行内文字被检查）。
- **文档和实现不一致**：A-45、A-49。
- **回交包完整性**：
  - 2002+ 个条目，`.git` 的 HEAD 是 `c5f4302`，`git status --ignored` 为空；
  - 不含 `node_modules`、`dist` 和字体文件；
  - 包含 `README_PACKAGE.md` 和 `iter_1` 到 `iter_3` 的全部验证材料；
  - 解压后链接本地依赖、重新编译，测试 151/151 通过，7 份 MANIFEST 都 OK。
- **`results.json` 和报告是否一致**：一致。测试总数 151、V-04 的 102 项、7 份 MANIFEST、基线数字、`verdict_blockers` 都对得上。`git_head` 是 `50ab3dc`，下一个 commit `c5f4302` 只新增了 `iter_3/` 下的证据，可以接受。

---

## 7. V-01 到 V-14（审计方重跑）

| ID | 结果 |
|---|---|
| V-01 | 38 项全部通过 |
| V-02 | 无输出（没有字体文件） |
| V-03 | 0 error，3 warn |
| V-04 | 102 项 |
| V-05、V-06、V-09、V-10 | 全部包含在 151 项测试里 |
| V-07 | 退出码 2 |
| V-08 | 结果分别为 🔴、🔵、🟢 |
| V-11 | 没有重跑 `perf.mjs`；证据如实 |
| V-12 | 7 份 MANIFEST 都 OK |
| V-13 | `summary.json` 显示 30/30，口径标注为「用户环境基线」 |
| V-14 | 151/151 |

以上全部和执行方的结果一致。

---

## 8. 没能核查的部分

1. 真实超时场景：只用环境变量和注入时钟验证过，没有构造真正跑满 20 秒的页面。
2. 真实浏览器里的表现：`@layer`、`aria-hidden`、`:root:lang(zh)` 在中英混排页面上的行为，W1 没有完整档，没法验证。
3. 用户将来填进 `user_quote` 的原话是否真实：只能事后对照对话记录核验（A-51）。
4. W3C 原文、npm 包名是否被占用：不能联网，没有核查（和前两轮相同）。
