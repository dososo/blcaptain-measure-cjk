# 事实核验：skill 分发规范 / 第三方库 / 借鉴对象

- 项目：分寸 · Measure（measure-cjk，主仓 Apache-2.0）
- 核验日期：2026-10-25
- 核验方法：`gh api repos/...`（直读官方仓库与 LICENSE）、`npm view`（npm registry）、WebFetch 读官方文档页。下载内容只当作数据，未执行任何脚本。
- 状态说明：「已核验」= 本次直读官方来源确认；「待确认」= 官方来源未覆盖、存在矛盾，或属于推断。

---

## 第 1 部分：skill 分发规范

### 1.1 Agent Skills 规范（agentskills.io）

| 项目 | 结论 | 来源 URL | 核验状态 |
|---|---|---|---|
| 规范仓库与许可 | 官方仓库 `agentskills/agentskills`。代码部分 Apache-2.0，`docs/` 部分 CC BY 4.0（`docs/LICENSE` 开头为 "Attribution 4.0 International"） | https://github.com/agentskills/agentskills ；https://github.com/agentskills/agentskills/blob/main/docs/LICENSE | 已核验 |
| 必填字段 | `name`、`description` | https://agentskills.io/specification ；https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx | 已核验 |
| 可选字段 | `license`、`compatibility`（≤500 字符）、`metadata`（string→string 映射）、`allowed-tools`（空格分隔字符串，标注 Experimental） | 同上 | 已核验 |
| `name` 约束 | 1–64 字符；只能用小写字母、数字和连字符；不能以连字符开头或结尾；不能有连续的 `--`；**必须与父目录名一致** | 同上 | 已核验 |
| `description` 约束 | 1–1024 字符，非空；应同时写「做什么」和「什么时候用」 | 同上 | 已核验 |
| 目录约定 | `SKILL.md`（必需）；`scripts/`、`references/`、`assets/` 都是可选的推荐目录；允许放其他文件 | 同上 | 已核验 |
| 长度建议 | 元数据约 100 tokens；SKILL.md 正文 **建议 < 5000 tokens**；**主 SKILL.md 保持在 500 行以内**；文件引用只深入一层 | 同上 | 已核验 |
| 参考校验器的行为 | `skills-ref` 的 `validator.py` 用白名单 `ALLOWED_FIELDS = {name, description, license, allowed-tools, metadata, compatibility}`，**出现其他顶层字段就报错**（比如 `version`、`argument-hint`）。README 声明它「仅用于演示，不用于生产」 | https://github.com/agentskills/agentskills/blob/main/skills-ref/src/skills_ref/validator.py ；https://github.com/agentskills/agentskills/blob/main/skills-ref/README.md | 已核验 |
| 规范与校验器不一致 | 规范文字写 `name` 只允许 `a-z0-9-`；校验器用 `c.isalnum()` 并做 NFKC 归一，实际放行 Unicode 小写字母。以规范文字为准，name 只用 ASCII | 同上两处 | 已核验（差异本身） |

### 1.2 Anthropic 官方：skill 最佳实践与 Claude Code skill

| 项目 | 结论 | 来源 URL | 核验状态 |
|---|---|---|---|
| 文档地址迁移 | `docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices` 302 跳转到 `platform.claude.com/...` | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices | 已核验 |
| SKILL.md 长度上限 | 「Keep the `SKILL.md` body under 500 lines for optimal performance」；接近上限就拆文件 | 同上 | 已核验 |
| name 额外约束（API / claude.ai 侧） | ≤64 字符；小写字母、数字、连字符；**不能含 XML 标签**；**不能含保留词 "anthropic"、"claude"** | 同上 | 已核验 |
| description 额外约束 | 非空，≤1024 字符，**不能含 XML 标签**；**必须用第三人称写** | 同上 | 已核验 |
| 引用文件 | 引用只深入一层；超过 100 行的参考文件要在顶部放目录 | 同上 | 已核验 |
| 其他建议 | 至少 3 个 eval；在 Haiku/Sonnet/Opus 上都测；路径一律用正斜杠；确定性操作优先写成脚本 | 同上 | 已核验 |
| Claude Code skill 位置 | 个人 `~/.claude/skills/<name>/SKILL.md`；项目 `.claude/skills/<name>/SKILL.md`；plugin `<plugin>/skills/<name>/SKILL.md`；支持嵌套子目录和 `--add-dir`；skill 文件夹可以是 symlink | https://code.claude.com/docs/en/skills | 已核验 |
| Claude Code frontmatter | 字段**全部可选**（推荐写 description）；name 不写时取目录名；无法识别的字段**静默忽略**。扩展字段：`when_to_use`、`argument-hint`、`arguments`、`disable-model-invocation`、`user-invocable`、`allowed-tools`、`disallowed-tools`、`model`、`effort`、`context`、`agent`、`background`、`hooks`、`paths`、`shell`、`metadata`、`license`、`compatibility` | 同上 | 已核验 |
| **跨端硬错误** | 在 Claude Code 以外的地方（claude.ai 上传、Skills API），**只允许** `name, description, license, compatibility, metadata, allowed-tools`，**出现其他键直接报硬错误** | 同上 | 已核验 |
| 描述截断 | `description` + `when_to_use` 合计在列表里**超过 1536 字符会被截断**；上下文压缩后每个 skill 只保留前 5000 tokens，所有重新挂载的 skill 共用 25000 tokens 预算 | 同上 | 已核验 |

