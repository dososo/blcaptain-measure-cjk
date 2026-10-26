// AUDIT_CARD_r2（docs/verification/w2/card/audit/AUDIT_CARD_r2.md）的夹具：CB-01 写于修复之前，CB-02 写于实现之后（审计 CB-02 修法第 1 条）。
// 生成后用 MANIFEST.sha256 锁定。卡片模板、字体约定同 test/fixtures/w2-card-audit/_gen.mjs（方框字体「LXGW WenKai」覆盖源码全部字符）。
// expect.json 的字段：
// - status / status_in / problems_has：同 w2-card-audit；
// - copy：要一起复制进工作区的夹具文件；
// - png_equals_if_exported：如果导出了，PNG 必须和这个夹具导出的逐字节相同（结果取决于时机的夹具用它：
//   要么检查到了变化（拒绝或没检查完），要么导出的就是 lint 检查过的那个画面）。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const card = ({ body, css = "" }) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>卡片夹具</title>
<style>
:where(:lang(zh)) { line-break: strict; font-synthesis-style: none; text-autospace: normal; }
html, body { margin: 0; }
body { width: 1080px; height: 1440px; overflow: hidden; background: #f4efe6; color: #1f1f1f; font-family: "LXGW WenKai", serif; }
.card { box-sizing: border-box; width: 1080px; height: 1440px; padding: 120px 96px; }
h1 { font-size: 72px; line-height: 1.3; margin: 0 0 48px; font-weight: 400; }
p { font-size: 36px; line-height: 1.75; margin: 0 0 24px; }
.box { width: 600px; height: 120px; }
${css}
</style>
</head>
<body>
<div class="card">
<h1>分寸是排版的底线</h1>
<p>每行二十多个字，行高一点七五，标点不在行首。</p>
${body}
</div>
</body>
</html>
`;
const F = {};
const E = {};
const add = (name, html, expect) => {
  F[name] = html;
  E[name] = expect;
};
const SVG_TEXT = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120"><text x="0" y="80" font-size="48" font-family="PingFang SC">图片里的字</text></svg>\n`;
const SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect x="20" y="20" width="80" height="80" fill="#7e8c6b"/></svg>\n`;
const LINE = `<p class="x" id="d">字体只用可以商用出图的那几款。</p>`;

add("D00-control", card({ body: LINE }), { status: "exported" });

// ---------- CB-01：lint 测量之后、截图之前改页面 ----------
// 加载后过 T 毫秒把一段字改成 10px（违反 T11）。不管 T 落在哪一段：
// 落在 lint 测量之前 → lint 报 error，拒绝；落在测量和截图之间 → 必须发现变化，判没检查完；
// 落在截图之后 → 导出的是 lint 检查过的画面，和对照组 D00 逐字节相同
// 本机实测（evidence/CB-01-sweep.log）：整改前，T 在 60–72 ms 附近时会导出 lint 没检查过的画面，这一段按 2 ms 密集覆盖
const DELAYS = [0, ...Array.from({ length: 21 }, (_, i) => 50 + 2 * i), 150, 300, 1000];
for (const t of DELAYS) {
  add(`D-late-${String(t).padStart(4, "0")}ms`, card({ body: `${LINE}\n<script>addEventListener("load", () => setTimeout(() => { document.getElementById("d").style.cssText = "font-size: 10px; line-height: 1.1"; }, ${t}));</script>` }), { status_in: ["rejected", "incomplete", "exported"], png_equals_if_exported: "D00-control" });
}

// ---------- CB-02：查不到字体的载体，补齐夹具 ----------
add("D10-embed", card({ body: `<embed type="image/svg+xml" src="D-text.svg" width="600" height="120">` }), { status: "incomplete", problems_has: "embed", copy: ["D-text.svg"] });
add("D11-css-background-file", card({ body: `<div class="box bg"></div>`, css: `.bg { background-image: url("D-text.svg"); }` }), { status: "incomplete", problems_has: "SVG", copy: ["D-text.svg"] });
add("D12-css-background-data", card({ body: `<div class="box bg"></div>`, css: `.bg { background-image: url("data:image/svg+xml,${encodeURIComponent(SVG_TEXT)}"); }` }), { status: "incomplete", problems_has: "SVG" });
add("D13-css-mask", card({ body: `<div class="box mk"></div>`, css: `.mk { background: #1f1f1f; -webkit-mask-image: url("D-text.svg"); mask-image: url("D-text.svg"); }` }), { status: "incomplete", problems_has: "SVG", copy: ["D-text.svg"] });
add("D14-content-url", card({ body: `<div class="cu"></div>`, css: `.cu::before { content: url("D-text.svg"); }` }), { status: "incomplete", problems_has: "SVG", copy: ["D-text.svg"] });
add("D15-inline-svg-image", card({ body: `<svg width="600" height="120"><image href="D-text.svg" width="600" height="120"/></svg>` }), { status: "incomplete", problems_has: "SVG", copy: ["D-text.svg"] });
// 不含文字的 SVG 背景照常导出（不能一刀切）
add("D16-css-background-icon", card({ body: `${LINE}\n<div class="box bgi"></div>`, css: `.bgi { background-image: url("D-icon.svg"); background-repeat: no-repeat; }` }), { status: "exported", copy: ["D-icon.svg"] });

for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
writeFileSync(join(dir, "D-text.svg"), SVG_TEXT);
writeFileSync(join(dir, "D-icon.svg"), SVG_ICON);
writeFileSync(join(dir, "expect.json"), JSON.stringify(E, null, 2) + "\n");
console.log(`生成 ${Object.keys(F).length} 个夹具`);
