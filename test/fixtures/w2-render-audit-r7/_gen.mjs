// AUDIT_RENDER_r7（RG-01 至 RG-03）的复现夹具：在整改之前写好，生成后用 MANIFEST.sha256 锁定。
// 每一页单独跑（只用 1280px 一种宽度）：status = 整页状态；errors = 必须报出 error 的规则。
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
<title>第 7 轮复核复现夹具</title>
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

// RG-01：5200 个中文元素（每 50 个一组）；最前面有一段可见的正常段落，最后面折叠区里有同文字、10px 的段落
const T = "重复出现的说明文字。";
const groups = Array.from({ length: 104 }, (_, g) => `<div>${Array.from({ length: 50 }, (_, i) => `<span>第${g}组第${i}项</span>`).join("")}</div>`).join("\n");
add("G-RG01-cap", page(`<main>\n<p>${T}</p>\n${groups}\n<details><summary>展开</summary><p style="font-size: 10px">${T}</p></details>\n</main>`), { status: "fail", errors: ["T11"] });

// RG-03：同身份的两个元素（选择器超过 4 层撞车、文字相同），脚本删掉可见的那个，只留下折叠里 10px 的
const S = "同一句话出现在两个位置，用来测试删除后的对应关系。";
const deep = (cls, text) => `<section class="${cls}"><div><div><div><p class="x">${text}</p></div></div></div></section>`;
add("G-RG03-delete-visible", page(`<main>\n<details><summary>展开</summary>${deep("hide", S)}</details>\n${deep("show", S)}\n</main>\n<script>document.querySelector(".show").remove();</script>`, ".hide p { font-size: 10px; } .show p { font-size: 16px; }"), { status: "fail", errors: ["T11"] });

// RG-03：同身份的元素一个在主文档、一个在 iframe（srcdoc）里 → 记为没检查完
add("G-RG03-frame-part", page(`<main>\n<p>${S}</p>\n<iframe srcdoc="&lt;p style=&quot;font-size:10px&quot;&gt;${S}&lt;/p&gt;" width="320" height="120"></iframe>\n</main>`), { status: "incomplete" });

for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
writeFileSync(join(dir, "expect.json"), JSON.stringify(E, null, 2) + "\n");
console.log(`生成 ${Object.keys(F).length} 个夹具`);