### 1.3 Claude Code plugin：plugin.json 与 marketplace.json

| 项目 | 结论 | 来源 URL | 核验状态 |
|---|---|---|---|
| plugin.json 是否必需 | **manifest 本身是可选的**。没有 manifest 时按标准布局加载，plugin 名取 marketplace 条目名或目录名 | https://code.claude.com/docs/en/plugins-reference （页面标题「Plugin manifest reference」） | 已核验 |
| plugin.json 位置 | `.claude-plugin/plugin.json`；**其他所有文件（`skills/`、`commands/`、`hooks/` 等）都放在 plugin 根目录，不放进 `.claude-plugin/`** | 同上 | 已核验 |
| plugin.json 必填字段 | **只有 `name` 是必填**（kebab-case；不能有空格、`@`、`:`、路径分隔符） | 同上 | 已核验 |
| plugin.json 常用可选字段 | `$schema`、`displayName`、`version`、`description`、`author{name 必填, email, url}`、`homepage`（必须是合法 URL，否则加载失败）、`repository`、`license`（SPDX）、`keywords`、`metadata`、`defaultEnabled`、`dependencies`、`skills`、`commands`、`agents`、`hooks`、`mcpServers`、`lspServers`、`outputStyles`、`userConfig` 等。键名是 camelCase | 同上 | 已核验 |
| 未知字段 | 顶层未知字段会被剥离并给出警告，plugin 照常加载；`claude plugin validate` 是权威校验，`--strict` 会把警告变成失败 | 同上 | 已核验 |
| 保留名 | 以 `claude-`、`anthropic-`、`anthropics-`、`cc-plugin-` 开头的名字报错；名字里单独出现 claude/anthropic 这个词会警告 | 同上 | 已核验 |
| 单 skill plugin | 「A plugin with `SKILL.md` at its root, no `skills/`, and no `skills` key loads as a single skill」 | 同上 | 已核验 |
| `bin/` 的限制 | plugin 根目录如果有 `bin/`，claude.ai 和 Cowork **不会安装**这个 plugin | 同上 | 已核验 |
| marketplace.json 位置 | `.claude-plugin/marketplace.json`；相对路径从 marketplace 根目录解析，不是从 `.claude-plugin/` 解析 | https://code.claude.com/docs/en/plugins/marketplace-reference | 已核验 |
| marketplace.json 必填字段 | 顶层：`name`、`owner`（`owner.name` 必填）、`plugins`。每个 plugin 条目：`name`、`source` | 同上 | 已核验 |
| marketplace 可选字段 | `description`（缺失会警告）、`version`、`metadata.description`、`metadata.version`、`metadata.pluginRoot`、`forceRemoveDeletedPlugins`、`renames` 等；条目还可以写 `strict`（默认 true）、`category`、`tags` 和全部 plugin.json 字段 | 同上 | 已核验 |
| source 形式 | 相对路径（必须以 `./` 开头）；`github{repo, ref, sha}`；`url`；`git-subdir`；`npm{package, version, registry}`（不执行 install 脚本）；`archive`；`command` | 同上 | 已核验 |
| 名字字符集 | marketplace 名和 plugin 名只能用字母、数字、`.`、`_`、`-`，并以字母或数字开头。保留名很多（如 `agent-skills`、`claude-plugins-official`、`npm`、`github` 等），含非 ASCII 字符的名字一律视为冒充官方 | 同上 | 已核验 |
| 版本冲突 | 条目里的 `version` 和 plugin.json 不一致时，**plugin.json 优先**，validate 会警告 | 同上 | 已核验 |

