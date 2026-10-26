# 审计报告：W2 发布准备（npm 包、6 个主题、README）

| 项 | 内容 |
|---|---|
| 流程位置 | 8 步流程第 7 步「审计验收」；审计方：独立审计子 agent（Claude Code） |
| 审计对象 | HEAD `b25d64a`（工作树干净）；执行方记录 `docs/verification/w2/release/RELEASE_PREP.md`，用户决定 `open_decisions.json`（O7、R-1） |
| 日期 | 2026-10-26 |
| 轮次 | 只做这一轮（用户规则）。Blocker、High 执行方必须修并复核；Medium、Low 记台账 |
| 环境 | macOS（Darwin 25.6.0）、Node 22.17.1、npm（本机）、Claude Code 2.1.296、codex-cli 0.154.0、系统 Chrome 155.0.8059.86 |
| 未做的事 | 没有 `npm publish`、`npm login`，没有建仓库、推送，没有访问任何账号；Codex 只做了不需要登录的 `plugin marketplace add`、`plugin add`（隔离的 `HOME`、`CODEX_HOME`）；`npm view` 只读查询了 registry |

## 结论：未达标

有 1 条 Blocker：按 README、包内 README、`SKILL.md` 写的安装方式（`npm install -g` 或 `npx`），再按提示在项目里装 Playwright，`--render` 和 `card` 永远找不到 Playwright，退出码 2。npm 版本发出去就不能改，`SKILL.md` 又把版本固定成 `0.1.0`，所以**必须在发布 0.1.0 之前修好**。另外有 2 条 High：展示页「6 个主题」一节显示了 12 处 `undefined`；4 个主题的字号阶梯违反「字号越大字重越轻」。

| 严重度 | 条数 | 编号 |
|---|---|---|
| Blocker | 1 | RA-01 |
| High | 2 | RA-02、RA-03 |
| Medium | 11 | RA-04 至 RA-14 |
| Low | 9 | RA-15 至 RA-23 |

**达标条件：** RA-01 至 RA-03 修好，并在复核时附上命令输出（见各条「修法」里的复核命令）。Medium、Low 记台账，进 ROADMAP 或下一轮。

**已核实属实的部分（不另列发现）：**

- `npm pack`：44 个文件、94.4 kB（解压后 297.5 kB），包含 `LICENSE`、`LICENSE-docs`、`NOTICE`、`README.md`；没有多带 `src/`、测试、`node_modules`。
- 从 tarball 装进空项目：`--version`、`lint`、`fonts`、`rules`、`init` 都正常；**本地装 measure-cjk 加本地装 playwright-core**，`--render` 正常。
- 依赖：5 个直接依赖固定版本；传递依赖的 `engines` 都是 `>=20.19.0` 或更宽，和包的 `engines` 一致；授权都是 MIT、BSD、ISC。
- README 的北极星数字和 `docs/verification/w2/northstar/results.json` 逐项对得上（含 p 值和卡片敏感性 9 / 18 / 3、p ≈ 0.146）。
- README 和参考仓库 `dososo/blcaptain-lingjian-video` 的结构对得上（一句话定位、为什么做、设计支柱、主题表、安装、隐私与安全、路线图、FAQ、关于作者、License）；「关于作者」的信息和参考仓库一致。
- `.codex-plugin/plugin.json`、`.agents/plugins/marketplace.json` 的格式和参考仓库一致；隔离环境里 `codex plugin marketplace add`、`codex plugin add` 都成功。
- 6 个主题：数量 6、每个 ≤ 8 KB（最大 3982 字节）、传统风 2 个；示例页的 CSS 确实原样取自主题文件（重新生成后 HTML 逐字节一致，只有 `<style>`，没有内联样式和外链）；`lint --render` 0 error；截图里没有紫色渐变、玻璃拟态、emoji 图标；「分寸」主题的色值和 `dososo-design-system` 一致。
- 仓库里没有字体文件；源码里没有网络和子进程模块；结果文件原子写入。
- 回归：`npm run build && npm test` 313 项全部通过；`validate-skill` 58 项通过；`claude plugin validate . --strict` 通过。
- npm 上 `measure-cjk`、`measurecjk`、`measure_cjk`、`measure.cjk` 都返回 E404。

---

## 发现

### RA-01（Blocker）全局安装或 npx 运行时，找不到项目里装的 Playwright：完整档和 `card` 用不了

