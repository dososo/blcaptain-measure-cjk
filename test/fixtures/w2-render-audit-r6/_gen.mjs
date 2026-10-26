// AUDIT_RENDER_r6（RF-01 至 RF-04）的复现夹具：在整改之前写好，生成后用 MANIFEST.sha256 锁定。
// 每一页单独跑：status = 整页状态；errors = 必须报出 error 的规则；min_errors = 每条规则 error 条数的下限。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const GOOD = `:where(:lang(zh)) { line-break: strict; font-synthesis-style: none; }
@supports (text-autospace: normal) { :where(:lang(zh)) { text-autospace: normal; } }
body { font-family: "Inter", "PingFang SC", "Noto Sans SC", sans-serif; font-size: 16px; margin: 0; }
main { max-width: 36em; margin: 0 auto; padding: 0 16px; }
p, li { line-height: 1.75; }`;
const page = (body, css = "") => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>第 6 轮复核复现夹具</title>
<style>
${GOOD}
${css}
</style>
</head>
<body>
${body}
</body>
</html>
`;
const F = {};
const E = {};
const add = (name, html, expect) => {
  F[name] = html;
  E[name] = { errors: [], ...expect };
};
const NAV = `<nav><ul><li><a href="#">首页</a></li><li><a href="#">产品介绍</a></li><li><a href="#">联系我们</a></li></ul></nav>`;
const DRAWER_CSS = ".drawer { position: fixed; inset: 0 auto 0 0; width: 260px; transform: translateX(-100%); visibility: hidden; } .drawer a { font-size: 11px; } header a { font-size: 16px; }";

// RF-01（portal）：源码里抽屉导航写在页头前面，脚本把抽屉挪到 body 末尾 → 抽屉里 11px 的链接 T11 不能被删
add("F-RF01-drawer-portal", page(`<aside class="drawer">${NAV}</aside>\n<header>${NAV}</header>\n<main><p>正文的中文段落。</p></main>\n<script>document.body.appendChild(document.querySelector(".drawer"));</script>`, DRAWER_CSS), { status: "fail", errors: ["T11"], min_errors: { T11: 3 } });

// RF-01（复制）：源码只有抽屉里一份导航，脚本复制一份到页头 → 抽屉里 11px 的链接 T11 不能被删
add("F-RF01-drawer-clone", page(`<header></header>\n<aside class="drawer">${NAV}</aside>\n<main><p>正文的中文段落。</p></main>\n<script>document.querySelector("header").appendChild(document.querySelector(".drawer nav").cloneNode(true));</script>`, DRAWER_CSS), { status: "fail", errors: ["T11"], min_errors: { T11: 3 } });

// RF-04（调换顺序）：选择器、文字都相同的两个段落，源码里折叠的 10px 在前（基础档看不出折叠）；脚本把可见的 16px 挪到前面
const S = "同一句话出现在两个位置，用来测试序号的对应关系。";
const deep = (cls, text) => `<section class="${cls}"><div><div><div><p class="x">${text}</p></div></div></div></section>`;
add("F-RF04-swap", page(`<main id="m">\n<details><summary>展开</summary>${deep("hide", S)}</details>\n${deep("show", S)}\n</main>\n<script>const m = document.getElementById("m"); m.insertBefore(m.querySelector(".show"), m.querySelector("details"));</script>`, ".hide p { font-size: 10px; } .show p { font-size: 16px; }"), { status: "fail", errors: ["T11"] });

for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
writeFileSync(join(dir, "expect.json"), JSON.stringify(E, null, 2) + "\n");
console.log(`生成 ${Object.keys(F).length} 个夹具`);