### 1.4 vercel-labs/skills（`npx skills add`）

| 项目 | 结论 | 来源 URL | 核验状态 |
|---|---|---|---|
| 包与许可 | npm 包 `skills`，最新 1.7.4（2026-10-19），MIT；**要求 Node ≥ 22.20.0** | `npm view skills` ；https://github.com/vercel-labs/skills | 已核验 |
| 支持的 Agent | README：OpenCode、Claude Code、Codex、Cursor 「and 75 more」 | https://github.com/vercel-labs/skills/blob/main/README.md | 已核验 |
| 安装范围 | 默认装到当前项目（`./<agent>/skills/`）；加 `-g` 装到用户目录（`~/<agent>/skills/`） | https://github.com/vercel-labs/skills/blob/main/docs/commands.md | 已核验 |
| 安装方式 | 默认用 symlink 指向一份规范副本；可加 `--copy` 改为复制 | 同上 | 已核验 |
| Claude Code 目标目录 | 项目 `.claude/skills/`，全局 `~/.claude/skills/` | https://github.com/vercel-labs/skills/blob/main/docs/agents.md | 已核验 |
| **Codex 目标目录** | 项目 `.agents/skills/`，**全局 `~/.agents/skills/`**（Codex 和 Cline、Warp、Zed 等共用同一路径） | 同上 | 已核验 |
| 仓库内发现路径 | 扫描 `skills/`、`skills/.curated/`、`.agents/skills/`、`.claude/skills/` 等几十个目录，支持 `skills/<name>/` 和一到两层分类目录；还会读取 `.claude-plugin/marketplace.json` / `plugin.json` 里声明的 skills；都找不到时递归搜索 | https://github.com/vercel-labs/skills/blob/main/docs/creating-skills.md | 已核验 |
| 其他 | `metadata.internal: true` 默认隐藏；会采集匿名遥测数据，可用 `DISABLE_TELEMETRY=1` 关闭 | 同上；README | 已核验 |

### 1.5 OpenAI Codex skill

