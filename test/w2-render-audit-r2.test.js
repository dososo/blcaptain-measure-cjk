// AUDIT_RENDER_r2（RB-01 至 RB-09）的回归测试：在整改之前写好并锁定。夹具在 test/fixtures/w2-render-audit-r2/。
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runRender } from "../packages/cli/dist/index.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(repo, "test", "fixtures", "w2-render-audit-r2");
const EXPECT = JSON.parse(readFileSync(join(fixtures, "expect.json"), "utf8"));

function workspace(names) {
  const base = mkdtempSync(join(tmpdir(), "measure-audit-r2-"));
  const ws = join(base, "ws");
  mkdirSync(ws);
  for (const n of names) cpSync(join(fixtures, `${n}.html`), join(ws, `${n}.html`));
  return { ws, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

function check(r, name) {
  const e = EXPECT[name];
  const mine = r.findings.filter((f) => f.file === `${name}.html`);
  const show = JSON.stringify(mine.map((f) => [f.rule, f.severity, f.selector, f.message.slice(0, 50)]));
  for (const rule of e.errors) assert.ok(mine.some((f) => f.rule === rule && f.severity === "error"), `${name}：缺少 ${rule} error；实际：${show}`);
  for (const rule of e.warns) assert.ok(mine.some((f) => f.rule === rule && f.severity === "warn"), `${name}：缺少 ${rule} warn；实际：${show}`);
  for (const rule of e.absent) assert.ok(!mine.some((f) => f.rule === rule), `${name}：不应出现 ${rule}；实际：${show}`);
  for (const rule of e.absent_errors ?? []) assert.ok(!mine.some((f) => f.rule === rule && f.severity === "error"), `${name}：不应出现 ${rule} error；实际：${show}`);
  for (const [rule, n] of Object.entries(e.max_errors ?? {})) assert.ok(mine.filter((f) => f.rule === rule && f.severity === "error").length <= n, `${name}：${rule} error 超过 ${n} 条；实际：${show}`);
  for (const [rule, text] of Object.entries(e.no_message ?? {})) assert.ok(!mine.some((f) => f.rule === rule && f.message.includes(text)), `${name}：${rule} 的消息不应包含「${text}」；实际：${show}`);
  for (const [rule, text] of Object.entries(e.line_exact ?? {})) {
    const want = readFileSync(join(fixtures, `${name}.html`), "utf8").split("\n").findIndex((l) => l.includes(text)) + 1;
    const hits = mine.filter((f) => f.rule === rule);
    assert.ok(hits.length > 0 && hits.every((f) => f.line === want), `${name}：${rule} 的行号必须是 ${want}；实际：${JSON.stringify(hits.map((f) => f.line))}`);
  }
  if (e.t04_both) {
    const t04 = mine.filter((f) => f.rule === "T04" && f.severity === "error");
    assert.ok(t04.some((f) => /实测/.test(f.message)) && t04.some((f) => /不是 strict/.test(f.message)), `${name}：T04 应同时有「实测」和「不是 strict」两条；实际：${show}`);
  }
}

const SINGLE = Object.keys(EXPECT).filter((n) => EXPECT[n].status);
const HELPERS = new Set(Object.values(EXPECT).flatMap((e) => e.inputs ?? []));
const TOGETHER = Object.keys(EXPECT).filter((n) => !EXPECT[n].status && !HELPERS.has(n));

test("第 2 轮复核夹具（不要求整页状态的）：按 expect.json 命中或不命中", async () => {
  const w = workspace(TOGETHER);
  try {
    const r = await runRender({ inputs: ["."], root: w.ws, cwd: w.ws, evidenceDir: join(w.ws, "evidence") });
    for (const n of TOGETHER) check(r, n);
  } finally {
    w.cleanup();
  }
});

for (const name of SINGLE) {
  test(`第 2 轮复核夹具 ${name}：整页状态为 ${EXPECT[name].status}`, async () => {
    const w = workspace([name, ...(EXPECT[name].inputs ?? [])]);
    try {
      const r = await runRender({ inputs: [`${name}.html`], root: w.ws, cwd: w.ws, evidenceDir: join(w.ws, "evidence") });
      assert.equal(r.summary.status, EXPECT[name].status, JSON.stringify({ skipped: r.run.skipped_inputs, problems: r.run.render.problems, findings: r.findings.map((f) => [f.rule, f.severity]) }));
      check(r, name);
    } finally {
      w.cleanup();
    }
  });
}

test("RB-01：占位页面和直接写进源码的页面，基础档规则的结论一致（T03、T13）", async () => {
  const w = workspace(["B-RB01-spa-placeholder", "B-RB01-dom-equivalent"]);
  try {
    const r = await runRender({ inputs: ["."], root: w.ws, cwd: w.ws, widths: [1280], evidenceDir: join(w.ws, "evidence") });
    const rules = (n) => [...new Set(r.findings.filter((f) => f.file === `${n}.html` && f.severity === "error" && ["T01", "T03", "T09", "T13"].includes(f.rule)).map((f) => f.rule))].sort();
    assert.deepEqual(rules("B-RB01-spa-placeholder"), rules("B-RB01-dom-equivalent"));
  } finally {
    w.cleanup();
  }
});
