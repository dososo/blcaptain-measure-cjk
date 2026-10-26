// card 命令：导出小红书 3:4 卡片（1080×1440 PNG，PRD §5.3、§5.4「卡片导出的字体」、F06、AC-9）。
// 用户拍板（2026-10-26，docs/verification/w2/card/open_decisions.json）：
// - D-C1：F06 按浏览器实际渲染用到的字体判断（CDP CSS.getPlatformFontsForNode），包括缺字时回退的系统字体；
// - D-C2：字体不合规或卡片 lint 有 error，都不导出 PNG，退出码 1；
// - D-C3：font_dir 里单个字体文件 ≤ 64 MB，最多 50 个。
// 字体只从 font_dir 读：按字体文件 name 表里的名称查授权表（不看文件名），commercial_image 为 true 的才注入页面；
// 页面自己带的字体（@font-face 引用的文件一律拦截；data:、blob:、FontFace API 拦不住，加载了就拒绝）。
// 系统字体按授权表判断；微软雅黑只能从系统字体目录调用，放进 font_dir 的不加载（F06）。
// 独立审计 AUDIT_CARD 的整改（docs/verification/w2/card/audit/AUDIT_CARD.md）：
// - CA-05：卡片 lint 和导出是同一次渲染（1080×1440、同一批字体、同样的拦截规则），见 render.ts 的 CardHooks；
// - CA-01：逐个元素和伪元素查字体，穿透 shadow DOM 和表单控件；canvas、iframe、object、embed、video、含文字的 SVG 图片查不到字体，判为没检查完；
// - CA-02：页面加载后先去掉动画和过渡，再测量、查字体、截图；截两次图，前后不一致或者页面有变化，判为没检查完；
// - CB-01（第 2 轮复核）：变化检测从去掉动画之后就开始，覆盖 lint 测量、查字体、截图的全过程：
//   测量前截一张（shot0），查字体前后各截一张（shot1、shot2），三张必须一致，期间 DOM 不能有变化；
// - CC-01（第 3 轮复核）：DOM 变化有两路记录——隔离环境的 MutationObserver（红框按对象身份排除）和 CDP 的 DOM、样式表事件
//   （覆盖 shadow DOM，包括 closed 的，以及 CSSOM 改样式表）；
// - CA-04：页面自带的字体按加载事件识别（CSS.fontsUpdated 的 src、网络事件），不是 font_dir 注入的一律拒绝；
// - CA-06：卡片样式里点名要用、授权表里不允许出图的字体，不管 font_dir 里有没有这份文件，都不出图。
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { atomicWrite, isInside, MAX_FILE_BYTES, realRoot, rel } from "./fsafe.js";
import { defaultConfig } from "./config.js";
import { matchFontName, TIER_LABEL } from "./fonts.js";
import { parseFontFile, type FontFace } from "./fontfile.js";
import { EnvError, SCHEMA_VERSION, TOOL_VERSION, UsageError, type FontLicenseEntry, type LintResult, type MeasureConfig } from "./types.js";
import { MARK_ID, MIME, renderBudgetMs, runRender, type CardHooks, type PageWorld } from "./render.js";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1440;
export const MAX_FONT_BYTES = 64 * 1024 * 1024;
export const MAX_FONT_FILES = 50;
const FONT_EXTS = new Set([".ttf", ".otf", ".ttc", ".woff", ".woff2"]);
const FONT_URL = "file:///__measure_card_fonts__/";
const FONT_STYLE_ID = "__measure_card_fonts";
const MAX_NODES = 20_000;
// 查不到字体的载体（CA-01）：它们里面的文字不在 DOM 里，CSS.getPlatformFontsForNode 查不到
const OPAQUE = new Map([["CANVAS", "canvas"], ["IFRAME", "iframe"], ["FRAME", "frame"], ["OBJECT", "object"], ["EMBED", "embed"], ["VIDEO", "video"], ["FENCEDFRAME", "fencedframe"], ["PORTAL", "portal"]]);

export interface CardFont {
  family: string;
  names?: string[];
  postscript_name: string;
  source: "font_dir" | "system" | "page" | "css"; // page：页面自带的字体；css：只在样式里点名、没有加载
  file?: string;
  license_id?: string;
  tier?: string;
  commercial_image: boolean | "unknown";
  allowed: boolean;
  used: boolean; // 卡片实际用它渲染了文字
  requested?: boolean; // 卡片的 font-family 里点名要它
  reason: string;
  glyph_count: number; // 单个元素里用这款字体渲染的最多字形数（元素层层嵌套，不累加）
}

