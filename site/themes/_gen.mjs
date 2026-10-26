// 6 个主题的示例页（PRD §5.3）：每个主题的 CSS 只写在 skills/measure/references/themes/<id>.md 里（唯一来源），
// 这里把它原样取出来，和 measure.css、同一段示例文字拼成 site/themes/<id>.html，再写 themes.json（PRD §7.3 ThemeMeta）。
// 示例页要过 measure-cjk lint --render 零 error（bench/showcase-build.mjs 验证并截图）。
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const site = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(site, "..");
const dir = join(repo, "skills", "measure", "references", "themes");
const ORDER = ["broadsheet", "manual", "archive", "quarterly", "songke", "dososo"];
const measureCss = readFileSync(join(repo, "skills", "measure", "assets", "measure.css"), "utf8");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const SAMPLE = `<main class="page">
<p class="kicker">分寸 · 第 12 期</p>
<h1>行长、行高和字距，决定一页中文读起来累不累</h1>
<p class="lead">AI 写出来的中文页面，大面上已经不差，差在细节：小字太小、字距太紧、中英文挤在一起、标点跑到行首。这些问题不显眼，读久了却很累。</p>
<p class="meta">文：分寸编辑部　2026 年 10 月 26 日　编号 MZ-2026-012</p>
<section class="body">
<h2>1　行长</h2>
<p>中文正文每行 28 到 40 个字最舒服。宽屏上的正文不限宽，一行就会拉到五六十个字，读到行尾再回到下一行行首，眼睛要扫过大半个屏幕，很容易串行。</p>
<h2>2　行高</h2>
<p>汉字是方块字，字面几乎撑满整个字身，行与行之间需要比西文更多的留白。正文行高 1.6 到 1.9 之间比较合适，标题可以收紧到 1.3 左右。</p>
<blockquote><p>好的排版不会让你注意到它的存在，你只是觉得这篇文章读起来很顺。</p></blockquote>
<h2>3　字距和标点</h2>
<ol>
<li>中文不要用负字距，<em>笔画会碰在一起</em>。</li>
<li>中英文、数字之间留出约四分之一个字的空隙，用 CSS 的 text-autospace 自动处理。</li>
<li>中文句子用全角标点，引号用 “”。</li>
</ol>
<p class="note">注：本页按 measure 的规则排版，可以用 measure-cjk lint --render 检查。</p>
</section>
</main>`;

const meta = [];
for (const id of ORDER) {
  const file = join(dir, `${id}.md`);
  const md = readFileSync(file, "utf8");
  const title = md.match(/^# (.+)$/m)[1].trim();
  const [nameZh, ...en] = title.split(" ");
  const css = md.match(/```css\n([\s\S]*?)```/)?.[1];
  if (!css) throw new Error(`${id}.md 里没有 css 代码块`);
  const traditional = /^- 传统风：是/m.test(md);
  const style = md.match(/^- 风格：(.+)$/m)?.[1].trim() ?? "";
  const fit = md.match(/^- 适合：(.+)$/m)?.[1].trim() ?? "";
  // 字体栈：主题变量里声明的全部字体名（不含通用字族）
  const fonts = [...new Set([...css.matchAll(/--(?:serif|sans|song|fangsong|mono):\s*([^;]+);/g)].flatMap((m) => m[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""))).filter((n) => n && !/^(serif|sans-serif|monospace|system-ui)$/.test(n)))];
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(nameZh)} ${esc(en.join(" "))} · 分寸 Measure 主题示例</title>
<style>
${measureCss}
</style>
<style>
${css}</style>
</head>
<body>
${SAMPLE}
</body>
</html>
`;
  writeFileSync(join(site, "themes", `${id}.html`), html);
  meta.push({ id, name_zh: nameZh, name_en: en.join(" "), style, fit, traditional, size_bytes: statSync(file).size, fonts, file: `skills/measure/references/themes/${id}.md`, demo: `themes/${id}.html`, screenshot: `shots/theme-${id}.jpg` });
}
const extra = readdirSync(dir).filter((f) => f.endsWith(".md") && !ORDER.includes(f.replace(/\.md$/, "")));
if (extra.length) throw new Error(`themes 目录里有没登记的主题：${extra.join("、")}`);
writeFileSync(join(site, "themes", "themes.json"), JSON.stringify(meta, null, 2) + "\n");
console.log(`生成 ${meta.length} 个主题示例页；传统风 ${meta.filter((m) => m.traditional).length} 个；最大的主题文件 ${Math.max(...meta.map((m) => m.size_bytes))} 字节`);
