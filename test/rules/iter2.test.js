// iter2：针对独立审计 AUDIT_iter1 规则类发现的测试。夹具在 test/fixtures/iter2/，先于实现锁定。
import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runLint, matchFontName } from "../../packages/cli/dist/index.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "iter2");
const lint = (name) => runLint({ inputs: [`${name}.html`], root: dir, cwd: dir });
const of = (r, rule, sev) => r.findings.filter((f) => f.rule === rule && (!sev || f.severity === sev));

const POS = ["T06-pos-unlayered-beats-layer-A11", "T06-pos-nesting-scoped-A11", "T06-pos-supports-not-A11", "T13-pos-font-shorthand-var-A11", "F03-pos-local-only-A13", "T11-pos-hidden-and-sr-only-A25"];
for (const name of POS) {
  test(`正例整页零 error：${name}`, () => {
    const r = lint(name);
    assert.equal(r.summary.errors, 0, JSON.stringify(r.findings.filter((f) => f.severity === "error").map((f) => `${f.rule} ${f.message}`)));
  });
}

const NEG = {
  "T06-neg-nesting-inside-A11": "T06",
  "T11-neg-font-shorthand-var-A11": "T11",
  "T03-neg-inline-boundary-A12": "T03",
  "F03-neg-lowercase-fz-filename-A14": "F03",
  "F03-neg-founder-free-gbk-suffix-A14": "F03",
  "T06-neg-unset-long-paragraph-A20": "T06",
  "T01-neg-section-without-lang-A20": "T01",
  "T11-neg-svg-text-attr-A25": "T11",
  "T13-neg-textarea-mono-stack-A31": "T13"
};
for (const [name, rule] of Object.entries(NEG)) {
  test(`反例命中 ${rule}，且严重级别为 error：${name}`, () => {
    assert.ok(of(lint(name), rule, "error").length > 0, JSON.stringify(lint(name).findings.map((f) => `${f.rule}/${f.severity}`)));
  });
}

const WARN = { "F03-warn-remote-cdn-A13": "F03", "T06-warn-unset-short-line-A20": "T06", "T13-warn-code-mono-stack-A31": "T13" };
for (const [name, rule] of Object.entries(WARN)) {
  test(`只报 warn，不判失败：${name}`, () => {
    const r = lint(name);
    assert.ok(of(r, rule, "warn").length > 0, `应有 ${rule} warn`);
    assert.equal(of(r, rule, "error").length, 0, `不应有 ${rule} error`);
  });
}

test("A-14：方正黑体_GBK 命中免费五款（🔵），不被「方正」前缀判成 🔴", () => {
  assert.equal(matchFontName("方正黑体_GBK")?.id, "founder-free");
  const f03 = of(lint("F03-neg-founder-free-gbk-suffix-A14"), "F03", "error");
  assert.match(f03[0].message, /🔵/);
});

test("A-13：远程 CDN 的提示说明「原文未明确」，不说「不允许」", () => {
  const w = of(lint("F03-warn-remote-cdn-A13"), "F03", "warn")[0];
  assert.match(w.message, /未明确/);
  assert.doesNotMatch(w.message, /不允许/);
});

// ---------- 待审计方裁定（夹具已锁定，不修改；只按 CSS 规范调整测试预期，见 docs/verification/RULINGS.md） ----------

test("RULING-02：T01-pos-section-lang-A20 —— 不报 T01（根元素是 en，基础样式不生效，报 T04 是正确行为）", () => {
  const r = lint("T01-pos-section-lang-A20");
  assert.equal(of(r, "T01").length, 0);
});

test("RULING-03：T06-neg-layer-only-A11 —— 页面里不分层的 line-height: 1.75 优先于分层声明，不应报 T06", () => {
  assert.equal(of(lint("T06-neg-layer-only-A11"), "T06", "error").length, 0);
});

const dir2b = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "iter2b");
test("RULING-03 的替代反例：只有分层声明时，后声明的层覆盖前面的层 → 报 T06 error", () => {
  const r = runLint({ inputs: ["T06-neg-layer-only-v2-A11.html"], root: dir2b, cwd: dir2b });
  assert.ok(of(r, "T06", "error").length > 0);
});
