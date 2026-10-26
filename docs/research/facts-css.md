# 分寸 · Measure：CSS 特性外部事实核验（facts-css）

- 核验日期：2026-10-25
- 当前步骤：第 1 步「调研」（执行：Claude Code）
- 主数据源：
  - mdn/browser-compat-data（BCD）`main` 分支，commit `56e6f1217a54`（2026-10-24），用 `gh api repos/mdn/browser-compat-data/contents/css/...json` 读取原始 JSON
  - Baseline 状态：web-platform-dx/web-features `features/*.yml.dist`，commit `2c24bbfc45cf`（2026-10-22）
  - 规范：CSS Text 4 ED（2026-08-14）、CSS Text 3 CRD（2026-08-14）、Selectors 4 ED（2026-09-18）、CSS Fonts 4 ED（2026-10-22）、CSS Text Decoration 3 CR（2022-05-05）
  - 字体特性：Adobe 官方仓库 feature 源文件，加上本机字体文件的 GSUB/GPOS 表（用 fontTools 4.61.1 读取）
- 读表约定：
  - BCD 里 Edge 79 以后和 iOS Safari 都标为 `mirror`，表示版本跟随 Chrome 或 Safari。iOS 一列在 web-features 给出了具体版本时用该版本，否则写「同 Safari」。
  - Baseline 状态：「广泛可用」=widely available（high），「新近可用」=newly available（low），「未达 Baseline」=false。
  - 「✗」表示 BCD 中该浏览器为 `false`（不支持）。「TP」表示仅 Safari Technology Preview 支持。
- 核验状态：「已核验」= 已直读上述一手来源；「待确认」= 一手来源没有覆盖，或者需要实际渲染测试。

## 一、核验总表

