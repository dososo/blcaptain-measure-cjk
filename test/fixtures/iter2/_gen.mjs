// iter2 夹具：针对独立审计 AUDIT_iter1 的规则类发现，在修改实现之前写好并锁定。
// 命名：<规则>-<neg|pos|warn>-<说明>-<审计编号>.html
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const BASE = `:where(:root:lang(zh)) { line-break: strict; }
:where(:lang(zh)) { font-synthesis-style: none; }
:where(:lang(zh)) :where(p, li) { line-height: 1.75; }
.measure-prose { max-width: 36em; }
@supports (text-autospace: normal) { :where(:lang(zh)) { text-autospace: normal; } }
body { font-family: "Inter", "PingFang SC", "Noto Sans SC", sans-serif; font-size: 16px; }`;
const LONG = "这一段正文足够长，用来模拟会折行的多行正文，长度超过三十个汉字，确保它是真正的段落而不是单行说明。";
const page = (css, body, { lang = "zh-CN", base = BASE } = {}) => `<!doctype html>
<html lang="${lang}">
<head><meta charset="utf-8"><title>iter2 夹具</title><style>
${base}
${css}
</style></head>
<body><main class="measure-prose">
${body}
</main></body>
</html>
`;

const F = {
  // A-11：@layer —— 不分层的声明优先于分层的声明
  "T06-pos-unlayered-beats-layer-A11": page("@layer utilities { .leading-tight { line-height: 1.25; } }\np { line-height: 1.8; }", `<p class="leading-tight">${LONG}</p>`),
  "T06-neg-layer-only-A11": page("@layer base { p { line-height: 1.75; } } @layer utilities { .leading-tight { line-height: 1.25; } }", `<p class="leading-tight">${LONG}</p>`),
  // A-11：CSS 嵌套 —— 嵌套规则只作用于父选择器内部
  "T06-pos-nesting-scoped-A11": page(".card { p { line-height: 1.2; } }", `<p>${LONG}</p>`),
  "T06-neg-nesting-inside-A11": page(".card { & p { line-height: 1.2; } }", `<div class="card"><p>${LONG}</p></div>`),
  // A-11：@supports not(...) —— 现代浏览器支持该特性时不生效
  "T06-pos-supports-not-A11": page("@supports not (display: grid) { p { line-height: 1.1; } }", `<p>${LONG}</p>`),
  // A-11：font 简写里用 var()
  "T11-neg-font-shorthand-var-A11": page(":root { --f: 10px/1.8 \"PingFang SC\", sans-serif; } .note { font: var(--f); }", `<p>${LONG}</p>\n<p class="note">一条很小的说明文字。</p>`),
  "T13-pos-font-shorthand-var-A11": page(":root { --f: 16px/1.8 \"Inter\", \"PingFang SC\", sans-serif; } body { font: var(--f); }", `<p>${LONG}</p>`),
  // A-12：行内元素边界处的半角标点
  "T03-neg-inline-boundary-A12": page("", `<p>这是<strong>重要</strong>,然后去看<a href="#">下一步</a>.最后结束。</p>`),
  // A-13：local() 不算自托管；远程 URL 只给 warn
  "F03-pos-local-only-A13": page("@font-face { font-family: \"Brand\"; src: local(\"PingFang SC\"); }\nh1 { font-family: \"Brand\", \"PingFang SC\", sans-serif; }", `<h1>标题</h1><p>${LONG}</p>`),
  "F03-warn-remote-cdn-A13": page("@font-face { font-family: \"Alibaba PuHuiTi\"; src: url(\"https://cdn.example.com/AlibabaPuHuiTi-3-55-Regular.woff2\"); }\nh1 { font-family: \"Alibaba PuHuiTi\", \"PingFang SC\", sans-serif; }", `<h1>标题</h1><p>${LONG}</p>`),
  // A-14：字体名后缀与文件名大小写
  "F03-neg-founder-free-gbk-suffix-A14": page("@font-face { font-family: \"方正黑体_GBK\"; src: url(\"fonts/fzhei.woff2\"); }\nh1 { font-family: \"方正黑体_GBK\", \"PingFang SC\", sans-serif; }", `<h1>标题</h1><p>${LONG}</p>`),
  "F03-neg-lowercase-fz-filename-A14": page("@font-face { font-family: \"Display\"; src: url(\"fonts/fzltxh.woff2\"); }\nh1 { font-family: \"Display\", \"PingFang SC\", sans-serif; }", `<h1>标题</h1><p>${LONG}</p>`),
  // A-20：T06 没有设置行高——长段落 error，单行短文 warn
  "T06-neg-unset-long-paragraph-A20": page("", `<p>${LONG}</p>`, { base: BASE.replace(":where(:lang(zh)) :where(p, li) { line-height: 1.75; }", "") }),
  "T06-warn-unset-short-line-A20": page("", `<p>按年付费，立省两个月。</p>`, { base: BASE.replace(":where(:lang(zh)) :where(p, li) { line-height: 1.75; }", "") }),
  // A-20：T01 —— 含中文的根元素声明了 lang 即可
  "T01-pos-section-lang-A20": page("", `<section lang="zh-CN"><p>${LONG}</p></section>`, { lang: "en" }),
  "T01-neg-section-without-lang-A20": page("", `<section lang="zh-CN"><p>${LONG}</p></section><aside><p>这一段中文没有被标注语言。</p></aside>`, { lang: "en" }),
  // A-25：隐藏元素不检查；SVG 文字的 font-size 属性要读取
  "T11-pos-hidden-and-sr-only-A25": page(".sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); font-size: 1px; }", `<p>${LONG}</p>\n<p hidden style="font-size: 8px">隐藏的中文</p>\n<span class="sr-only">屏幕阅读器专用文字</span>`),
  "T11-neg-svg-text-attr-A25": page("", `<p>${LONG}</p>\n<svg width="200" height="40"><text x="0" y="20" font-size="9">图表里的小字</text></svg>`),
  // A-31：代码块里的 T13 降为 warn（不再直接跳过）；textarea 不在豁免范围
  "T13-warn-code-mono-stack-A31": page("pre, code { font-family: Menlo, monospace; }", `<p>${LONG}</p>\n<pre><code># 读取所有工作表\nx = 1</code></pre>`),
  "T13-neg-textarea-mono-stack-A31": page("textarea { font-family: Menlo, monospace; }", `<p>${LONG}</p>\n<textarea>默认的中文内容</textarea>`)
};
for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
console.log(`已生成 ${Object.keys(F).length} 个 iter2 夹具`);
