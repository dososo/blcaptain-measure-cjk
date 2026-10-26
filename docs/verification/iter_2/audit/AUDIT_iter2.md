# 分寸 · Measure（measure-cjk）W1 · iter_2 复核审计报告

- **当前步骤**：8 步流程第 7 步「审计验收」（复核轮），由 Claude Code 作为独立审计方执行。
- **审计日期**：2026-10-25（19:40–20:00 CST）。
- **审计对象**：HEAD `5a63b53`（iter2 新增 5 个 commit：`7fd8d66` → `0a75935` → `a03ae9b` → `1eb2eec` → `5a63b53`）。回交包是 `deliverables/measure-cjk_delivery_iter_2.zip`，SHA-256 为 `73966aa8…6564`，与 `.sha256` 文件一致。
- **复核依据**：
  - `docs/verification/iter_2/VERIFICATION_REPORT.md` 第 9 节审计响应矩阵；
  - `results.json`、`evidence/`、`docs/verification/RULINGS.md`、`open_decisions.json`；
  - PRD 附录 C10–C17；
  - 上一轮报告 `docs/verification/iter_1/audit/AUDIT_iter1.md`。
- **方式**：只读。
  - 没有运行 `scripts/verify.mjs` 和 `scripts/package.mjs`，没有联网，没有安装任何东西。
  - 测试页面放在系统临时目录（本次会话的 scratchpad）。
  - 「修复前」行为的取证方法：用 `git archive 7fd8d66` 把当时的仓库解到 scratchpad 并编译，再把 `cb7a9e9` 的源码另外编译一份。两份都在 scratchpad 里完成，没有改动仓库。

---

## 1. 结论

**未达标**（已经很接近「有条件达标」）。

一句话理由：iter_1 的 31 条发现，大部分确实落实了，测试也确实能抓到问题；但这轮整改**引入了两处新的漏报**，会把真实问题藏起来：
- `aria-hidden` 被当成「隐藏」，导致肉眼可见的中文不再检查；
- `data:` URI 内嵌的字体不再做 F03 检查。

此外还有一处伪成功：单页超时后，判定结果是「通过」、退出码 0。按契约 §9，「有条件达标」只适用于环境受阻或待用户拍板的事项，代码缺陷必须返工。

补充说明：
- **整改质量总体很高。**
  - 矩阵中标「已落实」的 25 条，我复核确认 21 条落实（其中 A-12、A-13、A-22 带备注：A-13 的修改顺带引入了 A-33），4 条只是部分落实（A-08、A-18、A-25、A-26，有残留或副作用）。
  - 整改前锁定的 33 个测试，在修复前的构建上真实失败 25 个，我在 scratchpad 里独立复现了这个数字。
  - HEAD 上 140/140 通过。
  - 回交包解压后可以重新构建，测试同样 140/140 通过，6 份 MANIFEST 全部 OK。
  - 包里不含 `node_modules` 和 `dist`，工作树是干净的。
- **返工量不大。** 修掉 A-32、A-33、A-34，各补一条测试；用户对 D-1 到 D-4 拍板后，即可判「有条件达标」或「达标」。

---

## 2. 发现清单（iter_2 新发现）

统计：Blocker 0 条，High 2 条，Medium 4 条，Low 6 条。编号接着 iter_1 往下排。

### High

**A-32　`aria-hidden="true"` 被当作「不可见」，肉眼可见的中文不再检查（A-25 整改过头）**

