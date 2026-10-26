// 前后对比图的公共部分（W2 第 3 步）：思源字体替换、页面加载、实际用到的字体核对。showcase-shots.mjs 和 showcase-build.mjs 共用。
// 字体（用户拍板 S-D1）：页面里的系统中文字体和通用 sans-serif、serif 一律接到思源黑体、思源宋体（OFL-1.1，仓库外
// ../deliverables/fonts-for-test/，不进 git），整套接管（含英文字形）：中文页面里 Chrome 把通用 sans-serif 映射成苹方，
// 只接管中文码位的话，英文会落到苹方上。monospace 后面也补上思源黑体，代码里的中文不回退到苹方。页面点名的英文字体不动。
// 截完逐个元素查实际用到的字体（CSS.getPlatformFontsForNode，同 card 命令），还有系统中文字体或授权表里不能出图的字体时判为不合格。
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { matchFontName } from "../packages/cli/dist/index.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONTS = join(repo, "..", "deliverables", "fonts-for-test");
const FACES = {
  "NS-Sans": [[100, "noto-sans-sc/NotoSansSC-Thin.otf"], [300, "noto-sans-sc/NotoSansSC-Light.otf"], [350, "noto-sans-sc/NotoSansSC-DemiLight.otf"], [400, "noto-sans-sc/NotoSansSC-Regular.otf"], [500, "noto-sans-sc/NotoSansSC-Medium.otf"], [700, "noto-sans-sc/NotoSansSC-Bold.otf"], [900, "noto-sans-sc/NotoSansSC-Black.otf"]],
  "NS-Serif": [[200, "noto-serif-sc/SubsetOTF/SC/NotoSerifSC-ExtraLight.otf"], [300, "noto-serif-sc/SubsetOTF/SC/NotoSerifSC-Light.otf"], [400, "noto-serif-sc/SubsetOTF/SC/NotoSerifSC-Regular.otf"], [500, "noto-serif-sc/SubsetOTF/SC/NotoSerifSC-Medium.otf"], [600, "noto-serif-sc/SubsetOTF/SC/NotoSerifSC-SemiBold.otf"], [700, "noto-serif-sc/SubsetOTF/SC/NotoSerifSC-Bold.otf"], [900, "noto-serif-sc/SubsetOTF/SC/NotoSerifSC-Black.otf"]],
  // 用户拍板 S-D2：系统 emoji 和符号字体不出现在公开截图里，换成 Noto Sans Symbols 2、Noto Color Emoji（OFL-1.1）
  "NS-Sym": [[400, "noto-symbols2/NotoSansSymbols2/full/ttf/NotoSansSymbols2-Regular.ttf"]],
  "NS-Emoji": [[400, "noto-emoji/NotoColorEmoji.ttf"]]
};
for (const list of Object.values(FACES)) for (const [, f] of list) if (!existsSync(join(FONTS, f))) throw new Error(`缺少字体文件 ${f}（见 ../deliverables/fonts-for-test/SOURCES.md）`);
const FONT_URL = "file:///__showcase_fonts__/";
const FORMAT = { ".otf": "opentype", ".ttf": "truetype" };
const FACE_CSS = Object.entries(FACES)
  .flatMap(([fam, list]) => list.map(([w, f]) => `@font-face { font-family: "${fam}"; src: url("${FONT_URL}${f}") format("${FORMAT[extname(f)]}"); font-weight: ${w}; }`))
  .join("\n");
