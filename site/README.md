# 展示页

`index.html` 是项目的在线展示页（GitHub Pages：<https://dososo.github.io/blcaptain-measure-cjk/site/>），内容全部由脚本生成，不手填数字：

```bash
npm run build
node site/themes/_gen.mjs        # 从 skills/measure/references/themes/*.md 生成 6 个主题示例页
node site/demos/_gen.mjs         # 生成 7 组规则示意
node bench/showcase-build.mjs    # 验证示意和主题（lint --render），截图，读实验数字，写 showcase.json
node site/_build.mjs             # 生成 index.html
```

- 数字来自 `docs/verification/w2/northstar/results.json`。
- 截图里的中文用思源黑体、思源宋体，emoji 和符号用 Noto Color Emoji、Noto Sans Symbols 2（都是 OFL-1.1）。字体文件不进仓库，放在仓库旁边的 `../deliverables/fonts-for-test/`，来源和哈希见那里的 `SOURCES.md`。截完逐个元素核对实际用到的字体，用到系统中文字体或系统 emoji、符号字体就判为不合格。
- 展示页本身要过 `measure-cjk lint --render`，零 error。
