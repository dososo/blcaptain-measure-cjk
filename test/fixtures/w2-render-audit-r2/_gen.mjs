// AUDIT_RENDER_r2（RB-01 至 RB-09）的复现夹具：在整改之前写好，生成后用 MANIFEST.sha256 锁定。
// expect.json：errors / warns = 必须出现；absent = 不能出现；absent_errors = 不能出现 error；max_errors = error 条数上限；
// status = 单独跑这一页时整页的状态；inputs = 单独跑时工作区里还要放的其他页面；
// line_exact = 这条规则的结果必须带上这一行文字所在的行号；t04_both = 同一元素的 T04 必须同时有「不是 strict」和「实测」两条；
// no_message = 这些规则的消息里不能出现的字样。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const SENT = "排版的分寸在于让读者忘记排版本身，只留下内容与节奏。";
const han = (n) => {
  let s = "";
  let k = 0;
  while (k < n) {
    for (const ch of SENT) {
      if (k >= n) break;
      s += ch;
      if (/\p{Script=Han}/u.test(ch)) k++;
    }
  }
  return s.replace(/[，。]$/, "") + "。";
};
const GOOD = `:where(:lang(zh)) { line-break: strict; font-synthesis-style: none; }
@supports (text-autospace: normal) { :where(:lang(zh)) { text-autospace: normal; } }
body { font-family: "Inter", "PingFang SC", "Noto Sans SC", sans-serif; font-size: 16px; margin: 0; }
main { max-width: 36em; margin: 0 auto; padding: 0 16px; }
p, li { line-height: 1.75; }
h1 { line-height: 1.3; }`;
const page = ({ css = "", body, head = "" }) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>第 2 轮复核复现夹具</title>
${head}<style>
${GOOD}
${css}
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
const F = {};
const E = {};
const add = (name, html, expect) => {
  F[name] = html;
  E[name] = { errors: [], warns: [], absent: [], ...expect };
};
const BAD = ".bad { letter-spacing: -2px; font-size: 10px; }";
const esc = (s) => [...s].map((c) => (c.charCodeAt(0) > 127 ? `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}` : c)).join("");

// RB-01：源码里有占位中文，正文由脚本渲染（半角逗号、字体栈没有中文字体）→ 基础档规则也要查渲染后的内容
const RENDERED = '<p style="font-family: Arial, sans-serif">脚本渲染的中文,用了半角逗号,字体栈里也没有中文字体。</p>';
add("B-RB01-spa-placeholder", page({ body: `<div id="root"><p>加载中……</p></div>\n<script>document.getElementById("root").innerHTML = "${esc(RENDERED).replace(/"/g, '\\"')}";</script>` }), { errors: ["T03", "T13"], status: "fail" });
add("B-RB01-dom-equivalent", page({ body: `<div id="root">${RENDERED}</div>` }), { errors: ["T03", "T13"] });

// RB-02：竖排段落行高 1.0：完整档不查竖排的 T06，基础档的 error 不能被删
add("B-RB02-vertical-lh", page({ body: `<p style="writing-mode: vertical-rl; height: 300px; line-height: 1.0">${han(60)}</p>` }), { errors: ["T06"] });
// RB-02：选择器碰撞：折叠区里有问题的段落，和另一个可见、正常的段落选择器相同
add("B-RB02-collide", page({ css: ".x { letter-spacing: -2px; font-size: 10px; }", body: `<section><details><div><div><div><p class="x">折叠里的段落，字距为负，字号十像素。</p></div></div></div></details></section>\n<section><div><div><div><p class="x" style="letter-spacing: 0; font-size: 16px">可见的段落，样式正常。</p></div></div></div></section>` }), { errors: ["T07", "T11"] });

