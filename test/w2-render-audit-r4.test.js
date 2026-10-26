// AUDIT_RENDER_r4（RD-01 至 RD-04）的回归测试：在整改之前写好并锁定。夹具在 test/fixtures/w2-render-audit-r4/。
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runRender, runLint } from "../packages/cli/dist/index.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(repo, "test", "fixtures", "w2-render-audit-r4");
const EXPECT = JSON.parse(readFileSync(join(fixtures, "expect.json"), "utf8"));
const EL_TEXT = Symbol.for("measure-cjk.elText");

function workspace(dirs) {
  const base = mkdtempSync(join(tmpdir(), "measure-audit-r4-"));
  const ws = join(base, "ws");
  mkdirSync(ws);
  for (const [from, names] of dirs) for (const n of names) cpSync(join(from, n), join(ws, n));
  return { ws, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

for (const name of Object.keys(EXPECT)) {
  test(`第 4 轮复核夹具 ${name}：整页 ${EXPECT[name].status}，报出 ${EXPECT[name].errors.join("、")} error`, async () => {
    const w = workspace([[fixtures, [`${name}.html`]]]);
    try {
      const r = await runRender({ inputs: [`${name}.html`], root: w.ws, cwd: w.ws, evidenceDir: join(w.ws, "evidence") });
      const show = JSON.stringify(r.findings.map((f) => [f.rule, f.severity, f.selector, f.message.slice(0, 40)]));
      assert.equal(r.summary.status, EXPECT[name].status, show);
      for (const rule of EXPECT[name].errors) assert.ok(r.findings.some((f) => f.rule === rule && f.severity === "error"), `缺少 ${rule} error；实际：${show}`);
    } finally {
      w.cleanup();
    }
  });
}

test("RD-01：基础档判 fail 的页面，完整档不能判 pass（第 4 轮的 6 个夹具）", async () => {
  const w = workspace([[fixtures, Object.keys(EXPECT).map((n) => `${n}.html`)]]);
  try {
    const r = await runRender({ inputs: ["."], root: w.ws, cwd: w.ws, widths: [390, 1280], evidenceDir: join(w.ws, "evidence") });
    for (const name of Object.keys(EXPECT)) {
      const errs = (res) => res.findings.filter((f) => f.file === `${name}.html` && f.severity === "error").length;
      const s = runLint({ inputs: [`${name}.html`], root: w.ws, cwd: w.ws });
      if (errs(s) > 0) assert.ok(errs(r) > 0, `${name}：基础档有 ${errs(s)} 条 error，完整档 0 条`);
    }
  } finally {
    w.cleanup();
  }
});

// RD-03：通用的「不重复」断言靠结论上的文字指纹判断同一元素，所以带选择器的结论必须都有文字指纹
test("RD-03：全部完整档夹具里，带选择器的 error 都带文字指纹", async () => {
  const dirs = ["w2-render", "w2-render-audit", "w2-render-audit-r2", "w2-render-audit-r3", "w2-render-audit-r4"].map((d) => join(repo, "test", "fixtures", d));
  const w = workspace(dirs.map((d) => [d, readdirSync(d).filter((f) => f.endsWith(".html") && !/timeout|fouc|redirect|nav-|frame/.test(f))]));
  try {
    const r = await runRender({ inputs: ["."], root: w.ws, cwd: w.ws, widths: [390, 1280], evidenceDir: join(w.ws, "evidence") });
    const missing = r.findings.filter((f) => f.severity === "error" && f.selector !== undefined && !f.selector.startsWith("@font-face") && typeof f[EL_TEXT] !== "string");
    assert.equal(missing.length, 0, JSON.stringify(missing.map((f) => [f.file, f.rule, f.selector])));
  } finally {
    w.cleanup();
  }
});