- **位置：** `packages/cli/src/render.ts:177-193`（`launchBrowser` 用 `await import(name)` 加载 Playwright）；`card` 也走这里（`card.ts:28` 引用 `runRender`）。文档：`README.md:104、118-124`，`README.en.md:38-39`，`packages/cli/README.md` 的「安装」，`skills/measure/SKILL.md` 的「命令」，以及 `render.ts:36` 的 `INSTALL_HINT`。
- **问题：** `import("playwright")` 从 measure-cjk 自己所在的目录往上找。全局安装时它在 `<prefix>/lib/node_modules/measure-cjk`，`npx` 时在 `~/.npm/_npx/<hash>/node_modules/measure-cjk`，都看不到用户项目里的 `node_modules/playwright`。文档和报错提示让用户 `npm install -D playwright`，装完还是同样的报错，退出码 2。
- **实测：**

```text
$ npm install -g --prefix /tmp/ra-global /tmp/ra-pack/measure-cjk-0.1.0.tgz
added 15 packages in 206ms
$ cd /tmp/ra-proj && ls node_modules/playwright-core >/dev/null && echo "project has local playwright-core"
project has local playwright-core
$ /tmp/ra-global/bin/measure-cjk lint site/x.html --render
错误：用了 --render，但没有找到 Playwright。完整档需要它来驱动浏览器，不会静默降级成基础档。
请先安装：npm install -D playwright && npx playwright install chromium
（本机已有 Chrome 或 Edge 时，只装 npm install -D playwright-core 也可以。）
global+local-pw exit=2

$ npm_config_cache=/tmp/ra-npmcache npx --yes --offline --package /tmp/ra-pack/measure-cjk-0.1.0.tgz measure-cjk lint site/x.html --render
npx+local-pw exit=2      （输出同上）

# 对照：项目里本地装 measure-cjk 和 playwright-core
$ npx measure-cjk lint site/x.html --render
local+local-pw exit=1    （正常跑完 6 种宽度，3 个 error，截图在 evidence/）

# 对照：Playwright 也装进同一个全局 prefix
$ npm install -g --prefix /tmp/ra-global playwright-core@1.64.1
$ /tmp/ra-global/bin/measure-cjk lint site/x.html --render
global both exit=1       （正常）
```

- **为什么是 Blocker：** 完整档（README 设计支柱 1）和小红书卡片导出（设计支柱 5，PRD §5.3 的 P0 场景）是核心承诺。装了 skill 的用户只能走 `npx --yes measure-cjk@0.1.0` 或 `npm install -g`，这两条路都用不了这两个功能，而且报错提示会让 Agent 反复安装、原地打转。npm 的版本发布后不能覆盖，`SKILL.md` 又固定了 `0.1.0`，发布之后就只能再发新版本，同时改 skill。
- **修法（推荐改代码，发布前改）：**
  1. `launchBrowser` 先按现在的方式找；找不到时，再用 `createRequire(join(process.cwd(), "package.json")).resolve(name)` 从当前工作目录找，找到后用 `import(pathToFileURL(path).href)` 加载。只从 cwd 往上找，不搜索用户目录。
  2. `INSTALL_HINT` 改成能照做的提示：说清楚 Playwright 要装在「当前项目」或「和 measure-cjk 同一个全局目录」（`npm install -g measure-cjk playwright-core`）。
  3. 包内 README、仓库 README、README.en、`SKILL.md` 的 Playwright 一节按改后的行为重写；`SKILL.md` 补一句：用 npx 时，完整档和 `card` 需要项目里装了 Playwright。
  4. 加回归测试：在临时目录里装 tarball 到全局 prefix，项目里只装 playwright-core，`--render` 和 `card` 都要成功；另外留一个 npx 场景。
  5. **复核命令：** 重做上面三组实测，把输出存进 `docs/verification/w2/release/evidence/`。

### RA-02（High）展示页「6 个主题」一节显示 12 处 `undefined`

- **位置：** `site/index.html:233-269`；原因在 `site/themes/themes.json`（已提交的版本里没有 `style`、`fit` 字段）和 `site/_build.mjs:46-47`。
- **问题：** `_gen.mjs` 会写出 `style`、`fit`，但已提交的 `themes.json` 是旧版本，没有这两个字段；`bench/showcase-build.mjs` 把旧 `themes.json` 带进 `showcase.json`，`_build.mjs` 直接插进页面，每个主题卡片都显示「undefined」和「适合：undefined」。
- **实测：**

```text
$ grep -c "undefined" site/index.html
12
$ grep -n "undefined" site/index.html | head -2
233:<p>undefined</p>
234:<p class="fit">适合：undefined</p>
$ grep -c '"style"' site/showcase.json
0
$ node site/themes/_gen.mjs   （在 git archive 的副本里）&& diff -r 副本/site/themes site/themes
diff -r .../themes.json site/themes/themes.json
6,7d5
<     "style": "现代报纸。报头、双线、分栏和栏线；标题宋体，正文黑体。",
<     "fit": "长文、资讯、周报、newsletter。",
……（6 个主题都缺）
```

