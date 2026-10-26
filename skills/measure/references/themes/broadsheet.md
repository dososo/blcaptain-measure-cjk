# 报刊 Broadsheet

- 风格：现代报纸。报头、双线、分栏和栏线；标题宋体，正文黑体。
- 传统风：否
- 适合：长文、资讯、周报、newsletter。
- 示例：<https://dososo.github.io/blcaptain-measure-cjk/site/themes/broadsheet.html>
- 截图：<https://dososo.github.io/blcaptain-measure-cjk/site/shots/theme-broadsheet.jpg>
- 用法：先引入 `assets/measure.css`，再引入下面这段。字体都按系统字体调用；要自托管，只能用 🟢 档（例如 Noto Serif SC、Noto Sans SC），先 `measure-cjk fonts` 查。
- 字体说明：Songti SC、STSong 是操作系统自带字体，授权表暂未收录，只调用、不自托管，汇报时写「授权表未收录，系统调用」。Noto、思源字体自带西文字形，所以字体栈前面没有另写西文字体（T13 的例外）。
- 配色是设计取值（新闻纸、油墨、报头红），没有从实物照片采样，这一版作为已知偏差发布（D-2），重新采样见 ROADMAP。

## 设计变量和基础样式

```css
/* 报刊 Broadsheet：配合 measure.css 使用 */
:root {
  --paper: #f3f0e8;
  --ink: #1b1b1b;
  --ink-soft: #55524b;
  --rule: #1b1b1b;
  --accent: #a3271f;
  --serif: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif;
  --sans: "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
}
body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); font-size: 17px; line-height: 1.8; }
.page { max-width: 1120px; margin: 0 auto; padding: 48px 32px 96px; }
.kicker { font-family: var(--serif); font-size: 52px; font-weight: 300; line-height: 1.5; text-align: center; border-top: 4px double var(--rule); border-bottom: 1px solid var(--rule); padding: 12px 0; margin: 0; }
.meta { font-size: 14px; color: var(--ink-soft); text-align: center; border-bottom: 1px solid var(--rule); padding: 6px 0 10px; margin: 0 0 40px; max-width: none; }
h1 { font-family: var(--serif); font-size: 38px; font-weight: 400; line-height: 1.35; margin: 0 0 16px; }
.lead { font-size: 19px; line-height: 1.75; color: var(--ink-soft); margin: 0 0 32px; }
.body { columns: 2 26em; column-gap: 48px; column-rule: 1px solid var(--rule); }
h2 { font-family: var(--serif); font-size: 24px; font-weight: 400; line-height: 1.5; margin: 0 0 12px; break-after: avoid; }
p, li { max-width: 36em; line-height: 1.8; }
.body p, .body ol { margin: 0 0 1em; }
blockquote { font-family: var(--serif); font-size: 20px; line-height: 1.7; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); margin: 8px 0 24px; padding: 12px 0; break-inside: avoid; }
blockquote p { margin: 0; }
.note { font-size: 14px; line-height: 1.7; color: var(--ink-soft); }
em { font-style: normal; font-weight: 600; }
a { color: var(--accent); }
@media (max-width: 760px) {
  .page { padding: 32px 20px 72px; }
  .kicker { font-size: 36px; }
  h1 { font-size: 28px; }
}
```

## 字号阶梯（字号越大字重越轻）

| 用途 | 字号 | 字重 | 行高 |
|---|---|---|---|
| 报头 | 52px（手机 36px） | 300 | 1.5 |
| 大标题 | 38px（手机 28px） | 400 | 1.35 |
| 小标题 | 24px | 400 | 1.5 |
| 导语 | 19px | 400 | 1.75 |
| 正文 | 17px | 400 | 1.8 |
| 注释、日期行 | 14px | 400 | 1.7 |

## 该做

- 报头（`.kicker`）单行、字号大，行高 1.5；measure 的 T06 会对它报 warn（单行元素误报，见 ROADMAP），可以不理。
- 宽屏分两栏，每栏 26em 以上，单栏不够宽时自动退成一栏，保证每行 28–40 字。
- 栏线、报头双线用墨色细线；红色只留给报头或一处强调。
- 段落之间空一行，不首行缩进（两者二选一，T12）。

## 不该做

- 不给中文标题加负字距收紧（T07），不用斜体（T08）。
- 不在一页里用两种以上的中文字族：标题宋体、正文黑体，就到此为止。
- 不用紫色渐变、玻璃拟态、emoji 当图标。
