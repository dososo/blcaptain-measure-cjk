# 分寸 · Measure（measure-cjk）W2 · 发布准备验证报告

| 项 | 内容 |
|---|---|
| 当前步骤 | 8 步流程第 7 步「审计验收」：按独立审计 AUDIT_RELEASE 整改完毕，送审计方复核 RA-01–RA-03 |
| 执行方 | Claude Code（用户指示全部由 Claude Code 闭环） |
| 范围 | npm 包 `measure-cjk@0.1.0`（只打包，不发布）、6 个主题、Claude Code 和 Codex 插件清单、安装脚本、展示页 |
| 机器判定 | `docs/verification/w2/release/results.json`（`node scripts/verify-release.mjs`，在干净工作树上运行） |
| 拍板 | `open_decisions.json`：O7、R-1、D-1–D-6 都已拍板，附用户原话（D-1–D-6：「D-1 至 D-6 都按你的推荐办。」，2026-10-26） |
| 审计 | `audit/AUDIT_RELEASE.md`（RA-01–RA-23）→ 复核 `audit/AUDIT_RELEASE_r2.md`（RA-01–RA-03 已关闭，有条件达标；新增 RB-01–RB-03 都是 Low，已修）；响应矩阵 `audit/AUDIT_RESPONSE_RELEASE.md` |
| 对外发布 | **没有发布任何东西**：没有 `npm publish`，没有建 GitHub 仓库、推送、开 Pages。用户的要求是「对外发布前再问我」 |

---

## 1. 结论

以 `results.json` 为准，本节照录机器判定，不另下结论。

- 结论三态的规则：任务门（RV-01–RV-08、RV-10、RV-11）和回归门（RV-09）都通过、工作树干净、本报告章节齐全，才可能「达标」；有只影响「能不能对外发布」的待拍板事项（`blocks_publish`）时，最多「有条件达标」。
- D-1–D-6 已由用户拍板并落实（README_PACKAGE.md 移出仓库；配色记为已知偏差；Claude 插件市场改名为 `blcaptain-measure-cjk` 并用 RV-10 重测安装；A 系列规则推迟到 v0.2），没有待拍板事项。
- RA-01–RA-03（审计的达标条件）已由审计方复核关闭（`audit/AUDIT_RELEASE_r2.md`，审计方用真实 `npm install` 复现）。复核新发现的 RB-01–RB-03 都是 Low，已修，按约定不另开复核轮。

## 2. 断言逐条

各条的状态和说明以 `results.json` 为准，真实输出在 `evidence/`。临时目录在日志里统一写成 `<tmp>`。

| 编号 | 内容 | 证据 |
|---|---|---|
| RV-01 | `npm pack`：包里有 bin、dist、assets、data、README、LICENSE、LICENSE-docs、NOTICE、`npm-shrinkwrap.json`，没有源码和测试；`npm audit --omit=dev` 没有漏洞；记下 integrity，发布后用来核对 `npm view … dist.integrity` | `evidence/npm-pack.log` |
| RV-02 | **RA-01**：从 tarball 全局安装到临时 prefix，`--version` 是 0.1.0；装出来的 14 个依赖版本和 shrinkwrap 一致；在项目目录运行，项目里没有 Playwright 时 `--render` 退出码 2，提示里有全局安装写法；项目里装了 Playwright 时 `--render` 能用；Playwright 只装在全局目录（提示里的另一种装法）时也能用 | `evidence/tarball-install.log` |
| RV-03 | **RA-01 的 npx 场景**：`npx --package=<tarball>`（临时 npm 缓存）运行，项目里装了 Playwright 时 `--render` 能用 | `evidence/npx-run.log` |
| RV-04 | 6 个主题示例页完整档 lint：0 error；warn 都在主题文件里写明了原因 | `evidence/themes-lint.log`、`evidence/themes-lint.json` |
| RV-05 | **RA-02、RA-03**：`test/release.test.js` 全部通过，文件的 SHA-256 和整改前锁定时一致（`release-tests.sha256`；原来用 `git diff 63c55e9` 核对，历史改写后提交号会变，改成按内容核对）；展示页没有 `undefined` | `evidence/release-tests.log`；整改前 `evidence/release-tests-before-fix.log` |
| RV-06 | `validate-skill`（含主题截图链接、字号阶梯、6 处版本号一致）和 `claude plugin validate . --strict` | `evidence/validate.log` |
| RV-07 | **RA-09**：安装脚本的 4 种情况：路径带空格、软链指向别处（不加 `--replace` 不改任何目录）、同名普通目录、未知参数 | `evidence/install-script.log` |
| RV-08 | Codex 插件：临时 `CODEX_HOME` 里从本地仓库 `marketplace add`、`plugin add`，插件目录里有 `SKILL.md` | `evidence/codex-plugin-rerun.log` |
| RV-09 | 回归门：全量测试失败为 0 | `evidence/regression.log` |
| RV-10 | **D-5**：Claude Code 插件市场改名后，临时 `CLAUDE_CONFIG_DIR` 里 `marketplace add`、`plugin install measure@blcaptain-measure-cjk`，列表里是 0.1.0 且已启用 | `evidence/claude-plugin.log` |
| RV-11 | **公开前的本机信息检查**：已跟踪的文本文件里没有本机家目录、用户名、临时目录 | `evidence/local-paths.log`；替换过程 `evidence/scrub-local-paths.log` |

