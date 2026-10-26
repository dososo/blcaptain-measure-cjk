// AUDIT_RENDER_r5（RE-01 至 RE-04）的复现夹具：在整改之前写好，生成后用 MANIFEST.sha256 锁定。
// 每一页单独跑：status = 整页状态；errors = 必须报出 error 的规则；max_errors / min_errors = 每条规则 error 条数的上下限。
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
<title>第 5 轮复核复现夹具</title>
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

// RE-01：收起的侧滑抽屉导航和页头导航用同一套链接文字，选择器也相同；抽屉里的链接 11px → T11 不能被删
const NAV = `<nav><ul><li><a href="#">首页</a></li><li><a href="#">产品介绍</a></li><li><a href="#">联系我们</a></li></ul></nav>`;
add("E-RE01-drawer", page(`<header>${NAV}</header>\n<aside class="drawer">${NAV}</aside>\n<main><p>正文的中文段落。</p></main>`, ".drawer { position: fixed; inset: 0 auto 0 0; width: 260px; transform: translateX(-100%); visibility: hidden; } .drawer a { font-size: 11px; } header a { font-size: 16px; }"), { status: "fail", errors: ["T11"] });
// RE-01：选择器相同（超过 4 层）、文字完全相同；折叠里的 10px，可见的 16px
const S = "同一句话出现在折叠区和正文里，用来测试对应关系。";
const deep = (style, text) => `<section><div><div><div><p class="x" style="${style}">${text}</p></div></div></div></section>`;
add("E-RE01-same-id", page(`<main>\n<details><summary>展开</summary>${deep("font-size: 10px", S)}</details>\n${deep("font-size: 16px", S)}\n</main>`), { status: "fail", errors: ["T11"] });
// RE-01：同上，两段文字前 24 个字相同、后面不同
add("E-RE01-same-id-prefix", page(`<main>\n<details><summary>展开</summary>${deep("font-size: 10px", S + "折叠区的结尾。")}</details>\n${deep("font-size: 16px", S + "正文的结尾。")}\n</main>`), { status: "fail", errors: ["T11"] });

// RE-02：源码文字不到 6 个字，脚本加了前缀 → 同一个问题只能报一次
add("E-RE02-short-tweak", page(`<main><p id="p" style="font-family: Arial, sans-serif">你好,世界</p></main>\n<script>const p = document.getElementById("p"); p.firstChild.data = "\\u3010\\u66f4\\u65b0\\u3011" + p.firstChild.data;</script>`), { status: "fail", errors: ["T03"], max_errors: { T03: 1, T13: 1 } });

// RE-03：脚本插入一个和源码段落文字相同、问题也相同的新段落 → 两处都要报
add("E-RE03-same-text-insert", page(`<main><p style="font-family: Arial, sans-serif">同样的文字,同样的问题</p><div id="x"></div></main>\n<script>document.getElementById("x").innerHTML = '<p style="font-family: Arial, sans-serif">\\u540c\\u6837\\u7684\\u6587\\u5b57,\\u540c\\u6837\\u7684\\u95ee\\u9898</p>';</script>`), { status: "fail", errors: ["T03"], min_errors: { T03: 2 } });

for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
writeFileSync(join(dir, "expect.json"), JSON.stringify(E, null, 2) + "\n");
console.log(`生成 ${Object.keys(F).length} 个夹具`);
