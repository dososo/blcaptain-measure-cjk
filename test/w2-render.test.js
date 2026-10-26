// W2 完整档（--render）：在实现之前写好并锁定。夹具在 test/fixtures/w2-render/，期望写在 expect.json。
// 依赖本机能启动的 Chromium 内核浏览器（playwright 自带的浏览器，或系统 Chrome）。
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runRender, runLint } from "../packages/cli/dist/index.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(repo, "test", "fixtures", "w2-render");
const EXPECT = JSON.parse(readFileSync(join(fixtures, "expect.json"), "utf8"));
const ALL_WIDTHS = [360, 390, 768, 1024, 1280, 1440];
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// 把夹具复制到临时工作区：<tmp>/ws 是工作区，<tmp>/outside.css 在工作区外（R-net-block 用）
function workspace(names) {
  const base = mkdtempSync(join(tmpdir(), "measure-render-"));
  const ws = join(base, "ws");
  mkdirSync(ws);
  for (const n of names) cpSync(join(fixtures, `${n}.html`), join(ws, `${n}.html`));
  writeFileSync(join(base, "outside.css"), "p { letter-spacing: -0.1em; }\n");
  return { base, ws, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

// 命令行用子进程跑：在异步测试里替换 process.stdout.write 会吞掉 node:test 子进程的上报（测试会从报告里消失）
const BIN = join(repo, "packages", "cli", "bin", "measure-cjk.js");
function cli(args, cwd, env = {}) {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [BIN, ...args], { cwd, env: { ...process.env, ...env } });
    const out = [];
    const err = [];
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => err.push(d));
    p.on("close", (code) => ok({ code, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8") }));
  });
}

function assertEvidence(r, root) {
  for (const f of r.findings.filter((x) => x.severity === "error")) {
    assert.ok(f.evidence, `${f.rule} ${f.file} 的 error 没有截图`);
    const p = join(root, f.evidence);
    assert.ok(existsSync(p), `截图不存在：${f.evidence}`);
    assert.deepEqual(readFileSync(p).subarray(0, 8), PNG, `截图不是 PNG：${f.evidence}`);
  }
}

function checkExpect(r, name) {
  const e = EXPECT[name];
  const mine = r.findings.filter((f) => f.file === `${name}.html`);
  for (const rule of e.errors) assert.ok(mine.some((f) => f.rule === rule && f.severity === "error"), `${name}：缺少 ${rule} error；实际：${JSON.stringify(mine.map((f) => [f.rule, f.severity]))}`);
  for (const rule of e.warns) assert.ok(mine.some((f) => f.rule === rule && f.severity === "warn"), `${name}：缺少 ${rule} warn；实际：${JSON.stringify(mine.map((f) => [f.rule, f.severity]))}`);
  for (const rule of e.absent) assert.ok(!mine.some((f) => f.rule === rule), `${name}：不应出现 ${rule}；实际：${JSON.stringify(mine.filter((f) => f.rule === rule))}`);
  for (const rule of e.absent_errors ?? []) assert.ok(!mine.some((f) => f.rule === rule && f.severity === "error"), `${name}：不应出现 ${rule} error`);
}

const STANDARD = Object.keys(EXPECT).filter((n) => !EXPECT[n].widths && n !== "R-timeout-infinite-loop" && n !== "R-net-block");

test("完整档：各规则夹具按 expect.json 命中或不命中；6 种宽度；每条 error 都有 PNG 截图", async () => {
  const w = workspace(STANDARD);
  try {
    const r = await runRender({ inputs: ["."], root: w.ws, cwd: w.ws, evidenceDir: join(w.ws, "evidence") });
    assert.equal(r.run.mode, "render");
    assert.deepEqual(r.run.render.widths, ALL_WIDTHS);
    assert.equal(typeof r.run.render.browser, "string");
    for (const n of STANDARD) checkExpect(r, n);
    assertEvidence(r, w.ws);
    // 完整档实测的规则要带上渲染宽度
    for (const f of r.findings.filter((x) => ["T05", "T06", "T07", "T11", "T12", "A01", "A11"].includes(x.rule))) {
      assert.ok(ALL_WIDTHS.includes(f.viewport), `${f.rule} ${f.file} 缺少 viewport`);
    }
    // T05 的 error 只能出现在容器足够宽的视口（≥ 768）
    const t05 = r.findings.find((f) => f.file === "R-T05-neg-wide.html" && f.rule === "T05" && f.severity === "error");
    assert.ok(t05.viewport >= 768);
    // T04 要能区分「实测标点落在行首」
    assert.ok(r.findings.some((f) => f.file === "R-T04-neg-anywhere.html" && f.rule === "T04" && /行首/.test(f.message) && /实测/.test(f.message)));
  } finally {
    w.cleanup();
  }
});

test("完整档：基础档按字数估算的 T06 error，实测只有一行时降为 warn（--widths 1024,1280）", async () => {
  const w = workspace(["R-T06-single-line-warn"]);
  try {
    const stat = runLint({ inputs: ["R-T06-single-line-warn.html"], root: w.ws, cwd: w.ws });
    assert.ok(stat.findings.some((f) => f.rule === "T06" && f.severity === "error"), "前提：基础档报 error");
    const r = await runRender({ inputs: ["R-T06-single-line-warn.html"], root: w.ws, cwd: w.ws, widths: [1024, 1280], evidenceDir: join(w.ws, "evidence") });
    assert.deepEqual(r.run.render.widths, [1024, 1280]);
    checkExpect(r, "R-T06-single-line-warn");
  } finally {
    w.cleanup();
  }
});

test("完整档网络拦截：远程资源、工作区外的 file:// 和相对路径都不加载，并记录下来", async () => {
  const w = workspace(["R-net-block"]);
  try {
    const r = await runRender({ inputs: ["R-net-block.html"], root: w.ws, cwd: w.ws, evidenceDir: join(w.ws, "evidence") });
    checkExpect(r, "R-net-block"); // outside.css 是负字距：一旦被加载就会报 T07
    assert.equal(r.run.network, "offline");
    for (const u of ["https://example.com/remote.css", "https://example.com/remote.js", "https://example.com/a.png", "https://example.com/beacon"]) {
      assert.ok(r.run.remote_refs.includes(u), `remote_refs 缺少 ${u}：${JSON.stringify(r.run.remote_refs)}`);
    }
    assert.ok(r.run.skipped_inputs.filter((s) => s.reason === "outside-root").length >= 2, JSON.stringify(r.run.skipped_inputs));
  } finally {
    w.cleanup();
  }
});

test("完整档网络拦截：本地文件页面不能访问 localhost 上的服务（命中数为 0）", async () => {
  let hits = 0;
  const server = http.createServer((req, res) => {
    hits++;
    res.end("x");
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const port = server.address().port;
  const w = workspace([]);
  try {
    const u = `http://127.0.0.1:${port}`;
    writeFileSync(join(w.ws, "beacon.html"), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="${u}/a.css"></head><body><p>中文段落。</p><img src="${u}/b.png"><script>fetch("${u}/c").catch(() => {});</script></body></html>`);
    await runRender({ inputs: ["beacon.html"], root: w.ws, cwd: w.ws, widths: [1280], evidenceDir: join(w.ws, "evidence") });
    assert.equal(hits, 0);
  } finally {
    w.cleanup();
    server.close();
  }
});

test("完整档单页超时：页面脚本死循环 → status incomplete，退出码 2（MEASURE_RENDER_BUDGET_MS 只能调低）", async () => {
  const w = workspace(["R-timeout-infinite-loop"]);
  const old = process.env.MEASURE_RENDER_BUDGET_MS;
  process.env.MEASURE_RENDER_BUDGET_MS = "3000";
  try {
    const t0 = Date.now();
    const r = await runRender({ inputs: ["R-timeout-infinite-loop.html"], root: w.ws, cwd: w.ws, widths: [1280], evidenceDir: join(w.ws, "evidence") });
    assert.ok(Date.now() - t0 < 30_000);
    assert.equal(r.summary.status, "incomplete");
    assert.ok(r.run.skipped_inputs.some((s) => s.reason === "timeout"));
    process.env.MEASURE_RENDER_BUDGET_MS = "999999";
    const bad = await cli(["lint", "R-timeout-infinite-loop.html", "--render"], w.ws);
    assert.equal(bad.code, 2);
  } finally {
    if (old === undefined) delete process.env.MEASURE_RENDER_BUDGET_MS;
    else process.env.MEASURE_RENDER_BUDGET_MS = old;
    w.cleanup();
  }
});

test("AC-7：lint http://127.0.0.1:<port>/… --render → 6 种宽度跑完，network=localhost，每条 error 都有截图，基础档规则照样检查", async () => {
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, "http://x").pathname.slice(1));
    if (!/^R-[\w-]+\.html$/.test(name) || !existsSync(join(fixtures, name))) {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(readFileSync(join(fixtures, name)));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  const w = workspace([]);
  try {
    const out = join(w.ws, "results.json");
    const res = await cli(["lint", `${base}/R-T05-neg-wide.html`, `${base}/R-T01-neg-static-in-render.html`, "--render", "--format", "json", "--out", out], w.ws);
    assert.equal(res.code, 1, res.stderr);
    const r = JSON.parse(readFileSync(out, "utf8"));
    assert.equal(r.run.network, "localhost");
    assert.deepEqual(r.run.render.widths, ALL_WIDTHS);
    assert.ok(r.findings.some((f) => f.file === `${base}/R-T05-neg-wide.html` && f.rule === "T05" && f.severity === "error"));
    assert.ok(r.findings.some((f) => f.file === `${base}/R-T01-neg-static-in-render.html` && f.rule === "T01" && f.severity === "error"));
    assertEvidence(r, w.ws);
    // 默认的截图目录：--out 所在目录下的 evidence/
    assert.ok(r.findings.filter((f) => f.severity === "error").every((f) => f.evidence.startsWith("evidence/")));
  } finally {
    w.cleanup();
    server.close();
  }
});

test("URL 输入：远程地址没有 --allow-remote 时拒绝；不加 --render 时拒绝（退出码 2，不联网）", async () => {
  const w = workspace([]);
  try {
    const a = await cli(["lint", "https://example.com/", "--render"], w.ws);
    assert.equal(a.code, 2);
    assert.match(a.stderr, /--allow-remote/);
    const b = await cli(["lint", "http://127.0.0.1:9/"], w.ws);
    assert.equal(b.code, 2);
    assert.match(b.stderr, /--render/);
  } finally {
    w.cleanup();
  }
});

test("--widths 校验：只接受 200–3840 的整数；非法值退出码 2", async () => {
  const w = workspace(["R-pos-baseline"]);
  try {
    for (const bad of ["100", "abc", "390,", "5000", ""]) {
      const r = await cli(["lint", "R-pos-baseline.html", "--render", "--widths", bad], w.ws);
      assert.equal(r.code, 2, `--widths ${bad}`);
    }
    const ok = await cli(["lint", "R-pos-baseline.html", "--render", "--widths", "390,1280", "--format", "json"], w.ws);
    assert.equal(ok.code, 0, ok.stderr);
    assert.deepEqual(JSON.parse(ok.stdout).run.render.widths, [390, 1280]);
  } finally {
    w.cleanup();
  }
});

test("截图目录安全：符号链接、工作区外的目录一律拒绝（退出码 2）", async () => {
  const w = workspace(["R-T01-neg-static-in-render"]);
  try {
    mkdirSync(join(w.base, "elsewhere"));
    symlinkSync(join(w.base, "elsewhere"), join(w.ws, "evidence"));
    const a = await cli(["lint", "R-T01-neg-static-in-render.html", "--render", "--widths", "1280"], w.ws);
    assert.equal(a.code, 2, a.stderr);
    assert.equal(readdirSync(join(w.base, "elsewhere")).length, 0);
    const b = await cli(["lint", "R-T01-neg-static-in-render.html", "--render", "--widths", "1280", "--evidence", join(w.base, "elsewhere")], w.ws);
    assert.equal(b.code, 2, b.stderr);
    assert.equal(readdirSync(join(w.base, "elsewhere")).length, 0);
  } finally {
    w.cleanup();
  }
});

test("AC-6：没有安装 Playwright 时 --render 退出码 2，并给出安装提示；不降级成基础档", () => {
  const base = mkdtempSync(join(tmpdir(), "measure-nopw-"));
  try {
    const pkg = join(base, "pkg");
    for (const d of ["bin", "dist", "assets", "data"]) cpSync(join(repo, "packages", "cli", d), join(pkg, d), { recursive: true });
    cpSync(join(repo, "packages", "cli", "package.json"), join(pkg, "package.json"));
    mkdirSync(join(pkg, "node_modules"));
    for (const m of readdirSync(join(repo, "node_modules"))) {
      if (m.startsWith(".") || m === "playwright" || m === "playwright-core" || m === "measure-cjk") continue;
      symlinkSync(join(repo, "node_modules", m), join(pkg, "node_modules", m));
    }
    writeFileSync(join(base, "x.html"), `<!doctype html><html lang="zh-CN"><body><p>中文</p></body></html>`);
    const r = spawnSync(process.execPath, [join(pkg, "bin", "measure-cjk.js"), "lint", "x.html", "--render"], { cwd: base, encoding: "utf8" });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /playwright/i);
    assert.match(r.stderr, /npm (i|install)/);
    // 不加 --render 时这份拷贝照常工作（说明退出码 2 确实来自缺少 Playwright）
    const s = spawnSync(process.execPath, [join(pkg, "bin", "measure-cjk.js"), "lint", "x.html"], { cwd: base, encoding: "utf8" });
    assert.ok(s.status === 0 || s.status === 1, s.stderr);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("AC-2：bench/golden 20 个好页面在完整档下，出现 error 的页面最多 1 个", async () => {
  const ev = mkdtempSync(join(repo, "test", "tmp-golden-evidence-"));
  try {
    const r = await runRender({ inputs: ["bench/golden"], root: repo, cwd: repo, evidenceDir: ev });
    assert.equal(r.summary.cjk_files, 20); // bench/golden 里另有一份 site.css，files 是 21
    assert.notEqual(r.summary.status, "incomplete", JSON.stringify(r.run.skipped_inputs));
    const bad = [...new Set(r.findings.filter((f) => f.severity === "error").map((f) => f.file))];
    assert.ok(bad.length <= 1, `出现 error 的页面：${JSON.stringify(r.findings.filter((f) => f.severity === "error").map((f) => [f.file, f.rule, f.viewport, f.message]), null, 1)}`);
  } finally {
    rmSync(ev, { recursive: true, force: true });
  }
});
