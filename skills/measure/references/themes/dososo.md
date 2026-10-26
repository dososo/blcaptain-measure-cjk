# 分寸 Dososo

- 风格：米纸、墨、青瓷、朱砂；克制、留白优先。色板取自 `dososo-design-system`。
- 传统风：是
- 适合：产品官网、展示页、个人主页、小红书卡片（卡片模板就是这套色板）。本项目的展示页用的就是这个主题。
- 示例：<https://dososo.github.io/blcaptain-measure-cjk/site/themes/dososo.html>
- 截图：<https://dososo.github.io/blcaptain-measure-cjk/site/shots/theme-dososo.jpg>
- 用法：先引入 `assets/measure.css`，再引入下面这段。字体按系统字体调用；要自托管，只能用 🟢 档（例如 Noto Sans SC、霞鹜文楷），先 `measure-cjk fonts` 查。
- 字体说明：Noto、思源字体自带西文字形，所以字体栈前面没有另写西文字体（T13 的例外）。
- 色值沿用 `dososo-design-system` 里的示例值，那份色板没有注明实物采样来源；这一版作为已知偏差发布（D-2），重新采样见 ROADMAP。

## 设计变量和基础样式

```css
/* 分寸 Dososo：配合 measure.css 使用 */
:root {
  --paper: #f4e9dc;
  --paper-deep: #ebdccb;
  --ink: #1f1b16;
  --ink-soft: #5a5148;
  --celadon: #7e8c6b;
  --cinnabar: #9e4b3b;
  --line: #d8c7b2;
  --sans: "Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
}
body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); font-size: 17px; line-height: 1.8; }
.page { max-width: 760px; margin: 0 auto; padding: 120px 32px 120px; }
.kicker { font-size: 14px; color: var(--celadon); margin: 0 0 24px; }
h1 { font-size: 44px; font-weight: 300; line-height: 1.35; margin: 0 0 32px; }
.lead { font-size: 19px; line-height: 1.8; color: var(--ink-soft); margin: 0 0 24px; }
.meta { font-size: 14px; color: var(--ink-soft); border-bottom: 1px solid var(--line); padding-bottom: 48px; margin: 0 0 56px; }
h2 { font-size: 26px; font-weight: 300; line-height: 1.4; margin: 64px 0 20px; }
p, li { max-width: 36em; line-height: 1.8; }
p { margin: 0 0 1em; }
ol { padding-left: 1.6em; margin: 0 0 1em; }
blockquote { background: var(--paper-deep); border-left: 3px solid var(--celadon); margin: 40px 0; padding: 24px 28px; }
blockquote p { margin: 0; }
.note { font-size: 14px; line-height: 1.75; color: var(--ink-soft); border-top: 1px solid var(--line); padding-top: 16px; margin-top: 56px; }
em { font-style: normal; color: var(--cinnabar); }
a { color: var(--cinnabar); }
@media (max-width: 760px) {
  .page { padding: 72px 20px 96px; }
  h1 { font-size: 32px; }
  h2 { font-size: 22px; }
}
```

## 字号阶梯（字号越大字重越轻）

| 用途 | 字号 | 字重 | 行高 |
|---|---|---|---|
| 大标题 | 44px（手机 32px） | 300 | 1.35 |
| 小标题 | 26px（手机 22px） | 300 | 1.4 |
| 导语 | 19px | 400 | 1.8 |
| 正文 | 17px | 400 | 1.8 |
| 栏目、注释 | 14px | 400 | 1.75 |

## 该做

- 留白是内容：卡片边距不小于 72px，页面上下留足；文案超长就删文案，不压留白。
- 一屏最多两个强调色：青瓷用于栏目和引用线，朱砂用于强调和链接。
- 宋体系和黑体系二选一，不混用；这里选黑体系，长读场景可以换成宋体系（参考「季刊」）。

## 不该做

- 不用紫色渐变、玻璃拟态、霓虹光晕、默认 shadcn 样式。
- 不用 emoji 当图标，不用大圆角加重阴影的「SaaS 模板脸」。
- 不给中文标题加负字距（T07），不用斜体（T08）。