- **位置**：`packages/cli/src/rules.ts` 的 `isHidden()`（`x.attribs["aria-hidden"] === "true"`）；`skills/measure/references/typesetting.md:11`
- **问题**：`aria-hidden` 只是让读屏软件跳过这段内容，元素照样显示在屏幕上。AI 生成的页面大量用 `aria-hidden` 标记装饰性插画、卡片印章、产品包装图里的文字：codex 基线 30 页里有 29 页用了它。iter_1 的 A-25 只要求跳过 `hidden`、`display:none` 和 `sr-only`。锁定夹具 `T11-pos-hidden-and-sr-only-A25` 里也没有 `aria-hidden`，这一条是超出夹具范围加进来的。
- **复现**：
  - 临时页 `d02-ariahidden.html`：`<div class="deco" aria-hidden="true">装饰用的中文小字</div>`，样式为 `.deco{font-size:7px;letter-spacing:-2px;font-style:italic}`。HEAD 结果：「通过，0 error」。`cb7a9e9` 的构建结果：T07、T08、T11 共 3 个 error。
  - 拿基线做新旧对比：codex 有 8 页、共 26 条 T11 error 消失了。例如 codex 001 产品包装图里 7px 的 `div.bag > div.bag-label > small`，这段文字在页面上看得见。页面层面的「零 error」统计没有变，因为这些页面还有别的 error，所以报告没有察觉到这个变化。
- **修法**：从 `isHidden` 里去掉 `aria-hidden`；在文档中改回「`hidden`、`display:none`、`sr-only` 类」；补一条 `aria-hidden` 可见文字仍然报错的反例夹具，夹具单独锁定。

**A-33　`src` 只有 `data:` URI 的 `@font-face` 不再做 F03 检查：用 base64 内嵌商用字体可以通过（A-13 整改引入的回归）**

- **位置**：`rules.ts` 的 `checkFontFaces()`（`urls.filter((u) => !/^data:/i.test(u))`，随后 `if (urls.length === 0) continue`）
- **问题**：把字体文件 base64 内嵌进 CSS，和把字体文件放到自己的服务器上一样，都是在分发字体文件。A-13 只要求「只写 `local()` 不检查」。现在 `data:` 也被一起跳过了，而且任何文档里都没有写这一点。
- **复现**：临时页 `d01-datauri.html`，样式为 `@font-face{font-family:"方正兰亭黑";src:url(data:font/woff2;base64,…)}`，并且字体栈里使用了这个字体。HEAD 结果：「通过，0 error」。`cb7a9e9` 的构建结果：F03 error。
- **修法**：把 `data:` 当作自托管处理；按字体族名匹配授权表，`webfont_self_host !== true` 时报 error；补一条反例夹具。

### Medium

**A-34　单页超时后结果是 `pass`、退出码 0，未检查完的页面被当成通过（A-18 整改的副作用）**

- **位置**：`rules.ts:155-160`（超时检查和 `break`）；`lint.ts`（`status` 只看 `errors`）
- **复现**：页面有 150 个正常段落，第 151 段是 9px、负字距。用 scratchpad 脚本把 `performance.now` 改成每次调用前进 15 秒，模拟一台很慢的机器。结果：`status: 'pass'`，`skipped_inputs: [{reason:"timeout"}]`，`exitCodeOf = 0`。同一页面正常运行时，是 T07、T11 两个 error，退出码 1。
- **为什么是问题**：页面没检查完就报「通过」，属于伪成功。VERIFICATION_REPORT §5 写了「结果不完整」，但 CI 只看退出码。
- **修法**：有 `timeout` 的文件，结论判 `fail`，或者给一个单独的「不完整」状态、退出码 2；补一条测试（可以通过注入时钟来实现）。

**A-35　`--out` 仍然可以覆盖工作区里任意已有的 `.json`，包括 `package.json` 和当前生效的 `measure.config.json`（A-26 部分落实）**

- **复现**：
  - 运行 `measure-cjk lint d02-ariahidden.html --out package.json`，退出码 0，`package.json` 被改写成 lint 结果。
  - 运行 `--out measure.config.json`，退出码 0；之后每次运行都报「配置文件有未知字段：tool, run, …」，退出码 2，相当于把自己弄坏了。
- **修法**：拒绝覆盖已有文件且内容不是 LintResult 的 `.json`（例如先检查 `schema_version` 和 `tool.name`）；拒绝本次运行实际读取的配置文件；至少拒绝 `package.json`、`package-lock.json`、`measure.config.json` 和授权表。

