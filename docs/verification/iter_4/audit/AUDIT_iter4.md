# 分寸 · Measure（measure-cjk）W1 · iter_4 最终复核审计报告

- **当前步骤**：8 步流程第 7 步「审计验收」（最终复核），由 Claude Code 作为独立审计方执行。
- **审计日期**：2026-10-25（20:30–20:45 CST）。
- **审计对象**：仓库 HEAD 为 `64b7ba2`。iter4 新增 5 个 commit：
  1. `7e37682`：整改前锁定；
  2. `fb302fd`：整改；
  3. `e6267bd`：按用户拍板并入 PRD；
  4. `8a15b57`：修改 verify.mjs 里 V-13b 的说明；
  5. `64b7ba2`：提交证据。
- **回交包**：`measure-cjk_delivery_iter_4.zip`，SHA-256 为 `1bd0bd87…6f90`，与同名 `.sha256` 文件一致。
- **审计依据**：
  - `iter_4/VERIFICATION_REPORT.md` §9（对 AUDIT_iter3 的响应矩阵）；
  - `results.json`、`evidence/`、`open_decisions.json`；
  - `docs/PRD.md`、`RULINGS.md`、`PRD_CHANGE_PROPOSALS.md`；
  - 协调方转述的用户原话。
- **审计方式**：只读。
  - 没有运行 verify.mjs 和 package.mjs，没有联网，没有提交。
  - 「修复前」的结果是这样取得的：用 `git archive 7e37682` 解出到 scratchpad，单独编译后运行测试。
  - 测试页面都放在 scratchpad 里。

---

## 1. 结论

**达标**（按用户修改后的契约判定：H14 已追认，H10 已放宽）。

**一句话理由**：AUDIT_iter3 的 8 条发现全部落实，修复前锁定的测试确实失败过。iter1 到 iter3 共 51 条发现里，没有一条处于「未落实」状态。V-01 到 V-14 我都重跑过，结果一致。H1 到 H16 按修改后的契约全部满足。回交包完整，能重建，测试 153/153 通过。

**本结论的前提（审计方无法自行核实）**：
- 我看不到用户与执行方的对话。
- `open_decisions.json` 里的原话，我只核对了它与协调方转述的版本是否**逐字一致**（结果一致，见 §3）。
- 原话的真实性**必须由用户本人确认**。如果用户否认其中任何一条 D-1 到 D-5，本结论回落为「未达标」，因为 H14、H10 会重新变为违约。

**剩余事项**：只有 4 条 Low（§2），都不影响达标；另有 W2 待办（C20、D-3 隔离重跑、A-46）。

---

## 2. 发现清单（iter_4 新发现）

**统计**：Blocker 0 条，High 0 条，Medium 0 条，Low 4 条。编号接着上一轮继续。

| 编号 | 位置 | 问题 | 修法 |
|---|---|---|---|
| A-52 | `README_PACKAGE.md` 第 15–21 行 | 审计报告只列到 iter2，缺少 `AUDIT_iter3.md` 和本报告。第 21 行还写着「`docs/PRD.md`（恢复到 iter1 审计时的版本）」，但 iter4 已经把 C10–C20 并入 PRD，这句话已经不对。 | 改为「最新一轮审计见 `iter_<N>/audit/`」，并更新 PRD 那一行。 |
| A-53 | `docs/PRD.md` §7.3 第 466 行 | 引用了 `Partial<Thresholds>`，但 PRD 里没有定义 `Thresholds` 这个类型（`MeasureConfig.thresholds` 是内联写的对象类型）。实现和输出不受影响，只是文档里的类型名对不上。 | 在 §7.3 补上 `Thresholds` 的定义，或者改成内联写法。 |
| A-54 | 回交包 | 本报告（AUDIT_iter4）是在打包之后才写的，所以 iter4 的 zip 里没有最终审计结论。 | 用户或审计方直接提交本报告后，重新打一个回交包，或者把本报告作为附件随包交付。 |
| A-55 | `docs/PRD.md` §5.1 第 190 行、§7.4 第 525 行 | 「不会覆盖用户样式」「用户自己的样式永远优先」这两句话仍然留在 PRD 正文里。用户已经把纠正方案定为 C20，放到 W2 做；SKILL 和 README 也都如实写了这一点。 | W2 做 C20 时，把这两句一起改掉。 |

---

## 3. 用户原话核对（第 2 项要求）

我用程序把 `open_decisions.json` 里的字段和协调方转述的原话逐字比对（包括全角的「＠」和破折号「–」），结果如下：