| 项目 | 结论 | 来源 URL | 核验状态 |
|---|---|---|---|
| 官方文档地址 | `developers.openai.com/codex/skills` 308 跳转到 `learn.chatgpt.com/docs/build-skills`（页面标题「Build skills \| ChatGPT Learn」） | https://learn.chatgpt.com/docs/build-skills | 已核验 |
| 文档列出的发现路径 | REPO：`$CWD/.agents/skills`、`$CWD/../.agents/skills`、`$REPO_ROOT/.agents/skills`；**USER：`$HOME/.agents/skills`**；ADMIN：`/etc/codex/skills`；SYSTEM：随 Codex 内置。文档**没有列出** `~/.codex/skills` | 同上 | 已核验 |
| 源码中的发现路径 | `codex-rs/ext/skills/src/host_roots.rs`：User 层同时挂载 **`$CODEX_HOME/skills`（源码注释写明「Deprecated user skills location … kept for backward compatibility」）** 和 **`~/.agents/skills`**；Project 配置层挂 `<项目 .codex>/skills`；从 cwd 往上到仓库根逐级挂 `.agents/skills`；System 层挂 `/etc/codex/skills`（Admin）。这段逻辑在 tag `rust-v0.149.0` 和 `rust-v0.164.0`（最新 release，2026-10-23）里完全相同 | https://github.com/openai/codex/blob/main/codex-rs/ext/skills/src/host_roots.rs ；https://github.com/openai/codex/blob/rust-v0.149.0/codex-rs/ext/skills/src/host_roots.rs | 已核验 |
| **与现有记录的冲突** | 全局 CLAUDE.md 写的是「`~/.agents/` 是 plugins/marketplace 用途，不是 skill 发现路径」，这和官方源码、官方文档都**矛盾**。实际情况：`~/.agents/skills` 是当前主路径；`$CODEX_HOME/skills`（默认 `~/.codex/skills`）仍然能用，但已标注废弃 | 同上 | 已核验（冲突本身）；CLAUDE.md 由用户本人决定是否修改 |
| SKILL.md 解析 | `codex-rs/skills/src/parser.rs`：只读取 `name`、`description`、`metadata.short-description`（**连字符写法**）。`name` 缺失时用目录名，上限 64；`description` 必须非空（这里没有长度上限）；YAML 解析失败时会尝试修复带冒号的单行值 | https://github.com/openai/codex/blob/main/codex-rs/skills/src/parser.rs | 已核验 |
| 扫描上限 | 扫描深度 6，每个 root 最多 2000 个 skill 目录；元数据目录常量 `agents`，文件名 `openai.yaml` | https://github.com/openai/codex/blob/main/codex-rs/ext/skills/src/loader/mod.rs | 已核验 |
| `agents/openai.yaml` 是否必需 | **可选**。文档目录树标注「Optional: appearance and dependencies」；Codex 内置 skill-creator 的参考文档说它是「product-specific config intended for the machine/harness to read, not the agent」 | https://learn.chatgpt.com/docs/build-skills ；https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/skill-creator/references/openai_yaml.md | 已核验 |
| `openai.yaml` 字段 | `interface{display_name, short_description, icon_small, icon_large, brand_color, default_prompt}`；`policy{allow_implicit_invocation（默认 true）, products}`；`dependencies{tools[]{type, value, description, transport, command, url, oauth}}`。`type` 目前只支持 `mcp` | https://github.com/openai/codex/blob/main/codex-rs/skills/src/metadata.rs ；https://github.com/openai/codex/blob/main/codex-rs/skills/src/model.rs | 已核验 |
| 命名风格 | **基本都是 snake_case**；唯一例外是 `dependencies.tools[].oauth`，它用 `rename_all = "camelCase"`，主键是 `callbackPort`，同时接受别名 `callback_port` | https://github.com/openai/codex/blob/main/codex-rs/skills/src/metadata.rs | 已核验 |
| 字段长度 | dependency 的 type、transport ≤64；value、description、command、url ≤1024；`short_description` 在 skill-creator 里建议 25–64 字符 | 同上；openai_yaml.md | 已核验 |
| Codex plugin 体系 | Codex 也有 plugin：manifest 在 `<plugin>/.codex-plugin/plugin.json`。marketplace 文件按这几个路径识别：`.agents/plugins/marketplace.json`、`.agents/plugins/api_marketplace.json`、`.claude-plugin/marketplace.json`、`.cursor-plugin/marketplace.json`，也就是说 **Codex 能直接读 Claude 的 marketplace.json** | https://github.com/openai/codex/blob/main/codex-rs/core-plugins/src/marketplace.rs | 已核验（路径常量）；兼容到什么程度待确认 |

### 1.6 微信公众号编辑器的 HTML/CSS 限制

| 项目 | 结论 | 来源 URL | 核验状态 |
|---|---|---|---|
| 粘贴进编辑器时的过滤规则 | **没有找到官方文档**。微信公众平台没有公开说明哪些标签、属性、CSS 会被过滤 | — | 待确认 |
| 官方 API「新增草稿」的 content 参数（唯一的官方文字） | 原文：「图文消息的具体内容，大小不可超过2kb，支持HTML标签，必须少于2万字符，小于1M，且此处会去除JS,涉及图片url必须来源 "上传图文消息内的图片获取URL"接口获取。外部图片url将被过滤。」页面上 2kb 和 1M 两个上限的关系没有解释；**完全没有提到 CSS** | https://developers.weixin.qq.com/doc/service/api/draftbox/draftmanage/api_draft_add | 已核验（原文）；2kb/1M 的含义待确认 |
| 开源实现 doocs/md 的做法（**非官方**，许可 WTFPL） | 复制到公众号前，用 `juice` 把 CSS 内联到 `style` 属性上 | https://github.com/doocs/md/blob/main/docs/architecture.md | 已核验（这是 doocs 的做法，不代表微信规则） |
| doocs/md：CSS 变量 | 复制前用正则把 `var(--md-*)` 换成字面值，并删掉 `--md-*:` 声明。**由此推断**公众号不支持 CSS 自定义属性 | https://github.com/doocs/md/blob/main/apps/web/src/services/export/clipboard.ts | 待确认（推断） |
| doocs/md：SVG | 代码注释写着：微信会剥掉 SVG 的 `defs` 和 `id`，所以 `url(#gradient)` 填充会失效；`foreignObject` 里的 HTML 会被丢掉，除非内层节点是 `<section>`；正文栏宽按 677px 处理 | https://github.com/doocs/md/blob/main/apps/web/src/services/export/wechat-svg.ts ；https://github.com/doocs/md/blob/main/apps/web/src/services/export/clipboard-dom.ts | 待确认（非官方经验） |
| doocs/md：字体 | 多词名字和中文字体名要加引号，否则 juice/PostCSS 解析失败 | clipboard-dom.ts | 待确认（非官方经验） |

