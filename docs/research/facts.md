# 外部事实核验汇总（分寸 · Measure）

- **核验日期：** 2026-10-25
- **方法：** 三个子 agent 并行，只读官方来源（官方仓库 LICENSE、MDN browser-compat-data、W3C、国家标准全文公开系统、厂商授权原文、Anthropic / OpenAI 官方文档和源码）。
- **抽查：** Claude Code 亲自复核了 5 处一手来源，结果全部一致，详见文末。
- **用途：** PRD 附录 A 的依据。每条事实的原文摘录和链接都在下面三份分册里。

| 分册 | 覆盖内容 |
|---|---|
| [facts-fonts-standards.md](facts-fonts-standards.md) | 20 款中文字体的授权；W3C clreq 的许可证；GB/T 15834 和 15835 是否现行 |
| [facts-css.md](facts-css.md) | 11 项 CSS 中文排版特性的浏览器支持；规范原文引用 |
| [facts-spec-libs.md](facts-spec-libs.md) | Agent Skills 规范、Claude plugin、Codex skill 路径和 `openai.yaml`、`npx skills`；第三方库的 license 和维护状态；taste-skill 和 hallmark 的结构 |

---

## 会改变产品决策的结论

### 字体
1. **「免费商用」不等于「能做网页字体」。** 阿里巴巴普惠体、HarmonyOS Sans、MiSans、OPPO Sans 可以用来出商用图片，但不能自托管成 webfont：普惠体禁止转换和拆分，其余三款禁止修改，或者限制分发。由此提出新增「🔵 可出图」一档（PRD O9）。
2. **OFL 字体子集化以后要改名。** 有保留字体名（RFN）的包括思源（「Source」）、霞鹜文楷、得意黑。Noto CJK 没有 RFN，所以是子集 webfont 的首选。
3. **HarmonyOS Sans 和 MiSans 的授权可以撤销，并且要求署名。**
4. **方正的「免费字体」只对「发布使用」免费**，嵌入网站仍然需要授权。汉仪即使是个人非商用，也必须先注册账号。
5. **苹方和微软雅黑只能写进字体栈调用**，不能自托管。微软 FAQ 明确：做成图片视同打印，商用不受限。

### CSS
6. **`text-autospace` 要显式写成 `normal`。** Chrome 140、Firefox 145、Safari 18.4 的实现里，初始值都是 `no-autospace`。文本里已经有空格时，它不会再额外加间距。
7. **`text-spacing-trim` 只有 Chrome 和 Edge 123 及以上支持。** 它的初始值本来就会生效，所以不写进默认片段。
8. **以下几项不放进默认片段：**
   - `word-break: auto-phrase`：对中文无效
   - `hanging-punctuation`：只有 Safari 支持
   - `text-wrap: pretty`：Firefox 不支持
9. **可以安全使用的：**
   - `line-break: strict`
   - `font-synthesis-style: none`（Chrome 97、Firefox 111、Safari 16.4 起支持）
   - `text-emphasis`：不需要加前缀；中文要写 `under right`
   - `:lang(zh)`：能匹配 `zh-CN`；`:lang(zh-Hans)` 匹配不到

### 规范与依赖
10. **Codex 的用户级 skill 路径是 `~/.agents/skills`。** `$CODEX_HOME/skills` 已标为弃用，但仍然可以用。依据是 openai/codex 源码，在 rust-v0.149.0 和 rust-v0.164.0 两个版本里内容相同。**这和用户全局 CLAUDE.md 里的记录冲突，等用户决定要不要修改。**
11. **SKILL.md 的 frontmatter 只能用 6 个白名单字段。** `name` 必须和目录名一致；`description` 不超过 1024 字符；正文建议控制在 500 行以内、少于 5000 tokens。
12. **依赖收缩。** autocorrect-node、zhlint、Han 都已经很久没发版，不作为依赖。cn-font-split 有 postinstall 下载二进制的行为，只在文档里提到。Node 版本下限定为 20.19。
13. **两项国标都是现行的。** GB/T 15834 有修订计划，状态是「暂缓」。clreq 允许改写和再分发，条件是附上 NOTICE 并注明出处。

## 还没核实的（已写进 PRD 开放决策）

- 站酷高端黑等非 OFL 字体的完整条款：要下载 ZIP 才能读到（O10）。
- 华为 2026-06 版 HarmonyOS Sans 附带的协议：要下载 ZIP 才能读到（O11）。
- 霞鹜文楷在自己网站上托管子集时，能不能保留原名（O12）。
- Codex 对 `marketplace.json` 兼容到什么程度。
- 公众号编辑器的过滤规则：没有官方文档，P1 实测。
- `text-wrap` 对 CJK 的实际效果：P1 实测。

## 抽查记录（Claude Code 亲自复核）

| 项目 | 一手来源 | 结果 |
|---|---|---|
| `text-autospace` 的初始值和支持版本 | mdn/browser-compat-data `css/properties/text-autospace.json` | 一致 |
| `text-spacing-trim` 只有 Chrome 123 及以上支持 | 同上，`text-spacing-trim.json` | 一致 |
| `font-synthesis-style` 的支持版本 | 同上 | Chrome 97、Firefox 111、Safari 16.4 |
| Codex skill 路径 | openai/codex `codex-rs/ext/skills/src/host_roots.rs`，两个版本 | 一致 |
| 微软雅黑不能自托管，出图视同打印 | learn.microsoft.com 字体再分发 FAQ | 一致 |
| HarmonyOS Sans 禁止修改、要求署名、授权可撤销 | openharmony/global_system_resources `LICENSE_Fonts` | 一致 |