## 2.1 去除本机信息（用户 2026-10-26 要求）

用户原话：「不能公开我的这个邮箱」「移除README_PACKAGE.md、去除本机绝对路径」。

- **本机路径**：`scripts/scrub-local-paths.mjs` 在运行时取本机的家目录、用户名、系统临时目录和仓库位置，按从长到短的顺序替换成 `<仓库>`、`<工作区>`、`~`、`<tmp>`、`user`，日志里被截断成「前半段…」的路径也一并替换；脚本里没有写死任何路径。共替换 376 个已跟踪文件，大部分是 `bench/runs/*/agent.log`。
- **不改变北极星结论**：`bench/run-baseline.mjs` 从 agent.log 里检测「加载了哪些 skill、是否读了 SKILL.md、是否运行了 measure-cjk、对照组是否泄漏」。替换前后对 310 份 agent.log 逐份重算这些字段，0 份不一致（`evidence/scrub-local-paths.log`）。唯一受影响的是 `home_path_in_log`（日志里有没有家目录）：已记录的 summary 以生成时为准；替换后如果用 `--relint-only` 重算，这一项会变成 false。
- **防止再混进来**：`validate-skill` 和 RV-11 都检查已跟踪文件里没有本机信息；`verify-release.mjs` 写证据前先替换。
- **邮箱**：本仓库的提交身份改成「爆裂队长NEXT（BLCaptain） <blteam2026@outlook.com>」（只改了本仓库的 git 配置）。已有的提交历史里还有旧邮箱、`README_PACKAGE.md` 和本机路径，推送前要改写历史，见 §6。

## 3. 依赖与 license

- 包的 `license` 是 SPDX 表达式 `Apache-2.0 AND CC-BY-4.0`：代码 Apache-2.0，字体授权表数据 CC BY 4.0（RA-16）。包里带 `LICENSE`、`LICENSE-docs`、`NOTICE`。
- 运行时依赖 5 个直接、14 个总计（`npm-shrinkwrap.json` 锁定，和仓库根锁文件版本一致）：css-select、domhandler、domutils、htmlparser2、postcss 及其依赖。按 shrinkwrap 里的 `license` 字段：BSD-2-Clause 7 个、MIT 4 个、ISC 2 个、BSD-3-Clause 1 个（source-map-js），没有 AGPL、GPL。
- Playwright 是可选的 peer 依赖（Apache-2.0），不随包安装。
- 截图用的 Noto 字体（OFL-1.1）放在仓库外，不进包、不进仓库。

## 4. 已知局限（台账）

1. **主题配色没有从实物采样**（RA-14）：用户同意这一版作为已知偏差发布（D-2），主题文件和 ROADMAP 都写明了。
2. **7 款系统字体不在授权表里**（RA-05）：按用户拍板（D-4）注明「授权表未收录，系统调用」，补表放 v0.2（ROADMAP）。
3. **授权表里方正仿宋的两个名字档位不同**（RA-19）：「方正仿宋」命中 🔵，「FZFangSong」命中 🔴。要直读方正官方原文核对后改表，这一轮没有做。
4. **项目级 `.agents/skills/` 是否被 Codex 发现，没有测**（RA-08）：README 已标待确认。
5. **插件安装会拷整个仓库**：包括约 32 MB 的实验数据（ROADMAP「发布体积」）；用户同意随仓库公开（D-1）。
6. **A02–A07、A09、A12 没有实现**：CLI 里标「计划中，未实现」；推迟是否获批待用户确认（D-6）。
7. **npm 和 GitHub 上的真实安装还没测**：要等发布之后，按 `RELEASE_PREP.md` §4 第 4 步复验。

## 5. 需要审计方裁定

审计方在 AUDIT_RELEASE_r2 里对下面 3 个问题都裁定「成立」；第 3 条附带建议发布前跑 `npm audit`，已加进 RV-01 和 `RELEASE_PREP.md` §4。

1. RA-01 的修法：从当前工作目录解析 Playwright。验证用的是真实 tarball 的全局安装和 npx，而不是只用 `release.test.js` 模拟的分开安装。这样是否满足复核要求？
2. RA-05、RA-19、RA-21 只是部分落实，剩下的部分在等用户拍板，所以没有写成「已落实」。这样处理是否成立？
3. RA-06 加了 `npm-shrinkwrap.json`。它会把传递依赖锁死，用户装的时候拿不到依赖的补丁版本，要等发新版才能更新。这个取舍是否成立？

## 6. 下一轮建议

1. 推送前改写提交历史（旧提交里有个人邮箱、`README_PACKAGE.md` 和本机路径），方式等用户定；然后按 `RELEASE_PREP.md` §4 发布，顺序是：npm（用户自己登录、发布）→ 核对 integrity → 建仓库、推送 → Pages → 从 GitHub 复验三种安装方式。建仓库、推送前再问用户一次。
2. 直读方正官方原文，核对仿宋两个名字的档位（台账第 3 条）。
3. 实测项目级 `.agents/skills/`（台账第 4 条）。
