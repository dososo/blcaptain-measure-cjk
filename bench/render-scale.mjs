// 完整档的耗时随页面规模的变化（AUDIT_RENDER_r7 RG-02）：同一父元素下 N 个中文元素，以及 800 段的长文章。
// 页面在临时目录里生成，只用 1280px 一种宽度，跑完删除。用法：node bench/render-scale.mjs
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRender } from "../packages/cli/dist/index.js";

const base = mkdtempSync(join(tmpdir(), "measure-scale-"));
const ws = join(base, "ws");
mkdirSync(ws);
const head = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>:where(:lang(zh)){line-break:strict;text-autospace:normal} body{font-family:"PingFang SC",sans-serif} p,li{line-height:1.75} main{max-width:36em}</style></head><body><main>`;
const pages = {};
for (const n of [1000, 2000, 3000]) pages[`siblings-${n}.html`] = head + Array.from({ length: n }, (_, i) => `<span>第${i}项中文</span>`).join("") + "</main></body></html>";
pages["article-800.html"] = head + Array.from({ length: 800 }, (_, i) => `<p>第${i}段：排版的分寸在于让读者忘记排版本身，只留下内容与节奏。</p>`).join("\n") + "</main></body></html>";
try {
  for (const [name, html] of Object.entries(pages)) {
    writeFileSync(join(ws, name), html);
    const t0 = Date.now();
    const r = await runRender({ inputs: [name], root: ws, cwd: ws, widths: [1280], evidenceDir: join(ws, "evidence") });
    console.log(`${name}：${((Date.now() - t0) / 1000).toFixed(1)} 秒，状态 ${r.summary.status}`);
  }
} finally {
  rmSync(base, { recursive: true, force: true });
}