export interface CardResult {
  schema_version: string;
  tool: { name: "measure-cjk"; version: string };
  input: string;
  output?: string;
  size: { width: number; height: number };
  status: "exported" | "rejected" | "incomplete";
  fonts: CardFont[];
  attribution: { family: string; license_id: string; note: string }[];
  blocked: string[]; // 被拦截的字体文件和其他请求
  skipped_fonts: { file: string; reason: "too-large" | "unreadable" | "symlink" | "outside-root" }[];
  problems: string[]; // 为什么没导出 / 没检查完，中文
  lint: LintResult;
}

export interface CardOptions {
  input: string;
  out: string;
  fontDir?: string;
  root?: string;
  cwd?: string;
  config?: MeasureConfig;
  configDir?: string; // 配置文件所在目录：配置里的 font_dir 相对它解析（CA-11）；不传时相对工作区根目录
  evidenceDir?: string; // 卡片 lint 的截图目录；默认是输出 PNG 旁边的 evidence/（CA-10）
}

// 输出 PNG 的路径：在工作区内、扩展名 .png、不是符号链接、不在 .git 里；已有文件必须本来就是 PNG
export function safePngPath(rootReal: string, out: string, cwd: string): string {
  const abs = resolve(cwd, out);
  let parentReal: string;
  try {
    parentReal = realpathSync(dirname(abs));
  } catch {
    throw new UsageError(`输出目录不存在：${dirname(abs)}`);
  }
  if (!isInside(rootReal, parentReal)) throw new UsageError(`输出路径在工作区之外，已拒绝：${out}`);
  const target = join(parentReal, basename(abs));
  if (extname(target).toLowerCase() !== ".png") throw new UsageError(`--out 只能是 .png 文件，已拒绝：${out}`);
  if (rel(rootReal, target).split("/").includes(".git")) throw new UsageError(`--out 不能写进 .git 目录，已拒绝：${out}`);
  let st;
  try {
    st = lstatSync(target);
  } catch {
    st = undefined;
  }
  if (st) {
    if (st.isSymbolicLink()) throw new UsageError(`输出路径是符号链接，已拒绝：${out}`);
    if (!st.isFile()) throw new UsageError(`--out 指向的不是普通文件，已拒绝：${out}`);
    const head = readFileSync(target).subarray(0, 8);
    if (!head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) throw new UsageError(`--out 指向的文件已存在，而且不是 PNG，已拒绝覆盖：${out}`);
  }
  return target;
}

interface DirFont {
  index: number;
  file: string; // 相对工作区
  buf?: Buffer; // 只给放行的字体留着（CA-13）
  face: FontFace;
  entry?: FontLicenseEntry;
  allowed: boolean;
  reason: string;
}

const src = (e: FontLicenseEntry) => `原文：${e.source_url}（核验于 ${e.verified_at}）`;

function judgeDirFont(face: FontFace, file: string): { entry?: FontLicenseEntry; allowed: boolean; reason: string } {
  // 只按字体文件里的名字查，不看文件名：改个文件名不能改变授权结论（CA-03）
  const entry = face.names.map((n) => matchFontName(n)).find(Boolean);
  if (!entry) return { allowed: false, reason: `授权表里没有「${face.family}」（F-UNKNOWN；按字体文件内部的名字查，不看文件名 ${basename(file)}），无法确认能不能用于商用图片，没有加载。` };
  const hit = `命中授权表「${entry.names[0]}」（${TIER_LABEL[entry.tier]}）`;
  if (entry.id === "microsoft-yahei") return { entry, allowed: false, reason: `${hit}：微软雅黑的授权只允许从本机系统字体目录调用，不能拷进 font_dir（F06），没有加载。${src(entry)}` };
  if (entry.commercial_image === true) return { entry, allowed: true, reason: `${hit}：可以用于商用图片。${src(entry)}` };
  const why = entry.commercial_image === "unknown" ? "官方原文没有写清能不能用于商用图片" : "官方原文不允许用于商用图片";
  return { entry, allowed: false, reason: `${hit}：${why}，没有加载。${src(entry)}` };
}

