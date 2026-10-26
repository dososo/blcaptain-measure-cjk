// AUDIT_RENDER_r5（RE-01 至 RE-04）的回归测试：在整改之前写好并锁定。夹具在 test/fixtures/w2-render-audit-r5/。
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runRender } from "../packages/cli/dist/index.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(repo, "test", "fixtures", "w2-render-audit-r5");
const EXPECT = JSON.parse(readFileSync(join(fixtures, "expect.json"), "utf8"));

for (const name of Object.keys(EXPECT)) {
  const e = EXPECT[name];
  test(`第 5 轮复核夹具 ${name}：整页 ${e.status}`, async () => {
    const base = mkdtempSync(join(tmpdir(), "measure-audit-r5-"));
    const ws = join(base, "ws");
    mkdirSync(ws);
    cpSync(join(fixtures, `${name}.html`), join(ws, `${name}.html`));
    try {
      const r = await runRender({ inputs: [`${name}.html`], root: ws, cwd: ws, widths: [360, 1280], evidenceDir: join(ws, "evidence") });
      const show = JSON.stringify(r.findings.map((f) => [f.rule, f.severity, f.selector, f.line, f.message.slice(0, 40)]));
      assert.equal(r.summary.status, e.status, show);
      const errs = (rule) => r.findings.filter((f) => f.rule === rule && f.severity === "error").length;
      for (const rule of e.errors) assert.ok(errs(rule) > 0, `缺少 ${rule} error；实际：${show}`);
      for (const [rule, n] of Object.entries(e.max_errors ?? {})) assert.ok(errs(rule) <= n, `${rule} error 超过 ${n} 条；实际：${show}`);
      for (const [rule, n] of Object.entries(e.min_errors ?? {})) assert.ok(errs(rule) >= n, `${rule} error 少于 ${n} 条；实际：${show}`);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
}
