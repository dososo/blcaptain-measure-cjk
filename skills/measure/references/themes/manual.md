# 说明书 Manual

- 风格：工业说明书。全黑体，编号体系（1、1.1），细线表格，单色。
- 传统风：否
- 适合：产品文档、快速上手、操作步骤、规范。
- 示例：<https://dososo.github.io/blcaptain-measure-cjk/site/themes/manual.html>
- 截图：<https://dososo.github.io/blcaptain-measure-cjk/site/shots/theme-manual.jpg>
- 用法：先引入 `assets/measure.css`，再引入下面这段。字体按系统字体调用；要自托管，只能用 🟢 档（例如 Noto Sans SC），先 `measure-cjk fonts` 查。
- 字体说明：SF Mono、Menlo、Consolas 是操作系统自带字体，授权表暂未收录，只调用、不自托管，汇报时写「授权表未收录，系统调用」。Noto、思源字体自带西文字形，所以字体栈前面没有另写西文字体（T13 的例外）。
- 单色：只用黑、白和两档灰；配色是设计取值，没有从实物采样，这一版作为已知偏差发布（D-2），重新采样见 ROADMAP。

## 设计变量和基础样式

```css
/* 说明书 Manual：配合 measure.css 使用 */
:root {
  --paper: #fbfbf9;
  --ink: #161616;
  --ink-soft: #5c5c5c;
  --line: #c9c9c4;
  --panel: #efefeb;
  --sans: "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  --mono: "SF Mono", Menlo, Consolas, monospace;
}
body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); font-size: 16px; line-height: 1.75; }
.page { max-width: 760px; margin: 0 auto; padding: 56px 32px 96px; }
.kicker { font-size: 14px; font-weight: 500; color: var(--ink-soft); border-bottom: 2px solid var(--ink); padding-bottom: 8px; margin: 0 0 32px; }
h1 { font-size: 34px; font-weight: 300; line-height: 1.4; margin: 0 0 16px; }
.lead { font-size: 18px; line-height: 1.75; color: var(--ink-soft); margin: 0 0 16px; }
.meta { font-family: var(--mono), var(--sans); font-size: 14px; color: var(--ink-soft); margin: 0 0 40px; }
h2 { font-size: 21px; font-weight: 400; line-height: 1.5; border-top: 1px solid var(--line); padding-top: 24px; margin: 40px 0 12px; }
p, li { max-width: 36em; line-height: 1.75; }
p { margin: 0 0 1em; }
ol { padding-left: 1.6em; margin: 0 0 1em; }
li { margin: 0 0 0.5em; }
blockquote { background: var(--panel); border-left: 4px solid var(--ink); margin: 24px 0; padding: 16px 20px; }
blockquote p { margin: 0; }
.note { font-size: 14px; line-height: 1.7; color: var(--ink-soft); border-top: 1px solid var(--line); padding-top: 12px; }
code { font-family: var(--mono), var(--sans); font-size: 15px; background: var(--panel); padding: 1px 6px; }
em { font-style: normal; font-weight: 600; }
a { color: var(--ink); }
@media (max-width: 760px) {
  .page { padding: 40px 20px 72px; }
  h1 { font-size: 28px; }
}
```

## 字号阶梯（字号越大字重越轻）

| 用途 | 字号 | 字重 | 行高 |
|---|---|---|---|
| 大标题 | 34px（手机 28px） | 300 | 1.4 |
| 章节标题 | 21px | 400 | 1.5 |
| 导语 | 18px | 400 | 1.75 |
| 正文、步骤 | 16px | 400 | 1.75 |
| 型号、编号、注释 | 14px | 400–500 | 1.7 |

## 该做

- 章节号直接写在 HTML 里（「1　行长」「1.1　…」），不用 CSS 计数器生成：生成的字不在源码里，lint 和字体检查都看不到。
- 步骤用有序列表，一步一件事；警告和提示放在灰底块里，左边一条墨线。
- 型号、命令、版本号用等宽字体，字体栈里要接上中文字体，免得中文落到系统回退字体。

## 不该做

- 不加颜色区分重要程度：单色主题靠字重、灰度和线条分层级。
- 不把正文压到 14px 以下，也不在表格里塞小于 12px 的中文（T11）。
- 不用 emoji 当警告图标，不用紫色渐变、玻璃拟态。
