# 审计响应矩阵：AUDIT_RELEASE（W2 发布准备）

| 项 | 内容 |
|---|---|
| 流程位置 | 8 步流程第 7 步「审计验收」的整改；执行方：Claude Code（用户指示全部由 Claude Code 闭环） |
| 对应审计 | `audit/AUDIT_RELEASE.md`（RA-01–RA-23，结论「未达标」） |
| 整改规则 | 用户定的「按你提议来」：Blocker、High 修完后请审计方复核；Medium、Low 修掉便宜的，其余记台账，不另开一轮 |
| 回归测试 | `test/release.test.js`：在整改前写好，提交 63c55e9 锁定；整改前 4 项全部失败（`evidence/release-tests-before-fix.log`），整改后全部通过（`evidence/release-tests.log`） |
| 验证 | `node scripts/verify-release.mjs` → `results.json`、`VERIFICATION_REPORT.md`、`evidence/*.log` |

## 矩阵

| 编号 | 严重度 | 状态 | 落在哪 | 怎么落的 | 证据 |
|---|---|---|---|---|---|
| RA-01 | Blocker | 已落实 | `packages/cli/src/render.ts`（`launchBrowser`、`INSTALL_HINT`） | 先按包自己的位置加载 Playwright，找不到再从当前工作目录解析（`createRequire(cwd)`），全局安装和 npx 都能用项目里装的 Playwright；两处都没有时仍然退出码 2，提示里补上全局安装的写法 | `evidence/tarball-install.log`（RV-02：真实 tarball 全局安装）、`evidence/npx-run.log`（RV-03）、`evidence/release-tests.log` |
| RA-02 | High | 已落实 | `site/themes/themes.json`、`site/showcase.json`、`site/index.html`、`site/_build.mjs` | 按顺序重新生成；`_build.mjs` 遇到缺 `style`、`fit` 的主题直接报错退出；测试断言展示页没有 `undefined`、主题索引字段不为空 | `evidence/release-tests.log`（RV-05：`undefined` 0 处） |
| RA-03 | High | 已落实 | 4 个主题的 `h2` 和「字号阶梯」表；`scripts/validate-skill.mjs` | `h2` 字重 500 → 400；校验脚本解析每个主题的字号阶梯表，字号更大的行字重不能更重；测试在浏览器里量 6 个示例页的计算样式 | `evidence/validate.log`（RV-06）、`evidence/release-tests.log` |
| RA-04 | Medium | 已落实 | 5 个主题的 `p, li` | 行高写在 `p, li` 上，不再靠 `body` 继承（会被 `measure.css` 盖掉）；宋刻主题改成固定行距 `--row` 的界栏 | 计算样式由 RA-03 的测试一并量到；`evidence/themes-lint.json` |
| RA-05 | Medium | 已落实（用户拍板 D-4） | 6 个主题的「字体说明」行；`SKILL.md` 第 9 步 | 先按修法 ② 落实：注明 7 款系统字体授权表未收录，只调用、不自托管，汇报时写「授权表未收录，系统调用」。修法 ①（补授权表）要不要做，列为开放决策 D-4 | `skills/measure/references/themes/*.md` |
| RA-06 | Medium | 已落实 | `SKILL.md` frontmatter 和「命令」；`README.md` FAQ；`packages/cli/npm-shrinkwrap.json`；`RELEASE_PREP.md` §4 | frontmatter 改成「校验器离线运行，第一次用 npx 获取时要访问 npm registry」；命令一节补上 `--version` 核对、npx 失败就停下报告、全局安装固定 `@0.1.0`；包里加 shrinkwrap 锁住 14 个传递依赖（版本和根锁文件一致），并写进 `files`；发布步骤加 `dist.integrity` 核对 | `evidence/npm-pack.log`（包里有 shrinkwrap）、`evidence/tarball-install.log`（装出来的依赖版本和 shrinkwrap 一致） |
| RA-07 | Medium | 已落实（修法 ②） | `README.md` 两处 | 改成「维护者的校验脚本在核验超过 180 天时会提醒复核」，不再说用户侧「自动提醒」 | `README.md` |
| RA-08 | Medium | 已落实 | `README.md` 安装一节 | 只写实测过的 `~/.agents/skills/`、`$CODEX_HOME/skills/`；项目级 `.agents/skills/` 标「待确认」 | `README.md` |
| RA-09 | Medium | 已落实 | `scripts/install_skill_links.sh` | 先检查两个目录，都通过才统一建链接；软链指向别处时不改任何目录，用户加 `--replace` 才替换；未知参数退出码 2；`$HOME` 带空格也能装 | `evidence/install-script.log`（RV-07，4 种情况） |
| RA-10 | Medium | 已落实 | `broadsheet.md`「该做」 | 补一句：报头（`.kicker`）单行、行高 1.5，T06 会报 warn，属单行误报，见 ROADMAP | `evidence/themes-lint.json`（2 条 warn 都在主题文件里写明原因） |
| RA-11 | Medium | 已落实 | 6 个主题文件的「截图」行；`validate-skill.mjs` | 每个主题加发布后的截图地址；校验脚本检查链接存在、id 对得上、仓库里有这张图 | `evidence/validate.log` |
| RA-12 | Medium | 已落实 | `CHANGELOG.md` | 版本标题改成「v0.1.0（未发布）」，发布当天再填日期；基础档规则范围改成「T01–T09、T11、T13、F03」 | `CHANGELOG.md` |
| RA-13 | Medium | 已落实 | `scripts/verify-release.mjs`；`docs/verification/w2/release/` | 新增发布验证脚本：打包、tarball 全局安装、npx、主题 lint、回归测试、校验、安装脚本、Codex 插件、全量回归，产出证据三件套 | `results.json`、`VERIFICATION_REPORT.md`、`evidence/` |
| RA-14 | Medium | 已落实（用户拍板 D-2：已知偏差） | 主题文件「配色是设计取值 … 待确认」 | 列为开放决策 D-2 | `open_decisions.json` |
| RA-15 | Low | 已落实；推迟是否获批待确认 | `packages/cli/src/rulesMeta.ts` | 默认标题改成「中文 AI 味反模式（计划中，未实现）」。A02–A07、A09、A12 推迟到 v0.2 是否获批，列为开放决策 D-6 | `measure-cjk rules` 输出 |
| RA-16 | Low | 已落实 | `packages/cli/package.json` | `license` 改成 `Apache-2.0 AND CC-BY-4.0` | `evidence/npm-pack.log` |
| RA-17 | Low | 已落实 | `songke.md` 的 `em`；README、主题风格说明 | 着重号改到上方（`over right`），截图里落在本行界栏内、不压线；README 删掉「可选竖排」，主题文件注明示例页没有竖排示例 | `site/shots/theme-songke.jpg` |
| RA-18 | Low | 已落实 | 6 个主题的「字体说明」行 | 注明 Noto、思源字体自带西文字形，所以字体栈前面没有另写西文字体 | 主题文件 |
| RA-19 | Low | 部分落实 | `songke.md`「用法」 | 改成按授权表分别写：方正仿宋 🔵、汉仪仿宋 🔴；英文名 FZFangSong 命中 🔴，和中文名不一致，记台账，另行直读方正官方原文核对 | 主题文件；台账见 `VERIFICATION_REPORT.md`「已知局限」 |
| RA-20 | Low | 已落实 | `validate-skill.mjs` | 6 处版本号（SKILL.md 两处、npm 包、shrinkwrap、两个插件清单）必须一致 | `evidence/validate.log` |
| RA-21 | Low | 已落实（用户拍板 D-5：市场改名，RV-10 重测） | `SKILL.md`、`.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json` | 作者统一为「爆裂队长NEXT（BLCaptain）」；Claude 市场名改不改列为开放决策 D-5 | `evidence/validate.log`（`claude plugin validate --strict` 通过） |
| RA-22 | Low | 已落实（用户拍板 D-1：README_PACKAGE.md 移出仓库） | `ROADMAP.md`、`RELEASE_PREP.md`、`INSTALL_CHECK.md` | 按 `git ls-files` 实测改成「约 32 MB（仓库已跟踪文件共约 37 MB）」；`README_PACKAGE.md` 是否公开并入开放决策 D-1 | 上面三个文件 |
| RA-23 | Low | 已落实 | `README.md` 手动安装 | 补 `npm install -g ./packages/cli`，把本地构建的校验器放到 PATH 上 | `README.md` |

