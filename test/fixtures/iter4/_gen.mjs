// iter4 夹具：针对复核审计 AUDIT_iter3 的 A-47（隐藏的行内文字又被纳入 T03）。先于实现锁定。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, "T03-pos-hidden-inline-A47.html"), `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>iter4 夹具</title><style>
:where(:root:lang(zh)) { line-break: strict; }
:where(:lang(zh)) :where(p, li) { line-height: 1.75; }
@supports (text-autospace: normal) { :where(:lang(zh)) { text-autospace: normal; } }
body { font-family: "PingFang SC", sans-serif; font-size: 16px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style></head>
<body><main style="max-width: 36em"><p>正常的句子。<span class="sr-only">读屏专用,说明</span><span hidden>隐藏,文字</span></p></main></body>
</html>
`);
console.log("已生成 1 个 iter4 夹具");