| 事项 | `user_message_verbatim` 与转述是否逐字相同 | `user_quote` 是否是转述原文的子串 | `resolved` / `resolved_on` | `blocks_verdict` |
|---|---|---|---|---|
| D-1 | 相同 | 是（「D-1 追认 PRD 修改并并入 C10–C19」） | true / 2026-10-25 | true |
| D-2 | 相同 | 是 | true / 2026-10-25 | true |
| D-3 | 相同 | 是 | true / 2026-10-25 | true |
| D-4 | 相同 | 是 | true / 2026-10-25 | true |
| D-5 | 相同 | 是 | true / 2026-10-25 | true（A-44 已落实） |
| D-9 | 相同 | 是 | true / 2026-10-25 | false（W2 事项） |
| D-6、D-7、D-8 | 没有原话字段 | `user_quote` 为空 | false | false |
| D-10 | — | — | false，带 `closed_by_auditor` | false |

- 用户原话没有对 D-6、D-7、D-8 单独表态，这三项保持未决、不阻塞结论，这样处理正确。
- D-10 按审计方的澄清关闭，没有冒用用户的名义，处理正确。
- **局限**：以上只证明「执行方记录的内容 = 协调方转述的内容」，不能证明「协调方转述的内容 = 用户的原话」。后者需要用户本人确认。

---

## 4. 矩阵逐条复核（AUDIT_iter3 的发现）

| 发现 | 执行方状态 | 复核结论 | 证据 |
|---|---|---|---|
| A-44 | 已落实 | 确认落实 | D-5 的 `blocks_verdict` 为 true，已带原话拍板 |
| A-45 | 已落实 | 确认落实 | `typesetting.md:11` 现在写的是「`aria-hidden="true"` 的文字仍然检查」，与实现、PRD C14 一致 |
| A-46 | 已落实（写进局限） | 确认，处理成立 | README 的已知局限和 PRD C19 都写明了全大写名会被误判，理由是方正的 PostScript 名本身常是全大写（`FZLTXHK--GBK1-0`），这个理由成立 |
| A-47 | 已落实 | 确认落实 | 我的复现页 `g01-hidden-inline` 现在 0 条 T03；`iter4/T03-pos-hidden-inline-A47` 在 `7e37682` 的构建上**确实失败** |
| A-48 | 已落实 | 确认落实 | 判定逻辑已抽到 `scripts/verdict.mjs`，测试用真实的输入输出断言 `isResolved` 和 `pendingBlockers`，覆盖了原话为空、日期非法、`resolved` 为 false 三种情况；在 `7e37682` 上**确实失败**（当时文件还不存在）；`verify.mjs` 已改为引用这个模块 |
| A-49 | 已落实 | 确认落实 | `perf.mjs` 的注释已改为「约 450 KB」 |
| A-50 | 已落实 | 确认落实 | iter_2 和 iter_3 的 `results.json` 都已加上 `superseded_by`，并如实写明审计结论 |
| A-51 | 已落实（流程） | 确认，已部分核验 | 见 §3：已做逐字一致性核验，真实性待用户确认 |
| A-42 / D-10 | 关闭 | 确认 | `PROVENANCE.md` 已更新为「没有第三方改动」 |
| AUDIT_iter3 §5 的步骤 1–5 | 已落实 | 确认 | 详见 §5、§6 |

**修复前确实失败的证据**：用 `7e37682` 的源码编译后运行 `test/iter4.test.js`，2 项测试 2 项失败，与 `iter4-tests-before-fix.log` 一致。`git diff 7e37682 HEAD -- test/ bench/golden` 为空，说明锁定之后没有动过夹具和测试。

**51 条发现的总账**：
- iter1 的 31 条、iter2 的 12 条、iter3 的 8 条，现在全部是确认落实或处理成立。
- 剩下的只有两条，都已写进局限或 W2 待办：A-46（局限）和 A-38/C20（W2）。
- 撤回 1 条：A-42 的出处部分，属于审计方自己的错误。

---

## 5. PRD 并入是否一致（第 3 项要求）

- `git diff 3b4dafb HEAD -- docs/PRD.md` 的改动只有三类：
  - §7.3：`skipped_inputs.reason` 增加 `timeout`、增加 `threshold_overrides`、`summary.status` 增加 `incomplete`、增加 `filename_prefixes`；
  - 附录 C 开头的授权记录；
  - 附录 C 的 C10–C20。
- C10–C19 与 `PRD_CHANGE_PROPOSALS.md` 的内容一致，只多了两处 iter3 的补充：C14 加了 A-47 的引用，C19 加了 A-46 这条局限。C20 写成「W2 待办」，与用户原话「放到 W2 做」相符。
- **§7.4 没有改动**：diff 里没有 §7.4 的行；`test/assets.test.js` 通过，即 V-10 通过。
- **§7.3 与实现的输出逐字段一致（H6）**：我把 `iter_4/evidence/V-03.json` 和 HEAD 的实际输出，逐个字段和 PRD §7.3 对照过：
  - 顶层是 `schema_version`、`tool`、`run`、`summary`、`disabled_rules`、`fonts`、`findings`；
  - `run` 有 10 个字段，包括 `threshold_overrides`；
  - `summary.status` 的取值包含 `incomplete`；
  - `findings` 里各字段的类型都对得上；
  - `licenses.json` 的 16 个条目字段都在 `FontLicenseEntry` 里，包括 `name_prefixes` 和 `filename_prefixes`。
  - 唯一的瑕疵是 A-53，属于文档里的类型名问题。