## 请审计方复核

- RA-01、RA-02、RA-03（达标条件）：复核命令见 `VERIFICATION_REPORT.md`「断言逐条」，以及 `node --test test/release.test.js`、`grep -c undefined site/index.html`、`node scripts/validate-skill.mjs`。
- 部分落实的 RA-05、RA-19、RA-21，以及台账里的 RA-14，都在等用户拍板（`open_decisions.json` D-2、D-4、D-5），这几条不计入「已落实」。

## 复核轮（AUDIT_RELEASE_r2）

审计方复核结论「有条件达标」：RA-01–RA-03 已关闭（亲自用真实 `npm install` 复现），VERIFICATION_REPORT §5 的 3 个问题都裁定成立；条件是用户拍板 D-1、D-2、D-5、D-6，以及发布后从 npm、GitHub 实装复验。新发现 3 条 Low，修法都很便宜，这一轮直接修掉，按约定不另开复核轮。

| 编号 | 严重度 | 状态 | 落在哪 | 怎么落的 | 证据 |
|---|---|---|---|---|---|
| RB-01 | Low | 已落实 | `site/_build.mjs` | 主题的风格、适合场景写进展示页时去掉 Markdown 反引号；`site/index.html` 里反引号 0 处 | `site/index.html:268` |
| RB-02 | Low | 已落实 | `README.md`「隐私与安全」 | 补一条：完整档会加载当前项目里的 Playwright，不要在不信任的目录里运行 `--render` | `README.md` |
| RB-03 | Low | 已落实 | `skills/measure/SKILL.md`「命令」 | 写明 Playwright 要装在当前项目里、在项目目录里运行；没装时先问用户，不自己安装 | `SKILL.md` |

审计方建议发布前跑一次 `npm audit`：写进 `RELEASE_PREP.md` §4 第 1 步之前。

## 用户拍板后（2026-10-26）

用户原话：「D-1 至 D-6 都按你的推荐办。」落实情况：D-1 `README_PACKAGE.md` 移出仓库并加进 `.gitignore`（本地保留）；D-2 主题文件和 ROADMAP 记为已知偏差；D-3 更新用户全局 CLAUDE.md 的 Codex 路径事实；D-4 维持注明、补表进 ROADMAP；D-5 `.claude-plugin/marketplace.json` 改名为 `blcaptain-measure-cjk`，README、展示页同步，新增 RV-10 在隔离配置目录里重测安装；D-6 ROADMAP、CHANGELOG 写明 A 系列推迟到 v0.2。RA-19 仍是部分落实（方正仿宋两个名字档位不一致，待直读方正原文），记 ROADMAP。
