// AUDIT_CARD_r3 整改的回归测试（CC-01）。夹具在 test/fixtures/w2-card-audit-r3/，MANIFEST.sha256 锁定；
// 写于修复之前。字体约定同 test/card-audit.test.js。
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as measure from "../packages/cli/dist/index.js";
import { makeTtf } from "./helpers/font.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(repo, "test", "fixtures", "w2-card-audit-r3");
const EXPECT = JSON.parse(readFileSync(join(fixtures, "expect.json"), "utf8"));
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const allChars = (html) => [...new Set([...html].filter((c) => c.trim()))].join("") + " ";

async function runFixture(name) {
  const e = EXPECT[name];
  const html = readFileSync(join(fixtures, `${name}.html`), "utf8");
  const base = mkdtempSync(join(tmpdir(), "measure-card-audit-r3-"));
  const ws = join(base, "ws");
  mkdirSync(join(ws, "fonts"), { recursive: true });
  try {
    writeFileSync(join(ws, `${name}.html`), html);
    for (const f of e.copy ?? []) cpSync(join(fixtures, f), join(ws, f));
    writeFileSync(join(ws, "fonts", "font.ttf"), makeTtf({ family: "LXGW WenKai", chars: allChars(html) }));
    const r = await measure.runCard({ input: `${name}.html`, root: ws, cwd: ws, fontDir: "fonts", out: "card.png" });
    return { r, png: existsSync(join(ws, "card.png")) ? readFileSync(join(ws, "card.png")) : undefined };
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

let control;
for (const name of Object.keys(EXPECT)) {
  const e = EXPECT[name];
  test(`AUDIT_CARD_r3 夹具 ${name}：${e.status ?? e.status_in.join(" / ")}`, async () => {
    const { r, png } = await runFixture(name);
    const show = JSON.stringify({ status: r.status, fonts: r.fonts?.map((f) => [f.family, f.source, f.used, f.allowed]), problems: r.problems, lint: r.lint?.findings?.filter((f) => f.severity === "error").map((f) => f.rule) });
    if (e.status) assert.equal(r.status, e.status, show);
    else assert.ok(e.status_in.includes(r.status), show);
    if (r.status === "exported") {
      assert.ok(png && png.subarray(0, 8).equals(PNG), "导出时必须写出 PNG");
      assert.ok(r.fonts.every((f) => f.allowed), show);
      assert.equal(r.lint.summary.errors, 0, show);
      if (e.png_equals_if_exported) {
        control ??= (await runFixture(e.png_equals_if_exported)).png;
        assert.ok(control, "对照组没有导出");
        assert.ok(png.equals(control), `导出的 PNG 和对照组不同：截图里的画面不是 lint 检查过的那个（CB-01）：${show}`);
      }
    } else {
      assert.equal(png, undefined, `没导出时不能写 PNG：${show}`);
      assert.ok(r.problems.length > 0, `没导出时 problems 必须写明原因：${show}`);
    }
    if (e.problems_has) assert.ok(r.problems.some((p) => p.includes(e.problems_has)), `problems 应包含「${e.problems_has}」：${show}`);
  });
}
