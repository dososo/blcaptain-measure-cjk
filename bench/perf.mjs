// V-11：基础档性能。golden 和真实基线页面单页 p95 ≤ 2 秒；100 个文件总计 ≤ 20 秒；超大页面受单页耗时上限约束。
import { mkdirSync, rmSync, copyFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { cpus, totalmem, platform, arch } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { runLint } from "../packages/cli/dist/index.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const golden = join(repo, "bench", "golden");
const tmp = join(repo, "bench", ".perf-tmp");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(join(tmp, "assets"), { recursive: true });
copyFileSync(join(golden, "assets", "site.css"), join(tmp, "assets", "site.css"));
const pages = readdirSync(golden).filter((f) => /^g\d+\.html$/.test(f));
for (let i = 0; i < 100; i++) copyFileSync(join(golden, pages[i % pages.length]), join(tmp, `p${String(i).padStart(3, "0")}.html`));

console.log(`机器：${cpus()[0]?.model ?? "未知"} × ${cpus().length}，内存 ${(totalmem() / 2 ** 30).toFixed(1)} GB，${platform()}-${arch()}，Node ${process.version}`);

const single = [];
for (let round = 0; round < 3; round++) {
  for (const p of pages) {
    const t0 = performance.now();
    runLint({ inputs: [p], root: golden, cwd: golden });
    single.push(performance.now() - t0);
  }
}
single.sort((a, b) => a - b);
const p95 = single[Math.ceil(single.length * 0.95) - 1];
const t0 = performance.now();
const r = runLint({ inputs: ["."], root: tmp, cwd: tmp });
const total = performance.now() - t0;
rmSync(tmp, { recursive: true, force: true });

console.log(`golden 单页：${single.length} 次，p50 ${single[Math.floor(single.length / 2)].toFixed(1)} ms，p95 ${p95.toFixed(1)} ms（门槛 2000 ms）`);
console.log(`100 个文件：${r.summary.files} 个文件（含 1 个 css），总计 ${total.toFixed(0)} ms（门槛 20000 ms）`);

// A-18：用 60 个真实的基线页面（AI 生成，几十 KB）测单页耗时
const real = [];
for (const agent of ["codex", "claude-code"]) {
  const base = join(repo, "bench", "runs", `2026-W1-baseline-${agent}`);
  if (!existsSync(base)) continue;
  for (const id of readdirSync(base).filter((d) => /^\d{3}$/.test(d))) {
    const out = join(base, id, "output");
    if (!existsSync(out)) continue;
    const t = performance.now();
    runLint({ inputs: ["."], root: out, cwd: out });
    real.push(performance.now() - t);
  }
}
real.sort((a, b) => a - b);
const realP95 = real.length ? real[Math.ceil(real.length * 0.95) - 1] : 0;
console.log(`真实基线页面：${real.length} 页，p50 ${real.length ? real[Math.floor(real.length / 2)].toFixed(1) : "-"} ms，p95 ${realP95.toFixed(1)} ms，最慢 ${real.length ? real[real.length - 1].toFixed(1) : "-"} ms（门槛 p95 ≤ 2000 ms）`);

// A-18：超大页面 A（约 400 KB，4000 段正文、1500 条只设置 color 的规则）：必须在单页耗时上限内结束，不能无限卡住
mkdirSync(tmp, { recursive: true });
const rules = Array.from({ length: 1500 }, (_, i) => `.c${i} p:nth-child(${i % 7 + 1}) { color: #${(i * 4099).toString(16).padStart(6, "0").slice(0, 6)}; }`).join("\n");
const paras = Array.from({ length: 4000 }, (_, i) => `<div class="c${i % 1500}"><p>第 ${i} 段：这一段正文用来做性能压测，长度足够折行，用来模拟真实的长文页面内容，测试校验器的耗时上限。</p></div>`).join("\n");
const big = `<!doctype html><html lang="zh-CN"><head><style>body{font-family:"PingFang SC",sans-serif} p{line-height:1.75}\n${rules}</style></head><body><main style="max-width:36em">${paras}</main></body></html>`;
writeFileSync(join(tmp, "big.html"), big);
const tb = performance.now();
const rb = runLint({ inputs: ["big.html"], root: tmp, cwd: tmp });
const bigMs = performance.now() - tb;
const timedOut = rb.run.skipped_inputs.some((x) => x.reason === "timeout");
rmSync(tmp, { recursive: true, force: true });
console.log(`超大页面 A：${(big.length / 1024).toFixed(0)} KB，用时 ${bigMs.toFixed(0)} ms，${timedOut ? "触发了耗时上限（记为 timeout）" : "在耗时上限内完成"}（门槛：≤ 2 个视口 × 20 s）`);

// A-41：超大页面 B，仿照独立审计的压测方式：规则设置 line-height 和 letter-spacing（会参与规则计算），约 450 KB
mkdirSync(tmp, { recursive: true });
const rules2 = Array.from({ length: 1500 }, (_, i) => `.r${i} p { line-height: ${(1.6 + (i % 4) / 10).toFixed(1)}; letter-spacing: ${(i % 3) / 100}em; }`).join("\n");
const paras2 = Array.from({ length: 4000 }, (_, i) => `<section class="r${i % 1500}"><p>第 ${i} 段：这一段正文用来压测层叠计算，规则会设置行高和字距，长度足够折行，用来模拟真实长文页面的内容。</p></section>`).join("\n");
const big2 = `<!doctype html><html lang="zh-CN"><head><style>body{font-family:"PingFang SC",sans-serif}\n${rules2}</style></head><body><main style="max-width:36em">${paras2}</main></body></html>`;
writeFileSync(join(tmp, "big2.html"), big2);
const tb2 = performance.now();
const rb2 = runLint({ inputs: ["big2.html"], root: tmp, cwd: tmp });
const big2Ms = performance.now() - tb2;
const timedOut2 = rb2.run.skipped_inputs.some((x) => x.reason === "timeout");
rmSync(tmp, { recursive: true, force: true });
console.log(`超大页面 B：${(big2.length / 1024).toFixed(0)} KB，1500 条 line-height / letter-spacing 规则，用时 ${big2Ms.toFixed(0)} ms，${timedOut2 ? "触发了耗时上限（status 为 incomplete）" : "在耗时上限内完成"}。注意：这类页面可能超过「单页 2 秒」，2 秒门槛只适用于 golden 和真实页面`);

const ok = p95 <= 2000 && total <= 20000 && r.summary.files >= 100 && realP95 <= 2000 && bigMs <= 2 * 20000 + 5000 && big2Ms <= 2 * 20000 + 5000;
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
