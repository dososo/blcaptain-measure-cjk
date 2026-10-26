// W2 完整档（--render）夹具：在实现渲染之前写好，生成后用 MANIFEST.sha256 锁定。
// 期望结果写在 expect.json：errors = 必须出现的 error 规则；warns = 必须出现的 warn 规则；absent = 不能出现的规则（任何级别）。
// 页面一律只用系统字体，不引入任何字体文件；不依赖网络。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const SENT = "排版的分寸在于让读者忘记排版本身，只留下内容与节奏。";
// 恰好 n 个汉字（在第 n 个汉字处截断），末尾补一个句号
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
// 合格的基础样式：完整档下不应产生任何 error
const GOOD = `:where(:lang(zh)) { line-break: strict; font-synthesis-style: none; }
@supports (text-autospace: normal) { :where(:lang(zh)) { text-autospace: normal; } }
body { font-family: "Inter", "PingFang SC", "Noto Sans SC", sans-serif; font-size: 16px; margin: 0; }
main { max-width: 36em; margin: 0 auto; padding: 0 16px; }
p, li { line-height: 1.75; }
h1 { line-height: 1.3; }`;
const page = ({ lang = "zh-CN", css = "", body, head = "" }) => `<!doctype html>
<html${lang === null ? "" : ` lang="${lang}"`}>
<head>
<meta charset="utf-8">
<title>完整档夹具</title>
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

// 对照：合格页面，完整档零 error，也不触发 T12、A01、A11
add("R-pos-baseline", page({ body: `<h1>分寸</h1>\n<p>${han(80)}</p>\n<p>${han(60)}</p>\n<ul><li>${han(20)}</li></ul>` }), { absent: ["T02", "T04", "T05", "T06", "T07", "T08", "T11", "T12", "A01", "A11"] });

// T05：容器 60em，宽屏一行约 60 字 → 完整档实测报 error（基础档只能报 warn）
add("R-T05-neg-wide", page({ css: "main { max-width: 60em; }", body: `<p>${han(160)}</p>` }), { errors: ["T05"] });
// T05：容器 42em → 一行约 42 字，超过 40 但没到 45 → 只报 warn
add("R-T05-warn-42", page({ css: "main { max-width: 42em; }", body: `<p>${han(160)}</p>` }), { warns: ["T05"], absent_errors: ["T05"] });

// T04：line-break: anywhere 允许在标点前断行；宽度正好 10 个字，第 11 个字符是逗号 → 实测逗号落在行首
const PUNCT = "一二三四五六七八九十，一二三四五六七八九十。一二三四五六七八九十";
add("R-T04-neg-anywhere", page({ css: ".box { width: 10em; line-break: anywhere; text-spacing-trim: space-all; }", body: `<p class="box">${PUNCT}</p>` }), { errors: ["T04"] });
// 对照：同样的宽度和文字，line-break: strict → 标点不会出现在行首
add("R-T04-pos-strict", page({ css: ".box { width: 10em; line-break: strict; text-spacing-trim: space-all; }", body: `<p class="box">${PUNCT}</p>` }), { absent: ["T04"] });

// T06：没设行高、实际折成多行 → error
add("R-T06-neg-normal-multiline", page({ css: "p { line-height: normal; }", body: `<p>${han(70)}</p>` }), { errors: ["T06"] });
// T06：没设行高、但在测试宽度（1024、1280）下实际只有一行 → 只报 warn（基础档按 30 字以上报 error）
add("R-T06-single-line-warn", page({ css: "p { line-height: normal; }", body: `<p>${han(31)}</p>` }), { warns: ["T06"], absent_errors: ["T06"], widths: [1024, 1280] });

// T07：计算后的字距为负
add("R-T07-neg-computed", page({ css: "h1 { letter-spacing: -0.02em; }", body: `<h1>负字距的中文标题</h1>\n<p>${han(40)}</p>` }), { errors: ["T07"] });
// T07：Tailwind 类名启发式（CSS 没有加载时也要报）
add("R-T07-neg-tailwind-class", page({ body: `<h1 class="tracking-tight">负字距的中文标题</h1>\n<p>${han(40)}</p>` }), { errors: ["T07"] });

// T08：<em> 默认斜体，没有 font-synthesis-style: none → 浏览器合成假斜体
add("R-T08-neg-em-synth", page({ css: ":where(:lang(zh)) { font-synthesis-style: auto; }", body: `<p>${han(20)}<em>这里是强调</em>${han(20)}</p>` }), { errors: ["T08"] });
// 对照：引入了 font-synthesis-style: none
add("R-T08-pos-em-measure", page({ body: `<p>${han(20)}<em>这里是强调</em>${han(20)}</p>` }), { absent_errors: ["T08"] });

// T11：中文字号 11px
add("R-T11-neg-11px", page({ body: `<p>${han(40)}</p>\n<p style="font-size: 11px">很小的中文注释文字</p>` }), { errors: ["T11"] });

// T12：首行缩进 + 段间距同时使用 → warn
add("R-T12-warn-indent-and-margin", page({ css: "p { text-indent: 2em; }", body: `<p>${han(60)}</p>\n<p>${han(60)}</p>\n<p>${han(60)}</p>` }), { warns: ["T12"] });
// 对照：只用首行缩进，段间距为 0
add("R-T12-pos-indent-only", page({ css: "p { text-indent: 2em; margin: 0; }", body: `<p>${han(60)}</p>\n<p>${han(60)}</p>\n<p>${han(60)}</p>` }), { absent: ["T12"] });

// A01：紫色 / 蓝紫渐变背景
add("R-A01-warn-purple-gradient", page({ css: "body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }", body: `<h1>全新一代平台</h1>\n<p>${han(40)}</p>` }), { warns: ["A01"] });
add("R-A01-warn-oklch", page({ css: ".hero { background-image: linear-gradient(to right, oklch(0.55 0.25 300), oklch(0.6 0.2 265)); height: 320px; }", body: `<div class="hero"><h1>全新一代平台</h1></div>\n<p>${han(40)}</p>` }), { warns: ["A01"] });
// 对照：米纸色渐变
add("R-A01-pos-paper", page({ css: "body { background: linear-gradient(#f5f0e6, #ebe3d3); min-height: 100vh; }", body: `<h1>分寸</h1>\n<p>${han(40)}</p>` }), { absent: ["A01"] });

// A11：每段都加粗关键词，加粗比例约 25%
const bolded = () => `<p>${han(15)}<strong>${han(10).slice(0, -1)}</strong>${han(15)}</p>`;
add("R-A11-warn-bold-everywhere", page({ body: [bolded(), bolded(), bolded(), bolded()].join("\n") }), { warns: ["A11"] });
// 对照：只有一段里有少量加粗
add("R-A11-pos-sparse", page({ body: `<p>${han(30)}<strong>关键</strong>${han(10)}</p>\n<p>${han(40)}</p>\n<p>${han(40)}</p>\n<p>${han(40)}</p>` }), { absent: ["A11"] });

// 基础档规则在完整档下照样检查：没有 lang → T01 error，并且也要有截图
add("R-T01-neg-static-in-render", page({ lang: null, body: `<p>${han(40)}</p>` }), { errors: ["T01"] });

// 网络拦截：远程样式、图片、脚本、fetch，工作区外的 file://，以及工作区外的相对路径（测试时在上一级目录放 outside.css，内容是负字距）
add("R-net-block", page({
  head: `<link rel="stylesheet" href="https://example.com/remote.css">\n<link rel="stylesheet" href="../outside.css">\n<script src="https://example.com/remote.js"></script>\n`,
  body: `<p>${han(40)}</p>\n<img src="https://example.com/a.png" alt="">\n<img src="file:///etc/hosts" alt="">\n<script>fetch("https://example.com/beacon").catch(() => {});</script>`
}), { absent: ["T07"] });

// 超时：页面脚本死循环 → 本页记为 timeout，整体 incomplete，退出码 2
add("R-timeout-infinite-loop", page({ body: `<p>${han(40)}</p>\n<script>for (;;) {}</script>` }), {});

for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
writeFileSync(join(dir, "expect.json"), JSON.stringify(E, null, 2) + "\n");
console.log(`生成 ${Object.keys(F).length} 个夹具`);