- **为什么：** 用户要求 6 个主题「随仓库一起展示」，展示页是对外的第一印象。`lint` 和截图核对都没拦住，说明构建链少了一步检查。
- **修法：** 依次运行 `node site/themes/_gen.mjs`、`node bench/showcase-build.mjs`、`node site/_build.mjs`，提交新的 `themes.json`、`showcase.json`、`index.html`。`_build.mjs` 里，主题缺 `style` 或 `fit` 时直接报错退出；加一条测试，断言 `site/index.html` 里没有 `undefined`，并且 `themes.json` 和 `_gen.mjs` 的输出一致。**复核：** `grep -c undefined site/index.html` 输出 0。

### RA-03（High）4 个主题违反「字号越大字重越轻」，和表头自相矛盾

- **位置：** `skills/measure/references/themes/{broadsheet,manual,archive,songke}.md` 的 CSS 和「字号阶梯」表。
- **问题：** 这 4 个主题的小标题比导语、正文都大，字重却更重（500 对 400）。表头写的是「字号越大字重越轻」，表里的数据却违反它。浏览器实测：

```text
broadsheet h2 24px/500  lead 19px/400  p 17px/400
manual     h2 21px/500  lead 18px/400  p 16px/400
archive    h2 22px/500  lead 18px/400  p 17px/400
songke     h2 22px/500  lead 19px/400  p 18px/400
quarterly  h2 24px/400  （单调，合格）
dososo     h2 26px/300  （单调，合格）
```

（`/tmp/ra-scripts/lh.mjs` 用 playwright-core 和系统 Chrome，读示例页 `getComputedStyle` 的结果。）

- **为什么：** PRD §5.3 写明「字号阶梯（字号和字重成反比）」，用户的设计硬规则和 `dososo-design-system` 第 3 条也是「越大的字用越轻的字重」。主题文件会被 Agent 原样照抄，表头说法错了会误导使用者；`validate-skill.mjs` 也没有检查这一条。
- **修法：** 4 个主题的 `h2` 改为 400（宋体系可以用 400，`manual` 黑体可以用 400 或 300），同步改表；如果确实要保留 500，必须先请用户拍板放宽规则，再改表头和 PRD，不能默认放宽。`validate-skill.mjs` 加一项检查：解析每个主题的「字号阶梯」表，字号按从大到小排，字重不能增加（表里写成区间的，按区间下限比较）。**复核：** 重新跑 `lh.mjs` 那组测量，再跑 `validate-skill`。

### RA-04（Medium）主题的正文行高写的是 1.8、1.9，实际是 1.75：主题自己踩了 SKILL.md 警告的坑

- **位置：** `broadsheet.md`、`archive.md`、`quarterly.md`、`dososo.md` 的 `body { line-height }` 和「字号阶梯」表；`songke.md` 表里「卷次、署名 … 行高 2」。
- **问题：** `measure.css` 对中文的 `p`、`li` 直接设了 `line-height: 1.75`，主题写在 `body` 上的行高会被它覆盖。`SKILL.md` 第 4 步专门提醒过这一点，主题文件却正好踩了。实测：broadsheet 正文 1.75（表里写 1.8），archive 1.75（写 1.8），quarterly 1.75（写 1.9），dososo 1.75（写 1.8），songke 的 `.meta`、`.kicker` 是 1.75（写 2）。
- **为什么：** 字号阶梯表是给 Agent 照抄的规格，数值不真实会误导使用者；quarterly「宽松行距」的设计意图也没有实现。
- **修法：** 要用的行高写在 `p, li`（或 `:lang(zh)`）上，或者表格按实际值改成 1.75。复核时附上计算后样式的测量结果。

### RA-05（Medium）主题字体栈里有 7 款字体不在授权表里，和 SKILL 的「先查授权」流程冲突

- **位置：** 各主题的 `--serif`、`--song`、`--fangsong`、`--mono`。
- **问题：** `Songti SC`、`STSong`、`STFangsong`、`FangSong`、`SF Mono`、`Menlo`、`Consolas` 用 `fonts` 查都返回 F-UNKNOWN。宋刻主题的「仿宋」完全靠 `STFangsong`、`FangSong` 实现。`lint` 的 `fonts` 汇总里也不列这些字体（实测示例页 lint 的 `fonts` 只有 6 款已知字体）。

```text
$ node packages/cli/bin/measure-cjk.js fonts "STFangsong"
F-UNKNOWN：授权表里没有「STFangsong」。请先查官方授权原文，再决定能不能自托管或出图。
（Songti SC、STSong、FangSong、SF Mono、Menlo、Consolas 输出相同）
```

