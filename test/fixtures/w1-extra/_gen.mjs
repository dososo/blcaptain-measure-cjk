// W1 补充夹具（主夹具锁定之后新增，不修改任何已锁定文件）。
// 来源：基线冒烟测试发现两处缺陷——基础档不展开 var()（T13 误报），以及把所有 @media 都当作生效。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const BASE = `:where(:root:lang(zh)) { line-break: strict; }
:where(:lang(zh)) { font-synthesis-style: none; }
:where(:lang(zh)) :where(p, li) { line-height: 1.75; }
.measure-prose { max-width: 36em; }
@supports (text-autospace: normal) { :where(:lang(zh)) { text-autospace: normal; } }`;
const page = (css) => `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>变量夹具</title><style>
${BASE}
${css}
</style></head>
<body><main class="measure-prose"><h1>变量夹具</h1><p>这一段正文用来检查 CSS 自定义属性能否被正确展开，长度足够触发行长估算。</p></main></body>
</html>
`;

const F = {
  "T13-pos-var-stack": `:root { --sans: "Inter", "PingFang SC", "Noto Sans SC", sans-serif; } body { font-family: var(--sans); font-size: 16px; }`,
  "T13-pos-var-fallback": `body { font-family: var(--not-defined, "Inter", "PingFang SC", sans-serif); font-size: 16px; }`,
  "T13-pos-var-nested": `:root { --cjk: "Noto Sans SC"; --sans: "Inter", var(--cjk), sans-serif; } body { font-family: var(--sans); font-size: 16px; }`,
  "T13-neg-var-latin-only": `:root { --sans: "Inter", "Helvetica Neue", sans-serif; } body { font-family: var(--sans); font-size: 16px; }`,
  "T13-skip-var-unresolved": `body { font-family: var(--nowhere); font-size: 16px; }`,
  "T06-neg-var-line-height": `:root { --lh: 1.2; } body { font-family: "PingFang SC", sans-serif; font-size: 16px; } p { line-height: var(--lh); }`,
  "T07-neg-var-letter-spacing": `:root { --tight: -0.03em; } body { font-family: "PingFang SC", sans-serif; font-size: 16px; } h1 { letter-spacing: var(--tight); }`,
  "T11-neg-var-font-size": `:root { --tiny: 11px; } body { font-family: "PingFang SC", sans-serif; font-size: 16px; } p { font-size: var(--tiny); }`,
  // 第二批（同样来自基线冒烟测试）：基础档原来把所有 @media 都当作生效，现在在桌面 1280px 和窄屏 390px 下分别求值
  "T11-neg-media-narrow-only": `body { font-family: "PingFang SC", sans-serif; font-size: 16px; } h1 { font-size: 28px; } @media (max-width: 600px) { h1 { font-size: 10px; } }`,
  "T11-pos-media-print-only": `body { font-family: "PingFang SC", sans-serif; font-size: 16px; } @media print { p { font-size: 9px; } }`,
  "T06-pos-media-desktop-override": `body { font-family: "PingFang SC", sans-serif; font-size: 16px; } @media (min-width: 2000px) { p { line-height: 1.1; } }`
};
for (const [name, css] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), page(css));
console.log(`已生成 ${Object.keys(F).length} 个补充夹具`);
