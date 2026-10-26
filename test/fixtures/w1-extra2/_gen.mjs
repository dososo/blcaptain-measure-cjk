// W1 补充夹具第二组（基线误报分析之后新增，不修改任何已锁定文件）。
// 来源：基线中 claude 生成的页面在 <pre><code> 里写中文注释，代码高亮把注释设为斜体、字体栈只有等宽字体，
// 原来会按正文标准报 T13 / T08 error，属于误报。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const BASE = `:where(:root:lang(zh)) { line-break: strict; }
:where(:lang(zh)) :where(p, li) { line-height: 1.75; }
.measure-prose { max-width: 36em; }
@supports (text-autospace: normal) { :where(:lang(zh)) { text-autospace: normal; } }
body { font-family: "Inter", "PingFang SC", sans-serif; font-size: 16px; }
pre, code { font-family: "JetBrains Mono", Menlo, monospace; }`;
const page = (css, body) => `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>代码块夹具</title><style>
${BASE}
${css}
</style></head>
<body><main class="measure-prose"><h1>代码块夹具</h1><p>正文里有一段代码示例。</p>
${body}
</main></body>
</html>
`;
const CODE = `<pre><code><span class="c"># 读取所有工作表</span>
sheets = read_excel("a.xlsx")</code></pre>`;
const F = {
  "T13-pos-code-mono-stack": page("", CODE),
  "T08-warn-code-italic-comment": page(".c { font-style: italic; }", CODE),
  "T13-neg-body-mono-stack": page("p { font-family: Menlo, monospace; }", ""),
  "T08-neg-body-italic-near-code": page(".c { font-style: italic; } .note { font-style: italic; }", `${CODE}\n<p class="note">这是一段斜体的正文。</p>`)
};
for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
console.log(`已生成 ${Object.keys(F).length} 个补充夹具`);