| 特性 | Chrome | Edge | Firefox | Safari | iOS Safari | Baseline | 对中文的说明 | 来源 URL | 核验状态 |
|---|---|---|---|---|---|---|---|---|---|
| `text-autospace`（属性本身，`normal` / `no-autospace`） | 140 | 140 | 145 | 18.4 | 18.4 | `normal`/`no-autospace` 子集：新近可用（2025-11-11）；整个特性：未达 Baseline（受 `insert` 和关键字取值拖累） | 三家浏览器都有 BCD 备注：**实现的初始值是 `no-autospace`，不是规范里的 `normal`**（csswg-drafts #12386，仍 open）。所以不写声明就不会加间距，必须显式写 `text-autospace: normal`。`normal` 等于 `ideograph-alpha ideograph-numeric`，间距为 1/8ic。 | https://github.com/mdn/browser-compat-data/blob/main/css/properties/text-autospace.json ；https://github.com/web-platform-dx/web-features/blob/main/features/text-autospace.yml.dist ；https://github.com/w3c/csswg-drafts/issues/12386 | 已核验 |
| `text-autospace: ideograph-alpha` / `ideograph-numeric` / `auto` | ✗ | ✗ | 145 | 18.4 | 18.4 | 未达 Baseline | Chrome 只支持 `normal` 和 `no-autospace`，单独写 `ideograph-alpha` 在 Chrome 中是无效声明。 | 同上 | 已核验 |
| `text-autospace: insert` | ✗ | ✗ | 145 | 27 | 27 | 未达 Baseline | `insert` 是默认行为：已经有空白字符（Unicode Z 类）时不再加间距。 | 同上 | 已核验 |
| `text-autospace: replace` / `punctuation` | 待确认 | 待确认 | 待确认 | 待确认 | 待确认 | 待确认 | BCD 中没有这两个取值的条目。`punctuation` 在本级规范里只对法语生效，对中文没有作用（规范原文见 Q1）。 | https://drafts.csswg.org/css-text-4/#text-autospace-property | 规范已核验；支持情况待确认 |
| `text-spacing-trim`（`normal` / `space-all` / `space-first` / `trim-start`） | 123 | 123 | ✗ | ✗ | ✗ | 未达 Baseline（BCD 标 experimental） | `trim-both`、`trim-all`、`auto` 没有任何浏览器实现（MDN）。**字体依赖**：MDN 写明字体必须带 OpenType `halt` 或 `chws`，两者都没有时该属性不生效；Chromium 提交 0b674d4 也写明 `HanKerning` 只在字体有 `halt` 或 `chws` 时启用。规范允许用 `halt`/`vhal` 实现挤压，同时禁止用 `hwid` 替换成半角字形。初始值是 `normal`，本身就会挤压相邻标点（BCD 对此没有偏差备注）。 | https://github.com/mdn/browser-compat-data/blob/main/css/properties/text-spacing-trim.json ；https://developer.mozilla.org/en-US/docs/Web/CSS/text-spacing-trim ；https://chromium.googlesource.com/chromium/src/+/0b674d415f8758284cfca9432e2fcbbd46183b40 | 已核验 |
| `line-break: strict` | 58（属性去前缀；`strict` 取值 25 起，需 `-webkit-`） | 79（Edge 14 起已有该属性） | 69 | 11（属性去前缀；`strict` 取值 8 起，需 `-webkit-`） | 11 | 广泛可用（2023-01-28，按整个 line-break 特性计） | 规范对中文强制要求的 normal 与 strict 差别只有一条：normal/loose 允许在 〜 U+301C、゠ U+30A0 前断行，strict 不允许。小假名、々 等规则主要针对日文。其余差别由浏览器自定（实际一般取自 ICU），对中文的实际可见效果待确认，需要渲染测试。 | https://github.com/mdn/browser-compat-data/blob/main/css/properties/line-break.json ；https://www.w3.org/TR/css-text-3/#line-break-property | 支持已核验；中文实际效果待确认 |
| `word-break: auto-phrase` | 119 | 119 | ✗ | TP | TP | 未达 Baseline（experimental） | **对中文无效。** BCD 的 Chrome 备注：只对内容语言解析为 `ja` 或 `ko` 的文本生效，其他语言按 `normal` 处理。Chrome 博客（2023-12）写的是「目前只支持日文，计划支持中韩」。规范规定：浏览器不会识别该语言的短语边界时，必须按 `normal` 处理。 | https://github.com/mdn/browser-compat-data/blob/main/css/properties/word-break.json ；https://developer.chrome.com/blog/css-i18n-features ；https://drafts.csswg.org/css-text-4/#valdef-word-break-auto-phrase | 已核验 |
| `text-wrap: balance` | 114 | 114 | 121 | 17.5 | 17.5 | 新近可用（2024-05-13），按 web-features 推算 2026-11 前后转为广泛可用 | 规范与语言、文字无关：只在已有的软换行机会之间挑选断点，不新增换行机会。没有找到针对 CJK 的实现说明。行数上限：Chromium ≤6 行，Firefox ≤10 行（MDN）；WebKit 不限行数（WebKit 博客）。 | https://github.com/mdn/browser-compat-data/blob/main/css/properties/text-wrap.json ；https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap-style ；https://webkit.org/blog/16547/better-typography-with-text-wrap-pretty/ | 支持已核验；CJK 实测效果待确认 |
| `text-wrap: pretty` | 117 | 117 | ✗ | 26 | 26 | 未达 Baseline | 规范没有 CJK 专门表述。Chrome 博客说目前主要处理孤行（orphans）。WebKit 博客的 demo 里有中文和日文样例，但没有说明对 CJK 的具体策略。 | https://github.com/mdn/browser-compat-data/blob/main/css/properties/text-wrap.json ；https://developer.chrome.com/blog/css-text-wrap-pretty ；https://webkit.org/blog/16547/better-typography-with-text-wrap-pretty/ | 支持已核验；CJK 效果待确认 |
| `text-wrap-style`（longhand：`balance` / `pretty`） | 130 | 130 | 124（`pretty` ✗） | 17.5（`pretty` 为 26） | 同 Safari | 同上两行 | 用 shorthand `text-wrap` 兼容面更广。 | https://github.com/mdn/browser-compat-data/blob/main/css/properties/text-wrap-style.json | 已核验 |
| `hanging-punctuation` | ✗ | ✗ | ✗ | 26.5 完整支持（10 起为部分支持：`first`/`last` 不处理 U+0027、U+0022；`force-end` 16.4 起） | 26.5 | 未达 Baseline | 只有 Safari 支持。`first`/`last` 覆盖 Ps/Pe/Pi/Pf 类括号和引号（「」“”等）以及 U+3000。`allow-end`/`force-end` 只覆盖 、。，． 等句号和逗号，不包括 ！？：；。 | https://github.com/mdn/browser-compat-data/blob/main/css/properties/hanging-punctuation.json ；https://www.w3.org/TR/css-text-3/#hanging-punctuation-property | 已核验 |
| OpenType `halt` / `chws` / `vhal` / `vpal`（字体侧） | — | — | — | — | — | 不适用 | 思源黑体、思源宋体（master 分支 SC feature 源文件）：有 `halt`、`vhal`、`palt`、`vpal`，**没有 `chws`/`vchw`**。Noto Sans CJK SC 2.004、Noto Serif CJK SC 2.003（本机副本）：同上，没有 `chws`/`vchw`。苹方 PingFang SC 21.0d1e1（macOS 26.6.2 本机）：只有 `halt`（另有 `hwid`/`vert`），没有 `vhal`/`vpal`/`chws`。冬青黑体简体中文 21.1d1e1（本机）：`halt`、`vhal`。微软雅黑等 Windows 字体：待确认。 | https://github.com/adobe-fonts/source-han-sans/blob/master/Masters/Regular/OTC/features.OTC.SC ；https://github.com/adobe-fonts/source-han-serif/blob/master/Masters/Regular/OTC/features.OTC.SC ；本机 fontTools 读取（见第四节） | 思源/Noto/苹方：已核验（苹方仅对应本机版本）；其他字体：待确认 |
| `writing-mode: vertical-rl` | 48（`-webkit-` 8 起） | 12 | 43（属性 41 起） | 9（取值；属性去前缀 10.1 起） | 10.3 | 广泛可用（2019-09-27） | 竖排可以放心使用。 | https://github.com/mdn/browser-compat-data/blob/main/css/properties/writing-mode.json ；https://github.com/web-platform-dx/web-features/blob/main/features/writing-mode.yml.dist | 已核验 |
| `text-combine-upright`（`all` / `none`） | 48 | 79 | 48 | 15.4 | 15.4 | 广泛可用（2024-09-14） | 用于竖排中的纵中横（如年份数字）。`digits <integer>` 取值在 BCD 中没有条目，待确认。旧版 `-webkit-text-combine` 是部分实现。 | https://github.com/mdn/browser-compat-data/blob/main/css/properties/text-combine-upright.json | 已核验（`digits` 待确认） |
| `font-synthesis`（shorthand，含 `none`） | 97 | 97 | 34 | 9 | 9 | 广泛可用（2024-07-06） | 设为 `none` 后，粗体也不再合成（见下一行）。 | https://github.com/mdn/browser-compat-data/blob/main/css/properties/font-synthesis.json | 已核验 |
| `font-synthesis-weight` / `font-synthesis-style`（`auto` / `none`） | 97 | 97 | 111 | 16.4 | 16.4 | 广泛可用（2025-09-27） | 按规范的字重匹配算法：字体家族没有粗体字面、又禁止合成时，会退到最接近的现有字重（目标 >500 时先向更重找，再向更轻找）。结果是 `<strong>`、`<b>`、标题都会显示成常规字重，粗体强调丢失。这是按规范推导的，未做渲染测试。规范注释说 CJK 字体几乎都没有斜体，所以对中文更适合只关掉 `style`。`oblique-only` 只有 Firefox 137 支持。 | https://github.com/mdn/browser-compat-data/blob/main/css/properties/font-synthesis-weight.json ；https://drafts.csswg.org/css-fonts-4/#font-synthesis-weight ；https://drafts.csswg.org/css-fonts-4/#font-matching-algorithm | 支持已核验；显示效果按规范推导，渲染待确认 |
| `text-emphasis`（着重号，含 `-style`/`-color`） | 99（`-webkit-` 25 起） | 99 | 46 | 7（BCD 同时列出无前缀和 `-webkit-`，均为 7 起） | 7 | 广泛可用（2024-09-03） | 按 BCD，当前主流版本**不再需要 `-webkit-` 前缀**；加前缀只对 Chrome < 99 有用，属于可选回退。中文着重号习惯放在字下方，规范表格写明中文首选 `under right`，而初始值是 `over right`，所以必须显式设置位置。 | https://github.com/mdn/browser-compat-data/blob/main/css/properties/text-emphasis.json ；https://www.w3.org/TR/css-text-decor-3/#text-emphasis-position-property | 已核验 |
| `text-emphasis-position: under` | 99 | 99 | 108 | 7 | 7 | 广泛可用（2025-06-13） | 见上一行。`auto` 取值只有 Firefox 132 支持（experimental）。 | https://github.com/mdn/browser-compat-data/blob/main/css/properties/text-emphasis-position.json | 已核验 |
| `:lang()` 基本形式 | 1 | 12 | 1 | 3.1 | 同 Safari | 广泛可用（2018-01-29） | `:lang(zh)` 能匹配 `lang="zh-CN"`、`zh-Hans`、`zh-Hans-CN`、`zh-TW`（前缀或扩展过滤匹配）。**`:lang(zh-Hans)` 不能匹配 `lang="zh-CN"`**：规范只要求按 RFC 5646 §4.5 做规范化（转成 extlang 形式），不会补全文字子标签。 | https://github.com/mdn/browser-compat-data/blob/main/css/selectors/lang.json ；https://drafts.csswg.org/selectors-4/#the-lang-pseudo | 已核验（规范）；各浏览器实测待确认 |
| `:lang()` 参数列表 / 通配符（`:lang(zh-Hans, zh-CN)`、`:lang("*-Hans")`） | ✗ | ✗ | 114 | 9 | 9 | 不单独计入（BCD 子特性） | Chrome 和 Edge 都不支持，**不能写成逗号参数列表**，要写成选择器列表 `:lang(zh-Hans), :lang(zh-CN)`。`:lang(zh-CN)` 能否匹配 `lang="zh-Hans-CN"`：按 RFC 4647 扩展过滤应当匹配，但 Chrome 不支持通配符和扩展过滤，实际行为待确认。 | https://github.com/mdn/browser-compat-data/blob/main/css/selectors/lang.json | 支持已核验；`zh-CN` 匹配 `zh-Hans-CN` 的行为待确认 |

