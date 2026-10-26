# W2 发布准备：npm 包、6 个主题、README

| 项 | 内容 |
|---|---|
| 日期 | 2026-10-26 |
| 用户要求 | 「准备npm包并做6个主题，随仓库一起展示，仓库：https://github.com/dososo；参考我的历史仓库结构和框架来发布和写readme（https://github.com/dososo/blcaptain-lingjian-video）」；仓库名选了 blcaptain-measure-cjk（`open_decisions.json` R-1） |
| 对外发布 | **还没有**。npm publish、建 GitHub 仓库、推送、开 Pages 都要用户确认，见 §4 |

## 1. npm 包 `measure-cjk`

- `packages/cli/package.json` 补上 `repository`、`homepage`、`bugs`、`keywords`、`author`、`prepack`；`files` 加上 `README.md`、`LICENSE`、`LICENSE-docs`、`NOTICE`（构建时由 `scripts/sync-assets.mjs` 从仓库根目录复制进来）。
- `npm pack`：44 个文件，94.4 kB（解压后 297.5 kB）。
- 从 tarball 装进空项目（`npm install ../measure-cjk-0.1.0.tgz`）：`measure-cjk --version` 输出 0.1.0；`lint` 正确报出 T02、T03、T04，退出码 1；`fonts "霞鹜文楷"` 返回 🟢；`init` 生成配置和 `measure.css`。
- npm 上 `measure-cjk` 这个名字没有被占用（2026-10-26 `npm view` 返回 404）。
- `SKILL.md` 改成发布后的用法：先 `command -v measure-cjk`；没有就用固定版本的 `npx --yes measure-cjk@0.1.0`，或者请用户 `npm install -g measure-cjk`。**因此 npm 必须先于 GitHub 发布。**

## 2. 按参考仓库补的发布框架

- Codex 插件：`.codex-plugin/plugin.json`（`skills: "./skills/"`）、`.agents/plugins/marketplace.json`。隔离环境里 `codex plugin marketplace add <仓库>` 和 `codex plugin add measure@blcaptain-measure-cjk` 都成功，插件目录里有 `skills/measure/SKILL.md`（`evidence/codex-plugin.log`）。
- `scripts/install_skill_links.sh`：软链到 `~/.claude/skills`、`~/.agents/skills`；同名的普通目录不动，直接报错退出。
- README 按参考仓库的结构重写（一句话定位、在线展示页、为什么做、实测、设计支柱、规则示意、主题表格、安装、隐私与安全、路线图、FAQ、关于作者、License），另有 `README.en.md`、`CHANGELOG.md`、`ROADMAP.md`、`.nojekyll`。README 里 20 个本地链接和图片都存在。
- 「关于作者」沿用参考仓库里的公开信息（爆裂队长NEXT（BLCaptain）、@dososo、@thinkszyg、邮箱）。

## 3. 6 个主题

- `skills/measure/references/themes/{broadsheet,manual,archive,quarterly,songke,dososo}.md`，按 PRD §5.3：每个 ≤ 8 KB（最大 3982 字节），传统风 2 个（宋刻、分寸）。每个文件有 CSS 代码块（唯一来源）、字号阶梯（字号越大字重越轻）、字体栈、该做、不该做、示例页链接。配色是设计取值，文件里注明没有从实物采样、待确认。
- 示例页 `site/themes/*.html` 由 `site/themes/_gen.mjs` 从主题文件生成（CSS 原样取出），6 页用同一段文字。`lint --render`：0 error，2 条 warn（报刊报头的单行行高 1.5；宋刻注释为了和界栏对齐，行距 34px），主题文件里写明了原因。
- `scripts/validate-skill.mjs` 加主题检查：6 个、≤ 8 KB、传统风 ≤ 2、必备章节、不用紫色渐变和玻璃拟态。
- 展示页加「6 个主题」一节，截图同样换成思源字体并逐张核对（28 张截图全部合格），展示页自身 lint 零 error。

## 4. 对外发布的步骤

公开信息只用：GitHub @dososo、X @thinkszyg、邮箱 blteam2026@outlook.com（用户 2026-10-26）。提交身份是「爆裂队长NEXT（BLCaptain） <blteam2026@outlook.com>」（本仓库的 git 配置）。

0. **历史和本机信息**（D-8，已做）：旧历史改名 `private-history`，只留在本机、永不推送；公开的 `main` 分支从当前文件新建，没有旧提交。文档里引用的提交号（如 `63c55e9`）在 `private-history` 里，公开仓库里查不到；回归测试的锁定改按 SHA-256 核对（`release-tests.sha256`）。已跟踪文件里没有本机路径（`node scripts/scrub-local-paths.mjs` 命中 0）。
1. **发布前检查**：在 `main` 分支、工作树干净；`node scripts/verify-release.mjs` 结论达标；`npm audit --omit=dev`（在 `packages/cli` 里）没有 high 及以上的漏洞。
2. **npm publish**（用户自己执行：需要 npm 账号登录；账号邮箱已确认是 blteam2026@outlook.com，D-7）。必须在 `main` 上执行，写进包里的 `gitHead` 才能在公开仓库里对上：
   ```bash
   cd packages/cli && npm login && npm publish --access public
   ```
   发布后核对：`npm view measure-cjk@0.1.0 dist.integrity` 要和 `results.json` 里的 `package.integrity` 一致，`npm view measure-cjk@0.1.0 gitHead` 是 `main` 上的提交，一致才进入下一步。
3. **建 GitHub 仓库** `dososo/blcaptain-measure-cjk`（公开），**只推 `main`**：`git push -u origin main`。不要用 `git push --all`，`private-history` 不能推。推送前再问用户一次。
4. **开 GitHub Pages**：main 分支、根目录；展示页地址 `https://dososo.github.io/blcaptain-measure-cjk/site/`。
5. **发布后复验**：从 GitHub 装一遍三种方式，`npx measure-cjk@0.1.0 --version`；在 GitHub 上看提交作者是公开身份，仓库里没有 `README_PACKAGE.md`。

公开范围（D-1，已拍板）：`docs/verification/`、`bench/runs/` 随仓库公开；插件安装时会带上约 32 MB 实验数据（仓库已跟踪文件共约 37 MB，ROADMAP「发布体积」）。