// RB-03：load 之后用 blob: / javascript: 跳到一个干净的文档 → 不能判通过
const CLEAN = '<!doctype html><html lang="zh-CN"><body><p style="line-height:1.75">干净的页面。</p></body></html>';
add("B-RB03-nav-blob", page({ css: BAD, body: `<p class="bad">${han(20)}</p>\n<script>addEventListener("load", () => { location.href = URL.createObjectURL(new Blob(["${esc(CLEAN).replace(/"/g, '\\"')}"], { type: "text/html" })); });</script>` }), { status: "incomplete" });
add("B-RB03-nav-js", page({ css: BAD, body: `<p class="bad">${han(20)}</p>\n<script>addEventListener("load", () => { location.href = "javascript:'${esc(CLEAN).replace(/"/g, '\\"')}'"; });</script>` }), { status: "incomplete" });
// 对照：history.pushState 不换文档，照常检查
add("B-RB03-pushstate", page({ css: BAD, body: `<p class="bad">${han(20)}</p>\n<script>addEventListener("load", () => history.pushState({}, "", "#zh"));</script>` }), { errors: ["T07", "T11"], status: "fail" });

// RB-04：中文全在 iframe 里 → 不能判「跳过」
add("B-RB04-frame", page({ body: `<iframe src="B-RB04-inner.html" width="600" height="300"></iframe>` }).replace("<main>", "<main>").replace(/<p>|<\/p>/g, ""), { status: "incomplete", inputs: ["B-RB04-inner"] });
add("B-RB04-inner", page({ css: BAD, body: `<p class="bad">${han(20)}</p>` }), {});

// RB-05：没写 <tbody> 的表格：同一个单元格只能报一条 T07，而且不能说「没测到」
add("B-RB05-table", page({ css: ".t { letter-spacing: -1px; }", body: `<table><tr><td class="t">表格里的中文，字距为负。</td></tr></table>` }), { errors: ["T07"], max_errors: { T07: 1 }, no_message: { T07: "没测到" } });

// RB-06：一行的段落里有大间隔（带 margin 的标签）→ 仍然是一行，不能报 T06 error
add("B-RB06-gap", page({ css: "p { line-height: normal; }", body: `<p>标题文字<span style="margin-left: 4em">标签</span></p>` }), { absent_errors: ["T06"] });
// RB-06：长行里每隔 26 个字有一个行内图标 → 一行仍有 60 多个字，要报 T05 error
const ICON = '<span style="display: inline-block; width: 2.2em; height: 1em"></span>';
add("B-RB06-icon", page({ css: "main { max-width: none; } .w { width: 1100px; }", body: `<p class="w">${Array.from({ length: 8 }, () => han(26) + ICON).join("")}</p>` }), { errors: ["T05"] });

// RB-07：藏青、纯蓝渐变不是紫色，不报 A01；靛蓝单色渐变照样报
add("B-RB07-navy", page({ css: "body { background: linear-gradient(#000080, #000033); min-height: 100vh; } main { color: #fff; }", body: `<h1>分寸</h1>\n<p>${han(40)}</p>` }), { absent: ["A01"] });
add("B-RB07-pure-blue", page({ css: ".hero { background-image: linear-gradient(90deg, #0000ff, #00bfff); height: 320px; }", body: `<div class="hero"><h1>分寸</h1></div>\n<p>${han(40)}</p>` }), { absent: ["A01"] });
add("B-RB07-indigo-mono", page({ css: ".hero { background-image: linear-gradient(90deg, #6366f1, #4338ca); height: 320px; }", body: `<div class="hero"><h1>全新一代平台</h1></div>\n<p>${han(40)}</p>` }), { warns: ["A01"] });

// RB-09 / RA-15：窄屏下标点不在行首（只有「不是 strict」），宽屏下实测落在行首 → 两条都要有
const PUNCT = "一二三四五六七八九十，一二三四五六七八九十。一二三四五六七八九十";
add("B-RA15-t04-both", page({ css: ".box { width: 12em; line-break: anywhere; text-spacing-trim: space-all; } @media (min-width: 1000px) { .box { width: 10em; } }", body: `<p class="box">${PUNCT}</p>` }), { errors: ["T04"], t04_both: true });

// RB-09 / RA-16：选择器和文字都唯一的元素，行号必须给，而且要对
add("B-RA16-line", page({ css: "p.small { font-size: 10px; }", body: `<p>${han(20)}</p>\n<p class="small">很小的中文注释</p>` }), { errors: ["T11"], line_exact: { T11: "很小的中文注释" } });

for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
writeFileSync(join(dir, "expect.json"), JSON.stringify(E, null, 2) + "\n");
console.log(`生成 ${Object.keys(F).length} 个夹具`);
