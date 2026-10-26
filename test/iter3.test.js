// iter3：针对复核审计 AUDIT_iter2 的发现（A-32/33/34/35/37/39/40、A-36 的 verify 规则）。先于实现锁定。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runLint, main, matchFontName } from "../packages/cli/dist/index.js";
import { capture } from "./helpers.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(repo, "test", "fixtures", "iter3");
const lint = (name) => runLint({ inputs: [`${name}.html`], root: dir, cwd: dir });
const errs = (r, rule) => r.findings.filter((f) => f.rule === rule && f.severity === "error");

test("A-32：aria-hidden 的可见文字仍然检查 → 报 T11 error", () => {
  assert.ok(errs(lint("T11-neg-aria-hidden-visible-A32"), "T11").length > 0);
});

test("A-33：data: URI 内嵌商用字体 → 报 F03 error", () => {
  assert.ok(errs(lint("F03-neg-data-uri-commercial-A33"), "F03").length > 0);
});

test("A-33：data: URI 内嵌 🟢 字体 → 不报 F03 error", () => {
  assert.equal(errs(lint("F03-pos-data-uri-embeddable-A33"), "F03").length, 0);
});

test("A-40：嵌套块级元素两侧的文字不拼接，不误报 T03", () => {
  assert.equal(lint("T03-pos-nested-block-boundary-A40").findings.filter((f) => f.rule === "T03").length, 0);
});

test("A-40：同一块里跨行内元素的半角标点仍然能抓到", () => {
  assert.ok(errs(lint("T03-neg-inline-still-joined-A40"), "T03").length > 0);
});

test("A-34：单页超时 → status 为 incomplete，CLI 退出码 2，不判通过", () => {
  const r = spawnSync(process.execPath, [join(repo, "packages/cli/bin/measure-cjk.js"), "lint", "TIMEOUT-page-A34.html", "--format", "json"], { cwd: dir, env: { ...process.env, MEASURE_PAGE_BUDGET_MS: "0" }, encoding: "utf8" });
  assert.equal(r.status, 2, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.summary.status, "incomplete");
  assert.ok(j.run.skipped_inputs.some((x) => x.reason === "timeout"));
});

test("A-34：耗时上限只能调低，不能调高（防止用来关掉超时保护）", () => {
  const r = spawnSync(process.execPath, [join(repo, "packages/cli/bin/measure-cjk.js"), "lint", "TIMEOUT-page-A34.html"], { cwd: dir, env: { ...process.env, MEASURE_PAGE_BUDGET_MS: "999999" }, encoding: "utf8" });
  assert.equal(r.status, 2);
});

function sandbox() {
  const base = mkdtempSync(join(tmpdir(), "measure-iter3-"));
  copyFileSync(join(dir, "TIMEOUT-page-A34.html"), join(base, "p.html"));
  return { base, done: () => rmSync(base, { recursive: true, force: true }) };
}

test("A-35：--out 不能覆盖 package.json、当前配置文件或任何不是 lint 结果的已有 .json", () => {
  const s = sandbox();
  try {
    writeFileSync(join(s.base, "package.json"), `{"name":"x"}`);
    writeFileSync(join(s.base, "measure.config.json"), `{"schema_version":"1.0.0"}`);
    writeFileSync(join(s.base, "other.json"), `{"hello":1}`);
    for (const out of ["package.json", "measure.config.json", "other.json"]) {
      const r = capture(() => main(["lint", "p.html", "--out", out], s.base));
      assert.equal(r.code, 2, out);
    }
    assert.equal(readFileSync(join(s.base, "package.json"), "utf8"), `{"name":"x"}`);
    // 覆盖上一次的 lint 结果是允许的
    assert.notEqual(capture(() => main(["lint", "p.html", "--out", "r.json"], s.base)).code, 2);
    assert.notEqual(capture(() => main(["lint", "p.html", "--out", "r.json"], s.base)).code, 2);
  } finally {
    s.done();
  }
});

test("A-39：阈值只能往严的方向调（body_line_height_min 不能低于 1.5，min_font_px_body 不能低于 14）", () => {
  const s = sandbox();
  try {
    for (const t of [{ body_line_height_min: 1.2 }, { min_font_px_body: 12 }, { line_length_warn: 60 }]) {
      writeFileSync(join(s.base, "c.json"), JSON.stringify({ schema_version: "1.0.0", thresholds: t }));
      assert.equal(capture(() => main(["lint", "p.html", "--config", "c.json"], s.base)).code, 2, JSON.stringify(t));
    }
  } finally {
    s.done();
  }
});

test("A-37：前缀匹配统一规则——HY 前缀能命中汉仪拉丁名，但不误伤 Hyperlegible", () => {
  assert.equal(matchFontName("HYQiHei")?.id, "hanyi-commercial");
  assert.equal(matchFontName("FZLanTingHei")?.id, "founder-commercial");
  assert.equal(matchFontName("Atkinson Hyperlegible"), undefined);
  assert.equal(matchFontName("Hyperlegible"), undefined);
});

test("A-36：open_decisions 里标 resolved 的事项必须带用户原话和日期，否则 verify 不认", () => {
  const src = readFileSync(join(repo, "scripts/verify.mjs"), "utf8");
  assert.match(src, /user_quote/);
  assert.match(src, /resolved_on/);
});
