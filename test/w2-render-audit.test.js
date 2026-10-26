// AUDIT_RENDER（RA-01 至 RA-21）的回归测试：在整改之前写好并锁定。夹具在 test/fixtures/w2-render-audit/。
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as measure from "../packages/cli/dist/index.js";

// 用模块对象取导出：整改前 sanitizeProbeItems 还不存在，只让那一条测试失败，不影响其他测试运行
const { runRender, runLint, formatLintText } = measure;

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(repo, "test", "fixtures", "w2-render-audit");
const EXPECT = JSON.parse(readFileSync(join(fixtures, "expect.json"), "utf8"));
const EVIDENCE_NAME = /^[TFA]\d{2}-\d{3}\.png$/;

function workspace(names) {
  const base = mkdtempSync(join(tmpdir(), "measure-audit-"));
  const ws = join(base, "ws");
  mkdirSync(ws);
  for (const n of names) cpSync(join(fixtures, `${n}.html`), join(ws, `${n}.html`));
  return { base, ws, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

function check(r, name) {
  const e = EXPECT[name];
  const mine = r.findings.filter((f) => f.file === `${name}.html`);
  const show = JSON.stringify(mine.map((f) => [f.rule, f.severity, f.message.slice(0, 40)]));
  for (const rule of e.errors) assert.ok(mine.some((f) => f.rule === rule && f.severity === "error"), `${name}：缺少 ${rule} error；实际：${show}`);
  for (const rule of e.warns) assert.ok(mine.some((f) => f.rule === rule && f.severity === "warn"), `${name}：缺少 ${rule} warn；实际：${show}`);
  for (const rule of e.absent) assert.ok(!mine.some((f) => f.rule === rule), `${name}：不应出现 ${rule}；实际：${show}`);
  for (const rule of e.absent_errors ?? []) assert.ok(!mine.some((f) => f.rule === rule && f.severity === "error"), `${name}：不应出现 ${rule} error；实际：${show}`);
  for (const [rule, n] of Object.entries(e.min_errors ?? {})) assert.ok(mine.filter((f) => f.rule === rule && f.severity === "error").length >= n, `${name}：${rule} error 少于 ${n} 条；实际：${show}`);
  for (const [rule, n] of Object.entries(e.overflow ?? {})) assert.ok(mine.some((f) => f.rule === rule && f.message.includes(`另有 ${n} 处`)), `${name}：${rule} 的省略条数应为 ${n}；实际：${show}`);
  for (const [rule, text] of Object.entries(e.message_of ?? {})) assert.ok(mine.some((f) => f.rule === rule && f.message.includes(text)), `${name}：${rule} 的消息应包含「${text}」；实际：${show}`);
  for (const [rule, text] of Object.entries(e.line_of ?? {})) {
    const src = readFileSync(join(fixtures, `${name}.html`), "utf8").split("\n");
    const want = src.findIndex((l) => l.includes(text)) + 1;
    for (const f of mine.filter((x) => x.rule === rule)) assert.ok(f.line === undefined || f.line === want, `${name}：${rule} 的行号应为 ${want} 或不给，实际 ${f.line}`);
  }
}

const SINGLE = Object.keys(EXPECT).filter((n) => EXPECT[n].status);
const TOGETHER = Object.keys(EXPECT).filter((n) => !EXPECT[n].status && n !== "A-RA05-redirect-target");

test("审计夹具（不要求整页状态的）：按 expect.json 命中或不命中", async () => {
  const w = workspace(TOGETHER);
  try {
    const r = await runRender({ inputs: ["."], root: w.ws, cwd: w.ws, evidenceDir: join(w.ws, "evidence") });
    for (const n of TOGETHER) check(r, n);
  } finally {
    w.cleanup();
  }
});

for (const name of SINGLE) {
  test(`审计夹具 ${name}：整页状态为 ${EXPECT[name].status}`, async () => {
    const w = workspace(name === "A-RA05-redirect" ? [name, "A-RA05-redirect-target"] : [name]);
    try {
      const r = await runRender({ inputs: [`${name}.html`], root: w.ws, cwd: w.ws, evidenceDir: join(w.ws, "evidence") });
      assert.equal(r.summary.status, EXPECT[name].status, JSON.stringify({ skipped: r.run.skipped_inputs, findings: r.findings.map((f) => [f.rule, f.severity]) }));
      check(r, name);
      // RA-01：工作区的上一级目录里不能出现任何新文件；截图文件名只能是「规则-序号.png」
      assert.deepEqual(readdirSync(w.base), ["ws"]);
      if (existsSync(join(w.ws, "evidence"))) for (const f of readdirSync(join(w.ws, "evidence"))) assert.match(f, EVIDENCE_NAME);
      for (const f of r.findings.filter((x) => x.evidence)) assert.match(f.evidence, /^evidence\/[TFA]\d{2}-\d{3}\.png$/);
    } finally {
      w.cleanup();
    }
  });
}

test("RA-01：Node 一侧校验测量结果，规则 ID 不在白名单、级别非法、序号非法的条目都丢掉，文字限长", () => {
  assert.equal(typeof measure.sanitizeProbeItems, "function", "缺少 sanitizeProbeItems");
  const { items, rejected } = measure.sanitizeProbeItems([
    { rule: "T07", severity: "error", idx: 0, selector: "main > p", message: "ok" },
    { rule: "../../PWNED", severity: "error", idx: 0, selector: "p", message: "x" },
    { rule: "T07", severity: "fatal", idx: 0, selector: "p", message: "x" },
    { rule: "T07", severity: "error", idx: -2, selector: "p", message: "x" },
    { rule: "T07", severity: "error", idx: 1.5, selector: "p", message: "x" },
    { rule: "T11", severity: "warn", idx: 3, selector: "p".repeat(5000), message: "长".repeat(5000) },
    "not-an-object"
  ]);
  assert.equal(items.length, 2);
  assert.equal(rejected, 5);
  assert.ok(items[1].selector.length <= 300 && items[1].message.length <= 600);
  assert.equal(measure.sanitizeProbeItems({ not: "array" }).items.length, 0);
});

test("RA-06：URL 页面返回 404、500 → 记为打不开，incomplete，退出码 2", async () => {
  const server = http.createServer((req, res) => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    if (req.url === "/404") {
      res.statusCode = 404;
      return res.end("Not Found");
    }
    res.statusCode = 500;
    res.end(`<!doctype html><html lang="zh-CN"><body><p>服务器内部错误，请稍后再试。</p></body></html>`);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const w = workspace([]);
  try {
    for (const path of ["/404", "/500"]) {
      const r = await runRender({ inputs: [`http://127.0.0.1:${server.address().port}${path}`], root: w.ws, cwd: w.ws, widths: [1280], evidenceDir: join(w.ws, "evidence") });
      assert.equal(r.summary.status, "incomplete", `${path}：${JSON.stringify(r.run)}`);
    }
  } finally {
    w.cleanup();
    server.close();
  }
});

test("RA-09：页面和它引用的 CSS 一起检查时，F03 error 带截图；只检查 CSS 时注明没有可截图的页面", async () => {
  const w = workspace([]);
  try {
    writeFileSync(join(w.ws, "font.css"), `@font-face { font-family: "方正兰亭黑"; src: url("fz.woff2"); }\n`);
    writeFileSync(join(w.ws, "page.html"), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="font.css"><style>:where(:lang(zh)){line-break:strict;text-autospace:normal} body{font-family:"方正兰亭黑",sans-serif} p{line-height:1.75}</style></head><body><p>中文段落。</p></body></html>`);
    const both = await runRender({ inputs: ["."], root: w.ws, cwd: w.ws, widths: [1280], evidenceDir: join(w.ws, "evidence") });
    const f03 = both.findings.filter((f) => f.rule === "F03" && f.severity === "error");
    assert.ok(f03.length > 0);
    for (const f of f03) assert.ok(f.evidence && existsSync(join(w.ws, f.evidence)), JSON.stringify(f));
    const cssOnly = await runRender({ inputs: ["font.css"], root: w.ws, cwd: w.ws, widths: [1280], evidenceDir: join(w.ws, "evidence") });
    const g = cssOnly.findings.find((f) => f.rule === "F03" && f.severity === "error");
    assert.ok(g && !g.evidence && /没有可截图的页面/.test(g.message), JSON.stringify(g));
  } finally {
    w.cleanup();
  }
});

test("RA-18：文本格式输出不带终端控制字符", () => {
  const w = workspace([]);
  try {
    writeFileSync(join(w.ws, "esc.html"), `<!doctype html><html lang="zh-CN"><body><p>中文,中\u001b[31m红色\u001b[0m的字。</p></body></html>`);
    const r = runLint({ inputs: ["esc.html"], root: w.ws, cwd: w.ws });
    assert.ok(r.findings.some((f) => f.rule === "T03"), "前提：T03 引用了页面原文");
    assert.doesNotMatch(formatLintText(r), /\u001b/);
  } finally {
    w.cleanup();
  }
});

test("RA-19：检查本地文件时，iframe、object、表单、meta refresh、window.open 都不能和 localhost 建立 TCP 连接", async () => {
  let conns = 0;
  const server = net.createServer((s) => {
    conns++;
    s.destroy();
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const u = `http://127.0.0.1:${server.address().port}`;
  const w = workspace([]);
  try {
    writeFileSync(join(w.ws, "tcp.html"), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${u}/m"></head><body><p>中文段落。</p><iframe src="${u}/i"></iframe><object data="${u}/o"></object><form id="f" action="${u}/f" method="post"></form><script>document.getElementById("f").submit(); window.open("${u}/w");</script></body></html>`);
    await runRender({ inputs: ["tcp.html"], root: w.ws, cwd: w.ws, widths: [1280], evidenceDir: join(w.ws, "evidence") });
    assert.equal(conns, 0);
  } finally {
    w.cleanup();
    server.close();
  }
});

test("RA-20：截图框住的是对应的元素（宽度与元素大致一致）", async () => {
  const base = mkdtempSync(join(tmpdir(), "measure-audit-shot-"));
  try {
    cpSync(join(repo, "test", "fixtures", "w2-render", "R-T04-neg-anywhere.html"), join(base, "p.html"));
    const r = await runRender({ inputs: ["p.html"], root: base, cwd: base, widths: [1280], evidenceDir: join(base, "evidence") });
    const f = r.findings.find((x) => x.rule === "T04" && /行首/.test(x.message));
    assert.ok(f && f.evidence);
    const png = readFileSync(join(base, f.evidence));
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    // 元素是 10em × 4 行（16px 字号、1.75 行高）：约 160 × 112，加上四周各 12px 的边距
    assert.ok(width >= 150 && width <= 260, `截图宽 ${width}`);
    assert.ok(height >= 100 && height <= 200, `截图高 ${height}`);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
