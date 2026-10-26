// 用完整档重新检查对照组 v2 的 60 个页面，和基础档的结果放在一起比较，并记录耗时。
// 只读 bench/runs 下的已有产物，不调用任何 agent。截图写进临时目录，跑完删除。
// 用法：node bench/render-compare.mjs --out <工作区内的 .json 路径>
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runRender, runLint } from "../packages/cli/dist/index.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.indexOf("--out");
if (outArg < 0) {
  console.error("用法：node bench/render-compare.mjs --out <文件>");
  process.exit(2);
}
const out = join(repo, process.argv[outArg + 1]);

// 按页面统计：每页的 error 规则集合 → 零 error 页数、排除 T02/T04 后的零 error 页数、各规则命中的页数
function stats(res) {
  const pages = new Map();
  for (const f of res.findings) {
    if (!f.file.endsWith(".html")) continue;
    if (!pages.has(f.file)) pages.set(f.file, new Set());
    if (f.severity === "error") pages.get(f.file).add(f.rule);
  }
  const perRule = {};
  for (const set of pages.values()) for (const r of set) perRule[r] = (perRule[r] ?? 0) + 1;
  const zero = (ex) => [...pages.values()].filter((set) => [...set].every((r) => ex.includes(r))).length + (res.summary.cjk_files - pages.size);
  return { zero_error: zero([]), zero_error_excl_T02_T04: zero(["T02", "T04"]), per_rule_pages: perRule };
}

const groups = [];
for (const agent of ["codex", "claude-code"]) {
  const dir = `bench/runs/2026-W2-baseline-isolated-v2-${agent}`;
  const ev = mkdtempSync(join(repo, "test", "tmp-render-compare-"));
  try {
    const t0 = Date.now();
    const r = await runRender({ inputs: [dir], root: repo, cwd: repo, evidenceDir: ev });
    const ms = Date.now() - t0;
    const s = runLint({ inputs: [dir], root: repo, cwd: repo });
    groups.push({
      agent,
      dir,
      cjk_pages: r.summary.cjk_files,
      status: r.summary.status,
      skipped: r.run.skipped_inputs,
      ms,
      browser: r.run.render.browser,
      widths: r.run.render.widths,
      screenshots: r.findings.filter((f) => f.evidence).length,
      render: stats(r),
      static: stats(s)
    });
  } finally {
    rmSync(ev, { recursive: true, force: true });
  }
}
mkdirSync(dirname(out), { recursive: true });
const tmp = `${out}.${process.pid}.tmp`;
writeFileSync(tmp, JSON.stringify({ schema_version: "1.0.0", generated_at: new Date().toISOString(), groups }, null, 2) + "\n");
renameSync(tmp, out);
for (const g of groups) console.log(`${g.agent}：${g.cjk_pages} 页，${(g.ms / 1000).toFixed(1)} 秒，${g.status}；完整档 ${JSON.stringify(g.render)}；基础档 ${JSON.stringify(g.static)}`);