## 二、规范原文引用（每段 ≤3 句）

**Q1. `text-autospace` 遇到已有空格时会不会再加间距**（CSS Text 4 ED，§8.4 / §8.4.1，https://drafts.csswg.org/css-text-4/#text-autospace-property ）

> insert: "The specified spacing is automatically inserted if there are no space characters of any kind (Unicode general category Z) already there. This is the default behavior: if neither insert nor replace are specified, insert is assumed."

> §8.4.1: "The ideograph-alpha and ideograph-numeric values introduce spacing at the boundary between particular classes of characters when they are directly adjoining on a line, i.e. without any intervening non-zero margin, border, or padding or intervening characters (such as a quotation mark or a space). The amount of space introduced by these keywords is 1/8 of the CJK advance measure, i.e 0.125ic if the used value of font-size is same as its computed value."

> replace: "The specified spacing is automatically inserted even if there is already a space (U+0020) at that point; additionally, the space (U+0020) is removed."

结论：默认（`insert`）情况下，已有真实空格（包括 U+0020、U+00A0、U+3000 等 Z 类字符）时**不会再加间距**。只有 `replace` 会把 U+0020 换成自动间距，而 `replace` 的浏览器支持情况待确认。另有一条规定：该属性不得影响纯文本复制粘贴的内容。