---

## 第 2 部分：第三方库

npm 数据来自 `npm view <pkg> version license time[<version>] repository.url deprecated engines`，查询日期 2026-10-25。所有包都没有 `deprecated` 标记。

| 项目 | 结论 | 来源 URL | 核验状态 |
|---|---|---|---|
| sivan/heti（npm `heti`） | LICENSE：MIT（Copyright 2020 Sivan）。npm 最新 0.9.6，发布于 2025-08-30。最近一次提交 2025-08-31，只改了 CI。纯 CSS/SCSS，靠本地字体栈，**不打包字体文件**。依赖 `heti-findandreplacedomtext` | https://github.com/sivan/heti/blob/master/LICENSE ；https://www.npmjs.com/package/heti | 已核验 |
| vinta/pangu.js（npm `pangu`） | LICENSE：MIT（2013 Vinta）。npm 最新 **10.4.1，发布于 2026-09-26**，维护活跃。`engines.node >= 20`。同时提供 ESM 和 CJS，导出 `.`、`./browser`、`./shared` 等入口；带 CLI（`pangu`） | https://github.com/vinta/pangu.js/blob/master/LICENSE ；https://www.npmjs.com/package/pangu | 已核验 |
| huacnlee/autocorrect | LICENSE：MIT（2020 Jason Lee）。仓库最新 release v2.16.3（2026-01-03）。有 Node 原生绑定（napi） | https://github.com/huacnlee/autocorrect/blob/main/LICENSE | 已核验 |
| ↳ npm `autocorrect-node` | 官方 README 推荐的 Node 包（「install `autocorrect-node` package」）。npm 最新 **2.14.0（2025-04-26），比仓库版本（2.16.3）落后两个小版本**。仓库里 package.json 已经是 2.16.3，但没有发布到 npm。原生预编译只有 5 个平台：win32-x64、darwin-x64、darwin-arm64、linux-x64-gnu、linux-x64-musl，**没有 linux-arm64 和 win32-arm64** | https://github.com/huacnlee/autocorrect/blob/main/autocorrect-node/package.json ；`npm view autocorrect-node` | 已核验 |
| ↳ npm `@huacnlee/autocorrect`（WASM） | README 徽章指向的 WebAssembly 版，最新 2.16.2（2025-11-24），`type: module`。**npm 元数据里 `license` 字段是空的**（仓库整体是 MIT） | `npm view @huacnlee/autocorrect` ；https://github.com/huacnlee/autocorrect | 已核验；包内许可声明待确认 |
| ↳ npm `autocorrect-wasm` | 2.14.3（2025-08-14），license 字段同样为空；和上一个包的关系没有官方说明 | `npm view autocorrect-wasm` | 待确认 |
| ethantw/Han（npm `han-css`） | LICENSE.md：MIT（2016 Chen Yijun）。**npm 最新 3.3.0 发布于 2016-03-21**；最后一次代码合并是 2024-02 修死链，实质上已停止维护。`engines.node: 0.12.x`。仓库附带 `font/han*.otf/woff`，这些字体的来源和许可没有单独说明 | https://github.com/ethantw/Han/blob/master/LICENSE.md ；`npm view han-css` | 许可已核验；字体许可待确认 |
| KonghaYao/cn-font-split（npm `cn-font-split`） | LICENSE：**Apache-2.0**。npm 最新 7.4.3（2026-06-12）。**有 postinstall 脚本**（`node ./dist/cli.js i default`，会下载原生二进制），通过 `koffi` FFI 调用 | https://github.com/KonghaYao/cn-font-split/blob/release/LICENSE ；`npm view cn-font-split scripts.postinstall` | 已核验 |
| zhlint-project/zhlint（npm `zhlint`） | LICENSE：MIT（2019 Jinjiang）。npm 最新 **0.8.2，发布于 2024-08-20**；仓库最后一次功能合并在 2025-07-12（`--fix <file-pattern>`），**之后没有发布到 npm**。依赖 unified/remark 生态 | https://github.com/zhlint-project/zhlint/blob/main/LICENSE ；`npm view zhlint` | 已核验 |
| sparanoid/chinese-copywriting-guidelines | LICENSE：MIT（Copyright 2023 Sparanoid, Inc.）。**不是 npm 包**（npm 返回 404）。默认分支最后一次提交 2023-08-09 | https://github.com/sparanoid/chinese-copywriting-guidelines/blob/master/LICENSE | 已核验 |
| postcss | LICENSE：MIT。最新 8.5.31（2026-10-18）。`engines.node ^10\|\|^12\|\|>=14` | https://github.com/postcss/postcss/blob/main/LICENSE ；`npm view postcss` | 已核验 |
| parse5 | LICENSE：MIT（2013–2019 Ivan Nikulin）。最新 8.0.1（2026-04-19） | https://github.com/inikulin/parse5/blob/master/LICENSE ；`npm view parse5` | 已核验 |
| htmlparser2 | LICENSE：MIT。最新 **12.0.0（2026-03-20）**，`engines.node >= 20.19.0` | https://github.com/fb55/htmlparser2/blob/master/LICENSE ；`npm view htmlparser2` | 已核验 |
| playwright | LICENSE：**Apache-2.0**。最新 1.64.1（2026-10-14），`engines.node >= 20`。浏览器二进制需要另外下载 | https://github.com/microsoft/playwright/blob/main/LICENSE ；`npm view playwright` | 已核验 |