**A-36　在 D-1（PRD 修改授权）还没有结论的情况下，继续往 PRD 里追加 C10–C17；「有条件达标」的触发条件超出了契约**

- **位置**：commit `0a75935`（`docs/PRD.md` +17 行）；`scripts/verify.mjs:131-134`
- **问题**：
  - 附录 C 开头自己也承认「用户没有逐字授权修改 PRD」，但在等待授权期间又追加了 8 条变更，A-05 的违约面因此扩大了。
  - `verify.mjs` 把「开放决策没有结论」当成「有条件达标」的条件。契约 §9 规定，「有条件达标」只适用于 V-13 或 B3-5 因环境原因 `BLOCKED_ENV` 的情况。H14 一旦被认定违反，结论应是「未达标」。另外，`open_decisions.json` 里的 `resolved` 由执行方自己维护，执行方可以把它改成 `true`，结论就自动升成「达标」。
- **修法**：C10–C17 先移到 VERIFICATION_REPORT 的「需要审计方裁定」，等 D-1 有结论再并入 PRD；`resolved: true` 必须带上用户裁定的出处（对话日期加原话），`verify.mjs` 检查这个字段不能为空。

**A-38　`measure.css` 不分层，会覆盖 Tailwind v4 等分层样式。PRD 和 SKILL 里「不会覆盖用户样式」的说法不成立（RULING-03 牵出的设计问题，不是执行方的回归）**

- **位置**：PRD §5.1 第 190 行、§7.4 第 525 行；`skills/measure/SKILL.md:23`
- **问题**：`measure.css` 的规则都包在 `:where()` 里，优先级为 0，但它们是**不分层**的。按 CSS 层叠规则，不分层的普通声明优先于任何 `@layer` 里的声明，与优先级高低无关。Tailwind v4 的工具类都放在 `@layer utilities` 里，所以用户写的 `leading-tight` 和 `leading-loose` 会被 `measure.css` 的 `line-height: 1.75` 盖掉。
- **复现**：临时页 `f01-tw4.html`，引入 `measure.css`，再加上 `@layer utilities{.leading-tight{line-height:1.25}}` 和 `<p class="leading-tight">…</p>`。lint 判定行高为 1.75，「通过」。工具的计算本身符合浏览器行为，问题出在产品承诺上。
- **修法**：W2 前请用户拍板：是否把 `measure.css` 包进一个最先声明的 `@layer measure`，让它在所有分层样式之下。这会改动 PRD §7.4 的锁定代码块，V-10 也要同步更新。

### Low

- **A-37　A-14 拒绝加 `HY` 前缀的理由前后不一致。** 理由是「HY 前缀没有出现在官方核验文件里」，但已经在用的 `FZ`、`HanYi` 前缀同样不在 `docs/research/*` 里（grep 为 0）。前缀只是字体名到条目的映射规则，不是授权结论，不在 H11 约束的字段范围内。建议：要么用严格的模式（如 `^HY[A-Z][a-z]`）加入 `HY`，并写明误伤风险；要么把三个前缀统一按同一标准处理。
- **A-39　A-08 的阈值下限是 1.2，低于 PRD 规定的硬下限 1.5。** 把 `body_line_height_min` 设成 1.2 以后，行高 1.3 的正文只报 warn，退出码 0。虽然会有 ⚠ 提示，也会写进 `threshold_overrides`，但不会出现在 `disabled_rules` 里。`config.ts` 的注释写的是「可以调严，不能调到失去意义」，实际允许往宽松的方向调。建议下限改为 1.5，或者在 `summary` 里把降级单独标出来。
- **A-40　T03 按块级元素拼接文字时，会跨过嵌套的块级子元素。** 例如 `<div>第一部分<ul><li>…</li></ul>.结尾</div>` 会报「第一部分.结尾」，但这两段在页面上并不相邻，提示文字会误导人。建议拼接时在嵌套的块级元素处断开。
- **A-41　性能证据的描述有出入。** `bench/perf.mjs:55` 的注释写「约 1 MB」，实际只有 396 KB。报告说「和审计方同等规模」，但它的 1500 条规则只设置了 `color`，而我当时的压测页（550 KB）设置的是 `line-height` 和 `letter-spacing`。这个 550 KB 的页面在 HEAD 上要 2.3 秒，超过「单页 2 秒」；1.6 MB、3000 条规则的页面要 14.3 秒。建议在 V-11 证据里如实写明页面规模和规则类型。
- **A-42　历史证据的出处。**
  - `0a75935` 用 11:30 那版结论为「达标」的文件覆盖了 iter_1 的 `results.json`，没有加任何「已被 AUDIT_iter1 判为未达标」的标注。
  - 提交进仓库的 `AUDIT_iter1.md`，和审计方当时写出的文件相比，措辞和排版都改过（例如第 3–4 行改成了加粗的字段名）。结论和各级发现的数量没有变，但修改人和修改时间没有记录（待确认）。
  - 建议：给 iter_1 的 `results.json` 加一个 `superseded_by` 字段；审计报告以审计方原始输出为准，有改动的要说明。
