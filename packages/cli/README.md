# measure-cjk

**分寸 · Measure** 的命令行校验器：检查 AI 编码 Agent 写出来的中文页面排版是否到位、用到的字体能不能用。

A linter for Chinese (CJK) typography and font licensing in HTML/CSS, built for coding agents such as Claude Code and Codex.

- 查什么：中英文间距、全角标点、行首禁则、行长、行高、字距、斜体、最小字号、字体栈、字体授权。
- 两档：基础档读源码，离线、零依赖浏览器；完整档（`--render`）用浏览器在 6 种宽度下实测，每条 error 附截图。
- 小红书卡片：`card` 命令导出 1080×1440 PNG，只用授权允许商用出图的字体。
- 配套的 Agent skill、规则文档、主题和实验数据在 [GitHub 仓库](https://github.com/dososo/blcaptain-measure-cjk)。

## 安装

```bash
npm install -g measure-cjk        # 或者在项目里 npm install -D measure-cjk
measure-cjk --version
```

需要 Node 20.19 或更高版本。完整档和 `card` 还需要 Playwright（可选依赖，不装就不能用 `--render`，不会悄悄降级）：

```bash
npm install -D playwright && npx playwright install chromium
# 本机已有 Chrome 或 Edge 时，只装 playwright-core 也可以
```

## 用法

```bash
measure-cjk lint dist/                                   # 检查目录或文件（.html / .htm / .css）
measure-cjk lint dist/ --render                          # 完整档：浏览器实测
measure-cjk lint dist/ --format json --out measure-results.json
measure-cjk fonts "霞鹜文楷"                              # 查字体授权
measure-cjk card card.html --out card.png --font-dir fonts
measure-cjk init                                         # 生成 measure.config.json 和 measure.css
measure-cjk rules                                        # 列出全部规则
```

退出码：0 通过（或者没有中文内容）；1 有 error；2 用法或环境错误、没检查完。

## 授权

代码 Apache-2.0；字体授权数据和规则文档 CC BY 4.0。字体授权表不是法律意见。
