// iter3 夹具：针对复核审计 AUDIT_iter2 的发现，在修改实现之前写好并锁定。
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
const page = (css, body) => `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>iter3 夹具</title><style>
${BASE}
${css}
</style></head>
<body><main class="measure-prose">
<p>${LONG}</p>
${body}
</main></body>
</html>
`;
const B64 = "d09GMgABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const F = {
  // A-32：aria-hidden 只对读屏软件隐藏，页面上看得见，仍要检查
  "T11-neg-aria-hidden-visible-A32": page(".deco { font-size: 7px; }", `<div class="deco" aria-hidden="true">装饰用的中文小字</div>`),
  // A-33：data: URI 内嵌字体等同于分发字体文件
  "F03-neg-data-uri-commercial-A33": page(`@font-face { font-family: "方正兰亭黑"; src: url(data:font/woff2;base64,${B64}) format("woff2"); }\nh2 { font-family: "方正兰亭黑", "PingFang SC", sans-serif; }`, `<h2>标题</h2>`),
  "F03-pos-data-uri-embeddable-A33": page(`@font-face { font-family: "Noto Sans SC"; src: url(data:font/woff2;base64,${B64}) format("woff2"); }`, `<h2>标题</h2>`),
  // A-40：T03 拼接文字时，在嵌套的块级元素处断开
  "T03-pos-nested-block-boundary-A40": page("", `<div>第一部分<ul><li>列表项。</li></ul>.结尾附注 English.</div>`),
  "T03-neg-inline-still-joined-A40": page("", `<div>前一句<em>强调</em>,后一句。</div>`),
  // A-34：超时用的普通页面（测试里把耗时上限设为 0）
  "TIMEOUT-page-A34": page(".tiny { font-size: 9px; letter-spacing: -2px; }", `<p class="tiny">这一段是字号太小的中文。</p>`)
};
for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
console.log(`已生成 ${Object.keys(F).length} 个 iter3 夹具`);