const SERIF_NAMES = ["Songti SC", "STSong", "SimSun", "宋体", "Noto Serif SC", "Noto Serif CJK SC", "Source Han Serif SC", "Source Han Serif", "思源宋体", "STKaiti", "Kaiti SC", "KaiTi", "楷体", "STFangsong", "FangSong", "仿宋"];
const SANS_NAMES = ["PingFang SC", "苹方", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", "Heiti SC", "STHeiti", "黑体", "SimHei", "Noto Sans SC", "Noto Sans CJK SC", "Source Han Sans SC", "Source Han Sans", "思源黑体", "WenQuanYi Micro Hei", "Lantinghei SC", "HarmonyOS Sans SC", "MiSans"];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NAMED = new RegExp(`(["']?)(${[...SERIF_NAMES, ...SANS_NAMES].map(esc).join("|")})\\1`, "gi");
// 把字体栈里的中文字体和通用字族接到思源字体上；只改 CSS 和 HTML 文本，页面结构和其他样式不动
export function rewrite(text) {
  return text
    .replace(NAMED, (_, _q, name) => (SERIF_NAMES.some((x) => x.toLowerCase() === name.toLowerCase()) ? '"NS-Serif"' : '"NS-Sans"'))
    .replace(/(?<![-\w"'])sans-serif\b/g, '"NS-Sans", "NS-Sym", "NS-Emoji", sans-serif')
    .replace(/(?<![-\w"'])serif\b/g, '"NS-Serif", "NS-Sym", "NS-Emoji", serif')
    .replace(/(?<![-\w"'])monospace\b/g, 'monospace, "NS-Sans", "NS-Sym", "NS-Emoji"');
}
// HTML 里只改 <style> 块和 style 属性，正文文字一个字都不动（文章里可能本来就写着「serif」）
export function rewriteHtml(html) {
  return html
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, a, css, b) => a + rewrite(css) + b)
    .replace(/(\sstyle\s*=\s*)(["'])([\s\S]*?)\2/gi, (_, a, q, css) => a + q + rewrite(css).replaceAll(q, q === '"' ? "'" : '"') + q);
}
// 不允许出现在截图里的字体：系统中文字体（S-D1），以及浏览器自动回退的系统 emoji 和符号字体（S-D2）
export const SYSTEM_CJK = /Apple Color Emoji|Zapf Dingbats|Apple Symbols|PingFang|Hiragino|Songti|STSong|STHeiti|Heiti|Kaiti|STKaiti|Lantinghei|Yuanti|Baoli|Libian|Wawati|Xingkai|Hannotate|HanziPen|Weibei|LiSung|LiHei|YaHei|SimSun|SimHei|Apple SD|Apple LiGothic/i;
export const VIEWS = { mobile: { width: 390, height: 844, scale: 2, maxHeight: 1600 }, desktop: { width: 1280, height: 800, scale: 1, maxHeight: 1400 } };


export async function openBrowser() {
  const { launchBrowser } = await import(pathToFileURL(join(repo, "packages", "cli", "dist", "render.js")).href);
  return (await launchBrowser("file", false)).browser;
}

// 打开一个本地页面：只读 root 目录里的文件，不联网，页面自带的字体文件不用，中文字体换成思源
export async function openPage(browser, htmlPath, root, view) {
  const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: view.scale, locale: "zh-CN", serviceWorkers: "block" });
  await ctx.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(FONT_URL)) {
      const f = decodeURIComponent(url.slice(FONT_URL.length));
      return route.fulfill({ status: 200, contentType: extname(f) === ".ttf" ? "font/ttf" : "font/otf", body: readFileSync(join(FONTS, f)) });
    }
    if (!url.startsWith("file:")) return route.abort("blockedbyclient");
    let real;
    try {
      real = realpathSync(fileURLToPath(url));
    } catch {
      return route.abort("failed");
    }
    if (!real.startsWith(root + "/") && real !== root) return route.abort("blockedbyclient");
    const ext = extname(real).toLowerCase();
    if (ext === ".html" || ext === ".htm") {
      const html = rewriteHtml(readFileSync(real, "utf8"));
      const css = `<style id="__showcase_fonts">\n${FACE_CSS}\n</style>`;
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}\n${css}`) : `${css}\n${html}` });
    }
    if (ext === ".css") return route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: rewrite(readFileSync(real, "utf8")) });
    if ([".ttf", ".otf", ".woff", ".woff2"].includes(ext)) return route.abort("blockedbyclient");
    return route.fulfill({ status: 200, body: readFileSync(real) });
  });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  return { ctx, page };
}

// 实际用到的字体，以及不合格的字体和用到它的元素
export async function fontCheck(ctx, page) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root: doc } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
  const ids = [];
  const walk = (n) => {
    if (n.nodeType === 1 && !["SCRIPT", "STYLE", "HEAD"].includes(n.nodeName)) ids.push(n.nodeId);
    for (const c of [...(n.children ?? []), ...(n.pseudoElements ?? []), ...(n.shadowRoots ?? [])]) walk(c);
  };
  walk(doc);
  const used = new Map();
  const where = new Map();
  for (const nodeId of ids) {
    let fonts;
    try {
      ({ fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId }));
    } catch {
      continue; // 没有布局的节点查不了
    }
    for (const f of fonts ?? []) {
      if (!(f.glyphCount > 0)) continue;
      used.set(f.familyName, Math.max(used.get(f.familyName) ?? 0, f.glyphCount));
      if (SYSTEM_CJK.test(f.familyName) && (where.get(f.familyName)?.length ?? 0) < 4) {
        const { outerHTML } = await cdp.send("DOM.getOuterHTML", { nodeId });
        where.set(f.familyName, [...(where.get(f.familyName) ?? []), outerHTML.replace(/\s+/g, " ").slice(0, 90)]);
      }
    }
  }
  const violations = [...used.keys()].filter((fam) => {
    if (SYSTEM_CJK.test(fam)) return true;
    const e = matchFontName(fam);
    return !!e && e.commercial_image !== true;
  });
  await cdp.detach();
  return { fonts: Object.fromEntries(used), violations, where: Object.fromEntries(where) };
}
