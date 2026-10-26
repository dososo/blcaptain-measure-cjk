// iter4：针对复核审计 AUDIT_iter3 的 A-47、A-48。先于实现锁定。
import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { runLint } from "../packages/cli/dist/index.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(repo, "test", "fixtures", "iter4");

test("A-47：隐藏的行内文字（sr-only、hidden）不纳入 T03", () => {
  const r = runLint({ inputs: ["T03-pos-hidden-inline-A47.html"], root: dir, cwd: dir });
  assert.equal(r.findings.filter((f) => f.rule === "T03").length, 0);
});

test("A-48：开放决策的判定逻辑可以单独测试（只有带原话和日期的 resolved 才算已拍板）", async () => {
  const p = join(repo, "scripts", "verdict.mjs");
  assert.ok(existsSync(p), "应把判定逻辑抽到 scripts/verdict.mjs");
  const { isResolved, pendingBlockers } = await import(pathToFileURL(p).href);
  assert.equal(isResolved({ resolved: true, user_quote: "按推荐", resolved_on: "2026-10-26" }), true);
  assert.equal(isResolved({ resolved: true, user_quote: "", resolved_on: "2026-10-26" }), false);
  assert.equal(isResolved({ resolved: true, user_quote: "按推荐", resolved_on: "明天" }), false);
  assert.equal(isResolved({ resolved: false, user_quote: "按推荐", resolved_on: "2026-10-26" }), false);
  const items = [
    { id: "D-1", blocks_verdict: true, resolved: true, user_quote: "同意", resolved_on: "2026-10-26" },
    { id: "D-2", blocks_verdict: true, resolved: true, user_quote: "", resolved_on: "2026-10-26" },
    { id: "D-6", blocks_verdict: false, resolved: false }
  ];
  assert.deepEqual(pendingBlockers(items).map((d) => d.id), ["D-2"]);
});
