# 季刊 Quarterly

- 风格：文艺杂志。大留白，宋体正文，标题字号大、字重轻。
- 传统风：否
- 适合：随笔、访谈、长读、品牌故事。
- 示例：<https://dososo.github.io/blcaptain-measure-cjk/site/themes/quarterly.html>
- 截图：<https://dososo.github.io/blcaptain-measure-cjk/site/shots/theme-quarterly.jpg>
- 用法：先引入 `assets/measure.css`，再引入下面这段。字体按系统字体调用；要自托管，只能用 🟢 档（例如 Noto Serif SC、霞鹜文楷），先 `measure-cjk fonts` 查。
- 字体说明：Songti SC、STSong 是操作系统自带字体，授权表暂未收录，只调用、不自托管，汇报时写「授权表未收录，系统调用」。Noto、思源字体自带西文字形，所以字体栈前面没有另写西文字体（T13 的例外）。
- 配色是设计取值（米白纸、深灰墨、苔绿），没有从实物采样，这一版作为已知偏差发布（D-2），重新采样见 ROADMAP。

## 设计变量和基础样式

```css
/* 季刊 Quarterly：配合 measure.css 使用 */
:root {
  --paper: #f7f5f0;
  --ink: #232220;
  --ink-soft: #6b6862;
  --accent: #5f6f52;
  --line: #d9d4ca;
  --serif: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif;
  --sans: "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
}
body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--serif); font-size: 18px; line-height: 1.9; }
.page { max-width: 680px; margin: 0 auto; padding: 120px 32px 160px; }
.kicker { font-family: var(--sans); font-size: 14px; color: var(--accent); margin: 0 0 40px; }
h1 { font-size: 46px; font-weight: 300; line-height: 1.35; margin: 0 0 32px; }
.lead { font-size: 20px; line-height: 1.85; color: var(--ink-soft); margin: 0 0 24px; }
.meta { font-family: var(--sans); font-size: 14px; color: var(--ink-soft); border-bottom: 1px solid var(--line); padding-bottom: 40px; margin: 0 0 56px; }
h2 { font-size: 24px; font-weight: 400; line-height: 1.5; margin: 64px 0 20px; }
p, li { max-width: 34em; line-height: 1.9; }
p { margin: 0 0 1.2em; }
ol { padding-left: 1.6em; margin: 0 0 1.2em; }
blockquote { font-size: 26px; font-weight: 300; line-height: 1.6; color: var(--accent); margin: 56px 0; padding: 0; }
blockquote p { margin: 0; }
.note { font-family: var(--sans); font-size: 14px; line-height: 1.7; color: var(--ink-soft); margin-top: 64px; }
em { font-style: normal; color: var(--accent); }
a { color: var(--accent); }
@media (max-width: 760px) {
  .page { padding: 72px 22px 96px; }
  h1 { font-size: 32px; }
  blockquote { font-size: 22px; }
}
```

## 字号阶梯（字号越大字重越轻）

| 用途 | 字号 | 字重 | 行高 |
|---|---|---|---|
| 大标题 | 46px（手机 32px） | 300 | 1.35 |
| 摘句 | 26px（手机 22px） | 300 | 1.6 |
| 小标题 | 24px | 400 | 1.5 |
| 导语 | 20px | 400 | 1.85 |
| 正文 | 18px | 400 | 1.9 |
| 栏目、署名、注释 | 14px | 400 | 1.7 |

## 该做

- 留白优先：页面上下留足，章节之间空出整整一屏的呼吸。
- 摘句放大、变细、换成强调色，代替加粗和引号框。
- 正文每行 30 字左右（max-width 34em），宁短勿长。

## 不该做

- 不加粗大段正文，不在一段里加粗好几处关键词（A11）。
- 不用两种以上强调色；苔绿以外不再加颜色。
- 不用紫色渐变、玻璃拟态、emoji 当图标。