**Q1 补充：`punctuation` 取值的适用范围**（同上）

> "In this level, if the element's content language is French, narrow no-break space (U+202F) and no-break space (U+00A0) is inserted where required by French typographic guidelines. Otherwise this value has no effect."

**Q2. `text-spacing-trim` 与 OpenType 特性**（CSS Text 4 ED，§8.5.1，https://drafts.csswg.org/css-text-4/#fullwidth-collapsing ）

> "The UA may use the OpenType halt and vhal features if implemented by a font in order to perform the requisite trimming of a particular glyph. The UA must not use the hwid feature or otherwise substitute halfwidth forms as switching to halfwidth glyphs can change the glyph shape which is not acceptable here."

> "If there is no support in the font for distinguishing fullwidth vs halfwidth glyph shapes (e.g. through font features), then for such proportional glyphs, the given advance width is considered simultaneously full-width and half-width: the UA must not add or remove space to these glyphs."

**Q3. `line-break: strict` 对中文的强制差别**（CSS Text 3 CRD，https://www.w3.org/TR/css-text-3/#line-break-property ）

> "The following breaks are allowed for normal and loose line breaking if the writing system is Chinese or Japanese, and are otherwise forbidden: breaks before certain CJK hyphen-like characters: 〜 U+301C, ゠ U+30A0"

