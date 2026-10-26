// W2 C20 夹具：measure.css 改为 @layer measure 之后的行为。在修改 measure.css 之前写好并锁定。
// 这些页面都通过 <link href="measure.css"> 引入真实的 measure.css；测试时把 packages/cli/assets/measure.css 复制到同一目录。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const LONG = "这一段正文足够长，用来模拟会折行的多行正文，长度超过三十个汉字，确保它是真正的段落而不是单行说明。";
const page = ({ lang = "zh-CN", head = "", body }) => `<!doctype html>
<html lang="${lang}">
<head><meta charset="utf-8"><title>C20 夹具</title>
<link rel="stylesheet" href="measure.css">
<style>
body { font-family: "Inter", "PingFang SC", "Noto Sans SC", sans-serif; font-size: 16px; }
${head}
</style></head>
<body><main class="measure-prose">
${body}
</main></body>
</html>
`;
const F = {
  // Tailwind v4 的工具类放在 @layer utilities 里：引入 measure.css 后，用户写的 leading-tight 必须生效（不能被 measure.css 盖掉），所以校验器应如实报 T06
  "C20-tw4-utility-not-overridden": page({ head: "@layer theme, base, components, utilities;\n@layer utilities { .leading-tight { line-height: 1.25; } }", body: `<p class="leading-tight">${LONG}</p>` }),
  // 中英混排：<html lang="en"> 里的中文片段，measure.css 的 line-break: strict 也要生效
  "C20-mixed-lang-line-break": page({ lang: "en", body: `<section lang="zh-CN"><p>${LONG}</p></section>` }),
  // 对照：用户不分层的样式照常优先
  "C20-unlayered-user-wins": page({ head: "p { line-height: 1.7; }", body: `<p>${LONG}</p>` }),
  // 对照：只引入 measure.css 的普通页面零 error
  "C20-measure-only": page({ body: `<h1>标题</h1>\n<p>${LONG}</p>` })
};
for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
console.log(`已生成 ${Object.keys(F).length} 个 C20 夹具`);
