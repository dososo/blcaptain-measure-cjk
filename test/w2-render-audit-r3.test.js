// AUDIT_RENDER_r3（RC-01 至 RC-05）的回归测试：在整改之前写好并锁定。夹具在 test/fixtures/w2-render-audit-r3/。
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runRender } from "../packages/cli/dist/index.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(repo, "test", "fixtures", "w2-render-audit-r3");
const EXPECT = JSON.parse(readFileSync(join(fixtures, "expect.json"), "utf8"));

function workspace(dirs) {
  const base = mkdtempSync(join(tmpdir(), "measure-audit-r3-"));
  const ws = join(base, "ws");
  mkdirSync(ws);
  for (const [from, names] of dirs) for (const n of names) cpSync(join(from, n), join(ws, n));
  return { ws, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

function check(r, name) {
  const e = EXPECT[name];
  const mine = r.findings.filter((f) => f.file === `${name}.html`);
  const show = JSON.stringify(mine.map((f) => [f.rule, f.severity, f.selector, f.message.slice(0, 50)]));
  for (const rule of e.errors) assert.ok(mine.some((f) => f.rule === rule && f.severity === "error"), `${name}：缺少 ${rule} error；实际：${show}`);
  for (const rule of e.absent) assert.ok(!mine.some((f) => f.rule === rule), `${name}：不应出现 ${rule}；实际：${show}`);
  for (const rule of e.absent_errors ?? []) assert.ok(!mine.some((f) => f.rule === rule && f.severity === "error"), `${name}：不应出现 ${rule} error；实际：${show}`);
  for (const [rule, n] of Object.entries(e.max_errors ?? {})) assert.ok(mine.filter((f) => f.rule === rule && f.severity === "error").length <= n, `${name}：${rule} error 超过 ${n} 条；实际：${show}`);
  for (const [rule, n] of Object.entries(e.min_errors ?? {})) assert.ok(mine.filter((f) => f.rule === rule && f.severity === "error").length >= n, `${name}：${rule} error 少于 ${n} 条；实际：${show}`);
  for (const [rule, text] of Object.entries(e.message_has ?? {})) assert.ok(mine.some((f) => f.rule === rule && f.message.includes(text)), `${name}：${rule} 应有一条消息包含「${text}」；实际：${show}`);
  if (e.no_selector) assert.ok(!mine.some((f) => (f.selector ?? "").includes(e.no_selector)), `${name}：结果里不应有选择器包含「${e.no_selector}」的条目；实际：${show}`);
}

for (const name of Object.keys(EXPECT)) {
  test(`第 3 轮复核夹具 ${name}`, async () => {
    const w = workspace([[fixtures, [`${name}.html`]]]);
    try {
      const r = await runRender({ inputs: [`${name}.html`], root: w.ws, cwd: w.ws, evidenceDir: join(w.ws, "evidence") });
      if (EXPECT[name].status) assert.equal(r.summary.status, EXPECT[name].status, JSON.stringify({ skipped: r.run.skipped_inputs, problems: r.run.render.problems, findings: r.findings.map((f) => [f.rule, f.severity, f.selector]) }));
      check(r, name);
    } finally {
      w.cleanup();
    }
  });
}

// RC-05：通用断言——同一页面、同一规则、同一个元素，最多一条 error。
// 元素的身份是「选择器 + 文字指纹」（结论上的 Symbol.for("measure-cjk.elText")，和实现用的是同一个口径；
// 超过 4 层的同名元素选择器会相同，只按选择器会把两个不同的元素当成一个，见 RULING-07）
// （T04 的「不是 strict」和「实测标点落在行首」是两件事，各算一条；「另有 N 处」汇总没有选择器，不计）
const EL_TEXT = Symbol.for("measure-cjk.elText");
function assertNoDuplicates(r, label) {
  const seen = new Map();
  for (const f of r.findings) {
    if (f.severity !== "error" || f.selector === undefined) continue;
    const kind = f.rule === "T04" && /^实测/.test(f.message) ? "m" : "";
    const k = `${f.file}|${f.rule}|${kind}|${f.selector}|${f[EL_TEXT] ?? ""}`;
    assert.ok(!seen.has(k), `${label}：重复的 error：${k}\n  ${seen.get(k)}\n  ${f.message}`);
    seen.set(k, f.message);
  }
}

test("RC-05：全部完整档夹具（含三轮审计夹具）里，同一规则、同一元素最多一条 error", async () => {
  const dirs = ["w2-render", "w2-render-audit", "w2-render-audit-r2", "w2-render-audit-r3"].map((d) => join(repo, "test", "fixtures", d));
  const w = workspace(dirs.map((d) => [d, readdirSync(d).filter((f) => f.endsWith(".html") && !/timeout|fouc|redirect|nav-|frame/.test(f))]));
  try {
    const r = await runRender({ inputs: ["."], root: w.ws, cwd: w.ws, evidenceDir: join(w.ws, "evidence") });
    assertNoDuplicates(r, "完整档夹具");
  } finally {
    w.cleanup();
  }
});

test("RC-05：golden 20 页和对照组 v2 的 60 页，同一规则、同一元素最多一条 error", async () => {
  const ev = mkdtempSync(join(repo, "test", "tmp-r3-dup-"));
  try {
    const r = await runRender({ inputs: ["bench/golden", "bench/runs/2026-W2-baseline-isolated-v2-codex", "bench/runs/2026-W2-baseline-isolated-v2-claude-code"], root: repo, cwd: repo, evidenceDir: ev });
    assertNoDuplicates(r, "golden 与对照组");
  } finally {
    rmSync(ev, { recursive: true, force: true });
  }
});
