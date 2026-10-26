// AUDIT_CARD（docs/verification/w2/card/audit/AUDIT_CARD.md）复现夹具：在整改之前写好，生成后用 MANIFEST.sha256 锁定。
// 每张卡片 1080×1440。字体由测试在临时目录里生成（方框字体，D-C5）：默认是「LXGW WenKai」，覆盖本页源码里的全部字符
// （含 CSS content、属性、脚本里的字），所以被拒绝只可能是因为卡片点名用了别的字体，不是缺字。
// 页面要自带字体的夹具里写占位符 __FONT_B64__，测试把它换成生成的字体（仓库里不放字体数据，H3）。
// expect.json 的字段：
// - status：exported / rejected / incomplete；status_in：几种都可以（结果取决于时机的夹具）；
// - font：{ family, file?, exclude? }，放进 font_dir 的方框字体（file 默认 font.ttf；exclude 里的字不覆盖）；
// - page_font：{ family }，替换占位符 __FONT_B64__ 用的字体；
// - copy：要一起复制进工作区的夹具文件；
// - bad_used：结果里必须有「实际用到、但不允许出图」的字体；
// - page_font_source：结果里必须有 source 为 "page" 的字体；
// - requested_font / reason_has：这个字体必须列为「点名要用、不允许出图」，原因里带这段文字；
// - lint_error：卡片 lint 必须有 error；problems_has：problems 里必须有一条含这段文字；
// - same_png_as：导出的 PNG 必须和这个夹具导出的逐字节相同（证明导出的就是检查时的画面）。
// 所有没导出的夹具，测试都断言 PNG 不存在。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const card = ({ body, css = "", head = "", stack = `"LXGW WenKai", serif` }) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>卡片夹具</title>
${head}<style>
:where(:lang(zh)) { line-break: strict; font-synthesis-style: none; text-autospace: normal; }
html, body { margin: 0; }
body { width: 1080px; height: 1440px; overflow: hidden; background: #f4efe6; color: #1f1f1f; font-family: ${stack}; }
.card { box-sizing: border-box; width: 1080px; height: 1440px; padding: 120px 96px; }
h1 { font-size: 72px; line-height: 1.3; margin: 0 0 48px; font-weight: 400; }
p { font-size: 36px; line-height: 1.75; margin: 0 0 24px; }
.pf { font: 36px/1.75 "PingFang SC"; width: 800px; border: 0; padding: 0; background: transparent; color: #1f1f1f; }
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
  E[name] = { font: { family: "LXGW WenKai" }, ...expect };
};
const SVG_TEXT = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120"><text x="0" y="80" font-size="48" font-family="PingFang SC">图片里的字</text></svg>\n`;
const SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect x="20" y="20" width="80" height="80" fill="#7e8c6b"/></svg>\n`;

// 对照：只用 font_dir 里的字体 → 导出
add("C00-control", card({ body: `<p class="x">字体只用可以商用出图的那几款。</p>` }), { status: "exported" });

// ---------- CA-01：渲染出来、但原来没查的文字 ----------
add("C01-before-empty", card({ body: `<div class="pb"></div>`, css: `.pb::before { content: "伪元素里的字"; font: 36px/1.75 "PingFang SC"; }` }), { status: "rejected", bad_used: true });
// 引语卡的写法：装饰符号放进空元素的 ::before，方框字体不含 ✦，浏览器回退到系统的符号字体
add("C02-before-symbol", card({ body: `<p class="mark"></p>`, css: `.mark::before { content: "✦"; font-size: 120px; line-height: 1; }` }), { status: "rejected", bad_used: true, font: { family: "LXGW WenKai", exclude: "✦" } });
add("C03-input-value", card({ body: `<input class="pf" value="输入框里的字">` }), { status: "rejected", bad_used: true });
add("C04-placeholder", card({ body: `<input class="pf" placeholder="占位文字里的字">` }), { status: "rejected", bad_used: true });
add("C05-textarea", card({ body: `<textarea class="pf" rows="2">多行输入框里的字</textarea>` }), { status: "rejected", bad_used: true });
add("C06-select", card({ body: `<select class="pf"><option>下拉框里的字</option></select>` }), { status: "rejected", bad_used: true });
add("C07-shadow-script", card({ body: `<div id="host"></div>\n<script>document.getElementById("host").attachShadow({ mode: "open" }).innerHTML = '<p style="font: 36px/1.75 \\'PingFang SC\\'">影子树里的字</p>';</script>` }), { status: "rejected", bad_used: true });
add("C08-shadow-declarative", card({ body: `<div><template shadowrootmode="open"><p style="font: 36px/1.75 'PingFang SC'">声明式影子树里的字</p></template></div>` }), { status: "rejected", bad_used: true });
add("C09-first-line", card({ body: `<p class="fl">首行用了别的字体</p>`, css: `.fl::first-line { font-family: "PingFang SC"; }` }), { status: "rejected", bad_used: true });
// 查不到字体的载体：canvas、SVG 图片里的文字、iframe、object → 没检查完
add("C10-canvas", card({ body: `<canvas width="600" height="100"></canvas>\n<script>const c = document.querySelector("canvas").getContext("2d"); c.font = "48px 'PingFang SC'"; c.fillText("画布里的字", 0, 60);</script>` }), { status: "incomplete", problems_has: "canvas" });
add("C11-img-svg-data", card({ body: `<img alt="" src="data:image/svg+xml,${encodeURIComponent(SVG_TEXT)}">` }), { status: "incomplete", problems_has: "SVG" });
add("C12-img-svg-file-text", card({ body: `<img alt="" src="C12-text.svg">` }), { status: "incomplete", problems_has: "SVG", copy: ["C12-text.svg"] });
// 不含文字的 SVG 图标照常导出（不能一刀切）
add("C13-img-svg-file-icon", card({ body: `<p class="x">字体只用可以商用出图的那几款。</p>\n<img alt="" src="C13-icon.svg">` }), { status: "exported", copy: ["C13-icon.svg"] });
add("C14-iframe-latin", card({ body: `<iframe width="600" height="200" srcdoc="<p style='font-family:Helvetica Neue'>Hello Typography</p>"></iframe>` }), { status: "incomplete", problems_has: "iframe" });
// CA-09：iframe 里有中文时，problems 也要写明原因
add("C15-iframe-cjk", card({ body: `<iframe width="600" height="200" srcdoc="<p>框架里的中文</p>"></iframe>` }), { status: "incomplete", problems_has: "iframe" });
add("C16-object", card({ body: `<object type="image/svg+xml" data="C12-text.svg" width="600" height="120"></object>` }), { status: "incomplete", problems_has: "object", copy: ["C12-text.svg"] });

// ---------- CA-02：检查和截图之间状态不能变 ----------
// 动画最终把字体换成苹方：导出的画面必须和检查时一致（去掉动画后的静态样式），所以和对照组逐字节相同
add("C17-anim-long", card({ body: `<p class="x an">字体只用可以商用出图的那几款。</p>`, css: `@keyframes sw { to { font-family: "PingFang SC"; } }\n.an { animation: sw 3600s linear forwards; }` }), { status: "exported", same_png_as: "C00-control" });
add("C18-anim-short", card({ body: `<p class="x an">字体只用可以商用出图的那几款。</p>`, css: `@keyframes sw { to { font-family: "PingFang SC"; } }\n.an { animation: sw 0.01s linear forwards; }` }), { status: "exported", same_png_as: "C00-control" });
add("C19-waapi", card({ body: `<p class="x" id="w">字体只用可以商用出图的那几款。</p>\n<script>document.getElementById("w").animate([{ fontFamily: "LXGW WenKai" }, { fontFamily: "PingFang SC" }], { duration: 1, fill: "forwards" });</script>` }), { status: "exported", same_png_as: "C00-control" });
// 脚本不停地切换字体：不能导出
add("C20-script-toggle", card({ body: `<p class="x" id="t">字体只用可以商用出图的那几款。</p>\n<script>const t = document.getElementById("t"); setInterval(() => { t.style.fontFamily = t.style.fontFamily ? "" : "'PingFang SC'"; }, 30);</script>` }), { status_in: ["rejected", "incomplete"] });

// ---------- CA-04：页面自带的字体（data:、blob:、FontFace API）----------
add("C21-data-font", card({ stack: `"Noto Sans SC", "LXGW WenKai", serif`, body: `<p>页面自带的字体。</p>`, head: `<style>@font-face { font-family: "Noto Sans SC"; src: url(data:font/ttf;base64,__FONT_B64__); }</style>\n` }), { status: "rejected", page_font: { family: "Noto Sans SC" }, page_font_source: true });
add("C22-blob-font", card({ stack: `"Noto Sans SC", "LXGW WenKai", serif`, body: `<p>页面自带的字体。</p>\n<script>const b = new Blob([Uint8Array.from(atob("__FONT_B64__"), (c) => c.charCodeAt(0))], { type: "font/ttf" }); const s = document.createElement("style"); s.textContent = '@font-face { font-family: "Noto Sans SC"; src: url(' + URL.createObjectURL(b) + '); }'; document.head.appendChild(s);</script>` }), { status: "rejected", page_font: { family: "Noto Sans SC" }, page_font_source: true });
add("C23-fontface-api", card({ stack: `"Noto Sans SC", "LXGW WenKai", serif`, body: `<p>页面自带的字体。</p>\n<script>const f = new FontFace("Noto Sans SC", Uint8Array.from(atob("__FONT_B64__"), (c) => c.charCodeAt(0)).buffer); document.fonts.add(f); f.load();</script>` }), { status: "rejected", page_font: { family: "Noto Sans SC" }, page_font_source: true });

// ---------- CA-06：点名要用 🔴 字体、font_dir 里没有这份文件 ----------
add("C24-requested-red", card({ body: `<p class="red">这一段点名要用方正兰亭黑。</p>`, css: `.red { font-family: "方正兰亭黑", "LXGW WenKai", serif; }` }), { status: "rejected", requested_font: "方正兰亭黑", reason_has: "foundertype.com" });

// ---------- CA-05：lint 和导出必须是同一次渲染 ----------
add("C25-media-portrait", card({ body: `<p class="po">竖屏时字号变成十一像素。</p>`, css: `@media (orientation: portrait) { .po { font-size: 11px; line-height: 1.2; } }` }), { status: "rejected", lint_error: true, problems_has: "lint error" });
add("C26-media-min-height", card({ body: `<p class="mq">视口够高时字号变成十像素。</p>`, css: `@media (min-height: 1000px) { .mq { font-size: 10px; line-height: 1.1; } }` }), { status: "rejected", lint_error: true, problems_has: "lint error" });
add("C27-script-detects-export", card({ body: `<p class="x" id="d">发现多了样式就把字改小。</p>\n<script>if (document.querySelectorAll("style").length > 1) document.getElementById("d").style.cssText = "font-size: 10px; line-height: 1.1";</script>` }), { status: "rejected", lint_error: true, problems_has: "lint error" });

// ---------- CA-03：内部名查不到时，不能按文件名放行 ----------
const UNKNOWN = { stack: `"Totally Unknown Font", "LXGW WenKai", serif`, body: `<p>字体文件改了名字。</p>` };
add("C28-filename-lxgw", card(UNKNOWN), { status: "rejected", font: { family: "Totally Unknown Font", file: "LXGWWenKai-Regular.ttf" }, bad_used: true, reason_has: "F-UNKNOWN" });
add("C29-filename-misans", card(UNKNOWN), { status: "rejected", font: { family: "Totally Unknown Font", file: "MiSans-Bold.ttf" }, bad_used: true, reason_has: "F-UNKNOWN" });

for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
writeFileSync(join(dir, "C12-text.svg"), SVG_TEXT);
writeFileSync(join(dir, "C13-icon.svg"), SVG_ICON);
writeFileSync(join(dir, "expect.json"), JSON.stringify(E, null, 2) + "\n");
console.log(`生成 ${Object.keys(F).length} 个夹具`);
