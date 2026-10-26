// 生成展示页 site/index.html：内容全部来自 site/showcase.json（由 bench/showcase-build.mjs 从实验结果和截图生成），不手填数字。
// 视觉按 dososo-design-system：米纸、墨、青瓷、朱砂；字号越大字重越轻；留白优先。页面本身要过 measure-cjk lint --render 零 error。
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const site = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(site, "showcase.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pText = (p) => (p === null || p === undefined ? "—" : p < 0.0001 ? "p < 0.0001" : `p = ${p.toFixed(4)}`);
const px = (v) => (v === null || v === undefined ? "—" : `${Math.round(v * 10) / 10}px`);
const RULE_NAME = { T03: "标点", T05: "行长", T06: "行高", T07: "字距为负", T08: "斜体", T11: "字号太小", T13: "字体栈" };

const numbers = Object.values(data.numbers)
  .map(
    (n) => `<div class="agent">
<h3>${esc(n.label)}</h3>
<p class="model">模型 ${esc(n.model)}</p>
<dl>
<div><dt>零 error 页面（全部规则）</dt><dd><span class="from">${n.all.control}/${n.all.n}</span><span class="arrow" aria-hidden="true">→</span><span class="to">${n.all.measure}/${n.all.n}</span></dd></div>
<div><dt>零 error 页面（排除 T02、T04）</dt><dd><span class="from">${n.excl.control}/${n.excl.n}</span><span class="arrow" aria-hidden="true">→</span><span class="to">${n.excl.measure}/${n.excl.n}</span></dd></div>
<div><dt>同一条提示词逐条比（排除 T02、T04）</dt><dd class="paired">更好 ${n.paired_excl.better}，一样 ${n.paired_excl.same}，更差 ${n.paired_excl.worse}；${pText(n.paired_excl.p)}</dd></div>
</dl>
</div>`
  )
  .join("\n");

const demos = data.demos
  .map(
    (d) => `<article class="demo${d.width > 700 ? " wide" : ""}">
<h3><span class="rule">${esc(d.rule)}</span>${esc(d.title)}</h3>
<p>${esc(d.why)}</p>
<div class="pair">
<figure><img src="${esc(d.off)}" alt="${esc(d.rule)} 示意：不按规则写的版本" loading="lazy"><figcaption>关</figcaption></figure>
<figure><img src="${esc(d.on)}" alt="${esc(d.rule)} 示意：按 measure 写的版本" loading="lazy"><figcaption>开</figcaption></figure>
</div>
</article>`
  )
  .join("\n");

// 主题缺风格或适合场景时直接报错退出，不让展示页出现 undefined（AUDIT_RELEASE RA-02）
for (const t of data.themes ?? []) {
  if (!t.style || !t.fit) {
    console.error(`主题 ${t.id} 缺少 style 或 fit：先运行 node site/themes/_gen.mjs，再运行 node bench/showcase-build.mjs`);
    process.exit(1);
  }
}
const themes = (data.themes ?? [])
  .map(
    (t) => `<article class="theme">
<a href="${esc(t.demo)}"><img src="${esc(t.screenshot)}" alt="${esc(t.name_zh)}主题的示例页截图" loading="lazy"></a>
<h3>${esc(t.name_zh)} <span class="en">${esc(t.name_en)}</span>${t.traditional ? '<span class="tag">传统风</span>' : ""}</h3>
<p>${esc(t.style.replaceAll("`", ""))}</p>
<p class="fit">适合：${esc(t.fit.replaceAll("`", ""))}</p>
<p class="fit">示例页 lint：0 error${t.lint_warns.length ? `，${t.lint_warns.length} 条 warn（${esc([...new Set(t.lint_warns)].join("、"))}，主题文件里写明了原因）` : ""}。<a href="${esc(t.demo)}">打开示例页</a></p>
</article>`
  )
  .join("\n");
const pct = (r) => `${Math.round(r * 1000) / 10}%`;
const reals = data.pairs
  .map((p) => {
    const counts = Object.entries(p.control.counts)
      .sort((a, b) => b[1] - a[1])
      .map(([r, n]) => `${r}${RULE_NAME[r] ? `（${RULE_NAME[r]}）` : ""} ${n} 处`)
      .join("、");
    const size = (side) => (side.min_cjk_ratio !== undefined ? `最小中文字号 ${px(side.min_cjk_px)}，占卡片宽度 ${pct(side.min_cjk_ratio)}` : `最小中文字号 ${px(side.min_cjk_px)}`);
    return `<article class="real${p.view === "card" ? " narrow" : ""}">
<h3>${esc(p.kind)} · ${esc(p.agent_label)}</h3>
<p class="prompt">提示词：${esc(p.prompt)}</p>
<div class="pair">
<figure><img src="${esc(p.control.image)}" alt="${esc(p.kind)}，不装 measure 时生成。红框标出 ${p.control.marks_in_image} 处 lint 查到的问题，标签是规则编号和这张截图里量到的值" loading="lazy"><figcaption>不装 measure${p.control.clip_top > 0 ? `（截的是页面往下 ${Math.round(p.control.clip_top)}px 处）` : ""}：${p.control.errors_shown} 处（${esc(counts)}），${size(p.control)}</figcaption></figure>
<figure><img src="${esc(p.measure.image)}" alt="${esc(p.kind)}，装了 measure 后生成的同一条提示词的页面" loading="lazy"><figcaption>装了 measure：${p.measure.errors_shown} 处，${size(p.measure)}</figcaption></figure>
</div>
</article>`;
  })
  .join("\n");
const ranks = data.pairs.map((p) => `${p.kind}（${p.agent_label}）排第 ${p.rank_by_control_errors}`).join("，");
const failing = Object.entries(data.still_failing)
  .map(([a, list]) => `${a === "codex" ? "Codex" : "Claude Code"} ${list.length} 页${list.length ? `（${list.map((x) => `${x.id}：${x.control} → ${x.measure} 处，${x.rules.join("、")}`).join("；")}）` : ""}`)
  .join("；");

const n = Object.values(data.numbers);
// 卡片口径的敏感性（AUDIT_SHOWCASE_r2 R2-01）：只写受影响的 Agent
const cardNote = Object.entries(data.card_sensitivity)
  .filter(([, c]) => c.affected_pages > 0)
  .map(([a, c]) => `${a === "codex" ? "Codex" : "Claude Code"} 不装 measure 的 30 页里有 ${c.affected_pages} 页小红书卡片，排除 T02、T04 后只剩“字号太小”（T11）。T11 按浏览器里的像素判断卡片，口径有问题，正在修：卡片按导出尺寸换算后，这几页可能不算违规。如果不算，这一行会变成 ${c.zero_error_control}/30 → ${c.zero_error_measure}/30，逐条比更好 ${c.better}、一样 ${c.same}、更差 ${c.worse}，${pText(c.p)}，${c.p !== null && c.p < 0.05 ? "仍然显著" : "不再显著"}。卡片的导出尺寸是假设，这只是估算。`)
  .join("<br>");
const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>分寸 · Measure：让 AI 写的中文页面排得有分寸</title>
<meta name="description" content="给 Claude Code、Codex 这类编码 Agent 用的中文排版 skill 和校验器。">
<style>
:where(:lang(zh)) { line-break: strict; text-autospace: normal; font-synthesis-style: none; }
:root {
  --paper: #f4e9dc;
  --paper-deep: #ebdccb;
  --ink: #1f1b16;
  --ink-soft: #5a5148;
  --celadon: #7e8c6b;
  --cinnabar: #9e4b3b;
  --line: #d8c7b2;
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: var(--paper); color: var(--ink); font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 17px; line-height: 1.8; }
main { max-width: 1120px; margin: 0 auto; padding: 0 24px 120px; }
p, li, dd, dt, figcaption { max-width: 36em; }
header.hero { padding: 120px 0 72px; }
.eyebrow { font-size: 14px; letter-spacing: 0.08em; color: var(--celadon); margin: 0 0 24px; }
h1 { font-size: 48px; line-height: 1.35; font-weight: 300; margin: 0 0 32px; }
h1 em { font-style: normal; color: var(--cinnabar); }
.lede { font-size: 19px; color: var(--ink-soft); margin: 0; }
section { padding: 72px 0 0; border-top: 1px solid var(--line); margin-top: 72px; }
h2 { font-size: 32px; line-height: 1.4; font-weight: 300; margin: 0 0 24px; }
h3 { font-size: 20px; line-height: 1.5; font-weight: 500; margin: 0 0 12px; }
section > p { color: var(--ink-soft); margin: 0 0 16px; }
.numbers { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px; margin: 40px 0 24px; }
.agent { background: var(--paper-deep); padding: 32px; }
.agent dl { margin: 0; }
.agent dl > div { padding: 16px 0; border-top: 1px solid var(--line); }
.agent dt { font-size: 14px; color: var(--ink-soft); line-height: 1.6; }
.agent dd { margin: 4px 0 0; font-size: 28px; font-weight: 300; line-height: 1.5; }
.agent dd.paired { font-size: 17px; font-weight: 400; line-height: 1.7; }
.from { color: var(--ink-soft); }
.arrow { color: var(--line); margin: 0 12px; }
.to { color: var(--cinnabar); }
.fine { font-size: 15px; color: var(--ink-soft); line-height: 1.75; padding-left: 1.2em; margin: 0; }
.fine li { margin: 4px 0; }
.demo, .real { margin: 56px 0 0; }
.rule { display: inline-block; font-size: 14px; font-weight: 500; color: var(--paper); background: var(--celadon); padding: 0 8px; margin-right: 12px; line-height: 1.8; vertical-align: 2px; }
.demo > p, .real > p { color: var(--ink-soft); margin: 0 0 20px; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.wide .pair, .real .pair { grid-template-columns: 1fr; gap: 32px; }
.real.narrow .pair { grid-template-columns: 1fr 1fr; gap: 20px; }
.model { font-size: 14px; color: var(--ink-soft); margin: -8px 0 8px; }
figure { margin: 0; }
figure img { display: block; width: 100%; height: auto; border: 1px solid var(--line); }
figcaption { font-size: 14px; color: var(--ink-soft); line-height: 1.7; margin-top: 8px; }
.prompt { font-size: 15px; }
.themes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; margin-top: 40px; }
.theme img { display: block; width: 100%; height: auto; border: 1px solid var(--line); }
.theme h3 { margin: 16px 0 4px; }
.theme p { font-size: 15px; color: var(--ink-soft); line-height: 1.75; margin: 0 0 6px; }
.theme .fit { font-size: 14px; }
.en { font-size: 15px; font-weight: 400; color: var(--ink-soft); }
.tag { display: inline-block; font-size: 13px; color: var(--cinnabar); border: 1px solid var(--cinnabar); padding: 0 6px; margin-left: 8px; line-height: 1.6; vertical-align: 2px; }
code { font-family: Menlo, "SF Mono", monospace, "Noto Sans SC"; font-size: 15px; background: var(--paper-deep); padding: 1px 6px; }
footer { margin-top: 96px; padding-top: 32px; border-top: 1px solid var(--line); font-size: 14px; color: var(--ink-soft); line-height: 1.75; }
footer p { margin: 0 0 8px; }
a { color: var(--cinnabar); }
@media (max-width: 760px) {
  header.hero { padding: 72px 0 48px; }
  h1 { font-size: 34px; }
  h2 { font-size: 26px; }
  .pair { grid-template-columns: 1fr; }
  .agent { padding: 24px; }
  .real.narrow .pair { grid-template-columns: 1fr; }
  .themes { grid-template-columns: 1fr; }
}
@media (min-width: 761px) and (max-width: 1024px) {
  .themes { grid-template-columns: 1fr 1fr; }
}
</style>
</head>
<body>
<main>
<header class="hero">
<p class="eyebrow">分寸 · Measure</p>
<h1>让 AI 写的中文页面，<br>排得<em>有分寸</em>。</h1>
<p class="lede">给 Claude Code、Codex 这类编码 Agent 用的中文排版 skill，加一个离线校验器 <code>measure-cjk</code>：查字号、字距、行长、行高、标点和字体授权，并用浏览器实测。</p>
</header>

<section aria-labelledby="numbers">
<h2 id="numbers">装上之后，差别有多大</h2>
<p>同一个 Agent、同一个模型，30 条中文页面提示词，装和不装 measure 各生成一次，用 measure 的完整档检查。</p>
<div class="numbers">
${numbers}
</div>
<ul class="fine">
<li>评分用的是 measure 自己的校验器，衡量的是“遵守 measure 规则”的程度，不是独立的审美评价。</li>
<li>T02（中英文间距）、T04（行首禁则）是本项目定的规则，AI 默认几乎不写，所以同时给出排除这两条之后的数字。</li>
<li>30 条提示词由本项目编写，每条只跑一次；装 measure 的一组里，真正跑过校验器的：Codex ${n[0]?.used_lint ?? "—"}/30，Claude Code ${n[1]?.used_lint ?? "—"}/30。</li>
<li>${cardNote}</li>
<li>完整的方法、数据和独立审计见仓库里的 <code>docs/verification/w2/northstar/</code>。</li>
</ul>
</section>

<section aria-labelledby="rules">
<h2 id="rules">规则示意</h2>
<p><strong>以下是示意，不是实验结果：</strong>同一段文字，“关”只差一条规则，“开”是按 measure 改好的版本。两版都用 <code>measure-cjk lint --render</code> 检查过：“关”只报这一条规则，“开”零 error。“关”的程度按实验里真实页面的情况设，不故意做得更差。</p>
<p>没有做示意的规则：T01（声明中文 lang）和 T13（字体栈里要有中文字体）的效果取决于浏览器和系统字体，一张图说明不了；T04（行首禁则）在 Chrome 里开不开，常用中文标点都不会落到行首，看不出差别。</p>
${demos}
</section>

<section aria-labelledby="real">
<h2 id="real">真实页面：同一条提示词，装之前和装之后</h2>
<p>每组第一张是不装 measure 时 Agent 生成的页面，红框是完整档查到的问题，标签是规则编号和在这张截图里当场量到的值；第二张是装了 measure 后，同一条提示词生成的页面。截图窗口都是 1280px 宽：第一张截红框所在的位置（多数就在首屏），第二张截首屏。</p>
<ul class="fine">
<li>计数不含 T02、T04（本项目自定的规则），也不含 T06：它对单行元素的判定有误报，正在修，红框里也没有标它。</li>
<li>图注里的数字是整页的问题数；红框只画在截图范围内、而且 lint 给出了位置的问题（同一条规则 lint 最多列出 20 处的位置），所以框数会比图注里的数字少。</li>
<li>怎么挑的：每个 Agent 各挑两组，偏向问题多、看得出差别的页面。按不装 measure 时的 error 数，这几组在各自 30 页里分别是：${esc(ranks)}。Claude Code 不装 measure 时，排除 T02、T04 后本来就有一半页面零 error。</li>
<li>装了 measure 之后仍报 error 的页面：${esc(failing)}。</li>
</ul>
${reals}
</section>

<section aria-labelledby="themes">
<h2 id="themes">6 个主题</h2>
<p>每个主题一个文件（不超过 8 KB）：设计变量、字号阶梯（字号越大字重越轻）、字体栈、该做和不该做。6 个示例页用同一段文字，CSS 原样取自主题文件，都用 <code>measure-cjk lint --render</code> 检查过。</p>
<div class="themes">
${themes}
</div>
</section>

<section aria-labelledby="install">
<h2 id="install">怎么用</h2>
<p>校验器单独发布在 npm 上，skill 按你用的 Agent 安装：</p>
<ul class="fine">
<li>校验器：<code>npm install -g measure-cjk</code></li>
<li>Claude Code：<code>/plugin marketplace add dososo/blcaptain-measure-cjk</code>，再 <code>/plugin install measure@blcaptain-measure-cjk</code></li>
<li>Codex：<code>codex plugin marketplace add dososo/blcaptain-measure-cjk</code>，再 <code>codex plugin add measure@blcaptain-measure-cjk</code></li>
<li>其他 Agent：<code>npx skills add dososo/blcaptain-measure-cjk</code></li>
</ul>
<p>源码、规则文档和实验数据在 <a href="https://github.com/dososo/blcaptain-measure-cjk">GitHub</a>。</p>
</section>

<footer>
<p>截图里的中文统一用思源黑体、思源宋体，emoji 和符号用 Noto Color Emoji、Noto Sans Symbols 2 渲染（都是 OFL-1.1）；页面原本点名的英文字体照常显示。每张截图都逐个元素核对过实际用到的字体，没有系统中文字体，也没有系统 emoji 和符号字体。</p>
<p>实验：measure v0.1.0，2026 年 10 月 26 日；Codex 用 gpt-6-astra，Claude Code 用 claude-opus-5-5；配对比较用双侧符号检验。</p>
<p>代码 Apache-2.0；字体授权数据 CC BY 4.0，不是法律意见。</p>
</footer>
</main>
</body>
</html>
`;
const tmp = join(site, `index.html.${process.pid}.tmp`);
writeFileSync(tmp, html);
renameSync(tmp, join(site, "index.html"));
console.log("已生成 site/index.html");