- **为什么：** 按 PRD F03 ②，只写进字体栈的字体任何档位都放行，所以这里不算违规；但 `SKILL.md` 第 3 步要求「任何字体在写进代码之前先查授权」，第 9 步要求汇报「各自的授权档位」。Agent 用了主题，就要把 7 款「未知」字体报告给用户，或者在「查不到」和「照抄主题」之间自己判断，这和「按最弱模型设计」相冲突。
- **修法（二选一，交用户定）：** ① 授权表补上 Apple、Microsoft 的系统字体条目（像苹方那样，归 🟡，附 SLA 原文）；② 主题文件在字体栈旁注明「这几款是系统字体，只调用、不自托管，授权表暂未收录，汇报时如实写『未收录，系统调用』」，`SKILL.md` 第 9 步补上这种情况的写法。

### RA-06（Medium）npx 兜底需要联网并会自动下载执行代码，和「不需要联网」「默认零网络请求」矛盾；「固定版本」只固定了第一层

- **位置：** `SKILL.md` frontmatter 的 `compatibility: … 不需要联网`；「命令」一节；`README.md:169、194`。
- **问题：**
  1. `npx --yes measure-cjk@0.1.0` 第一次运行要从 npm registry 下载，`--yes` 会跳过确认。frontmatter 却写「不需要联网」。
  2. 包里没有 `npm-shrinkwrap.json`。`@0.1.0` 只固定了 measure-cjk 本身，`css-select` 等的传递依赖（`css-what ^8`、`entities`、`nanoid` 等）按 semver 范围浮动，以后安装可能装到别的版本。
  3. 「或者请用户先 `npm install -g measure-cjk`」没有写版本，和「不要用不带版本号的 npx」前后不一致。
  4. `command -v measure-cjk` 找到就用，不检查 `--version`，旧版本或同名的其他程序也会被直接使用。
  5. 没有写 npx 失败时怎么办（离线、registry 不通、发布前出现 404），Agent 可能改用不带版本号的写法，或者四处找替代。
- **为什么：** 用户的安全约定是「外部输入不可信、建议命令永不自动执行」；隐私说明和实际行为要一致。「npm 必须先于 GitHub 发布」这个顺序在 `RELEASE_PREP.md` §1、§4 写清楚了。这个顺序同时也是安全前提：仓库公开时，如果包名还没被自己占住，别人抢注 `measure-cjk@0.1.0`，skill 就会让每个用户去执行别人的代码。
- **修法：** frontmatter 改为「校验器本身离线运行；第一次用 npx 获取校验器时需要访问 npm registry」。命令一节补三点：先 `measure-cjk --version` 确认是 0.1.0；npx 失败时停下告诉用户，不换写法；全局安装写成 `npm install -g measure-cjk@0.1.0`。包里加 `npm-shrinkwrap.json`，把传递依赖锁住。`RELEASE_PREP.md` §4 第 1 步后加一道检查：先 `npm view measure-cjk@0.1.0 dist.integrity`，和本地 `npm pack` 的 integrity 一致，才能进入第 2 步「建仓库、推送」。

### RA-07（Medium）README 说授权表「过期自动提醒」，用户用的校验器里没有这个功能

- **位置：** `README.md:48`「过期自动提醒」，`README.md:192`「超过 180 天自动提醒复核」。
- **问题：** 只有开发用的 `scripts/validate-skill.mjs:62-63` 检查 `verified_at ≤ 180 天`；`packages/cli/src` 里 `verified_at` 只用来显示日期（`cli.ts:151`、`card.ts:121`、`rules.ts:327`），没有任何过期判断。

```text
$ grep -rn "180\|stale\|过期\|复核" packages/cli/src/*.ts
（无输出）
```

- **为什么：** 这是合规方面的说法。用户读到「自动提醒」，会以为半年后工具自己会提示数据过期；实际上 0.1.0 会一直输出旧数据，不会提示。
- **修法：** 二选一：① CLI 在 `fonts`、`lint` 的结果里，对超过 180 天的条目加一句「核验已超过 180 天，请复核原文」；② README 改成「维护者的校验脚本会在 180 天后提醒复核；输出里都带核验日期」。

### RA-08（Medium）README 说 Codex 会在项目的 `.agents/skills/` 找 skill，并标了「实测」，但这一条没有测过

