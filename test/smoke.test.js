import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOL_NAME } from "../packages/cli/dist/index.js";

test("骨架冒烟：dist 可以导入", () => {
  assert.equal(TOOL_NAME, "measure-cjk");
});