- **A-43　零碎问题。**
  - `test/rules/code.test.js` 的 `t13.every(warn)` 在 T13 一条都没报时也会通过。不过 iter2 的 WARN 测试已经断言了「至少报一条 warn」，这一处属于冗余。
  - 回交包里没有 `README_PACKAGE`。任务包没有要求，但用户的全局规则要求「成体系产出打包 zip + README_PACKAGE」。

---

## 3. 矩阵逐条复核

| 发现 | 执行方状态 | 复核结论 | 证据 |
|---|---|---|---|
| A-01 | 已落实 | 确认落实 | 报告 8 节齐全；zip 存在，哈希一致；`dirty:false`；`git_head` 是 `1eb2eec`，下一个提交 `5a63b53` 只新增了 `iter_2/` 下的证据，可以接受；解压后 140/140 通过 |
| A-02 | 部分 | 确认，理由成立 | `verify.mjs:79-89` 已有 INCOMPLETE 状态，PASS 要求 30/30；claude-code 由执行方代跑一事已列为 D-4，由用户决定合理。补充：结论条件超出契约，见 A-36 |
| A-03 | 已落实 | 确认落实 | 复现了 iter1 的三种情况：symlink 指向外部 JSON、指向外部 `secret.txt`、根目录内的非法 JSON。现在分别报「指向工作区之外，已拒绝」、「不是合法 JSON，请检查格式」，都不回显内容，退出码 2。指向根目录内文件的 symlink 正常工作。修复前的测试确实失败 |
| A-04 | 已落实 | 确认落实 | `p15-only.css` 现在退出码为 1 |
| A-05 | 部分 | 部分成立 | 附录 C 写明了依据，并承认没有逐字授权，已列为 D-1，这部分合理；但在等待授权期间又追加了 C10–C17（A-36） |
| A-06 | 部分 | 确认，理由成立 | `RULINGS.md` 如实记录了违规；不改写历史提交是对的；新规矩（锁定后一个字节都不改、替代夹具单独存放）这一轮执行到位了：iter2 的夹具 0 改动，MANIFEST 一致 |
| A-07 | 已落实 | 确认落实 | 在 `/` 下运行 `--root <绝对路径>`，退出码 1，正常检查 |
| A-08 | 已落实 | **部分落实** | 0 和负数现在会被拒绝，退出码 2，并写入 `threshold_overrides`；但下限 1.2 仍然允许把 1.2–1.5 这一段的 error 降级（A-39） |
| A-09 | 已落实 | 确认落实 | 遇到悬空 symlink 退出码 2，`outside/` 下没有写入任何文件 |
| A-10 | 已落实 | 确认落实 | 已调用 `syncBuiltinESMExports()`；对 `src` 和 `dist` 有静态导入禁令测试 |
| A-11 | 已落实 | 确认落实 | iter1 的 4 个复现页（`p05` @layer、`q01` 嵌套、`p11` `@supports not`、`p02` `font: var()`）结果都正确；另外验证了分层 `!important` 优先于不分层 `!important` 的反转（`e02`），也正确 |
| A-12 | 已落实 | 确认落实（有 Low 副作用） | `p09` 能报出 T03；跨块级元素拼接的问题见 A-40 |
| A-13 | 已落实 | 确认落实（但引入了 A-33） | 只写 `local()` 时不报；只有远程 URL 时报 warn，并写明「原文未明确」；**`data:` 被一并跳过** |
| A-14 | 部分 | **理由不成立**（现有改动是落实了的） | `方正黑体_GBK` 现在判为 🔵，`fzltxh.woff2` 能命中；拒绝 `HY` 的理由和已在用的 `FZ`、`HanYi` 前缀矛盾（A-37） |
| A-15 | 已落实 | 确认落实 | 9 个 OFL 条目的 `revocable` 改为 unknown；方正、汉仪商用条目的 `attribution_required` 改为 unknown；`field_semantics` 写明了 `attribution_required` 不包括再分发时附带许可证的要求，OFL 条目填 `false` 因此成立 |
| A-16 | 已落实 | 确认落实 | `note.txt` 退出码 2；空目录有提示，退出码 0，这个设计可以接受 |
| A-17 | 部分 | 确认，理由成立（W1 范围内） | `baseline_kind` 已标为「用户环境基线」；`environment_observed` 如实列出了 codex 加载的 3 个 skill 和 30 次运行的模型（gpt-6-astra，我在 `agent.log` 里 grep 到 30 处，一致）；claude 侧写了「待确认」。隔离环境重跑放到 D-3、W2 再做，可以接受 |
| A-18 | 已落实 | **部分落实** | 超时上限和真实页面压测都有了；但超时后判 pass（A-34），证据描述也有出入（A-41） |
| A-19 | 部分 | 确认，理由成立 | golden 已锁定不能改，g02 列为 D-7，多样化的 golden 放到 W2 |
| A-20 | 已落实 | 确认落实 | `q05` 不再报 T01；codex 基线的 T06 从 23 页降到 1 页，和我在 iter1 统计的「22 页只是没设行高」吻合；报告 §3 并列给出了两套数字 |
| A-21 | 已落实 | 确认落实 | SKILL、README 里已经没有直接让用户用 npx 的说法，改成了本地命令或 `npx --no-install` |
| A-22 | 已落实 | 确认落实（有 Low 残留） | `rules.test.js` 断言了严重级别；修复前的 25 个失败已复现；残留问题见 A-43 |
| A-23 | 已落实 | 确认落实 | `plugin.json` 只剩 3 个字段 |
| A-24 | 已落实 | 确认落实 | `results.json` 里 V-04 和 V-12 的命令可以照抄执行 |
| A-25 | 已落实 | **部分落实，并引入回归** | `hidden`、`sr-only`、SVG `font-size` 都处理对了（`q03`、`q04`）；**把 `aria-hidden` 当作隐藏，导致 26 条可见文字的 T11 漏报**（A-32） |
| A-26 | 已落实 | **部分落实** | 改成非 `.json`、指向输入文件、`.git`、目录都会被拒绝，也不再打印堆栈；但仍然可以覆盖 `package.json` 和 `measure.config.json`（A-35） |
| A-27 | 已落实 | 确认落实 | `a-rel.html` 的 `skipped_inputs` 不再重复 |
| A-28 | 已落实 | 确认落实 | `fonts.md` 和 `SKILL.md` 都改成了「原文未明确」 |
| A-29 | 已落实 | 确认落实 | `web.md` 第 34 行和 T05 的估算口径一致了 |
| A-30 | 已落实 | 确认落实 | 已删除「Windows 上常是宋体」 |
| A-31 | 已落实 | 确认落实 | `CODE_BLOCK` 只剩 4 个元素；`textarea` 恢复检查（有夹具）；代码块里的 T13 改为 warn；基线三个版本的数字并列给出 |

