// 生成 test/fixtures/bad/ 下的规则夹具。在实现规则之前写好，生成后用 MANIFEST.sha256 锁定。
// 命名：<规则ID>-neg-<说明>.html 必须命中该规则；<规则ID>-pos-<说明>.html 必须整页零 error。
// 同名 .config.json 存在时，测试用它作为 lint 配置。
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "bad");
mkdirSync(join(dir, "assets"), { recursive: true });

const AUTOSPACE = `@supports (text-autospace: normal) { :where(:lang(zh)) { text-autospace: normal; } }`;
const LINEBREAK = `:where(:root:lang(zh)) { line-break: strict; }`;
const SYNTH = `:where(:lang(zh)) { font-synthesis-style: none; text-emphasis-position: under right; }`;
const LH = `:where(:lang(zh)) :where(p, li) { line-height: 1.75; }`;
const FONT = `body { font-family: "Inter", "PingFang SC", "Noto Sans SC", sans-serif; font-size: 16px; }`;
const PROSE = `.measure-prose { max-width: 36em; }`;

function page({ lang = "zh-CN", css, body, head = "" }) {
  const langAttr = lang === null ? "" : ` lang="${lang}"`;
  return `<!doctype html>
<html${langAttr}>
<head>
<meta charset="utf-8">
<title>规则夹具</title>
${head}<style>
${css}
</style>
</head>
<body>
<main class="measure-prose">
${body}
</main>
</body>
</html>
`;
}

function css(overrides = {}) {
  const parts = {
    linebreak: LINEBREAK, synth: SYNTH, lh: LH, prose: PROSE, autospace: AUTOSPACE, font: FONT,
    ...overrides
  };
  return Object.values(parts).filter(Boolean).join("\n");
}

const P = `<h1>分寸夹具</h1>
<p>这是一段用于测试的正文，包含 English 单词和数字 2026，用来检查中文排版规则。</p>`;

const F = {};

// T01：lang
F["T01-neg-no-lang"] = page({ lang: null, css: css(), body: P });
F["T01-neg-lang-en"] = page({ lang: "en", css: css(), body: P });
F["T01-pos-zh-cn"] = page({ css: css(), body: P });
F["T01-pos-zh-hant-tw"] = page({ lang: "zh-Hant-TW", css: css({ font: `body { font-family: "Inter", "PingFang TC", "Noto Sans TC", sans-serif; font-size: 16px; }` }), body: `<h1>分寸夾具</h1>\n<p>這是一段用於測試的正文，包含 English 單字和數字 2026。</p>` });

// T02：中英文间距
F["T02-neg-no-autospace"] = page({ css: css({ autospace: "" }), body: P });
F["T02-neg-autospace-off"] = page({ css: css({ extra: `p { text-autospace: no-autospace; }` }), body: P });
F["T02-neg-text-mode-tight"] = page({ css: css(), body: `<h1>分寸夹具</h1>\n<p>这段话里的English和数字2026都紧贴着汉字。</p>` });
F["T02-pos-base"] = page({ css: css(), body: P });
F["T02-pos-linked-css"] = page({ css: css({ autospace: "", linebreak: "", synth: "", lh: "" }), head: `<link rel="stylesheet" href="assets/measure-copy.css">\n`, body: P });
F["T02-pos-text-mode-spaced"] = page({ css: css(), body: P });

// T03：标点
F["T03-neg-halfwidth-comma"] = page({ css: css(), body: `<h1>分寸夹具</h1>\n<p>今天天气很好,我们去公园散步吧;顺便买点水果.</p>` });
F["T03-neg-corner-quotes-in-curly-mode"] = page({ css: css(), body: `<h1>分寸夹具</h1>\n<p>他说「明天见」，然后就走了。</p>` });
F["T03-pos-fullwidth"] = page({ css: css(), body: `<h1>分寸夹具</h1>\n<p>今天天气很好，我们去公园散步吧；顺便买点水果。他说“明天见”。</p>` });
F["T03-pos-english-sentence"] = page({ css: css(), body: `<h1>分寸夹具</h1>\n<p>引用一句英文：Hello, world. 版本号是 1.0.2，比例是 3:2。</p>` });

// T04：行首禁则
F["T04-neg-no-line-break"] = page({ css: css({ linebreak: "" }), body: P });
F["T04-neg-overridden-normal"] = page({ css: css({ extra: `body { line-break: normal; }` }), body: P });
F["T04-pos-base"] = page({ css: css(), body: P });
F["T04-pos-html-strict"] = page({ css: css({ linebreak: `html { line-break: strict; }` }), body: P });

// T05：行长（基础档只报 warn）
F["T05-neg-wide-max-width"] = page({ css: css({ prose: `.measure-prose { max-width: 60em; }` }), body: P });
F["T05-neg-no-max-width"] = page({ css: css({ prose: "" }), body: P });
F["T05-pos-36em"] = page({ css: css(), body: P });
F["T05-pos-600px"] = page({ css: css({ prose: `.measure-prose { max-width: 600px; }` }), body: P });

// T06：行高
F["T06-neg-tight-number"] = page({ css: css({ extra: `p { line-height: 1.2; }` }), body: P });
F["T06-neg-tight-px"] = page({ css: css({ lh: "", extra: `p { line-height: 20px; }` }), body: P });
F["T06-pos-base"] = page({ css: css(), body: P });
F["T06-pos-px-ok"] = page({ css: css({ lh: "", extra: `p { line-height: 28px; }` }), body: P });

