# 宋刻 Songke

- 风格：宋刻本。竹纸底，浓墨，仿宋或宋体，正文落在界栏里；可选竖排（示例页没有竖排示例）。
- 传统风：是
- 适合：古籍摘录、诗文、文化类长读、题跋。
- 示例：<https://dososo.github.io/blcaptain-measure-cjk/site/themes/songke.html>
- 截图：<https://dososo.github.io/blcaptain-measure-cjk/site/shots/theme-songke.jpg>
- 用法：先引入 `assets/measure.css`，再引入下面这段。字体按系统字体调用；要自托管，只能用 🟢 档（例如 Noto Serif SC），先 `measure-cjk fonts` 查。仿宋要查清再用：授权表里「方正仿宋」是 🔵（能出图，不能自托管 webfont），英文名 FZFangSong 却命中 🔴，两者不一致已记台账，以 `fonts` 的查询结果和官方原文为准；汉仪仿宋是 🔴。
- 字体说明：STFangsong、FangSong、Songti SC、STSong 是操作系统自带字体，授权表暂未收录，只调用、不自托管，汇报时写「授权表未收录，系统调用」。Noto、思源字体自带西文字形，所以字体栈前面没有另写西文字体（T13 的例外）。
- 配色是设计取值（竹纸、浓墨、朱印），没有从实物采样，这一版作为已知偏差发布（D-2），重新采样见 ROADMAP。

## 设计变量和基础样式

```css
/* 宋刻 Songke：配合 measure.css 使用 */
:root {
  --paper: #efe6d2;
  --ink: #1d1a16;
  --ink-soft: #5e5446;
  --grid: #c9b892;
  --seal: #a2392b;
  --song: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif;
  --fangsong: "STFangsong", "FangSong", "Noto Serif SC", "Songti SC", serif;
}
body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--song); font-size: 18px; line-height: 2; }
.page { max-width: 760px; margin: 48px auto; padding: 48px 56px 64px; border: 2px solid var(--ink); outline: 1px solid var(--ink); outline-offset: -8px; }
.kicker { font-family: var(--fangsong); font-size: 15px; color: var(--seal); border: 1px solid var(--seal); display: inline-block; padding: 2px 10px; margin: 0 0 24px; }
h1 { font-size: 36px; font-weight: 400; line-height: 1.4; margin: 0 0 16px; }
.lead { font-family: var(--fangsong); font-size: 19px; line-height: 1.9; color: var(--ink-soft); margin: 0 0 16px; }
.meta { font-family: var(--fangsong); font-size: 14px; color: var(--ink-soft); margin: 0 0 32px; }
/* 界栏：版心里每一行都占同样的高度（--row），栏线画在每行的底边，字就落在栏线上方 */
.body { --row: 34px; line-height: var(--row); background-image: repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--row) - 1px), var(--grid) calc(var(--row) - 1px), var(--grid) var(--row)); }
.body h2, .body p, .body li, .body blockquote { line-height: var(--row); margin: 0; }
h2 { font-size: 22px; font-weight: 400; padding-top: var(--row); }
p, li { max-width: 36em; line-height: 1.85; }
ol { padding-left: 1.6em; margin: 0; }
blockquote { font-family: var(--fangsong); color: var(--seal); padding: var(--row) 0 0 2em; }
.note { font-family: var(--fangsong); font-size: 14px; color: var(--ink-soft); padding-top: var(--row); }
em { font-style: normal; text-emphasis: dot; text-emphasis-position: over right; }
a { color: var(--seal); }
.vertical { writing-mode: vertical-rl; max-height: 32em; }
@media (max-width: 760px) {
  .page { margin: 0; padding: 32px 20px 48px; border-width: 1px; outline: 0; }
  h1 { font-size: 28px; }
}
```

## 字号阶梯（字号越大字重越轻）

| 用途 | 字号 | 字重 | 行高 |
|---|---|---|---|
| 题名 | 36px（手机 28px） | 400 | 1.4 |
| 篇名 | 22px | 400 | 34px（一行界栏） |
| 导语 | 19px | 400 | 1.9 |
| 正文 | 18px | 400 | 34px，约 1.89（每行落在界栏上） |
| 卷次、署名 | 14–15px | 400 | 2 |
| 注释（版心内） | 14px | 400 | 34px（一行界栏） |

## 该做

- 版心里所有文字（正文、篇名、注释、引文）都用同一个行距 `--row`，段距和标题上方的空白也按整行算，字才会和栏线对齐。这会让行高比例超过 1.9 的小字得到 T06 warn（建议 1.6–1.9），是界栏对齐的取舍，不是 error。
- 强调用着重号（`text-emphasis`），不用加粗和斜体。
- 竖排只用在短的诗文、题跋上（给容器加 `.vertical`）；竖排是 P2，measure 暂时不检查竖排的标点。

## 不该做

- 不把整页做成仿古贴图、做旧纹理或卷轴装饰：宋刻感来自字体、界栏和版框。
- 不用书法字体代替正文字体；书法字体多数没有商用授权。
- 不用紫色渐变、玻璃拟态、emoji 当图标。