**统计**：
- 「已落实」25 条中：确认落实 21 条，部分落实 4 条。
  - 确认落实的 21 条里，A-12、A-13、A-22 带备注：A-13 的修改顺带引入了新回归 A-33；A-12、A-22 各有一处 Low 残留，见 A-40、A-43。
  - 部分落实的 4 条是 A-08、A-18、A-25、A-26，其中 A-25 引入了新回归 A-32。
- 「部分」6 条中：理由成立 4 条（A-02、A-06、A-17、A-19），部分成立 1 条（A-05），不成立 1 条（A-14）。
- 拒绝：0 条。

---

## 4. 对 RULING-02、RULING-03 的裁定

**RULING-02（`iter2/T01-pos-section-lang-A20`）：同意。**
- 页面结构是 `<html lang="en">` 里包一个 `<section lang="zh-CN">`。夹具自带的基础样式是 `:where(:root:lang(zh)) { line-break: strict; }`，它只匹配根元素，而根元素的语言是 `en`，所以 `p` 拿不到 `strict`。
- 因此在真实浏览器里，这一段确实存在 T04 问题。「整页零 error」这个预期本身写错了。这个夹具要测的是 T01，把断言收窄为「不报 T01」，才是这个正例应有的断言，并没有把测试改弱。
- 夹具一个字节都没改（`iter2/MANIFEST.sha256` 校验 OK），处理方式合规。
- 附带说明：这个夹具暴露出 `measure.css` 的 `:root:lang(zh)` 写法在中英混排页面上不生效。这属于 PRD §7.4 的设计问题，建议在 W2 和 A-38 一起评估。