---

## 6. H1–H16（按用户修改后的契约，第 4 项要求）

| 编号 | 结论 | 说明 |
|---|---|---|
| H1 技术栈 | 满足 | 依赖没有变化，许可证都是 MIT、BSD、ISC 或 Apache；没有 install 脚本 |
| H2 授权 | 满足 | W3C 许可原文是否逐字一致，因为不能联网，没有核对（与前几轮相同） |
| H3 字体 | 满足 | `git ls-files` 和回交包里都没有字体文件 |
| H4 离线 | 满足 | 运行时有拦截，还有静态导入禁令；源码里没有任何网络调用 |
| H5 路径安全 | 满足 | iter1 到 iter3 的复现我全部重跑过：默认配置是 symlink 时报「指向工作区之外，已拒绝」；`--root` 传绝对路径正常；`--out` 的各种越界写法都被拒绝 |
| H6 结果文件 | 满足 | §7.3 与输出一致；文件先写临时文件再 rename；`--out` 有校验 |
| H7 不设绕过 | 满足 | 没有 `--force`；阈值只能往严格的方向调；`MEASURE_PAGE_BUDGET_MS` 只能调低 |
| H8 退出码 | 满足 | 有 error 一律返回 1；超时返回 2（这个语义在 C17 里，已随 D-1 追认）；`--render` 返回 2；不支持的输入返回 2 |
| H9 skill 格式 | 满足 | validate-skill 38 项全部通过 |
| H10 不碰用户环境 | 满足（按 D-5 放宽后的版本） | 没有安装任何 skill；31 个会话目录按用户决定保留 |
| H11 字体数据 | 满足 | 没有依据的字段都已标为 unknown；有 `field_semantics`；verified_at 和原文链接齐全 |
| H12 不用 mock | 满足 | 真实解析，真实基线 |
| H13 范围冻结 | 满足 | C20 和完整档都放在 W2 |
| H14 只读基线 | 满足（按 D-1 追认后的版本） | PRD 的修改有授权记录；`docs/research/*` 没有改动 |
| H15 外部内容不可信 | 满足 | — |
| H16 Git | 满足 | 没有 remote；每一批都有中文 commit |

---

## 7. results.json、报告、回交包（第 5 项要求）

- **`results.json`**：
  - `git_head` 是 `8a15b57`；下一个提交 `64b7ba2` 只新增了 `iter_4/` 目录下的文件（已用 `git diff --name-only` 核对）。
  - `dirty` 为 false；`verdict_blockers` 为空，`verdict_conditions` 为空；`verdict` 为「达标」。
  - 与报告第 1 节一致。
- **V-13b 的说明**：「由 Claude Code 代跑，用户已追认（2026-10-25，原话「D-4 追认」）」。这句话是 verify.mjs 根据 D-4 当前的状态动态生成的，不是写死的。它和报告第 3 节、`open_decisions.json` 一致。
- **我重跑的结果与执行方一致**：
  - V-01：38 项通过；
  - V-02：没有输出；
  - V-03：0 个 error、3 个 warn；
  - V-04：102 项；
  - V-07：退出码 2；
  - V-08：🔴、🔵、🟢 都正确；
  - V-10：通过；
  - V-12：8 份 MANIFEST 全部 OK；
  - V-14：153/153。
  - `dist` 与 `src` 编译结果一致。V-11 没有重跑，证据记录如实。
- **回交包**：
  - 哈希一致；HEAD 为 `64b7ba2`；`git status --ignored` 为空。
  - 不含 `node_modules`、`dist` 和字体文件。
  - 包含 `README_PACKAGE.md`、iter_1 到 iter_4 的全部验证材料，以及 iter1 到 iter3 的审计报告。
  - 解压后链接依赖、重新编译，测试 153/153 通过，8 份 MANIFEST 全部 OK。
  - 缺本报告，见 A-54。

---

## 8. 没能核查的部分

1. **用户原话的真实性**：我只能核对记录与转述是否一致（§3），真实性需要用户本人确认。
2. **真实浏览器里的表现**：W1 没有完整档，`@layer`、`aria-hidden`、`:root:lang(zh)` 在中英混排页面上的结论，都是按规范推理得出的。
3. **W3C 原文是否逐字一致、npm 包名是否被占用**：不能联网，没有核查。
4. **真实的 20 秒超时**：只用 `MEASURE_PAGE_BUDGET_MS=0` 验证过，没有真的跑满 20 秒。
