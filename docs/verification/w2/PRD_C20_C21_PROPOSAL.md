# PRD 变更提案：C20（`@layer measure`）与 C21（文字修正）

**状态：用户已确认（2026-10-25）。** 原话：「确认 C20 和 C21 按提案改：PRD §7.4 换成 ＠layer measure 版代码块，§5.1 和 §7.4 的说法照改，§7.3 补 Thresholds 定义，然后实现并验证。」已按本提案修改 `docs/PRD.md`。

**依据：**
- D-9，用户 2026-10-25 原话：「D-9 也按推荐改为 ＠layer measure，放到 W2 做」；
- AUDIT_iter2 A-38；AUDIT_iter4 A-53、A-55；RULING-02 附带说明。

**事实核验：** `@layer` 的浏览器支持（MDN browser-compat-data `css/at-rules/layer.json`，2026-10-25 读取）为 Chrome 99、Firefox 97、Safari 15.4，iOS Safari 同 Safari。更老的浏览器会忽略整个 `@layer` 块，在那里 `measure.css` 不生效。

**实现前的测试：** `test/w2-c20.test.js`，夹具 `test/fixtures/w2-c20/` 已锁定，当前 4 个失败（`docs/verification/w2/evidence/c20-tests-before-impl.log`）。

---

## 改动 1：§7.4 代码块整体替换（C20）

**现在：** 不分层，`line-break` 只写在 `:where(:root:lang(zh))` 上。

**改为：**

```css
/* 分寸 · Measure 基础样式。全部放在 measure 层里：页面上任何不分层的样式，
   以及后声明的层（例如 Tailwind v4 的 utilities），都会覆盖它。
   要让 measure 成为第一个声明的层，请在入口 CSS 的第一行写：@layer measure; */
@layer measure {
  :where(:lang(zh)) {
    line-break: strict;                    /* 广泛可用；写在每个中文元素上，中英混排页面也生效 */
    font-synthesis-style: none;            /* 中文不出假斜体；西文真斜体不受影响 */
    text-emphasis-position: under right;   /* 中文着重号在字下方 */
  }

  :where(:lang(zh)) :where(p, li) {
    line-height: 1.75;
  }

  :where(:lang(zh)) :where(h1, h2, h3) {
    line-height: 1.3;
  }

  /* 行长约束只在显式标记的正文容器里生效，避免挤坏卡片和表格 */
  .measure-prose {
    max-width: 36em;
  }

  /* 实现里的初始值是 no-autospace，必须显式开启；spacing: text 模式下由 init 命令删掉这一段 */
  @supports (text-autospace: normal) {
    :where(:lang(zh)) { text-autospace: normal; }
  }
}
```

**和现在相比，变了两处：**
1. **整体包进 `@layer measure`。** 不分层的普通声明，优先于任何 `@layer` 里的声明；后声明的层，优先于先声明的层。所以只要 `measure` 是第一个声明的层，它就排在所有分层样式之下，同时也排在所有不分层样式之下。
2. **`line-break: strict` 从 `:where(:root:lang(zh))` 移到 `:where(:lang(zh))`。** 原写法只作用在根元素上，`<html lang="en">` 里的中文片段拿不到。`line-break` 是继承属性，写在每个中文元素上，效果相同，而且混排页面也生效。

---

## 改动 2：§7.4 正文的「优先级」一段（C20、A-55）

**现在：**

> **优先级：** 所有规则都包在 `:where()` 里，优先级为 0，用户自己的样式永远优先。

**改为：**

> **优先级与层：** 所有规则都放在 `@layer measure` 里，选择器包在 `:where()` 里，优先级为 0。
> - 页面上不分层的样式，永远优先于 `measure.css`。
> - 分层的样式（比如 Tailwind v4 的 `@layer utilities`）是否优先，取决于层的声明顺序。要让 `measure` 排在最前，也就是优先级最低，请在入口 CSS 的第一行写 `@layer measure;`。
> - 如果 `measure.css` 是在其他层声明之后才引入的，又没有这一行，`measure` 层就会排在后面，反而盖过这些层。
> - 不支持 `@layer` 的浏览器（Chrome 99、Firefox 97、Safari 15.4 之前）会忽略整份 `measure.css`。

---

## 改动 3：§5.1 第 190 行的一句话（A-55）

**现在：**

> ……包含 T02、T04、T06、T08 的安全默认值，优先级为 0，不会覆盖用户样式；……

**改为：**

> ……包含 T02、T04、T06、T08 的安全默认值，全部放在 `@layer measure` 里、优先级为 0；在入口 CSS 第一行写 `@layer measure;` 时，它不会覆盖用户的任何样式（包括分层样式）；……

---

## 改动 4：§7.3 补上 `Thresholds` 的定义（C21、A-53）

**现在：** `MeasureConfig.thresholds` 用的是内联的 `Partial<{…}>`，但 `LintResult.run.threshold_overrides` 引用了没有定义的 `Thresholds` 类型。

**改为：** 在 `MeasureConfig` 前面加一段定义，并把 `thresholds?: Partial<{…}>` 改成 `thresholds?: Partial<Thresholds>`。

```ts
export interface Thresholds {
  line_length_warn: number;      // 默认 40，只能调到 20–40
  line_length_error: number;     // 默认 45，只能调到 20–45
  body_line_height_min: number;  // 默认 1.5，只能调到 1.5–2.0
  min_font_px_body: number;      // 默认 14，只能调到 14–24
  webfont_budget_kb: number;     // 默认 300，只能调到 50–300
}
```

---

## 改动 5：附录 C

- C20 一行：「W2 待办」改为「已实现（W2）」，并写上实现的 commit。
- 新增 C21 一行：§7.3 补 `Thresholds` 定义；§5.1、§7.4 改写「不会覆盖用户样式」的说法。

---

## 同时要改的地方（不涉及 PRD，随实现一起做）

- `skills/measure/assets/measure.css`、`packages/cli/assets/measure.css`：替换成改动 1 的代码块。V-10 仍然逐字比对 PRD §7.4。
- `init --spacing text`：原来的删除逻辑会把层的闭合花括号一起删掉，改为只删 `@supports` 那一段（已有测试覆盖）。
- `SKILL.md` 第 4 步、`README.md`「已知设计问题」、`references/scenarios/web.md`：改为说明 `@layer measure;` 的写法；删掉「已知设计问题」里的这一条。
- golden 页面是锁定的，里面内联的是旧版基础样式，不改。它们的测试结果不受影响。