**RULING-03（`iter2/T06-neg-layer-only-A11`）：同意。**
- 夹具里除了 `@layer base{p{1.75}}` 和 `@layer utilities{.leading-tight{1.25}}`，还有基础样式里一条**不分层**的 `:where(:lang(zh)) :where(p, li) { line-height: 1.75; }`。按 CSS 层叠规则，不分层的普通声明优先于所有分层声明，与优先级无关。所以 `p` 的计算值是 1.75，这个页面不是 T06 反例。
- 旁证：这条测试在修复前的构建上是**通过**的。原因是当时的实现没有处理 `@layer`，`.leading-tight` 靠更高的优先级「赢」了。也就是说，它之前能通过，恰恰是因为那个 bug。
- 替代夹具 `iter2b/T06-neg-layer-only-v2-A11` 只保留了两条分层声明：后声明的层 `utilities` 覆盖 `base`，得到 1.25，报 T06 error，推理正确。它是在实现之后写的，证据分量较弱，`RULINGS.md` 已经如实写明。
- 附带说明：同一条规则意味着用户引入 `measure.css` 以后，它会盖掉 Tailwind v4 的分层工具类，见 A-38。

**RULING-01**：维持 iter_1 的判断，追认内容，流程上的处理由用户决定（D-2）。

---

## 5. H1–H16 复核（HEAD `5a63b53`，只列有变化的项）

| 编号 | iter_1 | iter_2 | 说明 |
|---|---|---|---|
| H4 离线 | 部分满足 | **满足** | 有 sync 加静态禁令；源码里仍然没有网络调用 |
| H5 路径安全 | 不满足 | **基本满足** | A-03、A-09 已修，复现通过；`--out` 覆盖其他 `.json` 属于工作区内的数据破坏（A-35），不算越界 |
| H6 结果文件 | 部分满足 | 部分满足 | 新增 `threshold_overrides`；字段合法化仍然依赖 D-1 |
| H7 不设绕过 | 部分满足 | 基本满足 | 阈值范围加了限制并会留痕；下限偏低（A-39） |
| H8 退出码 | 不满足 | **部分满足** | A-04、A-16 已修；超时后退出码 0（A-34） |
| H10 不碰用户环境 | 部分满足 | 部分满足 | 31 个会话目录仍在，交给用户决定（D-5），执行方没有擅自删除，这样做是对的 |
| H11 字体数据 | 部分满足 | **满足** | A-15、A-28 已落实；`field_semantics` 补上了字段语义 |
| H14 只读基线 | 不满足 | 不满足（待 D-1） | 继续追加了 C10–C17（A-36） |
| 其余 H1–H3、H9、H12、H13、H15、H16 | 满足或基本满足 | 不变 | V-02 没有字体文件；V-01 38/38；没有 remote；回交包里没有字体文件 |