function judgeSystemFont(family: string, postscript: string): { entry?: FontLicenseEntry; allowed: boolean; reason: string } {
  const entry = matchFontName(family) ?? matchFontName(postscript);
  if (!entry) return { allowed: false, reason: `浏览器用了系统字体「${family}」来显示文字（通常是 font_dir 里的字体缺字，或者没有可用的字体），授权表里没有它（F-UNKNOWN），不能用于商用图片。请在 font_dir 里放好覆盖全部文字的可商用字体。` };
  const hit = `浏览器用了系统字体「${family}」，命中授权表「${entry.names[0]}」（${TIER_LABEL[entry.tier]}）`;
  if (entry.commercial_image === true) return { entry, allowed: true, reason: `${hit}：可以用于商用图片${entry.id === "microsoft-yahei" ? "，并且是从本机系统字体目录调用的（F06）" : ""}。${src(entry)}` };
  const why = entry.commercial_image === "unknown" ? "官方原文没有写清能不能用于商用图片，按不允许处理" : "官方原文不允许用于商用图片";
  return { entry, allowed: false, reason: `${hit}：${why}。请在 font_dir 里放好覆盖全部文字的可商用字体。${src(entry)}` };
}

function loadFontDir(rootReal: string, dir: string, base: string, skipped: CardResult["skipped_fonts"]): DirFont[] {
  const abs = resolve(base, dir);
  let st;
  try {
    st = lstatSync(abs);
  } catch {
    throw new UsageError(`font_dir 不存在：${dir}`);
  }
  if (st.isSymbolicLink()) throw new UsageError(`font_dir 是符号链接，已拒绝：${dir}`);
  if (!st.isDirectory()) throw new UsageError(`font_dir 不是目录：${dir}`);
  const real = realpathSync(abs);
  if (!isInside(rootReal, real)) throw new UsageError(`font_dir 必须在工作区之内，已拒绝：${dir}`);
  const names = readdirSync(real).filter((n) => FONT_EXTS.has(extname(n).toLowerCase())).sort();
  if (names.length > MAX_FONT_FILES) throw new UsageError(`font_dir 里的字体文件有 ${names.length} 个，超过 ${MAX_FONT_FILES} 个的上限（D-C3），请只放这张卡片要用的字体`);
  const out: DirFont[] = [];
  for (const n of names) {
    const p = join(real, n);
    const file = rel(rootReal, p);
    const ls = lstatSync(p);
    if (ls.isSymbolicLink()) {
      skipped.push({ file, reason: "symlink" });
      continue;
    }
    if (!ls.isFile()) continue;
    if (ls.size > MAX_FONT_BYTES) {
      skipped.push({ file, reason: "too-large" });
      continue;
    }
    const buf = readFileSync(p);
    const parsed = parseFontFile(buf);
    if (parsed.error || parsed.faces.length === 0) {
      skipped.push({ file, reason: "unreadable" });
      continue;
    }
    // TTC 里有多款字体：每款单独判断；注入时浏览器只认集合里的第一款，所以只有第一款可以注入
    parsed.faces.forEach((face, i) => {
      const j = judgeDirFont(face, n);
      const allowed = j.allowed && i === 0;
      out.push({ index: out.length, file, buf: allowed ? buf : undefined, face, ...j, allowed, reason: j.allowed && i > 0 ? `${j.reason}（字体集合里的第 ${i + 1} 款，浏览器不会加载，请拆成单独的字体文件）` : j.reason });
    });
  }
  return out;
}