// T07：负字距
F["T07-neg-negative-letter-spacing"] = page({ css: css({ extra: `h1 { letter-spacing: -0.02em; }` }), body: P });
F["T07-neg-tracking-tight-class"] = page({ css: css(), body: `<h1 class="tracking-tight">分寸夹具</h1>\n<p>这是一段用于测试的正文。</p>` });
F["T07-pos-positive"] = page({ css: css({ extra: `h1 { letter-spacing: 0.05em; }` }), body: P });
F["T07-pos-tight-on-latin-only"] = page({ css: css(), body: `<h1>分寸夹具</h1>\n<p>这是一段用于测试的正文。</p>\n<p><span class="tracking-tight">Measure</span></p>` });

// T08：斜体
F["T08-neg-italic-paragraph"] = page({ css: css({ extra: `p { font-style: italic; }` }), body: P });
F["T08-neg-em-without-synthesis-off"] = page({ css: css({ synth: "" }), body: `<h1>分寸夹具</h1>\n<p>这里有一个<em>需要强调</em>的词。</p>` });
F["T08-pos-em-with-synthesis-off"] = page({ css: css(), body: `<h1>分寸夹具</h1>\n<p>这里有一个<em>需要强调</em>的词。</p>` });
F["T08-pos-em-normal"] = page({ css: css({ synth: "", extra: `em { font-style: normal; font-weight: 600; }` }), body: `<h1>分寸夹具</h1>\n<p>这里有一个<em>需要强调</em>的词。</p>` });

// T09：text-transform / small-caps（warn）
F["T09-neg-uppercase-cjk"] = page({ css: css({ extra: `h1 { text-transform: uppercase; }` }), body: P });
F["T09-neg-small-caps"] = page({ css: css({ extra: `p { font-variant: small-caps; }` }), body: P });
F["T09-pos-uppercase-latin-only"] = page({ css: css({ extra: `.eyebrow { text-transform: uppercase; }` }), body: `<span class="eyebrow">Notes</span>\n${P}` });
F["T09-pos-none"] = page({ css: css({ extra: `h1 { text-transform: none; }` }), body: P });

// T11：最小字号
F["T11-neg-11px"] = page({ css: css({ extra: `p { font-size: 11px; }` }), body: P });
F["T11-neg-em-small"] = page({ css: css({ extra: `.note { font-size: 0.7em; }` }), body: `${P}\n<p><span class="note">这是一条很小的注释。</span></p>` });
F["T11-pos-16px"] = page({ css: css(), body: P });
F["T11-pos-12px-caption"] = page({ css: css({ extra: `.caption { font-size: 12px; }` }), body: `${P}\n<figure><figcaption class="caption">图一：示意图</figcaption></figure>` });

// T13：字体栈里要有中文字体
F["T13-neg-latin-only-stack"] = page({ css: css({ font: `body { font-family: "Inter", "Helvetica Neue", sans-serif; font-size: 16px; }` }), body: P });
F["T13-neg-no-font-family"] = page({ css: css({ font: `body { font-size: 16px; }` }), body: P });
F["T13-pos-sans-stack"] = page({ css: css(), body: P });
F["T13-pos-serif-stack"] = page({ css: css({ font: `body { font-family: "Source Serif 4", "Noto Serif SC", serif; font-size: 16px; }` }), body: P });

// F03：自托管字体的授权
F["F03-neg-puhuiti-webfont"] = page({ css: css({ extra: `@font-face { font-family: "Alibaba PuHuiTi"; src: url("fonts/AlibabaPuHuiTi-3-55-Regular.woff2") format("woff2"); }\nh1 { font-family: "Alibaba PuHuiTi", "PingFang SC", sans-serif; }` }), body: P });
F["F03-neg-founder-filename"] = page({ css: css({ extra: `@font-face { font-family: "BrandTitle"; src: url("fonts/FZLanTingHei-R-GBK.woff2") format("woff2"); }\nh1 { font-family: "BrandTitle", "PingFang SC", sans-serif; }` }), body: P });
F["F03-pos-noto-webfont"] = page({ css: css({ extra: `@font-face { font-family: "Noto Sans SC"; src: url("fonts/NotoSansSC-subset.woff2") format("woff2"); }` }), body: P });
F["F03-pos-lxgw-webfont"] = page({ css: css({ extra: `@font-face { font-family: "LXGW WenKai"; src: url("fonts/LXGWWenKai-Regular.woff2") format("woff2"); }\nh1 { font-family: "LXGW WenKai", "PingFang SC", serif; }` }), body: P });
F["F03-warn-unknown-family"] = page({ css: css({ extra: `@font-face { font-family: "Mystery Display"; src: url("fonts/mystery.woff2") format("woff2"); }\nh1 { font-family: "Mystery Display", "PingFang SC", sans-serif; }` }), body: P });

// 没有中文内容
F["NOCJK-english-only"] = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>English only</title>
<style>p { line-height: 1.2; font-style: italic; letter-spacing: -0.05em; }</style></head>
<body><h1>Hello</h1><p>This page has no CJK text at all.</p></body>
</html>
`;

const CONFIGS = {
  "T02-neg-text-mode-tight": { schema_version: "1.0.0", spacing: "text" },
  "T02-pos-text-mode-spaced": { schema_version: "1.0.0", spacing: "text" }
};

// 被 T02-pos-linked-css 引用的本地样式（内容等价于 measure.css 的相关部分）
writeFileSync(join(dir, "assets", "measure-copy.css"), [LINEBREAK, SYNTH, LH, AUTOSPACE].join("\n") + "\n");

for (const [name, html] of Object.entries(F)) writeFileSync(join(dir, `${name}.html`), html);
for (const [name, cfg] of Object.entries(CONFIGS)) writeFileSync(join(dir, `${name}.config.json`), JSON.stringify(cfg, null, 2) + "\n");
console.log(`已生成 ${Object.keys(F).length} 个夹具，${Object.keys(CONFIGS).length} 个配置`);
