// 伪成功扫描的一部分：在源码里找跨行的空 catch 块（花括号里什么都没写的 catch）。有匹配时逐个打印。
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const files = [...walk("packages/cli/src"), ...walk("scripts"), "bench/run-baseline.mjs", "bench/perf.mjs"];
let n = 0;
for (const f of files) {
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(/catch\s*(\([^)]*\))?\s*\{\s*\}/g)) {
    n++;
    console.log(`空 catch：${f}:${s.slice(0, m.index).split("\n").length}`);
  }
}
if (n === 0) console.log("");