---

## 6. V-01–V-14 复核（审计方重跑）

| ID | 执行方 | 审计方 | 一致性 |
|---|---|---|---|
| V-01 | PASS | 38/38 | 一致 |
| V-02 | PASS | 没有输出（rc=1） | 一致 |
| V-03 | PASS | 21 个文件、0 error、3 warn；`run` 里有 `threshold_overrides` | 一致 |
| V-04 | PASS（102） | `node --test test/rules/*.test.js`：102/102 | 一致 |
| V-05、V-06、V-09、V-10 | PASS | 和 `iter2.cli.test.js` 合计 37/37 | 一致；但 V-09 没有覆盖 A-34、A-35 |
| V-07 | PASS | `exit=2`，提示正确 | 一致 |
| V-08 | PASS | 🔴、🔵、🟢 | 一致 |
| V-11 | PASS | 没有重跑 `perf.mjs`；我自己的压测：550 KB 页面 2.3 s，1.6 MB 页面 14.3 s | 结论成立，但描述有出入（A-41） |
| V-12 | PASS（6 份 MANIFEST） | 6/6 OK；回交包解压后也是 6/6 OK | 一致 |
| V-13a、V-13b | PASS | 两份 `summary.json` 都是 30/30；去掉 T02、T04 后，codex 4 页零 error，claude 18 页零 error；`environment_observed` 与 `agent.log` 一致。我检查了 aria-hidden 回归（A-32）是否改变了零 error 页面的统计：没有改变（逐页核对，只有 claude 016 有变化，原因是 C13 的代码块降级，属于合理变化） | 数字可信；口径已标为「用户环境基线」 |
| V-14 | PASS（140） | 仓库内 140/140；回交包解压重建后 140/140 | 一致 |

**一致性**：`results.json` 和 VERIFICATION_REPORT 的数字相互一致（测试数、V-04 的 102、MANIFEST 份数、基线三个版本的数字）。

**回交包**：
- 共 2002 个条目；
- 含 `.git`，解压后 `git status` 干净，HEAD 为 `5a63b53`；
- 不含 `node_modules`、`dist`，也不含字体文件；
- `docs/verification/iter_1`、`iter_2`、两份审计报告都在包里。

---

## 7. 没能核查的部分及原因

1. **真实超时场景**：A-34 是用注入时钟复现的，没有构造真正跑满 20 秒的页面（单个视口要超过 20 秒才会触发）。
2. **真实浏览器渲染**：RULING-02、RULING-03、A-38 都是按 CSS 层叠规范推理的，W1 没有完整档，无法渲染验证。
3. **claude 侧实际加载了哪些 skill、用的什么模型**：`claude -p` 的输出里没有这些信息，和执行方一样标「待确认」。
4. **`AUDIT_iter1.md` 被谁修改过**：从仓库里无法判断是谁、在什么时候改了措辞（A-42）。
5. **W3C 原文、npm 包名是否被占用**：禁止联网，和 iter_1 一样无法核查。

---

## 附：开放决策（在执行方 D-1 到 D-8 之外新增）

1. **A-38**：是否把 `measure.css` 包进 `@layer measure`，并相应修改 PRD §7.4 的锁定代码块？（审计方建议在 W2 开工前定下来。）
2. **A-36**：`resolved: true` 是否必须附上用户裁定的原话和日期？（审计方建议必须附上。）
3. **A-37**：`HY` 前缀加不加？如果不加，`FZ`、`HanYi` 是否同样移除？
