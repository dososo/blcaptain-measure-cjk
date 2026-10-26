// iter2b：RULING-03 的替代反例。原夹具 iter2/T06-neg-layer-only-A11 里有一条不分层的 line-height: 1.75，
// 按 @layer 规则它优先于分层声明，所以原夹具不是有效反例。这里去掉不分层的行高，只留分层声明。
// 注意：本夹具写于实现之后，证据分量弱于先锁定的夹具，已在 RULINGS.md 说明。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, "T06-neg-layer-only-v2-A11.html"), `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>iter2b 夹具</title><style>
:where(:root:lang(zh)) { line-break: strict; }
@supports (text-autospace: normal) { :where(:lang(zh)) { text-autospace: normal; } }
body { font-family: "PingFang SC", sans-serif; font-size: 16px; }
@layer base { p { line-height: 1.75; } }
@layer utilities { .leading-tight { line-height: 1.25; } }
</style></head>
<body><main style="max-width: 36em"><p class="leading-tight">这一段正文足够长，用来模拟会折行的多行正文，长度超过三十个汉字，确保它是真正的段落而不是单行说明。</p></main></body>
</html>
`);
console.log("已生成 1 个 iter2b 夹具");