> "The precise set of rules in effect for each of loose, normal, and strict is up to the UA and should follow language conventions."

**Q4. `word-break: auto-phrase` 不支持的语言按 `normal` 处理**（CSS Text 4 ED，https://drafts.csswg.org/css-text-4/#word-break-property ）

> "If the content language of the element is unknown, or if the user agent does not know how to detect phrase boundaries for that particular language, this value must behave as normal."

**Q5. `text-wrap-style` 与文字无关**（CSS Text 4 ED，https://drafts.csswg.org/css-text-4/#text-wrap-style ）

> "It does not change which soft wrap opportunity exist, but changes how the user agent selects among them."

> balance: "UAs may treat this value as auto if there are more than ten lines to balance."

**Q6. `hanging-punctuation` 覆盖的字符**（CSS Text 3 CRD，https://www.w3.org/TR/css-text-3/#hanging-punctuation-property ）

> first: "An opening bracket, quote, or ideographic space at the start of the first formatted line of an element hangs. This applies to all characters in the Unicode categories Ps, Pf, Pi plus the ASCII quote marks U+0027 ' APOSTROPHE and U+0022 " QUOTATION MARK and the IDEOGRAPHIC SPACE U+3000."

可以悬挂的句号和逗号列表包括 U+3001 、、U+3002 。、U+FF0C ，、U+FF0E ．，不包括 ！？：；。

**Q9. 字体合成**（CSS Fonts 4 ED，https://drafts.csswg.org/css-fonts-4/ ）

> "Although the practice is not well-loved by typographers, bold faces are often synthesized by user agents for families that lack actual bold faces. For the purposes of font matching, these faces must be treated as if they exist within the family. Authors can explicitly avoid this behavior by using the font-synthesis property."

> "Many scripts lack the tradition of mixing a cursive form within text rendered with a normal face. Chinese, Japanese and Korean fonts almost always lack italic or oblique faces."

> §5 字重匹配："If the desired weight is greater than 500, weights greater than or equal to the desired weight are checked in ascending order followed by weights below the desired weight in descending order until a match is found."

**Q10. 中文着重号位置**（CSS Text Decoration 3 CR，https://www.w3.org/TR/css-text-decor-3/#text-emphasis-position-property ）

