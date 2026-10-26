// V-10：skill 里和 CLI 包里的 measure.css 都和 PRD §7.4 的代码块逐字一致；授权表的包内副本与仓库一致
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const prd = readFileSync(join(repo, "docs/PRD.md"), "utf8");
const section = prd.slice(prd.indexOf("### 7.4"), prd.indexOf("### 7.5"));
const block = section.match(/```css\n([\s\S]*?)```/)[1];

test("PRD §7.4 里能找到 measure.css 代码块", () => {
  assert.ok(block.includes("text-autospace: normal"));
});

for (const p of ["skills/measure/assets/measure.css", "packages/cli/assets/measure.css"]) {
  test(`${p} 与 PRD §7.4 逐字一致`, () => {
    assert.equal(readFileSync(join(repo, p), "utf8"), block);
  });
}

test("packages/cli/data/licenses.json 与 data/fonts/licenses.json 完全一致", () => {
  assert.equal(readFileSync(join(repo, "packages/cli/data/licenses.json"), "utf8"), readFileSync(join(repo, "data/fonts/licenses.json"), "utf8"));
});
