// AUDIT_RENDER_r4（RD-01 至 RD-04）的复现夹具：在整改之前写好，生成后用 MANIFEST.sha256 锁定。
// 每一页单独跑，整页状态必须是 status，并且 errors 里的规则必须报出 error。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const GOOD = `:where(:lang(zh)) { line-break: strict; font-synthesis-style: none; }
@supports (text-autospace: normal) { :where(:lang(zh)) { text-autospace: normal; } }
body { font-family: "Inter", "PingFang SC", "Noto Sans SC", sans-serif; font-size: 16px; margin: 0; }
main { max-width: 36em; margin: 0 auto; padding: 0 16px; }
p, li { line-height: 1.75; }`;
const page = (body) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>第 4 轮复核复现夹具</title>
<style>
${GOOD}
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
  E[name] = expect;
};
const S = "同一句话出现在折叠区和正文里，用来测试对应关系。";

// RD-01：折叠区里的元素有 error；正文里同文字（或同选择器）的可见元素只有 warn → 折叠区那条 error 不能被删
add("D-RD01-hit-text-t11", page(`<details><summary>展开</summary><p style="font-size: 10px">${S}</p></details>\n<p style="font-size: 13px">${S}</p>`), { status: "fail", errors: ["T11"] });
add("D-RD01-hit-text-t06", page(`<details><summary>展开</summary><p style="line-height: 1.0">${S}${S}</p></details>\n<p style="line-height: 2.0">${S}${S}</p>`), { status: "fail", errors: ["T06"] });
const deep = (style, text) => `<section><div><div><div><p class="x" style="${style}">${text}</p></div></div></div></section>`;
add("D-RD01-hit-sel-t11", page(`<details><summary>展开</summary>${deep("font-size: 10px", "折叠区里的说明文字。")}</details>\n${deep("font-size: 13px", "正文里的说明文字。")}`), { status: "fail", errors: ["T11"] });

// RD-02：脚本追加、替换出来的文字有半角逗号 → T03 必须补报
add("D-RD02-append", page(`<p id="p">这是源码里一段完全正确的中文。</p>\n<script>document.getElementById("p").textContent += "\\u811a\\u672c\\u8ffd\\u52a0\\u7684\\u5185\\u5bb9,\\u7528\\u4e86\\u534a\\u89d2\\u9017\\u53f7";</script>`), { status: "fail", errors: ["T03"] });
add("D-RD02-replace-common", page(`<p id="p">欢迎来到我们的网站首页。</p>\n<script>document.getElementById("p").textContent = "\\u6b22\\u8fce\\u6765\\u5230\\u6211\\u4eec\\u7684\\u7f51\\u7ad9,\\u4eca\\u5929\\u7684\\u5185\\u5bb9\\u662f\\u534a\\u89d2\\u9017\\u53f7";</script>`), { status: "fail", errors: ["T03"] });
add("D-RD02-short-src", page(`<p id="p">无</p>\n<script>document.getElementById("p").textContent = "\\u65e0\\u8bba\\u5982\\u4f55,\\u8fd9\\u6bb5\\u811a\\u672c\\u5185\\u5bb9\\u6709\\u534a\\u89d2\\u9017\\u53f7";</script>`), { status: "fail", errors: ["T03"] });

for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
writeFileSync(join(dir, "expect.json"), JSON.stringify(E, null, 2) + "\n");
console.log(`生成 ${Object.keys(F).length} 个夹具`);