---

## 第 3 部分：借鉴对象（都是 MIT）

| 项目 | 结论 | 来源 URL | 核验状态 |
|---|---|---|---|
| taste-skill：许可与规模 | LICENSE：MIT（2026 Leonxlnx），约 10 万 star | https://github.com/Leonxlnx/taste-skill/blob/main/LICENSE | 已核验 |
| taste-skill：目录结构 | 单个 skill，放在 `skills/taste-skill/`，里面有：`SKILL.md`、`README.md`、`references/*.md`（11 个，按主题一个文件：colour、type、layout、motion、copy、critique、tells 等，最大的约 85KB）、`scripts/*.mjs`（draw、inspect、lint、assets、scenes，加上 `lib/` 里的 cdp、probe、rules）、`assets/`（css/js）、`library/*.json`（方向、配色、字体、版块等数据库，sites.json 约 870KB）、`evals/evals.json`。仓库根目录同时放了 `.claude-plugin/marketplace.json`、`.codex-plugin/plugin.json`、`.agents/plugins/marketplace.json`、`install.sh` 和 `tests/` | https://github.com/Leonxlnx/taste-skill | 已核验 |
| taste-skill：SKILL.md | **542 行，超过官方建议的 500 行**。frontmatter `name: design-taste-frontend`，但目录叫 `taste-skill`，**不符合 agentskills 规范「name 必须与目录名一致」** | https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md | 已核验 |
| taste-skill：安装方式 | 主推 `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"`；Claude Code 用 `/plugin marketplace add Leonxlnx/taste-skill` 加 `/plugin install taste-skill@taste-skill`；Codex 用 `codex plugin marketplace add …` 加 `codex plugin add taste-skill@taste-skill`；也可以克隆后跑 `./install.sh`（symlink，带 `--codex` / `--all-agents` 参数）。运行时要求 Node 22+ 和本机 Chrome/Edge/Chromium | https://github.com/Leonxlnx/taste-skill/blob/main/README.md | 已核验 |
| taste-skill：CI 与 lint | CI 检查三件事：frontmatter 能否按 Claude Code / Codex 的方式解析、文本是否为干净的 UTF-8、全部脚本能否通过 `node --check`。`scripts/lint.mjs` 零依赖，静态扫描 html/css/js/tsx/vue 等文件里被禁的写法，发现 FAIL 时退出码为 1，支持 `--json` 和 `--app` | https://github.com/Leonxlnx/taste-skill/blob/main/.github/workflows/check-skills.yml ；https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/scripts/lint.mjs | 已核验 |
| taste-skill：Codex plugin 字段 | `.codex-plugin/plugin.json` 的 `interface` 用的是 **camelCase**（displayName、shortDescription、defaultPrompt 数组等），和 skill 级 `openai.yaml` 的 snake_case **不是同一套 schema** | https://github.com/Leonxlnx/taste-skill/blob/main/.codex-plugin/plugin.json | 已核验（字段写法）；Codex plugin.json 的官方 schema 待确认 |
| hallmark：许可与规模 | LICENSE：MIT（2026 Hallmark contributors），`skills/hallmark/LICENSE` 里也放了一份 | https://github.com/Nutlope/hallmark/blob/main/LICENSE | 已核验 |
| hallmark：目录结构 | `skills/hallmark/` 里有：`SKILL.md`、`agents/openai.yaml`、`references/`（约 30 个主题文件，另有 `genres/`、`macrostructures/`（21 个）、`themes/`（约 44 个主题加 `index.json`）三个子目录，**引用深入两层**）、`scripts/`（sloplint.mjs、sloplint-render.mjs、theme.mjs、refcheck.mjs、capture.mjs、install.mjs、install-hook.mjs、lint-hook.mjs，以及 `fixtures/` 里的通过和失败样例）。仓库根目录另有 `eval/`（多模型对比评测）、`site/`、`.claude-plugin/` | https://github.com/Nutlope/hallmark | 已核验 |
| hallmark：SKILL.md | **154 行**。frontmatter 除了 name/description，还有 `argument-hint`、`version`、`metadata.opencode/slash`。其中 `version` 和 `argument-hint` 会被 agentskills 的 `skills-ref` 判为非法字段，在 claude.ai / Skills API 上会触发硬错误 | https://github.com/Nutlope/hallmark/blob/main/skills/hallmark/SKILL.md | 已核验 |
| hallmark：openai.yaml | 写的是 `interface.default_prompts`（复数、列表）和 `dependencies: []`（列表）。Codex 源码的 schema 是 `default_prompt`（单数）和 `dependencies{tools: [...]}`（映射）。**写法和官方 schema 不一致**，Codex 会忽略还是报错，待确认 | https://github.com/Nutlope/hallmark/blob/main/skills/hallmark/agents/openai.yaml | 字段差异已核验；运行时行为待确认 |
| hallmark：安装方式 | `npx skills add nutlope/hallmark -g`：Claude Code 装到 `~/.claude/skills/hallmark`，**Codex 装到 `~/.agents/skills/hallmark`**；可以用 `--agent` 只装一个 harness。Claude Code plugin 用 `/plugin marketplace add nutlope/hallmark` 加 `/plugin install hallmark@hallmark`。也可以克隆后跑 `node skills/hallmark/scripts/install.mjs`（复制前会校验）。marketplace 条目用的是 `"source": "./skills"`、`"strict": false`、`"skills": ["./hallmark"]` | https://github.com/Nutlope/hallmark/blob/main/README.md ；https://github.com/Nutlope/hallmark/blob/main/.claude-plugin/marketplace.json | 已核验 |
| hallmark：sloplint 的机制 | 零依赖，Node 18+。扫描 `.html`、`.css` 以及 `.jsx/.tsx/.vue/.svelte/.astro`（包括 Tailwind class 字符串和 cn/clsx/cva 调用）。参数有 `--genre`、`--scope page/component/app`、`--stage`、`--json`、`--render` / `--url`（需要 puppeteer-core 和 Chrome）、`--before` / `--kept`（改版前后对比）。检查项（gate）分四档：Floor（不可豁免）、Reflex（可以写明理由后豁免）、Finish（只报告）、Ledger（只记录）。按检查方式分：M（静态检查）、R（渲染后检查）、J（人工判断） | https://github.com/Nutlope/hallmark/blob/main/skills/hallmark/scripts/sloplint.mjs ；https://github.com/Nutlope/hallmark/blob/main/skills/hallmark/references/gates.md | 已核验 |
| hallmark：sloplint 的检查项（概括） | **配色**：紫蓝渐变、渐变文字、纯黑纯白字面量、零彩度中性色、强调色面积超标、光晕和模糊球、框架默认色板。**字体**：Inter、Roboto 等作展示字体，正文行宽超出 45–75ch，超过 3 个字族，标题里单独斜体一个词，大写标题行高小于 1，等宽字体当装饰，字号或行高过小，小号大写加字距的标签。**结构**：卡片套卡片，三等分图标卡片，hero 用 `vh`，间距不走 token，横向滚动，首屏信息不全，粘性元素重叠，单屏字数过多，版块间距单一。**文案和外壳**：占位人名和流行词，编造的数据、证言、logo 墙，手画浏览器框，eyebrow 小标题，中点分隔和箭头这类模板标点，假提交。**动效和交互**：`transition: all`、动画化 width/top，焦点环淡入，没有 `prefers-reduced-motion` 降级，自动轮播不能暂停，缺少 `:focus-visible`，内容依赖 JS 才显示。**素材和无障碍**：emoji 当图标，装饰 SVG 没加 aria-hidden，对比度不足，颜色和字体字面量写在 token 外，按钮文字折行，坏图和图片缺署名。另有一组 F 开头的收尾检查（直引号、三个点代替省略号等） | https://github.com/Nutlope/hallmark/blob/main/skills/hallmark/references/gates.md | 已核验（这里只是概括，没有复制原文） |
| hallmark：CI | `refcheck.mjs` 检查 references、gates、fixtures、版本号、链接是否一致；`theme.mjs validate` 校验所有主题；还会检查 theme 的 `index.json` 是否和生成结果一致（`git diff --exit-code`） | https://github.com/Nutlope/hallmark/blob/main/.github/workflows/verify.yml | 已核验 |

