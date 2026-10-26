// W1 补充：基础档的 @media 求值（桌面 1280px、窄屏 390px）
import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runLint } from "../../packages/cli/dist/index.js";
import { matchesMedia, STATIC_VIEWPORTS } from "../../packages/cli/dist/media.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "w1-extra");
const lint = (name) => runLint({ inputs: [`${name}.html`], root: dir, cwd: dir });
const [desktop, phone] = STATIC_VIEWPORTS;

test("媒体查询求值：常见条件", () => {
  assert.equal(matchesMedia("(max-width: 600px)", desktop), false);
  assert.equal(matchesMedia("(max-width: 600px)", phone), true);
  assert.equal(matchesMedia("(min-width: 768px)", desktop), true);
  assert.equal(matchesMedia("(min-width: 48em)", phone), false);
  assert.equal(matchesMedia("print", desktop), false);
  assert.equal(matchesMedia("screen and (max-width: 850px)", phone), true);
  assert.equal(matchesMedia("(prefers-color-scheme: dark)", desktop), false);
  assert.equal(matchesMedia("(prefers-reduced-motion: reduce)", desktop), false);
  assert.equal(matchesMedia("(width >= 600px)", desktop), true);
  assert.equal(matchesMedia("(400px <= width <= 900px)", phone), false);
  assert.equal(matchesMedia("not print", desktop), true);
  assert.equal(matchesMedia("print, (max-width: 500px)", phone), true);
});

test("只在窄屏出现的小字号：报 T11，并标明视口 390", () => {
  const r = lint("T11-neg-media-narrow-only");
  const t11 = r.findings.filter((f) => f.rule === "T11");
  assert.equal(t11.length, 1);
  assert.equal(t11[0].viewport, 390);
  assert.match(t11[0].message, /窄屏 390px/);
});

test("写在 @media print 里的小字号不报", () => {
  assert.equal(lint("T11-pos-media-print-only").summary.errors, 0);
});

test("只在超宽屏（≥ 2000px）生效的行高覆盖不报", () => {
  assert.equal(lint("T06-pos-media-desktop-override").summary.errors, 0);
});
