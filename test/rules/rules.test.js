// V-04：W1 每条规则至少 2 个反例被命中、2 个正例整页零 error（夹具已用 MANIFEST.sha256 锁定）
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runLint, validateConfig, defaultConfig } from "../../packages/cli/dist/index.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "bad");
const W1_PAGE_RULES = ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "T09", "T11", "T13", "F03"];

function lintFixture(name) {
  const cfgPath = join(dir, `${name}.config.json`);
  const config = existsSync(cfgPath) ? validateConfig(JSON.parse(readFileSync(cfgPath, "utf8")), cfgPath) : defaultConfig();
  return runLint({ inputs: [`${name}.html`], root: dir, cwd: dir, config });
}

const files = readdirSync(dir).filter((f) => f.endsWith(".html")).map((f) => f.replace(/\.html$/, ""));

for (const rule of W1_PAGE_RULES) {
  const negs = files.filter((f) => f.startsWith(`${rule}-neg-`));
  const poss = files.filter((f) => f.startsWith(`${rule}-pos-`));
  test(`${rule}：夹具数量（反例 ≥ 2，正例 ≥ 2）`, () => {
    assert.ok(negs.length >= 2, `${rule} 反例只有 ${negs.length} 个`);
    assert.ok(poss.length >= 2, `${rule} 正例只有 ${poss.length} 个`);
  });
  for (const f of negs) {
    test(`${rule} 反例命中：${f}`, () => {
      const r = lintFixture(f);
      const hits = r.findings.filter((x) => x.rule === rule);
      assert.ok(hits.length > 0, `没有命中 ${rule}；实际 findings：${JSON.stringify(r.findings.map((x) => x.rule))}`);
      // A-22：error 类规则的反例必须以 error 命中（T05 基础档只报 warn，T09 本身是 warn）
      const expected = rule === "T05" || rule === "T09" ? "warn" : "error";
      assert.ok(hits.some((x) => x.severity === expected), `${rule} 反例应以 ${expected} 命中；实际：${JSON.stringify(hits.map((x) => x.severity))}`);
    });
  }
  for (const f of poss) {
    test(`${rule} 正例不命中且整页零 error：${f}`, () => {
      const r = lintFixture(f);
      assert.equal(r.findings.filter((x) => x.rule === rule).length, 0, `误报 ${rule}：${JSON.stringify(r.findings.filter((x) => x.rule === rule).map((x) => x.message))}`);
      assert.equal(r.summary.errors, 0, `正例出现 error：${JSON.stringify(r.findings.filter((x) => x.severity === "error").map((x) => `${x.rule} ${x.message}`))}`);
    });
  }
}

test("F03：不在授权表里的 @font-face 只报 warn（F-UNKNOWN）", () => {
  const r = lintFixture("F03-warn-unknown-family");
  const f03 = r.findings.filter((x) => x.rule === "F03");
  assert.equal(f03.length, 1);
  assert.equal(f03[0].severity, "warn");
  assert.match(f03[0].message, /F-UNKNOWN/);
  assert.equal(r.summary.errors, 0);
});

test("T05 在基础档只报 warn，不报 error", () => {
  for (const f of files.filter((x) => x.startsWith("T05-neg-"))) {
    const r = lintFixture(f);
    assert.ok(r.findings.filter((x) => x.rule === "T05").every((x) => x.severity === "warn"));
  }
});

test("没有中文内容的页面：status 为 skipped，不报任何问题", () => {
  const r = lintFixture("NOCJK-english-only");
  assert.equal(r.summary.status, "skipped");
  assert.equal(r.findings.length, 0);
});
