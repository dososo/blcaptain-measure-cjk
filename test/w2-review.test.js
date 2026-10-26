// W2 中期复核 AUDIT_W2_C20 的 W2-03：init --spacing text 在 CRLF 换行下也要删掉 text-autospace 段。先于实现锁定。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");

test("W2-03：stripAutospace 对 LF 和 CRLF 都只删 text-autospace 段，花括号保持配对", async () => {
  const { stripAutospace } = await import("../packages/cli/dist/cli.js");
  assert.equal(typeof stripAutospace, "function", "应导出 stripAutospace");
  const lf = readFileSync(join(repo, "packages/cli/assets/measure.css"), "utf8");
  for (const css of [lf, lf.replace(/\n/g, "\r\n")]) {
    const out = stripAutospace(css);
    assert.doesNotMatch(out, /text-autospace/);
    assert.match(out, /@layer measure/);
    assert.equal((out.match(/\{/g) ?? []).length, (out.match(/\}/g) ?? []).length);
  }
});
