// W1 补充第二组：代码块里的中文（基线误报分析后新增，夹具在 test/fixtures/w1-extra2/）
import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runLint } from "../../packages/cli/dist/index.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "w1-extra2");
const lint = (name) => runLint({ inputs: [`${name}.html`], root: dir, cwd: dir });
const errs = (r, rule) => r.findings.filter((f) => f.rule === rule && f.severity === "error");

test("代码块用等宽字体栈：T13 只报 warn，不判失败（A-31：由「跳过」改为「降为 warn」）", () => {
  const t13 = lint("T13-pos-code-mono-stack").findings.filter((f) => f.rule === "T13");
  assert.ok(t13.length > 0, "代码块里的中文应至少报一条 T13 warn");
  assert.ok(t13.every((f) => f.severity === "warn"));
});

test("代码块里的斜体中文注释：T08 只报 warn，不判失败", () => {
  const r = lint("T08-warn-code-italic-comment");
  const t08 = r.findings.filter((f) => f.rule === "T08");
  assert.ok(t08.length >= 1);
  assert.ok(t08.every((f) => f.severity === "warn"));
  assert.equal(r.summary.errors, 0);
});

test("正文用纯等宽字体栈：仍然报 T13", () => {
  assert.ok(errs(lint("T13-neg-body-mono-stack"), "T13").length >= 1);
});

test("代码块旁边的正文斜体：仍然报 T08 error", () => {
  assert.ok(errs(lint("T08-neg-body-italic-near-code"), "T08").length >= 1);
});
