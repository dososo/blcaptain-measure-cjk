// W2 card 命令的夹具：在实现之前写好，生成后用 MANIFEST.sha256 锁定。
// 每张卡片 1080×1440；字体由测试在临时目录的 font_dir 里用代码生成（方框字体，D-C5），仓库里不放字体文件。
// expect.json 记录每页的预期：status = exported / rejected；font = 测试要往 font_dir 里放的字体
// （family：name 表里的家族名；cover：all = 覆盖页面全部字符，partial = 只覆盖一部分）；
// 其余字段见测试文件 test/card.test.js。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const card = ({ stack, body, extraHead = "" }) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>卡片夹具</title>
${extraHead}<style>
:where(:lang(zh)) { line-break: strict; font-synthesis-style: none; text-autospace: normal; }
html, body { margin: 0; }
body { width: 1080px; height: 1440px; overflow: hidden; background: #f4efe6; color: #1f1f1f; font-family: ${stack}; }
.card { box-sizing: border-box; width: 1080px; height: 1440px; padding: 120px 96px; }
h1 { font-size: 72px; line-height: 1.3; margin: 0 0 48px; font-weight: 400; }
p { font-size: 36px; line-height: 1.75; margin: 0 0 24px; }
</style>
</head>
<body>
<div class="card">
${body}
</div>
</body>
</html>
`;
const TEXT = `<h1>分寸是排版的底线</h1>\n<p>每行二十多个字，行高一点七五，标点不在行首。</p>\n<p>字体只用可以商用出图的那几款。</p>`;
const F = {};
const E = {};
const add = (name, html, expect) => {
  F[name] = html;
  E[name] = expect;
};

// 🟢 字体，覆盖全部字符 → 导出 1080×1440 的 PNG，没有署名提示
add("K-pass", card({ stack: `"Noto Sans SC", sans-serif`, body: TEXT }), { status: "exported", font: { family: "Noto Sans SC", cover: "all" }, attribution: [] });
// 🔵 MiSans（要求署名）→ 导出，并附署名提示（AC-9）
add("K-pass-misans", card({ stack: `"MiSans", sans-serif`, body: TEXT }), { status: "exported", font: { family: "MiSans", cover: "all" }, attribution: ["MiSans"] });
// 🔴 方正兰亭黑放在 font_dir 里 → 不加载，拒绝出图，原因里带官方原文链接
add("K-red", card({ stack: `"方正兰亭黑", sans-serif`, body: TEXT }), { status: "rejected", font: { family: "方正兰亭黑", cover: "all" }, rejected_font: "方正兰亭黑", reason_has: "foundertype.com" });
// 微软雅黑放进 font_dir → 拒绝（F06：只能从系统字体目录调用）
add("K-yahei", card({ stack: `"Microsoft YaHei", sans-serif`, body: TEXT }), { status: "rejected", font: { family: "Microsoft YaHei", cover: "all" }, rejected_font: "Microsoft YaHei", reason_has: "系统字体目录" });
// 授权表里查不到的字体 → 拒绝（F-UNKNOWN）
add("K-unknown", card({ stack: `"Fake Display", "Noto Sans SC", sans-serif`, body: TEXT }), { status: "rejected", font: { family: "Fake Display", cover: "all" }, rejected_font: "Fake Display", reason_has: "F-UNKNOWN" });
// 🟢 字体只覆盖一部分字符 → 缺的字回退到系统字体；系统字体不能出图时拒绝（D-C1）
add("K-fallback", card({ stack: `"Noto Sans SC", sans-serif`, body: TEXT }), { status: "rejected", font: { family: "Noto Sans SC", cover: "partial" }, system_fallback: true });
// 页面自己用 @font-face 引用 font_dir 以外的字体文件 → 拦截，不加载
add("K-page-fontface", card({ stack: `"Own Font", sans-serif`, body: TEXT, extraHead: `<style>@font-face { font-family: "Own Font"; src: url("own.ttf"); }</style>\n` }), { status: "rejected", font: null, own_font_file: "own.ttf", blocked_font: "own.ttf" });
// 字体合规，但卡片有 lint error（半角逗号 T03）→ 不导出（D-C2）
add("K-lint-error", card({ stack: `"Noto Sans SC", sans-serif`, body: `<h1>分寸是排版的底线</h1>\n<p>这里用了半角逗号,应该报错。</p>` }), { status: "rejected", font: { family: "Noto Sans SC", cover: "all" }, lint_errors: ["T03"] });

for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
writeFileSync(join(dir, "expect.json"), JSON.stringify(E, null, 2) + "\n");
console.log(`生成 ${Object.keys(F).length} 个夹具`);
