// AUDIT_CARD_r3（docs/verification/w2/card/audit/AUDIT_CARD_r3.md）CC-01 的夹具：写于修复之前，用 MANIFEST.sha256 锁定。
// 变化检测的盲区：页面在检查期间一直改动，但每一帧都改回去，截图看不出来。整改前这几张卡片会被导出；
// 卡片要求是静态页面，检查期间有改动就必须判没检查完。字体约定同 test/fixtures/w2-card-audit/。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const card = (body) => `<!doctype html>
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
</style>
</head>
<body>
<div class="card">
<h1>分寸是排版的底线</h1>
<p>每行二十多个字，行高一点七五，标点不在行首。</p>
<p>字体只用可以商用出图的那几款。</p>
${body}
</div>
</body>
</html>
`;
const F = {};
const E = {};
const add = (name, body) => {
  F[name] = card(body);
  E[name] = { status: "incomplete", problems_has: "变化" };
};
// shadow DOM 里每一帧改一个属性（看不见）：主文档的 MutationObserver 进不去
add("E01-shadow-invisible", `<div id="h"></div>\n<script>const r = document.getElementById("h").attachShadow({ mode: "closed" }); r.innerHTML = "<span></span>"; const s = r.firstChild; let n = 0; const tick = () => { s.setAttribute("data-n", String(n++)); requestAnimationFrame(tick); }; requestAnimationFrame(tick);</script>`);
// 样式表里每一帧插入再删除一条规则（看不见）：不是 DOM 变化
add("E02-cssom-invisible", `<script>const sheet = document.styleSheets[0]; const tick = () => { sheet.insertRule(".zz-never { color: red; }", sheet.cssRules.length); sheet.deleteRule(sheet.cssRules.length - 1); requestAnimationFrame(tick); }; requestAnimationFrame(tick);</script>`);
// 冒用完整档红框的 id：每一帧加一个、再删掉
add("E03-mark-id-forgery", `<script>const tick = () => { const d = document.createElement("div"); d.id = "__measure-cjk-mark"; document.documentElement.appendChild(d); d.remove(); requestAnimationFrame(tick); }; requestAnimationFrame(tick);</script>`);

for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
writeFileSync(join(dir, "expect.json"), JSON.stringify(E, null, 2) + "\n");
console.log(`生成 ${Object.keys(F).length} 个夹具`);