const cssString = (s: string) => s.replace(/["\\\n\r<>]/g, "");

function fontFaceCss(fonts: DirFont[]): string {
  const rules: string[] = [];
  for (const f of fonts.filter((x) => x.allowed)) {
    for (const name of f.face.names) rules.push(`@font-face { font-family: "${cssString(name)}"; src: url("${FONT_URL}${f.index}"); font-weight: ${Math.min(1000, Math.max(1, f.face.weight))}; }`);
  }
  return `<style id="${FONT_STYLE_ID}">\n${rules.join("\n")}\n</style>`;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- playwright 是可选依赖，不引入它的类型 */
interface CardState {
  used: Map<string, { family: string; postscript: string; custom: boolean; glyphs: number }>;
  requested: Map<string, string>; // 样式里点名的字体：小写 → 原文
  pageFonts: Map<string, string>; // 页面自带、已经加载的字体：家族名 → 来源（data:、blob:、FontFace API）
  svgUrls: string[];
  opaque: Set<string>;
  blocked: string[];
  problems: string[]; // 没检查完的原因
  shot0?: Buffer; // 冻结动画之后、lint 测量之前的截图（AUDIT_CARD_r2 CB-01）
  counting: boolean; // 从 shot0 起记录 CDP 报告的 DOM 和样式表变化（AUDIT_CARD_r3 CC-01）
  cdpChanges: number;
  markNodes: Set<number>; // 完整档红框的 nodeId：它的插入和删除不算页面变化
  png?: Buffer;
  done: boolean;
}

// 动画和过渡一律去掉：导出的是去掉动画之后的静态样式，测量、查字体、截图看到的是同一个画面（CA-02）。
// 用 CDP 建的检查器样式表，页面脚本看不到、删不掉
const FREEZE_CSS = [
  "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }",
  "*::marker { animation: none !important; transition: none !important; }",
  "*::placeholder { animation: none !important; transition: none !important; }"
].join("\n");
const SKIP_NODES = new Set(["SCRIPT", "STYLE", "HEAD", "TITLE", "NOSCRIPT", "TEMPLATE", "META", "LINK"]);
// SVG 图片里可能带文字（或者再嵌一张图）的写法：字体查不到，判为没检查完
const SVG_HAS_TEXT = /<([\w-]+:)?(text|tspan|textPath|foreignObject)\b|data:image\/svg/i;

function decodeDataUrl(url: string): string | undefined {
  const m = /^data:([^,]*),(.*)$/s.exec(url);
  if (!m) return undefined;
  try {
    return /;base64$/i.test(m[1]) ? Buffer.from(m[2], "base64").toString("utf8") : decodeURIComponent(m[2]);
  } catch {
    return undefined;
  }
}

async function capture(cdp: any): Promise<Buffer> {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  return Buffer.from(String(data), "base64");
}

function cardHooks(rootReal: string, htmlReal: string, fonts: DirFont[], st: CardState): CardHooks {
  const mainUrl = pathToFileURL(htmlReal).href;
  return {
    viewportHeight: CARD_HEIGHT,
    snapshotSkipId: FONT_STYLE_ID,
    async route(route, req, url) {
      if (url.startsWith(FONT_URL)) {
        const f = fonts.find((x) => String(x.index) === url.slice(FONT_URL.length) && x.allowed && x.buf);
        if (!f) await route.abort("blockedbyclient");
        else await route.fulfill({ status: 200, contentType: MIME[extname(f.file).toLowerCase()] ?? "application/octet-stream", body: f.buf });
        return true;
      }
      let u: URL;
      try {
        u = new URL(url);
      } catch {
        return false;
      }
      if (u.protocol !== "file:") {
        if (req.resourceType() === "font") st.blocked.push(url.slice(0, 300));
        return false; // 其余请求按完整档的规则处理（拦截并记进 remote_refs）
      }
      let real: string | undefined;
      try {
        real = realpathSync(fileURLToPath(u));
      } catch {
        real = undefined;
      }
      if (!real) return false;
      if (real === htmlReal && url === mainUrl) {
        // 主页面：在 <head> 里注入 font_dir 的字体（只有放行的）
        const html = readFileSync(real).toString("utf8");
        const css = fontFaceCss(fonts);
        const body = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}\n${css}`) : `${css}\n${html}`;
        await route.fulfill({ status: 200, contentType: MIME[".html"], body });
        return true;
      }
      // 卡片自己引用的字体文件一律拦截：字体只能来自 font_dir，并且要过授权表（PRD §5.4、F06）
      if (req.resourceType() === "font" || FONT_EXTS.has(extname(real).toLowerCase())) {
        st.blocked.push(rel(rootReal, real));
        await route.abort("blockedbyclient");
        return true;
      }
      return false;
    },
    async beforeLoad(cdp) {
      await cdp.send("DOM.enable");
      await cdp.send("CSS.enable");
      await cdp.send("Network.enable");
      // 页面自带的字体（CA-04）：data:、blob:、FontFace API 都不经过拦截，按加载事件识别。
      // font_dir 注入的字体 src 是 FONT_URL；local() 指向本机系统字体，按系统字体判断
      cdp.on("CSS.fontsUpdated", (e: any) => {
        const f = e?.font;
        if (!f) return;
        const src = String(f.src ?? "").trim();
        if (src.startsWith(FONT_URL) || /^local\(/i.test(src)) return;
        const how = src.startsWith("data:") ? "data: 地址" : src.startsWith("blob:") ? "blob: 地址" : src ? src.slice(0, 80) : "FontFace API";
        st.pageFonts.set(String(f.platformFontFamily || f.fontFamily || "（未知）"), how);
      });
      // 检查期间的页面变化（CC-01）：DOM 事件只对浏览器已经推给 CDP 的节点触发，afterLoad 里先取一次完整的 DOM 树（穿透 shadow DOM）
      const count = () => {
        if (st.counting) st.cdpChanges++;
      };
      cdp.on("DOM.childNodeInserted", (e: any) => {
        const n = e?.node;
        const attrs: string[] = n?.attributes ?? [];
        const isMark = attrs.some((a, i) => i % 2 === 0 && a === "id" && attrs[i + 1] === MARK_ID);
        if (isMark && typeof n.nodeId === "number") st.markNodes.add(n.nodeId); // 冒用这个 id 的元素躲得过这里，躲不过 MutationObserver
        else count();
      });
      cdp.on("DOM.childNodeRemoved", (e: any) => {
        if (!st.markNodes.delete(e?.nodeId)) count();
      });
      for (const ev of ["DOM.attributeModified", "DOM.attributeRemoved", "DOM.characterDataModified", "DOM.shadowRootPushed", "DOM.shadowRootPopped", "CSS.styleSheetChanged", "CSS.styleSheetAdded", "CSS.styleSheetRemoved"]) cdp.on(ev, count);
      cdp.on("Network.responseReceived", (e: any) => {
        const url = String(e?.response?.url ?? "");
        const mime = String(e?.response?.mimeType ?? "").toLowerCase();
        if (mime === "image/svg+xml" && e?.type !== "Document" && st.svgUrls.length < 200) st.svgUrls.push(url);
      });
    },
    async afterLoad(_page, w: PageWorld) {
      const { styleSheetId } = await w.cdp.send("CSS.createStyleSheet", { frameId: w.frameId });
      await w.cdp.send("CSS.setStyleSheetText", { styleSheetId, text: FREEZE_CSS });
      await w.evaluate("(document.getAnimations ? document.getAnimations() : []).forEach((a) => a.cancel())");
      await w.evaluate("document.fonts.ready.then(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(true)))))");
      // 从这里开始记录页面变化，一直到导出截图之后（CB-01）。完整档给 lint error 截证据时临时加的红框（MARK_ID）不算页面变化
      await w.evaluate(`(() => {
        const ours = (n) => !!(n && window.__measureCjkMarks && window.__measureCjkMarks.has(n));
        window.__measureCardMutations = 0;
        new MutationObserver((list) => {
          for (const r of list) {
            if (ours(r.target)) continue;
            const nodes = [...r.addedNodes, ...r.removedNodes];
            if (r.type === "childList" && nodes.length > 0 && nodes.every(ours)) continue;
            window.__measureCardMutations++;
          }
        }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
        return true;
      })()`);
      await w.cdp.send("DOM.getDocument", { depth: -1, pierce: true });
      st.counting = true;
      st.shot0 = await capture(w.cdp);
    },
    async afterMeasure(_page, w: PageWorld) {
      const { cdp } = w;
      const shot1 = await capture(cdp);
      // 逐个元素和伪元素查实际用到的字体（CA-01）：穿透 shadow DOM（含表单控件内部的 user-agent shadow）；
      // CDP 的 DOM 接口不受页面脚本影响
      const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
      const nodes: number[] = [];
      const walk = (n: any) => {
        if (n.nodeType === 1) {
          const name = String(n.nodeName ?? "").toUpperCase();
          if (SKIP_NODES.has(name)) return;
          const opaque = OPAQUE.get(name);
          if (opaque) {
            st.opaque.add(opaque);
            return; // iframe 等的内部文档不进去：整个载体已经判为查不到
          }
          nodes.push(n.nodeId);
        }
        for (const c of [...(n.children ?? []), ...(n.pseudoElements ?? []), ...(n.shadowRoots ?? [])]) walk(c);
      };
      walk(root);
      if (nodes.length > MAX_NODES) {
        st.problems.push(`卡片里的元素超过 ${MAX_NODES} 个，没有检查完`);
        return;
      }
      let failed = 0;
      for (const nodeId of nodes) {
        try {
          const { fonts: used } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
          for (const f of used ?? []) {
            const g = Number(f.glyphCount) || 0;
            if (g <= 0) continue;
            const k = `${f.familyName}|${f.postScriptName}|${f.isCustomFont}`;
            const cur = st.used.get(k);
            if (cur) cur.glyphs = Math.max(cur.glyphs, g);
            else st.used.set(k, { family: String(f.familyName), postscript: String(f.postScriptName), custom: !!f.isCustomFont, glyphs: g });
          }
          const { computedStyle } = await cdp.send("CSS.getComputedStyleForNode", { nodeId });
          const ff = (computedStyle ?? []).find((p: any) => p.name === "font-family")?.value ?? "";
          for (const name of String(ff).split(",")) {
            const n = name.trim().replace(/^["']|["']$/g, "");
            if (n && !st.requested.has(n.toLowerCase())) st.requested.set(n.toLowerCase(), n);
          }
        } catch {
          failed++;
        }
      }
      if (failed) st.problems.push(`有 ${failed} 个元素查不了实际用到的字体，没有检查完`);
      const shot2 = await capture(cdp);
      const changed = Number(await w.evaluate("window.__measureCardMutations || 0")) + st.cdpChanges;
      st.counting = false;
      const anims = Number(await w.evaluate("(document.getAnimations ? document.getAnimations() : []).length"));
      const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
      if (!st.shot0 || sha(st.shot0) !== sha(shot1) || sha(shot1) !== sha(shot2) || changed > 0 || anims > 0) {
        st.problems.push("卡片在检查期间发生了变化（脚本改了页面或者又启动了动画），lint、字体检查和截图看到的不是同一个画面，没有检查完。卡片请写成静态页面");
        return;
      }
      if (shot1.readUInt32BE(16) !== CARD_WIDTH || shot1.readUInt32BE(20) !== CARD_HEIGHT) {
        st.problems.push(`截图尺寸不是 ${CARD_WIDTH}×${CARD_HEIGHT}，没有检查完`);
        return;
      }
      st.png = shot1;
      st.done = true;
    }
  };
}

// SVG 图片里有没有文字（CA-01）：工作区里的文件和 data: 地址读出来检查；读不到内容的（blob: 等）按查不到处理
function svgProblems(rootReal: string, urls: string[]): string[] {
  const bad: string[] = [];
  for (const url of [...new Set(urls)]) {
    let text: string | undefined;
    if (url.startsWith("data:")) text = decodeDataUrl(url);
    else if (url.startsWith("file:")) {
      try {
        const real = realpathSync(fileURLToPath(url));
        if (isInside(rootReal, real) && statSync(real).size <= MAX_FILE_BYTES) text = readFileSync(real, "utf8");
      } catch {
        text = undefined;
      }
    }
    if (text === undefined || SVG_HAS_TEXT.test(text)) bad.push(url.startsWith("data:") ? "data: 地址的 SVG" : url.startsWith("file:") ? rel(rootReal, fileURLToPath(url)) : url.slice(0, 80));
  }
  return bad.length ? [`卡片用了含文字（或读不到内容）的 SVG 图片：${bad.slice(0, 5).join("、")}。SVG 图片里的字用什么字体查不到，没有检查完；请把文字写进 HTML，或者转成 PNG`] : [];
}

const OPAQUE_HINT: Record<string, string> = {
  canvas: "canvas 画上去的字",
  iframe: "iframe 里的内容",
  frame: "frame 里的内容",
  object: "object 嵌入的内容",
  embed: "embed 嵌入的内容",
  video: "video 的画面和字幕",
  fencedframe: "fencedframe 里的内容",
  portal: "portal 里的内容"
};

export async function runCard(opts: CardOptions): Promise<CardResult> {
  const cwd = opts.cwd ?? process.cwd();
  const rootReal = realRoot(opts.root ?? cwd);
  const config = opts.config ?? defaultConfig();
  // 先做全部校验，再启动浏览器
  const inAbs = resolve(cwd, opts.input);
  if (!existsSync(inAbs)) throw new UsageError(`找不到卡片文件：${opts.input}`);
  const htmlReal = realpathSync(inAbs);
  if (!isInside(rootReal, htmlReal)) throw new UsageError(`卡片文件必须在工作区之内，已拒绝：${opts.input}`);
  if (![".html", ".htm"].includes(extname(htmlReal).toLowerCase())) throw new UsageError(`card 只接受 .html / .htm 文件：${opts.input}`);
  if (statSync(htmlReal).size > MAX_FILE_BYTES) throw new UsageError(`卡片文件超过 5 MB：${opts.input}`);
  const outReal = safePngPath(rootReal, opts.out, cwd);
  const skipped: CardResult["skipped_fonts"] = [];
  // 命令行的 --font-dir 相对当前目录；配置文件里的 font_dir 相对配置文件所在目录（CA-11）
  const dirFonts = opts.fontDir ? loadFontDir(rootReal, opts.fontDir, cwd, skipped) : config.font_dir ? loadFontDir(rootReal, config.font_dir, opts.configDir ?? rootReal, skipped) : [];
  const evidenceDir = opts.evidenceDir ? resolve(cwd, opts.evidenceDir) : join(dirname(outReal), "evidence");

  // 卡片 lint 和导出在同一次渲染里完成（CA-05）：1080×1440，注入同一批字体，同样的拦截规则
  const st: CardState = { used: new Map(), requested: new Map(), pageFonts: new Map(), svgUrls: [], opaque: new Set(), blocked: [], problems: [], done: false, counting: false, cdpChanges: 0, markNodes: new Set() };
  const lint = await runRender({ inputs: [rel(rootReal, htmlReal)], root: rootReal, cwd: rootReal, config, widths: [CARD_WIDTH], evidenceDir, card: cardHooks(rootReal, htmlReal, dirFonts, st) });

  const result: CardResult = {
    schema_version: SCHEMA_VERSION,
    tool: { name: "measure-cjk", version: TOOL_VERSION },
    input: rel(rootReal, htmlReal),
    size: { width: CARD_WIDTH, height: CARD_HEIGHT },
    status: "rejected",
    fonts: [],
    attribution: [],
    blocked: [],
    skipped_fonts: skipped,
    problems: [],
    lint
  };
  const outsideRoot = lint.run.skipped_inputs.filter((s) => s.reason === "outside-root" || s.reason === "too-large").map((s) => s.file);
  result.blocked = [...new Set([...st.blocked, ...lint.run.remote_refs, ...outsideRoot])];

  // 没检查完的原因（CA-09）：完整档的问题、超时，查不到字体的载体，检查期间页面变化
  const incomplete: string[] = [];
  if (lint.summary.status === "incomplete") {
    for (const p of lint.run.render?.problems ?? []) incomplete.push(p.detail);
    for (const s of lint.run.skipped_inputs) if (s.reason === "timeout") incomplete.push(`卡片渲染超过 ${renderBudgetMs() / 1000} 秒，没有检查完`);
    if (!incomplete.length) incomplete.push(`卡片 lint 没有检查完（${[...new Set(lint.run.skipped_inputs.map((s) => s.reason))].join("、") || "原因见 lint 结果"}）`);
  }
  if (st.opaque.size) incomplete.push(`卡片里有查不到字体的内容：${[...st.opaque].map((k) => OPAQUE_HINT[k] ?? k).join("、")}。这些地方的字用什么字体渲染查不到，没有检查完；请把文字写进 HTML，或者转成图片`);
  incomplete.push(...svgProblems(rootReal, st.svgUrls), ...st.problems);
  if (!st.done && !incomplete.length) incomplete.push("卡片没有渲染完成");

  // 实际用到的字体
  for (const u of st.used.values()) {
    if (u.custom) {
      const f = dirFonts.find((d) => d.allowed && (d.face.postscript === u.postscript || d.face.names.includes(u.family)));
      if (f && !st.pageFonts.has(u.family)) {
        result.fonts.push({ family: f.face.family, names: f.face.names, postscript_name: u.postscript, source: "font_dir", file: f.file, license_id: f.entry?.id, tier: f.entry?.tier, commercial_image: f.entry?.commercial_image ?? "unknown", allowed: true, used: true, requested: true, reason: f.reason, glyph_count: u.glyphs });
        continue;
      }
      // 网络字体却对不上 font_dir 注入的那批：只能是页面自带的（CA-04）
      result.fonts.push({ family: u.family, postscript_name: u.postscript, source: "page", commercial_image: "unknown", allowed: false, used: true, reason: pageFontReason(u.family, st.pageFonts.get(u.family)), glyph_count: u.glyphs });
      continue;
    }
    const j = judgeSystemFont(u.family, u.postscript);
    result.fonts.push({ family: u.family, postscript_name: u.postscript, source: "system", license_id: j.entry?.id, tier: j.entry?.tier, commercial_image: j.entry?.commercial_image ?? "unknown", allowed: j.allowed, used: true, reason: j.reason, glyph_count: u.glyphs });
  }
  // 加载了、但这次没查到用它渲染文字的页面字体：同样拒绝（card 只用 font_dir）
  for (const [family, how] of st.pageFonts) {
    if (!result.fonts.some((f) => f.source === "page" && f.family === family)) result.fonts.push({ family, postscript_name: "", source: "page", commercial_image: "unknown", allowed: false, used: false, reason: pageFontReason(family, how), glyph_count: 0 });
  }
  // font_dir 里没放行的字体：卡片点名要用它时，拒绝出图（PRD 场景 S2：🔴 字体拒绝嵌入，说明原因）
  for (const f of dirFonts.filter((d) => !d.allowed)) {
    const requested = f.face.names.some((n) => st.requested.has(n.toLowerCase()));
    result.fonts.push({ family: f.face.family, names: f.face.names, postscript_name: f.face.postscript, source: "font_dir", file: f.file, license_id: f.entry?.id, tier: f.entry?.tier, commercial_image: f.entry?.commercial_image ?? "unknown", allowed: false, used: false, requested, reason: f.reason, glyph_count: 0 });
  }
  // 样式里点名要用、授权表里不允许出图的字体：font_dir 里没有这份文件也不出图（CA-06，PRD C27 的例子）
  for (const name of st.requested.values()) {
    const entry = matchFontName(name);
    if (!entry || entry.commercial_image === true) continue;
    const same = result.fonts.find((f) => f.license_id === entry.id);
    if (same) {
      same.requested = true;
      continue;
    }
    const why = entry.commercial_image === "unknown" ? "官方原文没有写清能不能用于商用图片，按不允许处理" : "官方原文不允许用于商用图片";
    result.fonts.push({ family: name, postscript_name: "", source: "css", license_id: entry.id, tier: entry.tier, commercial_image: entry.commercial_image, allowed: false, used: false, requested: true, reason: `卡片样式里点名要用「${name}」，命中授权表「${entry.names[0]}」（${TIER_LABEL[entry.tier]}）：${why}。即使浏览器换成了别的字体，也不出图（PRD 场景 S2）。${src(entry)}`, glyph_count: 0 });
  }

  // 署名提示
  for (const f of result.fonts.filter((x) => x.used && x.allowed && x.license_id)) {
    const entry = matchFontName(f.family) ?? dirFonts.find((d) => d.file === f.file)?.entry;
    if (entry?.attribution_required === true && !result.attribution.some((a) => a.license_id === entry.id)) {
      result.attribution.push({ family: f.family, license_id: entry.id, note: `「${f.family}」的授权要求署名，发布这张卡片时请按官方要求注明字体来源。${src(entry)}` });
    }
  }

  const badUsed = result.fonts.filter((f) => f.used && !f.allowed);
  const badRequested = result.fonts.filter((f) => f.requested && !f.allowed);
  const pageFonts = result.fonts.filter((f) => f.source === "page");
  if (badUsed.length) result.problems.push(`卡片用到了不能用于商用图片的字体：${[...new Set(badUsed.map((f) => f.family))].join("、")}`);
  if (badRequested.length) result.problems.push(`卡片点名要用的字体不允许出图：${[...new Set(badRequested.map((f) => f.family))].join("、")}`);
  if (pageFonts.length) result.problems.push(`卡片页面自带了字体：${[...new Set(pageFonts.map((f) => f.family))].join("、")}。card 只使用 font_dir 里的字体`);
  if (lint.summary.errors > 0) result.problems.push(`卡片有 ${lint.summary.errors} 条 lint error`);
  if (incomplete.length || !st.done || !st.png) {
    result.status = "incomplete";
    result.problems.push(...incomplete);
    return result;
  }
  if (badUsed.length || badRequested.length || pageFonts.length || lint.summary.errors > 0 || st.used.size === 0) {
    if (st.used.size === 0) result.problems.push("卡片上没有渲染出任何文字");
    result.status = "rejected";
    return result;
  }
  atomicWrite(outReal, st.png);
  result.output = rel(rootReal, outReal);
  result.status = "exported";
  return result;
}

function pageFontReason(family: string, how?: string): string {
  return `卡片页面自己带了字体「${family}」（${how ?? "页面加载的网络字体"}），不是从 font_dir 加载的。card 只使用 font_dir 里、过了授权表的字体，页面自带的字体一律不出图（PRD §5.4）。请把字体文件放进 font_dir，并删掉页面里的 @font-face 或 FontFace 代码。`;
}

export function cardExitCode(r: CardResult): number {
  return r.status === "exported" ? 0 : r.status === "rejected" ? 1 : 2;
}
