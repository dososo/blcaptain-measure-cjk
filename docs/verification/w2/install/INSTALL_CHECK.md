# W2 第 4 步：本机试装记录（发布前）

| 项 | 内容 |
|---|---|
| 日期 | 2026-10-26 |
| 范围 | 用户要求：先修 SKILL.md 的 N-05，再在本机把 Claude Code 插件、Codex skill、`npx skills` 三种安装方式从零试一遍；**对外发布前再问用户**。本次没有对外发布任何东西 |
| 隔离 | 三种方式都在临时目录里装：Claude Code 用临时的 `CLAUDE_CONFIG_DIR`；Codex 用临时的 `HOME` 和 `CODEX_HOME`（凭证用符号链接指回原文件）；`npx skills` 用临时的 `HOME`、npm 缓存和项目目录。试装后核对过，用户真实的 `~/.claude/settings.json`、`~/.claude/plugins/known_marketplaces.json` 里没有 measure-cjk |
| 版本 | Claude Code 2.1.296；codex-cli 0.154.0；`skills` 1.7.4（npm，vercel-labs/skills）；Node 22.17.1 |

## 1. 先修的：SKILL.md 的 N-05

`SKILL.md` 的「命令」一节改成先 `command -v measure-cjk`，有就直接用；没有再用仓库里的命令行；不知道仓库在哪时问用户，不在用户目录里大范围搜索（commit `465021a`）。来源：北极星实验 N-05，claude 实验组 17/30 因为只教了 `node <仓库>/…` 写法而找不到校验器。

## 2. 三种安装方式

| 方式 | 命令（这次用本地仓库路径代替仓库地址） | 结果 | 证据 |
|---|---|---|---|
| Claude Code 插件 | `claude plugin validate . --strict`；`claude plugin marketplace add <仓库>`；`claude plugin install measure@measure-cjk`（试装时的市场名；2026-10-26 按 D-5 改成 `blcaptain-measure-cjk`，改名后的复测见 `docs/verification/w2/release/evidence/claude-plugin.log`） | 校验：补上 `plugin.json` 的 `author` 后，严格模式通过。安装成功，`claude plugin details measure` 列出 1 个 skill（measure），每次会话固定约 68 token，调用时约 950 token | `evidence/claude-plugin.log` |
| Codex skill | 分别把 `skills/measure/` 放进临时 `$CODEX_HOME/skills/measure/` 和临时 `~/.agents/skills/measure/`，`codex exec` 让它列出可用的 skill | **两个位置都列出了 measure** | `evidence/codex-codexhome.log`、`evidence/codex-agents.log` |
| `npx skills` | `npx -y skills@1.7.4 add <仓库> -s measure -a claude-code -a codex -y` | 安装成功：项目的 `.agents/skills/measure/`（Codex）和 `.claude/skills/measure/`（指向前者的符号链接）。装上的文件和仓库里的 `skills/measure/` 逐字节一致（`diff -r` 无差异），共 64 KB。Node 22.17.1 低于它要求的 22.20，只给了 EBADENGINE 警告，能运行 | `evidence/npx-skills-lock.json` |

## 3. 事实更正

- **Codex 的 skill 路径：** codex-cli 0.154.0 下，`~/.agents/skills/` 和 `$CODEX_HOME/skills/` 都能被发现；程序文件里有 `.agents/skills` 字符串。用户全局约定里「`~/.agents/` 不是 skill 发现路径」是 2026-08-22 在 0.149.0 上核验的，到 0.154.0 已经不成立。README 原来写的「`$CODEX_HOME/skills` 已标为弃用」，在程序文件里没找到对应原文，**待确认**；README 已改成按实测写。
- 试装时发现用户 codex 配置里的模型 `gpt-6.1-sol`，ChatGPT 账号不支持（报 400）；隔离环境里去掉模型那一行后，用默认的 gpt-6-astra。这和安装无关，只是记录。

## 4. 发布前要解决的问题

1. **只装 skill，校验器用不了。** 三种方式装的都只是 skill。仓库里的命令行需要先 `npm install && npm run build`（`dist/` 不进 git），`measure-cjk` 也不会出现在 PATH 上。`SKILL.md` 的 `command -v measure-cjk` 会落到「没有」那条路。要让装了 skill 的人能用上校验器，需要把 `measure-cjk` 发布到 npm（2026-10-26 查询，npm 上还没有这个包名），再把 `SKILL.md` 改成用固定版本的 `npx measure-cjk@<版本>`，或者让用户 `npm i -g measure-cjk`。
2. **Claude Code 插件会拷整个仓库。** `marketplace.json` 里插件的 `source` 是 `"./"`，本机试装时插件缓存有 88 MB（含 `node_modules`）。从 GitHub 装不会有 `node_modules`，但仍会带上实验数据（`bench/runs` 约 32 MB，仓库已跟踪文件共约 37 MB）、截图和文档。
3. **`npx skills` 要求 Node 22.20 以上**，README 已写明；本机低于这个版本也能装，只是有警告。
