// AUDIT_RENDER（RA-01 至 RA-21）的复现夹具：在整改之前写好，生成后用 MANIFEST.sha256 锁定。
// 期望写在 expect.json：errors / warns = 必须出现的规则；absent = 不能出现；absent_errors = 不能出现 error；
// status = 整页结果必须是的状态（单独跑这一页时）。
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
const page = ({ css = "", body, head = "", htmlClass = "" }) => `<!doctype html>
<html lang="zh-CN"${htmlClass ? ` class="${htmlClass}"` : ""}>
<head>
<meta charset="utf-8">
<title>审计复现夹具</title>
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

// RA-01：页面改写 Array.prototype.push，想把规则 ID 改成路径上跳
add("A-RA01-push-traversal", page({ css: BAD, body: `<p class="bad">${han(20)}</p>\n<script>
const op = Array.prototype.push;
Array.prototype.push = function (...a) {
  for (const o of a) if (o && typeof o === "object" && "rule" in o && "idx" in o) { o.rule = "../../PWNED"; o.severity = "error"; }
  return op.apply(this, a);
};
</script>` }), { errors: ["T07", "T11"], status: "fail" });

// RA-02：页面伪造 getComputedStyle，想把负字距和小字号洗掉
add("A-RA02-launder", page({ css: BAD, body: `<p class="bad">${han(20)}</p>\n<script>
const real = window.getComputedStyle;
window.getComputedStyle = function (el, pseudo) {
  const cs = real.call(window, el, pseudo);
  return new Proxy(cs, { get(t, k) { if (k === "letterSpacing") return "normal"; if (k === "fontSize") return "16px"; if (k === "lineHeight") return "28px"; const v = Reflect.get(t, k); return typeof v === "function" ? v.bind(t) : v; } });
};
</script>` }), { errors: ["T07", "T11"], status: "fail" });

// RA-03：源码里没有汉字，中文全部由脚本渲染
add("A-RA03-spa", page({ body: `<div id="root"></div>\n<script>document.getElementById("root").innerHTML = '<p style="letter-spacing:-2px;font-size:10px">' + "\\u811a\\u672c\\u6e32\\u67d3\\u51fa\\u6765\\u7684\\u4e2d\\u6587\\u6bb5\\u843d\\uff0c\\u5b57\\u8ddd\\u4e3a\\u8d1f\\uff0c\\u5b57\\u53f7\\u5341\\u50cf\\u7d20\\u3002" + "</p>";</script>` }), { errors: ["T07", "T11"], status: "fail" });

// RA-04：防闪烁写法，加载完成时整页不可见 → 不能判通过
add("A-RA04-fouc", page({ htmlClass: "loading", css: `html.loading body { visibility: hidden; }\n${BAD}`, body: `<p class="bad">${han(20)}</p>\n<script>setTimeout(() => document.documentElement.classList.remove("loading"), 60000);</script>` }), { status: "incomplete" });
// RA-04：折叠的 <details> 和 display: contents 里的负字距，都要报
add("A-RA04-details-contents", page({ css: ".neg { letter-spacing: -2px; }", body: `<details><summary>展开</summary><p class="neg">折叠内容里的中文，字距为负。</p></details>\n<p><span class="neg" style="display: contents">显示为内容的中文，字距为负</span></p>` }), { errors: ["T07"], status: "fail", min_errors: { T07: 2 } });

// RA-05：加载后跳转到工作区内另一个干净的页面
add("A-RA05-redirect", page({ css: BAD, body: `<p class="bad">${han(20)}</p>\n<script>location.replace("A-RA05-redirect-target.html");</script>` }), { status: "incomplete" });
add("A-RA05-redirect-target", page({ body: `<p>${han(20)}</p>` }), {});

// RA-07：line-height: 1.5 配小数字号，不能报「低于 1.5」
add("A-RA07-lh15-vw", page({ css: "p { font-size: 4.3vw; line-height: 1.5; }", body: `<p>${han(60)}</p>` }), { absent_errors: ["T06"] });

// RA-08：两栏正文，每栏约 30 字，不能当成一行 60 字
add("A-RA08-columns", page({ css: "main { max-width: none; } .cols { column-count: 2; column-gap: 32px; width: 1000px; }", body: `<div class="cols"><p>${han(300)}</p></div>` }), { absent_errors: ["T05"] });

// RA-11（D-A1）：中英混排，一行里汉字不多，不能按行宽算成几十个字
const MIX = "中文和 English mixed text 一起混排，";
add("A-RA11-mixed-latin", page({ css: "main { max-width: 60em; }", body: `<p>${MIX.repeat(14)}</p>` }), { absent: ["T05"] });
// 边界：每行正好 45 个字 → 只报 warn，不报 error
add("A-RA11-exactly-45", page({ css: "main { max-width: 45em; }", body: `<p>${han(200)}</p>` }), { warns: ["T05"], absent_errors: ["T05"] });

// RA-10：Tailwind 的 tracking-tight 被子元素的 tracking-normal 改回来（样式已加载）
add("A-RA10-tracking-reset", page({ css: ".tracking-tight { letter-spacing: -0.025em; } .tracking-normal { letter-spacing: 0; }", body: `<div class="tracking-tight"><p class="tracking-normal">${han(30)}</p></div>` }), { absent: ["T07"] });

// RA-12：蓝到靛蓝的渐变、伪元素上的紫色渐变都要报；纯蓝渐变不报
add("A-RA12-blue-indigo", page({ css: ".hero { background-image: linear-gradient(to right, #3b82f6, #4f46e5); height: 320px; }", body: `<div class="hero"><h1>全新一代平台</h1></div>\n<p>${han(40)}</p>` }), { warns: ["A01"] });
add("A-RA12-before", page({ css: ".hero { position: relative; height: 320px; } .hero::before { content: \"\"; position: absolute; inset: 0; background: linear-gradient(135deg, #7c3aed, #c026d3); }", body: `<div class="hero"><h1>全新一代平台</h1></div>\n<p>${han(40)}</p>` }), { warns: ["A01"] });
add("A-RA12-pos-blue", page({ css: ".hero { background-image: linear-gradient(to right, #2563eb, #1d4ed8); height: 320px; }", body: `<div class="hero"><h1>分寸</h1></div>\n<p>${han(40)}</p>` }), { absent: ["A01"] });

// RA-14：25 个小字号段落 → 「另有 N 处」的 N 是 5，不按宽度重复计数
add("A-RA14-overflow", page({ css: "p.s { font-size: 11px; }", body: Array.from({ length: 25 }, (_, i) => `<p class="s">第${"一二三四五六七八九十"[i % 10]}段很小的中文注释</p>`).join("\n") }), { errors: ["T11"], overflow: { T11: 5 } });

// RA-16：脚本在前面插入一个段落，T11 的行号要么正确，要么不给
add("A-RA16-shift", page({ css: "p.small { font-size: 10px; }", body: `<p>${han(20)}</p>\n<p>${han(20)}</p>\n<p class="small">很小的中文注释</p>\n<script>document.querySelector("main").prepend(Object.assign(document.createElement("p"), { textContent: "脚本插入的段落" }));</script>` }), { errors: ["T11"], line_of: { T11: "很小的中文注释" } });

// RA-17：文字全在 <span> 里的段落，没设行高、折成多行 → T06 error
add("A-RA17-inline-only", page({ css: "p { line-height: normal; }", body: `<p><span>${han(70)}</span></p>` }), { errors: ["T06"] });

// RA-20：完整档 T02 的反例（计算值 no-autospace）
add("A-RA20-T02-no-autospace", page({ css: ":where(:lang(zh)) { text-autospace: no-autospace; }", body: `<p>${han(20)}用 CSS 和 HTML 写页面。</p>` }), { errors: ["T02"], message_of: { T02: "实测" } });

for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
writeFileSync(join(dir, "expect.json"), JSON.stringify(E, null, 2) + "\n");
console.log(`生成 ${Object.keys(F).length} 个夹具`);
