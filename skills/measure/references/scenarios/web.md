# 网页场景

## 最小可用模板

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- measure.css 放在第一个：它声明的 measure 层排在最前，页面上的其他样式都会优先于它 -->
  <link rel="stylesheet" href="measure.css">
  <style>
    body {
      font-family: "Inter", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
      font-size: 16px;
    }
    h1 { font-size: 32px; letter-spacing: 0; }
    em { font-weight: 600; }
  </style>
</head>
<body>
  <main class="measure-prose">
    <h1>标题</h1>
    <p>正文用全角标点，中英文之间的间距交给 text-autospace。行高、行长都已经由 measure.css 处理好。</p>
  </main>
</body>
</html>
```

## Tailwind 项目

- Tailwind v4 的入口 CSS 第一行写 `@layer measure;`，再 `@import "tailwindcss";`，这样工具类会优先于 measure.css。

- 中文标题不要用 `tracking-tight` 或 `tracking-tighter`。用 `tracking-normal`，或者不写。
- 正文用 `leading-relaxed`（1.625）或 `leading-7`，不要用 `leading-tight` 或 `leading-snug`。
- 正文容器可以用 `max-w-prose`（65ch）。1ch 是数字「0」的宽度，约为 0.5–0.6 个汉字宽，65ch 大约是 33–39 个汉字，在 28–40 字的范围内。
- 构建后对产物运行校验：`node <measure-cjk 仓库>/packages/cli/bin/measure-cjk.js lint dist/`。

## 检查清单

1. `<html lang="zh-CN">`
2. 引入了 `measure.css`，或者自己写了等价的规则
3. 字体栈里有中文字体；自托管的字体都是 🟢 档
4. 正文行高 1.6–1.9，每行 28–40 字
5. 中文没有斜体，没有负字距
6. 全角标点，引号风格统一
7. `measure-cjk lint` 零 error