---

## 附：会影响仓库结构或依赖选择的发现（汇总）

1. **Codex 用户级 skill 路径与现有记录冲突**：官方文档和 `openai/codex` 源码（v0.149.0 到 v0.164.0）都把 `~/.agents/skills` 列为 USER 路径，`$CODEX_HOME/skills` 在源码里标注为 Deprecated（仍兼容）。`npx skills add -a codex` 也装到 `~/.agents/skills`。全局 CLAUDE.md 里「`~/.agents/` 不是 skill 发现路径」的说法和官方来源矛盾，是否修改由用户决定。
2. **frontmatter 跨端兼容**：要让同一份 SKILL.md 在 claude.ai、Skills API 和 agentskills `skills-ref` 校验下都通过，顶层只能用 `name, description, license, compatibility, metadata, allowed-tools`。其他字段（如 `version`、`argument-hint`）会触发硬错误，应放进 `metadata`。name 不能含 "claude"、"anthropic"，并且要和目录名一致（比如 `skills/measure/` 对应 `name: measure`）。
3. **长度**：SKILL.md 正文控制在 500 行以内、5000 tokens 以内；description ≤1024 字符，用第三人称，不含 XML 标签。
4. **plugin**：plugin.json 只有 `name` 必填；marketplace.json 必填 `name`、`owner.name`、`plugins[].name`、`plugins[].source`。plugin 根目录不要放 `bin/`，否则 claude.ai/Cowork 不安装。Codex 能识别 `.claude-plugin/marketplace.json`。
5. **autocorrect-node 在 npm 上落后**（2.14.0，仓库已到 2.16.3），也没有 linux-arm64 预编译；WASM 包 `@huacnlee/autocorrect` 的 npm license 字段为空。
6. **zhlint 在 npm 上停在 2024-08 的 0.8.2**，仓库后续修复没有发布；**Han（han-css）最后一次发布是 2016 年**，可视为停止维护。
7. **cn-font-split 是 Apache-2.0，但有 postinstall 下载原生二进制的脚本**，在供应链和离线安装方面有风险。
8. **Node 版本下限**：`skills` CLI 要求 Node ≥22.20；pangu、playwright 要求 ≥20；htmlparser2 12 要求 ≥20.19。
9. **微信公众号**：粘贴过滤规则没有官方文档；唯一的官方文字是草稿 API 对 content 的说明（支持 HTML、去除 JS、外链图片会被过滤、少于 2 万字符）。「只能用内联样式、不支持 CSS 变量、SVG 会丢 defs/id」都只来自 doocs/md 的实现经验，不是官方说法。
