# 复核报告：AUDIT_RELEASE 第 2 轮（RA-01 至 RA-03 的达标条件）

| 项 | 内容 |
|---|---|
| 流程位置 | 8 步流程第 7 步「审计验收」的复核；审计方：独立审计子 agent（Claude Code） |
| 复核对象 | 整改提交 `07563f0`，验证结果提交 `fa3af81`（HEAD），回归测试锁定提交 `63c55e9` |
| 依据 | `audit/AUDIT_RELEASE.md`（第 1 轮，未达标）；`audit/AUDIT_RESPONSE_RELEASE.md`；`results.json`；`VERIFICATION_REPORT.md` |
| 日期 | 2026-10-26 |
| 未做的事 | 没有发布、推送，没有访问账号；除本报告外，没有改动仓库里的任何文件。临时文件放在 `/tmp/ra2*`，结束时已删除 |

## 结论：有条件达标

第 1 轮给的达标条件 RA-01、RA-02、RA-03 都已落实，每一条都由审计方亲自跑命令复核过（见 §1）。本轮没有新的 Blocker 或 High，新发现只有 3 条 Low。

**条件：** 发布前，用户拍板 `open_decisions.json` 里会阻塞发布的 D-1、D-2、D-5、D-6；发布后按 `RELEASE_PREP.md` §4 第 4 步，从 npm 和 GitHub 实际安装复验一遍。这些属于用户决策和发布后的验证，不是执行方还欠的整改。

| 严重度 | 新发现 |
|---|---|
| Blocker | 0 |
| High | 0 |
| Medium | 0 |
| Low | 3（RB-01 至 RB-03） |

---

## 1. RA-01 至 RA-03 逐条复核

### RA-01（Blocker）：已关闭

`render.ts` 的 `launchBrowser` 先从包自己的位置找 Playwright，找不到再用 `createRequire(join(process.cwd(), …))` 从当前目录解析，然后 `import(pathToFileURL(...))`；两处都失败才报 `INSTALL_HINT`。提示里补上了「在运行 measure-cjk 的项目目录里安装」和全局安装写法。

审计方自己打了包，**用真实的 `npm install`**（执行方证据里，项目里的 playwright-core 是软链到仓库的）跑了 6 种情况：

```text
$ npm pack --pack-destination /tmp/ra2-pack
npm notice 8.3kB npm-shrinkwrap.json
npm notice shasum: f9d6b1bfb1b173a058485390a002c102862afff4
npm notice integrity: sha512-uRih0V6vDedwE[...]YfQ+01eFOpQ7A==
npm notice total files: 45
（integrity 和 evidence/npm-pack.log 第 12 行一致，可复现）

## A: no playwright anywhere（全局 prefix g1）
exit=2
measure-cjk 是全局安装的、又不想改项目时，也可以全局安装：npm install -g playwright-core
## B: playwright-core only in global prefix（g2）
exit=0
通过：1 个文件（含中文 1 个），0 个 error，0 个 warn。完整档：在 360、390、768、1024、1280、1440px 宽度下实测（系统 Chrome 155.0.8059.86（playwright-core）），截图在 evB/。
## C: playwright-core really npm-installed in project（g3）
drwxr-xr-x@ 15 user  wheel  480 Oct 26 16:36 playwright-core
exit=0
通过：1 个文件 …… 截图在 evC/。
## D: npx (isolated cache) + project playwright-core
exit=0
通过：1 个文件 …… 截图在 evD/。      （_npx 目录里 15 个包，没有 playwright：确实是从 cwd 解析到的）
## E: run from a subdirectory of project
exit=0
通过：1 个文件 …… 截图在 evE/。
## card：全局 g3 + 项目里的 playwright-core
card exit=1；输出里「没有找到 Playwright」出现 0 次；按字体授权拒绝出图（PingFang SC 🟡、Times F-UNKNOWN），是预期结果
```

`node --test test/release.test.js`：4 项全部通过。`63c55e9` 之后 `test/release.test.js` 没有改过（`git diff 63c55e9 07563f0 -- test/release.test.js` 没有输出）；整改前的日志 `evidence/release-tests-before-fix.log` 是 `pass 0`、`fail 4`。

### RA-02（High）：已关闭

```text
$ grep -c undefined site/index.html
0
$ git archive HEAD | tar -x -C /tmp/ra2-copy && node /tmp/ra2-copy/site/themes/_gen.mjs && diff -r /tmp/ra2-copy/site/themes site/themes && echo "THEMES IDENTICAL"
生成 6 个主题示例页；传统风 2 个；最大的主题文件 4591 字节
THEMES IDENTICAL
# 变异测试：在副本的 showcase.json 里删掉一个主题的 style
$ node /tmp/ra2-copy/site/_build.mjs
主题 broadsheet 缺少 style 或 fit：先运行 node site/themes/_gen.mjs，再运行 node bench/showcase-build.mjs
build exit=1
```

已提交的 `themes.json` 和生成器的输出完全一致；构建时缺字段会报错退出，这道检查有效。

### RA-03（High）：已关闭

4 个主题的 `h2` 都从 500 改成了 400，表格同步改了。`validate-skill.mjs` 新增了字号阶梯检查，`release.test.js` 在浏览器里量 6 个示例页的计算样式。

```text
$ node scripts/validate-skill.mjs
✓ 主题 manual.md：字号阶梯 5 行，字号越大字重不更重
……
✓ 版本号一致：SKILL.md metadata.version 0.1.0，SKILL.md 里的 npx 固定版本 0.1.0，packages/cli/package.json 0.1.0，.claude-plugin/plugin.json 0.1.0，.codex-plugin/plugin.json 0.1.0，packages/cli/npm-shrinkwrap.json 0.1.0
71 项通过，0 项失败
# 变异测试：在副本里把 manual.md 表格的「章节标题 21px」改回 500
$ node /tmp/ra2-copy/scripts/validate-skill.mjs | grep ✗
✗ 主题 manual.md：字号阶梯 5 行，字号越大字重不更重
```

