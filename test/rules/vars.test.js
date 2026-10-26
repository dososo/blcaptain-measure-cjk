// W1 补充：CSS 自定义属性（var()）的展开。夹具在 test/fixtures/w1-extra/，单独锁定。
import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runLint } from "../../packages/cli/dist/index.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "w1-extra");
const lint = (name) => runLint({ inputs: [`${name}.html`], root: dir, cwd: dir });
const rulesOf = (r) => r.findings.filter((f) => f.severity === "error").map((f) => f.rule);

for (const name of ["T13-pos-var-stack", "T13-pos-var-fallback", "T13-pos-var-nested"]) {
  test(`var() 展开后字体栈有中文字体，不报 T13，整页零 error：${name}`, () => {
    const r = lint(name);
    assert.deepEqual(rulesOf(r), []);
  });
}

test("var() 展开后字体栈只有西文字体 → 报 T13", () => {
  assert.ok(rulesOf(lint("T13-neg-var-latin-only")).includes("T13"));
});

test("var() 解析不出来 → 按未知处理，不报 T13", () => {
  assert.equal(lint("T13-skip-var-unresolved").findings.filter((f) => f.rule === "T13").length, 0);
});

test("line-height、letter-spacing、font-size 经由 var() 赋值时也能检查", () => {
  assert.ok(rulesOf(lint("T06-neg-var-line-height")).includes("T06"));
  assert.ok(rulesOf(lint("T07-neg-var-letter-spacing")).includes("T07"));
  assert.ok(rulesOf(lint("T11-neg-var-font-size")).includes("T11"));
});
