// 展示页的规则示意（标明「示意」，不是实验结果）：每条规则一组，同一段文字，「关」只改目标规则对应的那一处，其余照 measure 的规范写；
// 「开」是按 measure 改好的版本。生成后用 measure-cjk lint --render 验证：「关」只踩中目标规则，「开」零 error（bench/showcase-build.mjs）。
// 色板按 dososo-design-system：米纸 #f4e9dc、墨 #1f1b16、青瓷 #7e8c6b、朱砂 #9e4b3b。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const page = ({ rule, width = 600, css = "", body }) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>示意 ${rule}</title>
<style>
:where(:lang(zh)) { line-break: strict; text-autospace: normal; font-synthesis-style: none; }
html, body { margin: 0; background: #f4e9dc; color: #1f1b16; font-family: "Noto Sans SC", sans-serif; }
.demo { box-sizing: border-box; width: ${width}px; padding: 40px 44px; }
.demo p { font-size: 18px; line-height: 1.75; margin: 0; }
.demo h2 { font-size: 40px; line-height: 1.3; font-weight: 300; margin: 0; }
${css}
</style>
</head>
<body>
<div class="demo">
${body}
</div>
</body>
</html>
`;
const DEMOS = [
  {
    rule: "T02",
    title: "中英文、中文与数字之间要有间距",
    why: "汉字和字母、数字挤在一起，读的时候要自己找边界。measure.css 打开 text-autospace，浏览器自动留出约四分之一个字的空隙，文案里不用手打空格。",
    body: "<p>我们用Python和pandas处理了2024年的3万行Excel数据，耗时从2小时降到5分钟。</p>",
    off: ".demo p { text-autospace: no-autospace; }",
    on: ""
  },
  {
    rule: "T03",
    title: "中文语境用全角标点",
    why: "半角逗号、句号、问号又小又靠下，夹在汉字中间像没打完。中文句子用全角标点，字距才均匀。",
    body: { off: "<p>排版不是装饰,而是让读者读得更轻松.你注意到了吗?</p>", on: "<p>排版不是装饰，而是让读者读得更轻松。你注意到了吗？</p>" }
  },
  {
    rule: "T05",
    title: "正文行长 28–40 字",
    width: 1040,
    why: "一行太长，眼睛从行尾回到下一行行首时容易串行。中文正文每行 28–40 个字最舒服，宽屏上要给正文限宽。",
    body: "<p>好的排版不会让你注意到它的存在。你只是觉得这篇文章读起来很顺，一口气就读完了。行长、行高、字号和标点，每一项都在悄悄影响阅读的节奏。宽屏上的正文如果不限宽，一行就会拉到五六十个字，读到行尾再回到下一行行首，眼睛要扫过大半个屏幕，很容易串行。</p>",
    off: "",
    on: ".demo p { max-width: 36em; }"
  },
  {
    rule: "T06",
    title: "正文行高不低于 1.5",
    why: "汉字是方块字，字面撑满整个字身，行与行之间比西文更需要留白。行高 1.35 时上下两行已经显得挤，正文建议 1.6–1.9。",
    body: "<p>好的排版不会让你注意到它的存在。你只是觉得这篇文章读起来很顺，一口气就读完了。汉字是方块字，字面几乎撑满整个字身，行与行之间需要比西文更多的留白。</p>",
    off: ".demo p { line-height: 1.35; }", // 北极星实验里真实页面报 T06 的最低值（AUDIT_SHOWCASE SA-07：示意不夸大）
    on: ""
  },
  {
    rule: "T07",
    title: "中文字距不能为负",
    why: "西文大标题常用负字距收紧，搬到中文上，笔画会碰在一起。中文标题保持默认字距，靠字重和留白拉开层次。",
    body: "<h2>把时间烘进一杯好咖啡</h2>",
    off: ".demo h2 { letter-spacing: -0.03em; }", // 和实验里真实页面的负字距比例相当（SA-07）
    on: ""
  },
  {
    rule: "T08",
    title: "中文不用斜体",
    why: "中文字体没有真正的斜体，浏览器只能把字形硬生生歪过去。强调中文，用加粗、颜色或着重号。",
    body: "<p>中文没有斜体，<em>强行倾斜会把字形拉歪</em>，请换一种强调方式。</p>",
    off: ".demo em { font-style: italic; font-synthesis-style: auto; }",
    on: ".demo em { font-style: normal; font-weight: 600; color: #9e4b3b; }"
  },
  {
    rule: "T11",
    title: "最小字号：正文 ≥ 14px，任何中文 ≥ 12px",
    why: "西文 10px 还能辨认，汉字笔画多，10px 时笔画会糊成一团。价格说明、标签这类小字，中文也不要小于 12px。",
    body: "<p class=\"plan\">专业版　¥29 / 月</p>\n<p class=\"note\">按年付费，每月只要 ¥24；可以随时取消，剩余天数按日退款。</p>",
    off: ".demo .plan { font-size: 24px; font-weight: 400; } .demo .note { font-size: 10px; line-height: 1.6; margin-top: 12px; color: #5a5148; }",
    on: ".demo .plan { font-size: 24px; font-weight: 400; } .demo .note { font-size: 14px; line-height: 1.6; margin-top: 12px; color: #5a5148; }"
  }
];
const meta = [];
for (const d of DEMOS) {
  for (const arm of ["off", "on"]) {
    const body = typeof d.body === "string" ? d.body : d.body[arm];
    writeFileSync(join(dir, `${d.rule.toLowerCase()}-${arm}.html`), page({ rule: `${d.rule}（${arm === "off" ? "关" : "开"}）`, width: d.width, css: arm === "off" ? (d.off ?? "") : (d.on ?? ""), body }));
  }
  meta.push({ rule: d.rule, title: d.title, why: d.why, width: d.width ?? 600 });
}
writeFileSync(join(dir, "demos.json"), JSON.stringify(meta, null, 2) + "\n");
console.log(`生成 ${DEMOS.length} 组示意`);
