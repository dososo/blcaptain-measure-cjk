// 生成 bench/golden/g01–g20.html 和 assets/site.css。
// 这些「好页面」在实现任何规则之前写好，生成后用 MANIFEST.sha256 锁定，之后不得修改。
// 正文为原创中文内容。运行：node bench/golden/_build.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// 与 PRD §7.4 的 measure.css 等价的基础规则（golden 页面内联使用）
const BASE = `:where(:root:lang(zh)) { line-break: strict; }
:where(:lang(zh)) { font-synthesis-style: none; text-emphasis-position: under right; }
:where(:lang(zh)) :where(p, li) { line-height: 1.75; }
:where(:lang(zh)) :where(h1, h2, h3) { line-height: 1.3; }
.measure-prose { max-width: 36em; }
@supports (text-autospace: normal) { :where(:lang(zh)) { text-autospace: normal; } }`;

const SANS = `"Inter", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif`;
const SERIF = `"Source Serif 4", "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;

const SITE_CSS = `/* golden 页面共用样式表（被 S2 写法通过 <link> 引用） */
${BASE}
body { margin: 0; font-family: ${SANS}; font-size: 16px; color: #2b2622; background: #f6f1ea; }
main { margin: 0 auto; padding: 48px 24px; }
h1 { font-size: 32px; font-weight: 600; }
h2 { font-size: 22px; font-weight: 600; margin-top: 40px; }
table { border-collapse: collapse; width: 100%; }
th, td { border-bottom: 1px solid #d9cfc2; padding: 10px 8px; text-align: left; font-size: 15px; }
pre { background: #ece4d8; padding: 16px; overflow-x: auto; font-size: 14px; line-height: 1.6; }
code { font-family: "JetBrains Mono", "SFMono-Regular", monospace; }
label { display: block; margin-top: 16px; font-size: 15px; }
input, select, textarea { font: inherit; font-size: 16px; padding: 8px; }
`;

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function bodyHtml(page) {
  const out = [];
  out.push(`<h1>${page.title}</h1>`);
  if (page.lead) out.push(`<p class="lead">${page.lead}</p>`);
  for (const sec of page.sections ?? []) {
    out.push(`<h2>${sec.h}</h2>`);
    for (const p of sec.p ?? []) out.push(`<p>${p}</p>`);
    if (sec.ul) out.push(`<ul>${sec.ul.map((li) => `<li>${li}</li>`).join("")}</ul>`);
    if (sec.ol) out.push(`<ol>${sec.ol.map((li) => `<li>${li}</li>`).join("")}</ol>`);
    if (sec.code) out.push(`<pre><code>${esc(sec.code)}</code></pre>`);
    if (sec.table) {
      const [head, ...rows] = sec.table;
      out.push(`<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`);
    }
    if (sec.form) out.push(sec.form);
  }
  return out.join("\n");
}

function doc({ lang = "zh-CN", title, head, body, bodyAttr = "" }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${head}
</head>
<body${bodyAttr}>
${body}
</body>
</html>
`;
}

// S1：完整内联 <style>
function s1(page, { serif = false, extra = "", lang } = {}) {
  const head = `<style>
${BASE}
body { margin: 0; font-family: ${serif ? SERIF : SANS}; font-size: 17px; color: #26221f; background: #faf7f2; }
main { margin: 0 auto; padding: 56px 24px; }
h1 { font-size: 34px; font-weight: 500; letter-spacing: 0.02em; }
h2 { font-size: 22px; font-weight: 600; margin-top: 44px; }
.lead { font-size: 19px; color: #5b524a; }
.eyebrow { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #8a7d70; }
${extra}
</style>`;
  const eyebrow = page.eyebrow ? `<span class="eyebrow">${page.eyebrow}</span>\n` : "";
  return doc({ lang, title: page.title, head, body: `<main class="measure-prose">\n${eyebrow}${bodyHtml(page)}\n</main>` });
}

// S2：引用本地样式表
function s2(page) {
  const head = `<link rel="stylesheet" href="assets/site.css">`;
  return doc({ title: page.title, head, body: `<main class="measure-prose">\n${bodyHtml(page)}\n</main>` });
}

// S3：少量 <style> + 大量 style 属性
function s3(page) {
  const head = `<style>
${BASE}
body { margin: 0; font-family: ${SANS}; }
</style>`;
  const inner = bodyHtml(page)
    .replace(/<h1>/g, `<h1 style="font-size: 30px; font-weight: 600; color: #1f2a2e;">`)
    .replace(/<h2>/g, `<h2 style="font-size: 21px; margin-top: 36px; color: #1f2a2e;">`)
    .replace(/<p>/g, `<p style="font-size: 16px; line-height: 1.8; color: #333;">`)
    .replace(/<li>/g, `<li style="font-size: 16px; line-height: 1.75;">`);
  return doc({ title: page.title, head, body: `<main style="max-width: 36em; margin: 0 auto; padding: 40px 20px;">\n${inner}\n</main>` });
}

// S4：Tailwind 风格工具类（只用 golden 认可的类）
function s4(page) {
  const head = `<style>
${BASE}
.font-sans { font-family: ${SANS}; }
.text-base { font-size: 16px; }
.text-lg { font-size: 18px; }
.text-3xl { font-size: 30px; }
.leading-relaxed { line-height: 1.625; }
.leading-loose { line-height: 2; }
.tracking-wide { letter-spacing: 0.025em; }
.uppercase { text-transform: uppercase; }
.mx-auto { margin-left: auto; margin-right: auto; }
.max-w-prose { max-width: 36em; }
.px-6 { padding-left: 24px; padding-right: 24px; }
.py-12 { padding-top: 48px; padding-bottom: 48px; }
p, li { line-height: 1.75; }
</style>`;
  const inner = bodyHtml(page)
    .replace(/<h1>/g, `<h1 class="text-3xl tracking-wide">`)
    .replace(/<p>/g, `<p class="text-base leading-relaxed">`)
    .replace(/<li>/g, `<li class="text-base leading-loose">`);
  const badge = page.badge ? `<span class="uppercase tracking-wide text-base">${page.badge}</span>\n` : "";
  return doc({ title: page.title, head, body: `<main class="font-sans mx-auto max-w-prose px-6 py-12">\n${badge}${inner}\n</main>` });
}

// S5：小红书 3:4 卡片（1080×1440）
function s5(card, { fontFace = "", family = SANS } = {}) {
  const head = `<style>
${fontFace}
${BASE}
html, body { margin: 0; }
body { font-family: ${family}; background: #f3ece2; }
.card { width: 1080px; height: 1440px; box-sizing: border-box; padding: 96px 88px; display: flex; flex-direction: column; gap: 32px; }
.card h1 { font-size: 76px; font-weight: 600; line-height: 1.25; margin: 0; color: #2a231d; }
.card .sub { font-size: 34px; color: #6b5f53; margin: 0; line-height: 1.6; }
.card ol { margin: 0; padding-left: 1.4em; }
.card li { font-size: 38px; line-height: 1.7; color: #2a231d; }
.card .foot { margin-top: auto; font-size: 26px; color: #8c7f71; }
</style>`;
  const body = `<article class="card">
<h1>${card.title}</h1>
<p class="sub">${card.sub}</p>
<ol>${card.items.map((i) => `<li>${i}</li>`).join("")}</ol>
<p class="foot">${card.foot}</p>
</article>`;
  return doc({ title: card.title, head, body });
}

const PAGES = {
  g01: () => s1({
    eyebrow: "Roastery",
    title: "山间烘焙所",
    lead: "我们只做小批量烘焙。每一袋豆子都写着产地、处理法和烘焙日期，拆开之后，你喝到的是这一周的味道。",
    sections: [
      { h: "这周在烘什么", ul: ["云南保山小粒咖啡，日晒处理，带一点熟李子的甜。", "埃塞俄比亚耶加雪菲，水洗处理，柑橘和茉莉花香很明显。", "哥伦比亚慧兰，浅中烘，适合做手冲也适合做冷萃。"] },
      { h: "我们怎么烘", p: ["一锅只烘 5 公斤，出锅后静置 48 小时再封袋。烘焙曲线每次都会记录，同一支豆子如果味道不对，我们宁可不卖。"] },
      { h: "到店喝一杯", p: ["地址在老城区青石巷 12 号，周二到周日 9:00–18:00 营业。店里只有六个座位，周末建议提前来。"] }
    ]
  }),
  g02: () => s4({
    badge: "Beta",
    title: "小账本：给五人以内团队的记账工具",
    sections: [
      { h: "它能帮你做什么", ul: ["拍一张发票，自动识别金额、日期和抬头。", "每个人的报销单一目了然，月底不用再对 Excel。", "支持导出给财务的标准格式，也能按项目查看支出。"] },
      { h: "用户怎么说", p: ["“以前每到月底要花一整个下午对账，现在 20 分钟就结束了。”这是一家设计工作室的负责人告诉我们的。"] },
      { h: "现在开始", p: ["前 30 天免费，不需要绑定银行卡。团队超过五个人时，可以随时升级到正式版。"] }
    ]
  }),
  g03: () => s2({
    title: "周末骑行社招新",
    lead: "我们每周六早上出发，路线在 40 到 80 公里之间，配速不快，等人是常态。",
    sections: [
      { h: "活动怎么安排", ul: ["每周六 7:00 在体育公园北门集合。", "每月第一个周日安排一次长途，距离不超过 120 公里。", "雨天取消，提前一晚在群里通知。"] },
      { h: "路线难度", p: ["新手路线基本是平路，累计爬升不到 200 米。进阶路线会有两段山路，需要你能连续骑行三小时。"] },
      { h: "怎么报名", p: ["填写报名表后，我们会在三天内联系你，第一次活动可以借用俱乐部的备用头盔。"] }
    ]
  }),
  g04: () => s1({
    title: "为什么年轻人又开始用纸质笔记本",
    lead: "手机里的备忘录越来越多，可我们记住的事情好像越来越少。",
    sections: [
      { h: "慢一点，反而记得住", p: ["用笔写字比打字慢得多。正因为慢，你会在下笔之前先想一想，哪些话值得写下来。这个筛选的过程，本身就是一次整理。", "有研究者让学生分别用电脑和纸笔记课堂笔记，结果发现，用纸笔的一组在<em>理解类问题</em>上的表现更好。"] },
      { h: "一个本子，只做一件事", p: ["很多人的做法是给每件事准备一个本子：读书一本，工作一本，日常琐事一本。翻开哪一本，就进入哪一种状态。"] },
      { h: "它不会推送任何东西", p: ["这可能是纸质笔记本最大的优点。它不会在你写到一半的时候弹出一条消息，也不会提醒你还有 99 条未读。"] }
    ]
  }, { serif: true }),
  g05: () => s2({
    title: "用 Python 处理 Excel 报表的 5 个技巧",
    lead: "下面的例子都基于 pandas 2.x，每个技巧都能直接复制到你的脚本里。",
    sections: [
      { h: "1. 一次读入多个工作表", p: ["把 sheet_name 设为 None，会得到一个字典，键是工作表的名字。"], code: "import pandas as pd\nsheets = pd.read_excel(\"report.xlsx\", sheet_name=None)\nfor name, df in sheets.items():\n    print(name, len(df))" },
      { h: "2. 合并之前先统一列名", p:["不同同事交上来的表格，列名经常对不上。先用 rename 统一，再用 concat 合并，能少踩很多坑。"] },
      { h: "3. 导出时保留格式", p: ["如果领导习惯看带颜色的表格，可以用 ExcelWriter 配合 openpyxl 设置列宽和表头样式。"] }
    ]
  }),
  g06: () => s3({
    title: "在大理住了两周",
    sections: [
      { h: "住在古城外面", p: ["我没有住在古城里，而是在才村找了一间能看到洱海的民宿。早上七点，湖面上会有一层很薄的雾。"] },
      { h: "每天只安排一件事", p: ["第一周我几乎没有计划，今天去喜洲吃破酥粑粑，明天沿着湖边骑车。慢下来之后，才发现原来一天可以这么长。"] },
      { h: "离开前的清单", ul: ["在苍山脚下的小店买了一包手工扎染布。", "给明信片盖了三个邮戳，寄给半年后的自己。", "把房东推荐的那家米线店又吃了一次。"] }
    ]
  }),
  g07: () => s1({
    title: "《置身事内》读书笔记",
    lead: "这本书讲的是地方政府如何参与经济发展。读完之后，我对很多新闻有了不一样的理解。",
    sections: [
      { h: "收获一：财政决定了很多事", p: ["地方政府的收入从哪里来、花到哪里去，决定了它会优先做什么。很多看似突然的政策，背后都有财政上的原因。"] },
      { h: "收获二：土地是关键", p: ["书里用了大量篇幅解释土地财政的来龙去脉。理解了这一点，再看城市扩张和房价，就不会只看到表面。"] },
      { h: "收获三：没有简单的答案", p: ["作者反复强调，每一种做法都有它的代价。与其急着下结论，不如先弄清楚约束条件是什么。"] }
    ]
  }, { lang: "zh-Hans" }),
  g08: () => s4({
    title: "素材库会员方案",
    sections: [
      { h: "选择适合你的方案", table: [["方案", "价格", "包含内容"], ["免费版", "0 元", "每月下载 10 个素材"], ["专业版", "38 元 / 月", "不限下载，可商用授权"], ["团队版", "198 元 / 月", "5 个账号，共享收藏夹"]] },
      { h: "关于授权", p: ["专业版和团队版下载的素材都可以用于商业项目。授权在会员到期后依然有效，但到期后下载的素材不在授权范围内。"] }
    ]
  }),
  g09: () => s2({
    title: "静心瑜伽课程价格",
    sections: [
      { h: "课程价格", table: [["卡种", "价格", "有效期"], ["单次课", "120 元", "当天有效"], ["10 次卡", "980 元", "6 个月"], ["月卡", "680 元", "30 天不限次"], ["年卡", "5800 元", "365 天不限次"]] },
      { h: "购买须知", ul: ["第一次上课可以免费体验一节基础课。", "次卡可以转让给家人使用，月卡和年卡仅限本人。", "因个人原因无法上课，请提前 4 小时取消预约。"] }
    ]
  }),
  g10: () => s1({
    title: "接口按量计费",
    lead: "注册即送每月 10 万次免费调用，超出部分按实际用量计费，不设最低消费。",
    sections: [
      { h: "价格", ul: ["文本接口：每千次 0.8 元。", "图片接口：每千次 3.5 元。", "批量接口：每千次 0.5 元，单次请求不超过 100 条。"] },
      { h: "怎么计费", p: ["每天凌晨 2 点结算前一天的用量，账单会发送到你的注册邮箱。余额不足时，接口会返回 402 状态码，不会产生欠费。"] }
    ]
  }),
  g11: () => s2({
    title: "tidy 快速上手",
    lead: "tidy 是一个整理下载文件夹的命令行工具，三分钟就能装好。",
    sections: [
      { h: "安装", code: "brew install tidy-cli\ntidy --version" },
      { h: "配置", p: ["第一次运行时，tidy 会在用户目录下生成配置文件。你可以在里面指定哪些后缀的文件放进哪个文件夹。"] },
      { h: "三个常用命令", ul: ["<code>tidy scan</code>：只扫描，不移动任何文件。", "<code>tidy run</code>：按照配置整理文件。", "<code>tidy undo</code>：撤销最近一次整理。"] }
    ]
  }),
  g12: () => s3({
    title: "团队 Git 使用规范",
    sections: [
      { h: "分支命名", p: ["功能分支以 feat 开头，修复分支以 fix 开头，后面跟上任务编号和简短说明。"] },
      { h: "提交信息", ol: ["第一行写清楚做了什么，不超过 50 个字符。", "空一行之后写为什么这样做。", "关联的任务编号放在最后一行。"] },
      { h: "代码评审", p: ["每个合并请求至少需要一位同事批准。评审意见请写具体的修改建议，而不是只写“这里不好”。"] }
    ]
  }),
  g13: () => s1({
    title: "智慧門鎖使用說明",
    lead: "第一次使用前，請先裝好四顆 AA 電池，並準備好管理員密碼。",
    sections: [
      { h: "錄入指紋", ol: ["按下門鎖內側的設定鍵，聽到提示音後輸入管理員密碼。", "選擇“新增指紋”，同一根手指按壓五次。", "聽到“錄入成功”後即可使用。"] },
      { h: "更換電池", p: ["電量低於百分之十五時，門鎖每次開門都會提醒。電池盒在門鎖內側，滑開蓋板就能更換。"] }
    ]
  }, { lang: "zh-TW", extra: `body { font-family: "Inter", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif; }` }),
  g14: () => s4({
    title: "城市读书会报名",
    sections: [
      { h: "填写报名信息", form: `<form>
<label>姓名 <input name="name" required></label>
<label>手机号 <input name="phone" type="tel" required></label>
<label>所在城市 <select name="city"><option>上海</option><option>杭州</option><option>南京</option></select></label>
<label>参加场次 <select name="session"><option>11 月 8 日下午</option><option>11 月 15 日下午</option></select></label>
<button type="submit">提交报名</button>
</form>` },
      { h: "注意事项", p: ["每场限 30 人，报名成功后会收到短信确认。如果临时有事不能参加，请提前一天告诉我们，把名额留给其他人。"] }
    ]
  }),
  g15: () => s2({
    title: "意见反馈",
    lead: "你的每一条反馈，产品团队都会在三个工作日内阅读并回复。",
    sections: [
      { h: "告诉我们发生了什么", form: `<form>
<label>问题类型 <select name="type"><option>功能建议</option><option>使用问题</option><option>其他</option></select></label>
<label>详细描述 <textarea name="desc" rows="5"></textarea></label>
<label>上传截图 <input name="shot" type="file" accept="image/*"></label>
<button type="submit">提交</button>
</form>` }
    ]
  }),
  g16: () => s3({
    title: "晚风小馆订座",
    sections: [
      { h: "选择时间", p: ["我们每天 17:00 开始营业，最后一桌入座时间是 21:00。八人以上的包间请直接打电话预订。"] },
      { h: "订座须知", ul: ["保留座位 15 分钟，超时会自动取消。", "如需儿童座椅，请在备注里写明。", "店内不设最低消费。"] }
    ]
  }),
  g17: () => s5({
    title: "上班族的 10 分钟早餐",
    sub: "不用早起，也能好好吃一顿。",
    items: ["燕麦加牛奶，前一晚放进冰箱。", "全麦面包夹一个水煮蛋。", "香蕉配一小把坚果。", "速冻饺子煮八分钟就好。"],
    foot: "收藏起来，明天早上试试。"
  }),
  g18: () => s5({
    title: "杭州周末两天一夜",
    sub: "第一天看湖，第二天进山。",
    items: ["上午沿北山街走到断桥。", "下午去龙井村喝一杯茶。", "晚上在河坊街附近吃小吃。", "第二天早上坐公交去九溪。"],
    foot: "路线按步行友好安排。"
  }, {
    fontFace: `@font-face { font-family: "LXGW WenKai"; src: url("fonts/LXGWWenKai-Regular.woff2") format("woff2"); font-display: swap; }`,
    family: `"LXGW WenKai", "Noto Sans SC", sans-serif`
  }),
  g19: () => s5({
    title: "理财新手先懂这 3 个词",
    sub: "看懂了，再决定要不要买。",
    items: ["年化收益率：按一年折算的收益。", "最大回撤：历史上最多亏过多少。", "流动性：需要用钱时能不能马上取出来。"],
    foot: "本卡片不构成任何投资建议。"
  }, {
    fontFace: `@font-face { font-family: "Noto Sans SC"; src: url("fonts/NotoSansSC-subset.woff2") format("woff2"); font-display: swap; }`,
    family: `"Noto Sans SC", sans-serif`
  }),
  g20: () => s1({
    title: "关于实行弹性工作制的通知",
    lead: "从下个月 1 日起，公司将实行弹性工作制，核心工作时间为 10:00–16:00。",
    sections: [
      { h: "具体安排", ul: ["每天上班时间可以在 8:00 到 10:00 之间自行选择。", "每周累计工作时间不少于 40 小时。", "核心时间内请保持在线，方便同事找到你。"] },
      { h: "常见问题", p: ["问：迟到怎么算？答：只要在 10:00 前打卡，都不算迟到。", "问：加班还能调休吗？答：可以，调休规则保持不变。"] }
    ]
  }, {
    extra: `@font-face { font-family: "Smiley Sans"; src: url("fonts/SmileySans-Oblique.woff2") format("woff2"); }
h1, h2 { font-family: "Smiley Sans", "Noto Sans SC", sans-serif; }`
  })
};

mkdirSync(join(here, "assets"), { recursive: true });
writeFileSync(join(here, "assets", "site.css"), SITE_CSS);
for (const [id, make] of Object.entries(PAGES)) {
  writeFileSync(join(here, `${id}.html`), make());
}
console.log(`已生成 ${Object.keys(PAGES).length} 个 golden 页面`);
