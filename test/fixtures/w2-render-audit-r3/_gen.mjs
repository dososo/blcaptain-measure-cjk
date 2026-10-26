// AUDIT_RENDER_r3（RC-01 至 RC-05）的复现夹具：在整改之前写好，生成后用 MANIFEST.sha256 锁定。
// expect.json：errors / absent / absent_errors 同前；max_errors = 每条规则的 error 条数上限；min_errors = 下限；
// status = 单独跑这一页时整页的状态；message_has = 这条规则里必须有一条消息包含的字样；
// no_selector = 结果里任何一条的选择器都不能包含的字样（例如 Chrome 错误页的结构）。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const GOOD = `:where(:lang(zh)) { line-break: strict; font-synthesis-style: none; }
@supports (text-autospace: normal) { :where(:lang(zh)) { text-autospace: normal; } }
body { font-family: "Inter", "PingFang SC", "Noto Sans SC", sans-serif; font-size: 16px; margin: 0; }
main { max-width: 36em; margin: 0 auto; padding: 0 16px; }
p, li { line-height: 1.75; }
h1, h2 { line-height: 1.3; }`;
const page = ({ css = "", body }) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>第 3 轮复核复现夹具</title>
<style>
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
  E[name] = { errors: [], absent: [], ...expect };
};

// RC-01 ①：完整档已经纠正了 Tailwind 类名的近似误报；页面里另有一个同文字的 <option>，误报不能复活
add("C-RC01-tw-option", page({ css: ".tracking-tight { letter-spacing: -0.025em; } .tracking-normal { letter-spacing: 0; }", body: `<div class="tracking-tight"><h2 class="tracking-normal">基础数据 API</h2></div>\n<p>正文段落，用来说明接口的用途。</p>\n<form><select><option>基础数据 API</option><option>其他接口</option></select></form>` }), { absent_errors: ["T07"], status: "pass" });

// RC-01 ②：响应式页面的两份同文字段落：窄屏显示 p.m（10px），宽屏显示 p.d；p.m 的 T11 只能报一条
add("C-RC01-responsive", page({ css: ".m { font-size: 10px; } .d { display: none; } @media (min-width: 768px) { .m { display: none; } .d { display: block; } }", body: `<p class="m">同一段说明文字，移动端一份。</p>\n<p class="d">同一段说明文字，移动端一份。</p>` }), { errors: ["T11"], max_errors: { T11: 1 } });

// RC-02：嵌了被拦截的外部 iframe（Chrome 错误页可能是中文）→ 不能判「iframe 里有中文」
add("C-RC02-remote-iframe", page({ body: `<p>主文档的中文，页面里嵌了一个外部视频。</p>\n<iframe src="https://www.youtube.com/embed/xyz" width="320" height="180"></iframe>` }), { status: "pass" });

// RC-02：加载后跳到外部地址被拦截 → incomplete，但结果里不能混进 Chrome 错误页的结论
add("C-RC02-redirect-errorpage", page({ body: `<p>即将跳转到外部页面。</p>\n<script>location.replace("https://example.com/");</script>` }), { status: "incomplete", no_selector: "main-message" });

// RC-03 ①：脚本给源码里的段落加了前缀：同一个段落的 T03、T13 只能各报一条
add("C-RC03-text-tweak", page({ body: `<p id="t" style="font-family: Arial, sans-serif">你好,世界,这是一段带半角逗号的中文</p>\n<script>const t = document.getElementById("t"); t.firstChild.data = "【更新】" + t.firstChild.data;</script>` }), { errors: ["T03", "T13"], max_errors: { T03: 1, T13: 1 } });

// RC-03 ②：选择器相同（超过 4 层）的两个段落，一个在源码里，一个由脚本插入，都用了半角逗号 → 两个都要报
const deep = (text) => `<section><div><div><div><p>${text}</p></div></div></div></section>`;
add("C-RC03-dup-deep", page({ body: `<div id="box">${deep("源码里的段落,半角逗号。")}</div>\n<script>document.getElementById("box").insertAdjacentHTML("beforeend", ${JSON.stringify(deep("脚本插入的段落,也有半角逗号。"))});</script>` }), { errors: ["T03"], min_errors: { T03: 2 }, message_has: { T03: "脚本插入的段落" } });

for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
writeFileSync(join(dir, "expect.json"), JSON.stringify(E, null, 2) + "\n");
console.log(`生成 ${Object.keys(F).length} 个夹具`);