- **位置：** `README.md:116`。
- **问题：** `INSTALL_CHECK.md` 只用 `codex exec` 测了用户级的 `~/.agents/skills/` 和 `$CODEX_HOME/skills/`（`evidence/codex-agents.log`、`codex-codexhome.log`）。项目级 `.agents/skills/` 只是 `npx skills` 把文件放在了那里，没有测 Codex 能不能发现它。本轮没有账号权限，无法复测，**待确认**。
- **为什么：** 用户约定「不假装已核验」，而且 Codex 路径曾经被博客写错过。另外，执行方对用户级路径的实测结论（0.154.0 能发现 `~/.agents/skills/`）和用户全局 `CLAUDE.md` 里「`~/.agents/` 不是 skill 发现路径（0.149.0）」相反；证据日志支持执行方的结论，要不要更新全局约定，需要用户决定（见开放决策 3）。
- **修法：** README 改成「`~/.agents/skills/`、`$CODEX_HOME/skills/` 已在 codex-cli 0.154.0 实测；项目级 `.agents/skills/` 待确认」，或者补一次实测，并附上日志。

### RA-09（Medium）`install_skill_links.sh` 会不提示地替换别人的同名软链；中途失败会只装一半

- **位置：** `scripts/install_skill_links.sh:15-23`。
- **实测（`HOME` 和仓库路径都带空格）：**

```text
## case1 clean install, spaces in paths
- /tmp/ra inst/home dir/.agents/skills/measure -> /tmp/ra inst/repo with space/skills/measure
exit=0                                       （带空格的路径没问题）
## case2 existing symlink pointing to someone else's skill
exit=0
/tmp/ra inst/repo with space/skills/measure  （原来指向 other-measure 的软链被替换，没有任何提示）
## case3 real dir in ~/.claude/skills, partial install?
/tmp/ra inst/home dir/.claude/skills/measure 已存在而且不是软链，没有改动它。请先自己确认后移走。
exit=1
measure -> /tmp/ra inst/repo with space/skills/measure   （~/.agents/skills 已经装上，只装了一半）
```

- **为什么：** 用户的规则是「不覆盖用户的东西」。用户可能已经有另一个叫 `measure` 的 skill 软链，脚本会不提示就换掉它。
- **修法：** 先检查两个目录：如果已有软链，`readlink` 出来的目标不是 `$SRC`，就报错退出（可以加 `--replace` 参数明确确认替换；这不是绕过门禁的开关，而是用户的明确选择）。两个目录都检查通过后，再统一创建链接。

### RA-10（Medium）展示页说「报刊」主题的 T06 warn 原因写在主题文件里，实际没有写

- **位置：** `site/index.html:235`；`skills/measure/references/themes/broadsheet.md`。
- **问题：** 展示页写「示例页 lint：0 error，1 条 warn（T06，主题文件里写明了原因）」，`RELEASE_PREP.md` §3 也这么说；但 `broadsheet.md` 里搜不到 T06 或 warn，只有表格里写着「报头 … 1.5」。宋刻主题确实写了原因。

```text
$ grep -n "T06\|warn" skills/measure/references/themes/broadsheet.md
（无输出）
```

- **为什么：** 这是对外的事实性说法，而且是假的。warn 本身的理由成立：52px 的单行报头用 1.5 行高是合理的，属于 ROADMAP 里已经登记的 T06 单行误报。
- **修法：** 在 `broadsheet.md`「该做」里补一句：「报头单行、字号大，行高 1.5；measure 的 T06 会报 warn（单行元素误报，见 ROADMAP），可以不理」。

### RA-11（Medium）主题文件里没有示例截图（PRD §5.3）

- **位置：** 6 个主题文件的「示例」一行。
- **问题：** PRD §5.3 要求每个主题文件包含「一张示例截图」。现在文件里只有一个指向 GitHub Pages 示例页的链接（发布前打不开）。截图在 `site/shots/theme-*.jpg`，只有 `site/themes/themes.json` 引用了它；用户装 skill 时只装 `skills/measure/`，拿不到截图。
- **修法：** 每个主题文件加一行截图链接，用发布后的绝对地址（Pages 或 raw.githubusercontent），比如 `- 截图：<https://dososo.github.io/blcaptain-measure-cjk/site/shots/theme-<id>.jpg>`；`validate-skill.mjs` 检查每个主题文件都有这一行。

### RA-12（Medium）CHANGELOG 写成已经发布；基础档的规则范围写多了

- **位置：** `CHANGELOG.md:3、5、9、15`。
- **问题：** 「v0.1.0（2026-10-26）首个公开版本」「展示页：`site/`，GitHub Pages 发布」读起来像是已经发布了，实际上还没有。「基础档：T01–T13」也写多了：`rules` 输出里 T10 还没实现（○），T12 只有完整档检查（◐）；`typesetting.md:3` 写的是「T01–T09、T11、T13」。
- **为什么：** 用户特别要求检查有没有暗示已经发布、有没有夸大。
- **修法：** 发布前把版本标题写成「v0.1.0（未发布）」，或者不写日期，发布当天再填；基础档改成「T01–T09、T11、T13、F03」。

