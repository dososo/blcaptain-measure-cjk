// AUDIT_RENDER_r8（RH-01）的复现夹具：作为回归测试补写（行为已经正确），生成后用 MANIFEST.sha256 锁定。
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
<title>第 8 轮复核回归夹具</title>
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

// RH-01：同身份的导航在不同宽度下轮流可见：宽屏只显示页头，窄屏只显示抽屉（11px）。完整档在窄屏实测必须报出 3 条 T11
const NAV = `<nav><ul><li><a href="#">首页</a></li><li><a href="#">产品介绍</a></li><li><a href="#">联系我们</a></li></ul></nav>`;
add("H-RH01-drawer-alt", page(`<header>${NAV}</header>\n<aside class="m">${NAV}</aside>\n<main><p>正文的中文段落。</p></main>`, "header { display: none; } .m a { font-size: 11px; } @media (min-width: 768px) { header { display: block; } .m { display: none; } }"), { status: "fail", errors: ["T11"], min_errors: { T11: 3 } });

for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
writeFileSync(join(dir, "expect.json"), JSON.stringify(E, null, 2) + "\n");
console.log(`生成 ${Object.keys(F).length} 个夹具`);
