// W2 C20：measure.css 改为 @layer measure。夹具在 test/fixtures/w2-c20/，先于实现锁定。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, copyFileSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runLint, main } from "../packages/cli/dist/index.js";
import { capture } from "./helpers.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(repo, "test", "fixtures", "w2-c20");
const asset = join(repo, "packages", "cli", "assets", "measure.css");

function withAsset(fn) {
  const d = mkdtempSync(join(tmpdir(), "measure-c20-"));
  try {
    for (const f of readdirSync(fixtures).filter((x) => x.endsWith(".html"))) copyFileSync(join(fixtures, f), join(d, f));
    copyFileSync(asset, join(d, "measure.css"));
    return fn((name) => runLint({ inputs: [`${name}.html`], root: d, cwd: d }), d);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}
const errs = (r, rule) => r.findings.filter((f) => f.rule === rule && f.severity === "error");

test("C20：measure.css 整体放在 @layer measure 里", () => {
  const css = readFileSync(asset, "utf8");
  assert.match(css, /@layer measure\s*\{/);
});

test("C20：Tailwind v4 的分层工具类不被 measure.css 覆盖（leading-tight 生效 → 如实报 T06）", () => {
  withAsset((lint) => assert.ok(errs(lint("C20-tw4-utility-not-overridden"), "T06").length > 0));
});

test("C20：中英混排页面里的中文片段，line-break: strict 也生效（不报 T04）", () => {
  withAsset((lint) => assert.equal(lint("C20-mixed-lang-line-break").findings.filter((f) => f.rule === "T04").length, 0));
});

test("C20：对照——不分层的用户样式优先、只引入 measure.css 的页面零 error", () => {
  withAsset((lint) => {
    assert.equal(lint("C20-unlayered-user-wins").summary.errors, 0);
    assert.equal(lint("C20-measure-only").summary.errors, 0);
  });
});

test("C20：init --spacing text 只删掉 text-autospace 那一段，层的花括号保持配对", () => {
  const d = mkdtempSync(join(tmpdir(), "measure-c20-init-"));
  try {
    capture(() => main(["init", "--spacing", "text"], d));
    const css = readFileSync(join(d, "measure.css"), "utf8");
    assert.doesNotMatch(css, /text-autospace/);
    assert.match(css, /@layer measure\s*\{/);
    assert.equal((css.match(/\{/g) ?? []).length, (css.match(/\}/g) ?? []).length);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