> "Note, the preferred position of emphasis marks depends on the language. In Japanese for example, the preferred position is over right. In Chinese, on the other hand, the preferred position is under right."

**Q11. `:lang()` 匹配规则**（Selectors 4 ED，§7.2，https://drafts.csswg.org/selectors-4/#the-lang-pseudo ）

> "The element's content language matches a language range if its content language, as represented in BCP 47 syntax, matches the given language range in an extended filtering operation per [RFC4647] Matching of Language Tags (section 3.3.2). The content language and the language range must be canonicalized and converted to extlang form as per section 4.5 of [RFC5646] prior to the extended filtering operation; language tags or ranges that are not valid do not match anything."

## 三、对 measure.css 的影响（供第 3 步「计划」使用，不是最终决策）

1. **可以放进默认片段（广泛可用）**：`line-break: strict`、`writing-mode`、`text-combine-upright: all`、`text-emphasis` 系列（无前缀，位置写 `under right`）、`font-synthesis-style`、`:lang(zh)`。
2. **只能作为渐进增强**：
   - `text-autospace: normal`：仅新近可用；Chrome 只认 `normal`/`no-autospace`；所有实现的初始值都是 `no-autospace`，必须显式写。
   - `text-wrap: balance`：新近可用，降级时无副作用。
   - `text-wrap: pretty`：Firefox 不支持。
   - `text-spacing-trim`：只有 Chromium 支持，而且依赖 `halt`/`chws`。
   - `hanging-punctuation`：只有 Safari 26.5 及以上支持。
3. **不放进中文默认片段**：`word-break: auto-phrase`，对中文没有效果。
4. **不能放进全局默认**：`font-synthesis: none` 或 `font-synthesis-weight: none`，没有粗体字面的中文字体会丢失粗体强调。
5. **选择器写法**：Chrome 不支持 `:lang()` 参数列表；`:lang(zh-Hans)` 匹配不到 `zh-CN`。简体和繁体需要分别写多个选择器。

## 四、本机字体特性读取记录（证据）

- 工具：`python3 -I` + fontTools 4.61.1，读取 GSUB 和 GPOS 的 FeatureList，只筛选 `halt`/`chws`/`vhal`/`vpal`/`palt`/`vchw`/`hwid`/`vert`。
- 系统：macOS 26.6.2（25G83）。
- 结果：

| 字体（版本） | 文件来源 | 命中的特性 |
|---|---|---|
| PingFang SC/TC/HK/MO 全部字重（21.0d1e1） | macOS 系统 MobileAsset（`PingFang.ttc`） | `halt` `hwid` `vert` |
| Hiragino Sans GB W3/W6（21.1d1e1） | `/System/Library/Fonts/Hiragino Sans GB.ttc` | `halt` `hwid` `vert` `vhal` |
| Noto Sans CJK SC/TC/HK/JP/KR（Version 2.004） | 本机第三方 SDK 中的副本（`NotoSansCJK-Regular.ttc`），版本字符串与官方 Sans2.004 发布一致 | `halt` `hwid` `palt` `vert` `vhal` `vpal` |
| Noto Serif CJK SC 等（Version 2.003） | 同上（`NotoSerifCJK-Regular.ttc`） | `halt` `hwid` `palt` `vert` `vhal` `vpal` |
| 思源黑体、思源宋体 SC（feature 源文件） | adobe-fonts 官方仓库 master 分支 `Masters/Regular/OTC/features.OTC.SC`（Sans 最后修改 2025-06-18，Serif 最后修改 2024-07-30） | 声明了 `halt` `vhal` `palt` `vpal` 等；全文检索 `chws`/`vchw` 命中 0 次 |

- 局限：苹方只读了 OpenType 表，没有检查 AAT（`morx`/`kerx`）表。苹方结论只对应本机这个版本，iOS 和其他 macOS 版本待确认。微软雅黑、Windows 宋体和黑体、Android 系统字体都没有核验（待确认）。
