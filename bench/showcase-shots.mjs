// 前后对比图的截图（W2 第 3 步）：北极星实验里同一条提示词「不装 / 装 measure」各一页，截手机和桌面两种视口。
// 字体替换和核对见 showcase-lib.mjs。用法：node bench/showcase-shots.mjs <agent>:<id>[,<agent>:<id>…] [--out site/shots]
// 产物：<out>/<agent>-<id>-<arm>-<mobile|desktop>.jpg，以及 <out>/shots.json（每张图实际用到的字体和判定）。
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fontCheck, openBrowser, openPage, VIEWS } from "./showcase-lib.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const pairs = (args[0] ?? "").split(",").filter(Boolean).map((x) => x.split(":"));
if (!pairs.length) {
  console.error("用法：node bench/showcase-shots.mjs codex:001,claude-code:007 [--out site/shots]");
  process.exit(2);
}
const outDir = resolve(repo, opt("out", "site/shots"));
mkdirSync(outDir, { recursive: true });
const browser = await openBrowser();
const record = existsSync(join(outDir, "shots.json")) ? JSON.parse(readFileSync(join(outDir, "shots.json"), "utf8")) : {};
let bad = 0;
try {
  for (const [agent, id] of pairs) {
    for (const arm of ["control", "measure"]) {
      const root = realpathSync(join(repo, "bench", "runs", `2026-W2-northstar-v3-${agent}-${arm}`, id, "output"));
      for (const [view, v] of Object.entries(VIEWS)) {
        const { ctx, page } = await openPage(browser, join(root, "index.html"), root, v);
        const check = await fontCheck(ctx, page);
        const height = Math.min(v.maxHeight, await page.evaluate(() => document.documentElement.scrollHeight));
        const file = `${agent}-${id}-${arm}-${view}.jpg`;
        await page.screenshot({ path: join(outDir, file), type: "jpeg", quality: 88, clip: { x: 0, y: 0, width: v.width, height }, fullPage: true, animations: "disabled", caret: "hide" });
        record[file] = { agent, id, arm, view, ...check, ok: check.violations.length === 0 };
        if (check.violations.length) bad++;
        console.log(`${check.violations.length ? "✗" : "✓"} ${file}  字体：${Object.keys(check.fonts).join("、")}${check.violations.length ? `；不合格：${check.violations.join("、")}` : ""}`);
        for (const [fam, list] of Object.entries(check.where)) for (const w of list) console.log(`    ${fam} ← ${w}`);
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
}
const tmp = join(outDir, `shots.json.${process.pid}.tmp`);
writeFileSync(tmp, JSON.stringify(record, null, 2) + "\n");
renameSync(tmp, join(outDir, "shots.json"));
console.log(bad ? `有 ${bad} 张图用到了不能出图的字体，不能用` : "全部截图只用到允许出图的字体");
process.exit(bad ? 1 : 0);