这项检查能抓住回退。顺带复核了 RA-04：主题的行高写到了 `p, li` 上；宋刻正文在 `.body` 里仍按界栏行距 34px 排，因为 `.body p` 的优先级更高，符合设计。

---

## 2. 对 VERIFICATION_REPORT §5 三个问题的裁定

1. **RA-01 用真实 tarball 的全局安装和 npx 验证，是否满足复核要求？** 满足。审计方另外用真实 `npm install`（不是软链）、子目录运行、`card` 命令复现过，结果一致。
2. **RA-05、RA-19、RA-21 写成「部分落实」，剩下的部分等用户拍板，这样处理是否成立？** 成立。这几条都是 Medium 或 Low，按用户的规则记台账就可以；剩下的部分确实要用户决定（D-4、D-5，以及方正官方原文的核对），没有冒充「已落实」。
3. **用 `npm-shrinkwrap.json` 锁死传递依赖，这个取舍是否成立？** 成立。measure-cjk 主要作为 CLI 用，`SKILL.md` 又通过 `npx --yes …@0.1.0` 自动下载运行，可复现和防供应链漂移比自动拿到依赖的补丁更重要。审计方核对过 shrinkwrap：`lockfileVersion` 3，14 个包都有 `integrity`；`resolved` 全部指向 `registry.npmjs.org`，没有镜像地址；没有混进 dev 依赖。代价是依赖出现安全公告时只能发新版本修复，建议发布前跑一次 `npm audit`，以后有公告就发补丁版本。npm 官方文档对 shrinkwrap 适用场景的说法，本轮没有重新直读，**待确认**。

---

## 3. 新发现

### RB-01（Low）展示页里出现了 Markdown 反引号

- **位置：** `site/index.html:268`。
- **问题：** `_gen.mjs` 把主题文件「风格」一行的原文（含 Markdown 反引号）直接写进 `style` 字段，`_build.mjs` 只做 HTML 转义，页面上就显示成「色板取自 \`dososo-design-system\`。」。

```text
$ grep -n '`' site/index.html
268:<p>米纸、墨、青瓷、朱砂；克制、留白优先。色板取自 `dososo-design-system`。</p>
```

- **修法：** `_gen.mjs` 提取 `style`、`fit` 时去掉反引号，或者转成 `<code>`；RA-02 那条测试顺便断言展示页里没有反引号。

### RB-02（Low）从当前目录加载 Playwright，相当于会执行当前项目 `node_modules` 里的代码，这一点没有写进文档

- **位置：** `packages/cli/src/render.ts`（`fromCwd`）；README「隐私与安全」。
- **问题：** RA-01 的修法本身没问题，用户本来就是在自己的项目里装 Playwright。但这也意味着：在一个不可信的目录（比如刚克隆的陌生仓库，里面带 `node_modules`）里运行 `--render`，会加载那个目录的 `playwright` 包。基础档不受影响。
- **修法：** README「隐私与安全」补一句：「完整档会加载当前项目里安装的 Playwright；不要在不信任的目录里运行 `--render`」。不需要改代码。

### RB-03（Low）SKILL.md 没写 Playwright 要装在哪里

- **位置：** `skills/measure/SKILL.md:86`（「装了 Playwright 时加 `--render`」）。
- **问题：** 修好以后，Playwright 要么装在「运行命令的目录」所在的项目里，要么和全局安装的 measure-cjk 装在同一个全局目录；用 npx 时只能是前者。这些现在只写在报错提示里，Agent 要先失败一次才能知道。
- **修法：** 这一行补半句：「Playwright 装在当前项目里（`npm install -D playwright-core`），在项目目录里运行命令」。

---

## 4. 审计方亲自运行的命令

```text
git log --oneline | head -8; git status --short                          → HEAD fa3af81，工作树干净
git show --stat 07563f0 / fa3af81；git show 07563f0 -- render.ts package.json _build.mjs validate-skill.mjs rulesMeta.ts
git diff 63c55e9 07563f0 --stat -- test/release.test.js                  → 无输出（测试没改过）
npm run build                                                            → 已同步 5 个文件到 packages/cli
node --test test/release.test.js                                         → tests 4，pass 4，fail 0
node scripts/validate-skill.mjs                                          → 71 项通过，0 项失败
（副本）把 manual.md 的 h2 改回 500 后再跑 validate-skill               → ✗ 字号阶梯
（副本）删掉 showcase.json 里一个主题的 style 后跑 _build.mjs           → exit=1
（副本）node site/themes/_gen.mjs && diff -r                             → THEMES IDENTICAL
grep -c undefined site/index.html                                        → 0
npm pack --pack-destination /tmp/ra2-pack                                → 45 个文件，integrity 和证据一致
npm install -g --prefix /tmp/ra2/{g1,g2,g3} --offline <tgz>；A–E 五种情况和 card（见 §1）
解析 npm-shrinkwrap.json（lockfileVersion、resolved 域名、integrity、dev 标记）
安装脚本：外部软链不加 --replace → exit 1，什么都没改；加 --replace → 两处都替换；--force → exit 2（路径带空格）
npm test                                                                 → tests 317，pass 317，fail 0
claude plugin validate . --strict                                        → ✔ Validation passed
node packages/cli/bin/measure-cjk.js lint site/themes --render --evidence site/.evidence --format json
                                                                         → errors 0，warns 2（broadsheet 报头、songke 注释，两条原因都已写进主题文件）
查看 site/shots/theme-songke.jpg 局部                                    → 着重号已移到字上方
```