### RA-13（Medium）这一轮的证据不完整：缺 results.json、VERIFICATION_REPORT，大部分运行结论没有日志

- **位置：** `docs/verification/w2/release/`：只有 `RELEASE_PREP.md`、`open_decisions.json`、`evidence/codex-plugin.log`。
- **问题：** `npm pack` 44 个文件、从 tarball 试装、`lint --render` 0 error 2 warn、28 张截图合格，这些运行类结论都只有文字，没有日志。本轮审计已经复现了 npm pack、试装、主题 lint，结论属实；截图核对没有复现。
- **为什么：** 用户规定证据三件套（results.json、VERIFICATION_REPORT.md、evidence/*.log）；按审计诚实性判据，运行类结论要附真实命令输出。
- **修法：** 修 RA-01 至 RA-03 时一起补上：`results.json`（每项检查的命令、退出码、结论）、`VERIFICATION_REPORT.md`、`evidence/npm-pack.log`、`evidence/tarball-install.log`（含 RA-01 的全局和 npx 场景）、`evidence/themes-lint.json`、`evidence/regression.log`。

### RA-14（Medium）5 个主题的色板不是从实物素材采样的（已诚实标为待确认）

- **位置：** broadsheet、manual、archive、quarterly、songke 主题文件里「配色是设计取值 … 待确认」；dososo 主题「那份色板的实物采样来源待确认」。
- **问题：** PRD §6 和用户的设计硬规则都要求「色板从真实素材采样，不凭空造色」。执行方如实写了没有采样，这一点不扣分；但它和规则不符，要用户决定。
- **修法：** 交用户选择（开放决策 2）：① 按每个主题对应的实物（新闻纸、牛皮纸档案袋、宋刻本书影、竹纸等，用自己拍的或授权清楚的图片）采样，记下来源；② 用户同意这一版先用设计取值，在主题文件和 ROADMAP 里记为已知偏差。

### RA-15（Low）发布出去的 CLI 里，A02–A12 标着「（W2 实现）」

- **位置：** `measure-cjk rules` 的输出（`rulesMeta`）。
- **问题：** W2 已经结束，这些规则还没实现（ROADMAP 列为后续计划），用户看到会以为它们已经实现，或者「W2」是一个版本号。
- **修法：** 改成「（计划中）」，或者去掉括号里的说明。PRD §10 把 A02–A07、A09、A12 排在 W2 交付里，这次往后推了，有没有用户的批准记录，**待确认**。

### RA-16（Low）包的 `license` 字段只写了 Apache-2.0，包里还有 CC BY 4.0 的数据

- **位置：** `packages/cli/package.json` 的 `"license": "Apache-2.0"`。
- **修法：** 改成 SPDX 表达式 `"Apache-2.0 AND CC-BY-4.0"`，和包内 README 的「授权」一节一致，授权扫描工具也能识别。

### RA-17（Low）宋刻主题：着重号落到栏线下方；竖排没有示例

- **位置：** `songke.md` 的 `em`（`text-emphasis-position: under right`）和 `.vertical`；截图 `site/shots/theme-songke.jpg`，列表第 1 项。
- **问题：** 着重号画在栏线下面，贴着下一行的格子，截图里看起来像几个杂点。README 写着「可选竖排」，示例页没有用到 `.vertical`。
- **修法：** 界栏版式下改用 `text-emphasis-position: over right`，或者给 `em` 留出空间；示例页加一小段竖排，或者 README 删掉「可选竖排」。

### RA-18（Low）主题字体栈没按 T13「先写西文字体」的写法

- **位置：** 各主题的字体栈都从 Noto CJK 开始；`typesetting.md:139` 写的是「先写西文字体，再写中文字体，最后写通用族」。
- **问题：** Noto CJK 自带西文字形，效果上没问题，但和 skill 自己的「怎么做」不一致，Agent 会拿不准该照哪一个。
- **修法：** 主题文件加一句说明：「Noto CJK 自带西文，这里省略西文字体」；或者在字体栈前面加一款 🟢 西文字体。

### RA-19（Low）宋刻主题对方正仿宋的说法和授权表不一致；授权表里方正仿宋的两个名字档位不同

- **位置：** `songke.md` 的「用法」：「方正、汉仪的仿宋多数要商业授权」；`data/fonts/licenses.json`。
- **实测：**

```text
方正仿宋       → 🔵 可出图（image-only）· 命中条目 founder-free
方正仿宋简体   → 🔵 可出图（image-only）· 命中条目 founder-free
FZFangSong-Z02 → 🔴 商用授权（commercial）· 命中条目 founder-commercial
汉仪仿宋       → 🔴 商用授权（commercial）· 命中条目 hanyi-commercial
```

- **问题：** 授权表里方正仿宋是 🔵（出版用途免费，不能自托管）。主题文件把方正和汉仪放在一起说「多数要商业授权」，说得不准确。另外，`FZFangSong-Z02` 一般是方正仿宋简体的 PostScript 名，但它命中的是 🔴 条目，和中文名的档位不一致；这是授权表原有的问题，不属于本轮范围，**待确认**。
- **修法：** 主题文件改成「方正仿宋是 🔵（不能自托管 webfont），汉仪仿宋是 🔴，写进字体栈之前先用 `fonts` 查」；授权表别名的问题记进台账，另行核对。

### RA-20（Low）5 处版本号没有一致性校验

- **位置：** `SKILL.md` 里的 `npx … @0.1.0` 和 `metadata.version`，`packages/cli/package.json`，`.claude-plugin/plugin.json`，`.codex-plugin/plugin.json`。
- **修法：** `validate-skill.mjs` 加一项检查：这 5 处版本号必须相同，以后发版漏改时校验会失败。

### RA-21（Low）作者和市场名不统一

- **位置：** `.claude-plugin/marketplace.json` 的 `owner.name`、`.claude-plugin/plugin.json` 的 `author.name`、`SKILL.md` 的 `metadata.author` 都写「measure-cjk contributors」，`package.json` 和 README 写「爆裂队长NEXT（BLCaptain）」；Claude 市场名是 `measure-cjk`，Codex 市场名是 `blcaptain-measure-cjk`。
- **修法：** 作者统一写 BLCaptain；Claude 市场名要不要改成 `blcaptain-measure-cjk`，和参考仓库保持一致，交用户定（改了就要同步改 README 里的 `measure@…`）。

### RA-22（Low）「约 40 MB」的数字不准确；`README_PACKAGE.md` 会跟着仓库公开

- **位置：** `ROADMAP.md:21`、`RELEASE_PREP.md` §4、`INSTALL_CHECK.md`；仓库根目录的 `README_PACKAGE.md`。
- **实测：** git 跟踪的文件一共 35.6 MB，其中 `bench/runs` 30.7 MB、`site/shots` 1.9 MB、`docs/verification` 1.6 MB。
- **修法：** 改成「约 31 MB（仓库共约 36 MB）」；`README_PACKAGE.md` 是内部交付说明，里面引用了仓库外的路径，要不要公开，并入开放决策 1。

### RA-23（Low）手动安装后，PATH 上没有校验器

- **位置：** `README.md:108-114`。
- **问题：** 克隆、构建、软链之后，`measure-cjk` 不在 PATH 上，skill 会用 npx 去联网下载 npm 上的版本，而不是用本地构建的版本。
- **修法：** 手动安装一节补一行 `npm install -g ./packages/cli`（或者 `npm link -w measure-cjk`），说明这样会用本地构建的校验器。

---

## 待确认（本轮没有核实，不计入通过）

1. Codex 能不能发现项目级的 `.agents/skills/`（RA-08）。需要账号运行 `codex exec`，本轮不允许访问账号。
2. 通过 Codex 插件装的 skill，在会话里能不能被列出来、触发：`codex-plugin.log` 只证明文件装到了插件缓存目录，没有会话里的证据。
3. `npm publish` 会不会被 npm 的包名相似度规则拦下：`npm view` 返回 404 不能保证发布一定成功。
4. 截图核对「28 张全部合格」：本轮只看了 6 张主题截图，没有复现字体核对脚本。
5. A 系列规则推迟到 W2 之后（RA-15），有没有用户的批准记录。

## 开放决策清单（需要用户拍板）

1. `docs/verification/`、`bench/runs/`、`README_PACKAGE.md` 要不要跟着仓库公开（延续 `RELEASE_PREP.md` §4 的待定项）。
2. 主题色板：按实物重新采样，还是这一版先用设计取值并记为已知偏差（RA-14）。
3. 全局 `CLAUDE.md` 里「`~/.agents/` 不是 skill 发现路径」这条约定，要不要按 0.154.0 的实测更新（RA-08）。
4. RA-01 的修法：推荐改代码（从工作目录也能找到 Playwright），并且在 0.1.0 之前修好；另一个办法是只改文档，要求 Playwright 和 measure-cjk 装在同一个全局目录，这样 npx 场景仍然用不了。
5. RA-03：「字号越大字重越轻」是严格执行（推荐），还是允许小标题用 500。
6. RA-05：授权表补收系统字体条目，还是在主题文件里注明「未收录，系统调用」。
7. Claude 市场名要不要改成 `blcaptain-measure-cjk`（RA-21）。

## 审计方亲自运行的命令

```text
git log --oneline | head -5; git status --short                         → HEAD b25d64a，工作树干净
cd packages/cli && npm pack --dry-run                                   → 44 个文件、94.4 kB；含 LICENSE、LICENSE-docs、NOTICE
npm pack --pack-destination /tmp/ra-pack                                → measure-cjk-0.1.0.tgz
(/tmp/ra-proj) npm install --prefer-offline /tmp/ra-pack/measure-cjk-0.1.0.tgz → added 15 packages
npx measure-cjk --version                                               → 0.1.0
npx measure-cjk lint site/x.html                                        → 3 个 error（T02、T04、T13），退出码 1
npx measure-cjk fonts "Noto Sans SC" / rules / init                     → 正常；init 生成 measure.config.json、measure.css
npm install -D --prefer-offline playwright-core@1.64.1; npx measure-cjk lint site/x.html --render → 退出码 1（正常跑完）
npm install -g --prefix /tmp/ra-global <tgz>; /tmp/ra-global/bin/measure-cjk lint site/x.html --render → 退出码 2（RA-01）
npm_config_cache=/tmp/ra-npmcache npx --yes --offline --package <tgz> measure-cjk lint site/x.html --render → 退出码 2（RA-01）
npm install -g --prefix /tmp/ra-global playwright-core@1.64.1; 再跑一次      → 退出码 1（正常）
for f in 14 款主题字体; node packages/cli/bin/measure-cjk.js fonts "$f"   → 7 款 F-UNKNOWN（RA-05）
node packages/cli/bin/measure-cjk.js fonts 方正仿宋 / 方正仿宋简体 / 汉仪仿宋 / FZFangSong-Z02 → 🔵 / 🔵 / 🔴 / 🔴（RA-19）
node packages/cli/bin/measure-cjk.js lint site/themes --render --evidence site/.evidence --format json
    → summary {"files":6,"cjk_files":6,"errors":0,"warns":2,"status":"pass"}；
      warn：broadsheet p.kicker 行高 1.50；songke p.note 行高 2.43
git archive HEAD | tar -x -C /tmp/ra-copy; node /tmp/ra-copy/site/themes/_gen.mjs; diff -r → HTML 一致；themes.json 缺 style、fit（RA-02）
grep -c undefined site/index.html                                       → 12（RA-02）
node /tmp/ra-scripts/lh.mjs（playwright-core + 系统 Chrome，读计算后样式） → RA-03、RA-04 的数据
查看 site/shots/theme-*.jpg（6 张，1280×1000），并裁切 songke 局部       → 无紫渐变、玻璃拟态、emoji；着重号位置问题（RA-17）
gh api repos/dososo/blcaptain-lingjian-video/{contents,README.md,.codex-plugin/plugin.json,.agents/plugins/marketplace.json,scripts/install_skill_links.sh} → 结构比对
HOME=/tmp/ra-codex/home CODEX_HOME=/tmp/ra-codex/codexhome codex plugin marketplace add <仓库>  → Added marketplace `blcaptain-measure-cjk`，退出码 0
HOME=… CODEX_HOME=… codex plugin add measure@blcaptain-measure-cjk      → Added plugin `measure`，退出码 0；缓存 121 MB（本地仓库含 node_modules）
strings <codex 0.154.0 二进制> | grep agents/skills                     → 「….agents.agents/skills, memory」
HOME="/tmp/ra inst/home dir" sh "/tmp/ra inst/repo with space/scripts/install_skill_links.sh"（3 种情形） → RA-09
git ls-files | 统计大小；git ls-files | grep 字体扩展名                 → 35.6 MB；没有字体文件
grep -nE "child_process|node:http|node:net|node:https|fetch\(" packages/cli/src/*.ts → 无输出
npm view measure-cjk / measurecjk / measure_cjk / measure.cjk           → 都是 E404
npm run build && npm test                                               → tests 313，pass 313，fail 0
node scripts/validate-skill.mjs                                         → 58 项通过，0 项失败
claude plugin validate . --strict                                       → ✔ Validation passed，退出码 0
claude plugin validate .claude-plugin/plugin.json --strict              → ✔ Validation passed
```

临时文件都放在 `/tmp/ra-*` 和 `/tmp/ra inst`，审计结束后已删除。仓库里只新增了本报告；`npm run build` 重新生成的 `dist/`、`packages/cli/{LICENSE,LICENSE-docs,NOTICE}`，以及 `site/.evidence/`，都在 `.gitignore` 里。
