# 档案 Archive

- 风格：档案馆。牛皮纸底，编目号用等宽字体，正文宋体，登记表式的线框。
- 传统风：否
- 适合：项目记录、版本历史、研究笔记、作品集的说明页。
- 示例：<https://dososo.github.io/blcaptain-measure-cjk/site/themes/archive.html>
- 截图：<https://dososo.github.io/blcaptain-measure-cjk/site/shots/theme-archive.jpg>
- 用法：先引入 `assets/measure.css`，再引入下面这段。字体按系统字体调用；要自托管，只能用 🟢 档（例如 Noto Serif SC），先 `measure-cjk fonts` 查。
- 字体说明：Songti SC、STSong、SF Mono、Menlo、Consolas 是操作系统自带字体，授权表暂未收录，只调用、不自托管，汇报时写「授权表未收录，系统调用」。Noto、思源字体自带西文字形，所以字体栈前面没有另写西文字体（T13 的例外）。
- 配色是设计取值（牛皮纸、褐墨、印章红），没有从实物照片采样，这一版作为已知偏差发布（D-2），重新采样见 ROADMAP。

## 设计变量和基础样式

```css
/* 档案 Archive：配合 measure.css 使用 */
:root {
  --paper: #ece2cc;
  --card: #f5eedd;
  --ink: #2e261d;
  --ink-soft: #6a5b47;
  --line: #a8977a;
  --stamp: #9b3a2e;
  --serif: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif;
  --mono: "SF Mono", Menlo, Consolas, monospace;
}
body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--serif); font-size: 17px; line-height: 1.8; }
.page { max-width: 800px; margin: 48px auto; padding: 48px 56px 72px; background: var(--card); border: 1px solid var(--line); }
.kicker { font-family: var(--mono), var(--serif); font-size: 14px; color: var(--ink-soft); border: 1px solid var(--line); display: inline-block; padding: 2px 10px; margin: 0 0 24px; }
h1 { font-size: 34px; font-weight: 400; line-height: 1.4; margin: 0 0 16px; }
.lead { font-size: 18px; line-height: 1.8; color: var(--ink-soft); margin: 0 0 16px; }
.meta { font-family: var(--mono), var(--serif); font-size: 14px; color: var(--stamp); border-top: 1px dashed var(--line); border-bottom: 1px dashed var(--line); padding: 8px 0; margin: 0 0 32px; }
h2 { font-size: 22px; font-weight: 400; line-height: 1.5; margin: 36px 0 12px; }
p, li { max-width: 36em; line-height: 1.8; }
p { margin: 0 0 1em; }
ol { padding-left: 1.6em; margin: 0 0 1em; }
blockquote { border-left: 3px double var(--line); margin: 24px 0; padding: 4px 0 4px 20px; color: var(--ink-soft); }
blockquote p { margin: 0; }
.note { font-family: var(--mono), var(--serif); font-size: 14px; line-height: 1.7; color: var(--ink-soft); }
em { font-style: normal; color: var(--stamp); }
a { color: var(--stamp); }
@media (max-width: 760px) {
  .page { margin: 0; padding: 36px 20px 56px; border: 0; }
  h1 { font-size: 28px; }
}
```

## 字号阶梯（字号越大字重越轻）

| 用途 | 字号 | 字重 | 行高 |
|---|---|---|---|
| 大标题 | 34px（手机 28px） | 400 | 1.4 |
| 小标题 | 22px | 400 | 1.5 |
| 导语 | 18px | 400 | 1.8 |
| 正文 | 17px | 400 | 1.8 |
| 编目号、注释 | 14px | 400 | 1.7 |

## 该做

- 编目号、日期、版本号用等宽字体，字体栈里接上宋体，中文不落到系统回退字体。
- 线框用虚线和细实线，像登记表；印章红只用在编号和强调上。
- 宋体正文字重保持 400，标题也不超过 500：宋体字重越大，横细竖粗越失衡。

## 不该做

- 不做旧化纹理、噪点、撕边：档案感来自编号和线框，不来自贴图。
- 不给中文用斜体表示「批注」（T08），用颜色或缩进区分。
- 不用紫色渐变、玻璃拟态、emoji 当图标。
